import { describe, expect, it } from "vitest";
import { buildHygieneAudit, type HygieneLeadRecord } from "../src/lib/hygieneAudit";

const lead = (overrides: Partial<HygieneLeadRecord>): HygieneLeadRecord => ({
  id: "lead-1",
  email: "person@example.com",
  companyName: "Example",
  companyDomain: "example.com",
  verificationStatus: "domain_accepts_mail",
  fitScore: 50,
  stage: "discovered",
  updatedAt: "2026-08-27T00:00:00.000Z",
  ...overrides
});

describe("buildHygieneAudit", () => {
  it("keeps the highest-fit duplicate first so explicit purge IDs are safe", () => {
    const report = buildHygieneAudit([
      lead({ id: "low", email: " Same@Example.com ", fitScore: 20 }),
      lead({ id: "high", email: "same@example.com", fitScore: 90 })
    ]);

    expect(report.duplicateGroups[0].leadIds).toEqual(["high", "low"]);
    expect(report.summary.redundantDuplicatesCount).toBe(1);
  });

  it("reports malformed facts and counts each lead once in the health score", () => {
    const report = buildHygieneAudit([
      lead({
        id: "broken",
        email: "not-an-email",
        companyDomain: "http://localhost/admin",
        verificationStatus: "invalid",
        fitScore: 0
      })
    ]);

    expect(report.summary.totalFlaggedIssues).toBe(1);
    expect(report.summary.healthScore).toBe(0);
    expect(report.emailFormatIssues).toHaveLength(1);
    expect(report.domainIssues).toHaveLength(1);
    expect(report.disposableIssues).toHaveLength(1);
    expect(report.staleZeroFitIssues).toHaveLength(1);
  });
});
