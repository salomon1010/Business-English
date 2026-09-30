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

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
