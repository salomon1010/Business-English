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
     PLAY_PACKAGE          com.bemastery.app
     RTDN_AUDIENCE         the push subscription's audience
     RTDN_SA_EMAIL         the push subscription's service-account email */
import { signRs256Jwt, verifyRs256Jwt, b64d, dec } from "./crypto-util.js";
import { PRODUCTS } from "./entitlement-core.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/";
const GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export const configured = env => {
  if (!env.PLAY_PACKAGE || !env.GOOGLE_SA_JSON) return false;
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

export async function getSubscription(env, purchaseToken, deps = {}) {
  const f = deps.fetch || fetch, tok = await accessToken(env, deps);
  const r = await f(API + encodeURIComponent(env.PLAY_PACKAGE) + "/purchases/subscriptionsv2/tokens/" + encodeURIComponent(purchaseToken), { headers: { authorization: "Bearer " + tok } });
  if (r.status === 404 || r.status === 410) return null;                   /* not a purchase of this app */
  if (!r.ok) throw Object.assign(new Error("google_api"), { code: "google_api", status: r.status });
  return r.json();
}
export async function acknowledge(env, productId, purchaseToken, deps = {}) {
  const f = deps.fetch || fetch, tok = await accessToken(env, deps);
  const r = await f(API + encodeURIComponent(env.PLAY_PACKAGE) + "/purchases/subscriptions/" + encodeURIComponent(productId) + "/tokens/" + encodeURIComponent(purchaseToken) + ":acknowledge",
    { method: "POST", headers: { authorization: "Bearer " + tok, "content-type": "application/json" }, body: "{}" });
  return r.ok;
}

/* Play's subscriptionState → our status. CANCELED means auto-renew was turned
   off: the paid period still runs to expiryTime. PENDING / PAUSED / ON_HOLD
   are not paid for now: no Premium. */
const STATE = {
  SUBSCRIPTION_STATE_ACTIVE: "active",
  SUBSCRIPTION_STATE_CANCELED: "active",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace",
  SUBSCRIPTION_STATE_ON_HOLD: "expired",
  SUBSCRIPTION_STATE_PAUSED: "expired",
  SUBSCRIPTION_STATE_EXPIRED: "expired",
  SUBSCRIPTION_STATE_PENDING: "expired",
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
  if (data.packageName !== env.PLAY_PACKAGE) throw new Error("package");
  return { data, messageId: String((body.message && (body.message.messageId || body.message.message_id)) || "") };
}
