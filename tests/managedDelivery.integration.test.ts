import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.TEST_API_URL || "";
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || "";
const SECOND_TENANT_TOKEN = process.env.TEST_SECOND_TENANT_TOKEN || "";
const LIVE_LEAD_ID = process.env.TEST_LIVE_LEAD_ID || "";
const LIVE_LEAD_EMAIL = (process.env.TEST_LIVE_LEAD_EMAIL || "").toLowerCase();

function headers(token = ADMIN_TOKEN): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe.skipIf(!BASE_URL || !ADMIN_TOKEN || !SECOND_TENANT_TOKEN || !LIVE_LEAD_ID || !LIVE_LEAD_EMAIL)(
  "managed delivery workflow against live PostgreSQL",
  () => {
    const clientName = `Managed delivery integration ${randomUUID().slice(0, 8)}`;
    let clientId = "";
    let batchId = "";
    let batchHash = "";

    afterAll(async () => {
      if (clientId) {
        await fetch(`${BASE_URL}/api/managed-clients/${clientId}`, {
          method: "DELETE",
          headers: headers(),
          body: JSON.stringify({ confirmationName: clientName })
        });
      }
    });

    it("creates a durable client and isolates it from another tenant", async () => {
      const createResponse = await fetch(`${BASE_URL}/api/managed-clients`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name: clientName,
          targetProfile: { industries: ["Integration testing"], notes: "Disposable service-backed fixture" },
          defaultRetentionDays: 7
        })
      });
      expect(createResponse.status).toBe(201);
      clientId = (await createResponse.json()).client.id;

      const otherTenantResponse = await fetch(`${BASE_URL}/api/managed-clients`, {
        headers: headers(SECOND_TENANT_TOKEN)
      });
      expect(otherTenantResponse.status).toBe(200);
      expect((await otherTenantResponse.json()).clients.some((client: { id: string }) => client.id === clientId)).toBe(
        false
      );
    });

    it("requires approval and exports bytes matching the durable SHA-256", async () => {
      const beforeApproval = await fetch(`${BASE_URL}/api/delivery-batches`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientId, leadIds: [LIVE_LEAD_ID], format: "json" })
      });
      expect(beforeApproval.status).toBe(409);

      const reviewResponse = await fetch(`${BASE_URL}/api/managed-clients/${clientId}/reviews`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ leadIds: [LIVE_LEAD_ID], status: "approved" })
      });
      expect(reviewResponse.status).toBe(200);

      const createBatchResponse = await fetch(`${BASE_URL}/api/delivery-batches`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientId, leadIds: [LIVE_LEAD_ID], format: "json" })
      });
      expect(createBatchResponse.status).toBe(201);
      const batch = (await createBatchResponse.json()).batch;
      batchId = batch.id;
      batchHash = batch.payloadSha256;

      const exportResponse = await fetch(`${BASE_URL}/api/delivery-batches/${batchId}/export`, {
        method: "POST",
        headers: headers()
      });
      expect(exportResponse.status).toBe(200);
      const body = await exportResponse.text();
      expect(createHash("sha256").update(body).digest("hex")).toBe(batchHash);
      expect(exportResponse.headers.get("x-content-sha256")).toBe(batchHash);
      expect(body).not.toMatch(/passwordHash|providerResponse|rawSnapshot/);
    });

    it("rechecks client exclusions before preparing a later batch", async () => {
      const domain = LIVE_LEAD_EMAIL.split("@")[1];
      const exclusionResponse = await fetch(`${BASE_URL}/api/managed-clients/${clientId}/exclusions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ type: "domain", value: domain })
      });
      expect(exclusionResponse.status).toBe(201);

      const blockedResponse = await fetch(`${BASE_URL}/api/delivery-batches`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientId, leadIds: [LIVE_LEAD_ID], format: "csv" })
      });
      expect(blockedResponse.status).toBe(409);
      expect((await blockedResponse.json()).excludedLeadIds).toContain(LIVE_LEAD_ID);
    });
  }
);
