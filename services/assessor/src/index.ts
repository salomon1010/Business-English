/* ============================================================================
   POST /api/v1/evaluate-simulation

   Request  { candidate_id, session_id, module_id, candidate_transcript,
              target_jurisdiction? }
   Response { evaluation: { ... } }   — see schema.ts

   Status codes
     200  assessed (hybrid, or deterministic if the model was unavailable)
     400  malformed body, unknown module id, empty transcript
     401  missing or wrong API key
     405  wrong method
     429  rate limited
     504  model timed out AND deterministic grading was not possible
     500  unexpected

   Design note: the deterministic grade always runs first, so the model is an
   enhancement rather than a dependency. A provider outage downgrades
   `graded_by` to "deterministic" and still returns a complete 200 report.
   ============================================================================ */
import {
  EvaluateRequestSchema,
  EvaluationReportSchema,
  ASSESSMENT_BASIS,
  type EvaluationReport,
} from "./schema";
import { MODULE_BY_ID } from "./modules";
import { assemblePrompt } from "./prompt";
import { grade, deterministicNarrative } from "./grade";
import { callModel, parseVerdict, LlmTimeoutError, LlmUnavailableError } from "./llm";
import { JURISDICTIONS, type JurisdictionId } from "./jurisdictions";

export interface Env {
  OPENAI_KEY: string;
  /** Shared secret for server-to-server callers. */
  ASSESSOR_API_KEY: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT?: KVNamespace;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function cors(origin: string, env: Env) {
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allow = allowed.includes(origin) ? origin : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Vary": "Origin",
  };
}

const fail = (status: number, error: string, detail: string, hdrs: Record<string, string>) =>
  new Response(JSON.stringify({ error, detail }), { status, headers: { ...JSON_HEADERS, ...hdrs } });

/** Best-effort per-candidate limit. KV when bound; otherwise per-isolate memory,
 *  which is weaker and is documented as such in the README. */
const memory = new Map<string, { n: number; reset: number }>();
async function rateLimited(key: string, env: Env, perMinute = 20): Promise<boolean> {
  const now = Date.now();
  if (env.RATE_LIMIT) {
    const raw = await env.RATE_LIMIT.get(key);
    const rec = raw ? (JSON.parse(raw) as { n: number; reset: number }) : { n: 0, reset: now + 60_000 };
    if (now > rec.reset) { rec.n = 0; rec.reset = now + 60_000; }
    rec.n += 1;
    await env.RATE_LIMIT.put(key, JSON.stringify(rec), { expirationTtl: 120 });
    return rec.n > perMinute;
  }
  const rec = memory.get(key) ?? { n: 0, reset: now + 60_000 };
  if (now > rec.reset) { rec.n = 0; rec.reset = now + 60_000; }
  rec.n += 1;
  memory.set(key, rec);
  if (memory.size > 5000) memory.clear();
  return rec.n > perMinute;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    const hdrs = cors(origin, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: hdrs });
    if (url.pathname === "/health") return new Response(JSON.stringify({ ok: true, modules: MODULE_BY_ID.size }), { headers: { ...JSON_HEADERS, ...hdrs } });
    if (url.pathname !== "/api/v1/evaluate-simulation") return fail(404, "not_found", "Unknown route.", hdrs);
    if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.", hdrs);

    const auth = request.headers.get("authorization") ?? "";
    if (!env.ASSESSOR_API_KEY || auth !== `Bearer ${env.ASSESSOR_API_KEY}`) {
      return fail(401, "unauthorized", "Missing or invalid API key.", hdrs);
    }

    /* ---- validate the request ---- */
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "invalid_json", "Request body is not valid JSON.", hdrs);
    }
    const parsed = EvaluateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
      return fail(400, "invalid_request", issues.join("; "), hdrs);
    }
    const req = parsed.data;

    const mod = MODULE_BY_ID.get(req.module_id);
    if (!mod) return fail(400, "unknown_module", `module_id ${req.module_id} is not defined.`, hdrs);

    if (await rateLimited(`c:${req.candidate_id}`, env)) {
      return fail(429, "rate_limited", "Too many evaluations for this candidate. Try again shortly.", hdrs);
    }

    const jurisdiction = req.target_jurisdiction as JurisdictionId;
    const jur = JURISDICTIONS.get(jurisdiction)!;

    /* ---- grade deterministically first: this is the floor ---- */
    let verdictFromModel = null as Awaited<ReturnType<typeof parseVerdict>>;
    let gradedBy: "deterministic" | "hybrid" = "deterministic";
    let timedOut = false;

    if (env.OPENAI_KEY) {
      try {
        const { system, user } = assemblePrompt(req.module_id, req.candidate_transcript, jurisdiction);
        const raw = await callModel(system, user, { apiKey: env.OPENAI_KEY });
        verdictFromModel = parseVerdict(raw);
        if (verdictFromModel) gradedBy = "hybrid";
      } catch (err) {
        if (err instanceof LlmTimeoutError) timedOut = true;
        else if (!(err instanceof LlmUnavailableError)) {
          return fail(500, "internal_error", "Unexpected failure during evaluation.", hdrs);
        }
      }
    }

    const g = grade(mod, req.candidate_transcript, verdictFromModel);
    const narrative = deterministicNarrative(mod, g, jurisdiction);

    /* The model may enrich the wording and add benchmark coverage; it can never
       change the verdict, the score, or a critical-benchmark failure. */
    const report: EvaluationReport = {
      evaluation: {
        module_id: req.module_id,
        verdict: g.verdict,
        overall_score_percentage: g.score,
        regulatory_compliance_met: g.compliance,
        analysis: {
          what_was_said_correctly: verdictFromModel?.what_was_said_correctly?.length
            ? verdictFromModel.what_was_said_correctly
            : narrative.correct,
          what_is_missing_or_incorrect: verdictFromModel?.what_is_missing_or_incorrect?.length
            ? verdictFromModel.what_is_missing_or_incorrect
            : narrative.missing,
        },
        feedback_to_candidate: verdictFromModel?.feedback_to_candidate || narrative.feedback,
        interviewer_crosscheck_notes:
          (verdictFromModel?.interviewer_crosscheck_notes ? verdictFromModel.interviewer_crosscheck_notes + " " : "") +
          narrative.notes,
        assessment_basis: ASSESSMENT_BASIS,
        graded_by: gradedBy,
        jurisdiction,
        jurisdiction_framework: jur.framework,
        candidate_id: req.candidate_id,
        session_id: req.session_id,
        assessed_at: new Date().toISOString(),
      },
    };

    /* Validate our own output: nothing malformed reaches the pipeline. */
    const out = EvaluationReportSchema.safeParse(report);
    if (!out.success) {
      return fail(500, "report_invalid", "Generated report failed schema validation.", hdrs);
    }

    const status = timedOut && gradedBy === "deterministic" ? 200 : 200;
    return new Response(JSON.stringify(out.data), {
      status,
      headers: { ...JSON_HEADERS, ...hdrs, "x-graded-by": gradedBy, "x-model-timeout": String(timedOut) },
    });
  },
};
