import { createHash } from "node:crypto";

export interface CompanyExportRecord {
  companyName: string;
  domain: string;
  websiteUrl: string;
  industry: string | null;
  publicEmail: string | null;
  phone: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  confidence: number | null;
  datasetRelease: string | null;
  sourceReference: string | null;
  sourceUrls: string[];
  observedAt: Date | string;
  qualificationStatus: "qualified";
  opportunityScore: number;
  evidenceQuality: number;
  qualificationReasons: string[];
  detectedProblems: Array<{
    key: string;
    observation: string;
    opportunity: string;
    sourceUrl: string;
    observedAt: Date | string;
    snapshotSha256: string | null;
  }>;
  bestContact: {
    type: string;
    value: string;
    name?: string | null;
    jobTitle?: string | null;
    sourceUrl: string;
  } | null;
  outreachAngle: string | null;
  evidenceUrls: string[];
  evidenceTimestamps: Array<Date | string>;
}

export const COMPANY_EXPORT_FIELDS: Array<keyof CompanyExportRecord | "dataAttribution"> = [
  "companyName",
  "domain",
  "websiteUrl",
  "industry",
  "publicEmail",
  "phone",
  "streetAddress",
  "city",
  "state",
  "country",
  "confidence",
  "datasetRelease",
  "sourceReference",
  "sourceUrls",
  "observedAt",
  "qualificationStatus",
  "opportunityScore",
  "evidenceQuality",
  "qualificationReasons",
  "detectedProblems",
  "bestContact",
  "outreachAngle",
  "evidenceUrls",
  "evidenceTimestamps",
  "dataAttribution"
];

function safeSpreadsheetText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: unknown): string {
  const raw =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
        ? value.every((entry) => entry === null || ["string", "number", "boolean"].includes(typeof entry))
          ? value.join(" | ")
          : JSON.stringify(value)
        : value instanceof Date
          ? value.toISOString()
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
  const text = safeSpreadsheetText(raw);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCompanyExportCsv(companies: CompanyExportRecord[]): {
  payloadText: string;
  payloadSha256: string;
  recordCount: number;
} {
  if (!Array.isArray(companies) || companies.length === 0) {
    throw new Error("At least one qualified prospect is required for export.");
  }
  if (companies.some((company) => company.qualificationStatus !== "qualified")) {
    throw new Error("Prospect exports may contain only qualified companies.");
  }
  const attribution =
    "Business data: Overture Places (source-dependent CDLA Permissive 2.0, Apache 2.0, or CC0; see source URLs); market geocoding: GeoNames (CC BY 4.0).";
  const rows = companies.map((company) => {
    const record: Record<string, unknown> = { ...company, dataAttribution: attribution };
    return COMPANY_EXPORT_FIELDS.map((field) => csvCell(record[field])).join(",");
  });
  const payloadText = `${COMPANY_EXPORT_FIELDS.join(",")}\r\n${rows.join("\r\n")}\r\n`;
  return {
    payloadText,
    payloadSha256: createHash("sha256").update(payloadText, "utf8").digest("hex"),
    recordCount: companies.length
  };
}

export function companyExportFileName(query: string, runId: string): string {
  const slug =
    query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "prospects";
  return `${slug}-${runId.slice(0, 8)}.csv`;
}
