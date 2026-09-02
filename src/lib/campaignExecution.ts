import { createHmac, timingSafeEqual } from "node:crypto";

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed", "archived"] as const;
export const DELIVERY_EVENT_TYPES = ["delivered", "hard_bounce", "soft_bounce", "complaint", "unsubscribe"] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type DeliveryEventType = (typeof DELIVERY_EVENT_TYPES)[number];

export interface CampaignScheduleStep {
  id: string;
  stepNumber: number;
  delayDays: number;
}

export interface ScheduledCampaignStep {
  stepId: string;
  stepNumber: number;
  scheduledFor: Date;
}

interface UnsubscribePayload {
  organizationId: string;
  email: string;
  expiresAt: number;
}

export class CampaignExecutionError extends Error {}

function requireSigningSecret(secret: string): void {
  if (secret.length < 32) {
    throw new CampaignExecutionError("UNSUBSCRIBE_SECRET must contain at least 32 characters.");
  }
}

export function normalizeRecipientEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new CampaignExecutionError("A valid recipient email address is required.");
  }
  return normalized;
}

export function calculateCampaignSchedule(
  startAt: Date,
  steps: CampaignScheduleStep[],
  leadIndex: number,
  dailySendingLimit: number
): ScheduledCampaignStep[] {
  if (!Number.isInteger(leadIndex) || leadIndex < 0) {
    throw new CampaignExecutionError("leadIndex must be a non-negative integer.");
  }
  if (!Number.isInteger(dailySendingLimit) || dailySendingLimit < 1) {
    throw new CampaignExecutionError("dailySendingLimit must be a positive integer.");
  }
  if (Number.isNaN(startAt.getTime())) {
    throw new CampaignExecutionError("startAt must be a valid date.");
  }

  const orderedSteps = [...steps].sort((left, right) => left.stepNumber - right.stepNumber);
  if (orderedSteps.length === 0) {
    throw new CampaignExecutionError("A campaign requires at least one step.");
  }
  orderedSteps.forEach((step, index) => {
    if (
      step.stepNumber !== index + 1 ||
      !Number.isInteger(step.delayDays) ||
      step.delayDays < 0 ||
      (index > 0 && step.delayDays < 1)
    ) {
      throw new CampaignExecutionError(
        "Campaign steps must be sequential; follow-ups require a positive whole-day delay."
      );
    }
  });

  const cohortOffsetDays = Math.floor(leadIndex / dailySendingLimit);
  const withinCohortOffsetMs = (leadIndex % dailySendingLimit) * 2_000;
  let cumulativeDelayDays = cohortOffsetDays;

  return orderedSteps.map((step) => {
    cumulativeDelayDays += step.delayDays;
    return {
      stepId: step.id,
      stepNumber: step.stepNumber,
      scheduledFor: new Date(startAt.getTime() + cumulativeDelayDays * 24 * 60 * 60 * 1_000 + withinCohortOffsetMs)
    };
  });
}

export function createUnsubscribeToken(
  organizationId: string,
  email: string,
  secret: string,
  expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000)
): string {
  requireSigningSecret(secret);
  if (!organizationId.trim()) {
    throw new CampaignExecutionError("organizationId is required for an unsubscribe token.");
  }
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new CampaignExecutionError("Unsubscribe token expiration must be in the future.");
  }

  const payload: UnsubscribePayload = {
    organizationId: organizationId.trim(),
    email: normalizeRecipientEmail(email),
    expiresAt: Math.floor(expiresAt.getTime() / 1_000)
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyUnsubscribeToken(token: string, secret: string, now = new Date()): UnsubscribePayload {
  requireSigningSecret(secret);
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) {
    throw new CampaignExecutionError("The unsubscribe link is invalid.");
  }

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest();
  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    throw new CampaignExecutionError("The unsubscribe link is invalid.");
  }
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
    throw new CampaignExecutionError("The unsubscribe link is invalid.");
  }

  let payload: UnsubscribePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as UnsubscribePayload;
  } catch {
    throw new CampaignExecutionError("The unsubscribe link is invalid.");
  }
  if (
    !payload ||
    typeof payload.organizationId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt * 1_000 <= now.getTime()
  ) {
    throw new CampaignExecutionError("The unsubscribe link is invalid or expired.");
  }

  return {
    organizationId: payload.organizationId,
    email: normalizeRecipientEmail(payload.email),
    expiresAt: payload.expiresAt
  };
}

export function appendUnsubscribeFooter(body: string, unsubscribeUrl: string): string {
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new CampaignExecutionError("Email body cannot be empty.");
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(unsubscribeUrl);
  } catch {
    throw new CampaignExecutionError("A valid unsubscribe URL is required.");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new CampaignExecutionError("The unsubscribe URL must use HTTP or HTTPS.");
  }
  return `${trimmedBody}\n\n---\nDon't want emails from us? Unsubscribe: ${parsedUrl.toString()}`;
}

export function isDeliveryEventType(value: unknown): value is DeliveryEventType {
  return typeof value === "string" && DELIVERY_EVENT_TYPES.includes(value as DeliveryEventType);
}

export function isExplicitUnsubscribeRequest(message: string): boolean {
  return /\b(unsubscribe|remove me|stop (?:emailing|contacting) me|do not (?:email|contact) me|don['’]t (?:email|contact) me)\b/i.test(
    message
  );
}
