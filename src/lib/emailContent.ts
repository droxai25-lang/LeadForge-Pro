const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 50_000;
const MAX_JSON_UNWRAP_DEPTH = 4;

export class EmailContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailContentError";
  }
}

export interface OutboundEmailContent {
  readonly subject: string;
  readonly body: string;
}

export type EmailTemplateVariables = Readonly<Record<string, string | null | undefined>>;

type EmailPayload = Record<string, unknown>;

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json|text|markdown)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseJsonValue(value: string): unknown | undefined {
  const candidate = stripCodeFence(value);
  if (!candidate || !["{", "[", '"'].includes(candidate[0])) return undefined;

  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

function stringProperty(payload: EmailPayload, names: readonly string[]): string {
  for (const name of names) {
    const value = payload[name];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function extractPayload(value: unknown, depth = 0): { subject: string; body: string } {
  if (depth > MAX_JSON_UNWRAP_DEPTH) {
    throw new EmailContentError("AI email output contains too many nested serialized values.");
  }

  if (typeof value === "string") {
    const parsed = parseJsonValue(value);
    if (parsed !== undefined && parsed !== value) return extractPayload(parsed, depth + 1);
    return { subject: "", body: stripCodeFence(value) };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EmailContentError("Email content must be plain text or a structured email object.");
  }

  const payload = value as EmailPayload;
  const sequence = payload.sequence;
  if (Array.isArray(sequence) && sequence.length > 0) {
    const firstStep = extractPayload(sequence[0], depth + 1);
    const topLevelSubject = stringProperty(payload, ["subject", "title"]);
    return { subject: topLevelSubject || firstStep.subject, body: firstStep.body };
  }

  const subject = stringProperty(payload, ["subject", "emailSubject", "title"]);
  const bodyValue = stringProperty(payload, ["body", "bodyText", "text", "email", "draft", "content", "message"]);

  if (!bodyValue) {
    throw new EmailContentError("Structured AI email output does not contain a body field.");
  }

  const extractedBody = extractPayload(bodyValue, depth + 1);
  return { subject: subject || extractedBody.subject, body: extractedBody.body };
}

function splitSubjectLine(body: string): { subject: string; body: string } {
  const normalized = body.replace(/\r\n?/g, "\n").trim();
  const match = normalized.match(/^subject\s*:\s*([^\n]+)\n+/i);
  if (!match) return { subject: "", body: normalized };

  return {
    subject: match[1].trim(),
    body: normalized.slice(match[0].length).trim()
  };
}

function normalizeSubject(value: string): string {
  const subject = value
    .replace(/^subject\s*:\s*/i, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!subject) throw new EmailContentError("Email subject is required.");
  if (subject.length > MAX_SUBJECT_LENGTH) {
    throw new EmailContentError(`Email subject exceeds ${MAX_SUBJECT_LENGTH} characters.`);
  }
  return subject;
}

function normalizeBody(value: string): string {
  const body = stripCodeFence(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (!body) throw new EmailContentError("Email body is required.");
  if (body.length > MAX_BODY_LENGTH) {
    throw new EmailContentError(`Email body exceeds ${MAX_BODY_LENGTH} characters.`);
  }

  const parsedBody = parseJsonValue(body);
  if (parsedBody !== undefined && typeof parsedBody === "object") {
    throw new EmailContentError("Refusing to send serialized JSON as an email body.");
  }
  if (/^\s*[[{]\s*"(?:subject|body|email|draft|content)"\s*:/i.test(body)) {
    throw new EmailContentError("Refusing to send an object dump as an email body.");
  }

  return body;
}

/**
 * Converts provider output or an edited draft into the only representation that
 * may cross the SMTP boundary: a single-line subject and human-readable text.
 */
export function normalizeOutboundEmail(rawContent: unknown, subjectHint = ""): OutboundEmailContent {
  const extracted = extractPayload(rawContent);
  const subjectLine = splitSubjectLine(extracted.body);
  const subject = normalizeSubject(subjectHint || extracted.subject || subjectLine.subject);
  const body = normalizeBody(subjectLine.body);
  return { subject, body };
}

export function formatEmailDraft(content: OutboundEmailContent): string {
  return `Subject: ${content.subject}\n\n${content.body}`;
}

function stableChoiceIndex(value: string, optionCount: number): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % optionCount;
}

/**
 * Renders campaign tags and deterministic spintax without inventing missing
 * lead attributes. Unresolved tokens are rejected before dispatch.
 */
export function renderPersonalizedTemplate(template: string, variables: EmailTemplateVariables, seed: string): string {
  let rendered = template;

  for (let depth = 0; depth < 5; depth += 1) {
    let replacements = 0;
    rendered = rendered.replace(/\{([^{}]*\|[^{}]*)\}/g, (_match, choices: string, offset: number) => {
      const options = choices.split("|").map((option) => option.trim());
      if (options.some((option) => !option)) {
        throw new EmailContentError("Campaign spintax contains an empty option.");
      }
      replacements += 1;
      return options[stableChoiceIndex(`${seed}:${depth}:${offset}`, options.length)];
    });
    if (replacements === 0) break;
  }

  if (/\{[^{}]*\|[^{}]*\}/.test(rendered)) {
    throw new EmailContentError("Campaign spintax is too deeply nested or malformed.");
  }

  rendered = rendered.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    const value = variables[name]?.trim();
    if (!value) {
      throw new EmailContentError(`Campaign requires a non-empty ${name} value for this lead.`);
    }
    return value;
  });

  if (/\{\{[^{}]+\}\}/.test(rendered)) {
    throw new EmailContentError("Campaign contains an unsupported or malformed personalization tag.");
  }

  return rendered;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Renders plain text safely while optionally replacing visible URLs. */
export function renderPlainTextEmailHtml(body: string, transformUrl?: (url: string) => string): string {
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  let cursor = 0;
  let html = "";

  for (const match of body.matchAll(urlPattern)) {
    const index = match.index ?? 0;
    const visibleUrl = match[0];
    const href = transformUrl ? transformUrl(visibleUrl) : visibleUrl;
    html += escapeHtml(body.slice(cursor, index));
    html += `<a href="${escapeHtml(href)}">${escapeHtml(visibleUrl)}</a>`;
    cursor = index + visibleUrl.length;
  }

  html += escapeHtml(body.slice(cursor));
  return html.replace(/\n/g, "<br/>");
}
