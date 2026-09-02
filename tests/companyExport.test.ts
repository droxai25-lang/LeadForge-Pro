import { describe, expect, it } from "vitest";
import { buildCompanyExportCsv, companyExportFileName } from "../src/lib/companyExport";

describe("company export", () => {
  it("exports truthful company-level fields with attribution and a stable hash", () => {
    const input = [
      {
        companyName: "Acme, Inc.",
        domain: "acme.example",
        websiteUrl: "https://acme.example/",
        industry: "hvac_services",
        publicEmail: "service@acme.example",
        phone: "+12145550100",
        streetAddress: "1 Main St",
        city: "Dallas",
        state: "TX",
        country: "US",
        confidence: 0.98,
        datasetRelease: "2026-08-19.0",
        sourceReference: "gers-id",
        sourceUrls: ["https://docs.overturemaps.org/attribution/", "https://www.geonames.org/4684888/"],
        observedAt: "2026-08-29T00:00:00.000Z",
        qualificationStatus: "qualified" as const,
        opportunityScore: 87,
        evidenceQuality: 0.9,
        qualificationReasons: ["Three client-defined opportunity signals were observed."],
        detectedProblems: [
          {
            key: "missing_online_scheduling",
            observation: "No scheduling path was observed across three bounded public pages.",
            opportunity: "Add self-service scheduling.",
            sourceUrl: "https://acme.example/",
            observedAt: "2026-08-29T00:00:00.000Z",
            snapshotSha256: "a".repeat(64)
          }
        ],
        bestContact: { type: "public_email", value: "service@acme.example", sourceUrl: "https://acme.example/" },
        outreachAngle: "Ask whether self-service scheduling is a current priority.",
        evidenceUrls: ["https://acme.example/"],
        evidenceTimestamps: ["2026-08-29T00:00:00.000Z"]
      }
    ];
    const first = buildCompanyExportCsv(input);
    const second = buildCompanyExportCsv(input);
    expect(first).toEqual(second);
    expect(first.recordCount).toBe(1);
    expect(first.payloadText).toContain('"Acme, Inc."');
    expect(first.payloadText).toContain("Overture Places (source-dependent CDLA Permissive 2.0, Apache 2.0, or CC0");
    expect(first.payloadText).toContain("GeoNames (CC BY 4.0)");
    expect(first.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("neutralizes spreadsheet formulas in public data", () => {
    const result = buildCompanyExportCsv([
      {
        companyName: '=HYPERLINK("https://bad.example")',
        domain: "bad.example",
        websiteUrl: "https://bad.example/",
        industry: null,
        publicEmail: null,
        phone: null,
        streetAddress: null,
        city: null,
        state: null,
        country: null,
        confidence: null,
        datasetRelease: null,
        sourceReference: null,
        sourceUrls: [],
        observedAt: "2026-08-29T00:00:00.000Z",
        qualificationStatus: "qualified" as const,
        opportunityScore: 100,
        evidenceQuality: 1,
        qualificationReasons: ["Observable signal matched."],
        detectedProblems: [],
        bestContact: null,
        outreachAngle: "Ask about the observed issue.",
        evidenceUrls: ["https://bad.example/"],
        evidenceTimestamps: ["2026-08-29T00:00:00.000Z"]
      }
    ]);
    expect(result.payloadText).toContain("'=HYPERLINK");
  });

  it("refuses to export directory records that are not qualified prospects", () => {
    expect(() => buildCompanyExportCsv([{ qualificationStatus: "disqualified" } as never])).toThrow("only qualified");
  });

  it("creates a filesystem-safe name", () => {
    expect(companyExportFileName("HVAC in Dallas, TX", "12345678-abcd")).toBe("hvac-in-dallas-tx-12345678.csv");
  });
});
