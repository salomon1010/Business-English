/* Google Play Billing — server side (Phase 9).

   The Android app is a Trusted Web Activity: the purchase happens in Chrome
   through the Digital Goods API + Payment Request (Play Billing), and the
   page receives a PURCHASE TOKEN. The token proves nothing by itself; this
   file asks Google about it:

     purchase token ─► androidpublisher v3 purchases.subscriptionsv2.get
                    ─► subscriptionState + line item (product, expiry)
                    ─► RECORD for entitlement-core
     not yet acknowledged ─► acknowledge (Play refunds after 3 days otherwise)

   Real-time Developer Notifications arrive as Pub/Sub PUSH requests signed
   with a Google OIDC token; verifyRtdn() checks it (audience + service-account
   email) before anything is read. A notification never carries the state
   itself that we trust — it only says "look this token up again".

   Configuration (Worker secrets / vars; nothing in source):
     GOOGLE_SA_JSON        service-account key JSON (client_email, private_key)
     PLAY_PACKAGE          com.bemastery.app[,com.lomonec.bemastery.welding]

   THE TWO-APP SPLIT (12 Oct 2026). BE Mastery is two Play listings now —
   General English and Welding English — and ONE account-level entitlement, so
   PLAY_PACKAGE is an allow-list. A purchase token names no package, so a token
   is simply looked up against each allowed package in turn: Google answers 404
   for the ones it does not belong to, which is the same answer it already gave
   for a token that is not ours, so nothing is loosened. The package a token
   DID resolve for travels with the record, because acknowledge() must use that
   same one. A single-value PLAY_PACKAGE behaves exactly as before.
     RTDN_AUDIENCE         the push subscription's audience
     RTDN_SA_EMAIL         the push subscription's service-account email */
import { signRs256Jwt, verifyRs256Jwt, b64d, dec } from "./crypto-util.js";
import { PRODUCTS } from "./entitlement-core.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/";
const GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

/* the allowed Play listings, in order; a single value is the old behaviour */
export const packages = env => String(env.PLAY_PACKAGE || "").split(",").map(x => x.trim()).filter(Boolean);

export const configured = env => {
  if (!packages(env).length || !env.GOOGLE_SA_JSON) return false;
  try { const j = JSON.parse(env.GOOGLE_SA_JSON); return !!(j.client_email && j.private_key); } catch (e) { return false; }
};

let tokenCache = { key: "", at: 0, token: "", exp: 0 };
async function accessToken(env, deps) {
  const now = deps.now ? deps.now() : Date.now(), f = deps.fetch || fetch;
  const sa = JSON.parse(env.GOOGLE_SA_JSON);
  if (tokenCache.key === sa.client_email && tokenCache.exp - 60_000 > now) return tokenCache.token;
  const iat = Math.floor(now / 1000);
  const assertion = await signRs256Jwt({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }, sa.private_key, sa.private_key_id);
  const r = await f(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + encodeURIComponent(assertion) });
  if (!r.ok) throw Object.assign(new Error("google_auth"), { code: "google_auth", status: r.status });
  const j = await r.json();
  tokenCache = { key: sa.client_email, token: j.access_token, exp: now + (Number(j.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}
export const _resetTokenCache = () => { tokenCache = { key: "", at: 0, token: "", exp: 0 }; };

/* One package. `pkg` is always an allow-listed value chosen by the caller. */
async function getFor(env, pkg, purchaseToken, deps) {
  const f = deps.fetch || fetch, tok = await accessToken(env, deps);
  const r = await f(API + encodeURIComponent(pkg) + "/purchases/subscriptionsv2/tokens/" + encodeURIComponent(purchaseToken), { headers: { authorization: "Bearer " + tok } });
  if (r.status === 404 || r.status === 410) return null;                   /* not a purchase of THIS listing */
  if (!r.ok) throw Object.assign(new Error("google_api"), { code: "google_api", status: r.status });
  return r.json();
}
/* Ask every allowed listing. Returns the subscription with the package it came
   from, or null if no listing knows the token. `prefer` (the package an RTDN
   named) is tried first so the usual case is one request. */
export async function getSubscriptionWithPackage(env, purchaseToken, deps = {}, prefer = null) {
  const list = packages(env);
  const order = prefer && list.includes(prefer) ? [prefer, ...list.filter(p => p !== prefer)] : list;
  let apiError = null;
  for (const pkg of order) {
    let sub; try { sub = await getFor(env, pkg, purchaseToken, deps); } catch (e) { apiError = e; continue; }
    if (sub) return { sub, pkg };
  }
  if (apiError) throw apiError;        /* every listing errored: a real outage, not "unknown token" */
  return null;
}
/* Kept for callers that only need the resource (and for the existing tests). */
export async function getSubscription(env, purchaseToken, deps = {}) {
  const hit = await getSubscriptionWithPackage(env, purchaseToken, deps);
  return hit ? hit.sub : null;
}
export async function acknowledge(env, productId, purchaseToken, deps = {}, pkg = null) {
  const list = packages(env);
  const use = pkg && list.includes(pkg) ? pkg : list[0];
  const f = deps.fetch || fetch, tok = await accessToken(env, deps);
  const r = await f(API + encodeURIComponent(use) + "/purchases/subscriptions/" + encodeURIComponent(productId) + "/tokens/" + encodeURIComponent(purchaseToken) + ":acknowledge",
    { method: "POST", headers: { authorization: "Bearer " + tok, "content-type": "application/json" }, body: "{}" });
  return r.ok;
}

/* Play's subscriptionState → our status. CANCELED means auto-renew was turned
   off: the paid period still runs to expiryTime. PAUSED / ON_HOLD are not paid
   for now: no Premium. PENDING (a slow payment method) is its own status so the
   app can say "payment pending" rather than "ended". */
const STATE = {
  SUBSCRIPTION_STATE_ACTIVE: "active",
  SUBSCRIPTION_STATE_CANCELED: "active",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace",
  SUBSCRIPTION_STATE_ON_HOLD: "expired",
  SUBSCRIPTION_STATE_PAUSED: "expired",
  SUBSCRIPTION_STATE_EXPIRED: "expired",
  SUBSCRIPTION_STATE_PENDING: "payment_pending",   /* not paid yet: no Premium, and never acknowledged (Play refuses an ack before payment) */
};
/* subscriptionsv2 resource → RECORD fields (uid added by the caller) */
export function toRecord(sub, nowMs) {
  if (!sub || typeof sub !== "object") return null;
  const li = (sub.lineItems || []).slice().sort((a, b) => Date.parse(b.expiryTime || 0) - Date.parse(a.expiryTime || 0))[0];
  if (!li || !Object.prototype.hasOwnProperty.call(PRODUCTS, li.productId)) return null;
  const exp = Date.parse(li.expiryTime); if (!Number.isFinite(exp)) return null;
  const status = STATE[sub.subscriptionState] || "expired";
  const start = Date.parse(sub.startTime);
  return {
    plan: PRODUCTS[li.productId], product: li.productId, status,
    starts_at: Number.isFinite(start) ? Math.min(start, exp - 1) : null, expires_at: exp,
    source: "google_play", updated_at: nowMs,
    acknowledged: sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    linked: sub.linkedPurchaseToken || null, test: !!sub.testPurchase,
    /* the account the app named at purchase time (BillingFlowParams.setObfuscatedAccountId
       = our appAccountToken, the same HMAC(uid) StoreKit carries) — absent on older purchases */
    accountId: (sub.externalAccountIdentifiers && sub.externalAccountIdentifiers.obfuscatedExternalAccountId)
      ? String(sub.externalAccountIdentifiers.obfuscatedExternalAccountId).toLowerCase() : null,
  };
}

/* RTDN: a Pub/Sub push with a Google-signed OIDC token. Returns the decoded
   developer notification or throws. */
let certCache = { at: 0, keys: null };
export async function verifyRtdn(req, env, deps = {}) {
  const now = deps.now ? deps.now() : Date.now(), f = deps.fetch || fetch;
  if (!env.RTDN_AUDIENCE || !env.RTDN_SA_EMAIL) throw new Error("rtdn_not_configured");
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || ""); if (!m) throw new Error("auth");
  let keys = deps.googleKeys || (certCache.keys && now - certCache.at < 3_600_000 ? certCache.keys : null);
  if (!keys) { const r = await f(GOOGLE_CERTS); if (!r.ok) throw new Error("certs"); keys = (await r.json()).keys || []; certCache = { at: now, keys }; }
  const p = await verifyRs256Jwt(m[1], keys, now);
  if (p.iss !== "https://accounts.google.com" && p.iss !== "accounts.google.com") throw new Error("iss");
  if (p.aud !== env.RTDN_AUDIENCE) throw new Error("aud");
  if (p.email !== env.RTDN_SA_EMAIL || p.email_verified !== true) throw new Error("email");
  const body = await req.json();
  const data = JSON.parse(dec.decode(b64d(body && body.message && body.message.data || "")));
  if (!packages(env).includes(data.packageName)) throw new Error("package");   /* either listing, never a third */
  return { data, messageId: String((body.message && (body.message.messageId || body.message.message_id)) || "") };
}
