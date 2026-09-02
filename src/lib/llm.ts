/**
 * llm.ts
 *
 * Ollama client used for all server-side AI features. It supports a local
 * Ollama daemon without credentials and remote HTTPS providers with a bearer
 * API key through the OpenAI-compatible chat completions endpoint.
 *
 * Configuration (environment):
 * - OLLAMA_BASE_URL  Required to enable AI features. Use
 *                    http://127.0.0.1:11434 for a local daemon.
 * - OLLAMA_API_KEY   Optional for loopback; required for remote providers.
 * - OLLAMA_MODEL     Defaults to llama3.2 and should name an installed model.
 *
 * Network/model failures reject explicitly. Callers never substitute a fake
 * AI result.
 */

const DEFAULT_MODEL = "llama3.2";
// Hard 15-second deadline on any LLM provider call so a slow model cannot hang
// the request path; failures propagate to the caller (no silent static fallback).
const REQUEST_TIMEOUT_MS = 15_000;

/** True when an Ollama endpoint is explicitly configured. */
export function isLlmEnabled(): boolean {
  return Boolean((process.env.OLLAMA_BASE_URL || "").trim());
}

function getLlmEndpoint(): URL {
  const configured = (process.env.OLLAMA_BASE_URL || "").trim();
  if (!configured) throw new Error("OLLAMA_BASE_URL is not configured");

  const baseUrl = new URL(configured);
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(baseUrl.hostname.toLowerCase());
  if (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && isLoopback)) {
    throw new Error("Remote Ollama endpoints must use HTTPS; plain HTTP is allowed only on loopback.");
  }

  const normalizedPath = baseUrl.pathname.replace(/\/+$/, "");
  baseUrl.pathname = normalizedPath.endsWith("/v1")
    ? `${normalizedPath}/chat/completions`
    : `${normalizedPath}/v1/chat/completions`;
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl;
}

function getLlmModel(): string {
  return (process.env.OLLAMA_MODEL || DEFAULT_MODEL).trim();
}

/**
 * Strips markdown code fences and surrounding prose so strict-JSON prompts
 * remain parseable regardless of how the model formats its answer.
 */
export function extractJsonPayload(rawText: string): string {
  const trimmed = (rawText || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }
  return candidate;
}

export interface LlmJsonResult {
  /** Cleaned model output — best-effort JSON payload string. */
  readonly text: string;
  readonly model: string;
}

/**
 * Sends a strict-JSON prompt to Ollama and resolves with the cleaned
 * payload. Rejects on HTTP/network failure so callers can report the provider
 * failure without substituting synthetic AI output.
 */
export async function llmGenerateJson(prompt: string): Promise<LlmJsonResult> {
  const apiKey = (process.env.OLLAMA_API_KEY || "").trim();
  const endpoint = getLlmEndpoint();
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(endpoint.hostname.toLowerCase());
  if (!apiKey && !isLoopback) {
    throw new Error("OLLAMA_API_KEY is required for a remote Ollama endpoint");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: getLlmModel(),
        messages: [
          {
            role: "system",
            content: "You are a precise assistant. Always respond with strictly valid JSON and nothing else."
          },
          { role: "user", content: prompt }
        ],
        stream: false,
        temperature: 0.2
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Ollama request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || "";
    if (!content.trim()) {
      throw new Error("Ollama returned an empty completion");
    }

    return { text: extractJsonPayload(content), model: getLlmModel() };
  } finally {
    clearTimeout(timer);
  }
}
