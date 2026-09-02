/**
 * security-fixes.test.ts
 *
 * Regression tests for security fixes:
 * 1. Token hash secret enforcement
 * 2. AI response parsing strictness
 * 3. Feature availability gating
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hashOpaqueToken } from "../src/lib/security";
import {
  parseStrictEmailSequence,
  parseStrictCrawlAnalysis,
  parseStrictJson,
  AIResponseParseError
} from "../src/lib/ai-parser";
import {
  checkAIFeatureAvailable,
  checkDiscoveryFeatureAvailable,
  checkEmailVerificationProviderAvailable,
  featureUnavailableMessage
} from "../src/lib/feature-gate";

describe("Security Fixes", () => {
  describe("hashOpaqueToken with secret binding", () => {
    const originalEnv = process.env.TOKEN_HASH_SECRET;

    afterEach(() => {
      process.env.TOKEN_HASH_SECRET = originalEnv;
    });

    it("should produce different hashes for the same token with different secrets", () => {
      const token = "test-opaque-token-abc123";

      process.env.TOKEN_HASH_SECRET = "secret-one-aaaaaaaaaaaaaaaaaaaaaa";
      const hash1 = hashOpaqueToken(token);

      process.env.TOKEN_HASH_SECRET = "secret-two-bbbbbbbbbbbbbbbbbbbbbb";
      const hash2 = hashOpaqueToken(token);

      expect(hash1).not.toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should refuse to start without TOKEN_HASH_SECRET", () => {
      delete process.env.TOKEN_HASH_SECRET;

      expect(() => {
        hashOpaqueToken("test-token");
      }).toThrow(/TOKEN_HASH_SECRET must be set/);
    });

    it("should refuse to start with TOKEN_HASH_SECRET shorter than 32 chars", () => {
      process.env.TOKEN_HASH_SECRET = "too-short";

      expect(() => {
        hashOpaqueToken("test-token");
      }).toThrow(/TOKEN_HASH_SECRET must be set and be at least 32 characters/);
    });
  });

  describe("AI Response Parsing - Email Sequences", () => {
    it("should parse valid email sequence", () => {
      const validInput = {
        emails: [
          {
            to: "john@example.com",
            subject: "Hello John",
            body: "This is a test email.",
            delayMinutes: 60
          },
          {
            to: "jane@example.com",
            subject: "Hello Jane",
            body: "This is another test email."
          }
        ]
      };

      const result = parseStrictEmailSequence(validInput);

      expect(result).toHaveLength(2);
      expect(result[0].to).toBe("john@example.com");
      expect(result[0].delayMinutes).toBe(60);
      expect(result[1].delayMinutes).toBeUndefined();
    });

    it("should reject empty emails array", () => {
      const invalidInput = { emails: [] };

      expect(() => {
        parseStrictEmailSequence(invalidInput);
      }).toThrow(AIResponseParseError);
      expect(() => {
        parseStrictEmailSequence(invalidInput);
      }).toThrow(/must contain at least one item/);
    });

    it("should reject malformed email addresses", () => {
      const invalidInput = {
        emails: [
          {
            to: "not-an-email",
            subject: "Test",
            body: "Test"
          }
        ]
      };

      expect(() => {
        parseStrictEmailSequence(invalidInput);
      }).toThrow(AIResponseParseError);
      expect(() => {
        parseStrictEmailSequence(invalidInput);
      }).toThrow(/must be a valid email address/);
    });

    it("should reject empty subject or body", () => {
      const invalidInput = {
        emails: [
          {
            to: "john@example.com",
            subject: "   ",
            body: "Test"
          }
        ]
      };

      expect(() => {
        parseStrictEmailSequence(invalidInput);
      }).toThrow(AIResponseParseError);
    });

    it("should reject missing required fields", () => {
      const invalidInput = {
        emails: [
          {
            to: "john@example.com"
          }
        ]
      };

      expect(() => {
        parseStrictEmailSequence(invalidInput);
      }).toThrow(AIResponseParseError);
    });
  });

  describe("AI Response Parsing - Crawl Analysis", () => {
    it("should parse valid crawl analysis", () => {
      const validInput = {
        leads: [
          {
            email: "contact@acme.com",
            name: "Alice Smith",
            company: "ACME Corp",
            title: "VP Sales",
            signal: "profile_updated"
          }
        ]
      };

      const result = parseStrictCrawlAnalysis(validInput);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("contact@acme.com");
      expect(result[0].name).toBe("Alice Smith");
    });

    it("should accept optional fields as undefined", () => {
      const validInput = {
        leads: [
          {
            email: "contact@example.com"
          }
        ]
      };

      const result = parseStrictCrawlAnalysis(validInput);

      expect(result[0].name).toBeUndefined();
      expect(result[0].company).toBeUndefined();
    });

    it("should reject empty leads array", () => {
      expect(() => {
        parseStrictCrawlAnalysis({ leads: [] });
      }).toThrow(AIResponseParseError);
    });

    it("should reject invalid email addresses in leads", () => {
      expect(() => {
        parseStrictCrawlAnalysis({
          leads: [{ email: "invalid-email" }]
        });
      }).toThrow(AIResponseParseError);
    });
  });

  describe("Generic JSON Parser", () => {
    it("should parse valid JSON object", () => {
      const result = parseStrictJson('{"key":"value","number":42}');
      expect(result).toEqual({ key: "value", number: 42 });
    });

    it("should reject invalid JSON", () => {
      expect(() => {
        parseStrictJson("{invalid json}");
      }).toThrow(AIResponseParseError);
    });

    it("should reject empty JSON object", () => {
      expect(() => {
        parseStrictJson("{}");
      }).toThrow(AIResponseParseError);
    });

    it("should reject null", () => {
      expect(() => {
        parseStrictJson("null");
      }).toThrow(AIResponseParseError);
    });

    it("should reject arrays at top level", () => {
      expect(() => {
        parseStrictJson('["a", "b"]');
      }).toThrow(AIResponseParseError);
    });
  });

  describe("Feature Availability Gating", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("checkAIFeatureAvailable: returns not_configured when env vars missing", () => {
      delete process.env.LLM_API_ENDPOINT;
      delete process.env.LLM_API_KEY;

      const availability = checkAIFeatureAvailable();

      expect(availability.available).toBe(false);
      expect(availability.reason).toBe("not_configured");
    });

    it("checkAIFeatureAvailable: returns configured when both vars present", () => {
      process.env.LLM_API_ENDPOINT = "https://api.example.com";
      process.env.LLM_API_KEY = "test-key";

      const availability = checkAIFeatureAvailable();

      expect(availability.available).toBe(true);
      expect(availability.reason).toBe("configured");
    });

    it("checkDiscoveryFeatureAvailable: returns disabled when not enabled", () => {
      delete process.env.DISCOVERY_ENABLED;

      const availability = checkDiscoveryFeatureAvailable();

      expect(availability.available).toBe(false);
      expect(availability.reason).toBe("disabled");
    });

    it("checkDiscoveryFeatureAvailable: returns not_configured when REDIS_URL missing", () => {
      process.env.DISCOVERY_ENABLED = "true";
      delete process.env.REDIS_URL;

      const availability = checkDiscoveryFeatureAvailable();

      expect(availability.available).toBe(false);
      expect(availability.reason).toBe("not_configured");
    });

    it("featureUnavailableMessage: returns descriptive message", () => {
      const notConfigured = { available: false, reason: "not_configured" as const, configKey: "TEST_KEY" };
      const message = featureUnavailableMessage("Test Feature", notConfigured);

      expect(message).toContain("not available");
      expect(message).toContain("TEST_KEY");
    });
  });
});
