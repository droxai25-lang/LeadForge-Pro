import { describe, expect, it } from "vitest";
import { buildCompanyExportCsv, type CompanyExportRecord } from "../src/lib/companyExport";
import {
  analyzeWebsiteOpportunity,
  evaluateProspect,
  normalizeQualificationContract,
  type ProspectCandidate,
  type QualificationResearchPage
} from "../src/lib/opportunityQualification";

const observedAt = "2026-08-29T12:00:00.000Z";

function page(domain: string, path: string, html: string): QualificationResearchPage {
  return {
    sourceUrl: `https://${domain}${path}`,
    fetchedAt: observedAt,
    snapshotSha256: `${domain}:${path}:${html}`.padEnd(64, "0").slice(0, 64),
    snapshotBytes: Buffer.byteLength(html),
    snapshotTruncated: false,
    latencyMs: 120,
    responseHeaders: { "strict-transport-security": "max-age=31536000" },
    html
  };
}

function candidate(companyName: string, domain: string): ProspectCandidate {
  return {
    companyName,
    domain,
    industry: "HVAC",
    city: "Dallas",
    state: "TX",
    country: "US",
    employeeCount: null,
    sourceConfidence: 0.92,
    publicEmails: [`service@${domain}`],
    phones: ["+12145550100"],
    namedContacts: []
  };
}

describe("opportunity discovery end-to-end acceptance", () => {
  it("turns niche, location, offer, and criteria into a deterministic qualified-only batch", () => {
    const operatorInput = {
      niche: "HVAC",
      location: "Dallas, TX, US",
      clientOffer: "Website conversion and AI-assisted after-hours intake",
      qualificationCriteria: {
        qualifyingSignals: [
          { key: "missing_online_scheduling", weight: 40, required: true },
          { key: "missing_after_hours_intake", weight: 30, required: false },
          { key: "missing_live_chat", weight: 30, required: false }
        ],
        disqualifyingSignalKeys: ["has_online_scheduling"],
        minEvidenceCount: 2,
        minEvidenceQuality: 0.8,
        minOpportunityScore: 60
      }
    };
    const contract = normalizeQualificationContract({
      clientOffer: operatorInput.clientOffer,
      targetIndustries: [operatorInput.niche],
      targetGeography: [operatorInput.location],
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
      ...operatorInput.qualificationCriteria,
      notes: null
    });

    const research = [
      {
        candidate: candidate("Acme HVAC", "acme-hvac.example"),
        pages: [
          page(
            "acme-hvac.example",
            "/",
            "<html><head><meta name='viewport' content='width=device-width'></head><body><a href='mailto:service@acme-hvac.example'>Email us</a></body></html>"
          ),
          page("acme-hvac.example", "/contact", "<html><body><a href='tel:+12145550100'>Call us</a></body></html>")
        ]
      },
      {
        candidate: candidate("Beta HVAC", "beta-hvac.example"),
        pages: [
          page(
            "beta-hvac.example",
            "/",
            "<html><body><a href='/schedule'>Schedule an appointment</a><script src='https://widget.intercom.io/widget/id'></script></body></html>"
          ),
          page("beta-hvac.example", "/schedule", "<html><body><form><input name='appointment'></form></body></html>")
        ]
      }
    ];

    const evaluated = research.map((record) => {
      const analysis = analyzeWebsiteOpportunity({
        pages: record.pages,
        publicEmails: record.candidate.publicEmails,
        phones: record.candidate.phones
      });
      return { ...record, analysis, evaluation: evaluateProspect({ contract, candidate: record.candidate, analysis }) };
    });
    const qualified = evaluated.filter((record) => record.evaluation.status === "qualified");
    expect(qualified.map((record) => record.candidate.companyName)).toEqual(["Acme HVAC"]);
    expect(
      evaluated.find((record) => record.candidate.companyName === "Beta HVAC")?.evaluation.disqualificationReasons
    ).toContain("Disqualifying condition observed: Online scheduling observed.");

    const records: CompanyExportRecord[] = qualified.map((record) => {
      return {
        companyName: record.candidate.companyName,
        domain: record.candidate.domain,
        websiteUrl: `https://${record.candidate.domain}/`,
        industry: record.candidate.industry,
        publicEmail: record.candidate.publicEmails[0],
        phone: record.candidate.phones[0],
        streetAddress: null,
        city: record.candidate.city,
        state: record.candidate.state,
        country: record.candidate.country,
        confidence: record.candidate.sourceConfidence,
        datasetRelease: "acceptance-fixture",
        sourceReference: "public-candidate-source",
        sourceUrls: ["https://docs.overturemaps.org/attribution/"],
        observedAt,
        qualificationStatus: "qualified",
        opportunityScore: record.evaluation.opportunityScore,
        evidenceQuality: record.evaluation.evidenceQuality,
        qualificationReasons: record.evaluation.qualificationReasons,
        detectedProblems: record.evaluation.matchedSignals.map((signal) => ({
          key: signal.key,
          observation: signal.observation,
          opportunity: signal.opportunity,
          sourceUrl: signal.sourceUrl,
          observedAt: signal.observedAt,
          snapshotSha256: signal.snapshotSha256
        })),
        bestContact: record.evaluation.bestContact,
        outreachAngle: record.evaluation.outreachAngle,
        evidenceUrls: record.evaluation.matchedSignals.map((signal) => signal.sourceUrl),
        evidenceTimestamps: record.evaluation.matchedSignals.map((signal) => signal.observedAt)
      };
    });
    const firstExport = buildCompanyExportCsv(records);
    const secondExport = buildCompanyExportCsv(records);
    expect(firstExport).toEqual(secondExport);
    expect(firstExport.recordCount).toBe(1);
    expect(firstExport.payloadText).toContain("Acme HVAC");
    expect(firstExport.payloadText).not.toContain("Beta HVAC");
    expect(firstExport.payloadText).toContain("missing_online_scheduling");
    expect(firstExport.payloadText).toContain("https://acme-hvac.example/");
    expect(firstExport.payloadText).toContain(observedAt);
  });
});
