/* be-polish — the AI allowance asks about the RIGHT APP (30 Oct 2026, the open
   item before Phase C). Premium is sold per app; the page adds ?app=<programme>
   to every be-polish call and the Worker must pass it to be-entitlements
   (/v1/entitlement?app=…), so a learner who bought Premium in the Welding app is
   metered on the Welding plan, not on General English's default answer.
   Run: node backend/test-ai-app.mjs   (no network, no key, no cost) */
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };

/* be-entitlements stand-in: Premium in the Welding app ONLY, Free elsewhere —
   and, like the real service, the view names the app it answered about */
const ent = { urls: [] };
const PREM = { ad_free: true, ai_analysis: true, advanced_progress: true, ai_coach: true, recommended_content: true };
const FREE = { ad_free: false, ai_analysis: false, advanced_progress: false, ai_coach: false, recommended_content: false };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("/v1/entitlement")) {
    ent.urls.push(u);
    const app = new URL(u).searchParams.get("app") || "general-english";
    const p = app === "welding";
    return new Response(JSON.stringify({ app, plan: p ? "premium" : "free", paid: p, capabilities: p ? PREM : FREE }), { status: 200 });
  }
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: "ok", covered: [] }) } }] }), { status: 200 });
};
const W = (await import(new URL("./polish-worker.js", import.meta.url))).default;
const ON = { PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", OPENAI_KEY: "k" };
const ANALYSE = { analyse: { transcript: "this is a long enough sentence to pass", metrics: {} } };
let n = 0;
async function ask(q, body = ANALYSE) {
  const headers = { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "10.1.0." + (++n), authorization: "Bearer a" + n + ".x.y" };
  const r = await W.fetch(new Request("https://be-polish.test/" + q, { method: "POST", headers, body: JSON.stringify(body) }), ON);
  let a = null; try { a = JSON.parse(r.headers.get("X-BE-Allowance")); } catch (e) {}
  return { status: r.status, a, asked: ent.urls[ent.urls.length - 1] || "" };
}

let r = await ask("?app=welding");
ok("1 · ?app=welding is passed to be-entitlements", /\/v1\/entitlement\?app=welding$/.test(r.asked), r.asked);
ok("2 · …and a Welding buyer is metered on the Premium allowance (120)", r.status === 200 && r.a && r.a.plan === "premium" && r.a.limit === 120, JSON.stringify(r));

r = await ask("?app=general-english");
ok("3 · ?app=general-english asks about General English", /\?app=general-english$/.test(r.asked), r.asked);
ok("4 · …where the same account is Free (3) — Premium is per app", r.status === 200 && r.a && r.a.plan === "free" && r.a.limit === 3, JSON.stringify(r));

r = await ask("");
ok("5 · no ?app= (an older page) asks exactly as before: the service's default app", /\/v1\/entitlement$/.test(r.asked) && r.a && r.a.plan === "free", JSON.stringify(r));

r = await ask("?app=evil%26x%3D1");
ok("6 · an unknown app is ignored, never forwarded", /\/v1\/entitlement$/.test(r.asked), r.asked);

r = await ask("?fillers=1&app=welding");
ok("7 · it sits beside the existing query (?fillers=1)", /\?app=welding$/.test(r.asked), r.asked);

const before = ent.urls.length;
r = await W.fetch(new Request("https://be-polish.test/?app=welding", { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "10.2.0.1" }, body: JSON.stringify(ANALYSE) }), ON);
ok("8 · no token is still 401, whatever the app says", r.status === 401 && ent.urls.length === before, r.status);

const failed = res.filter(x => !x).length;
console.log(`\n${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
