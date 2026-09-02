/**
 * ai-parser.ts
 *
 * Strict, fail-closed validator for LLM JSON responses.
 * Prevents malformed AI output from propagating into downstream business logic.
 */

export class AIResponseParseError extends Error {
  constructor(
    readonly reason: string,
    readonly rawInput?: string
  ) {
    super(`AI response validation failed: ${reason}`);
    this.name = "AIResponseParseError";
  }
}

/**
 * Validates that a value exists and is a non-empty string.
 * Used for required text fields (email subjects, body content, etc.).
 */
function validateNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new AIResponseParseError(`${fieldName} must be a string, got ${typeof value}`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AIResponseParseError(`${fieldName} cannot be empty or whitespace-only`);
  }
  return trimmed;
}

/**
 * Validates that a value is a non-empty array of items matching a predicate.
 * Used for email sequences, discovered contacts, etc.
 */
function validateNonEmptyArray<T>(
  value: unknown,
  fieldName: string,
  itemValidator: (item: unknown, index: number) => T
): T[] {
  if (!Array.isArray(value)) {
    throw new AIResponseParseError(`${fieldName} must be an array, got ${typeof value}`);
  }
  if (value.length === 0) {
    throw new AIResponseParseError(`${fieldName} must contain at least one item`);
  }
  return value.map((item, idx) => {
    try {
      return itemValidator(item, idx);
    } catch (cause) {
      throw new AIResponseParseError(
        `${fieldName}[${idx}] failed validation: ${cause instanceof Error ? cause.message : String(cause)}`
      );
    }
  });
}

/**
 * Validates that a value is a valid email address (basic format check).
 */
function validateEmailFormat(value: unknown, fieldName: string): string {
  const email = validateNonEmptyString(value, fieldName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AIResponseParseError(`${fieldName} must be a valid email address, got "${email}"`);
  }
  return email.toLowerCase();
}

/**
 * Validates that a value is a non-empty string (for body text, subject lines, etc.).
 */
function validateText(value: unknown, fieldName: string, maxLength?: number): string {
  const text = validateNonEmptyString(value, fieldName);
  if (maxLength && text.length > maxLength) {
    throw new AIResponseParseError(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }
  return text;
}

/**
 * Validates an email sequence payload (array of outbound emails) from an LLM.
 * Expected shape: { emails: [ { to, subject, body, delayMinutes? }, ... ] }
 */
export function parseStrictEmailSequence(
  rawInput: unknown
): Array<{
  to: string;
  subject: string;
  body: string;
  delayMinutes?: number;
}> {
  if (typeof rawInput !== "object" || rawInput === null) {
    throw new AIResponseParseError("Email sequence must be a JSON object", String(rawInput));
  }

  const input = rawInput as Record<string, unknown>;
  const emails = validateNonEmptyArray(
    input.emails,
    "emails",
    (item: unknown): {
      to: string;
      subject: string;
      body: string;
      delayMinutes?: number;
    } => {
      if (typeof item !== "object" || item === null) {
        throw new AIResponseParseError("Each email item must be an object");
      }
      const email = item as Record<string, unknown>;
      return {
        to: validateEmailFormat(email.to, "to"),
        subject: validateText(email.subject, "subject", 200),
        body: validateText(email.body, "body", 5000),
        delayMinutes:
          typeof email.delayMinutes === "number" && email.delayMinutes >= 0 ? email.delayMinutes : undefined
      };
    }
  );

  return emails;
}

/**
 * Validates a lead discovery/crawl analysis response from an LLM.
 * Expected shape: { leads: [ { email, name?, company?, title?, signal? }, ... ] }
 */
export function parseStrictCrawlAnalysis(
  rawInput: unknown
): Array<{
  email: string;
  name?: string;
  company?: string;
  title?: string;
  signal?: string;
}> {
  if (typeof rawInput !== "object" || rawInput === null) {
    throw new AIResponseParseError("Crawl analysis must be a JSON object", String(rawInput));
  }

  const input = rawInput as Record<string, unknown>;
  const leads = validateNonEmptyArray(
    input.leads,
    "leads",
    (item: unknown): {
      email: string;
      name?: string;
      company?: string;
      title?: string;
      signal?: string;
    } => {
      if (typeof item !== "object" || item === null) {
        throw new AIResponseParseError("Each lead item must be an object");
      }
      const lead = item as Record<string, unknown>;
      return {
        email: validateEmailFormat(lead.email, "email"),
        name: typeof lead.name === "string" && lead.name.trim() ? lead.name.trim() : undefined,
        company: typeof lead.company === "string" && lead.company.trim() ? lead.company.trim() : undefined,
        title: typeof lead.title === "string" && lead.title.trim() ? lead.title.trim() : undefined,
        signal: typeof lead.signal === "string" && lead.signal.trim() ? lead.signal.trim() : undefined
      };
    }
  );

  return leads;
}

/**
 * Validates a generic LLM JSON response by parsing JSON and checking for emptiness.
 * This is a fallback for responses that don't fit a strict schema.
 * Returns parsed object or throws AIResponseParseError.
 */
export function parseStrictJson(rawText: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (cause) {
    throw new AIResponseParseError(
      `Invalid JSON: ${cause instanceof Error ? cause.message : "parse error"}`,
      rawText
    );
  }

  // Reject top-level arrays explicitly — caller expects an object
  if (Array.isArray(parsed)) {
    throw new AIResponseParseError("JSON must be an object (arrays are not accepted)", rawText);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new AIResponseParseError("JSON must be a non-null object", rawText);
  }

  const obj = parsed as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw new AIResponseParseError("JSON object must not be empty", rawText);
  }

  return obj;
}