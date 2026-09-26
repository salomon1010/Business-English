/* Store-token vault — Phase 11.

   A Google Play purchase token is the one store secret the server keeps: with
   our service account it can re-check or acknowledge a purchase without the
   app. It is kept ONLY sealed:

     purchase_links.secret_ref = "v1." + base64url(iv) + "." + base64url(AES-256-GCM(token))

   - The key is the Worker secret PLAY_TOKEN_KEY (32 random bytes, base64).
     Worker secrets cannot be read back from Cloudflare, so a D1 export, a Time
     Travel restore or anyone with database access sees ciphertext only.
   - The row's identity (provider:ext_id) is the GCM associated data: a sealed
     value copied onto another purchase's row does not open.
   - No key configured → seal() returns null and NOTHING is stored. Plaintext
     is never written; billing keeps working, because every re-check the app or
     Play starts brings the token with it.
   - Rotation: a new key simply fails to open old values (open() → null); the
     next verify, restore or notification for that purchase re-seals it.

   Never log, return or put a token in an error. */
import { enc, dec, b64d, b64ue } from "./crypto-util.js";

const VERSION = "v1";
async function key(env, use) {
  const raw = String(env.PLAY_TOKEN_KEY || "");
  let bytes; try { bytes = b64d(raw); } catch (e) { return null; }
  if (bytes.length !== 32) return null;
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [use]);
}
export const vaultConfigured = async env => !!(await key(env, "encrypt"));

/* token → sealed string, or null (no key: store nothing) */
export async function seal(token, env, rowId) {
  if (!token) return null;
  const k = await key(env, "encrypt"); if (!k) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(rowId) }, k, enc.encode(token)));
  return VERSION + "." + b64ue(iv) + "." + b64ue(ct);
}

/* sealed string → token, or null (no key, another key, another row, tampered) */
export async function open(sealed, env, rowId) {
  const m = /^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(sealed || "")); if (!m) return null;
  const k = await key(env, "decrypt"); if (!k) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(m[1]), additionalData: enc.encode(rowId) }, k, b64d(m[2]));
    return dec.decode(pt);
  } catch (e) { return null; }
}
