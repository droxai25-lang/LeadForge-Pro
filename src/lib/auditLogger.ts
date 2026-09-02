/**
 * auditLogger.ts
 *
 * Structured JSONL audit/telemetry logger with trace identifiers. Never writes
 * to stdout; streams JSON records to a configured log file (default:
 * ./logs/leadforge-audit.jsonl) with asynchronous, ordered appends.
 *
 * Every record includes: timestamp, level, trace_id, event and sanitized
 * metadata. PII/secret-bearing keys (passwords, tokens, authorization headers,
 * raw SMTP responses) are redacted by default.
 */

import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error" | "audit";

interface AuditEventRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly traceId: string;
  readonly event?: string;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

const LOG_FILE_PATH: string = process.env.LOG_FILE ?? join(process.cwd(), "logs", "leadforge-audit.jsonl");

const REDACTED_VALUE = "[REDACTED]";
const REDACTABLE_KEYS = new Set([
  "password",
  "passwordhash",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "x-auth-token",
  "x-webhook-signature",
  "rawresponse",
  "smtppassword"
]);

function sanitizeMetadataValue(key: string, value: unknown): unknown {
  if (REDACTABLE_KEYS.has(key.toLowerCase())) {
    return REDACTED_VALUE;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(record: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    sanitized[key] = sanitizeMetadataValue(key, value);
  }
  return sanitized;
}

class StructuredLogger {
  private readonly outputStream: ReturnType<typeof createWriteStream>;
  private pendingWrites = 0;

  constructor() {
    mkdirSync(dirname(LOG_FILE_PATH), { recursive: true });
    this.outputStream = createWriteStream(LOG_FILE_PATH, { flags: "a" });
    this.outputStream.on("error", () => {
      // Logger failures must never crash the request path.
    });
  }

  /** Creates a cryptographically random trace identifier (16 bytes encoded). */
  createTraceId(): string {
    return randomBytes(16).toString("hex");
  }

  private append(record: AuditEventRecord): void {
    try {
      const serialized = `${JSON.stringify(record)}\n`;
      this.outputStream.write(serialized);
      this.pendingWrites += 1;
      if (this.pendingWrites > 8192) {
        this.outputStream.write("");
        this.pendingWrites = 0;
      }
    } catch {
      // Serialization failures are non-fatal.
    }
  }

  write(level: LogLevel, message: string, fields?: Partial<AuditEventRecord>): void {
    this.append({
      timestamp: new Date().toISOString(),
      level,
      traceId: fields?.traceId ?? this.createTraceId(),
      event: fields?.event,
      message,
      metadata: fields?.metadata ? sanitizeObject(fields.metadata as Record<string, unknown>) : undefined
    });
  }

  debug(message: string, fields?: Partial<AuditEventRecord>): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: Partial<AuditEventRecord>): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: Partial<AuditEventRecord>): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: Partial<AuditEventRecord>): void {
    this.write("error", message, fields);
  }

  audit(event: string, message: string, metadata: Readonly<Record<string, unknown>>, traceId?: string): void {
    this.write("audit", message, {
      event,
      traceId,
      metadata: sanitizeObject(metadata as Record<string, unknown>)
    });
  }
}

export const auditLogger = new StructuredLogger();
