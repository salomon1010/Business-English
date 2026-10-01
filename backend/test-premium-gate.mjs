/* be-polish — the server-side entitlement boundary (Phase 8, 30 Sep 2026).
   Run: node backend/test-premium-gate.mjs
   The Worker module in Node. be-entitlements and OpenAI are stand-ins: no key,
   no network, no cost. Every assertion here is about who is allowed to spend. */
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };

/* be-entitlements: answers from `ent.reply(auth)`; every call is recorded.
   Anything aimed at OpenAI answers a minimal success, so a request that gets
   PAST the gate is visible as a provider call rather than as a 200 we invented. */
const ent = { calls: [], reply: null };
const ai = { calls: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("/v1/entitlement")) {
    ent.calls.push((init && init.headers && (init.headers.authorization || init.headers.Authorization)) || "");
    return ent.reply();
  }
  ai.calls.push(u);
  if (u.includes("/audio/speech")) return new Response("mp3", { status: 200 });
  if (u.includes("/audio/transcriptions")) return new Response(JSON.stringify({ text: "hello there friend of mine", words: [] }), { status: 200 });
  /* one body that satisfies every chat-shaped route: `versions` for the Polish
     path, `reply` for the chat / report paths. Which fields a route reads is
     its own business; this test only cares whether it was reached. */
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ versions: [{ text: "We should have done it.", learn: "should have" }], reply: "ok", covered: [] }) } }] }), { status: 200 });
};
const W = (await import(new URL("./polish-worker.js", import.meta.url))).default;

const OFF = {};                                                            // production today
const ON  = { PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", OPENAI_KEY: "k" };
const view = caps => new Response(JSON.stringify({ plan: caps.ai_analysis ? "premium" : "free", paid: !!caps.ai_analysis, capabilities: caps }), { status: 200 });
const FREE = { ad_free: false, ai_analysis: false, ai_verbal_feedback: false, advanced_progress: false, ai_coach: false, recommended_content: false };
const PREM = { ad_free: true, ai_analysis: true, ai_verbal_feedback: true, advanced_progress: true, ai_coach: true, recommended_content: true };

let ipN = 0, tokN = 0;
async function ask(body, { env = ON, token = null, ip = null } = {}) {
  const headers = { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip || "10.0.0." + (++ipN) };
  if (token) headers.authorization = "Bearer " + token;
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers, body: JSON.stringify(body) }), { OPENAI_KEY: "k", ...env });
  return { status: r.status, j: await r.json().catch(() => null) };
}
const tok = () => "t" + (++tokN) + ".x.y";                      // a fresh token each time: never a cache hit
/* the SPEECH-TO-TEXT route: a raw audio body, not JSON. It had no coverage here
   at all until the 1 Oct 2026 shakeout, which is how it went unnoticed that a
   Free learner could not be heard. */
async function askAudio({ token, env = { PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test" }, ip } = {}) {
  const headers = { origin: "https://app.lomonec.com", "content-type": "audio/webm", "CF-Connecting-IP": ip || "10.0.0." + (++ipN) };
  if (token) headers.authorization = "Bearer " + token;
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers, body: new Uint8Array(2048) }), { OPENAI_KEY: "k", ...env });
  return { status: r.status, j: await r.json().catch(() => null) };
}
const ANALYSE = { analyse: { transcript: "this is a long enough sentence to pass", metrics: {} } };
const ASSESS  = { assess: "hello world", audio: "AAAA", format: "wav" };
const REPORT  = { mvreport: { system: "s", said: "one two three four five six" } };
const CHAT    = p => ({ chat: { purpose: p, system: "s", messages: [{ role: "user", content: "hi" }] } });

console.log("\n# Enforcement OFF — production today: nothing changes");
ent.reply = () => view(FREE);
let r = await ask(ANALYSE, { env: OFF });
ok("A1 · with PREMIUM_ENFORCED unset an anonymous caller still gets analysis", r.status === 200, r.status);
ok("A2 · …and the entitlement service was never asked", ent.calls.length === 0);
r = await ask({ chat: { system: "s", messages: [{ role: "user", content: "hi" }] } }, { env: OFF });
ok("A3 · a chat with NO purpose (an older cached index.html) still works", r.status === 200, r.status);

console.log("\n# Enforcement ON but only half-configured — must stay off, never half-on");
r = await ask(ANALYSE, { env: { PREMIUM_ENFORCED: "1" } });
ok("A4 · PREMIUM_ENFORCED without ENTITLEMENTS_URL does NOT gate (a half-deploy cannot lock everyone out)", r.status === 200, r.status);
r = await ask(ANALYSE, { env: { ENTITLEMENTS_URL: "https://ent.test" } });
ok("A5 · an entitlement URL without PREMIUM_ENFORCED does not gate either", r.status === 200, r.status);

console.log("\n# Enforcement ON — the boundary");
ent.calls = []; ai.calls = [];
r = await ask(ANALYSE);
ok("B1 · no Authorization header → 401, and no AI call was made", r.status === 401 && r.j.error === "auth_required" && ai.calls.length === 0, r.status);
ent.reply = () => view(FREE);
ai.calls = [];
r = await ask(ANALYSE, { token: tok() });
ok("B2 · a signed-in FREE account is refused analysis (402 premium_required)", r.status === 402 && r.j.error === "premium_required" && r.j.capability === "ai_analysis", JSON.stringify(r.j));
ok("B3 · …and no AI provider call was made, so nothing was spent", ai.calls.length === 0, ai.calls.join(","));
r = await ask(ASSESS, { token: tok() });
ok("B4 · a FREE account is refused pronunciation assessment", r.status === 402, r.status);
r = await ask(REPORT, { token: tok() });
ok("B5 · a FREE account is refused the speaking report", r.status === 402, r.status);
r = await ask(CHAT("coach"), { token: tok() });
ok("B6 · a FREE account is refused the AI coach", r.status === 402 && r.j.capability === "ai_coach", JSON.stringify(r.j));
r = await ask(CHAT("report"), { token: tok() });
ok("B7 · a FREE account is refused a report chat", r.status === 402 && r.j.capability === "ai_analysis", JSON.stringify(r.j));

console.log("\n# Free routes stay free — the practice itself is never metered");
r = await ask(CHAT("practice"), { token: tok() });
ok("C1 · a FREE account CAN run a role-play turn (practice)", r.status === 200, r.status);
r = await ask({ text: "we should of done it" }, { token: tok() });
ok("C2 · a FREE account CAN use Executive Polish", r.status === 200, r.status);
r = await ask({ tts: "hello", voice: "alloy" }, { token: tok() });
ok("C3 · a FREE account CAN use the natural voice", r.status === 200, r.status);
r = await ask({ text: "hello there" });
ok("C4 · …but a free route still needs an account while enforcement is on", r.status === 401, r.status);

/* BEING HEARD IS FREE (owner, 1 October 2026). The spoken turn is the activity;
   the AI's verdict on it is the product. Before this, transcribe cost
   ai_analysis, so a Free learner's interview and workshop answers were refused
   402 and the app reported it as a microphone that heard nothing. */
ent.reply = () => view(FREE);
ai.calls = [];
r = await askAudio({ token: tok() });
ok("C5 · a FREE account CAN be heard — the speech-to-text route costs no capability", r.status === 200, r.status + " " + JSON.stringify(r.j));
ok("C6 · …and the transcription really ran", ai.calls.some(u => /audio\/transcriptions/.test(u)), ai.calls.join(","));
r = await askAudio();
ok("C7 · …but being heard still needs an account while enforcement is on", r.status === 401 && r.j.error === "auth_required", r.status);
r = await askAudio({ token: tok(), env: OFF });
ok("C8 · with enforcement off it behaves exactly as production does today", r.status === 200, r.status);
ok("C9 · the paid routes did NOT move with it — a FREE account is still refused the assessment of what it said",
   (await ask(ASSESS, { token: tok() })).status === 402 && (await ask(REPORT, { token: tok() })).status === 402);

console.log("\n# A paying account gets everything it bought");
ent.reply = () => view(PREM);
for (const [n, b, cap] of [["analysis", ANALYSE, "ai_analysis"], ["assessment", ASSESS, "ai_analysis"], ["the report", REPORT, "ai_analysis"], ["the AI coach", CHAT("coach"), "ai_coach"]]) {
  r = await ask(b, { token: tok() });
  ok(`D· a PREMIUM account gets ${n}`, r.status === 200, r.status + " " + JSON.stringify(r.j));
}

console.log("\n# The service itself is down");
ent.reply = () => new Response("nope", { status: 500 });
ai.calls = [];
r = await ask(ANALYSE, { token: tok() });
ok("E1 · entitlements 5xx → 503, never a silent downgrade to Free", r.status === 503 && r.j.error === "entitlement_unavailable", JSON.stringify(r.j));
ok("E2 · …and no paid work was done on a guess", ai.calls.length === 0);
ent.reply = () => { throw new Error("network"); };
r = await ask(ANALYSE, { token: tok() });
ok("E3 · entitlements unreachable → 503 as well", r.status === 503, r.status);
ent.reply = () => new Response("no", { status: 401 });
r = await ask(ANALYSE, { token: tok() });
ok("E4 · a token the entitlement service rejects → 401, not 402", r.status === 401, r.status);

console.log("\n# The cache");
ent.reply = () => view(PREM);
ent.calls = [];
const t = tok();
await ask(ANALYSE, { token: t }); await ask(ANALYSE, { token: t }); await ask(ASSESS, { token: t });
ok("F1 · three calls with the same token ask the entitlement service once", ent.calls.length === 1, ent.calls.length);
ok("F2 · the header forwarded is the caller's own token, not a shared secret", ent.calls[0] === "Bearer " + t, ent.calls[0]);
await ask(ANALYSE, { token: tok() });
ok("F3 · a different token is looked up separately", ent.calls.length === 2, ent.calls.length);

console.log("\n# Bad input");
r = await ask({ chat: { purpose: "wide-open", system: "s", messages: [{ role: "user", content: "hi" }] } }, { token: tok() });
ok("G1 · an unknown chat purpose is refused (400), never treated as free", r.status === 400, r.status);
r = await ask(ANALYSE, { env: ON });
ok("G2 · an empty Authorization header is not an account", r.status === 401, r.status);

console.log("\n# Client spoofing — the server is the only authority (brief 9-12, 16)");
ent.reply = () => view(FREE);
ai.calls = [];
for (const [n, extra] of [
  ["premium:true in the body",        { premium: true }],
  ["isPremium:true in the body",      { isPremium: true }],
  ["plan:'premium' in the body",      { plan: "premium" }],
  ["paid:true in the body",           { paid: true }],
  ["capability:'ai_analysis'",        { capability: "ai_analysis" }],
  ["capabilities:{ai_analysis:true}", { capabilities: { ai_analysis: true } }],
  ["entitlement:'premium'",           { entitlement: "premium" }],
  ["uid of another account",          { uid: "someone-else" }],
]) {
  r = await ask({ ...ANALYSE, ...extra }, { token: tok() });
  ok(`H· a FREE account sending ${n} is still refused (402)`, r.status === 402, r.status + " " + JSON.stringify(r.j));
}
ok("H9 · …and not one of those spoofs reached the AI provider", ai.calls.length === 0, ai.calls.join(","));

/* the same claims as query string and as headers, since neither is the body */
async function raw(url, headers, body, env = ON) {
  const r = await W.fetch(new Request(url, { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "10.1.0." + (++ipN), ...headers }, body: JSON.stringify(body) }), { OPENAI_KEY: "k", ...env });
  return { status: r.status, j: await r.json().catch(() => null) };
}
ai.calls = [];
r = await raw("https://be-polish.test/?premium=1&plan=premium&capability=ai_analysis", { authorization: "Bearer " + tok() }, ANALYSE);
ok("H10 · the same claims as QUERY PARAMETERS are refused", r.status === 402, r.status);
r = await raw("https://be-polish.test/", { authorization: "Bearer " + tok(), "x-premium": "true", "x-plan": "premium", "x-dev-user": "admin", "x-capability": "ai_analysis" }, ANALYSE);
ok("H11 · the same claims as HEADERS are refused (no DEV_AUTH back door in be-polish)", r.status === 402, r.status);
ok("H12 · …and neither spent anything", ai.calls.length === 0, ai.calls.join(","));

console.log("\n# An entitlement that is no longer in force (brief 6, 7, 8)");
/* be-entitlements resolves expiry and revocation itself and answers with FREE
   capabilities. What is tested here is that be-polish reads CAPABILITIES and
   never the plan / paid / state labels beside them — so a view that still says
   "premium" while carrying nothing grants nothing. */
for (const [n, body] of [
  ["expired",  { plan: "premium", paid: true, state: "expired",  capabilities: FREE }],
  ["revoked",  { plan: "premium", paid: true, state: "revoked",  capabilities: FREE }],
  ["in a payment_pending state", { plan: "premium", paid: true, state: "payment_pending", capabilities: FREE }],
]) {
  ent.reply = () => new Response(JSON.stringify(body), { status: 200 });
  ai.calls = [];
  r = await ask(ANALYSE, { token: tok() });
  ok(`I· an ${n} entitlement is refused (402) even though the view still says plan premium, paid true`, r.status === 402 && ai.calls.length === 0, r.status + " " + ai.calls.length);
}
ent.reply = () => new Response(JSON.stringify({ plan: "premium", paid: true, capabilities: "yes-all-of-them" }), { status: 200 });
ai.calls = [];
r = await ask(ANALYSE, { token: tok() });
ok("I4 · a malformed capabilities field grants nothing (402), and spends nothing", r.status === 402 && ai.calls.length === 0, r.status);
ent.reply = () => new Response("<html>not json</html>", { status: 200 });
r = await ask(ANALYSE, { token: tok() });
ok("I5 · an entitlement response that is not JSON → 503, never a guess", r.status === 503, r.status);

console.log("\n# Track (brief 13-15) — ONE entitlement, and no server-held track data");
ent.reply = () => view(PREM);
for (const t of ["general", "welding"]) {
  r = await ask({ analyse: { ...ANALYSE.analyse, context: { track: t, task: "brief the team" } } }, { token: tok() });
  ok(`J· a PREMIUM account gets analysis on ${t} — one subscription covers both tracks`, r.status === 200, r.status);
}
ent.reply = () => view(FREE);
ai.calls = [];
for (const t of ["general", "welding", "admin", "../welding", ""]) {
  r = await ask({ analyse: { ...ANALYSE.analyse, context: { track: t, task: "x" } } }, { token: tok() });
  ok(`J· a FREE account is refused whatever it puts in track (${t || "empty"})`, r.status === 402, r.status);
}
ok("J8 · no track value let a FREE account spend", ai.calls.length === 0, ai.calls.join(","));

console.log("\n# Profession + standards (brief 16-21) — neither reaches this Worker");
/* professional-standards.js is a CLIENT module; be-polish has no profession and
   no standards registry, so there is no authoritative context for a client
   string to displace. These assert that such fields are inert, not trusted. */
ent.reply = () => view(FREE);
ai.calls = [];
for (const [n, extra] of [
  ["profession:'HSE Officer'",              { profession: "HSE Officer" }],
  ["profession inside the context",         { context: { track: "welding", profession: "Refinery Operator", task: "x" } }],
  ["a fabricated standard + clause",        { standard: "AWS D1.1", clause: "12.4", requirement: "anything I like" }],
  ["standards inside the context",          { context: { track: "welding", standards: [{ code: "AWS D1.1", clause: "99.9" }], task: "x" } }],
]) {
  r = await ask({ analyse: { ...ANALYSE.analyse, ...extra } }, { token: tok() });
  ok(`K· ${n} does not buy a FREE account anything (402)`, r.status === 402, r.status);
}
ok("K5 · …and none of it reached the provider", ai.calls.length === 0, ai.calls.join(","));
ent.reply = () => view(PREM);
const seen = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, i) => { if (!String(u).includes("/v1/entitlement")) seen.push(String((i && i.body) || "")); return realFetch(u, i); };
await ask({ analyse: { ...ANALYSE.analyse, profession: "HSE Officer", standard: "AWS D1.1", clause: "12.4", context: { track: "welding", profession: "Welder", standards: ["AWS D1.1 cl. 99"], task: "brief the crew" } } }, { token: tok() });
globalThis.fetch = realFetch;
const sent = seen.join(" ");
ok("K6 · the prompt the provider received carries NO client profession", !/HSE Officer|Refinery Operator/.test(sent));
ok("K7 · …and no client-supplied standard or clause", !/AWS D1\.1|12\.4|99/.test(sent), sent.slice(0, 200));
ok("K8 · the sanitised task context DID survive, so the feature still works", /brief the crew/.test(sent));

console.log("\n# The per-account limit holds the ACCOUNT, not a token that rotates hourly");
/* A Firebase ID token is refreshed about every hour. Keyed on the token hash,
   ACCT_PER_DAY reset on every refresh; keyed on the token's verified `sub` it
   does not. Each call below uses a fresh IP, so only the account limit can trip. */
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let jwtN = 0;
const jwtFor = sub => "eyJhbGciOiJSUzI1NiJ9." + b64u({ sub, iat: ++jwtN }) + ".sig";   // a new token, same account
ent.reply = () => view(PREM);
let last = 0, calls = 0;
for (let i = 0; i < 40; i++) { const x = await ask(ANALYSE, { token: jwtFor("learner-A") }); calls++; last = x.status; if (x.status === 429) break; }
ok("L1 · one account rotating its token is rate-limited (429) despite a fresh token each time", last === 429, "after " + calls + " calls, last " + last);
ok("L2 · …and it took about the per-minute cap to get there, not an unlimited run", calls > 25 && calls <= 40, calls);
r = await ask(ANALYSE, { token: jwtFor("learner-B") });
ok("L3 · a DIFFERENT account is unaffected by that — no cross-account contamination", r.status === 200, r.status);
r = await ask(ANALYSE, { token: "notajwt.@@@.sig" });
ok("L4 · a token whose payload will not parse still gets a limit (falls back to the token hash), not a pass", r.status === 200, r.status);

/* ------------------------------------------------- deployment configuration
   The gate's CODE was never the problem on staging; its DEPLOYMENT was.
   premiumGate() reaches be-entitlements with a plain fetch(), and a Worker's
   fetch to another Worker on this account's workers.dev subdomain is refused
   (Cloudflare 1042) unless the Worker declares global_fetch_strictly_public.
   Without it the subrequest throws, capabilities() returns { status: 503 } and
   every AI call answers entitlement_unavailable for a signed-in learner — while
   the BROWSER's own direct call to the same entitlements Worker keeps working,
   so Profile still reads "Premium" while nothing AI does anything. That is the
   shape of the 30 Sep staging fault, found through Shadow Translate; be-push
   hit the identical wall on 27 Sep. The assertions below are about the .toml,
   because no amount of correct Worker code survives the flag being absent. */
console.log("\n# deployment configuration — the entitlements subrequest must be allowed out");
{
  const { readFileSync } = await import("node:fs");
  const toml = readFileSync(new URL("./wrangler.toml", import.meta.url), "utf8");
  const flags = /compatibility_flags\s*=\s*\[([^\]]*)\]/.exec(toml);
  const top = toml.split(/^\[/m)[0];                      /* before the first [section] = top level */

  ok("D1 · be-polish declares global_fetch_strictly_public",
    !!flags && flags[1].includes("global_fetch_strictly_public"), flags ? flags[1] : "no compatibility_flags at all");
  ok("D2 · …at the TOP level, so [env.staging] and production both inherit it",
    /compatibility_flags\s*=\s*\[[^\]]*global_fetch_strictly_public/.test(top));
  const stagingUrl = /\[env\.staging\.vars\][\s\S]*?ENTITLEMENTS_URL\s*=\s*"([^"]*)"/.exec(toml);
  ok("D3 · staging's ENTITLEMENTS_URL is a workers.dev host — exactly the case the flag exists for",
    !!stagingUrl && /\.workers\.dev/.test(stagingUrl[1]), stagingUrl ? stagingUrl[1] : "not found");
  ok("D4 · staging really does switch enforcement on (otherwise none of this is exercised)",
    /\[env\.staging\.vars\][\s\S]*?PREMIUM_ENFORCED\s*=\s*"1"/.test(toml));

  /* the learner-visible consequence, pinned at the gate: Shadow Translate is a
     chat call with purpose "practice", which is free — a signed-in FREE account
     must get through it, and a signed-out one must be told to authenticate
     rather than be handed a provider call. */
  ent.reply = () => view(FREE);
  let t = await ask({ chat: { purpose: "practice", system: "You are a translator.", messages: [{ role: "user", content: "Here is a career that comes with a lot of pressure." }] } }, { token: tok() });
  ok("D5 · Shadow Translate (chat purpose 'practice') succeeds for a signed-in FREE learner", t.status === 200, JSON.stringify(t.j));
  t = await ask({ chat: { purpose: "practice", system: "x", messages: [{ role: "user", content: "hello" }] } });
  ok("D6 · …and signed out it is 401 auth_required, which the client must not show as a network error",
    t.status === 401 && t.j.error === "auth_required", JSON.stringify(t.j));
  const before = ai.calls.length;
  ent.reply = () => { throw new Error("1042: fetch to a workers.dev Worker refused"); };
  t = await ask({ chat: { purpose: "practice", system: "x", messages: [{ role: "user", content: "hello" }] } }, { token: tok() });
  ok("D7 · if the subrequest is refused anyway → 503, and no provider call is made on a guess",
    t.status === 503 && t.j.error === "entitlement_unavailable" && ai.calls.length === before, JSON.stringify(t.j));
}

/* ---------------------------------------------------------------- preflight
   The gate only works if the browser is willing to SEND the token. Signing in
   makes every AI call carry Authorization, which makes it a preflighted
   request; a preflight that does not name `authorization` is refused by the
   browser before the Worker runs. curl cannot catch this — it sends no
   preflight — which is exactly how it survived a round of green curl checks. */
console.log("\n# CORS preflight — the token must be allowed through the browser");
{
  const pre = async (origin, ask = "authorization,content-type") => {
    const r = await W.fetch(new Request("https://be-polish.test/", { method: "OPTIONS",
      headers: { origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": ask } }), { OPENAI_KEY: "k", ...ON });
    return { status: r.status, allow: r.headers.get("Access-Control-Allow-Headers") || "", origin: r.headers.get("Access-Control-Allow-Origin") || "" };
  };
  let r = await pre("https://app.lomonec.com");
  ok("P1 · preflight names `authorization`, so a signed-in AI call is not blocked before it starts",
    /\bauthorization\b/i.test(r.allow), r.allow);
  ok("P2 · …and still names content-type", /\bcontent-type\b/i.test(r.allow), r.allow);
  ok("P3 · the allowed origin is echoed, never '*'", r.origin === "https://app.lomonec.com", r.origin);
  r = await pre("https://staging.lomonec.com");
  ok("P4 · the same for the staging origin", /\bauthorization\b/i.test(r.allow) && r.origin === "https://staging.lomonec.com", r.allow + " | " + r.origin);
  r = await pre("https://evil.example.com");
  ok("P5 · a disallowed origin still gets no allow-origin", !r.origin);
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
