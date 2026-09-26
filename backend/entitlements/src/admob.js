/* AdMob rewarded-ad server-side verification (SSV) — Phase 9.

   When a learner finishes a rewarded ad, AdMob calls OUR callback URL, server
   to server, with a signed query string:
     ?ad_network=…&ad_unit=…&custom_data=<our nonce>&key_id=…&reward_amount=…
      &reward_item=…&timestamp=…&transaction_id=…&user_id=…&signature=…&key_id=…
   The signature (ECDSA P-256 / SHA-256, DER, base64url) covers everything
   before "&signature=". The public keys are published by Google at
   VERIFIER_KEYS (key_id → PEM); they rotate, so they are fetched and cached.
   custom_data carries the nonce from /v1/rewards/start (bound to one learner
   and one kind); transaction_id is the replay guard (UNIQUE in D1).

   Configuration: ADMOB_SSV_ENABLED="1" once the rewarded ad unit's SSV
   callback points at this Worker. Nothing else is secret — verification uses
   Google's public keys. */
import { b64d, enc, pemToDer, derSigToRaw } from "./crypto-util.js";

const VERIFIER_KEYS = "https://www.gstatic.com/admob/reward/verifier-keys.json";
let keyCache = { at: 0, keys: null };

export const configured = env => env.ADMOB_SSV_ENABLED === "1";

/* returns { ok, nonce, txn } or { ok:false, why } */
export async function verifySsv(url, deps = {}) {
  const now = deps.now ? deps.now() : Date.now(), f = deps.fetch || fetch;
  const qs = url.search.replace(/^\?/, "");
  const at = qs.indexOf("&signature=");
  if (at < 0) return { ok: false, why: "unsigned" };
  const message = qs.slice(0, at);
  const p = url.searchParams;
  const sig = p.get("signature"), keyId = p.get("key_id"), nonce = p.get("custom_data") || "", txn = p.get("transaction_id") || "";
  if (!sig || !keyId) return { ok: false, why: "unsigned" };
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[A-Za-z0-9_-]{8,128}$/.test(txn)) return { ok: false, why: "shape" };
  let keys = deps.admobKeys || (keyCache.keys && now - keyCache.at < 6 * 3_600_000 ? keyCache.keys : null);
  if (!keys) { const r = await f(VERIFIER_KEYS); if (!r.ok) return { ok: false, why: "keys" }; keys = (await r.json()).keys || []; keyCache = { at: now, keys }; }
  const k = keys.find(x => String(x.keyId) === String(keyId));
  if (!k || !k.pem) return { ok: false, why: "key_id" };
  const key = await crypto.subtle.importKey("spki", pemToDer(k.pem), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  let raw; try { raw = derSigToRaw(b64d(sig), 32); } catch (e) { return { ok: false, why: "signature" }; }
  const good = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, enc.encode(message));
  if (!good) return { ok: false, why: "signature" };
  /* a stale callback is refused (AdMob timestamps in ms) */
  const ts = Number(p.get("timestamp")); if (Number.isFinite(ts) && Math.abs(now - ts) > 24 * 3_600_000) return { ok: false, why: "stale" };
  return { ok: true, nonce, txn };
}
