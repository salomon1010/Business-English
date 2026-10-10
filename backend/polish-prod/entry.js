/* be-polish production entry (10 Oct 2026, owner: "games only, everyone Free").
   The code production already ran (deployed.js, fetched from Cloudflare on 10 Oct 2026, unchanged but
   for exporting corsHeaders) serves every request as before; ONLY a `{ wm: … }` body is
   answered by the game route (wm-game.js), whose energy, tickets and XP live in the
   RateLimiter Durable Object. No metering, no YouTube trial, no tier change: those
   live in the repo's polish-worker.js and are NOT part of this deploy.

   AI COST CONTROL (10 Oct 2026, docs/AI-COST-CONTROL.md) — DORMANT by default.
   With neither ANON_AI_POLICY nor an AI_LEDGER binding configured, every
   non-game request takes exactly the old path below, untouched. When either is
   set, the request is classified (ai-guard routeOf), a caller without a VERIFIED
   Firebase token is held by the anonymous policy, and one ledger row is written.
   The old code's provider calls are invisible from here, so the row is a
   request-side ESTIMATE (cost_method "request-estimate") and a 2xx answer is
   assumed to have been billed. Nothing about a signed-in learner changes. */
import base, { corsHeaders } from "./deployed.js";
import { wmHandle } from "./wm-game.js";
import { consume } from "./rate-limit.js";
import { ROUTES, newCtx, withCtx, routeOf, declaredTrack, measure, billable, anonGate, anonPolicy, settle } from "./ai-guard.js";
import { verifyIdToken } from "./entitlements/src/firebase-auth.js";
export { RateLimiter } from "./rate-limit.js";

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...cors } });
function tokenSub(tok) {
  try { const p = String(tok).split("."); if (p.length !== 3) return null; let b = p[1].replace(/-/g, "+").replace(/_/g, "/"); while (b.length % 4) b += "=";
    const sub = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0)))).sub; return typeof sub === "string" && sub ? sub : null; } catch (e) { return null; }
}
/* the account and its plan, from be-entitlements (which verifies the Firebase token) */
const cache = new Map();
async function capabilities(req, env) {
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer \S+$/.test(auth)) return { status: 401 };
  const tok = auth.slice(7), hit = cache.get(tok);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  let r; try { r = await fetch(String(env.ENTITLEMENTS_URL).replace(/\/+$/, "") + "/v1/entitlement", { headers: { authorization: auth } }); } catch (e) { return { status: 503 }; }
  if (r.status === 401 || r.status === 403) return { status: 401 };
  if (!r.ok) return { status: 503 };
  let j; try { j = await r.json(); } catch (e) { return { status: 503 }; }
  const caps = (j && j.capabilities) || {};
  const v = { uid: tokenSub(tok), caps, premium: !!(j && j.plan === "premium" && j.paid === true && caps.ad_free === true) };
  if (cache.size > 5000) cache.clear(); cache.set(tok, { at: Date.now(), v });
  return v;
}
async function perAccount(a, env, cors) {
  if (!a.uid) return null;
  const r = await consume(env, "acct:u:" + a.uid, [{ name: "acct:min", limit: 30, windowMs: 60_000 }, { name: "acct:day", limit: 600, windowMs: 86_400_000 }]);
  return r.ok ? null : json({ error: "rate_limited", retryAfter: r.retryAfter }, 429, { ...cors, "Retry-After": String(r.retryAfter || 60) });
}

/* the cost-controlled path for one AI request (only reached when configured) */
async function guarded(req, env, ctx) {
  const cors = corsHeaders(req.headers.get("Origin") || "");
  if (!cors["Access-Control-Allow-Origin"]) return base.fetch(req, env, ctx);      // the old code answers 403 itself
  const rc = newCtx(req), e = withCtx(env, rc);
  rc.ip = req.headers.get("CF-Connecting-IP") || "0";
  const ctype = req.headers.get("content-type") || "";
  if (ctype.startsWith("audio/")) {
    rc.route = "transcribe";
    rc.m = measure("transcribe", null, +(req.headers.get("content-length") || 0));
  } else {
    let body = null;
    try { body = JSON.parse(await req.clone().text()); } catch (err) {}
    if (!body || typeof body !== "object") return base.fetch(req, env, ctx);     // malformed: the old code's 400
    rc.route = routeOf(ctype, body); rc.m = measure(rc.route, body, 0); rc.track = declaredTrack(body);
  }
  const refused = await anonGate(req, e, cors, { verify: verifyIdToken }, json);
  const res = refused || await base.fetch(req, env, ctx);
  if (!refused && billable(rc.route)) {
    const meta = ROUTES[rc.route] || {};
    rc.calls.push({ provider: meta.provider, model: meta.model, status: res.status, billed: res.status < 400, ms: Date.now() - rc.t0 });
  }
  const done = settle(e, res.status).catch(() => {});
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(done); else await done;
  return res;
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === "POST" && !new URL(req.url).search) {
      let body = null;
      try { const t = await req.clone().text(); if (t.length < 20000 && t.includes('"wm"')) body = JSON.parse(t); } catch (e) {}
      if (body && body.wm && typeof body.wm === "object") {
        const cors = corsHeaders(req.headers.get("Origin") || "");
        try { return await wmHandle(body, req, env, cors, { capabilities, perAccount, json }); }
        catch (e) { return json({ error: "wm_unavailable" }, 503, cors); }
      }
    }
    /* dormant unless configured: exactly the old path */
    if (req.method !== "POST" || (anonPolicy(env) === "off" && !env.AI_LEDGER)) return base.fetch(req, env, ctx);
    return guarded(req, env, ctx);
  },
};
