import { describe, expect, it } from "vitest";
import {
  analyzeWebsiteOpportunity,
  evaluateProspect,
  normalizeQualificationContract,
  QualificationContractError
} from "../src/lib/opportunityQualification";

const contract = normalizeQualificationContract({
  clientOffer: "website conversion and AI-assisted after-hours intake",
  targetIndustries: ["HVAC"],
  targetGeography: ["Dallas, Texas"],
  targetCompanyCharacteristics: {
    allowUnknownEmployeeCount: true,
    minSourceConfidence: 0.65,
    requirePublicEmail: true,
    requirePublicPhone: true,
    requiredTechnologies: [],
    excludedTechnologies: []
  },
  desiredBuyerRoles: ["owner", "operations manager"],
  qualifyingSignals: [
    { key: "missing_online_scheduling", weight: 30, required: false },
    { key: "missing_after_hours_intake", weight: 25, required: false },
    { key: "missing_live_chat", weight: 20, required: false },
    { key: "missing_financing_cta", weight: 15, required: false },
    { key: "missing_mobile_viewport", weight: 10, required: false }
  ],
  disqualifyingSignalKeys: ["has_online_scheduling"],
  minEvidenceCount: 3,
  minEvidenceQuality: 0.7,
  minOpportunityScore: 60
});

function evaluateAcmeWebsite(html: string, snapshotCharacter: string, snapshotBytes: number, latencyMs: number) {
  const analysis = analyzeWebsiteOpportunity({
    pages: [
      {
        sourceUrl: "https://acme.example/",
        fetchedAt: "2026-08-29T00:00:00.000Z",
        snapshotSha256: snapshotCharacter.repeat(64),
        snapshotBytes,
        snapshotTruncated: false,
        latencyMs,
        responseHeaders: {},
        html
      }
    ],
    publicEmails: ["service@acme.example"],
    phones: ["+12145550100"]
  });
  return evaluateProspect({
    contract,
    analysis,
    candidate: {
      companyName: "Acme HVAC",
      domain: "acme.example",
      industry: "hvac",
      city: "Dallas",
      state: "TX",
      country: "US",
      employeeCount: null,
      sourceConfidence: 0.92,
      publicEmails: ["service@acme.example"],
      phones: ["+12145550100"],
      namedContacts: []
    }
  });
}

describe("opportunity qualification", () => {
  it("normalizes a bounded executable qualification contract", () => {
    expect(contract.schemaVersion).toBe(1);
    expect(contract.qualifyingSignals).toHaveLength(5);
    expect(() =>
      normalizeQualificationContract({ ...contract, qualifyingSignals: [{ key: "made_up", weight: 10 }] })
    ).toThrow(QualificationContractError);
  });

  it("detects factual presence and bounded absence observations", () => {
    const analysis = analyzeWebsiteOpportunity({
      pages: [
        {
          sourceUrl: "https://acme.example/",
          fetchedAt: "2026-08-29T00:00:00.000Z",
          snapshotSha256: "a".repeat(64),
          snapshotBytes: 12_000,
          snapshotTruncated: false,
          latencyMs: 800,
          responseHeaders: { "strict-transport-security": "max-age=31536000" },
          html: '<html><head><meta name="description" content="Heating repair"><meta name="viewport" content="width=device-width"></head><body><a href="tel:+12145550100">Call</a></body></html>'
        }
      ],
      publicEmails: ["service@acme.example"],
      phones: ["+12145550100"]
    });
    expect(analysis.observations.some((signal) => signal.key === "missing_online_scheduling")).toBe(true);
    expect(analysis.observations.some((signal) => signal.key === "has_mobile_viewport")).toBe(true);
    expect(analysis.observations.some((signal) => signal.key === "has_public_email")).toBe(true);
  });

  it("qualifies only from matched weighted evidence and explains the result", () => {
    const evaluation = evaluateAcmeWebsite(
      '<html><head><meta name="viewport" content="width=device-width"></head><body><a href="tel:+12145550100">Call</a></body></html>',
      "b",
      8_000,
      700
    );
    expect(evaluation.status).toBe("qualified");
    expect(evaluation.opportunityScore).toBe(90);
    expect(evaluation.bestContact?.type).toBe("public_email");
    expect(evaluation.outreachAngle).toBeNull();
    expect(evaluation.qualificationReasons).toContain("missing_online_scheduling");
  });

  it("rejects a candidate when a disqualifying condition is directly observed", () => {
    const evaluation = evaluateAcmeWebsite(
      '<html><body><a href="/schedule">Schedule an appointment</a></body></html>',
      "c",
      9_000,
      600
    );
    expect(evaluation.status).toBe("disqualified");
    expect(evaluation.disqualificationReasons.join(" ")).toContain("Online scheduling observed");
  });
});
