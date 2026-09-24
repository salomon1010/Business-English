/* BE Mastery — entitlement Worker (be-entitlements). Phase 7.

   The server-side source of truth for a learner's plan. Cloudflare Worker +
   D1, the same stack as be-partner; identity is the Firebase Auth uid from a
   verified ID token, exactly as there.

   Routes
     GET    /health                 liveness (no data)
     GET    /v1/entitlement         the caller's VIEW (entitlement-core.resolve) — auth required
     DELETE /v1/me                  erase the caller's row (account deletion) — auth required
     POST   /v1/admin/grant         owner-only manual / promotional grant — ADMIN_TOKEN secret
     POST   /v1/billing/:provider   store notifications — 501 until Phase 9 builds real verification
     POST   /v1/rewards/start       a learner asks for a rewarded ad → single-use nonce — auth required
     POST   /v1/rewards/verify/:p   the AD NETWORK confirms the ad bound to a nonce was watched (server to server)
     POST   /v1/rewards/claim       the learner claims a verified nonce → +credit, exactly once — auth required
     GET    /v1/rewards             the learner's reward balances — auth required

   Security model
   - The uid comes ONLY from the verified token. No body field, query
     parameter or header can name another user, and there is no route that
     takes a uid from a client except the admin route, which a client cannot
     authenticate to.
   - No client can write a plan. A client-sent "plan", "premium" or "status"
     is never read by the client-facing routes.
   - The VIEW carries no provider identifiers; external_ref never leaves D1.
   - DEV_AUTH="1" (local wrangler env only) accepts X-Dev-User so the flow
     runs without Firebase; production must never set it.
   - Responses are no-store: a shared cache must never serve one learner's
     plan to another. */
import { resolve, validateRecord, isPremium, REWARD_KINDS, REWARD_SESSION_TTL_MS, rewardKindEnabled } from "./src/entitlement-core.js";
import { ADAPTERS, REWARD_VERIFIERS } from "./src/adapters.js";
import { verifyIdToken } from "./src/firebase-auth.js";

const ORIGINS_DEFAULT = ["https://app.lomonec.com", "capacitor://localhost"];
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function cors(req, env) {
  const o = req.headers.get("origin") || "";
  const list = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const allowed = (list.length ? list : ORIGINS_DEFAULT).includes(o) || (env.DEV_AUTH === "1" && DEV_ORIGIN.test(o));
  return allowed ? {
    "access-control-allow-origin": o, "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-dev-user", "access-control-max-age": "86400", "vary": "origin",
  } : { "vary": "origin" };
}
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
});
const err = (status, code, extra) => json({ error: code }, status, extra);

async function authUid(req, env, deps) {
  if (env.DEV_AUTH === "1") { const dev = req.headers.get("x-dev-user"); if (dev && /^[a-z0-9_-]{1,64}$/i.test(dev)) return "dev:" + dev; }
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || ""); if (!m) return null;
  try { return await verifyIdToken(m[1], env.FIREBASE_PROJECT_ID, deps.auth || {}); } catch (e) { return null; }
}

/* constant-time comparison for the admin secret */
function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}

const q = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
const changes = r => (r && r.meta && Number(r.meta.changes)) || 0;
const nonceHex = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
const dayStart = ms => ms - (ms % 86_400_000);
async function balances(env, uid) {
  const r = await q(env, "SELECT kind, balance FROM reward_credits WHERE uid=?", uid).all();
  const o = {}; for (const row of (r && r.results) || []) o[row.kind] = row.balance; return o;
}
const readRecord = (env, uid) => q(env, "SELECT uid,plan,product,status,starts_at,expires_at,source,updated_at FROM entitlements WHERE uid=?", uid).first();
const audit = (env, ts, uid, actor, action, r) => q(env,
  "INSERT INTO entitlement_audit(ts,uid,actor,action,plan,status,expires_at) VALUES(?,?,?,?,?,?,?)",
  ts, uid, actor, action, r ? r.plan : null, r ? r.status : null, r ? (r.expires_at ?? null) : null).run();

export async function handle(req, env, deps = {}) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/";
  const now = deps.now ? deps.now() : Date.now();
  const c = cors(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });

  if (req.method === "GET" && path === "/health") return json({ ok: true, dev: env.DEV_AUTH === "1" }, 200, c);

  if (path === "/v1/entitlement" && req.method === "GET") {
    const uid = await authUid(req, env, deps);
    if (!uid) return err(401, "auth", c);
    const rec = await readRecord(env, uid);
    return json({ ...resolve(rec, now), checkedAt: now }, 200, c);
  }

  if (path === "/v1/me" && req.method === "DELETE") {
    const uid = await authUid(req, env, deps);
    if (!uid) return err(401, "auth", c);
    const had = await readRecord(env, uid);
    await q(env, "DELETE FROM entitlements WHERE uid=?", uid).run();
    if (had) await audit(env, now, uid, "self-erase", "erase", null);
    return json({ ok: true, erased: !!had }, 200, c);
  }

  if (path === "/v1/admin/grant" && req.method === "POST") {
    /* hidden unless a strong secret is configured; never CORS-enabled */
    if (!ADAPTERS.manual.configured(env)) return err(404, "not_found");
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
    if (!m || !sameSecret(m[1], env.ADMIN_TOKEN)) return err(401, "auth");
    let body; try { body = await req.json(); } catch (e) { return err(400, "json"); }
    const rec = ADAPTERS.manual.normalize(body, now);
    const v = validateRecord(rec);
    if (!v.ok) return json({ error: "invalid", why: v.why }, 400);
    await q(env, `INSERT INTO entitlements(uid,plan,product,status,starts_at,expires_at,source,external_ref,updated_at)
                  VALUES(?,?,?,?,?,?,?,?,?)
                  ON CONFLICT(uid) DO UPDATE SET plan=excluded.plan, product=excluded.product, status=excluded.status,
                    starts_at=excluded.starts_at, expires_at=excluded.expires_at, source=excluded.source,
                    external_ref=excluded.external_ref, updated_at=excluded.updated_at`,
      rec.uid, rec.plan, rec.product, rec.status, rec.starts_at, rec.expires_at, rec.source, rec.external_ref, rec.updated_at).run();
    await audit(env, now, rec.uid, "admin", "grant", rec);
    return json({ ok: true, view: resolve(rec, now) });
  }

  /* ---------------------------------------------------------- rewards */
  if (path === "/v1/rewards" && req.method === "GET") {
    const uid = await authUid(req, env, deps); if (!uid) return err(401, "auth", c);
    return json({ balances: await balances(env, uid) }, 200, c);
  }
  if (path === "/v1/rewards/start" && req.method === "POST") {
    const uid = await authUid(req, env, deps); if (!uid) return err(401, "auth", c);
    let body; try { body = await req.json(); } catch (e) { return err(400, "json", c); }
    const kind = String((body && body.kind) || "");
    if (!rewardKindEnabled(kind, env.REWARD_KINDS_ENABLED)) return err(403, "kind_off", c);
    if (isPremium(resolve(await readRecord(env, uid), now))) return err(409, "premium", c);   /* Premium never sees rewarded ads */
    const used = await q(env, "SELECT count(*) AS n FROM reward_sessions WHERE uid=? AND kind=? AND claimed_at>=?", uid, kind, dayStart(now)).first();
    if (((used && used.n) || 0) >= REWARD_KINDS[kind].dailyMax) return err(429, "daily_cap", c);
    const nonce = nonceHex();
    await q(env, "INSERT INTO reward_sessions(nonce,uid,kind,created_at,expires_at) VALUES(?,?,?,?,?)", nonce, uid, kind, now, now + REWARD_SESSION_TTL_MS).run();
    return json({ nonce, kind, expiresAt: now + REWARD_SESSION_TTL_MS }, 200, c);
  }
  const ver = /^\/v1\/rewards\/verify\/([a-z_]{1,32})$/.exec(path);
  if (ver && req.method === "POST") {
    const v = REWARD_VERIFIERS[ver[1]];
    if (!v || (v.id === "mock" && !v.configured(env))) return err(404, "not_found");   /* the mock does not exist outside dev/test */
    if (!v.configured(env)) return err(501, "not_configured");
    const r = await v.verify(req, env, deps);
    if (!r.ok) return json({ error: "invalid", why: r.why }, 400);
    const s = await q(env, "SELECT * FROM reward_sessions WHERE nonce=?", r.nonce).first();
    if (!s) return err(404, "unknown_nonce");
    if (s.verified_at) return s.provider_txn === r.txn ? json({ ok: true, again: true }) : err(409, "already_verified");
    if (s.expires_at <= now) return err(410, "expired");
    try {
      const u = await q(env, "UPDATE reward_sessions SET verified_at=?, provider=?, provider_txn=? WHERE nonce=? AND verified_at IS NULL AND expires_at>?", now, v.id, r.txn, r.nonce, now).run();
      if (!changes(u)) return err(409, "already_verified");
    } catch (e) { return err(409, "txn_replay"); }   /* provider_txn is UNIQUE: one watched ad verifies one session */
    return json({ ok: true });
  }
  if (path === "/v1/rewards/claim" && req.method === "POST") {
    const uid = await authUid(req, env, deps); if (!uid) return err(401, "auth", c);
    let body; try { body = await req.json(); } catch (e) { return err(400, "json", c); }
    const nonce = String((body && body.nonce) || "");
    if (!/^[a-f0-9]{32}$/.test(nonce)) return err(400, "nonce", c);
    const s = await q(env, "SELECT * FROM reward_sessions WHERE nonce=? AND uid=?", nonce, uid).first();
    if (!s) return err(404, "not_found", c);                                    /* someone else's nonce is simply not found */
    if (s.claimed_at) return json({ credited: false, reason: "already_claimed", balances: await balances(env, uid) }, 200, c);
    if (!s.verified_at) return err(409, "not_verified", c);
    if (s.expires_at <= now) return err(410, "expired", c);
    /* the claim is one conditional UPDATE: two racing claims cannot both win */
    const u = await q(env, "UPDATE reward_sessions SET claimed_at=? WHERE nonce=? AND uid=? AND claimed_at IS NULL AND verified_at IS NOT NULL", now, nonce, uid).run();
    if (!changes(u)) return json({ credited: false, reason: "already_claimed", balances: await balances(env, uid) }, 200, c);
    const amt = REWARD_KINDS[s.kind] ? REWARD_KINDS[s.kind].amount : 0;
    await q(env, "INSERT INTO reward_credits(uid,kind,balance,updated_at) VALUES(?,?,?,?) ON CONFLICT(uid,kind) DO UPDATE SET balance=balance+excluded.balance, updated_at=excluded.updated_at", uid, s.kind, amt, now).run();
    await audit(env, now, uid, "provider:" + (s.provider || "?"), "reward_claim", { plan: null, status: s.kind, expires_at: null });
    return json({ credited: true, kind: s.kind, balances: await balances(env, uid) }, 200, c);
  }

  const bill = /^\/v1\/billing\/([a-z_]{1,32})$/.exec(path);
  if (bill && req.method === "POST") {
    const a = ADAPTERS[bill[1]];
    if (!a || a.id === "manual") return err(404, "not_found");
    if (!a.configured(env)) return err(501, "not_configured");
    return err(501, "not_configured");   // Phase 9: verify the provider's signature, normalise, upsert, audit
  }

  return err(404, "not_found", c);
}

export default {
  async fetch(req, env, ctx) {
    try { return await handle(req, env); }
    catch (e) { console.error("entitlements", String(e && e.message || e).slice(0, 200)); return err(500, "server"); }
  },
};
