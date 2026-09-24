/* Billing / subscription adapters — the only code that knows a provider.

   Provider event ─► adapter.normalize() ─► RECORD ─► entitlement-core ─► VIEW

   Every adapter returns the same RECORD shape (see entitlement-core's
   validateRecord). Provider identifiers (purchase tokens, original
   transaction ids, customer ids) go into `external_ref`, which is stored for
   reconciliation and support and is NEVER returned to a client.

   Phase 7 ships no live provider. `google_play` and `app_store` are declared
   so the route, the storage and the tests exist, but `configured()` is false
   until Phase 9 adds real server-side verification (Play Developer API
   purchase verification + RTDN; App Store Server API + signed notifications
   v2). An unconfigured adapter answers 501 and writes nothing. */
import { PRODUCTS, PLANS, SOURCES } from "./entitlement-core.js";

const clampMs = v => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : NaN);

/* manual / promotional grants — the owner's tool (support, promotions, testers).
   Reached only through the admin route, which requires the ADMIN_TOKEN secret. */
const manual = {
  id: "manual",
  configured: env => typeof env.ADMIN_TOKEN === "string" && env.ADMIN_TOKEN.length >= 32,
  normalize(body, nowMs) {
    const b = body || {};
    const product = b.product == null ? null : String(b.product);
    const plan = product ? PRODUCTS[product] : String(b.plan || "");
    const source = b.source == null ? "manual" : String(b.source);
    return {
      uid: String(b.uid || ""),
      plan,
      product,
      status: String(b.status || "active"),
      starts_at: clampMs(b.startsAt) ?? nowMs,
      expires_at: clampMs(b.expiresAt),
      source: (source === "promo" || source === "manual") ? source : "invalid-source",
      external_ref: b.note == null ? null : String(b.note).slice(0, 200),   // free text for the owner; never returned
      updated_at: nowMs,
    };
  },
};

const notConfigured = id => ({
  id,
  configured: () => false,
  normalize() { throw Object.assign(new Error("not_configured"), { code: "not_configured" }); },
});

export const ADAPTERS = Object.freeze({
  manual,
  google_play: notConfigured("google_play"),
  app_store: notConfigured("app_store"),
});

/* guards the table against a provider id sneaking into the app-facing source */
export const sourceIsKnown = s => SOURCES.includes(s);
export const planIsKnown = p => Object.prototype.hasOwnProperty.call(PLANS, p);

/* ---- rewarded-ad verifiers: the ad network tells the SERVER an ad bound to a
   nonce was watched. The client never reports its own completion.
   `mock` exists for local development and tests only (env MOCK_REWARDS="1",
   never set in production). `admob` / `play` / `app_store` come in Phase 9:
   AdMob server-side verification (SSV) signs its callback with Google's
   ECDSA keys; the transaction id is the replay guard. */
export const REWARD_VERIFIERS = Object.freeze({
  mock: {
    id: "mock",
    configured: env => env.MOCK_REWARDS === "1",
    async verify(req) {
      let b; try { b = await req.json(); } catch (e) { return { ok: false, why: "json" }; }
      const nonce = String(b.nonce || ""), txn = String(b.txn || "");
      if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[A-Za-z0-9_-]{8,64}$/.test(txn)) return { ok: false, why: "shape" };
      return { ok: true, nonce, txn };
    },
  },
  admob: { id: "admob", configured: () => false, async verify() { return { ok: false, why: "not_configured" }; } },
});
