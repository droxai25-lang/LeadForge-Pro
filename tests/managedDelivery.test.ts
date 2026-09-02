import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildDeliveryPayload,
  deliveryFileName,
  leadMatchesExclusion,
  ManagedDeliveryError,
  normalizeExclusionValue,
  normalizeRetentionDays,
  normalizeTargetProfile
} from "../src/lib/managedDelivery";

const lead = {
  id: "lead-1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.org",
  companyName: "Example, Inc.",
  companyDomain: "example.org",
  evidenceIds: ["evidence-1"]
};

describe("managed lead delivery", () => {
  it("normalizes client exclusions and rejects unsafe values", () => {
    expect(normalizeExclusionValue("email", " ADA@Example.org ")).toBe("ada@example.org");
    expect(normalizeExclusionValue("domain", "https://www.Example.org/path")).toBe("example.org");
    expect(normalizeExclusionValue("company", " Example, Inc. ")).toBe("example, inc.");
    expect(() => normalizeExclusionValue("email", "not-an-address")).toThrow(ManagedDeliveryError);
    expect(() => normalizeExclusionValue("domain", "localhost")).toThrow(ManagedDeliveryError);
  });

  it("matches email, company, and domain exclusions deterministically", () => {
    expect(leadMatchesExclusion(lead, { type: "email", value: "ada@example.org" })).toBe(true);
    expect(leadMatchesExclusion(lead, { type: "company", value: "example, inc." })).toBe(true);
    expect(leadMatchesExclusion(lead, { type: "domain", value: "example.org" })).toBe(true);
    expect(leadMatchesExclusion(lead, { type: "domain", value: "other.example" })).toBe(false);
  });

  it("produces deterministic RFC-compatible CSV and hashes the exact bytes", () => {
    const result = buildDeliveryPayload("csv", [lead], ["firstName", "email", "companyName", "evidenceIds"]);
    expect(result.payloadText).toBe(
      'firstName,email,companyName,evidenceIds\r\nAda,ada@example.org,"Example, Inc.",evidence-1\r\n'
    );
    expect(result.payloadSha256).toBe(createHash("sha256").update(result.payloadText).digest("hex"));
  });

  it("rejects empty batches, unsupported fields, and unreasonable retention", () => {
    expect(() => buildDeliveryPayload("json", [])).toThrow("At least one approved lead");
    expect(() => buildDeliveryPayload("json", [lead], ["passwordHash"])).toThrow("unsupported export field");
    expect(normalizeRetentionDays(90)).toBe(90);
    expect(() => normalizeRetentionDays(0)).toThrow(ManagedDeliveryError);
    expect(() => normalizeRetentionDays(3651)).toThrow(ManagedDeliveryError);
  });

  it("creates a safe, stable delivery filename", () => {
    expect(deliveryFileName("Acme / North", "batch-123", "json")).toBe("acme-north-leads-batch-123.json");
  });

  it("accepts only executable, structured qualification contracts", () => {
    const profile = {
      clientOffer: "Website conversion and after-hours intake automation",
      targetIndustries: ["HVAC"],
      targetGeography: ["Dallas, Texas, US"],
      targetCompanyCharacteristics: {
        minEmployees: null,
        maxEmployees: null,
        allowUnknownEmployeeCount: true,
        minSourceConfidence: 0.65,
        requirePublicEmail: false,
        requirePublicPhone: false,
        requiredTechnologies: [],
        excludedTechnologies: []
      },
      desiredBuyerRoles: ["Owner", "General Manager"],
      qualifyingSignals: [{ key: "missing_online_scheduling", weight: 100, required: true }],
      disqualifyingSignalKeys: ["has_online_scheduling"],
      minEvidenceCount: 1,
      minEvidenceQuality: 0.7,
      minOpportunityScore: 80,
      notes: "US-based operators"
    };
    expect(normalizeTargetProfile(profile)).toEqual({ schemaVersion: 1, ...profile });
    expect(() => normalizeTargetProfile({})).toThrow(ManagedDeliveryError);
    expect(() => normalizeTargetProfile({ industries: ["Manufacturing"], notes: "Directory-only profile" })).toThrow(
      ManagedDeliveryError
    );
  });
});
