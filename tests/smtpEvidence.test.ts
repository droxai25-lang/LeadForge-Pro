import { describe, expect, it } from "vitest";
import { normalizeSmtpAcceptanceEvidence } from "../src/lib/smtpEvidence";

describe("normalizeSmtpAcceptanceEvidence", () => {
  it("preserves bounded SMTP acceptance details", () => {
    expect(
      normalizeSmtpAcceptanceEvidence({
        messageId: "<dispatch@example.com>",
        response: "250 Accepted [STATUS=success MSGID=abc123]",
        accepted: ["recipient@example.com"],
        rejected: []
      })
    ).toEqual({
      providerMessageId: "<dispatch@example.com>",
      providerResponse: "250 Accepted [STATUS=success MSGID=abc123]",
      acceptedRecipients: ["recipient@example.com"],
      rejectedRecipients: []
    });
  });

  it("sanitizes remote-controlled response text and recipient arrays", () => {
    const evidence = normalizeSmtpAcceptanceEvidence({
      messageId: `  <message@example.com>\r\n`,
      response: `250 accepted\r\n${"x".repeat(3_000)}`,
      accepted: ["Recipient@Example.com", "recipient@example.com", null, { address: "ignored@example.com" }],
      rejected: "not-an-array"
    });

    expect(evidence.providerMessageId).toBe("<message@example.com>");
    expect(evidence.providerResponse).not.toContain("\r");
    expect(evidence.providerResponse).not.toContain("\n");
    expect(evidence.providerResponse).toHaveLength(2_048);
    expect(evidence.acceptedRecipients).toEqual(["Recipient@Example.com"]);
    expect(evidence.rejectedRecipients).toEqual([]);
  });

  it("returns empty evidence for malformed input", () => {
    expect(normalizeSmtpAcceptanceEvidence(null)).toEqual({
      providerMessageId: null,
      providerResponse: null,
      acceptedRecipients: [],
      rejectedRecipients: []
    });
  });
});
