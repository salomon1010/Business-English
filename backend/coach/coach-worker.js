/* BE Mastery — be-coach, the Smart Coach's server (10 Oct 2026, STAGING ONLY).
   ----------------------------------------------------------------------------
   One JSON route: POST /  { op, track, …payload }.  Answers for ONE account:

     · WHO       the Firebase ID token, verified by be-entitlements (the same
                 /v1/entitlement call every AI route makes). No token → 401.
     · PROGRAMME the ACCOUNT's own programme, from be-partner's GET /programme
                 (the caller's Firestore record, read with the caller's token).
                 The request names a track; it is served only when it IS the
                 account's — a Welding account can never read, approve or
                 complete a General English plan, nor the reverse. → 403 "track".
     · PREMIUM   approving, moving, resuming, restarting and completing a plan
                 need a paid Premium plan (the same `premium` rule as be-polish:
                 plan premium + paid + ad_free). Reading the status, pausing,
                 cancelling and recording "opened/started" stay open, so an
                 expired subscription never traps a plan the learner cannot
                 even cancel. → 402 "premium_required".
     · EVIDENCE  a game-round session is complete only if be-polish CLOSED that
                 round for this account: the RateLimiter Durable Object (bound
                 here from be-polish-staging) holds a "<prefix>f:<round id>"
                 counter per finished round. Every other activity's record lives
                 on the learner's device; it is checked for shape, activity,
                 window and single use, and stored as verifiedBy:"device" — the
                 app says which is which.
     · LIMITS    per IP 60/min, per account 30/min and 600/day (RateLimiter).
     · STORAGE   CoachStore (coach-store.js), one Durable Object per account.

   Production has no be-entitlements (ENTITLEMENTS_URL empty) → 503
   "coach_unavailable". Nothing here is deployed to production.
   ============================================================================ */
import { consume, peek } from "../rate-limit.js";
import "../../smart-coach-engine.js";
export { CoachStore } from "./coach-store.js";
const E = globalThis.SmartCoachEngine;

const ORIGINS = ["https://staging.lomonec.com", "capacitor://localhost", "https://localhost",
  "http://localhost:8000", "http://127.0.0.1:8000"];
const PREMIUM_OPS = new Set(["approve", "reschedule", "resume", "restart", "complete"]);
const OPS = new Set(["status", "approve", "reschedule", "pause", "resume", "cancel", "restart", "complete", "mark"]);
const GAME_PREFIX = { "welding": "wm", "general-english": "em" };
const SID = /^[a-z0-9-]{8,48}$/;
const MAX_BODY = 16_384;

function corsFor(origin) {
  const local = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(origin || "");
  return { "Access-Control-Allow-Origin": ORIGINS.includes(origin) || local ? origin : "", "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Max-Age": "600", "Vary": "Origin" };
}
const json = (body, status, cors) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" } });

function tokenSub(tok) {
  try {
    const b = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const sub = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b + "===".slice((b.length + 3) % 4)), c => c.charCodeAt(0)))).sub;
    return typeof sub === "string" && sub && sub.length <= 128 ? sub : null;
  } catch (e) { return null; }
}
const entCache = new Map(), trackCache = new Map();
async function account(req, env) {
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer \S+$/.test(auth)) return { status: 401 };
  const tok = auth.slice(7), hit = entCache.get(tok);
  if (hit && Date.now() - hit.at < 60_000) return hit.a;
  let r; try { r = await fetch(String(env.ENTITLEMENTS_URL).replace(/\/+$/, "") + "/v1/entitlement", { headers: { authorization: auth } }); } catch (e) { return { status: 503 }; }
  if (r.status === 401 || r.status === 403) return { status: 401 };
  if (!r.ok) return { status: 503 };
  let j; try { j = await r.json(); } catch (e) { return { status: 503 }; }
  const caps = j && j.capabilities && typeof j.capabilities === "object" ? j.capabilities : {};
  const uid = tokenSub(tok); if (!uid) return { status: 401 };
  const a = { uid, premium: (j && j.plan === "premium" && j.paid === true && caps.ad_free === true) || (caps.ad_free === true && !(j && j.plan)) };
  if (entCache.size > 2000) entCache.clear();
  entCache.set(tok, { at: Date.now(), a });
  return a;
}
async function programme(req, env, uid) {
  const hit = trackCache.get(uid);
  if (hit && Date.now() - hit.at < 60_000) return { track: hit.track };
  let r; try { r = await fetch(String(env.PARTNER_API).replace(/\/+$/, "") + "/programme", { headers: { authorization: req.headers.get("Authorization") || "" } }); } catch (e) { return { status: 503 }; }
  if (r.status === 401) return { status: 401 };
  if (r.status === 403) return { track: null };
  if (!r.ok) return { status: 503 };
  let j; try { j = await r.json(); } catch (e) { return { status: 503 }; }
  const track = j && typeof j.track === "string" ? j.track : null;
  if (trackCache.size > 2000) trackCache.clear();
  trackCache.set(uid, { track, at: Date.now() });
  return { track };
}

export default {
  async fetch(req, env) {
    const cors = corsFor(req.headers.get("Origin") || "");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json({ error: "method" }, 405, cors);
    if (!env.ENTITLEMENTS_URL || !env.PARTNER_API || !env.COACH) return json({ error: "coach_unavailable" }, 503, cors);
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413, cors);
    let body; try { body = JSON.parse(raw); } catch (e) { return json({ error: "bad_request" }, 400, cors); }
    const op = String(body && body.op || ""), track = String(body && body.track || "");
    if (!OPS.has(op) || !E.TRACKS.includes(track)) return json({ error: "bad_request" }, 400, cors);

    const ip = req.headers.get("CF-Connecting-IP") || "0";
    { const l = await consume(env, "ip:" + ip, [{ name: "coach:ip", limit: 60, windowMs: 60_000 }]); if (!l.ok) return json({ error: "rate", retryAfter: l.retryAfter }, 429, cors); }

    const a = await account(req, env);
    if (a.status === 401) return json({ error: "auth_required" }, 401, cors);
    if (a.status === 503) return json({ error: "entitlement_unavailable" }, 503, cors);
    const t = await programme(req, env, a.uid);
    if (t.status === 401) return json({ error: "auth_required" }, 401, cors);
    if (t.status === 503) return json({ error: "track_unavailable" }, 503, cors);
    if (t.track !== track) return json({ error: "track", track: t.track || null }, 403, cors);

    const subject = "acct:u:" + a.uid;
    { const l = await consume(env, subject, [{ name: "coach:m", limit: 30, windowMs: 60_000 }, { name: "coach:d", limit: 600, windowMs: 86_400_000 }]); if (!l.ok) return json({ error: "rate", retryAfter: l.retryAfter }, 429, cors); }
    if (PREMIUM_OPS.has(op) && !a.premium) return json({ error: "premium_required" }, 402, cors);

    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    let serverVerified = false;
    if (op === "complete" && payload.ev && payload.ev.type === "game") {
      const sid = String(payload.ev.ref || "");
      if (!SID.test(sid)) return json({ error: "evidence", why: "ref" }, 422, cors);
      const name = GAME_PREFIX[track] + "f:" + sid;
      const p = await peek(env, subject, [name]);
      if (!p.ok || p.degraded) return json({ error: "verify_unavailable" }, 503, cors);
      serverVerified = (p.counts && p.counts[name] || 0) >= 1;
      if (!serverVerified) return json({ error: "not_confirmed" }, 409, cors);
    }
    const stub = env.COACH.get(env.COACH.idFromName(a.uid));
    const r = await stub.fetch("https://coach.invalid/op", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, track, now: Date.now(), premium: a.premium, serverVerified, payload }) });
    const out = await r.json().catch(() => ({ error: "store_unavailable" }));
    return json({ ...out, plan: a.premium ? "premium" : "free" }, r.ok || r.status < 500 ? r.status : 503, cors);
  },
};
export function _coachReset() { entCache.clear(); trackCache.clear(); }   // tests only
