/* ============================================================================
   Model call, sanitisation and repair.

   Models wrap JSON in ```json fences, prepend "Here is the evaluation:", and
   occasionally truncate. All three are handled here rather than being allowed to
   surface as a 500 — the deterministic grade is always available, so a bad model
   response degrades the report, it never fails the request.
   ============================================================================ */
import { LlmVerdictSchema, type LlmVerdict } from "./schema";

export class LlmTimeoutError extends Error {}
export class LlmUnavailableError extends Error {}

/** Strip markdown fences and any prose around the JSON object. */
export function sanitizeJson(raw: string): string {
  let s = String(raw ?? "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return s.trim();
}

/** Parse, then validate. Returns null rather than throwing: a malformed model
 *  reply is an expected condition, not an exception. */
export function parseVerdict(raw: string): LlmVerdict | null {
  const cleaned = sanitizeJson(raw);
  if (!cleaned) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    /* One repair attempt: models truncate mid-array more often than anything
       else, so close what is open and try once more. */
    const repaired = cleaned.replace(/,\s*$/, "").replace(/[^\]}]*$/, "") + "]}".slice(0, 0);
    try {
      obj = JSON.parse(repaired);
    } catch {
      return null;
    }
  }
  const parsed = LlmVerdictSchema.safeParse(obj);
  return parsed.success ? parsed.data : null;
}

export interface LlmOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
}

/**
 * Call the provider with a hard timeout. Throws LlmTimeoutError on abort and
 * LlmUnavailableError on a non-2xx, so the caller can map them to HTTP codes.
 */
export async function callModel(
  system: string,
  user: string,
  opts: LlmOptions
): Promise<string> {
  const { apiKey, model = "gpt-4o-mini", timeoutMs = 20000, maxTokens = 900 } = opts;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,               // assessment must be repeatable
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new LlmUnavailableError(`provider ${res.status}`);
    const j: any = await res.json();
    return j?.choices?.[0]?.message?.content ?? "";
  } catch (err: any) {
    if (err?.name === "AbortError") throw new LlmTimeoutError("model timed out");
    if (err instanceof LlmUnavailableError) throw err;
    throw new LlmUnavailableError(String(err?.message ?? err));
  } finally {
    clearTimeout(timer);
  }
}
