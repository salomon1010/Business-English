/* be-polish — the `ytai` account requirement, and nothing else.
   Run: node backend/test-ytai-auth.mjs

   WHY THIS EXISTS. `ytai` is the only route in this Worker that spends real
   money per call (Gemini transcription of a pasted video, ~$0.08 for 15
   minutes), and it was reachable with no account at all — held only by a
   per-IP brake that a changed network defeats. It now requires a verified
   Firebase ID token. It is still FREE: `ROUTE_CAP.ytai` is null, so no plan or
   capability is ever required of it, and no other route gained a requirement.
   (Server-side Premium enforcement DOES now exist in this Worker for the paid
   routes — premiumGate / ROUTE_CAP, off in production until PREMIUM_ENFORCED is
   set. ytai is deliberately outside it; checks 8 and 9 are what hold that.)

   The tokens here are REAL RS256, signed with a generated keypair and served
   through a stubbed JWKS, so the verifier under test is the imported one —
   not a fake that always says yes. Gemini is stubbed: no key, no cost. */
import { webcrypto } from "node:crypto";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 220)}`); };

const kp = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = await webcrypto.subtle.exportKey("jwk", kp.publicKey);
jwk.kid = "testkid"; jwk.alg = "RS256"; jwk.use = "sig";
const b64u = b => Buffer.from(b).toString("base64url");
const PROJECT = "be-mastery";
async function mint({ sub = "uid-1", project = PROJECT, exp = Math.floor(Date.now() / 1e3) + 3600, iat = Math.floor(Date.now() / 1e3) - 10, kid = "testkid", alg = "RS256" } = {}) {
  const h = b64u(JSON.stringify({ alg, kid }));
  const pl = b64u(JSON.stringify({ sub, aud: project, iss: "https://securetoken.google.com/" + project, iat, exp }));
  const sig = await webcrypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, kp.privateKey, new TextEncoder().encode(h + "." + pl));
  return h + "." + pl + "." + b64u(sig);
}

/* the provider, stubbed in Gemini's own answer shape so a call that gets past
   the gate really succeeds (200) rather than failing to parse (502) */
const ai = { calls: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("/jwk/securetoken")) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  /* the entitlement service, for the one check that runs with enforcement ON:
     a genuinely FREE plan, so ytai being allowed cannot be an accident of a
     503 or an unparsed answer */
  if (u.includes("/v1/entitlement")) return new Response(JSON.stringify({
    plan: "free", paid: false, state: "none", ads: true,
    capabilities: { ad_free: false, ai_analysis: false, advanced_progress: false, ai_coach: false, recommended_content: false } }), { status: 200 });
  ai.calls.push(u);
  if (u.includes("generativelanguage")) return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ cues: [{ ts: "0:01", txt: "hello there" }] }) }] } }] }), { status: 200 });
  return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
};
const W = (await import(new URL("./polish-worker.js", import.meta.url))).default;
const ENV = { OPENAI_KEY: "k", GEMINI_KEY: "g", FIREBASE_PROJECT_ID: PROJECT };
let ipN = 0;
const ytai = (token, { env = ENV, ip = null, vid = "abcdefghijk", win = true } = {}) =>
  W.fetch(new Request("https://be-polish.test/", { method: "POST",
    headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip || "10.0.0." + (++ipN), ...(token ? { authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(win ? { ytai: vid, from: 0, to: 60 } : { ytai: vid }) }), env);
const body = async r => { try { return await r.json() } catch (e) { return null } };

console.log("\n# anonymous");
ai.calls = [];
{ const r = await ytai(null);
  ok("1 · no token → 401 auth_required", r.status === 401 && (await body(r)).error === "auth_required", r.status);
  ok("2 · …and ZERO provider calls: nothing was generated for an anonymous caller", ai.calls.length === 0, String(ai.calls.length)); }

console.log("\n# a token that is not an account");
{ const bad = {
    "malformed (not three parts)": "not.a-token",
    "garbage signature": "eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3RraWQifQ.eyJzdWIiOiJ4In0.nope",
    "alg=none": "eyJhbGciOiJub25lIiwia2lkIjoidGVzdGtpZCJ9.eyJzdWIiOiJ4In0.",
    "unknown signing key": await mint({ kid: "not-a-real-kid" }),
    "wrong Firebase project": await mint({ project: "someone-elses-project" }),
    "expired": await mint({ exp: Math.floor(Date.now() / 1e3) - 60 }),
    "issued in the future": await mint({ iat: Math.floor(Date.now() / 1e3) + 4000 }),
  };
  ai.calls = [];
  const got = {};
  for (const [name, tk] of Object.entries(bad)) got[name] = (await ytai(tk)).status;
  ok("3 · every one is 401 — malformed, garbage signature, alg=none, unknown key, wrong project, expired, future iat",
    Object.values(got).every(s => s === 401), JSON.stringify(got));
  ok("4 · …and not one of them reached the provider", ai.calls.length === 0, String(ai.calls.length)); }

console.log("\n# a real account");
{ ai.calls = [];
  const r = await ytai(await mint({ sub: "uid-free" }));
  ok("5 · a verified account is allowed", r.status === 200, r.status);
  ok("6 · …and the route still works: the provider was called once", ai.calls.length === 1, String(ai.calls.length));
  const j = await body(r);
  ok("7 · …and real cues came back", !!(j && j.cues && j.cues.length), JSON.stringify(j && Object.keys(j))); }

console.log("\n# the route is FREE — ytai is authenticated, never paid");
/* RE-SCOPED 2 Oct 2026, at the integration of the Premium line.
   These two checks used to assert that this WORKER contained no entitlement
   gate anywhere — true when ytai shipped, because server-side Premium did not
   exist yet. It does now (premiumGate / ROUTE_CAP, off in production until
   PREMIUM_ENFORCED is set), so the old wording would fail for the right
   reason and nothing would be left guarding the thing that actually matters.
   What matters, and what is asserted instead, is unchanged and narrower:
   `ytai` itself must carry NO capability, so an account is the whole
   requirement and a learner on any plan can transcribe. Nothing was weakened —
   the behavioural half (9) is new, and 8 now pins the one line that decides it. */
{ const raw = (await import("node:fs")).readFileSync(new URL("./polish-worker.js", import.meta.url), "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /* the one line that makes ytai free of plan: a capability name here would
     turn "needs an account" into "needs a subscription" */
  const cap = /ROUTE_CAP\s*=\s*\{[\s\S]*?\n\};/.exec(code);
  const ytaiCap = cap && /\bytai\s*:\s*null\b/.test(cap[0]);
  ok("8 · ytai carries NO capability — ROUTE_CAP.ytai is null, so an account is the whole requirement", !!ytaiCap, cap ? (/\bytai\s*:[^,\n]*/.exec(cap[0]) || ["(no ytai entry)"])[0] : "(no ROUTE_CAP)");
  ok("8b · and no welding/plan-specific branch was added to the ytai handler", !/ytai[\s\S]{0,400}?premium_required/.test(code));
  /* behavioural: a verified account gets the transcript, never a payment wall,
     with enforcement ON and the entitlement service reporting a FREE plan */
  const r402 = await ytai(await mint({ sub: "uid-free-402" }), { env: { ...ENV, PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test" } });
  ok("9 · with enforcement ON and a Free plan, an authenticated ytai call is not refused for payment", r402.status !== 402, String(r402.status));
  ok("9b · the only identity code is the shared verifier, used once", (code.match(/verifyIdToken/g) || []).length === 2, JSON.stringify((code.match(/verifyIdToken/g) || []).length)); }

console.log("\n# the cache is BEHIND the gate, not in front of it");
{ const store = new Map();
  globalThis.caches = { default: {
    async match(k) { const t = store.get(String(k.url)); return t === undefined ? undefined : new Response(t, { headers: { "content-type": "application/json" } }); },
    async put(k, v) { store.set(String(k.url), await v.text()); } } };
  ai.calls = [];
  const warm = await ytai(await mint({ sub: "uid-warm" }), { vid: "cachedvid00" });
  ok("10 · a video is transcribed once and kept", warm.status === 200 && ai.calls.length === 1, warm.status + " provider=" + ai.calls.length);
  const anon = await ytai(null, { vid: "cachedvid00" });
  ok("11 · an ANONYMOUS caller is still 401 for that same kept video", anon.status === 401, anon.status);
  const other = await ytai(await mint({ sub: "uid-other" }), { vid: "cachedvid00" });
  ok("12 · …while another signed-in learner is served the kept answer, free, with no second provider call",
    other.status === 200 && (await body(other)).cached === true && ai.calls.length === 1, "provider=" + ai.calls.length);
  delete globalThis.caches; }

console.log("\n# the per-IP brake that was already here still works");
{ ai.calls = [];
  const out = [];
  for (let i = 0; i < 4; i++) out.push((await ytai(await mint({ sub: "uid-ip" + i }), { ip: "7.7.7.7", win: false })).status);
  ok("13 · YTAI_PER_MIN 2 per IP still refuses the 3rd and 4th, across different accounts", out.filter(s => s === 429).length === 2 && out.slice(0, 2).every(s => s === 200), JSON.stringify(out)); }

console.log("\n# fails CLOSED on a configuration gap");
{ const r = await ytai(await mint(), { env: { OPENAI_KEY: "k", GEMINI_KEY: "g" } });
  ok("14 · FIREBASE_PROJECT_ID missing → 503, never an open route", r.status === 503 && (await body(r)).error === "auth_unavailable", r.status); }

console.log("\n# NO OTHER ROUTE gained a requirement");
{ const noTok = async (b, ct = "application/json") => (await W.fetch(new Request("https://be-polish.test/", { method: "POST",
    headers: { origin: "https://app.lomonec.com", "content-type": ct, "CF-Connecting-IP": "8.8.8." + (++ipN) },
    body: ct.startsWith("audio/") ? new Uint8Array(2048) : JSON.stringify(b) }), ENV)).status;
  const got = {
    transcribe: await noTok(null, "audio/webm"),
    chat: await noTok({ chat: { system: "s", messages: [{ role: "user", content: "hi" }] } }),
    tts: await noTok({ tts: "a" }),
    captions: await noTok({ captions: "abcdefghijk" }),
    polish: await noTok({ text: "we should of done it" }),
  };
  ok("15 · every other route still answers WITHOUT a token — only ytai changed", Object.values(got).every(s => s !== 401 && s !== 503), JSON.stringify(got)); }

console.log("\n# the preflight the signed-in browser needs");
{ const r = await W.fetch(new Request("https://be-polish.test/", { method: "OPTIONS",
    headers: { origin: "https://app.lomonec.com", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,authorization" } }), ENV);
  const h = r.headers.get("Access-Control-Allow-Headers") || "";
  ok("16 · the preflight names `authorization`, so a signed-in call is not refused by the browser", /authorization/i.test(h), h);
  ok("17 · …and still names content-type", /content-type/i.test(h), h); }

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
