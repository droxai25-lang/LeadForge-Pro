import { createHash } from "node:crypto";

export const MAX_CRAWL_SNAPSHOT_BYTES = 512 * 1024;
export const MAX_ROBOTS_BYTES = 128 * 1024;

export type CrawlOutcome = "found" | "not_found" | "rate_limited" | "blocked" | "failed";

export interface BoundedTextSnapshot {
  text: string;
  bytes: number;
  truncated: boolean;
  sha256: string;
}

export interface NormalizedCrawlTarget {
  domain: string;
  requestedUrl: string;
}

export interface NormalizedWebAnalysis {
  painPoints: string[];
  companySignals: string[];
  hooks: Array<{
    hookType: string;
    headline: string;
    emailOpeningSnippet: string;
  }>;
}

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export class CrawlInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrawlInputError";
  }
}

/** Normalizes user input to one HTTPS origin. Crawling arbitrary paths is intentionally unsupported. */
export function normalizeCrawlTarget(rawInput: unknown): NormalizedCrawlTarget {
  if (typeof rawInput !== "string" || !rawInput.trim()) {
    throw new CrawlInputError("A valid public domain or HTTPS URL is required.");
  }

  const trimmed = rawInput.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new CrawlInputError("The crawl target is not a valid domain or URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new CrawlInputError("Only HTTPS crawl targets are permitted.");
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new CrawlInputError("Crawl targets cannot include credentials or a custom port.");
  }

  const domain = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!HOSTNAME_PATTERN.test(domain)) {
    throw new CrawlInputError("The crawl target must be a fully qualified public hostname.");
  }

  return { domain, requestedUrl: `https://${domain}/` };
}

/** Reads and hashes only a bounded prefix, cancelling the response once the evidence budget is reached. */
export async function readBoundedTextResponse(
  response: Response,
  maxBytes = MAX_CRAWL_SNAPSHOT_BYTES
): Promise<BoundedTextSnapshot> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("maxBytes must be a positive safe integer.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return {
      text: "",
      bytes: 0,
      truncated: false,
      sha256: createHash("sha256").update(Buffer.alloc(0)).digest("hex")
    };
  }

  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      const remaining = maxBytes - bytes;
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        bytes = maxBytes;
        truncated = true;
        await reader.cancel("LeadForge crawl snapshot byte limit reached");
        break;
      }

      chunks.push(value);
      bytes += value.byteLength;
      if (bytes === maxBytes) {
        const next = await reader.read();
        if (!next.done) {
          truncated = true;
          await reader.cancel("LeadForge crawl snapshot byte limit reached");
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const snapshot = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    bytes
  );
  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(snapshot),
    bytes,
    truncated,
    sha256: createHash("sha256").update(snapshot).digest("hex")
  };
}

export function classifyHttpOutcome(status: number): CrawlOutcome {
  if (status >= 200 && status < 300) return "found";
  if (status === 404 || status === 410) return "not_found";
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "blocked";
  return "failed";
}

export function isSupportedHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "text/html" || mediaType === "application/xhtml+xml";
}

/**
 * Evaluates the matching robots.txt group for LeadForgeCrawler. The most-specific
 * matching Allow/Disallow rule wins; an equally specific Allow wins.
 */
export function isPathAllowedByRobots(robotsText: string, path = "/", crawlerUserAgent = "LeadForgeCrawler"): boolean {
  type Group = { agents: string[]; rules: Array<{ directive: "allow" | "disallow"; path: string }> };
  const groups: Group[] = [];
  let current: Group | null = null;
  let rulesStarted = false;

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      current = null;
      rulesStarted = false;
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;
    const field = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (field === "user-agent") {
      if (!current || rulesStarted) {
        current = { agents: [], rules: [] };
        groups.push(current);
        rulesStarted = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if ((field === "allow" || field === "disallow") && current) {
      rulesStarted = true;
      current.rules.push({ directive: field, path: value });
    }
  }

  const normalizedAgent = crawlerUserAgent.toLowerCase();
  const exactGroups = groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && normalizedAgent.includes(agent))
  );
  const applicableGroups = exactGroups.length > 0 ? exactGroups : groups.filter((group) => group.agents.includes("*"));

  const matchingRules = applicableGroups
    .flatMap((group) => group.rules)
    .filter((rule) => rule.path && path.startsWith(rule.path))
    .sort((left, right) => {
      const specificity = right.path.length - left.path.length;
      if (specificity !== 0) return specificity;
      return left.directive === "allow" ? -1 : 1;
    });

  return matchingRules[0]?.directive !== "disallow";
}

function normalizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Treats model output as untrusted and limits it before persistence or rendering. */
export function normalizeWebAnalysis(value: unknown): NormalizedWebAnalysis {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawHooks = Array.isArray(input.hooks) ? input.hooks : [];
  const hooks = rawHooks
    .filter((hook): hook is Record<string, unknown> => Boolean(hook) && typeof hook === "object")
    .map((hook) => ({
      hookType:
        typeof hook.hookType === "string"
          ? hook.hookType.replace(/[^a-z0-9_-]/gi, "").slice(0, 48) || "source_fact"
          : "source_fact",
      headline: typeof hook.headline === "string" ? hook.headline.replace(/\s+/g, " ").trim().slice(0, 160) : "",
      emailOpeningSnippet:
        typeof hook.emailOpeningSnippet === "string"
          ? hook.emailOpeningSnippet.replace(/\s+/g, " ").trim().slice(0, 500)
          : ""
    }))
    .filter((hook) => hook.headline && hook.emailOpeningSnippet)
    .slice(0, 5);

  return {
    painPoints: normalizeStringArray(input.painPoints, 8, 500),
    companySignals: normalizeStringArray(input.companySignals, 8, 500),
    hooks
  };
}

export function selectEvidenceHeaders(headers: Headers): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const name of [
    "cache-control",
    "content-language",
    "content-length",
    "content-security-policy",
    "content-type",
    "date",
    "etag",
    "last-modified",
    "server",
    "strict-transport-security"
  ]) {
    const value = headers.get(name);
    if (value) selected[name] = value.slice(0, 2_000);
  }
  return selected;
}
