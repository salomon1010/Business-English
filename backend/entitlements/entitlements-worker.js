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
import { resolve, validateRecord } from "./src/entitlement-core.js";
import { ADAPTERS } from "./src/adapters.js";
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
