/* be-polish — Shadow reads without an account (owner, 3 October 2026).
   Run: node backend/test-shadow-anon.mjs
   The Worker module in Node; be-entitlements and OpenAI are stand-ins. The
   whole point of this file is the SIZE of the exception: one chat purpose is
   anonymous, and every other route and purpose is exactly as authorised as
   it was before. */
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const ent = { calls: [], reply: null }; const ai = { calls: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("/v1/entitlement")) { ent.calls.push((init && init.headers && (init.headers.authorization || init.headers.Authorization)) || ""); return ent.reply(); }
  ai.calls.push(u);
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: "Chacun de nous a sa propre signature." }) } }] }), { status: 200 });
};
const W = (await import(new URL("./polish-worker.js", import.meta.url))).default;
const OFF = {};
const ON  = { PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", OPENAI_KEY: "k" };
const FREE = { ad_free: false, ai_analysis: false, advanced_progress: false, ai_coach: false, recommended_content: false };
const view = caps => new Response(JSON.stringify({ plan: "free", paid: false, capabilities: caps }), { status: 200 });
let ipN = 0, tokN = 0;
const tok = () => "t" + (++tokN) + ".x.y";
async function ask(body, { env = ON, token = null, ip = null } = {}) {
  const headers = { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip || "10.0.0." + (++ipN) };
  if (token) headers.authorization = "Bearer " + token;
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers, body: JSON.stringify(body) }), { OPENAI_KEY: "k", ...env });
  return { status: r.status, j: await r.json().catch(() => null) };
}
const CHAT = p => ({ chat: { purpose: p, system: "You are a translator.", messages: [{ role: "user", content: "Each of us has our own unique communication signature." }] } });

console.log("\n# Shadow reads without an account — enforcement ON");
{
  ent.reply = () => view(FREE); ent.calls.length = 0; ai.calls.length = 0;
  let r = await ask(CHAT("shadow"));                                   // no token at all
  ok("A1 · an ANONYMOUS Shadow translation is served (200), with enforcement on", r.status === 200, JSON.stringify(r));
  ok("A2 · …and it really reached the model, rather than being a 200 we invented", ai.calls.length === 1, JSON.stringify(ai.calls));
  ok("A3 · …without asking be-entitlements anything: there is no account to ask about", ent.calls.length === 0, JSON.stringify(ent.calls));
  r = await ask(CHAT("shadow"), { token: tok() });
  ok("A4 · a signed-in learner gets the same thing — the exception does not punish having an account", r.status === 200, JSON.stringify(r));
}

console.log("\n# the exception is EXACTLY one purpose");
{
  ent.reply = () => view(FREE);
  let r = await ask(CHAT("practice"));
  ok("B1 · anonymous `practice` is still refused — Executive Polish and the rest are untouched", r.status === 401 && r.j.error === "auth_required", JSON.stringify(r));
  r = await ask(CHAT("coach"));
  ok("B2 · anonymous `coach` (the AI coach) is still refused", r.status === 401, JSON.stringify(r));
  r = await ask(CHAT("report"));
  ok("B3 · anonymous `report` (AI analysis) is still refused", r.status === 401, JSON.stringify(r));
  r = await ask(CHAT("coach"), { token: tok() });
  ok("B4 · and a signed-in FREE learner still cannot have the AI coach: Premium is unchanged", r.status === 402 && r.j.error === "premium_required", JSON.stringify(r));
  r = await ask(CHAT("report"), { token: tok() });
  ok("B5 · …nor the AI report", r.status === 402, JSON.stringify(r));
  r = await ask({ analyse: { transcript: "this is a long enough sentence to pass", metrics: {} } });
  ok("B6 · the analyse route is still account-gated for an anonymous caller", r.status === 401, JSON.stringify(r));
  r = await ask({ ytai: { url: "https://youtu.be/abc", vid: "abc" } });
  ok("B7 · ytai — the route that spends real money — still demands an account", r.status === 401, JSON.stringify(r));
  r = await ask({ chat: { purpose: "shadow_translate_x", system: "s", messages: [{ role: "user", content: "hi" }] } });
  ok("B8 · a NEAR-MISS purpose is refused as a bad request, not quietly treated as the exception", r.status === 400 && r.j.error === "bad_request", JSON.stringify(r));
}

console.log("\n# it buys nothing, and it is still held");
{
  ent.reply = () => view(FREE); ai.calls.length = 0;
  const ip = "10.9.9.9";
  let last = null, served = 0;
  for (let i = 0; i < 26; i++) { last = await ask(CHAT("shadow"), { ip }); if (last.status === 200) served++; }
  ok("C1 · an anonymous flood from one address is rate-limited, not served forever", last.status === 429 && last.j.error === "rate_limited", JSON.stringify(last));
  ok("C2 · …and the ceiling is SMALLER than the shared chat budget (its own per-IP counter)", served <= 20, String(served));
}

console.log("\n# with enforcement OFF (production today) nothing changed");
{
  ent.calls.length = 0;
  let r = await ask(CHAT("shadow"), { env: OFF });
  ok("D1 · anonymous Shadow translation is served, as it already was", r.status === 200, JSON.stringify(r));
  r = await ask(CHAT("practice"), { env: OFF });
  ok("D2 · and `practice` is served too — production behaviour is untouched by this change", r.status === 200, JSON.stringify(r));
  ok("D3 · be-entitlements was never consulted with enforcement off", ent.calls.length === 0, JSON.stringify(ent.calls));
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
