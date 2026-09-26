/* BE Mastery — entitlement Worker (be-entitlements). Phases 7–9.

   The server-side source of truth for a learner's plan. Cloudflare Worker +
   D1, the same stack as be-partner; identity is the Firebase Auth uid from a
   verified ID token, exactly as there.

   Routes
     GET    /health                 liveness (no data)
     GET    /v1/entitlement         the caller's VIEW (entitlement-core.resolve) — auth required
     DELETE /v1/me                  erase the caller's row (account deletion) — auth required
     POST   /v1/admin/grant         owner-only manual / promotional grant — ADMIN_TOKEN secret
     POST   /v1/billing/:provider   store → server notifications (Google RTDN via Pub/Sub, Apple
                                    Server Notifications V2): authenticated, de-duplicated, applied
     GET    /v1/purchases/account-token   the caller's StoreKit appAccountToken — auth required
     POST   /v1/purchases/verify    bind a store purchase to the caller after the STORE verifies it — auth required
     POST   /v1/purchases/restore   re-verify what the store says this device owns — auth required
     POST   /v1/rewards/start       a learner asks for a rewarded ad → single-use nonce — auth required
     POST   /v1/rewards/verify/:p   the AD NETWORK confirms the ad bound to a nonce was watched (server to server)
     GET    /v1/rewards/verify/admob   AdMob SSV callback (ECDSA-signed query string)
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
import { resolve, validateRecord, isPremium, pickRecord, REWARD_KINDS, REWARD_SESSION_TTL_MS, rewardKindEnabled } from "./src/entitlement-core.js";
import { ADAPTERS, REWARD_VERIFIERS } from "./src/adapters.js";
import { BILLING_PROVIDERS } from "./src/billing.js";
import { appAccountToken } from "./src/app-store.js";
import { seal } from "./src/token-vault.js";
import * as admob from "./src/admob.js";
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
/* request bodies: the largest real one is a restore of 20 StoreKit JWS pairs */
export const MAX_BODY = 256 * 1024;
/* purchase routes, per account per minute (each call costs a store API request) */
export const PURCHASE_PER_MIN = 10;
async function rateLimited(env, uid, now, max) {
  const minute = Math.floor(now / 60_000);
  const r = await q(env, "INSERT INTO rate_hits(uid,minute,n) VALUES(?,?,1) ON CONFLICT(uid,minute) DO UPDATE SET n=n+1 RETURNING n", uid, minute).first();
  if (Math.random() < 0.05) await q(env, "DELETE FROM rate_hits WHERE minute<?", minute - 5).run();
  return !!r && r.n > max;
}
async function balances(env, uid) {
  const r = await q(env, "SELECT kind, balance FROM reward_credits WHERE uid=?", uid).all();
  const o = {}; for (const row of (r && r.results) || []) o[row.kind] = row.balance; return o;
}
const readRecord = (env, uid) => q(env, "SELECT uid,plan,product,status,starts_at,expires_at,will_renew,source,updated_at FROM entitlements WHERE uid=?", uid).first();

/* ---- account binding. A purchase link belongs to ONE account: the first
   verified bind wins, atomically (the conditional upsert below cannot move a
   row that another uid owns). Returns { ok } or { ok:false, owner }. */
/* Token retention (Phase 11): the store token is kept SEALED (src/token-vault.js)
   and only while the purchase can still matter — an ended or refunded purchase
   keeps no token, and account deletion removes the row. */
const ENDED = ["expired", "revoked"];
async function bindLink(env, uid, l) {
  const r = l.record;
  const sealed = ENDED.includes(r.status) ? null : await seal(l.secret_ref, env, l.provider + ":" + l.ext_id);
  const res = await q(env, `INSERT INTO purchase_links(provider,ext_id,uid,plan,product,source,status,starts_at,expires_at,will_renew,secret_ref,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(provider,ext_id) DO UPDATE SET plan=excluded.plan, product=excluded.product, source=excluded.source, status=excluded.status,
        starts_at=excluded.starts_at, expires_at=excluded.expires_at, will_renew=excluded.will_renew,
        secret_ref=CASE WHEN excluded.status IN ('expired','revoked') THEN NULL ELSE COALESCE(excluded.secret_ref, purchase_links.secret_ref) END,
        updated_at=excluded.updated_at
      WHERE purchase_links.uid=excluded.uid`,
    l.provider, l.ext_id, uid, r.plan, r.product ?? null, r.source, r.status, r.starts_at ?? null, r.expires_at ?? null, r.will_renew ?? null, sealed, r.updated_at).run();
  if (changes(res)) return { ok: true };
  const o = await q(env, "SELECT uid FROM purchase_links WHERE provider=? AND ext_id=?", l.provider, l.ext_id).first();
  return o && o.uid === uid ? { ok: true } : { ok: false, owner: o && o.uid };
}
/* the entitlement row is DERIVED from the account's links */
async function recompute(env, uid, now) {
  const rows = ((await q(env, "SELECT * FROM purchase_links WHERE uid=?", uid).all()).results) || [];
  const pick = pickRecord(rows.map(r => ({ uid, plan: r.plan, product: r.product, status: r.status, starts_at: r.starts_at, expires_at: r.expires_at,
    will_renew: r.will_renew, source: r.source, updated_at: r.updated_at })), now);
  if (!pick) { await q(env, "DELETE FROM entitlements WHERE uid=?", uid).run(); return resolve(null, now); }
  await q(env, `INSERT INTO entitlements(uid,plan,product,status,starts_at,expires_at,will_renew,source,external_ref,updated_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)
      ON CONFLICT(uid) DO UPDATE SET plan=excluded.plan, product=excluded.product, status=excluded.status, starts_at=excluded.starts_at,
        expires_at=excluded.expires_at, will_renew=excluded.will_renew, source=excluded.source, updated_at=excluded.updated_at`,
    uid, pick.plan, pick.product ?? null, pick.status, pick.starts_at ?? null, pick.expires_at ?? null, pick.will_renew ?? null, pick.source, now).run();
  return resolve(pick, now);
}
/* a reward session verified by a network (mock / AdMob): single use per transaction */
async function applyRewardVerification(env, now, providerId, nonce, txn) {
  const s = await q(env, "SELECT * FROM reward_sessions WHERE nonce=?", nonce).first();
  if (!s) return err(404, "unknown_nonce");
  if (s.verified_at) return s.provider_txn === txn ? json({ ok: true, again: true }) : err(409, "already_verified");
  if (s.expires_at <= now) return err(410, "expired");
  try {
    const u = await q(env, "UPDATE reward_sessions SET verified_at=?, provider=?, provider_txn=? WHERE nonce=? AND verified_at IS NULL AND expires_at>?", now, providerId, txn, nonce, now).run();
    if (!changes(u)) return err(409, "already_verified");
  } catch (e) { return err(409, "txn_replay"); }   /* provider_txn is UNIQUE: one watched ad verifies one session */
  return json({ ok: true });
}
const audit = (env, ts, uid, actor, action, r) => q(env,
  "INSERT INTO entitlement_audit(ts,uid,actor,action,plan,status,expires_at) VALUES(?,?,?,?,?,?,?)",
  ts, uid, actor, action, r ? r.plan : null, r ? r.status : null, r ? (r.expires_at ?? null) : null).run();

export async function handle(req, env, deps = {}) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/";
  const now = deps.now ? deps.now() : Date.now();
  const c = cors(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return err(413, "too_large", c);

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
    const links = await q(env, "SELECT count(*) AS n FROM purchase_links WHERE uid=?", uid).first();
    /* the store subscription itself is cancelled in the store, never here —
       this removes what BE Mastery holds about the account */
    await q(env, "DELETE FROM entitlements WHERE uid=?", uid).run();
    await q(env, "DELETE FROM purchase_links WHERE uid=?", uid).run();
    await q(env, "DELETE FROM app_accounts WHERE uid=?", uid).run();
    const erased = !!had || ((links && links.n) || 0) > 0;
    if (erased) await audit(env, now, uid, "self-erase", "erase", null);
    return json({ ok: true, erased }, 200, c);
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
    await bindLink(env, rec.uid, { provider: "manual", ext_id: "grant:" + rec.uid, record: rec });
    await audit(env, now, rec.uid, "admin", "grant", rec);
    return json({ ok: true, view: await recompute(env, rec.uid, now) });
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
  if (ver && ver[1] === "admob") {
    if (req.method !== "GET") return err(405, "method");
    if (!admob.configured(env)) return err(501, "not_configured");
    const r = await admob.verifySsv(url, deps);
    if (!r.ok) return json({ error: "invalid", why: r.why }, 400);
    return applyRewardVerification(env, now, "admob", r.nonce, r.txn);
  }
  if (ver && req.method === "POST") {
    const v = REWARD_VERIFIERS[ver[1]];
    if (!v || (v.id === "mock" && !v.configured(env))) return err(404, "not_found");   /* the mock does not exist outside dev/test */
    if (!v.configured(env)) return err(501, "not_configured");
    const r = await v.verify(req, env, deps);
    if (!r.ok) return json({ error: "invalid", why: r.why }, 400);
    return applyRewardVerification(env, now, v.id, r.nonce, r.txn);
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

  /* ------------------------------------------------ purchases (Phase 9) */
  if (path === "/v1/purchases/account-token" && req.method === "GET") {
    const uid = await authUid(req, env, deps); if (!uid) return err(401, "auth", c);
    if (!BILLING_PROVIDERS.app_store.configured(env)) return err(501, "not_configured", c);
    if (await rateLimited(env, uid, now, PURCHASE_PER_MIN)) return err(429, "rate", c);
    const token = await appAccountToken(uid, env);
    await q(env, "INSERT OR IGNORE INTO app_accounts(token,uid,created_at) VALUES(?,?,?)", token, uid, now).run();
    return json({ appAccountToken: token }, 200, c);
  }
  if ((path === "/v1/purchases/verify" || path === "/v1/purchases/restore") && req.method === "POST") {
    const uid = await authUid(req, env, deps); if (!uid) return err(401, "auth", c);
    if (await rateLimited(env, uid, now, PURCHASE_PER_MIN)) return err(429, "rate", c);
    let body; try { body = await req.json(); } catch (e) { return err(400, "json", c); }
    const p = BILLING_PROVIDERS[String((body && body.provider) || "")];
    if (!p) return err(400, "provider", c);
    if (!p.configured(env)) return err(501, "not_configured", c);
    const restore = path.endsWith("/restore");
    const items = restore ? (Array.isArray(body.items) ? body.items.slice(0, 20) : []) : [body];
    if (!items.length) return err(400, "items", c);
    const ctx = { uid, env, deps, now }, results = [];
    for (const it of items) {
      const v = await p.verifyPurchase(it || {}, ctx);
      if (!v.ok) { results.push({ ok: false, why: v.why, status: v.status }); continue; }
      for (const l of v.links) {
        const b = await bindLink(env, uid, l);
        if (!b.ok) { results.push({ ok: false, why: "bound_elsewhere", status: 409 }); continue; }
        if (l.supersedes) await q(env, "UPDATE purchase_links SET status='expired', secret_ref=NULL, updated_at=? WHERE provider=? AND ext_id=? AND uid=?", now, l.provider, l.supersedes, uid).run();
        if (p.afterBind) await p.afterBind(l, ctx);
        await audit(env, now, uid, "provider:" + p.id, restore ? "restore" : "verify", l.record);
        results.push({ ok: true });
      }
    }
    const view = await recompute(env, uid, now);
    if (!restore && !results[0].ok) return json({ error: results[0].why, view: { ...view, checkedAt: now } }, results[0].status || 400, c);
    /* results name no purchase ids — only whether each item bound */
    return json({ ok: true, results, view: { ...view, checkedAt: now } }, 200, c);
  }
  const bill = /^\/v1\/billing\/([a-z_]{1,32})$/.exec(path);
  if (bill && req.method === "POST") {
    const p = BILLING_PROVIDERS[bill[1]];
    if (!p) return err(404, "not_found");
    if (!p.configured(env)) return err(501, "not_configured");
    const n = await p.notification(req, { env, deps, now });
    if (!n.ok) return err(n.status || 400, n.why || "invalid");
    /* at-most-once per notification: the store retries, and may deliver twice */
    const first = await q(env, "INSERT OR IGNORE INTO processed_notifications(id,provider,received_at) VALUES(?,?,?)", n.id, p.id, now).run();
    if (!changes(first)) return json({ ok: true, duplicate: true });
    try {
      const touched = new Set();
      for (const u of n.updates) {
        const row = await q(env, "SELECT uid FROM purchase_links WHERE provider=? AND ext_id=?", u.provider, u.ext_id).first();
        let uid = row && row.uid;
        if (!uid && u.bindByAccountToken) {                       /* first sight of an Apple purchase: the appAccountToken names its account */
          const a = await q(env, "SELECT uid FROM app_accounts WHERE token=?", String(u.bindByAccountToken).toLowerCase()).first();
          uid = a && a.uid;
        }
        if (!uid) continue;                                        /* a purchase no account has bound yet: nothing to change */
        if (u.revoke) await q(env, "UPDATE purchase_links SET status='revoked', will_renew=0, secret_ref=NULL, updated_at=? WHERE provider=? AND ext_id=?", now, u.provider, u.ext_id).run();
        else if (!(await bindLink(env, uid, u)).ok) continue;
        /* a bound purchase still unacknowledged (the verify's acknowledge failed):
           this notification is a second chance before Play's 3-day refund */
        else if (p.afterBind) await p.afterBind(u, { env, deps, now });
        await audit(env, now, uid, "provider:" + p.id, u.revoke ? "revoke" : "notification", u.revoke ? { status: "revoked" } : u.record);
        touched.add(uid);
      }
      for (const uid of touched) await recompute(env, uid, now);
    } catch (e) {
      await q(env, "DELETE FROM processed_notifications WHERE id=?", n.id).run();   /* let the store retry */
      throw e;
    }
    return json({ ok: true });
  }

  return err(404, "not_found", c);
}

export default {
  async fetch(req, env, ctx) {
    try { return await handle(req, env); }
    catch (e) { console.error("entitlements", String(e && e.message || e).slice(0, 200)); return err(500, "server"); }
  },
};
