/* App Store (StoreKit 2) — server side (Phase 9).

   The iOS app is a Capacitor shell; a StoreKit plugin (native, added in
   Xcode — not buildable on the development Mac) returns Apple's SIGNED
   TRANSACTION, a JWS. Apple also posts App Store Server Notifications V2 to
   this Worker as a signed JWS. Both are verified here, with no call to Apple:

     JWS header x5c = [leaf, intermediate, root] (DER, base64)
       root          sha-256 of its DER must be one of APPLE_ROOT_SHA256
       intermediate  signed by root, carries Apple's intermediate marker OID
       leaf          signed by intermediate, carries Apple's receipt-signing OID
       all three     inside their validity window now
     then the JWS signature (ES256) with the leaf's key.

   A purchase is bound to a BE Mastery account by appAccountToken: a UUID the
   app obtains from GET /v1/purchases/account-token and passes to StoreKit;
   it is an HMAC of the uid, so it cannot be guessed or moved to another
   account, and the Worker keeps token → uid to route notifications.

   Configuration (Worker secrets / vars):
     APPLE_BUNDLE_ID       com.lomonec.bemastery
     APPLE_ROOT_SHA256     comma-separated SHA-256 fingerprints of the Apple
                           root(s) to trust — Apple Root CA - G3 in production.
                           Deliberately NOT hard-coded: the owner copies it from
                           https://www.apple.com/certificateauthority/ and checks it.
     APPLE_ENVIRONMENTS    "Production" (add ",Sandbox" for TestFlight / review)
     APP_ACCOUNT_SECRET    >= 32 random characters (HMAC key for appAccountToken) */
import { b64d, dec, enc, hex, parseCert, certSignedBy, ecKeyFromCert, sha256Hex } from "./crypto-util.js";
import { PRODUCTS } from "./entitlement-core.js";

const APPLE_INTERMEDIATE_OID = "1.2.840.113635.100.6.2.1";
const APPLE_LEAF_OID = "1.2.840.113635.100.6.11.1";

export const configured = env => !!(env.APPLE_BUNDLE_ID && env.APPLE_ROOT_SHA256 && typeof env.APP_ACCOUNT_SECRET === "string" && env.APP_ACCOUNT_SECRET.length >= 32);

/* verify an Apple-signed JWS; returns its decoded payload or throws */
export async function verifyJws(jws, env, nowMs) {
  const parts = String(jws || "").split("."); if (parts.length !== 3) throw new Error("malformed");
  let h; try { h = JSON.parse(dec.decode(b64d(parts[0]))); } catch (e) { throw new Error("malformed"); }
  if (h.alg !== "ES256" || !Array.isArray(h.x5c) || h.x5c.length < 3) throw new Error("header");
  const [leaf, inter, root] = h.x5c.slice(0, 3).map(s => parseCert(b64d(s)));
  const pins = String(env.APPLE_ROOT_SHA256 || "").toLowerCase().split(",").map(s => s.trim().replace(/:/g, "")).filter(Boolean);
  if (!pins.includes(await sha256Hex(root.der))) throw new Error("root");
  for (const c of [leaf, inter, root]) if (!(c.notBefore <= nowMs && nowMs <= c.notAfter)) throw new Error("validity");
  if (!inter.extOids.includes(APPLE_INTERMEDIATE_OID)) throw new Error("intermediate_oid");
  if (!leaf.extOids.includes(APPLE_LEAF_OID)) throw new Error("leaf_oid");
  if (!await certSignedBy(inter, root)) throw new Error("chain");
  if (!await certSignedBy(leaf, inter)) throw new Error("chain");
  const { key, size } = await ecKeyFromCert(leaf);
  if (size !== 32) throw new Error("leaf_curve");
  if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64d(parts[2]), enc.encode(parts[0] + "." + parts[1]))) throw new Error("signature");
  try { return JSON.parse(dec.decode(b64d(parts[1]))); } catch (e) { throw new Error("payload"); }
}

/* the account's appAccountToken: HMAC-SHA256(secret, uid) shaped as a UUID v4 */
export async function appAccountToken(uid, env) {
  const key = await crypto.subtle.importKey("raw", enc.encode(env.APP_ACCOUNT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode("be-mastery:" + uid))).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const x = hex(b); return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/* the App Store environments this Worker accepts ("Production", or "Sandbox"
   for staging / TestFlight / review) */
export const environments = env => String(env.APPLE_ENVIRONMENTS || "Production").split(",").map(s => s.trim()).filter(Boolean);

/* a verified JWSTransactionDecodedPayload (+ optional renewal info) → RECORD fields.
   Returns null for a transaction that is not ours, or { ignore } for one that is
   ours but must not change anything:
     upgraded  — the learner moved up (monthly → annual) inside the group; the
                 plan now lives in the NEW transaction, which shares this one's
                 originalTransactionId, so applying the old one would undo it. */
export function toRecord(tx, renewal, env, nowMs) {
  if (!tx || typeof tx !== "object") return null;
  if (tx.bundleId !== env.APPLE_BUNDLE_ID) return null;
  if (!environments(env).includes(tx.environment)) return null;
  if (tx.isUpgraded === true) return { ignore: "upgraded" };
  if (!Object.prototype.hasOwnProperty.call(PRODUCTS, tx.productId)) return null;
  const exp = Number(tx.expiresDate); if (!Number.isFinite(exp)) return null;
  let status = "active", expires = exp;
  if (tx.revocationDate) status = "revoked";
  else if (exp <= nowMs) {
    const g = renewal && Number(renewal.gracePeriodExpiresDate);
    if (Number.isFinite(g) && g > nowMs) { status = "grace"; expires = g; } else status = "expired";
  }
  if (tx.offerType === 1 && status === "active") status = "trialing";       /* introductory offer */
  const start = Number(tx.purchaseDate);
  return {
    plan: PRODUCTS[tx.productId], product: tx.productId, status,
    starts_at: Number.isFinite(start) ? Math.min(start, expires - 1) : null, expires_at: expires,
    source: "app_store", updated_at: nowMs,
    /* a UUID: compared lower-case everywhere (ours are minted lower-case) */
    appAccountToken: tx.appAccountToken ? String(tx.appAccountToken).toLowerCase() : null, originalTransactionId: String(tx.originalTransactionId || ""),
    txExpires: exp,   /* the transaction's own expiry (expires_at can be a grace end) */
  };
}
