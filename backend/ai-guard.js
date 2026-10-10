/* BE Mastery — AI cost control (10 Oct 2026). docs/AI-COST-CONTROL.md
   ----------------------------------------------------------------------------
   One module, used by the repo's be-polish (polish-worker.js) AND by the
   production wrapper (polish-prod/entry.js), so the two can never disagree
   about what a request costs or who may make it.

   WHAT IT DOES
   1. ANONYMOUS POLICY — ANON_AI_POLICY = "off" (default) | "report" | "enforce".
      A caller with no VERIFIED Firebase token is a visitor. A visitor's billable
      request is held by (a) a small per-IP daily allowance per kind of work and
      (b) one GLOBAL anonymous pool counted in estimated money, so a thousand
      fresh addresses cost what one does. "report" counts and records what would
      have been refused but refuses nothing; "enforce" refuses with
      429 {error:"allowance", scope:"anon"}. A forged "Bearer x" header is NOT an
      account: the token is verified, and one that fails counts as a visitor.
   2. REFUNDS — quota (verdicts, video seconds, the anonymous allowances) is
      given back when the request ends in an error (status >= 400): a request
      refused by validation, a provider failure, a timeout. Rate-limit WINDOWS
      are not refunded — they are abuse ceilings, not a learner's allowance.
   3. ONE IDENTICAL REQUEST IN FLIGHT — a second identical metered request from
      the same caller while the first is still running gets 409
      duplicate_in_flight, so a double tap cannot spend two verdicts or pay the
      provider twice.
   4. PROVIDER CALLS — pfetch(): a timeout on every provider fetch, and the
      provider's own usage (tokens, audio seconds) read from the response.
   5. THE LEDGER — one row per billable request to Analytics Engine
      (binding AI_LEDGER), with units, an ESTIMATED cost and how it was
      estimated. No audio, no transcript, no prompt, no token, no raw uid or IP:
      the caller is an HMAC under LEDGER_SALT, or nothing if no salt is set.

   WHAT IT CANNOT DO — stated, not discovered later:
   · tell a web visitor from an anonymous app learner. The iOS app sends Origin
     capacitor://localhost; the Play app, an installed web app and a browser tab
     all send https://app.lomonec.com; and any non-browser caller can send any
     Origin it likes. So the anonymous policy applies to every caller without a
     verified account, on every platform. That is why it ships "off", is meant
     to run in "report" first, and why its allowances are sized for a casual
     anonymous learner rather than for zero.
   · price anything exactly. PRICES below are list prices as the author knew
     them on 10 Oct 2026, NOT verified against the provider pages. Every row
     keeps the raw units, so the ledger can be re-priced and reconciled against
     the OpenAI / Google invoices (see the doc).
   ============================================================================ */
import { consume, release } from "./rate-limit.js";

/* ------------------------------------------------------------------ prices */
/* USD. Tokens per 1M; audio per minute; video per second. verified:false = the
   author's assumption, to be checked against openai.com/api/pricing and
   ai.google.dev/pricing before any figure is quoted. */
export const PRICES = {
  "gpt-4o-mini":               { inTok: 0.15, outTok: 0.60, verified: false },
  "gpt-4.1-mini":              { inTok: 0.40, outTok: 1.60, verified: false },
  "gpt-4o-audio-preview":      { inTok: 2.50, outTok: 10.00, audioInTok: 40.00, verified: false },
  "gpt-4o-mini-audio-preview": { inTok: 0.15, outTok: 0.60, audioInTok: 10.00, verified: false },
  "whisper-1":                 { perMinute: 0.006, verified: false },
  "gpt-4o-mini-tts":           { perMinute: 0.015, verified: false },
  /* the repo's own figure for Gemini on a YouTube URL (polish-worker.js
     YTAI_USD_PER_SEC, "$0.08 for 15 minutes"), not a list price */
  "gemini-3.6-flash":          { perVideoSec: 0.08 / 900, verified: false },
};
const CHARS_PER_TOKEN = 4;          // English rule of thumb, for estimates only
const SPEECH_CHARS_PER_SEC = 15;    // spoken English ≈ 150 wpm
const WEBM_BYTES_PER_SEC = 4000;    // Opus at ~32 kbit/s — the app's recorder
const WAV_BYTES_PER_SEC = 32000;    // 16 kHz 16-bit mono — the assess clips

/* -------------------------------------------------------------- the routes */
/* cls = the anonymous allowance a route draws on; null = not held by this
   module (not billable, or it has its own anonymous system already: ytai has
   YTAI_ANON + its pool, Shadow's reading helpers their own per-IP ceiling). */
export const ROUTES = {
  "transcribe":    { provider: "openai", model: "whisper-1",            cls: "transcribe", timeoutMs: 90_000 },
  "chat:practice": { provider: "openai", model: "gpt-4o-mini",          cls: "chat",       timeoutMs: 45_000, maxOut: 400 },
  "chat:shadow":   { provider: "openai", model: "gpt-4o-mini",          cls: null,         timeoutMs: 45_000, maxOut: 400 },
  "chat:coach":    { provider: "openai", model: "gpt-4o-mini",          cls: "verdict",    timeoutMs: 45_000, maxOut: 400, verdict: true },
  "chat:report":   { provider: "openai", model: "gpt-4o-mini",          cls: "verdict",    timeoutMs: 45_000, maxOut: 400, verdict: true },
  "mvreport":      { provider: "openai", model: "gpt-4o-mini",          cls: "verdict",    timeoutMs: 60_000, maxOut: 700, verdict: true },
  "analyse":       { provider: "openai", model: "gpt-4.1-mini",         cls: "verdict",    timeoutMs: 90_000, maxOut: 4200, verdict: true, serverPromptChars: 6000 },
  "assess":        { provider: "openai", model: "gpt-4o-audio-preview", cls: "verdict",    timeoutMs: 60_000, maxOut: 600, verdict: true },
  "repolish":      { provider: "openai", model: "gpt-4.1-mini",         cls: "polish",     timeoutMs: 60_000, maxOut: 1200, serverPromptChars: 3000 },
  "polish":        { provider: "openai", model: "gpt-4o-mini",          cls: "polish",     timeoutMs: 30_000, maxOut: 320 },
  "tts":           { provider: "openai", model: "gpt-4o-mini-tts",      cls: "tts",        timeoutMs: 30_000 },
  "ytai":          { provider: "google", model: "gemini-3.6-flash",     cls: null,         timeoutMs: 300_000 },
  "captions":      { provider: "youtube", model: "", cls: null, billable: false },
  "wm":            { provider: "", model: "", cls: null, billable: false },
};
export const billable = route => !!ROUTES[route] && ROUTES[route].billable !== false;

/* The route a request will take — the SAME order as polish-worker.js's
   dispatch, so the ledger and the policy name what the Worker will do. */
export function routeOf(ctype, body) {
  if (String(ctype || "").startsWith("audio/")) return "transcribe";
  if (!body || typeof body !== "object") return "polish";
  if (body.wm && typeof body.wm === "object") return "wm";
  if (body.chat && typeof body.chat === "object") {
    const p = String(body.chat.purpose || "practice");
    return ["practice", "shadow", "coach", "report"].includes(p) ? "chat:" + p : "chat:practice";
  }
  if (body.mvreport && typeof body.mvreport === "object") return "mvreport";
  if (typeof body.captions === "string" && body.captions.trim()) return "captions";
  if (typeof body.ytai === "string" && /^[A-Za-z0-9_-]{11}$/.test(body.ytai.trim())) return "ytai";
  if (typeof body.tts === "string" && body.tts.trim()) return "tts";
  if (typeof body.assess === "string" && body.assess.trim() && typeof body.audio === "string" && body.audio) return "assess";
  if (body.analyse && typeof body.analyse === "object") return "analyse";
  if (body.repolish && typeof body.repolish === "object") return "repolish";
  return "polish";
}
/* the programme the CLIENT says the work is for — recorded as declared, never
   used to authorise anything (only wm, be-partner and be-coach verify it) */
export function declaredTrack(body) {
  try {
    const c = (body && (body.analyse || body.repolish) || {}).context;
    if (c && (c.track === "welding" || c.track === "general")) return c.track;
    if (body && body.wm && (body.wm.prog === "general-english" || body.wm.prog === "welding")) return body.wm.prog === "welding" ? "welding" : "general";
  } catch (e) {}
  return "";
}

/* What a request asks for, in billing units — from the request alone, so it
   can be known BEFORE the provider is paid. Caps mirror the Worker's slicing. */
export function measure(route, body, bytes) {
  const s = (v, n) => typeof v === "string" ? Math.min(v.length, n) : 0;
  const m = { inChars: 0, audioSec: 0, ttsChars: 0, videoSec: 0 };
  try {
    if (route === "transcribe") m.audioSec = Math.min(1800, (bytes || 0) / WEBM_BYTES_PER_SEC);
    else if (route.startsWith("chat:")) {
      const msgs = Array.isArray(body.chat.messages) ? body.chat.messages.slice(-40) : [];
      m.inChars = s(body.chat.system, 4000) + msgs.reduce((t, x) => t + s(x && x.content, 2000), 0);
    } else if (route === "mvreport") m.inChars = s(body.mvreport.system, 6000) + s(body.mvreport.said, 2400);
    else if (route === "analyse") m.inChars = s(body.analyse.transcript, 4000);
    else if (route === "repolish") m.inChars = s(body.repolish.transcript, 4000) + (Array.isArray(body.repolish.avoid) ? body.repolish.avoid.slice(-4).reduce((t, x) => t + s(x, 1600), 0) : 0);
    else if (route === "polish") m.inChars = s(body.text, 400) + (Array.isArray(body.avoid) ? body.avoid.slice(0, 12).reduce((t, x) => t + s(x, 200), 0) : 0);
    else if (route === "tts") m.ttsChars = s(body.tts, 600);
    else if (route === "assess") { m.inChars = s(body.assess, 400); m.audioSec = Math.min(60, (typeof body.audio === "string" ? body.audio.length * 0.75 : 0) / WAV_BYTES_PER_SEC); }
  } catch (e) {}
  return m;
}

/* ---------------------------------------------------------------- estimates */
/* Worst-case-ish cost of a request BEFORE it runs (the output at its cap) —
   what the anonymous pool is charged. USD. */
export function preCostUsd(route, m) {
  const r = ROUTES[route]; if (!r) return 0;
  const p = PRICES[r.model] || {};
  if (route === "transcribe") return (m.audioSec / 60) * (p.perMinute || 0);
  if (route === "tts") return (m.ttsChars / SPEECH_CHARS_PER_SEC / 60) * (p.perMinute || 0);
  if (route === "ytai") return (m.videoSec || 0) * (p.perVideoSec || 0);
  const inTok = (m.inChars + (r.serverPromptChars || 0)) / CHARS_PER_TOKEN;
  let usd = (inTok * (p.inTok || 0) + (r.maxOut || 0) * (p.outTok || 0)) / 1e6;
  if (route === "assess") usd += (m.audioSec * 10 /* ≈ audio tokens per second, assumed */) * (p.audioInTok || 0) / 1e6;
  return usd;
}
/* Cost of what actually ran, from the provider's usage when it reported it,
   else from the request. Returns { usd, method }. */
export function postCost(route, calls, m) {
  let usd = 0, method = "provider-usage";
  for (const c of calls) {
    if (!c.billed) continue;
    const p = PRICES[c.model] || {};
    if (p.perVideoSec) { usd += (m.videoSec || 0) * p.perVideoSec; method = "video-seconds-estimate"; }
    else if (c.promptTokens != null || c.completionTokens != null) {
      const audioIn = c.audioInTokens || 0, textIn = Math.max(0, (c.promptTokens || 0) - audioIn);
      usd += (textIn * (p.inTok || 0) + audioIn * (p.audioInTok || p.inTok || 0) + (c.completionTokens || 0) * (p.outTok || 0)) / 1e6;
    } else if (c.audioSec != null && p.perMinute) usd += (c.audioSec / 60) * p.perMinute;
    else { usd += preCostUsd(route, m); method = "request-estimate"; }
  }
  return { usd, method };
}
const UNIT_USD = 1e-4;                       // pool units: hundredths of a cent
const toUnits = usd => Math.max(1, Math.ceil(usd / UNIT_USD));

/* -------------------------------------------------------- request context */
/* One per request, carried on a per-request copy of env (every provider call
   takes env first), so concurrent requests in one isolate never share it. */
export function newCtx(request) {
  return { t0: Date.now(), route: "", track: "", state: "", policy: "off", outcome: "", ip: "", uid: "", m: null,
           calls: [], pending: [], charges: [], locks: [], quotaUnits: 0, row: null, req: request };
}
export function withCtx(env, rc) { const e = Object.create(env || {}); e.__rc = rc; return e; }
const ctxOf = env => (env && env.__rc) || null;

/* a quota unit was taken: remember it so an error can give it back */
export function noteCharge(env, subject, name, cost = 1, kind = "quota") {
  const rc = ctxOf(env); if (!rc || !subject || !name) return;
  rc.charges.push({ subject, name, cost, kind });
  if (kind === "verdict") rc.quotaUnits += cost;
}

/* --------------------------------------------------------- provider calls */
/* fetch with a timeout to the response headers, and the provider's usage read
   from a JSON answer. The timer stops at the headers: a streamed reply is not
   cut off mid-way, and OpenAI's non-streamed answers arrive whole. */
export async function pfetch(env, meta, url, init = {}) {
  meta = meta || {};
  const rc = ctxOf(env);
  /* AI_TIMEOUT_MS overrides every route's timeout (tests; an emergency knob) */
  const ms = Number(env && env.AI_TIMEOUT_MS) > 0 ? Number(env.AI_TIMEOUT_MS) : (meta.timeoutMs || 60_000);
  const ac = new AbortController();
  const timer = setTimeout(() => { try { ac.abort(); } catch (e) {} }, ms);
  const call = { provider: meta.provider || "", model: meta.model || "", status: 0, ms: 0, billed: false };
  const t0 = Date.now();
  if (rc) rc.calls.push(call);
  let r;
  try {
    r = await fetch(url, { ...init, signal: init.signal || ac.signal });
  } catch (e) {
    clearTimeout(timer);
    call.ms = Date.now() - t0;
    call.status = ac.signal.aborted ? "timeout" : "network";
    if (ac.signal.aborted) throw new Error("provider timeout");
    throw e;
  }
  clearTimeout(timer);
  call.ms = Date.now() - t0; call.status = r.status; call.billed = r.ok;
  if (r.ok && !meta.stream && /json/.test(r.headers.get("content-type") || "")) {
    const p = r.clone().json().then(j => {
      const u = j && j.usage;
      if (u) {
        call.promptTokens = Number(u.prompt_tokens ?? u.input_tokens) || 0;
        call.completionTokens = Number(u.completion_tokens ?? u.output_tokens) || 0;
        const d = u.prompt_tokens_details || u.input_tokens_details;
        if (d && Number.isFinite(+d.audio_tokens)) call.audioInTokens = +d.audio_tokens;
      }
      const g = j && j.usageMetadata;
      if (g) { call.promptTokens = Number(g.promptTokenCount) || 0; call.completionTokens = Number(g.candidatesTokenCount) || 0; }
      if (j && Number.isFinite(+j.duration)) call.audioSec = +j.duration;        // whisper verbose_json: what it bills by
    }).catch(() => {});
    if (rc) rc.pending.push(p);
  }
  return r;
}

/* -------------------------------------------------------- the anon policy */
export function anonPolicy(env) {
  const v = String((env && env.ANON_AI_POLICY) || "off").toLowerCase();
  return v === "report" || v === "enforce" ? v : "off";
}
/* per IP per UTC day, in calls — PROPOSED values, sized for one casual
   anonymous learner (a session or two a day), each overridable by a var */
export const ANON_DEFAULTS = { transcribe: 40, chat: 40, polish: 15, tts: 150, verdict: 3 };
export const ANON_POOL_USD_DEFAULT = 10;      // every visitor together, per UTC day
function anonLimit(env, cls) {
  const v = Number(env && env["ANON_AI_" + cls.toUpperCase() + "_PER_DAY"]);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : ANON_DEFAULTS[cls];
}
function anonPoolUnits(env) {
  const v = Number(env && env.ANON_AI_POOL_USD);
  return toUnits(Number.isFinite(v) && v > 0 ? v : ANON_POOL_USD_DEFAULT);
}
const utcDay = now => new Date(now).toISOString().slice(0, 10);
const utcMidnightAfter = now => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };

/* Is this caller a VERIFIED account? deps.verify(token, projectId) -> uid. */
async function verifiedUid(request, env, deps) {
  const auth = request.headers.get("Authorization") || "";
  if (!/^Bearer \S+$/.test(auth) || !env.FIREBASE_PROJECT_ID || !deps || !deps.verify) return "";
  try { return String(await deps.verify(auth.slice(7), env.FIREBASE_PROJECT_ID) || ""); }
  catch (e) { return ""; }       // malformed, expired, wrong project, JWKS down: not an account
}

/* null = carry on; a Response = refuse. Never refuses unless policy = enforce. */
export async function anonGate(request, env, cors, deps, json) {
  const rc = ctxOf(env); if (!rc) return null;
  rc.policy = anonPolicy(env);
  if (rc.policy === "off") return null;
  const meta = ROUTES[rc.route];
  if (!meta || !meta.cls) return null;
  const uid = await verifiedUid(request, env, deps);
  if (uid) { rc.uid = uid; if (!rc.state) rc.state = "account"; return null; }
  rc.state = "visitor";
  const now = Date.now(), day = utcDay(now), resetAt = utcMidnightAfter(now);
  const ipSub = "ip:" + (rc.ip || "0"), ipName = "anon:" + meta.cls + ":" + day;
  let refused = null;
  const a = await consume(env, ipSub, [{ name: ipName, limit: anonLimit(env, meta.cls), windowMs: 86_400_000 }]);
  if (!a.ok) refused = "ip";
  else {
    noteCharge(env, ipSub, ipName, 1);
    const units = toUnits(preCostUsd(rc.route, rc.m || {}));
    const poolName = "anonpool:" + day;
    const b = await consume(env, "global:anon-ai", [{ name: poolName, limit: anonPoolUnits(env), windowMs: 86_400_000, cost: units }]);
    if (!b.ok) { refused = "pool"; await release(env, ipSub, [{ name: ipName, cost: 1 }]); rc.charges.pop(); }
    else noteCharge(env, "global:anon-ai", poolName, units);
  }
  if (!refused) return null;
  if (rc.policy === "report") { rc.outcome = "anon_would_refuse_" + refused; return null; }
  rc.outcome = "anon_refused_" + refused;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return json({ error: "allowance", scope: "anon", reason: refused, signIn: true, resetAt, retryAfter }, 429,
              { ...cors, "Retry-After": String(retryAfter), "Access-Control-Expose-Headers": "X-BE-Allowance, X-BE-Video-Allowance, Retry-After" });
}

/* ----------------------------------------------- one identical request at a time */
async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export const INFLIGHT_MS = 120_000;
/* null = carry on; a Response (409) = an identical request is already running.
   Only for work that spends a learner's quota or the anonymous pool. */
export async function inflightGate(request, env, cors, bodyText, json) {
  const rc = ctxOf(env); if (!rc) return null;
  if (String(env.AI_DEDUPE || "") !== "1") return null;        // opt-in: a new refusal, so it is switched on per environment
  const meta = ROUTES[rc.route];
  if (!meta || !(meta.verdict || rc.route === "ytai" || (rc.policy !== "off" && meta.cls))) return null;
  const who = await sha(request.headers.get("Authorization") || ("ip:" + rc.ip));
  const subject = "dup:" + who.slice(0, 40), name = "lock:" + (await sha(rc.route + "\n" + bodyText)).slice(0, 40);
  const r = await consume(env, subject, [{ name, limit: 1, windowMs: INFLIGHT_MS }]);
  if (!r.ok) { rc.outcome = "duplicate_in_flight"; return json({ error: "duplicate_in_flight", retryAfter: r.retryAfter }, 409, { ...cors, "Retry-After": String(r.retryAfter || 5) }); }
  rc.locks.push({ subject, name });          // released by settle() whatever the outcome
  return null;
}

/* ------------------------------------------------------------ settle + ledger */
/* After the response is known: give quota back on an error, always free the
   in-flight lock, then write the ledger row. */
export async function settle(env, status) {
  const rc = ctxOf(env); if (!rc) return null;
  const jobs = [];
  if (status >= 400 && rc.charges.length) {
    const by = new Map();
    for (const c of rc.charges) { if (!by.has(c.subject)) by.set(c.subject, []); by.get(c.subject).push({ name: c.name, cost: c.cost }); }
    for (const [s, b] of by) jobs.push(release(env, s, b));
    rc.refunded = true;
  }
  for (const l of rc.locks) jobs.push(release(env, l.subject, [{ name: l.name, cost: 1 }]));
  await Promise.allSettled(jobs);
  return await ledger(env, status);
}

async function hmac(secret, text) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text));
  return [...new Uint8Array(s)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}
function outcomeOf(rc, status) {
  if (rc.outcome && !/would_refuse/.test(rc.outcome)) return rc.outcome;
  if (status < 400) return rc.outcome || "ok";
  if (status === 429) return "limited";
  if (status === 401 || status === 402 || status === 403) return "refused";
  if (rc.calls.some(c => c.status === "timeout")) return "provider_timeout";
  if (status >= 500) return rc.calls.length ? "provider_error" : "server_error";
  return "invalid";
}
export async function ledger(env, status) {
  const rc = ctxOf(env); if (!rc || !rc.route || !billable(rc.route)) return null;
  await Promise.allSettled(rc.pending);
  const meta = ROUTES[rc.route] || {};
  const m = rc.m || {};
  const billedCalls = rc.calls.filter(c => c.billed);
  const cost = billedCalls.length ? postCost(rc.route, billedCalls, m) : { usd: 0, method: rc.calls.length ? "not-billed" : "no-provider-call" };
  const sum = k => rc.calls.reduce((t, c) => t + (Number(c[k]) || 0), 0);
  let id = "";
  if (env.LEDGER_SALT) { try { id = await hmac(String(env.LEDGER_SALT), rc.uid ? "u:" + rc.uid : "ip:" + rc.ip); } catch (e) {} }
  const model = (billedCalls[billedCalls.length - 1] || rc.calls[rc.calls.length - 1] || {}).model || meta.model || "";
  const row = {
    blobs: [rc.route, rc.track || "", rc.state || (rc.req && /^Bearer \S+$/.test(rc.req.headers.get("Authorization") || "") ? "token_unverified" : "no_token"), meta.provider || "", model, outcomeOf(rc, status), id, cost.method, rc.policy, rc.refunded ? "refunded" : ""],
    doubles: [status, sum("promptTokens"), sum("completionTokens"), sum("audioSec") || (billedCalls.length ? m.audioSec || 0 : 0),
              m.ttsChars || 0, m.inChars || 0, rc.quotaUnits, Math.round(cost.usd * 1e6), rc.calls.length, billedCalls.length, Date.now() - rc.t0],
    indexes: [rc.route],
  };
  rc.row = row;
  try {
    if (env.AI_LEDGER && typeof env.AI_LEDGER.writeDataPoint === "function") env.AI_LEDGER.writeDataPoint(row);
    else if (env.AI_LEDGER_LOG === "1") console.log(JSON.stringify({ ai_ledger: row }));
  } catch (e) { /* the ledger must never fail a request */ }
  return row;
}
/* the column names, in order — for the doc and the SQL in it */
export const LEDGER_COLUMNS = {
  blobs: ["route", "track_declared", "state", "provider", "model", "outcome", "caller_hmac", "cost_method", "anon_policy", "refunded"],
  doubles: ["status", "prompt_tokens", "completion_tokens", "audio_sec", "tts_chars", "input_chars", "verdicts_charged", "est_usd_micro", "provider_calls", "billed_calls", "latency_ms"],
};
