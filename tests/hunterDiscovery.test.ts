import { describe, expect, it, vi } from "vitest";
import {
  getHunterDiscoveryReadiness,
  HunterDiscoveryClient,
  HunterDiscoveryError,
  normalizeHunterDiscoveryInput
} from "../src/lib/hunterDiscovery";

const liveEnv = {
  HUNTER_DISCOVERY_ENABLED: "true",
  HUNTER_API_KEY: "real-hunter-key-with-enough-length",
  HUNTER_MAX_EMAIL_CREDITS_PER_RUN: "25"
} as NodeJS.ProcessEnv;

describe("Hunter discovery configuration", () => {
  it("rejects Hunter's dummy test key", () => {
    const readiness = getHunterDiscoveryReadiness({
      HUNTER_DISCOVERY_ENABLED: "true",
      HUNTER_API_KEY: "test-api-key"
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toContain("dummy data");
  });

  it("normalizes an explicit bounded cost budget", () => {
    const input = normalizeHunterDiscoveryInput(
      {
        query: "HVAC companies in Dallas, Texas",
        companyLimit: 30,
        contactsPerCompany: 4,
        maxDomainSearches: 12,
        departments: ["executive", "sales", "sales"],
        seniorities: ["executive", "senior"],
        decisionMakerOnly: true
      },
      liveEnv
    );
    expect(input.maxDomainSearches).toBe(12);
    expect(input.departments).toEqual(["executive", "sales"]);
    expect(input.seniorities).toEqual(["executive", "senior"]);
  });

  it("refuses a budget over the operator configured ceiling", () => {
    expect(() => normalizeHunterDiscoveryInput({ query: "roofers in Dallas", maxDomainSearches: 26 }, liveEnv)).toThrow(
      "between 0 and 25"
    );
  });
});

describe("HunterDiscoveryClient", () => {
  it("uses the API-key header and normalizes real provider data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "co_1", organization: "Acme HVAC", domain: "acme.example", industry: "HVAC", headcount: 42 }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              emails: [
                {
                  value: "owner@acme.example",
                  first_name: "Avery",
                  last_name: "Smith",
                  position: "Owner",
                  seniority: "executive",
                  department: "executive",
                  decision_maker: true,
                  confidence: 97,
                  verification: { status: "valid" },
                  sources: [{ uri: "https://acme.example/about" }]
                }
              ]
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    const client = new HunterDiscoveryClient(liveEnv, fetchMock as typeof fetch);
    const input = normalizeHunterDiscoveryInput(
      {
        query: "HVAC in Dallas",
        companyLimit: 5,
        maxDomainSearches: 1,
        seniorities: ["executive", "senior"]
      },
      liveEnv
    );
    const companies = await client.discoverCompanies(input);
    const contacts = await client.searchDomainContacts(companies[0].domain, input);

    expect(companies[0]).toMatchObject({ name: "Acme HVAC", domain: "acme.example", employeeCount: 42 });
    expect(contacts[0]).toMatchObject({ email: "owner@acme.example", firstName: "Avery", position: "Owner" });
    expect(fetchMock.mock.calls[0][1].headers["X-API-KEY"]).toBe(liveEnv.HUNTER_API_KEY);
    expect(fetchMock.mock.calls[0][1].body).not.toContain(liveEnv.HUNTER_API_KEY);
    expect(fetchMock.mock.calls[1][0]).not.toContain(liveEnv.HUNTER_API_KEY);
    expect(fetchMock.mock.calls[1][0]).toContain("seniority=executive%2Csenior");
  });

  it("classifies quota failures without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ details: "Quota exhausted" }] }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      })
    );
    const client = new HunterDiscoveryClient(liveEnv, fetchMock as typeof fetch);
    const input = normalizeHunterDiscoveryInput({ query: "roofers in Dallas" }, liveEnv);
    await expect(client.discoverCompanies(input)).rejects.toMatchObject({ code: "rate_limited", httpStatus: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept contacts missing identity or role evidence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { emails: [{ value: "info@example.com", first_name: null, position: null }] }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const client = new HunterDiscoveryClient(liveEnv, fetchMock as typeof fetch);
    const input = normalizeHunterDiscoveryInput({ query: "roofers in Dallas" }, liveEnv);
    await expect(client.searchDomainContacts("example.com", input)).resolves.toEqual([]);
  });

  it("rejects malformed and oversized provider responses", async () => {
    const malformedFetch = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    const malformedClient = new HunterDiscoveryClient(liveEnv, malformedFetch as typeof fetch);
    const input = normalizeHunterDiscoveryInput({ query: "roofers in Dallas" }, liveEnv);
    await expect(malformedClient.discoverCompanies(input)).rejects.toMatchObject({ code: "invalid_response" });

    const oversizedFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Content-Length": String(6 * 1024 * 1024) }
      })
    );
    const oversizedClient = new HunterDiscoveryClient(liveEnv, oversizedFetch as typeof fetch);
    await expect(oversizedClient.discoverCompanies(input)).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("fails closed when no real provider key is configured", () => {
    expect(() => new HunterDiscoveryClient({ HUNTER_DISCOVERY_ENABLED: "true" })).toThrow(HunterDiscoveryError);
  });
});
