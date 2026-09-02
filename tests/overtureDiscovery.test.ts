import { describe, expect, it } from "vitest";
import {
  expandMarketKeywords,
  getOvertureDiscoveryReadiness,
  normalizeAutonomousOvertureDiscoveryInput,
  normalizeCompanyWebsite,
  normalizeOvertureDiscoveryInput,
  OvertureDiscoveryError
} from "../src/lib/overtureDiscovery";

describe("Overture discovery boundaries", () => {
  it("normalizes a bounded autonomous search without a niche input", () => {
    expect(
      normalizeAutonomousOvertureDiscoveryInput({
        location: " New York, New York, United States ",
        companyLimit: 25,
        minConfidence: 0.653,
        radiusKm: 50.4,
        rowOffset: 125
      })
    ).toEqual({
      location: "New York, New York, United States",
      companyLimit: 25,
      minConfidence: 0.65,
      radiusKm: 50,
      rowOffset: 125
    });
  });

  it("keeps the internally generated autonomous query bounded", () => {
    expect(() => normalizeAutonomousOvertureDiscoveryInput({ location: "New York", companyLimit: 0 })).toThrow(
      "companyLimit"
    );
    expect(() => normalizeAutonomousOvertureDiscoveryInput({ location: "New York", radiusKm: 101 })).toThrow(
      "radiusKm"
    );
    expect(() => normalizeAutonomousOvertureDiscoveryInput({ location: "New York", rowOffset: 25_001 })).toThrow(
      "rowOffset"
    );
  });

  it("normalizes a bounded niche, location, radius, confidence and limit", () => {
    expect(
      normalizeOvertureDiscoveryInput({
        market: "  HVAC   companies ",
        location: " Dallas, Texas, US ",
        companyLimit: 25,
        minConfidence: 0.657,
        radiusKm: 35.4
      })
    ).toEqual({
      market: "HVAC companies",
      location: "Dallas, Texas, US",
      companyLimit: 25,
      minConfidence: 0.66,
      radiusKm: 35
    });
  });

  it("rejects unbounded or empty discovery input", () => {
    expect(() => normalizeOvertureDiscoveryInput({ market: "x", location: "Dallas", companyLimit: 25 })).toThrow(
      OvertureDiscoveryError
    );
    expect(() => normalizeOvertureDiscoveryInput({ market: "roofers", location: "Dallas", radiusKm: 500 })).toThrow(
      "radiusKm"
    );
    expect(() => normalizeOvertureDiscoveryInput({ market: "roofers", location: "Dallas", companyLimit: 251 })).toThrow(
      "companyLimit"
    );
  });

  it("expands common niche terms without generating company data", () => {
    const keywords = expandMarketKeywords("commercial roofers");
    expect(keywords).toContain("roofer");
    expect(keywords).toContain("roofing_contractor");
  });

  it("retains a real company origin and rejects directory/social URLs", () => {
    expect(normalizeCompanyWebsite(["http://www.acme.example/contact"])).toEqual({
      domain: "acme.example",
      websiteUrl: "https://acme.example/"
    });
    expect(normalizeCompanyWebsite(["https://facebook.com/acme", "https://www.yelp.com/biz/acme"])).toBeNull();
  });

  it("is keyless by default and can be explicitly disabled", () => {
    const previous = process.env.OVERTURE_DISCOVERY_ENABLED;
    delete process.env.OVERTURE_DISCOVERY_ENABLED;
    expect(getOvertureDiscoveryReadiness().ready).toBe(true);
    process.env.OVERTURE_DISCOVERY_ENABLED = "false";
    expect(getOvertureDiscoveryReadiness().ready).toBe(false);
    if (previous === undefined) delete process.env.OVERTURE_DISCOVERY_ENABLED;
    else process.env.OVERTURE_DISCOVERY_ENABLED = previous;
  });
});
