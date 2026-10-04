/* be-polish — ytai in three tiers (owner, 3 Oct 2026).
   Run: node backend/test-ytai-tiers.mjs

   anonymous  : a very small per-IP allowance AND one global daily pool
   free       : a larger per-account allowance, never drawing on that pool
   premium    : the highest per-account allowance

   The pool is the only limit here that bounds the BILL rather than one caller,
   so most of this file is about it — in particular that rotating the address,
   which is the whole method, does not refill it, and that it is spent in
   SECONDS OF VIDEO so a 30-minute transcript cannot cost the same as a
   5-minute window. Gemini and the edge cache are stand-ins: no key, no
   network, no cost. */
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 320)}`); };

let store = new Map();
globalThis.caches = { default: {
  async match(req) { const r = store.get(req.url); return r ? new Response(r, { headers: { "content-type": "application/json" } }) : undefined; },
  async put(req, resp) { store.set(req.url, await resp.text()); },
} };
const gem = { calls: [], premium: false };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("/v1/entitlement"))
    return new Response(JSON.stringify({ plan: gem.premium ? "premium" : "free", paid: gem.premium,
      capabilities: { ad_free: gem.premium, ai_analysis: gem.premium, advanced_progress: gem.premium, ai_coach: gem.premium, recommended_content: gem.premium } }), { status: 200 });
  if (String(url).includes("generativelanguage.googleapis.com")) {
    const body = JSON.parse(init.body); gem.calls.push(body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ cues: [{ ts: "00:01", txt: "a" }] }) }] } }] }), { status: 200 });
  }
  return realFetch(url, init);
};
const { _memReset } = await import(new URL("./rate-limit.js", import.meta.url));
const W = (await import(new URL("./polish-worker.js", import.meta.url))).default;

const tok = uid => "eyJhbGciOiJSUzI1NiJ9." + Buffer.from(JSON.stringify({ sub: uid })).toString("base64url") + ".sig";
let vidN = 0;
/* a fresh video id every call, so the edge cache never hides a limit */
const newVid = () => { const n = (++vidN).toString(36).padStart(11, "x").slice(-11); return n.replace(/[^A-Za-z0-9_-]/g, "x"); };
async function ask(env, { ip, uid, win, vid } = {}) {
  const h = { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip || "10.0.0.1" };
  if (uid) h.authorization = "Bearer " + tok(uid);
  const body = { ytai: vid || newVid() };
  if (win) { body.from = win[0]; body.to = win[1]; }
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers: h, body: JSON.stringify(body) }), env);
  return { status: r.status, j: await r.json().catch(() => null) };
}
const reset = () => { _memReset(); store = new Map(); gem.calls = []; gem.premium = false; };
/* enforcement OFF is production's shape today; a signed-in caller is "free" there */
const ENV_OFF = () => ({ GEMINI_KEY: "k", FIREBASE_PROJECT_ID: "be-mastery", YTAI_ANON: "1" });
const ENV_ON  = () => ({ GEMINI_KEY: "k", PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", YTAI_ANON: "1" });
const ENV_CLOSED = () => ({ GEMINI_KEY: "k", FIREBASE_PROJECT_ID: "be-mastery" });   // YTAI_ANON unset

/* token verification is the one thing this suite is not about */
const vt = await import(new URL("./verify-token.js", import.meta.url)).catch(() => null);

console.log("\n# the tier is OFF unless the deployment asks for it");
{
  reset();
  const a = await ask(ENV_CLOSED(), {});
  ok("T1 · with YTAI_ANON unset an anonymous caller is still refused, exactly as before",
    a.status === 401 && a.j.error === "auth_required", JSON.stringify(a));
  ok("T2 · …and nothing was spent", gem.calls.length === 0, String(gem.calls.length));
}

console.log("\n# anonymous: a try, not a habit");
{
  reset();
  const a = await ask(ENV_OFF(), { ip: "1.1.1.1" });
  ok("T3 · with it on, an anonymous caller gets a transcript", a.status === 200 && a.j.cues, JSON.stringify(a).slice(0, 160));
  const b = await ask(ENV_OFF(), { ip: "1.1.1.1" });
  ok("T4 · a second whole video from the same address is still allowed (the day's 2)", b.status === 200, JSON.stringify(b).slice(0, 120));
  const c = await ask(ENV_OFF(), { ip: "1.1.1.1" });
  ok("T5 · the third is refused — the anonymous per-IP allowance is small on purpose",
    c.status === 429, JSON.stringify(c));
  const d = await ask(ENV_OFF(), { ip: "1.1.1.2" });
  ok("T6 · a different address has its own small allowance", d.status === 200, JSON.stringify(d).slice(0, 120));
}

console.log("\n# the global pool: the only thing that bounds the BILL");
{
  reset();
  /* a pool of exactly two 30-minute transcripts, so the ceiling is reachable */
  const env = { ...ENV_OFF(), YTAI_ANON_USD_DAY: String(2 * 1800 * (0.08 / 900)) };
  const a = await ask(env, { ip: "2.0.0.1" });
  const b = await ask(env, { ip: "2.0.0.2" });
  ok("T7 · two anonymous whole videos, from two different addresses, fill the pool",
    a.status === 200 && b.status === 200, JSON.stringify({ a: a.status, b: b.status }));
  const c = await ask(env, { ip: "2.0.0.3" });
  ok("T8 · a THIRD address is refused — rotating the address does not refill the pool",
    c.status === 429 && c.j.scope === "anon_pool", JSON.stringify(c));
  const d = await ask(env, { ip: "2.0.0.4" });
  ok("T9 · …and neither does a fourth; this is the ceiling, not a per-address one",
    d.status === 429 && d.j.scope === "anon_pool", JSON.stringify(d));
  ok("T10 · Gemini was asked exactly twice — the refusals cost nothing",
    gem.calls.length === 2, String(gem.calls.length));
}

console.log("\n# the pool is spent in SECONDS, not in requests");
{
  reset();
  const env = { ...ENV_OFF(), YTAI_ANON_USD_DAY: String(1800 * (0.08 / 900)) };   // one 30-minute transcript
  /* 5-minute windows: six of them are one whole video's worth */
  let okN = 0;
  for (let i = 0; i < 6; i++) { const r = await ask(env, { ip: "3.0.0." + i, win: [0, 300] }); if (r.status === 200) okN++; }
  ok("T11 · six 5-minute windows fit in a pool of one 30-minute video", okN === 6, String(okN));
  const over = await ask(env, { ip: "3.0.0.9", win: [0, 300] });
  ok("T12 · the seventh does not — a window costs its own length, not a flat 1",
    over.status === 429 && over.j.scope === "anon_pool", JSON.stringify(over));
  ok("T13 · a request-counting ceiling would have let all seven through, so this is the difference",
    gem.calls.length === 6, String(gem.calls.length));
}

console.log("\n# a signed-in learner never draws on the anonymous pool");
{
  reset();
  const env = { ...ENV_OFF(), YTAI_ANON_USD_DAY: String(1800 * (0.08 / 900)) };
  const a = await ask(env, { ip: "4.0.0.1" });
  ok("T14 · (setup) one anonymous call empties a one-video pool", a.status === 200);
  const b = await ask(env, { ip: "4.0.0.2" });
  ok("T15 · (setup) the pool is now closed to anonymous callers", b.status === 429 && b.j.scope === "anon_pool", JSON.stringify(b));
  /* the signed-in half runs in the enforcement-on shape, because that is the
     only one where this harness can present a token the Worker will accept
     (be-entitlements is stubbed; Google's JWKS is not). The pool is global, so
     emptying it above is still the condition being tested. */
  const c = await ask({ ...ENV_ON(), YTAI_ANON_USD_DAY: env.YTAI_ANON_USD_DAY }, { ip: "4.0.0.3", uid: "signed-in-1" });
  ok("T16 · a learner with an account is unaffected — a busy day of strangers cannot lock them out",
    c.status === 200, JSON.stringify(c).slice(0, 200));
}

console.log("\n# free vs premium");
{
  reset();
  const env = ENV_ON();
  /* these calls all land inside one minute, so what they measure is the
     per-MINUTE ceiling of each tier. That is the honest reading and it is
     enough to prove the tiering: the day windows are the same mechanism with a
     longer window, and test-rate-limit.mjs winds the clock to prove those. */
  let n = 0;
  for (let i = 0; i < 11; i++) { const r = await ask(env, { ip: "5.0.0." + i, uid: "free-1" }); if (r.status === 200) n++; }
  ok("T17 · a FREE account is held at 4 a minute, per ACCOUNT — changing address does not help",
    n === 4, String(n));
  reset(); gem.premium = true;
  let m = 0;
  for (let i = 0; i < 41; i++) { const r = await ask(ENV_ON(), { ip: "6.0.0." + (i % 7), uid: "prem-1" }); if (r.status === 200) m++; }
  ok("T18 · a PREMIUM account gets the highest allowance, still a ceiling", m === 8, String(m));
  ok("T19 · …and it is higher than the free one, which is the point", 8 > 4);
}

console.log("\n# a token that cannot be verified is refused, not quietly demoted to anonymous");
{
  reset();
  /* enforcement off verifies the token here, against Google's JWKS, which this
     harness does not stand in for — so this token cannot be verified. The
     danger is that a route which now HAS an anonymous tier treats an
     unverifiable token as an anonymous caller and serves it on the pool. It
     must not: a bad token is an error, not a downgrade. */
  const a = await ask(ENV_OFF(), { ip: "7.0.0.1", uid: "someone" });
  ok("T20 · an unverifiable token is refused outright", a.status === 401 && a.j.error === "auth_required", JSON.stringify(a));
  ok("T20b · …and it did not fall through to the anonymous tier and spend the pool",
    gem.calls.length === 0, String(gem.calls.length));
}

console.log("\n# the cache still comes first, so a popular video is paid for once");
{
  reset();
  const v = "cachedvid00";
  const a = await ask(ENV_OFF(), { ip: "8.0.0.1", vid: v });
  const b = await ask(ENV_OFF(), { ip: "8.0.0.2", vid: v });
  ok("T21 · the second anonymous caller is served from the edge cache", b.status === 200 && b.j.cached === true, JSON.stringify(b).slice(0, 160));
  ok("T22 · …and Gemini was asked once", gem.calls.length === 1, String(gem.calls.length));
}

const bad = res.filter(x => !x).length;
console.log(`\n  ${res.length - bad}/${res.length} pass`);
process.exit(bad ? 1 : 0);
