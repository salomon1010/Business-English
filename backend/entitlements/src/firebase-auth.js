/* Firebase Auth ID-token verification for Cloudflare Workers (RS256 / JWKS).

   The same checks as backend/partner/partner-worker.js verifyIdToken — kept
   as a module here so the entitlement Worker does not import the partner
   Worker (whose kill switch and General-English track gate have nothing to do
   with billing). The partner Worker keeps its own copy for now; moving it onto
   this module is a separate, behaviour-neutral change for that Worker.

   Identity is the token's `sub` (the Firebase uid) and nothing else: no
   request field, query parameter or header can name a different user. */
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwksCache = { at: 0, keys: null };
async function fetchJwks(fetcher, force) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const r = await fetcher(JWKS_URL); if (!r.ok) throw new Error("jwks " + r.status);
  const j = await r.json(); jwksCache = { at: Date.now(), keys: j.keys || [] }; return jwksCache.keys;
}
const b64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };

/* deps.keys (a JWKS key list) and deps.now exist for tests only; a request
   can never supply them — the Worker passes deps from its own module scope. */
export async function verifyIdToken(token, projectId, deps = {}) {
  const fetcher = deps.fetch || fetch, nowMs = deps.now || Date.now();
  if (!projectId) throw new Error("project");
  const parts = String(token || "").split("."); if (parts.length !== 3) throw new Error("malformed");
  let header, payload;
  try { header = JSON.parse(new TextDecoder().decode(b64u(parts[0]))); payload = JSON.parse(new TextDecoder().decode(b64u(parts[1]))); }
  catch (e) { throw new Error("malformed"); }
  if (header.alg !== "RS256" || !header.kid) throw new Error("alg");
  let keys = deps.keys || await fetchJwks(fetcher); let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk && !deps.keys && nowMs - jwksCache.at > 60_000) { keys = await fetchJwks(fetcher, true); jwk = keys.find(k => k.kid === header.kid); }
  if (!jwk) throw new Error("kid");
  if (jwk.kty !== "RSA" || (jwk.alg && jwk.alg !== "RS256")) throw new Error("alg");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("signature");
  const sec = Math.floor(nowMs / 1000);
  if (payload.aud !== projectId) throw new Error("aud");
  if (payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("iss");
  if (!(payload.exp > sec)) throw new Error("expired");
  if (!(payload.iat <= sec + 300)) throw new Error("iat");
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) throw new Error("sub");
  return payload.sub;
}
