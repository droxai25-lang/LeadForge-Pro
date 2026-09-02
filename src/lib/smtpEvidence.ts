import { normalizeSingleLineText } from "./plainText";

const MAX_PROVIDER_MESSAGE_ID_LENGTH = 512;
const MAX_PROVIDER_RESPONSE_LENGTH = 2_048;
const MAX_RECIPIENT_LENGTH = 320;
const MAX_RECIPIENTS = 100;

export interface SmtpAcceptanceEvidence {
  readonly providerMessageId: string | null;
  readonly providerResponse: string | null;
  readonly acceptedRecipients: string[];
  readonly rejectedRecipients: string[];
}

function normalizeScalar(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeSingleLineText(value);
  return normalized ? normalized.slice(0, maximumLength) : null;
}

function normalizeRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const recipients: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.slice(0, MAX_RECIPIENTS)) {
    const normalized = normalizeScalar(candidate, MAX_RECIPIENT_LENGTH);
    if (!normalized) continue;
    const deduplicationKey = normalized.toLowerCase();
    if (seen.has(deduplicationKey)) continue;
    seen.add(deduplicationKey);
    recipients.push(normalized);
  }
  return recipients;
}

/**
 * Converts Nodemailer success or error objects into bounded, log-safe evidence.
 * SMTP responses are remote-controlled text, so control characters, excessive
 * length, duplicate recipients, and non-string values are discarded.
 */
export function normalizeSmtpAcceptanceEvidence(value: unknown): SmtpAcceptanceEvidence {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    providerMessageId: normalizeScalar(candidate.messageId, MAX_PROVIDER_MESSAGE_ID_LENGTH),
    providerResponse: normalizeScalar(candidate.response, MAX_PROVIDER_RESPONSE_LENGTH),
    acceptedRecipients: normalizeRecipients(candidate.accepted),
    rejectedRecipients: normalizeRecipients(candidate.rejected)
  };
}
