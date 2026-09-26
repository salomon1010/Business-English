/* Crypto helpers for the store adapters — WebCrypto only, so they run in a
   Cloudflare Worker and in Node alike. No third-party library.

   - base64 / base64url
   - RS256 JWT signing (a Google service account asking for an API token)
   - RS256 JWT verification against a JWKS (Google-signed OIDC tokens on
     Pub/Sub pushes — Play's Real-time Developer Notifications)
   - ECDSA DER ⇄ raw (r‖s) signature conversion
   - a minimal X.509 (DER) reader: exactly what App Store JWS verification
     needs — the signed bytes, the signature, the public key, the validity
     window and the extension OIDs. Not a general certificate library. */

export const enc = new TextEncoder(), dec = new TextDecoder();
export const b64d = s => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(s).length / 4) * 4, "=")), c => c.charCodeAt(0));
export const b64e = u8 => btoa(String.fromCharCode(...u8));
export const b64ue = u8 => b64e(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const jsonB64u = o => b64ue(enc.encode(JSON.stringify(o)));
export const pemToDer = pem => b64d(String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
export const hex = u8 => [...u8].map(b => b.toString(16).padStart(2, "0")).join("");
export async function sha256Hex(u8) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", u8))); }

/* ---- RS256 JWT: sign (service account) */
export async function signRs256Jwt(claims, pkcs8Pem, kid) {
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(pkcs8Pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = jsonB64u({ alg: "RS256", typ: "JWT", ...(kid ? { kid } : {}) }), body = jsonB64u(claims);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, enc.encode(head + "." + body)));
  return head + "." + body + "." + b64ue(sig);
}

/* ---- RS256 JWT: verify against a JWKS; returns the payload or throws */
export async function verifyRs256Jwt(token, jwks, nowMs) {
  const parts = String(token || "").split("."); if (parts.length !== 3) throw new Error("malformed");
  let h, p; try { h = JSON.parse(dec.decode(b64d(parts[0]))); p = JSON.parse(dec.decode(b64d(parts[1]))); } catch (e) { throw new Error("malformed"); }
  if (h.alg !== "RS256" || !h.kid) throw new Error("alg");
  const jwk = (jwks || []).find(k => k.kid === h.kid); if (!jwk || jwk.kty !== "RSA") throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, b64d(parts[2]), enc.encode(parts[0] + "." + parts[1]))) throw new Error("signature");
  const sec = Math.floor(nowMs / 1000);
  if (!(p.exp > sec)) throw new Error("expired");
  if (p.iat && p.iat > sec + 300) throw new Error("iat");
  return p;
}

/* ---- ECDSA signatures: X.509 uses DER SEQUENCE{r,s}, WebCrypto wants raw r‖s */
export function derSigToRaw(der, size) {
  const r = readTlv(der, 0); if (r.tag !== 0x30) throw new Error("sig");
  const a = readTlv(der, r.start), b = readTlv(der, a.end);
  const fix = x => { let v = der.slice(x.start, x.end); while (v.length > size && v[0] === 0) v = v.slice(1); if (v.length > size) throw new Error("sig"); const o = new Uint8Array(size); o.set(v, size - v.length); return o; };
  const out = new Uint8Array(size * 2); out.set(fix(a), 0); out.set(fix(b), size); return out;
}

/* ---- DER */
export function readTlv(u8, off) {
  const tag = u8[off]; let len = u8[off + 1], p = off + 2;
  if (len === undefined || tag === undefined) throw new Error("der");
  if (len & 0x80) { const n = len & 0x7f; if (n < 1 || n > 4) throw new Error("der"); len = 0; for (let i = 0; i < n; i++) len = len * 256 + u8[p + i]; p += n; }
  if (p + len > u8.length) throw new Error("der");
  return { tag, start: p, end: p + len, off };
}
const children = (u8, t) => { const out = []; let p = t.start; while (p < t.end) { const c = readTlv(u8, p); out.push(c); p = c.end; } return out; };
export function oid(u8, t) {
  const b = u8.slice(t.start, t.end); const out = [Math.floor(b[0] / 40), b[0] % 40]; let v = 0;
  for (let i = 1; i < b.length; i++) { v = v * 128 + (b[i] & 0x7f); if (!(b[i] & 0x80)) { out.push(v); v = 0; } }
  return out.join(".");
}
function derTime(u8, t) {
  const s = dec.decode(u8.slice(t.start, t.end));
  const m = t.tag === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) throw new Error("time");
  let y = +m[1]; if (t.tag === 0x17) y += y >= 50 ? 1900 : 2000;
  return Date.UTC(y, +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}
export const OID = Object.freeze({ ecPublicKey: "1.2.840.10045.2.1", p256: "1.2.840.10045.3.1.7", p384: "1.3.132.0.34", ecdsaSha256: "1.2.840.10045.4.3.2", ecdsaSha384: "1.2.840.10045.4.3.3" });

/* the parts of a certificate the App Store chain check needs */
export function parseCert(der) {
  const cert = readTlv(der, 0); if (cert.tag !== 0x30) throw new Error("cert");
  const [tbs, algId, sigBits] = children(der, cert);
  if (!tbs || !algId || !sigBits || sigBits.tag !== 0x03) throw new Error("cert");
  const sigAlg = oid(der, children(der, algId)[0]);
  const t = children(der, tbs); let i = 0;
  if (t[0].tag === 0xa0) i++;                                   /* [0] version */
  const validity = t[i + 3], spki = t[i + 5];
  const [nb, na] = children(der, validity);
  const spkiAlg = children(der, children(der, spki)[0]);
  const curve = spkiAlg[1] && spkiAlg[1].tag === 0x06 ? oid(der, spkiAlg[1]) : null;
  const extOids = [];
  const ext = t.find(x => x.tag === 0xa3);
  if (ext) for (const e of children(der, children(der, ext)[0])) { const k = children(der, e)[0]; if (k && k.tag === 0x06) extOids.push(oid(der, k)); }
  return {
    der, tbs: der.slice(tbs.off, tbs.end), sigAlg, sig: der.slice(sigBits.start + 1, sigBits.end),   /* skip the unused-bits byte */
    spki: der.slice(spki.off, spki.end), keyAlg: oid(der, spkiAlg[0]), curve,
    notBefore: derTime(der, nb), notAfter: derTime(der, na), extOids,
  };
}
const CURVE = { [OID.p256]: { name: "P-256", size: 32 }, [OID.p384]: { name: "P-384", size: 48 } };
export async function ecKeyFromCert(c) {
  const cv = CURVE[c.curve]; if (c.keyAlg !== OID.ecPublicKey || !cv) throw new Error("key");
  return { key: await crypto.subtle.importKey("spki", c.spki, { name: "ECDSA", namedCurve: cv.name }, false, ["verify"]), size: cv.size };
}
/* is `child` signed by `parent`? */
export async function certSignedBy(child, parent) {
  const hash = child.sigAlg === OID.ecdsaSha256 ? "SHA-256" : child.sigAlg === OID.ecdsaSha384 ? "SHA-384" : null;
  if (!hash) throw new Error("sigalg");
  const { key, size } = await ecKeyFromCert(parent);
  return crypto.subtle.verify({ name: "ECDSA", hash }, key, derSigToRaw(child.sig, size), child.tbs);
}
