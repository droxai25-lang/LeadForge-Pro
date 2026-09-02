import { createHash } from "node:crypto";
import { normalizeQualificationContract, type QualificationContract } from "./opportunityQualification";
import { normalizeSingleLineText } from "./plainText";

export const DELIVERY_FIELD_NAMES = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "jobTitle",
  "seniority",
  "companyName",
  "companyDomain",
  "industry",
  "employeeCount",
  "annualRevenueUsd",
  "verificationStatus",
  "fitScore",
  "linkedinUrl",
  "personalizationPrompt",
  "evidenceIds",
  "evidenceUrls"
] as const;

export type DeliveryFieldName = (typeof DELIVERY_FIELD_NAMES)[number];
export type ClientExclusionKind = "email" | "domain" | "company";

export interface DeliveryLeadRecord {
  readonly id: string;
  readonly [key: string]: unknown;
}

export interface DeliveryPayload {
  readonly payloadText: string;
  readonly payloadSha256: string;
  readonly contentType: "text/csv; charset=utf-8" | "application/json; charset=utf-8";
  readonly fields: DeliveryFieldName[];
}

export class ManagedDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagedDeliveryError";
  }
}

function requirePlainText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new ManagedDeliveryError(`${label} is required.`);
  const normalized = normalizeSingleLineText(value);
  if (!normalized) throw new ManagedDeliveryError(`${label} is required.`);
  if (normalized.length > maxLength)
    throw new ManagedDeliveryError(`${label} must be ${maxLength} characters or fewer.`);
  return normalized;
}

export function normalizeManagedClientName(value: unknown): string {
  return requirePlainText(value, "Client name", 160);
}

export function normalizeRetentionDays(value: unknown): number {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new ManagedDeliveryError("Retention days must be an integer between 1 and 3650.");
  }
  return days;
}

export function normalizeTargetProfile(value: unknown): QualificationContract {
  try {
    return normalizeQualificationContract(value);
  } catch (error) {
    throw new ManagedDeliveryError(error instanceof Error ? error.message : "Invalid qualification contract.");
  }
}

export function normalizeExclusionValue(type: ClientExclusionKind, value: unknown): string {
  const normalized = requirePlainText(value, "Exclusion value", 320).toLowerCase();
  if (type === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ManagedDeliveryError("Email exclusions require a valid email address.");
    }
    return normalized;
  }
  if (type === "domain") {
    const domain = normalized
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
      throw new ManagedDeliveryError("Domain exclusions require a public hostname.");
    }
    return domain;
  }
  return normalized;
}

export function leadMatchesExclusion(
  lead: DeliveryLeadRecord,
  exclusion: { type: ClientExclusionKind; value: string }
): boolean {
  if (exclusion.type === "email")
    return (
      String(lead.email || "")
        .trim()
        .toLowerCase() === exclusion.value
    );
  if (exclusion.type === "company")
    return (
      String(lead.companyName || "")
        .trim()
        .toLowerCase() === exclusion.value
    );
  const domain = String(lead.companyDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  const emailDomain =
    String(lead.email || "")
      .trim()
      .toLowerCase()
      .split("@")[1] || "";
  return domain === exclusion.value || emailDomain === exclusion.value;
}

function normalizeFields(fields: unknown): DeliveryFieldName[] {
  if (!Array.isArray(fields) || fields.length === 0) return [...DELIVERY_FIELD_NAMES];
  const allowed = new Set<string>(DELIVERY_FIELD_NAMES);
  const unique = [...new Set(fields.map((field) => String(field)))];
  if (unique.some((field) => !allowed.has(field))) {
    throw new ManagedDeliveryError("The delivery batch contains an unsupported export field.");
  }
  return unique as DeliveryFieldName[];
}

function normalizeCell(value: unknown): string | number | boolean | null | string[] {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  throw new ManagedDeliveryError("A delivery field contains unsupported structured data.");
}

function csvCell(value: unknown): string {
  const normalized = normalizeCell(value);
  const text = Array.isArray(normalized) ? normalized.join(" | ") : normalized === null ? "" : String(normalized);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildDeliveryPayload(
  format: "csv" | "json",
  leads: DeliveryLeadRecord[],
  requestedFields?: unknown
): DeliveryPayload {
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new ManagedDeliveryError("At least one approved lead is required for a delivery batch.");
  }
  const fields = normalizeFields(requestedFields);
  const records = leads.map((lead) => Object.fromEntries(fields.map((field) => [field, normalizeCell(lead[field])])));
  const payloadText =
    format === "csv"
      ? `${fields.join(",")}\r\n${records
          .map((record) => fields.map((field) => csvCell(record[field])).join(","))
          .join("\r\n")}\r\n`
      : `${JSON.stringify({ recordCount: records.length, leads: records }, null, 2)}\n`;
  return {
    payloadText,
    payloadSha256: createHash("sha256").update(payloadText, "utf8").digest("hex"),
    contentType: format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    fields
  };
}

export function deliveryFileName(clientName: string, batchId: string, format: "csv" | "json"): string {
  const slug =
    normalizeManagedClientName(clientName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "client";
  return `${slug}-leads-${batchId}.${format}`;
}
