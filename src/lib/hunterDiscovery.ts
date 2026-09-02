import { normalizeSingleLineText } from "./plainText";

export const HUNTER_API_BASE_URL = "https://api.hunter.io/v2";

export const HUNTER_DEPARTMENTS = [
  "executive",
  "it",
  "finance",
  "management",
  "sales",
  "legal",
  "support",
  "hr",
  "marketing",
  "communication",
  "education",
  "design",
  "health",
  "operations",
  "product",
  "research",
  "consulting",
  "administrative",
  "procurement"
] as const;

export const HUNTER_SENIORITIES = ["junior", "senior", "executive"] as const;

type HunterDepartment = (typeof HUNTER_DEPARTMENTS)[number];
type HunterSeniority = (typeof HUNTER_SENIORITIES)[number];

export interface HunterDiscoveryInput {
  query: string;
  companyLimit: number;
  contactsPerCompany: number;
  maxDomainSearches: number;
  departments: HunterDepartment[];
  seniorities: HunterSeniority[];
  decisionMakerOnly: boolean;
}

export interface HunterCompany {
  providerCompanyId: string | null;
  name: string;
  domain: string;
  industry: string | null;
  description: string | null;
  employeeCount: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  websiteUrl: string;
  observedAt: Date;
}

export interface HunterContact {
  email: string;
  firstName: string;
  lastName: string | null;
  position: string;
  seniority: string | null;
  department: string | null;
  decisionMaker: boolean;
  confidence: number | null;
  verificationStatus: string | null;
  sourceUrls: string[];
  observedAt: Date;
}

export type HunterErrorCode =
  | "not_configured"
  | "invalid_request"
  | "authentication_failed"
  | "access_denied"
  | "rate_limited"
  | "legally_blocked"
  | "provider_failed"
  | "network_failed"
  | "invalid_response";

export class HunterDiscoveryError extends Error {
  constructor(
    public readonly code: HunterErrorCode,
    message: string,
    public readonly httpStatus = 502
  ) {
    super(message);
    this.name = "HunterDiscoveryError";
  }
}

export interface HunterReadiness {
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  maxEmailCreditsPerRun: number;
  reason: string | null;
}

function integerInRange(value: unknown, label: string, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HunterDiscoveryError(
      "invalid_request",
      `${label} must be an integer between ${minimum} and ${maximum}.`,
      400
    );
  }
  return parsed;
}

function plainText(value: unknown, label: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") {
    throw new HunterDiscoveryError("invalid_request", `${label} is required.`, 400);
  }
  const normalized = normalizeSingleLineText(value);
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new HunterDiscoveryError(
      "invalid_request",
      `${label} must be between ${minimum} and ${maximum} characters.`,
      400
    );
  }
  return normalized;
}

function normalizeList<T extends string>(value: unknown, allowed: readonly T[], label: string): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HunterDiscoveryError("invalid_request", `${label} must be an array.`, 400);
  const normalized = [...new Set(value.map((entry) => String(entry).trim().toLowerCase()))];
  if (normalized.some((entry) => !allowed.includes(entry as T))) {
    throw new HunterDiscoveryError("invalid_request", `${label} contains an unsupported value.`, 400);
  }
  return normalized as T[];
}

export function configuredHunterCreditLimit(env: NodeJS.ProcessEnv = process.env): number {
  return integerInRange(env.HUNTER_MAX_EMAIL_CREDITS_PER_RUN || "25", "HUNTER_MAX_EMAIL_CREDITS_PER_RUN", 0, 100);
}

function normalizedApiKey(env: NodeJS.ProcessEnv): string {
  return String(env.HUNTER_API_KEY || "").trim();
}

export function getHunterDiscoveryReadiness(env: NodeJS.ProcessEnv = process.env): HunterReadiness {
  const enabled = env.HUNTER_DISCOVERY_ENABLED === "true";
  const key = normalizedApiKey(env);
  const configured = key.length >= 16 && key !== "test-api-key" && !/replace|placeholder|example/i.test(key);
  const maxEmailCreditsPerRun = configuredHunterCreditLimit(env);
  let reason: string | null = null;
  if (!enabled) reason = "Hunter discovery is disabled. Set HUNTER_DISCOVERY_ENABLED=true after adding a real API key.";
  else if (key === "test-api-key") reason = "Hunter's test-api-key returns dummy data and is intentionally rejected.";
  else if (!configured) reason = "A real HUNTER_API_KEY is required.";
  return { enabled, configured, ready: enabled && configured, maxEmailCreditsPerRun, reason };
}

export function normalizeHunterDiscoveryInput(
  value: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env
): HunterDiscoveryInput {
  const configuredMaximum = configuredHunterCreditLimit(env);
  const maxDomainSearches = integerInRange(
    value.maxDomainSearches ?? Math.min(10, configuredMaximum),
    "Maximum domain searches",
    0,
    configuredMaximum
  );
  return {
    query: plainText(value.query, "Market query", 3, 500),
    companyLimit: integerInRange(value.companyLimit ?? 25, "Company limit", 1, 100),
    contactsPerCompany: integerInRange(value.contactsPerCompany ?? 3, "Contacts per company", 1, 10),
    maxDomainSearches,
    departments: normalizeList(value.departments, HUNTER_DEPARTMENTS, "Departments"),
    seniorities: normalizeList(value.seniorities, HUNTER_SENIORITIES, "Seniorities"),
    decisionMakerOnly: value.decisionMakerOnly !== false
  };
}

function stringOrNull(value: unknown, maximum = 1000): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeSingleLineText(value);
  return normalized ? normalized.slice(0, maximum) : null;
}

function intOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function domainOrNull(value: unknown): string | null {
  const text = stringOrNull(value, 300)
    ?.toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return text && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(text) ? text : null;
}

function emailOrNull(value: unknown): string | null {
  const text = stringOrNull(value, 320)?.toLowerCase();
  return text && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mapCompany(rawValue: unknown): HunterCompany | null {
  const raw = asRecord(rawValue);
  const domain = domainOrNull(raw.domain || raw.website || raw.webmail);
  const name = stringOrNull(raw.name || raw.organization, 300);
  if (!domain || !name) return null;
  const location = asRecord(raw.location || raw.headquarters);
  return {
    providerCompanyId: stringOrNull(raw.id, 160),
    name,
    domain,
    industry: stringOrNull(raw.industry, 200),
    description: stringOrNull(raw.description, 2000),
    employeeCount: intOrNull(raw.headcount || raw.employee_count || raw.employees),
    city: stringOrNull(location.city || raw.city, 160),
    state: stringOrNull(location.state || raw.state, 160),
    country: stringOrNull(location.country || raw.country, 160),
    websiteUrl: `https://${domain}`,
    observedAt: new Date()
  };
}

function mapContact(rawValue: unknown): HunterContact | null {
  const raw = asRecord(rawValue);
  const email = emailOrNull(raw.value || raw.email);
  const firstName = stringOrNull(raw.first_name || raw.firstName, 160);
  const position = stringOrNull(raw.position || raw.job_title || raw.title, 300);
  if (!email || !firstName || !position) return null;
  const verification = asRecord(raw.verification);
  const sourceUrls = [
    ...new Set(
      asArray(raw.sources)
        .map((entry) => stringOrNull(asRecord(entry).uri || asRecord(entry).url, 2000))
        .filter((entry): entry is string => Boolean(entry && /^https?:\/\//i.test(entry)))
    )
  ].slice(0, 20);
  return {
    email,
    firstName,
    lastName: stringOrNull(raw.last_name || raw.lastName, 160),
    position,
    seniority: stringOrNull(raw.seniority, 80),
    department: stringOrNull(raw.department, 80),
    decisionMaker: raw.decision_maker === true,
    confidence: intOrNull(raw.confidence),
    verificationStatus: stringOrNull(verification.status || raw.verification_status, 80),
    sourceUrls,
    observedAt: new Date()
  };
}

function errorFromStatus(status: number, message: string): HunterDiscoveryError {
  if (status === 400 || status === 422) return new HunterDiscoveryError("invalid_request", message, 400);
  if (status === 401) return new HunterDiscoveryError("authentication_failed", message, 503);
  if (status === 403) return new HunterDiscoveryError("access_denied", message, 503);
  if (status === 429) return new HunterDiscoveryError("rate_limited", message, 429);
  if (status === 451) return new HunterDiscoveryError("legally_blocked", message, 451);
  return new HunterDiscoveryError("provider_failed", message, 502);
}

const MAX_HUNTER_RESPONSE_BYTES = 5 * 1024 * 1024;

async function readHunterJson(response: Response): Promise<unknown> {
  const advertisedLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_HUNTER_RESPONSE_BYTES) {
    throw new HunterDiscoveryError("invalid_response", "Hunter response exceeded the 5 MiB safety limit.");
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_HUNTER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new HunterDiscoveryError("invalid_response", "Hunter response exceeded the 5 MiB safety limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new HunterDiscoveryError("invalid_response", "Hunter returned malformed JSON.");
  }
}

export class HunterDiscoveryClient {
  private readonly apiKey: string;

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImplementation: typeof fetch = fetch
  ) {
    const readiness = getHunterDiscoveryReadiness(env);
    if (!readiness.ready)
      throw new HunterDiscoveryError("not_configured", readiness.reason || "Hunter discovery is unavailable.", 503);
    this.apiKey = normalizedApiKey(env);
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await this.fetchImplementation(`${HUNTER_API_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { Accept: "application/json", "X-API-KEY": this.apiKey, ...(init.headers || {}) }
      });
      const body = await readHunterJson(response);
      const providerMessage =
        stringOrNull(asArray(asRecord(body).errors)[0] && asRecord(asArray(asRecord(body).errors)[0]).details, 500) ||
        stringOrNull(asRecord(body).message, 500) ||
        `Hunter returned HTTP ${response.status}.`;
      if (!response.ok) throw errorFromStatus(response.status, providerMessage);
      if (!body || typeof body !== "object")
        throw new HunterDiscoveryError("invalid_response", "Hunter returned an invalid JSON response.");
      return body as Record<string, unknown>;
    } catch (error) {
      if (error instanceof HunterDiscoveryError) throw error;
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Hunter request timed out after 20 seconds."
          : `Hunter request failed: ${error instanceof Error ? error.message : String(error)}`;
      throw new HunterDiscoveryError("network_failed", message);
    } finally {
      clearTimeout(timeout);
    }
  }

  async discoverCompanies(input: HunterDiscoveryInput): Promise<HunterCompany[]> {
    const body = await this.request("/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input.query })
    });
    const rawData = body.data;
    const data = asRecord(rawData);
    const candidates = Array.isArray(rawData) ? rawData : asArray(data.companies || data.results);
    const unique = new Map<string, HunterCompany>();
    for (const candidate of candidates) {
      const company = mapCompany(candidate);
      if (company && !unique.has(company.domain)) unique.set(company.domain, company);
    }
    return [...unique.values()].slice(0, input.companyLimit);
  }

  async searchDomainContacts(domain: string, input: HunterDiscoveryInput): Promise<HunterContact[]> {
    const normalizedDomain = domainOrNull(domain);
    if (!normalizedDomain)
      throw new HunterDiscoveryError("invalid_request", "A valid company domain is required.", 400);
    const query = new URLSearchParams({
      domain: normalizedDomain,
      type: "personal",
      required_field: "full_name,position",
      verification_status: "valid",
      limit: String(input.contactsPerCompany)
    });
    if (input.decisionMakerOnly) query.set("decision_maker", "true");
    if (input.departments.length) query.set("department", input.departments.join(","));
    if (input.seniorities.length) query.set("seniority", input.seniorities.join(","));
    const body = await this.request(`/domain-search?${query.toString()}`, { method: "GET" });
    const contacts = asArray(asRecord(body.data).emails)
      .map(mapContact)
      .filter((entry): entry is HunterContact => Boolean(entry));
    return [...new Map(contacts.map((contact) => [contact.email, contact])).values()].slice(
      0,
      input.contactsPerCompany
    );
  }
}
