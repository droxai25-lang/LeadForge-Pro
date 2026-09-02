import { describe, expect, it } from "vitest";
import {
  CampaignExecutionError,
  appendUnsubscribeFooter,
  calculateCampaignSchedule,
  createUnsubscribeToken,
  isExplicitUnsubscribeRequest,
  normalizeRecipientEmail,
  verifyUnsubscribeToken
} from "../src/lib/campaignExecution";

const SECRET = "test-unsubscribe-secret-that-is-long-enough";

describe("campaign execution", () => {
  it("spreads lead cohorts and preserves cumulative step delays", () => {
    const startAt = new Date("2026-08-28T15:00:00.000Z");
    const schedule = calculateCampaignSchedule(
      startAt,
      [
        { id: "one", stepNumber: 1, delayDays: 0 },
        { id: "two", stepNumber: 2, delayDays: 2 },
        { id: "three", stepNumber: 3, delayDays: 3 }
      ],
      10,
      10
    );

    expect(schedule.map((entry) => entry.scheduledFor.toISOString())).toEqual([
      "2026-08-29T15:00:00.000Z",
      "2026-08-31T15:00:00.000Z",
      "2026-09-03T15:00:00.000Z"
    ]);
  });

  it("uses deterministic two-second offsets inside a daily cohort", () => {
    const schedule = calculateCampaignSchedule(
      new Date("2026-08-28T15:00:00.000Z"),
      [{ id: "one", stepNumber: 1, delayDays: 0 }],
      3,
      10
    );
    expect(schedule[0].scheduledFor.toISOString()).toBe("2026-08-28T15:00:06.000Z");
  });

  it("rejects gaps and invalid delays in a step sequence", () => {
    expect(() => calculateCampaignSchedule(new Date(), [{ id: "two", stepNumber: 2, delayDays: -1 }], 0, 10)).toThrow(
      CampaignExecutionError
    );
  });

  it("round-trips a signed unsubscribe token and rejects tampering", () => {
    const expiresAt = new Date("2027-08-28T00:00:00.000Z");
    const token = createUnsubscribeToken("org-1", " Person@Example.com ", SECRET, expiresAt);

    expect(verifyUnsubscribeToken(token, SECRET, new Date("2026-08-28T00:00:00.000Z"))).toEqual({
      organizationId: "org-1",
      email: "person@example.com",
      expiresAt: Math.floor(expiresAt.getTime() / 1_000)
    });
    expect(() => verifyUnsubscribeToken(`${token}x`, SECRET)).toThrow(CampaignExecutionError);
  });

  it("rejects expired tokens and weak signing secrets", () => {
    const token = createUnsubscribeToken("org-1", "person@example.com", SECRET, new Date("2027-01-01T00:00:00.000Z"));
    expect(() => verifyUnsubscribeToken(token, SECRET, new Date("2027-01-01T00:00:00.000Z"))).toThrow(/expired/);
    expect(() => createUnsubscribeToken("org-1", "person@example.com", "short-secret")).toThrow(/32/);
  });

  it("normalizes recipients and appends a visible human-readable unsubscribe footer", () => {
    expect(normalizeRecipientEmail(" Person@Example.com ")).toBe("person@example.com");
    expect(appendUnsubscribeFooter("Hi Pat,\n\nWould Tuesday work?", "https://app.example.com/unsubscribe?t=abc")).toBe(
      "Hi Pat,\n\nWould Tuesday work?\n\n---\nDon't want emails from us? Unsubscribe: https://app.example.com/unsubscribe?t=abc"
    );
  });

  it("detects explicit unsubscribe language without depending on an AI classifier", () => {
    expect(isExplicitUnsubscribeRequest("Please remove me from this list.")).toBe(true);
    expect(isExplicitUnsubscribeRequest("Don't contact me again.")).toBe(true);
    expect(isExplicitUnsubscribeRequest("This is not a fit right now.")).toBe(false);
  });
});
