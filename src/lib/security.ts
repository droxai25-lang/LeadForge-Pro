/**
 * security.ts
 *
 * Production-grade security primitives shared by the LeadForge Pro server:
 * - Fail-closed JSON Web Token signing/verification with audience, issuer and
 *   a 32+ character secret (no hard-coded fallback material).
 * - AES-256-GCM encryption/decryption for SMTP mailbox credentials at rest.
 * - Constant-time comparison for webhook signatures and tokens.
 * - DNS-resolution-aware SSRF guard that blocks private, loopback, link-local,
 *   multicast and cloud-metadata ranges before any outbound socket/tls/fetch.
 *
 * Public API surface is fully typed; all inputs are validated at the boundary.
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import net from "node:net";
import { createRequire } from "node:module";
import type { SignOptions, VerifyOptions } from "jsonwebtoken";
import { Agent, fetch as undiciFetch } from "undici";

const require = createRequire(typeof __filename !== "undefined" ? __filename : `${process.cwd()}/package.json`);
const { sign, verify } = require("jsonwebtoken") as typeof import("jsonwebtoken");

/** Preferred token lifetime (access session before forced silent refresh). */
export const SESSION_TTL_SECONDS = 4 * 60 * 60;

/** Audience / issuer used to bind tokens to this API, preventing cross-app reuse. */
export const TOKEN_AUDIENCE = "leadforge-api";
export const TOKEN_ISSUER = "leadforge-session-server";

/**
 * Returns a required environment secret, refusing to start when it is missing
 * or shorter than the requested minimum length.
 */
function getRequiredEnv(name: string, minimumLength: number): string {
  const value = process.env[name];
  if (!value || value.trim().length < minimumLength) {
    throw new Error(
      `${name} must be set and be at least ${minimumLength} characters. Refusing to start with a weak or default secret.`
    );
  }
  return value.trim();
}

/** Returns the 32-byte AES key for mailbox credential encryption at rest. */
export function getMailboxEncryptionKey(): Buffer {
  const hex = getRequiredEnv("MAILBOX_ENCRYPTION_KEY", 64);
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("MAILBOX_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

/**
 * Returns the required token hashing secret, enforcing minimum length at startup.
 * This secret is used to bind opaque token hashes so they are not reproducible
 * outside of the running server. Different servers, different secrets = different
 * hashes for the same token (revocation is not discoverable).
 */
function getTokenHashSecret(): string {
  return getRequiredEnv("TOKEN_HASH_SECRET", 32);
}

export interface SessionClaims {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
  readonly organizationId: string;
  readonly isDeveloper: boolean;
  readonly jti?: string;
}

/**
 * Signs a session token bound to our audience and issuer with a short expiry
 * and a per-token identifier for server-side revocation.
 */
export function signSessionToken(
  claims: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
    isDeveloper: boolean;
  },
  secret: string
): string {
  return sign(
    {
      sub: claims.id,
      email: claims.email,
      role: claims.role,
      organizationId: claims.organizationId,
      isDeveloper: claims.isDeveloper,
      jti: randomBytes(12).toString("hex")
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: SESSION_TTL_SECONDS,
      audience: TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER
    } as SignOptions
  );
}

/** Raised when a caller presents an unverifiable token for a protected resource. */
export class SessionVerificationError extends Error {
  constructor(readonly reason: string) {
    super(`Session verification failed: ${reason}`);
  }
}

/**
 * Verifies a token and returns strongly typed claims. Malformed or untrusted
 * tokens are rejected via a `SessionVerificationError`.
 */
export function verifySessionToken(token: string, secret: string): SessionClaims {
  let decoded: Record<string, unknown>;
  try {
    decoded = verify(token, secret, {
      algorithms: ["HS256"],
      audience: TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER
    } as VerifyOptions) as Record<string, unknown>;
  } catch (cause) {
    throw new SessionVerificationError(cause instanceof Error ? cause.message : "invalid JWT");
  }

  const sub = typeof decoded.sub === "string" ? decoded.sub : "";
  const email = typeof decoded.email === "string" ? decoded.email : "";
  const role = typeof decoded.role === "string" ? decoded.role : "";
  const organizationId = typeof decoded.organizationId === "string" ? decoded.organizationId : "";
  const isDeveloper = Boolean(decoded.isDeveloper);
  const jti = typeof decoded.jti === "string" ? decoded.jti : "";

  if (!sub || !email || !role || !organizationId) {
    throw new SessionVerificationError("required claims missing");
  }

  return { sub, email, role, organizationId, isDeveloper, jti: jti || undefined };
}
/* ------------------------------------------------------------------ *
 * AES-256-GCM envelope for mailbox credentials at rest
 * ------------------------------------------------------------------ */

const SECRET_ENVELOPE_PREFIX = "enc:v1:";

/**
 * Encrypts a plaintext secret with AES-256-GCM, returning an armored,
 * self-describing string suitable for storing SMTP passwords at rest.
 */
export function encryptSecretPlaintext(plaintext: string, key: Buffer = getMailboxEncryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SECRET_ENVELOPE_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypts an armored string produced by encryptSecretPlaintext. Throws when
 * the envelope is malformed or the key is wrong (GCM authentication failure).
 */
export function decryptSecretEnvelope(armored: string, key: Buffer = getMailboxEncryptionKey()): string {
  if (!armored.startsWith(SECRET_ENVELOPE_PREFIX)) {
    throw new Error("Malformed secret envelope: unsupported armor prefix.");
  }
  const body = armored.slice(SECRET_ENVELOPE_PREFIX.length);
  const [ivBase64, tagBase64, dataBase64] = body.split(":");
  if (!ivBase64 || !tagBase64 || !dataBase64) {
    throw new Error("Malformed secret envelope: expected iv:tag:ciphertext.");
  }
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const data = Buffer.from(dataBase64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/**
 * Constant-time comparison to avoid timing side channels when validating
 * webhook HMAC signatures or bearer tokens.
 */
export function constantTimeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/** Computes an HMAC-SHA256 hex digest over the provided payload. */
export function computeWebhookHmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Generates cryptographically secure random tokens (invites, webhooks, ids). */
export function createCryptoToken(byteLength = 24): string {
  return randomBytes(byteLength).toString("base64url");
}
/* ------------------------------------------------------------------ *
 * SSRF guards — DNS-resolution-aware public-address enforcement
 * ------------------------------------------------------------------ */

function ipv4ToBigInt(ipv4Address: string): bigint {
  const octets = ipv4Address.split(".").map((octet) => Number(octet));
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    throw new Error(`Not a valid IPv4 address: ${ipv4Address}`);
  }
  return (BigInt(octets[0]) << 24n) | (BigInt(octets[1]) << 16n) | (BigInt(octets[2]) << 8n) | BigInt(octets[3]);
}

const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [bigint, bigint]> = [
  [0x00000000n, 0x00ffffffn],
  [0x0a000000n, 0x0affffffn],
  [0x7f000000n, 0x7fffffffn],
  [0xa9fe0000n, 0xa9feffffn],
  [0xac100000n, 0xac1fffffn],
  [0xc0a80000n, 0xc0a8ffffn],
  [0xc0000000n, 0xc00000ffn],
  [0xc0000200n, 0xc00002ffn],
  [0xc6120000n, 0xc612ffffn],
  [0xc6336400n, 0xc63364ffn],
  [0xcb007100n, 0xcb0071ffn],
  [0xe0000000n, 0xefffffffn],
  [0xf0000000n, 0xffffffffn]
];

/**
 * Returns true when the IP is a private, loopback, link-local, multicast,
 * reserved, or otherwise non-routable address that must never be reached by
 * outbound application traffic.
 */
export function isPrivateIpAddress(ipAddress: string): boolean {
  if (net.isIP(ipAddress) === 0) return true;
  if (net.isIP(ipAddress) === 6) {
    const lowered = ipAddress.toLowerCase();
    if (lowered.startsWith("::ffff:")) return isPrivateIpAddress(lowered.slice(7));
    return (
      lowered === "::1" ||
      lowered === "::" ||
      lowered.startsWith("fc") ||
      lowered.startsWith("fd") ||
      /^fe[89ab]/.test(lowered) ||
      lowered.startsWith("ff") ||
      lowered.startsWith("2001:db8") ||
      lowered.startsWith("2002:") ||
      lowered.startsWith("100:")
    );
  }
  const numericValue = ipv4ToBigInt(ipAddress);
  return BLOCKED_IPV4_RANGES.some(([rangeStart, rangeEnd]) => numericValue >= rangeStart && numericValue <= rangeEnd);
}

/**
 * Resolves the hostname and rejects the call if any resolved address is
 * private/reserved. This is the hard SSRF boundary for SMTP, TCP and fetch
 * targets derived from user input.
 */
export interface PublicHostAddress {
  address: string;
  family: 4 | 6;
}

/** Creates a connection lookup that can return only the already-validated addresses for one host. */
export function createPinnedLookup(expectedHostname: string, addresses: readonly PublicHostAddress[]): LookupFunction {
  const normalizedExpectedHostname = expectedHostname.toLowerCase();
  let nextAddressIndex = 0;
  return (hostname, options, callback) => {
    if (hostname.toLowerCase() !== normalizedExpectedHostname) {
      callback(new SSRFGuardError("HTTP client attempted to resolve an unexpected hostname."), "");
      return;
    }
    const requestedFamily =
      typeof options === "number" ? options : Number((options as { family?: number } | undefined)?.family || 0);
    const candidates =
      requestedFamily === 4 || requestedFamily === 6
        ? addresses.filter((entry) => entry.family === requestedFamily)
        : addresses;
    if (candidates.length === 0) {
      callback(new SSRFGuardError(`No validated IPv${requestedFamily} address is available for ${hostname}.`), "");
      return;
    }
    if (typeof options === "object" && options && (options as { all?: boolean }).all) {
      callback(
        null,
        candidates.map((entry) => ({ address: entry.address, family: entry.family }))
      );
      return;
    }
    const selected = candidates[nextAddressIndex % candidates.length];
    nextAddressIndex += 1;
    callback(null, selected.address, selected.family);
  };
}

async function resolvePublicHostAddresses(hostname: string): Promise<PublicHostAddress[]> {
  const normalized = hostname.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized) || normalized.includes("://")) {
    throw new SSRFGuardError(`Unsupported outbound hostname: ${hostname}`);
  }
  const [ipv4Result, ipv6Result] = await Promise.allSettled([
    dns.promises.resolve4(normalized),
    dns.promises.resolve6(normalized)
  ]);
  const resolvedAddresses: PublicHostAddress[] = [
    ...(ipv4Result.status === "fulfilled" ? ipv4Result.value.map((address) => ({ address, family: 4 as const })) : []),
    ...(ipv6Result.status === "fulfilled" ? ipv6Result.value.map((address) => ({ address, family: 6 as const })) : [])
  ];
  if (ipv4Result.status === "rejected" && ipv6Result.status === "rejected") {
    throw new SSRFGuardError(`DNS resolution failed for outbound target: ${hostname}`);
  }
  if (resolvedAddresses.length === 0) {
    throw new SSRFGuardError(`No addresses resolvable for outbound target: ${hostname}`);
  }
  for (const resolved of resolvedAddresses) {
    if (isPrivateIpAddress(resolved.address)) {
      throw new SSRFGuardError(`Blocked outbound target ${hostname} -> private/reserved address ${resolved.address}.`);
    }
  }
  return resolvedAddresses;
}

export async function assertPublicHost(hostname: string): Promise<void> {
  await resolvePublicHostAddresses(hostname);
}

/**
 * Validates a full http(s) URL for outbound fetch: only https is allowed by
 * default, and the hostname must resolve to public address space.
 */
export async function assertSafeOutboundUrl(
  rawUrl: string,
  options: { readonly allowInsecureHttp?: boolean } = {}
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SSRFGuardError("Invalid outbound URL.");
  }
  if (parsed.protocol === "http:" && !options.allowInsecureHttp) {
    throw new SSRFGuardError("Only https outbound URLs are permitted.");
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new SSRFGuardError("Only http(s) schemes are permitted for outbound URLs.");
  }
  if (!parsed.hostname) throw new SSRFGuardError("Outbound URL is missing a hostname.");
  await assertPublicHost(parsed.hostname);
  return parsed;
}

/** Fetches an outbound URL while revalidating every redirect target. */
export async function fetchSafeOutboundUrl(
  rawUrl: string,
  init: RequestInit = {},
  maxRedirects = 5,
  beforeRedirectRequest?: (url: URL) => Promise<void>
): Promise<{ response: Response; finalUrl: URL; release: () => Promise<void> }> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(rawUrl);
  } catch {
    throw new SSRFGuardError("Invalid outbound URL.");
  }

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    if (redirectCount > 0 && beforeRedirectRequest) await beforeRedirectRequest(currentUrl);
    if (currentUrl.protocol !== "https:") {
      throw new SSRFGuardError("Only https outbound URLs are permitted.");
    }
    if (!currentUrl.hostname) throw new SSRFGuardError("Outbound URL is missing a hostname.");
    const expectedHostname = currentUrl.hostname.toLowerCase();
    const addresses = await resolvePublicHostAddresses(expectedHostname);
    const dispatcher = new Agent({
      connect: {
        lookup: createPinnedLookup(expectedHostname, addresses)
      }
    });

    let response: Response;
    try {
      response = (await undiciFetch(currentUrl, {
        ...(init as unknown as import("undici").RequestInit),
        redirect: "manual",
        dispatcher
      })) as unknown as Response;
    } catch (error) {
      await dispatcher.close();
      throw error;
    }

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      let released = false;
      return {
        response,
        finalUrl: currentUrl,
        release: async () => {
          if (released) return;
          released = true;
          await dispatcher.close();
        }
      };
    }

    if (redirectCount === maxRedirects) {
      await response.body?.cancel();
      await dispatcher.close();
      throw new SSRFGuardError(`Outbound target exceeded ${maxRedirects} redirects.`);
    }

    const location = response.headers.get("location");
    await response.body?.cancel();
    await dispatcher.close();
    if (!location) throw new SSRFGuardError("Outbound redirect did not include a Location header.");
    currentUrl = await assertSafeOutboundUrl(new URL(location, currentUrl).toString());
  }

  throw new SSRFGuardError("Outbound redirect validation failed.");
}

/** Raised when a user-controlled network target fails the SSRF boundary. */
export class SSRFGuardError extends Error {}

/**
 * Generates a cryptographically secure random opaque token (hex-encoded).
 * Used for refresh tokens and password-reset tokens that are stored in the
 * database only as their SHA-256 hash, never as plaintext.
 */
export function generateOpaqueRandomToken(byteLength: number = 32): string {
  return randomBytes(byteLength).toString("hex");
}

/**
 * Hashes an opaque token with HMAC-SHA256 so databases can store a searchable
 * fingerprint without ever persisting the raw secret. The secret is bound at
 * startup from the environment, making the hash non-reproducible across restarts
 * or deployments with different secrets.
 */
export function hashOpaqueToken(token: string): string {
  return createHmac("sha256", getTokenHashSecret()).update(token).digest("hex");
}

/** Default lifetime (milliseconds) of a rotating refresh token. */
export const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Default lifetime (milliseconds) of a single-use password-reset token. */
export const PASSWORD_RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000; // 1 hour

/** Lifetime (seconds) of the short-lived access session. */
export const ACCESS_SESSION_TTL_SECONDS = 15 * 60; // 15 minutes
