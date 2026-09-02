import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.TEST_API_URL || "";
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || "";
const SECOND_TENANT_TOKEN = process.env.TEST_SECOND_TENANT_TOKEN || "";
const LIVE_MAILBOX_ID = process.env.TEST_LIVE_MAILBOX_ID || "";
const LIVE_LEAD_ID = process.env.TEST_LIVE_LEAD_ID || "";
const LIVE_LEAD_EMAIL = (process.env.TEST_LIVE_LEAD_EMAIL || "").toLowerCase();
const DELIVERY_SECRET = process.env.DELIVERY_WEBHOOK_SECRET || "";

function authHeaders(token = ADMIN_TOKEN): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe.skipIf(!BASE_URL || !ADMIN_TOKEN || !SECOND_TENANT_TOKEN)(
  "Phase 1 durable campaign API against live PostgreSQL",
  () => {
    let campaignId = "";
    let suppressionId = "";
    const unique = randomUUID().slice(0, 8);

    beforeAll(async () => {
      const response = await fetch(`${BASE_URL}/api/campaigns`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: `Phase 1 integration ${unique}`,
          description: "Durability and tenant isolation gate",
          dailySendingLimit: 7,
          steps: [
            {
              stepNumber: 1,
              delayDays: 0,
              subject: `Integration ${unique} for {{companyName}}`,
              body: "Hi {{firstName}},\n\nWould a short overview be useful?\n\nBest,\nDustin Hill"
            },
            {
              stepNumber: 2,
              delayDays: 3,
              subject: `Following up ${unique}`,
              body: "Hi {{firstName}},\n\nI wanted to follow up. If this is not relevant, no problem.\n\nBest,\nDustin Hill"
            }
          ]
        })
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      campaignId = data.campaign.id;
    });

    afterAll(async () => {
      if (suppressionId) {
        await fetch(`${BASE_URL}/api/suppressions/${suppressionId}`, {
          method: "DELETE",
          headers: authHeaders()
        });
      }
      if (campaignId) {
        await fetch(`${BASE_URL}/api/campaigns/${campaignId}`, {
          method: "DELETE",
          headers: authHeaders()
        });
      }
    });

    it("persists campaign steps and supports a fresh authenticated read", async () => {
      const response = await fetch(`${BASE_URL}/api/campaigns`, { headers: authHeaders() });
      expect(response.status).toBe(200);
      const data = await response.json();
      const campaign = data.campaigns.find((candidate: { id: string }) => candidate.id === campaignId);
      expect(campaign).toMatchObject({ status: "draft", dailySendingLimit: 7 });
      expect(campaign.steps).toHaveLength(2);
      expect(campaign.steps[1]).toMatchObject({ stepNumber: 2, delayDays: 3 });
    });

    it("does not expose another tenant's campaign", async () => {
      const response = await fetch(`${BASE_URL}/api/campaigns`, {
        headers: authHeaders(SECOND_TENANT_TOKEN)
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.campaigns.some((candidate: { id: string }) => candidate.id === campaignId)).toBe(false);
    });

    it("persists and removes only an operator-created manual suppression", async () => {
      const email = `phase1-${unique}@example.com`;
      const createResponse = await fetch(`${BASE_URL}/api/suppressions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email })
      });
      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      suppressionId = created.suppression.id;

      const listResponse = await fetch(`${BASE_URL}/api/suppressions`, { headers: authHeaders() });
      const list = await listResponse.json();
      expect(list.suppressions).toContainEqual(expect.objectContaining({ email, reason: "manual" }));

      const deleteResponse = await fetch(`${BASE_URL}/api/suppressions/${suppressionId}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      expect(deleteResponse.status).toBe(204);
      suppressionId = "";
    });
  }
);

describe.skipIf(
  !BASE_URL ||
    !ADMIN_TOKEN ||
    !LIVE_MAILBOX_ID ||
    !LIVE_LEAD_ID ||
    !LIVE_LEAD_EMAIL ||
    DELIVERY_SECRET.length < 32 ||
    process.env.TEST_PHASE1_LIVE !== "true"
)("Phase 1 queue and provider reconciliation against live services", () => {
  it("creates durable snapshots, reconciles one provider event, and suppresses future sends", async () => {
    const unique = randomUUID().slice(0, 8);
    const campaignResponse = await fetch(`${BASE_URL}/api/campaigns`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: `Provider integration ${unique}`,
        dailySendingLimit: 1,
        trackClicks: false,
        steps: [
          {
            stepNumber: 1,
            delayDays: 0,
            subject: `Provider event ${unique}`,
            body: "Hi {{firstName}},\n\nWould a short overview be useful?\n\nBest,\nDustin Hill"
          }
        ]
      })
    });
    expect(campaignResponse.status).toBe(201);
    const campaign = (await campaignResponse.json()).campaign;

    const launchResponse = await fetch(`${BASE_URL}/api/campaigns/${campaign.id}/launch`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        mailboxId: LIVE_MAILBOX_ID,
        leadIds: [LIVE_LEAD_ID],
        startAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString()
      })
    });
    expect(launchResponse.status).toBe(202);

    const telemetryResponse = await fetch(`${BASE_URL}/api/mailboxes/telemetry`, { headers: authHeaders() });
    const telemetry = await telemetryResponse.json();
    const dispatch = telemetry.recentDispatches.find(
      (candidate: { subject: string }) => candidate.subject === `Provider event ${unique}`
    );
    expect(dispatch).toMatchObject({ status: "scheduled", recipientEmail: LIVE_LEAD_EMAIL });
    expect(dispatch.bodyText).toContain("Don't want emails from us? Unsubscribe:");
    expect(() => JSON.parse(dispatch.bodyText)).toThrow();

    const eventId = randomUUID();
    const eventPayload = JSON.stringify({
      eventId,
      eventType: "hard_bounce",
      dispatchId: dispatch.id,
      recipientEmail: LIVE_LEAD_EMAIL,
      reason: "550 mailbox unavailable"
    });
    const timestamp = Math.floor(Date.now() / 1_000).toString();
    const signature = createHmac("sha256", DELIVERY_SECRET).update(`${timestamp}.${eventPayload}`).digest("hex");
    const sendEvent = () =>
      fetch(`${BASE_URL}/api/webhooks/delivery/integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-id": eventId,
          "x-webhook-timestamp": timestamp,
          "x-webhook-signature": signature
        },
        body: eventPayload
      });

    const firstEventResponse = await sendEvent();
    expect(firstEventResponse.status).toBe(200);
    expect(await firstEventResponse.json()).toMatchObject({ success: true, duplicate: false });
    const duplicateEventResponse = await sendEvent();
    expect(duplicateEventResponse.status).toBe(200);
    expect(await duplicateEventResponse.json()).toMatchObject({ success: true, duplicate: true });

    const suppressionResponse = await fetch(`${BASE_URL}/api/suppressions`, { headers: authHeaders() });
    const suppressionData = await suppressionResponse.json();
    expect(suppressionData.suppressions).toContainEqual(
      expect.objectContaining({ email: LIVE_LEAD_EMAIL, reason: "hard_bounce" })
    );
  });
});
