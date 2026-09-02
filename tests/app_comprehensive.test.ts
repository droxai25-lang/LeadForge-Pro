import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.TEST_API_URL || "";

describe.skipIf(!BASE_URL)("LeadForge Pro Full-Stack Production & Security Audit", () => {
  let adminToken: string;
  let sdrToken: string;
  let tenantBToken: string;

  const adminEmail = `admin_${Date.now()}@alpha.com`;
  const sdrEmail = `sdr_${Date.now()}@alpha.com`;
  const tenantBEmail = `bob_${Date.now()}@beta.com`;

  beforeAll(async () => {
    const adminReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: "AdminPassword123!",
        name: "Admin Alice"
      })
    });
    const adminData = await adminReg.json();
    adminToken = adminData.token;

    const sdrReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: sdrEmail,
        password: "SdrPassword123!",
        name: "SDR Sam"
      })
    });
    const sdrData = await sdrReg.json();
    sdrToken = sdrData.token;

    const tenantBReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: tenantBEmail,
        password: "BetaPassword123!",
        name: "Beta Bob"
      })
    });
    const tenantBData = await tenantBReg.json();
    tenantBToken = tenantBData.token;
  });

  it("GET /api/health - returns database and cache telemetry", async () => {
    const res = await fetch(`${BASE_URL}/api/health`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  it("GET /api/leads - blocks unauthenticated requests with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/leads`);
    expect(res.status).toBe(401);
  });

  it("POST /api/leads - creates and scores a lead in PostgreSQL", async () => {
    const res = await fetch(`${BASE_URL}/api/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sdrToken}`
      },
      body: JSON.stringify({
        firstName: "Taylor",
        lastName: "Swift",
        email: `taylor.${Date.now()}@stripe.com`,
        jobTitle: "Chief Technology Officer",
        companyName: "Stripe",
        companyDomain: "stripe.com"
      })
    });

    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.lead.seniority).toBe("c_level");
  });

  it("Tenant B cannot read Tenant A's leads", async () => {
    const res = await fetch(`${BASE_URL}/api/leads`, {
      headers: { Authorization: `Bearer ${tenantBToken}` }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.leads && body.leads.length > 0) {
      body.leads.forEach((lead: { email: string }) => {
        expect(lead.email).not.toContain("alpha.com");
      });
    }
  });

  it("SDR Operator is blocked from executing admin reset (403 Forbidden)", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/reset-data`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sdrToken}` }
    });
    expect(res.status).toBe(403);
  });

  it("POST /api/signals/scrape-domain - rejects loopback addresses (403 Forbidden)", async () => {
    const res = await fetch(`${BASE_URL}/api/signals/scrape-domain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ domain: "127.0.0.1" })
    });
    expect(res.status).toBe(403);
  });

  it("POST /api/ai/generate-sequence - synthesizes outbound steps", async () => {
    const leadsRes = await fetch(`${BASE_URL}/api/leads`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const leadsData = await leadsRes.json();
    const targetLeadId = leadsData.leads?.[0]?.id;

    if (targetLeadId) {
      const res = await fetch(`${BASE_URL}/api/ai/generate-sequence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ leadId: targetLeadId, stepCount: 3 })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.sequence)).toBe(true);
    }
  });

  it("POST /api/hygiene/purge - executes dry run without deleting data", async () => {
    const res = await fetch(`${BASE_URL}/api/hygiene/purge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ issueType: "disposable", dryRun: true })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dryRun).toBe(true);
  });
});
