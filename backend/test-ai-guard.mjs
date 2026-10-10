/* AI cost control (ai-guard.js) — docs/AI-COST-CONTROL.md
   Run: node backend/test-ai-guard.mjs
   The Durable Object is the REAL class in rate-limit.js behind a faithful
   in-process namespace (one store per id, blockConcurrencyWhile as a mutex), the
   tokens are real RS256 tokens checked by the imported Firebase verifier, and the
   providers are stubbed — nothing here costs money. Both Workers are tested: the
   repo's polish-worker.js and the production package (polish-prod/entry.js,
   assembled exactly as build.sh assembles it). */
import { webcrypto } from "node:crypto";
import { mkdtempSync, cpSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RateLimiter as RL, consume, release } from "./rate-limit.js";
import * as G from "./ai-guard.js";

const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 260)}`); };

/* ---- the platform stand-in: a Durable Object namespace ---- */
function makeNamespace() {
  const objs = new Map();
  return {
    _objs: objs,
    idFromName: name => ({ name }),
    get(id) { let o = objs.get(id.name); if (!o) { o = stub(); objs.set(id.name, o); } return o; },
  };
  function stub() {
    const map = new Map(); let alarm = null, chain = Promise.resolve(), inst = null;
    const storage = {
      async get(k) { if (Array.isArray(k)) { const m = new Map(); for (const x of k) if (map.has(x)) m.set(x, map.get(x)); return m; } return map.get(k); },
      async put(o) { for (const k of Object.keys(o)) map.set(k, o[k]); },
      async list({ prefix } = {}) { const m = new Map(); for (const [k, v] of map) if (!prefix || k.startsWith(prefix)) m.set(k, v); return m; },
      async delete(k) { for (const x of (Array.isArray(k) ? k : [k])) map.delete(x); },
      async deleteAll() { map.clear(); }, async getAlarm() { return alarm; }, async setAlarm(t) { alarm = t; },
    };
    const state = { storage, blockConcurrencyWhile(fn) { const p = chain.then(() => fn()); chain = p.then(() => {}, () => {}); return p; } };
    return { _map: map, async fetch(url, init) { if (!inst) inst = new RL(state, {}); return inst.fetch(new Request(url, init)); } };
  }
}
const count = (ns, subject, name) => { const o = ns._objs.get(subject); const v = o && o._map.get("b:" + name); return v ? v.count : 0; };

/* ---- identity: real tokens, the real verifier ---- */
const kp = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = await webcrypto.subtle.exportKey("jwk", kp.publicKey); jwk.kid = "k1"; jwk.alg = "RS256"; jwk.use = "sig";
const b64u = b => Buffer.from(b).toString("base64url");
const PROJECT = "be-mastery";
async function mint(sub) {
  const now = Math.floor(Date.now() / 1e3);
  const h = b64u(JSON.stringify({ alg: "RS256", kid: "k1" })), pl = b64u(JSON.stringify({ sub, aud: PROJECT, iss: "https://securetoken.google.com/" + PROJECT, iat: now - 10, exp: now + 3600 }));
  const sig = await webcrypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, kp.privateKey, new TextEncoder().encode(h + "." + pl));
  return h + "." + pl + "." + b64u(sig);
}
const subOf = tok => { try { return JSON.parse(Buffer.from(String(tok).split(".")[1], "base64url").toString()).sub; } catch { return null; } };

/* ---- the providers, stubbed; `mode` lets a test make them fail or hang ---- */
const P = { calls: 0, mode: "ok", delay: 0 };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("/jwk/securetoken")) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  if (u.includes("/v1/entitlement")) {
    const tok = String((init.headers && (init.headers.authorization || init.headers.Authorization)) || "").slice(7);
    const sub = subOf(tok); if (!sub) return new Response("{}", { status: 401 });
    const prem = sub.startsWith("prem");
    const caps = { ad_free: prem, ai_analysis: prem, advanced_progress: prem, ai_coach: prem, recommended_content: prem };
    return new Response(JSON.stringify({ plan: prem ? "premium" : "free", paid: prem, capabilities: caps }), { status: 200 });
  }
  P.calls++;
  if (P.mode === "hang") return new Promise((_, rej) => { if (init.signal) init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))); });
  if (P.delay) await new Promise(r => setTimeout(r, P.delay));
  if (P.mode === "fail") return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500, headers: { "content-type": "application/json" } });
  if (P.mode === "gemini401" && u.includes("generativelanguage")) return new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401, headers: { "content-type": "application/json" } });
  if (u.includes("/audio/transcriptions")) return new Response(JSON.stringify({ text: "hello there", words: [], duration: 12.5 }), { status: 200, headers: { "content-type": "application/json" } });
  if (u.includes("/audio/speech")) return new Response(new Uint8Array(64), { status: 200, headers: { "content-type": "audio/mpeg" } });
  if (u.includes("generativelanguage")) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ cues: [{ ts: "0:01", txt: "hi" }] }) }] } }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 80 } }), { status: 200, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: "ok", versions: [{ label: "a", text: "Clear version." }] }) } }], usage: { prompt_tokens: 1200, completion_tokens: 300 } }), { status: 200, headers: { "content-type": "application/json" } });
};

const W = (await import(new URL("./polish-worker.js?guard=1", import.meta.url))).default;
const ledger = () => { const rows = []; return { rows, writeDataPoint: r => rows.push(r) }; };
function env(extra = {}) { return { OPENAI_KEY: "k", GEMINI_KEY: "g", FIREBASE_PROJECT_ID: PROJECT, RATE_LIMITER: makeNamespace(), ...extra }; }
const ENF = { PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test" };
async function call(Wk, e, body, { ip = "1.1.1.1", token = null, ctype = "application/json", raw = null } = {}) {
  const headers = { origin: "https://app.lomonec.com", "content-type": ctype, "CF-Connecting-IP": ip };
  if (token) headers.authorization = "Bearer " + token;
  const r = await Wk.fetch(new Request("https://be-polish.test/", { method: "POST", headers, body: raw != null ? raw : JSON.stringify(body) }), e);
  let j = null; try { j = await r.clone().json(); } catch {}
  return { status: r.status, j, h: r.headers };
}
const chat = (purpose = "practice", text = "Hello there") => ({ chat: { purpose, system: "You are a helpful partner.", messages: [{ role: "user", content: text }] } });
const analyse = (t = "I think we should ship the release on Monday morning") => ({ analyse: { transcript: t, metrics: { seconds: 30 }, lang: "en", context: { track: "general" } } });

console.log("\n# A. the module: routes, measures, estimates, policy");
{
  ok("A1 · routeOf mirrors the Worker's dispatch", G.routeOf("audio/webm", null) === "transcribe" && G.routeOf("application/json", chat("coach")) === "chat:coach"
    && G.routeOf("", chat("weird")) === "chat:practice" && G.routeOf("", { mvreport: {} }) === "mvreport" && G.routeOf("", { tts: "hi" }) === "tts"
    && G.routeOf("", { assess: "x", audio: "AAAA" }) === "assess" && G.routeOf("", analyse()) === "analyse" && G.routeOf("", { repolish: {} }) === "repolish"
    && G.routeOf("", { text: "x" }) === "polish" && G.routeOf("", { ytai: "dQw4w9WgXcQ" }) === "ytai" && G.routeOf("", { wm: { op: "status" } }) === "wm" && G.routeOf("", { captions: "abc" }) === "captions");
  const big = { chat: { system: "x".repeat(9000), messages: Array.from({ length: 80 }, () => ({ role: "user", content: "y".repeat(5000) })) } };
  ok("A2 · measure() caps input exactly as the Worker slices it (4000 + 40×2000)", G.measure("chat:practice", big, 0).inChars === 4000 + 40 * 2000);
  ok("A3 · transcription is measured in seconds, capped at 30 minutes", Math.abs(G.measure("transcribe", null, 40_000).audioSec - 10) < 1e-9 && G.measure("transcribe", null, 1e12).audioSec === 1800);
  ok("A4 · every billable route has a positive pre-call estimate", ["transcribe", "chat:practice", "chat:coach", "mvreport", "analyse", "repolish", "polish", "tts", "assess"].every(r => G.preCostUsd(r, { inChars: 400, audioSec: 10, ttsChars: 100 }) > 0));
  ok("A5 · ANON_AI_POLICY: only report / enforce switch it on; anything else is off", G.anonPolicy({}) === "off" && G.anonPolicy({ ANON_AI_POLICY: "ENFORCE" }) === "enforce" && G.anonPolicy({ ANON_AI_POLICY: "report" }) === "report" && G.anonPolicy({ ANON_AI_POLICY: "yes" }) === "off");
  ok("A6 · every price row says it is unverified (no invented certainty)", Object.values(G.PRICES).every(p => p.verified === false));
}

console.log("\n# B. release: atomic, floor at zero, live windows only");
{
  const ns = makeNamespace(), e = { RATE_LIMITER: ns }, B = [{ name: "q:day", limit: 5, windowMs: 86_400_000 }];
  for (let i = 0; i < 3; i++) await consume(e, "s", B);
  await release(e, "s", [{ name: "q:day" }]);
  ok("B1 · consume ×3 then release ×1 leaves 2", count(ns, "s", "q:day") === 2);
  for (let i = 0; i < 5; i++) await release(e, "s", [{ name: "q:day" }]);
  ok("B2 · releasing more than was taken stops at 0", count(ns, "s", "q:day") === 0);
  ns.get({ name: "s" })._map.set("b:q:day", { count: 4, resetAt: Date.now() - 1 });
  await release(e, "s", [{ name: "q:day" }]);
  ok("B3 · an expired window is not touched", count(ns, "s", "q:day") === 4);
  const ns2 = makeNamespace(), e2 = { RATE_LIMITER: ns2 }, C = [{ name: "c:day", limit: 1000, windowMs: 86_400_000 }];
  await Promise.all([...Array.from({ length: 30 }, () => consume(e2, "p", C)), ...Array.from({ length: 10 }, () => release(e2, "p", [{ name: "c:day" }]))]);
  const n = count(ns2, "p", "c:day");
  ok("B4 · 30 consumes racing 10 releases end between 20 and 30, never lost or negative", n >= 20 && n <= 30, n);
}

console.log("\n# C. policy OFF (the default everywhere): nothing changes for anyone");
{
  const e = env(); P.calls = 0;
  let s200 = 0; for (let i = 0; i < 45; i++) if ((await call(W, e, chat("practice", "line " + i), { ip: "5.5." + i + ".1" })).status === 200) s200++;
  ok("C1 · 45 anonymous practice chats all answered, as today", s200 === 45, s200);
  ok("C2 · and no anonymous allowance or pool was even created", ![...e.RATE_LIMITER._objs.keys()].some(k => k === "global:anon-ai") && count(e.RATE_LIMITER, "ip:1.1.1.1", "anon:chat:" + new Date().toISOString().slice(0, 10)) === 0);
}

console.log("\n# D. policy ENFORCE, enforcement off (production's shape)");
const DAY = new Date().toISOString().slice(0, 10);
{
  const e = env({ ANON_AI_POLICY: "enforce", ANON_AI_VERDICT_PER_DAY: "3" });
  const r = []; for (let i = 0; i < 4; i++) r.push(await call(W, e, analyse("We should ship the release on Monday number " + i)));
  ok("D1 · a visitor gets 3 AI verdicts a day per IP, the 4th is refused", r.slice(0, 3).every(x => x.status === 200) && r[3].status === 429, r.map(x => x.status));
  ok("D2 · the refusal is the allowance shape, scope anon, and asks for sign-in", r[3].j && r[3].j.error === "allowance" && r[3].j.scope === "anon" && r[3].j.reason === "ip" && r[3].j.signIn === true && +r[3].h.get("Retry-After") > 0, JSON.stringify(r[3].j));
  const tok = await mint("uid-signed-in");
  const s = []; for (let i = 0; i < 2; i++) s.push((await call(W, e, analyse("A signed in learner says number " + i), { token: tok })).status);
  ok("D3 · a VERIFIED signed-in learner on the same IP is not held by the visitor allowance", s.every(x => x === 200), s);
  ok("D4 · a forged 'Bearer junk' header is a visitor, not an account", (await call(W, e, analyse("forged token attempt number one"), { token: "junk" })).status === 429);
  ok("D5 · another IP has its own allowance", (await call(W, e, analyse("another address entirely here today"), { ip: "2.2.2.2" })).status === 200);
  ok("D6 · Shadow's reading helper keeps its own rules (not held by this policy)", (await call(W, e, chat("shadow"), { ip: "1.1.1.1" })).status === 200);
}
{
  /* the global pool: $0.001 = 10 units, so a few requests from DIFFERENT addresses exhaust it */
  const e = env({ ANON_AI_POLICY: "enforce", ANON_AI_POOL_USD: "0.0004" });
  const st = []; for (let i = 0; i < 6; i++) st.push(await call(W, e, chat("practice", "pool " + i), { ip: "9.9.9." + i }));
  const firstNo = st.findIndex(x => x.status === 429);
  ok("D7 · the global pool binds across addresses: fresh IPs cannot buy more than the day's budget", firstNo > 0 && st[firstNo].j.reason === "pool", st.map(x => x.status + (x.j && x.j.reason ? ":" + x.j.reason : "")));
  ok("D8 · a pool refusal gives the per-IP unit back (that address spent nothing)", count(e.RATE_LIMITER, "ip:9.9.9." + firstNo, "anon:chat:" + DAY) === 0);
}
{
  const e = env({ ANON_AI_POLICY: "enforce", ANON_AI_TTS_PER_DAY: "2" });
  const a = [await call(W, e, { tts: "one" }), await call(W, e, { tts: "two" }), await call(W, e, { tts: "three" })];
  e.ANON_AI_POLICY = "off";
  const b = await call(W, e, { tts: "four" });
  ok("D9 · rollback: setting ANON_AI_POLICY=off lets the refused visitor straight back in", a[2].status === 429 && b.status === 200, [a.map(x => x.status), b.status]);
}

console.log("\n# E. policy REPORT: counts, records, refuses nothing");
{
  const L = ledger(), e = env({ ANON_AI_POLICY: "report", ANON_AI_VERDICT_PER_DAY: "1", AI_LEDGER: L });
  const r = [await call(W, e, analyse("report mode first call here")), await call(W, e, analyse("report mode second call here"))];
  ok("E1 · past the allowance the visitor is still answered", r.every(x => x.status === 200), r.map(x => x.status));
  ok("E2 · …and the ledger says it WOULD have been refused", L.rows.length === 2 && L.rows[1].blobs[5] === "anon_would_refuse_ip" && L.rows[0].blobs[5] === "ok", JSON.stringify(L.rows.map(x => x.blobs[5])));
}

console.log("\n# F. Free account: 3 verdicts a day, refunds on error, atomic under load");
{
  const e = env(ENF), tok = await mint("uid-free-1");
  const bad = []; for (let i = 0; i < 4; i++) bad.push((await call(W, e, { analyse: { transcript: "too short" } }, { token: tok })).status);
  ok("F1 · four requests refused by validation (400) …", bad.every(s => s === 400), bad);
  const good = []; for (let i = 0; i < 4; i++) good.push(await call(W, e, analyse("Valid speech for the report number " + i), { token: tok, ip: "6.6." + i + ".1" }));
  ok("F2 · …cost nothing: 3 valid verdicts still pass and the 4th is the daily limit", good.slice(0, 3).every(x => x.status === 200) && good[3].status === 429 && good[3].j.scope === "verdicts", good.map(x => x.status));
  ok("F3 · the limit response is the existing allowance contract (used = limit = 3, plan free)", good[3].j.limit === 3 && good[3].j.used === 3 && good[3].j.plan === "free");
}
{
  const e = env(ENF), tok = await mint("uid-free-2");
  P.mode = "fail"; const f = await call(W, e, analyse("The provider will fail on this one"), { token: tok }); P.mode = "ok";
  const after = JSON.parse((await call(W, e, analyse("And now it works again fine"), { token: tok })).h.get("X-BE-Allowance") || "{}");
  ok("F4 · a provider failure (502) gives the verdict back: the next success reads used 1 of 3", f.status === 502 && after.used === 1 && after.limit === 3, [f.status, JSON.stringify(after)]);
}
{
  const e = env(ENF), tok = await mint("uid-free-3");
  const out = await Promise.all(Array.from({ length: 10 }, (_, i) => call(W, e, analyse("Parallel request with distinct words " + i), { token: tok })));
  ok("F5 · 10 simultaneous verdict requests: exactly 3 succeed (the count is atomic)", out.filter(x => x.status === 200).length === 3 && out.filter(x => x.status === 429).length === 7, out.map(x => x.status));
}
{
  const e = env({ ...ENF, AI_TIMEOUT_MS: "150" }), L = ledger(); e.AI_LEDGER = L;
  const tok = await mint("uid-free-4");
  P.mode = "hang"; const t = await call(W, e, analyse("This call will hang until the timeout"), { token: tok }); P.mode = "ok";
  const after = JSON.parse((await call(W, e, analyse("A normal call after the timeout"), { token: tok })).h.get("X-BE-Allowance") || "{}");
  ok("F6 · a provider that hangs is cut off by the timeout (502) …", t.status === 502 && /timeout/.test(t.j && t.j.detail || ""), JSON.stringify(t.j));
  ok("F7 · …refunded (used 1 after), and recorded as provider_timeout", after.used === 1 && L.rows[0].blobs[5] === "provider_timeout" && L.rows[0].blobs[9] === "refunded", [after.used, L.rows[0] && L.rows[0].blobs]);
}
{
  const e = env(ENF), tok = await mint("uid-free-5");
  const big = await call(W, e, null, { token: tok, raw: JSON.stringify({ assess: "hello", audio: "A".repeat(7 * 1024 * 1024) }) });
  const after = JSON.parse((await call(W, e, analyse("Normal speech after an oversized clip"), { token: tok })).h.get("X-BE-Allowance") || "{}");
  ok("F8 · an oversized assess clip is 413 and costs no verdict", big.status === 413 && after.used === 1, [big.status, after.used]);
}

console.log("\n# G. Premium: the entitlement service decides, never the client");
{
  const e = env(ENF);
  const p = await call(W, e, analyse("A premium learner speaks here now"), { token: await mint("prem-1") });
  ok("G1 · a verified Premium account gets the Premium allowance (limit 120)", p.status === 200 && JSON.parse(p.h.get("X-BE-Allowance")).limit === 120 && JSON.parse(p.h.get("X-BE-Allowance")).plan === "premium");
  const f = await call(W, e, { ...analyse("I claim to be premium in the body"), isPremium: true, plan: "premium" }, { token: await mint("uid-free-claims") });
  ok("G2 · a Free account that SAYS it is Premium in the body still gets 3", JSON.parse(f.h.get("X-BE-Allowance")).limit === 3);
  ok("G3 · no token with enforcement on → 401 (an account is required)", (await call(W, e, analyse("No token at all here"))).status === 401);
}

console.log("\n# H. one identical request in flight (AI_DEDUPE=1)");
{
  const e = env({ ...ENF, AI_DEDUPE: "1" }), tok = await mint("uid-free-dup");
  P.delay = 120;
  const [a, b] = await Promise.all([call(W, e, analyse("Exactly the same request twice"), { token: tok }), call(W, e, analyse("Exactly the same request twice"), { token: tok })]);
  P.delay = 0;
  const st = [a.status, b.status].sort();
  ok("H1 · two identical simultaneous requests: one answered, one 409 duplicate_in_flight", st[0] === 200 && st[1] === 409 && [a, b].some(x => x.j && x.j.error === "duplicate_in_flight"), st);
  const after = JSON.parse((await call(W, e, analyse("A different request afterwards"), { token: tok })).h.get("X-BE-Allowance") || "{}");
  ok("H2 · the duplicate spent no verdict (used 2 after one success + this one)", after.used === 2, after.used);
  ok("H3 · the lock is freed once the first finishes: the same request again is answered", (await call(W, e, analyse("Exactly the same request twice"), { token: tok })).status === 200);
  const e2 = env(ENF), t2 = await mint("uid-free-nodup"); P.delay = 80;
  const both = await Promise.all([call(W, e2, analyse("Same again without the guard"), { token: t2 }), call(W, e2, analyse("Same again without the guard"), { token: t2 })]); P.delay = 0;
  ok("H4 · without AI_DEDUPE nothing new is refused (opt-in)", both.every(x => x.status === 200), both.map(x => x.status));
}

console.log("\n# I. the ledger: units, estimate, privacy");
{
  const L = ledger(), e = env({ ...ENF, AI_LEDGER: L, LEDGER_SALT: "s3cret-salt" });
  const tok = await mint("uid-ledger"), secret = "MY_PRIVATE_WORDS_" + Date.now();
  await call(W, e, analyse("I said " + secret + " in my practice minute today"), { token: tok, ip: "7.7.7.7" });
  const row = L.rows[0], C = G.LEDGER_COLUMNS, b = k => row.blobs[C.blobs.indexOf(k)], d = k => row.doubles[C.doubles.indexOf(k)];
  ok("I1 · one row: route, declared track, plan, provider, model, outcome", row && b("route") === "analyse" && b("track_declared") === "general" && b("state") === "free" && b("provider") === "openai" && b("model") === "gpt-4.1-mini" && b("outcome") === "ok", JSON.stringify(row && row.blobs));
  ok("I2 · the provider's own token usage, and the verdict charged", d("prompt_tokens") === 1200 && d("completion_tokens") === 300 && d("verdicts_charged") === 1, JSON.stringify(row.doubles));
  ok("I3 · an estimated cost with its method (provider-usage)", d("est_usd_micro") > 0 && b("cost_method") === "provider-usage");
  const flat = JSON.stringify(row);
  ok("I4 · no transcript, token, uid or IP in the row", !flat.includes(secret) && !flat.includes(tok.slice(0, 20)) && !flat.includes("uid-ledger") && !flat.includes("7.7.7.7"));
  ok("I5 · the caller is a 16-hex HMAC under LEDGER_SALT", /^[0-9a-f]{16}$/.test(b("caller_hmac")));
  const L2 = ledger(), e2 = env({ AI_LEDGER: L2 });
  await call(W, e2, null, { ctype: "audio/webm", raw: new Uint8Array(4000) });
  ok("I6 · without a salt no caller id is recorded at all; Whisper's billed duration is kept", L2.rows[0].blobs[6] === "" && L2.rows[0].doubles[3] === 12.5, JSON.stringify(L2.rows[0]));
  ok("I7 · a non-billable route (wm, captions) writes no row", (await (async () => { const L3 = ledger(); await call(W, env({ AI_LEDGER: L3 }), { captions: "dQw4w9WgXcQ" }); return L3.rows.length === 0; })()));
}

console.log("\n# J. security fix: a Gemini key error tells the caller nothing about the key");
{
  const e = env(); P.mode = "gemini401";
  const r = await call(W, e, { ytai: "dQw4w9WgXcQ" }, { token: await mint("uid-yt") }); P.mode = "ok";
  ok("J1 · 502 without keyLen / keyFp", r.status === 502 && r.j && !("keyLen" in r.j) && !("keyFp" in r.j), JSON.stringify(r.j));
}

console.log("\n# K. the production package (polish-prod/entry.js, as build.sh assembles it)");
{
  const dir = mkdtempSync(join(tmpdir(), "polish-prod-test-"));
  for (const f of ["polish-prod/entry.js", "polish-prod/deployed.js", "wm-game.js", "rate-limit.js", "ai-guard.js"]) cpSync(new URL("./" + f, import.meta.url), join(dir, f.split("/").pop()));
  mkdirSync(join(dir, "entitlements/src"), { recursive: true }); cpSync(new URL("./entitlements/src/firebase-auth.js", import.meta.url), join(dir, "entitlements/src/firebase-auth.js"));
  const PW = (await import(join(dir, "entry.js"))).default;
  const pe = (x = {}) => ({ OPENAI_KEY: "k", FIREBASE_PROJECT_ID: PROJECT, ENTITLEMENTS_URL: "https://ent.test", RATE_LIMITER: makeNamespace(), ...x });
  const e0 = pe(); let n = 0; const seen = [];
  for (let i = 0; i < 25; i++) { const x = await call(PW, e0, analyse("prod dormant request number " + i), { ip: "3.3." + i + ".1" }); seen.push(x.status + ":" + (x.j && x.j.error || "")); if (x.status === 200) n++; }
  ok("K1 · dormant (no config): anonymous calls behave exactly as before (old code's own limits only)", n === 25 && !e0.RATE_LIMITER._objs.has("global:anon-ai"), seen.slice(0, 4).join(","));
  const L = ledger(), e1 = pe({ ANON_AI_POLICY: "enforce", ANON_AI_VERDICT_PER_DAY: "2", AI_LEDGER: L });
  const r = []; for (let i = 0; i < 3; i++) r.push((await call(PW, e1, analyse("prod enforce visitor request " + i), { ip: "4.4.4.4" })).status);
  ok("K2 · enforce: a production visitor is held to the allowance", r[0] === 200 && r[1] === 200 && r[2] === 429, r);
  const s = (await call(PW, e1, analyse("prod signed in learner here"), { ip: "4.4.4.4", token: await mint("uid-prod") })).status;
  ok("K3 · a verified signed-in learner is not", s === 200, s);
  ok("K4 · production rows are labelled request-estimate (the old code's usage is invisible)", L.rows[0] && L.rows[0].blobs[7] === "request-estimate" && L.rows[0].blobs[2] === "visitor", JSON.stringify(L.rows[0] && L.rows[0].blobs));
  const wm = await call(PW, pe({ ANON_AI_POLICY: "enforce" }), { wm: { op: "status", prog: "welding" } });
  ok("K5 · the game route is untouched (still demands an account: 401)", wm.status === 401, wm.status);
}

console.log("\n# L. a refused request never reaches a paid provider");
{
  const providerCalls = async fn => { const n0 = P.calls; const r = await fn(); return { r, n: P.calls - n0 }; };
  const e = env({ ANON_AI_POLICY: "enforce", ANON_AI_VERDICT_PER_DAY: "1" });
  await call(W, e, analyse("the one allowed visitor verdict today"), { ip: "8.8.1.1" });
  const a = await providerCalls(() => call(W, e, analyse("a refused visitor verdict request now"), { ip: "8.8.1.1" }));
  ok("L1 · anonymous allowance refusal (429): zero provider calls", a.r.status === 429 && a.n === 0, [a.r.status, a.n]);
  const e2 = env(ENF), tok = await mint("uid-free-L");
  for (let i = 0; i < 3; i++) await call(W, e2, analyse("spending the three free verdicts " + i), { token: tok, ip: "8.8.2." + i });
  const b = await providerCalls(() => call(W, e2, analyse("the fourth verdict is over the limit"), { token: tok, ip: "8.8.2.9" }));
  ok("L2 · Free verdict limit (429): zero provider calls", b.r.status === 429 && b.n === 0, [b.r.status, b.n]);
  const c = await providerCalls(() => call(W, e2, analyse("no account with enforcement on here"), { ip: "8.8.3.1" }));
  ok("L3 · no account with enforcement on (401): zero provider calls", c.r.status === 401 && c.n === 0, [c.r.status, c.n]);
  const tokL2 = await mint("uid-free-L2");
  const d = await providerCalls(() => call(W, e2, { analyse: { transcript: "too short" } }, { token: tokL2, ip: "8.8.4.1" }));
  ok("L4 · validation refusal (400): zero provider calls", d.r.status === 400 && d.n === 0, [d.r.status, d.n]);
  const e3 = env({ ...ENF, AI_DEDUPE: "1" }), t3 = await mint("uid-free-L3"); P.delay = 100;
  const before = P.calls;
  const both = await Promise.all([call(W, e3, analyse("one identical request sent twice now"), { token: t3 }), call(W, e3, analyse("one identical request sent twice now"), { token: t3 })]); P.delay = 0;
  ok("L5 · duplicate in flight (409): only ONE provider call for the pair", both.some(x => x.status === 409) && P.calls - before === 1, [both.map(x => x.status), P.calls - before]);
}

console.log("\n# M. a failure after the provider may have charged is still costed");
{
  const L = ledger(), e = env({ ...ENF, AI_TIMEOUT_MS: "120", AI_LEDGER: L }), tok = await mint("uid-free-M");
  P.mode = "hang"; await call(W, e, analyse("a request whose provider call times out"), { token: tok }); P.mode = "ok";
  const r = L.rows[0], C = G.LEDGER_COLUMNS;
  ok("M1 · a timed-out call is recorded with an estimated cost, labelled possibly billed", r && r.doubles[C.doubles.indexOf("est_usd_micro")] > 0 && r.blobs[C.blobs.indexOf("cost_method")] === "possibly-billed-estimate", JSON.stringify(r && r.blobs));
  const L2 = ledger(), e2 = env({ ...ENF, AI_LEDGER: L2 });
  P.mode = "fail"; await call(W, e2, analyse("the provider answers five hundred here"), { token: await mint("uid-free-M2") }); P.mode = "ok";
  ok("M2 · a provider that refused (HTTP 500, not billed by the provider) is recorded at $0", L2.rows[0] && L2.rows[0].doubles[C.doubles.indexOf("est_usd_micro")] === 0 && L2.rows[0].blobs[C.blobs.indexOf("outcome")] === "provider_error", JSON.stringify(L2.rows[0]));
}

console.log("\n# N. the production wrapper: report mode, 5xx costing, duplicates");
{
  const dir = mkdtempSync(join(tmpdir(), "polish-prod-test2-"));
  for (const f of ["polish-prod/entry.js", "polish-prod/deployed.js", "wm-game.js", "rate-limit.js", "ai-guard.js"]) cpSync(new URL("./" + f, import.meta.url), join(dir, f.split("/").pop()));
  mkdirSync(join(dir, "entitlements/src"), { recursive: true }); cpSync(new URL("./entitlements/src/firebase-auth.js", import.meta.url), join(dir, "entitlements/src/firebase-auth.js"));
  const PW = (await import(join(dir, "entry.js"))).default;
  const pe = (x = {}) => ({ OPENAI_KEY: "k", FIREBASE_PROJECT_ID: PROJECT, ENTITLEMENTS_URL: "https://ent.test", RATE_LIMITER: makeNamespace(), ...x });
  const L = ledger(), e = pe({ ANON_AI_POLICY: "report", ANON_AI_VERDICT_PER_DAY: "1", AI_LEDGER: L });
  const r = [await call(PW, e, analyse("report mode production visitor first"), { ip: "6.1.1.1" }), await call(PW, e, analyse("report mode production visitor second"), { ip: "6.1.1.1" })];
  ok("N1 · report mode in production: the visitor is still answered past the allowance", r.every(x => x.status === 200), r.map(x => x.status));
  ok("N2 · …and the row says it would have been refused (the evidence the enforce decision needs)", L.rows[1] && L.rows[1].blobs[5] === "anon_would_refuse_ip" && L.rows[1].blobs[2] === "visitor", JSON.stringify(L.rows.map(x => x.blobs.slice(0, 6))));
  const L2 = ledger(), e2 = pe({ AI_LEDGER: L2 });
  P.mode = "fail"; const f = await call(PW, e2, analyse("production old code returns a five hundred"), { ip: "6.2.1.1" }); P.mode = "ok";
  ok("N3 · an opaque 5xx from the old code is costed as possibly billed, not as free", f.status >= 500 && L2.rows[0] && L2.rows[0].blobs[7] === "possibly-billed-estimate" && L2.rows[0].doubles[7] > 0, JSON.stringify(L2.rows[0] && L2.rows[0].blobs));
  const e3 = pe({ ANON_AI_POLICY: "report", AI_DEDUPE: "1" }); P.delay = 100; const n0 = P.calls;
  const both = await Promise.all([call(PW, e3, analyse("duplicate production request sent twice"), { ip: "6.3.1.1" }), call(PW, e3, analyse("duplicate production request sent twice"), { ip: "6.3.1.1" })]); P.delay = 0;
  ok("N4 · production duplicate guard (AI_DEDUPE=1): one answered, one 409, one provider call", both.map(x => x.status).sort().join() === "200,409" && P.calls - n0 === 1, [both.map(x => x.status), P.calls - n0]);
}

globalThis.fetch = realFetch;
const failed = res.filter(x => !x).length;
console.log(`\n${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
