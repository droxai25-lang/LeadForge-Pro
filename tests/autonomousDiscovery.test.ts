import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/geoNames", () => ({
  loadAutonomousGeoNamesLocations: async () => [
    {
      id: "4684888",
      name: "Dallas",
      country: "US",
      region: "US-TX",
      population: 1_304_379,
      query: "Dallas, US-TX"
    },
    {
      id: "4671654",
      name: "Austin",
      country: "US",
      region: "US-TX",
      population: 961_855,
      query: "Austin, US-TX"
    }
  ]
}));

import {
  autonomousCoverageSize,
  autonomousMissionAt,
  buildDroxAiAutopilotContract,
  DROXAI_SELLER_PROFILE
} from "../src/lib/autonomousDiscovery";
import { normalizeQualificationContract } from "../src/lib/opportunityQualification";

describe("autonomous DroxAI opportunity discovery", () => {
  it("chooses a deterministic bounded mission from only the persisted cursor", async () => {
    const first = await autonomousMissionAt(0, 7);
    const second = await autonomousMissionAt(1, 7);

    expect(first).toMatchObject({
      cursor: 0,
      locationIndex: 0,
      coverageCycle: 0,
      companyLimit: 7,
      rowOffset: 0
    });
    expect(second.location).not.toBe(first.location);
    expect(second.companyLimit).toBe(7);
  });

  it("advances result coverage after one complete geographic rotation", async () => {
    const locationsPerCycle = (await autonomousCoverageSize()) / 20;
    const nextPage = await autonomousMissionAt(locationsPerCycle, 5);

    expect(nextPage.location).toBe((await autonomousMissionAt(0, 5)).location);
    expect(nextPage.coverageCycle).toBe(1);
    expect(nextPage.rowOffset).toBe(25);
  });

  it("uses the built-in DroxAI offer and a valid evidence qualification contract", () => {
    const contract = normalizeQualificationContract(buildDroxAiAutopilotContract());

    expect(contract.clientOffer).toBe(DROXAI_SELLER_PROFILE.offer);
    expect(contract.targetIndustries).toEqual(["All public business categories with an owned website"]);
    expect(contract.targetGeography).toEqual(["Autonomous global discovery frontier"]);
    expect(contract.qualifyingSignals).toEqual([
      { key: "slow_homepage_response", weight: 50, required: false },
      { key: "oversized_homepage", weight: 50, required: false }
    ]);
    expect(contract.minEvidenceCount).toBeGreaterThanOrEqual(1);
    expect(contract.minOpportunityScore).toBeGreaterThan(0);
  });
});
