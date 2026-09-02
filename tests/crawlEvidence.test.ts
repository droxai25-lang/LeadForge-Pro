import { describe, expect, it } from "vitest";
import {
  CrawlInputError,
  classifyHttpOutcome,
  isPathAllowedByRobots,
  isSupportedHtmlContentType,
  normalizeCrawlTarget,
  normalizeWebAnalysis,
  readBoundedTextResponse,
  selectEvidenceHeaders
} from "../src/lib/crawlEvidence";

describe("crawl evidence boundaries", () => {
  it("normalizes a public HTTPS origin and deliberately discards paths", () => {
    expect(normalizeCrawlTarget(" HTTPS://Example.COM/products?ref=test ")).toEqual({
      domain: "example.com",
      requestedUrl: "https://example.com/"
    });
    expect(normalizeCrawlTarget("www.example.com")).toEqual({
      domain: "www.example.com",
      requestedUrl: "https://www.example.com/"
    });
  });

  it("rejects unsafe or ambiguous crawl targets before network access", () => {
    expect(() => normalizeCrawlTarget("http://example.com")).toThrow(CrawlInputError);
    expect(() => normalizeCrawlTarget("https://user:secret@example.com")).toThrow("credentials");
    expect(() => normalizeCrawlTarget("https://example.com:8443")).toThrow("custom port");
    expect(() => normalizeCrawlTarget("localhost")).toThrow("fully qualified");
    expect(() => normalizeCrawlTarget("https://example.com extra")).toThrow(CrawlInputError);
  });

  it("stores and hashes only the configured response prefix", async () => {
    const response = new Response("abcdefghij", { headers: { "content-type": "text/html" } });
    const snapshot = await readBoundedTextResponse(response, 5);
    expect(snapshot.text).toBe("abcde");
    expect(snapshot.bytes).toBe(5);
    expect(snapshot.truncated).toBe(true);
    expect(snapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("distinguishes absent, throttled, blocked, and failed HTTP outcomes", () => {
    expect(classifyHttpOutcome(200)).toBe("found");
    expect(classifyHttpOutcome(404)).toBe("not_found");
    expect(classifyHttpOutcome(410)).toBe("not_found");
    expect(classifyHttpOutcome(429)).toBe("rate_limited");
    expect(classifyHttpOutcome(403)).toBe("blocked");
    expect(classifyHttpOutcome(503)).toBe("failed");
  });

  it("allows only HTML response media types", () => {
    expect(isSupportedHtmlContentType("text/html; charset=utf-8")).toBe(true);
    expect(isSupportedHtmlContentType("application/xhtml+xml")).toBe(true);
    expect(isSupportedHtmlContentType("application/json")).toBe(false);
    expect(isSupportedHtmlContentType(null)).toBe(false);
  });

  it("honors robots groups and the most specific matching rule", () => {
    const robots = `
User-agent: *
Disallow: /

User-agent: LeadForgeCrawler
Disallow: /private
Allow: /private/public
`;
    expect(isPathAllowedByRobots(robots, "/")).toBe(true);
    expect(isPathAllowedByRobots(robots, "/private/report")).toBe(false);
    expect(isPathAllowedByRobots(robots, "/private/public/page")).toBe(true);
    expect(isPathAllowedByRobots("User-agent: *\nDisallow:", "/")).toBe(true);
  });

  it("bounds and sanitizes untrusted model analysis", () => {
    const normalized = normalizeWebAnalysis({
      painPoints: ["  Supported   constraint  ", 123, "x".repeat(800)],
      companySignals: ["Visible positioning"],
      hooks: [
        {
          hookType: "source fact<script>",
          headline: " A visible fact ",
          emailOpeningSnippet: "Normal   human prose."
        },
        { hookType: "ignored", headline: "", emailOpeningSnippet: "missing headline" }
      ]
    });
    expect(normalized.painPoints[0]).toBe("Supported constraint");
    expect(normalized.painPoints[1]).toHaveLength(500);
    expect(normalized.companySignals).toEqual(["Visible positioning"]);
    expect(normalized.hooks).toEqual([
      {
        hookType: "sourcefactscript",
        headline: "A visible fact",
        emailOpeningSnippet: "Normal human prose."
      }
    ]);
  });

  it("persists only an allowlist of response headers", () => {
    const headers = new Headers({
      "content-type": "text/html",
      "set-cookie": "session=secret",
      server: "example-edge"
    });
    expect(selectEvidenceHeaders(headers)).toEqual({
      "content-type": "text/html",
      server: "example-edge"
    });
  });
});
