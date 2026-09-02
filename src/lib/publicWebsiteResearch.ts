import {
  classifyHttpOutcome,
  isPathAllowedByRobots,
  isSupportedHtmlContentType,
  MAX_ROBOTS_BYTES,
  normalizeCrawlTarget,
  readBoundedTextResponse,
  selectEvidenceHeaders,
  type BoundedTextSnapshot,
  type CrawlOutcome
} from "./crawlEvidence";
import { fetchSafeOutboundUrl } from "./security";

const RESEARCH_USER_AGENT = "LeadForgeCrawler/1.0 (+https://droxaillc.com)";
const MAX_RESEARCH_PAGE_BYTES = 384 * 1024;
const MAX_RESEARCH_PAGES = 3;
const HIGH_VALUE_PATH = /\b(about|company|contact|leadership|management|our-team|people|staff|team)\b/i;

export interface PublicNamedContact {
  email: string;
  firstName: string;
  lastName: string | null;
  position: string;
  sourceUrl: string;
}

export interface WebsiteResearchPage {
  domain: string;
  requestedUrl: string;
  finalUrl: string | null;
  outcome: CrawlOutcome;
  httpStatus: number | null;
  contentType: string | null;
  robotsAllowed: boolean;
  responseHeaders: Record<string, string>;
  snapshot: BoundedTextSnapshot | null;
  latencyMs: number | null;
  extractedData: {
    publicEmails: string[];
    phones: string[];
    namedContacts: PublicNamedContact[];
  } | null;
  errorCode: string | null;
  errorMessage: string | null;
  fetchedAt: Date | null;
}

export interface PublicWebsiteResearchResult {
  domain: string;
  pages: WebsiteResearchPage[];
  publicEmails: string[];
  phones: string[];
  namedContacts: PublicNamedContact[];
}

function uniqueStrings(values: string[], maxItems: number): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, maxItems);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&#46;|&period;/gi, ".")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function normalizeObservedEmail(value: string): string | null {
  const email = decodeHtmlEntities(value)
    .replace(/^mailto:/i, "")
    .split("?", 1)[0]
    .trim()
    .toLowerCase();
  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      email
    )
  )
    return null;
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email) || /^(example|test)@/.test(email)) return null;
  return email.slice(0, 320);
}

function extractPublicEmails(html: string): string[] {
  const decoded = decodeHtmlEntities(html);
  const candidates = [
    ...(decoded.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []),
    ...[...decoded.matchAll(/href\s*=\s*["'](mailto:[^"']+)["']/gi)].map((match) => match[1])
  ];
  return uniqueStrings(
    candidates.map(normalizeObservedEmail).filter((value): value is string => Boolean(value)),
    30
  );
}

function extractPhones(html: string): string[] {
  return uniqueStrings(
    [...html.matchAll(/href\s*=\s*["']tel:([^"'?]+)[^"']*["']/gi)]
      .map((match) => decodeURIComponent(match[1]).replace(/\s+/g, " ").trim())
      .filter((phone) => /\d{7}/.test(phone.replace(/\D/g, ""))),
    20
  );
}

function jsonLdObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(jsonLdObjects);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return [object, ...Object.values(object).flatMap(jsonLdObjects)];
}

function extractNamedContacts(html: string, sourceUrl: string): PublicNamedContact[] {
  const contacts = new Map<string, PublicNamedContact>();
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const parsed = JSON.parse(match[1].trim());
      for (const object of jsonLdObjects(parsed)) {
        const rawType = object["@type"];
        const types = Array.isArray(rawType) ? rawType.map(String) : [String(rawType || "")];
        if (!types.some((type) => type.toLowerCase() === "person")) continue;
        const fullName = typeof object.name === "string" ? object.name.replace(/\s+/g, " ").trim() : "";
        const position = typeof object.jobTitle === "string" ? object.jobTitle.replace(/\s+/g, " ").trim() : "";
        const email = typeof object.email === "string" ? normalizeObservedEmail(object.email) : null;
        if (!fullName || !position || !email) continue;
        const nameParts = fullName.split(" ").filter(Boolean);
        if (nameParts.length === 0) continue;
        contacts.set(email, {
          email,
          firstName: nameParts[0].slice(0, 100),
          lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ").slice(0, 150) : null,
          position: position.slice(0, 200),
          sourceUrl
        });
      }
    } catch {}
  }
  return [...contacts.values()].slice(0, 20);
}

function discoverResearchUrls(html: string, baseUrl: URL): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi)) {
    try {
      const candidate = new URL(decodeHtmlEntities(match[1]), baseUrl);
      if (
        candidate.protocol !== "https:" ||
        candidate.hostname !== baseUrl.hostname ||
        !HIGH_VALUE_PATH.test(candidate.pathname)
      )
        continue;
      candidate.hash = "";
      candidate.search = "";
      urls.push(candidate.toString());
    } catch {}
  }
  return uniqueStrings(urls, MAX_RESEARCH_PAGES - 1);
}

async function fetchPage(
  domain: string,
  requestedUrl: string,
  robotsPolicies: Map<string, { allowed: boolean; text: string; error: string | null }>
): Promise<WebsiteResearchPage> {
  const startedAt = Date.now();
  const requested = new URL(requestedUrl);
  const initialRobots = robotsPolicies.get(requested.origin) || (await fetchRobots(requested.origin));
  robotsPolicies.set(requested.origin, initialRobots);
  if (
    !initialRobots.allowed ||
    !isPathAllowedByRobots(initialRobots.text, requested.pathname || "/", "LeadForgeCrawler")
  ) {
    return {
      domain,
      requestedUrl,
      finalUrl: null,
      outcome: "blocked",
      httpStatus: null,
      contentType: null,
      robotsAllowed: false,
      responseHeaders: {},
      snapshot: null,
      latencyMs: null,
      extractedData: null,
      errorCode: "robots_disallowed",
      errorMessage: initialRobots.error || "robots.txt disallows this research path.",
      fetchedAt: null
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let release: (() => Promise<void>) | null = null;
  try {
    const fetched = await fetchSafeOutboundUrl(
      requestedUrl,
      {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": RESEARCH_USER_AGENT },
        signal: controller.signal
      },
      5,
      async (redirectUrl) => {
        const policy = robotsPolicies.get(redirectUrl.origin) || (await fetchRobots(redirectUrl.origin));
        robotsPolicies.set(redirectUrl.origin, policy);
        if (!policy.allowed || !isPathAllowedByRobots(policy.text, redirectUrl.pathname || "/", "LeadForgeCrawler")) {
          throw new Error(policy.error || `robots.txt disallows redirected path ${redirectUrl.pathname || "/"}.`);
        }
      }
    );
    release = fetched.release;
    const { response, finalUrl } = fetched;
    const fetchedAt = new Date();
    const contentType = response.headers.get("content-type");
    if (!response.ok || !isSupportedHtmlContentType(contentType)) {
      await response.body?.cancel();
      return {
        domain,
        requestedUrl,
        finalUrl: finalUrl.toString(),
        outcome: classifyHttpOutcome(response.status),
        httpStatus: response.status,
        contentType,
        robotsAllowed: true,
        responseHeaders: selectEvidenceHeaders(response.headers),
        snapshot: null,
        latencyMs: Date.now() - startedAt,
        extractedData: null,
        errorCode: response.ok ? "unsupported_content_type" : `http_${response.status}`,
        errorMessage: response.ok
          ? "Research target did not return HTML."
          : `Research target returned HTTP ${response.status}.`,
        fetchedAt
      };
    }
    const snapshot = await readBoundedTextResponse(response, MAX_RESEARCH_PAGE_BYTES);
    const extractedData = {
      publicEmails: extractPublicEmails(snapshot.text),
      phones: extractPhones(snapshot.text),
      namedContacts: extractNamedContacts(snapshot.text, finalUrl.toString())
    };
    return {
      domain,
      requestedUrl,
      finalUrl: finalUrl.toString(),
      outcome: "found",
      httpStatus: response.status,
      contentType,
      robotsAllowed: true,
      responseHeaders: selectEvidenceHeaders(response.headers),
      snapshot,
      latencyMs: Date.now() - startedAt,
      extractedData,
      errorCode: null,
      errorMessage: null,
      fetchedAt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      domain,
      requestedUrl,
      finalUrl: null,
      outcome: "failed",
      httpStatus: null,
      contentType: null,
      robotsAllowed: true,
      responseHeaders: {},
      snapshot: null,
      latencyMs: Date.now() - startedAt,
      extractedData: null,
      errorCode: error instanceof Error && error.name === "AbortError" ? "fetch_timeout" : "fetch_failed",
      errorMessage: message.slice(0, 1000),
      fetchedAt: null
    };
  } finally {
    clearTimeout(timeout);
    await release?.();
  }
}

async function fetchRobots(origin: string): Promise<{ allowed: boolean; text: string; error: string | null }> {
  let release: (() => Promise<void>) | null = null;
  try {
    const fetched = await fetchSafeOutboundUrl(`${origin}/robots.txt`, {
      headers: { Accept: "text/plain", "User-Agent": RESEARCH_USER_AGENT },
      signal: AbortSignal.timeout(15_000)
    });
    release = fetched.release;
    if (fetched.response.status === 404 || fetched.response.status === 410) {
      await fetched.response.body?.cancel();
      return { allowed: true, text: "", error: null };
    }
    if (!fetched.response.ok) {
      await fetched.response.body?.cancel();
      return { allowed: false, text: "", error: `robots.txt returned HTTP ${fetched.response.status}.` };
    }
    const snapshot = await readBoundedTextResponse(fetched.response, MAX_ROBOTS_BYTES);
    if (snapshot.truncated) return { allowed: false, text: "", error: "robots.txt exceeded the 128 KiB limit." };
    return { allowed: true, text: snapshot.text, error: null };
  } catch (error) {
    return { allowed: false, text: "", error: error instanceof Error ? error.message : String(error) };
  } finally {
    await release?.();
  }
}

export async function researchPublicWebsite(rawDomain: string): Promise<PublicWebsiteResearchResult> {
  const target = normalizeCrawlTarget(rawDomain);
  const origin = new URL(target.requestedUrl).origin;
  const robots = await fetchRobots(origin);
  if (!robots.allowed) {
    return {
      domain: target.domain,
      pages: [
        {
          domain: target.domain,
          requestedUrl: target.requestedUrl,
          finalUrl: null,
          outcome: "blocked",
          httpStatus: null,
          contentType: null,
          robotsAllowed: false,
          responseHeaders: {},
          snapshot: null,
          latencyMs: null,
          extractedData: null,
          errorCode: "robots_unavailable",
          errorMessage: robots.error,
          fetchedAt: null
        }
      ],
      publicEmails: [],
      phones: [],
      namedContacts: []
    };
  }

  const pages: WebsiteResearchPage[] = [];
  const robotsPolicies = new Map([[origin, robots]]);
  const homepage = await fetchPage(target.domain, target.requestedUrl, robotsPolicies);
  pages.push(homepage);
  if (homepage.snapshot && homepage.finalUrl) {
    const baseUrl = new URL(homepage.finalUrl);
    for (const researchUrl of discoverResearchUrls(homepage.snapshot.text, baseUrl)) {
      pages.push(await fetchPage(target.domain, researchUrl, robotsPolicies));
    }
  }

  return {
    domain: target.domain,
    pages,
    publicEmails: uniqueStrings(
      pages.flatMap((page) => page.extractedData?.publicEmails || []),
      30
    ),
    phones: uniqueStrings(
      pages.flatMap((page) => page.extractedData?.phones || []),
      20
    ),
    namedContacts: [
      ...new Map(
        pages.flatMap((page) => page.extractedData?.namedContacts || []).map((contact) => [contact.email, contact])
      ).values()
    ]
  };
}
