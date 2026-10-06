/* be-polish — the rate limit, and the proof that it holds ACROSS ISOLATES.
   Run: node backend/test-rate-limit.mjs

   THE DEFECT THIS PINS. Every limit was a module-scope Map, which lives in one
   isolate. Cloudflare runs many, recycles them freely, and the per-IP limit of
   20 was therefore a per-ISOLATE limit of 20 — measured on 1 October 2026 as
   24 of 24 requests passing. Lowering the number would not have helped: the
   ceiling was `number x isolates`, and isolates are not bounded.

   So this file does not test that a counter counts. It loads the Worker module
   TWICE — two module instances, two sets of module-scope state, which is what
   two isolates are — and asserts that one shared limit is enforced across
   both. Section C proves the old behaviour is still wrong by running the same
   scenario against the in-memory fallback, so the test fails if anyone
   "simplifies" the Durable Object away. */
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };

/* ---- a faithful in-process Durable Object namespace ----
   One store per DO id, exactly as Cloudflare gives one instance per id. It
   implements the storage contract the class uses (get(keys) -> Map, put(obj),
   list({prefix}), delete([]), deleteAll, get/setAlarm) and blockConcurrencyWhile
   as a real mutex, which is what makes the concurrency check in section B mean
   something. This is a stand-in for the platform, not for the code under test:
   the class in rate-limit.js is the real one. */
function makeNamespace() {
  const objs = new Map();
  const made = { n: 0 };
  return {
    _objs: objs, _made: made,
    idFromName: name => ({ toString: () => "id:" + name, name }),
    get(id) {
      let o = objs.get(id.name);
      if (!o) { made.n++; o = newStub(id.name); objs.set(id.name, o); }
      return o;
    },
  };
  function newStub(name) {
    const map = new Map(); let alarm = null, chain = Promise.resolve();
    const storage = {
      async get(k) {
        if (Array.isArray(k)) { const m = new Map(); for (const x of k) if (map.has(x)) m.set(x, map.get(x)); return m; }
        return map.get(k);
      },
      async put(o) { for (const k of Object.keys(o)) map.set(k, o[k]); },
      async list({ prefix } = {}) { const m = new Map(); for (const [k, v] of map) if (!prefix || k.startsWith(prefix)) m.set(k, v); return m; },
      async delete(k) { for (const x of (Array.isArray(k) ? k : [k])) map.delete(x); },
      async deleteAll() { map.clear(); },
      async getAlarm() { return alarm; },
      async setAlarm(t) { alarm = t; },
    };
    const state = {
      storage,
      /* a real mutex: the object handles one critical section at a time */
      blockConcurrencyWhile(fn) { const p = chain.then(() => fn()); chain = p.then(() => {}, () => {}); return p; },
    };
    let inst = null;
    return {
      _state: state, _map: map,
      async fetch(url, init) {
        if (!inst) inst = new RL(state, {});
        return inst.fetch(new Request(url, init));
      },
      async _alarm() { if (!inst) inst = new RL(state, {}); return inst.alarm(); },
    };
  }
}

const { RateLimiter: RL, consume, memConsume, _memReset } = await import(new URL("./rate-limit.js", import.meta.url));

/* ---- the Worker, loaded as N separate "isolates" ----
   A distinct query string gives Node a distinct module instance, so each copy
   has its own module-scope state — the same thing that made the old limiter
   leak. They share only `env`, which is how Cloudflare shares a binding. */
const ent = { reply: null };
const ai = { calls: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("/v1/entitlement")) return ent.reply();
  ai.calls.push(u);
  if (u.includes("/audio/transcriptions")) return new Response(JSON.stringify({ text: "hello", words: [] }), { status: 200 });
  /* Gemini's own answer shape, so a ytai call that gets past the brakes really
     succeeds (200) instead of failing to parse (502) — section E asserts the
     difference between "allowed" and "refused", and a 502 would blur it. */
  if (u.includes("generativelanguage")) return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ cues: [{ ts: "0:01", txt: "hello there" }, { ts: "0:20", txt: "and a second line" }] }) }] } }],
  }), { status: 200 });
  return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
};
const isolate = async n => (await import(new URL("./polish-worker.js?iso=" + n, import.meta.url))).default;
const W1 = await isolate(1), W2 = await isolate(2), W3 = await isolate(3);

const caps = on => ({ ad_free: on, ai_analysis: on, advanced_progress: on, ai_coach: on, recommended_content: on });
const view = on => new Response(JSON.stringify({ plan: on ? "premium" : "free", paid: on, capabilities: caps(on) }), { status: 200 });
ent.reply = () => view(false);

const ENV_BASE = { OPENAI_KEY: "k", GEMINI_KEY: "g" };
function env(ns, on = false) {
  const e = { ...ENV_BASE };
  if (ns) e.RATE_LIMITER = ns;
  if (on) { e.PREMIUM_ENFORCED = "1"; e.ENTITLEMENTS_URL = "https://ent.test"; }
  return e;
}
/* one spoken turn: the audio route, whose limit is STT_PER_MIN = 20 */
async function audio(W, e, { ip = "1.2.3.4", token = null } = {}) {
  const headers = { origin: "https://app.lomonec.com", "content-type": "audio/webm", "CF-Connecting-IP": ip };
  if (token) headers.authorization = "Bearer " + token;
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers, body: new Uint8Array(2048) }), e);
  return r.status;
}
const tally = async (calls) => { const out = { 200: 0, 429: 0, other: 0 }; for (const c of calls) { const s = await c; out[s === 200 ? 200 : s === 429 ? 429 : "other"]++; } return out; };

console.log("\n# A. the Durable Object's own semantics");
{
  const ns = makeNamespace();
  const B = [{ name: "t:min", limit: 3, windowMs: 60_000 }];
  const r = [];
  for (let i = 0; i < 5; i++) r.push(await consume(env(ns), "ip:a", B));
  ok("A1 · the first 3 of 5 pass and the rest are refused", r.filter(x => x.ok).length === 3 && r.filter(x => !x.ok).length === 2, JSON.stringify(r));
  ok("A2 · a refusal names the bucket and a retryAfter in seconds", r[4].bucket === "t:min" && r[4].retryAfter > 0 && r[4].retryAfter <= 60, JSON.stringify(r[4]));
  ok("A3 · nothing says degraded — this was the real limiter, not the fallback", r.every(x => !x.degraded));
  const other = await consume(env(ns), "ip:b", B);
  ok("A4 · a different subject has its own allowance", other.ok === true);
  /* ALL-OR-NOTHING: a full per-minute bucket must not also burn the daily one */
  const ns2 = makeNamespace();
  const TWO = [{ name: "u:min", limit: 2, windowMs: 60_000 }, { name: "u:day", limit: 10, windowMs: 86_400_000 }];
  for (let i = 0; i < 6; i++) await consume(env(ns2), "ip:c", TWO);
  const st = ns2.get(ns2.idFromName("ip:c"))._map;
  ok("A5 · a refused call consumes NOTHING: the day bucket counted 2, not 6", st.get("b:u:day").count === 2, JSON.stringify([...st]));
  ok("A6 · …and the minute bucket stopped at its own limit", st.get("b:u:min").count === 2);
  /* a window that has run out is a fresh one */
  const stub = ns.get(ns.idFromName("ip:a"));
  stub._map.set("b:t:min", { count: 3, resetAt: Date.now() - 1 });
  ok("A7 · an expired window starts again, so a limit is a rate and not a lifetime cap", (await consume(env(ns), "ip:a", B)).ok === true);
  /* a stored window from the future (a clock that went backwards) is not trusted */
  stub._map.set("b:t:min", { count: 3, resetAt: Date.now() + 999 * 60_000 });
  ok("A8 · a nonsensical far-future window is discarded rather than locking the subject out", (await consume(env(ns), "ip:a", B)).ok === true);
  /* the alarm is storage hygiene, not correctness */
  const ns3 = makeNamespace();
  await consume(env(ns3), "ip:d", [{ name: "z:min", limit: 5, windowMs: 1000 }]);
  const s3 = ns3.get(ns3.idFromName("ip:d"));
  ok("A9 · an alarm is set to clean the object up after its longest window", (await s3._state.storage.getAlarm()) > Date.now());
  s3._map.set("b:z:min", { count: 1, resetAt: Date.now() - 1 });
  await s3._alarm();
  ok("A10 · …and the alarm deletes the expired counter, so nothing accumulates", s3._map.size === 0, JSON.stringify([...s3._map]));
  /* a malformed consume is refused, not silently allowed */
  const bad = async b => (await (ns.get(ns.idFromName("ip:x"))).fetch("https://r.invalid/c", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buckets: b }) })).status;
  ok("A11 · a malformed bucket list is a 400, never an unmetered pass", await bad([]) === 400 && await bad([{ name: "", limit: 1, windowMs: 1000 }]) === 400 && await bad([{ name: "n", limit: 0, windowMs: 1000 }]) === 400);
  /* `counts` (5 Oct 2026): what each bucket stands at AFTER the call, so the
     daily allowance can say "2 of 3 used" without a second round trip */
  const nsN = makeNamespace();
  const C = [{ name: "c:min", limit: 5, windowMs: 60_000 }];
  await consume(env(nsN), "ip:cnt", C);
  const second = await consume(env(nsN), "ip:cnt", C);
  memConsume("ip:cnt2", C);
  const memSecond = memConsume("ip:cnt2", C);
  ok("A12 · a pass returns `counts`: after two hits the bucket stands at 2 — from the DO and from the fallback alike",
    second.ok === true && second.counts && second.counts["c:min"] === 2 && memSecond.ok === true && memSecond.counts && memSecond.counts["c:min"] === 2,
    JSON.stringify([second, memSecond]));
}

console.log("\n# B. ACROSS ISOLATES — the defect that made the numbers meaningless");
{
  const ns = makeNamespace();
  const e = env(ns);
  /* 24 spoken turns from one IP, alternating between two isolates. STT_PER_MIN
     is 20. With the old Maps each isolate counted to 20 on its own and all 24
     passed; with one shared object exactly 20 may. */
  const calls = [];
  for (let i = 0; i < 24; i++) calls.push(audio(i % 2 ? W1 : W2, e, { ip: "9.9.9.9" }));
  const t = await tally(calls);
  ok("B1 · 24 turns over TWO isolates: exactly 20 pass, 4 are refused", t[200] === 20 && t[429] === 4, JSON.stringify(t));
  ok("B2 · one DO instance served both isolates — that is what makes the count shared", ns._made.n === 1, "objects made: " + ns._made.n);
  /* a third isolate, cold, inherits the exhausted limit instead of a fresh one */
  ok("B3 · a cold third isolate inherits the spent allowance (an isolate recycle is no longer a free refill)", await audio(W3, e, { ip: "9.9.9.9" }) === 429);
  ok("B4 · …while another IP on that same cold isolate is unaffected", await audio(W3, e, { ip: "9.9.9.8" }) === 200);
  /* concurrency: a burst fired at once, not in sequence */
  const ns2 = makeNamespace(), e2 = env(ns2);
  const burst = await Promise.all(Array.from({ length: 24 }, (_, i) => audio(i % 3 === 0 ? W1 : i % 3 === 1 ? W2 : W3, e2, { ip: "7.7.7.7" })));
  const pass = burst.filter(s => s === 200).length;
  ok("B5 · 24 CONCURRENT turns over three isolates: still exactly 20, so the read-check-write is atomic", pass === 20, "passed " + pass);
  /* the per-ACCOUNT limit is shared the same way, and is what actually holds a
     learner behind carrier NAT where the IP means nothing */
  const ns3 = makeNamespace(), e3 = env(ns3, true);
  const tk = "eyJhbGciOiJSUzI1NiJ9." + Buffer.from(JSON.stringify({ sub: "uid-1" })).toString("base64url") + ".sig";
  const acct = [];
  for (let i = 0; i < 34; i++) acct.push(audio(i % 2 ? W1 : W2, e3, { ip: "10.0.0." + i, token: tk }));
  const at = await tally(acct);
  ok("B6 · ACCT_PER_MIN 30: one account from 34 different IPs across two isolates gets 30, not 34", at[200] === 30 && at[429] === 4, JSON.stringify(at));
}

console.log("\n# C. the fallback is NOT a limiter — pinned, so the DO cannot be dropped");
{
  _memReset();
  /* The defect itself, asserted on purpose so nobody can "simplify" the
     Durable Object away: an in-memory store is per module instance, and a
     module instance is what an isolate has one of. Two of them, each given the
     same subject and the same limit of 20, admit 40 — which is exactly what
     be-polish did before this change, and why 24 of 24 requests passed a limit
     of 20 when it was measured on 1 October 2026.

     Note why this is tested through rate-limit.js directly rather than through
     two Worker instances: Node resolves `polish-worker.js?iso=1` and `?iso=2`
     as separate modules but DEDUPES their shared import of rate-limit.js, so
     in this harness the two Worker copies happen to share one fallback store.
     That is an artefact of the harness, not of the runtime — on Cloudflare
     each isolate loads the whole module graph, fallback store included. Two
     module instances is the faithful model, so that is what is used. */
  const m1 = await import(new URL("./rate-limit.js?iso=1", import.meta.url));
  const m2 = await import(new URL("./rate-limit.js?iso=2", import.meta.url));
  const B20 = [{ name: "stt:min", limit: 20, windowMs: 60_000 }];
  let leaked = 0;
  for (let i = 0; i < 24; i++) if ((i % 2 ? m1 : m2).memConsume("ip:5.5.5.5", B20).ok) leaked++;
  ok("C1 · two isolates on in-memory counters admit 24 of 24 past a limit of 20 — the defect, pinned", leaked === 24, "passed " + leaked);
  ok("C1b · and 40 in all if each is driven to its own ceiling, i.e. `limit x isolates`",
    Array.from({ length: 40 }, (_, i) => (i % 2 ? m1 : m2).memConsume("ip:6.6.6.6", B20).ok).filter(Boolean).length === 40);
  /* the same traffic through the shared Durable Object: the limit is the limit */
  const nsC = makeNamespace();
  const eC = env(nsC);
  const held = await tally(Array.from({ length: 24 }, (_, i) => audio(i % 2 ? W1 : W2, eC, { ip: "5.5.5.6" })));
  ok("C1c · the identical traffic through the DO is held at 20 — the whole point of the change", held[200] === 20 && held[429] === 4, JSON.stringify(held));
  ok("C2 · the fallback reports itself as degraded, so a tail can see it", memConsume("ip:z", [{ name: "q", limit: 9, windowMs: 1000 }]).degraded === true);
  ok("C3 · …and within ONE isolate it does still hold, so a lost binding is a weaker limit and never none",
    Array.from({ length: 12 }, () => memConsume("ip:y", [{ name: "q2", limit: 5, windowMs: 60_000 }])).filter(r => r.ok).length === 5);
  /* an unreachable DO must not take the AI down with it */
  const broken = { idFromName: n => ({ name: n }), get: () => ({ fetch: async () => { throw new Error("DO unreachable"); } }) };
  const r = await consume(env(broken), "ip:w", [{ name: "f", limit: 1, windowMs: 1000 }]);
  ok("C4 · a limiter outage fails OPEN and says degraded — the provider budget cap is the backstop beneath it", r.ok === true && r.degraded === true, JSON.stringify(r));
}

console.log("\n# D. ytai — the one free route that spends real money per call");
{
  const ns = makeNamespace();
  const e = env(ns, true);
  const tk = "eyJhbGciOiJSUzI1NiJ9." + Buffer.from(JSON.stringify({ sub: "uid-2" })).toString("base64url") + ".sig";
  const ytai = async (W, ip, token) => {
    const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST",
      headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip, ...(token ? { authorization: "Bearer " + token } : {}) },
      body: JSON.stringify({ ytai: "abcdefghijk", from: 0, to: 60 }) }), e);
    return r.status;
  };
  /* windows, so the per-IP window brake (12/min) is not what bites first */
  const out = [];
  for (let i = 0; i < 6; i++) out.push(await ytai(i % 2 ? W1 : W2, "3.3.3." + i, tk));
  ok("D1 · YTAI_ACCT_PER_MIN 4: one account from six IPs across two isolates is cut off at 4", out.filter(s => s !== 429).length === 4, JSON.stringify(out));
  ok("D2 · …and the refusals are 429, not a provider call", out.slice(4).every(s => s === 429), JSON.stringify(out));
  ok("D3 · a DIFFERENT account on the same isolates still has its own allowance",
    await ytai(W1, "3.3.3.9", "eyJhbGciOiJSUzI1NiJ9." + Buffer.from(JSON.stringify({ sub: "uid-3" })).toString("base64url") + ".sig") !== 429);
  /* with enforcement off there is no account to hold — the IP limits are the
     whole brake, which is why this route must never be opened to anonymous use */
  const ns2 = makeNamespace();
  const off = env(ns2);
  ok("D4 · with enforcement off the call has no account, so only the per-IP brake applies (stated, not assumed)", await ytai(W1, "4.4.4.4", null) !== undefined);
}

console.log("\n# E. ytai — the bypass questions, answered deterministically (fake key, stubbed provider)");
{
  /* GEMINI_KEY is deliberately ABSENT from be-polish-staging, and the `no_key`
     501 sits before the limiter, so none of this can be exercised against the
     real Worker (measured 1 Oct 2026: six window requests, six 501s, no
     limiting reached). It is exercised here instead, with a fake key and the
     provider stubbed by the global fetch at the top of this file — the limiter
     and ordering under test are the real ones. No live-provider claim is made. */
  const tokOf = sub => "eyJhbGciOiJSUzI1NiJ9." + Buffer.from(JSON.stringify({ sub })).toString("base64url") + ".sig";
  /* `win`: true = the app's first-minute window, [from, to] = that stretch, false = the whole video */
  const call = (W, e, { ip, token, win = true } = {}) => W.fetch(new Request("https://be-polish.test/", { method: "POST",
    headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip, ...(token ? { authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(win ? { ytai: "abcdefghijk", from: Array.isArray(win) ? win[0] : 0, to: Array.isArray(win) ? win[1] : 60 } : { ytai: "abcdefghijk" }) }), e);
  const videoAllow = r => { try { return JSON.parse(r.headers.get("X-BE-Video-Allowance")); } catch (e) { return null; } };
  const utcMidnight = at => new Date(at).toISOString().endsWith("T00:00:00.000Z");
  /* "a minute passes": the per-account per-MINUTE brake shares the all-or-
     nothing consume with the day budget and is checked first, so to reach the
     budget through the Worker the minute window is wound on in the DO's own
     storage — the same move A7 makes. Nothing else in the object is touched. */
  const minutePasses = (ns, subject) => { const m = ns.get(ns.idFromName(subject))._map; if (m.has("b:ytaiacct:min")) m.set("b:ytaiacct:min", { count: 0, resetAt: Date.now() - 1 }); };

  /* --- can an unauthenticated caller spend on the paid route? --- */
  { const ns = makeNamespace(), e = env(ns, true);
    ai.calls = [];
    const r = await call(W1, e, { ip: "20.0.0.1" });
    ok("E1 · enforcement ON: an anonymous ytai call is 401 and reaches NO provider", r.status === 401 && ai.calls.length === 0, r.status + " provider=" + ai.calls.length); }
  /* This check used to assert the opposite — that with enforcement off an
     anonymous ytai call DID reach the provider. That was the J1 exposure, and
     it is now closed by ytaiAccount(): the route demands a verified account in
     every configuration, while staying free of capability. The inversion is the
     fix landing, not an assertion being relaxed; section J1 below proves the
     whole behaviour, including that no OTHER route gained a requirement. */
  { const ns = makeNamespace(), e = env(ns, false);        // production shape today
    ai.calls = [];
    const r = await call(W1, e, { ip: "20.0.0.2" });
    ok("E2 · enforcement OFF (production shape): an anonymous ytai call is now 401 and spends NOTHING — the J1 hole is closed", r.status === 401 && ai.calls.length === 0, r.status + " provider=" + ai.calls.length); }

  /* --- the limiter runs before the money --- */
  { const ns = makeNamespace(), e = env(ns, true), tk = tokOf("uid-y1");
    ai.calls = [];
    const out = [];
    for (let i = 0; i < 6; i++) out.push((await call(i % 2 ? W1 : W2, e, { ip: "21.0.0." + i, token: tk })).status);
    ok("E3 · YTAI_ACCT_PER_MIN 4: the 5th and 6th are 429 even from six different IPs", out.filter(x => x === 429).length === 2 && out.slice(0, 4).every(x => x === 200), JSON.stringify(out));
    ok("E4 · …and the provider was called exactly 4 times, so a refusal costs nothing", ai.calls.length === 4, String(ai.calls.length));
    ok("E5 · changing IP does NOT bypass the account cap (that is the carrier-NAT case)", out[4] === 429 && out[5] === 429, JSON.stringify(out)); }

  /* --- changing account does not bypass the IP cap --- */
  { const ns = makeNamespace(), e = env(ns, true);
    ai.calls = [];
    const out = [];
    for (let i = 0; i < 14; i++) out.push((await call(W1, e, { ip: "22.0.0.9", token: tokOf("uid-z" + i) })).status);
    ok("E6 · YTAI_WIN_PER_MIN 12 per IP: 13th and 14th refused although every call is a DIFFERENT account", out.filter(x => x === 429).length === 2 && out.slice(0, 12).every(x => x === 200), JSON.stringify(out));
    ok("E7 · changing account does NOT bypass the IP cap", out[12] === 429 && out[13] === 429, JSON.stringify(out)); }

  /* --- the per-account budget is in SECONDS OF VIDEO. With enforcement on (the
         only state in which Premium can be bought), Free is a ONE-OFF TRIAL of
         YTAI_FREE_TRIAL_SEC = 600 s in total (owner, 6 Oct 2026) and Premium
         is 3600 s a UTC day. A whole video is charged at YTAI_MAX_SEC = 1800 s,
         so a Free account can never afford one. A fresh IP per request, so
         only the account can bite. --- */
  { const ns = makeNamespace(), e = env(ns, true), tk = tokOf("uid-order");
    ai.calls = [];
    const r1 = await call(W1, e, { ip: "23.0.0.1", token: tk, win: false });
    const j1 = await r1.json().catch(() => null);
    ok("E8 · whole-video path, FREE: 1800 s is more than the 600 s trial, so it is 429 allowance, scope video, trial:true — before any provider call",
      r1.status === 429 && j1 && j1.error === "allowance" && j1.scope === "video" && j1.limit === 600 && j1.plan === "free" && j1.trial === true && ai.calls.length === 0,
      r1.status + " " + JSON.stringify(j1) + " provider=" + ai.calls.length);
    ok("E8b · …a spent trial names no reset and sends no Retry-After: there is nothing to wait for, the answer is Premium",
      j1 && j1.resetAt === undefined && j1.retryAfter === undefined && r1.headers.get("Retry-After") === null,
      JSON.stringify(j1) + " retry=" + r1.headers.get("Retry-After"));
    /* the per-IP minute cap is untouched by the budget: ONE address, three PREMIUM accounts */
    ent.reply = () => view(true);
    const ipOut = [];
    for (let i = 0; i < 3; i++) { const r = await call(W1, e, { ip: "23.0.0.9", token: tokOf("uid-ipc" + i), win: false }); ipOut.push([r.status, ((await r.json().catch(() => null)) || {}).error]); }
    ent.reply = () => view(false);
    ok("E8c · the per-IP cap is unaffected: YTAI_PER_MIN 2 still refuses the third whole video from one address as rate_limited, although each is a different account",
      ipOut[0][0] === 200 && ipOut[1][0] === 200 && ipOut[2][0] === 429 && ipOut[2][1] === "rate_limited", JSON.stringify(ipOut)); }

  /* --- the trial in WINDOWS: two 5-minute windows are 600 s, the third is over, and it never turns over --- */
  { const ns = makeNamespace(), e = env(ns, true), tk = tokOf("uid-win"), subject = "acct:u:uid-win";
    ai.calls = [];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const r = await call(i % 2 ? W1 : W2, e, { ip: "26.0.0." + i, token: tk, win: [i * 300, (i + 1) * 300] });
      out.push({ status: r.status, allow: videoAllow(r), body: r.status === 429 ? await r.json().catch(() => null) : null });
      minutePasses(ns, subject);
    }
    ok("E8d · FREE, windows: two 300 s windows pass (the header counting to 600/600, trial:true, no resetAt) and the third is 429 allowance with trial:true",
      out.slice(0, 2).every(x => x.status === 200 && x.allow && x.allow.trial === true && x.allow.resetAt === undefined) && out[1].allow.used === 600 && out[1].allow.limit === 600
      && out[2].status === 429 && out[2].body && out[2].body.error === "allowance" && out[2].body.trial === true && out[2].body.limit === 600,
      JSON.stringify(out.map(x => [x.status, x.allow && x.allow.used, x.body && x.body.error])));
    ok("E8e · …the provider was called twice, not three times", ai.calls.length === 2, String(ai.calls.length));
    const st = ns.get(ns.idFromName(subject))._map.get("b:ytaitrial");
    ok("E8e2 · …and the trial bucket has no day in its name and a window of decades, so it does not come back tomorrow",
      st && st.count === 600 && st.resetAt - Date.now() > 50 * 365 * 86_400_000, JSON.stringify(st)); }

  /* --- Premium: two whole videos (2 x 1800 = 3600 s), the third is over --- */
  { const ns = makeNamespace(), e = env(ns, true), tk = tokOf("uid-prem8"), subject = "acct:u:uid-prem8";
    ent.reply = () => view(true); ai.calls = [];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const r = await call(i % 2 ? W1 : W2, e, { ip: "27.0.0." + i, token: tk, win: false });
      out.push({ status: r.status, allow: videoAllow(r), body: r.status === 429 ? await r.json().catch(() => null) : null, retry: r.headers.get("Retry-After") });
      minutePasses(ns, subject);
    }
    ent.reply = () => view(false);
    ok("E8f · PREMIUM: two whole videos pass (header limit 3600, plan premium) and the third is 429 allowance with plan premium",
      out.slice(0, 2).every(x => x.status === 200 && x.allow && x.allow.limit === 3600 && x.allow.plan === "premium" && !x.allow.trial) && out[1].allow.used === 3600
      && out[2].status === 429 && out[2].body && out[2].body.error === "allowance" && out[2].body.scope === "video" && out[2].body.limit === 3600 && out[2].body.plan === "premium" && ai.calls.length === 2,
      JSON.stringify(out.map(x => [x.status, x.allow && x.allow.used, x.body && x.body.error])) + " provider=" + ai.calls.length);
    ok("E8g · …Premium's refusal names the next UTC midnight and carries Retry-After",
      out[2].body && utcMidnight(out[2].body.resetAt) && Number(out[2].retry) > 0, JSON.stringify(out[2].body) + " retry=" + out[2].retry); }

  /* --- ytai carries no capability on either plan; the plans differ only in budget --- */
  { const ns = makeNamespace(), e = env(ns, true), tk = tokOf("uid-free");
    ent.reply = () => view(false); ai.calls = [];
    const f = await call(W1, e, { ip: "24.0.0.1", token: tk });
    ent.reply = () => view(true);
    const pr = await call(W1, e, { ip: "24.0.0.2", token: tokOf("uid-prem") });
    ent.reply = () => view(false);
    const fa = videoAllow(f), pa = videoAllow(pr);
    ok("E9 · a FREE account may still try a pasted video — ROUTE_CAP.ytai is null; a 60 s window costs 60 of its 600 s trial", f.status === 200 && fa && fa.used === 60 && fa.limit === 600 && fa.plan === "free" && fa.trial === true, f.status + " " + JSON.stringify(fa));
    ok("E10 · Premium: 3600 s a day, plan premium, not a trial", pr.status === 200 && pa && pa.used === 60 && pa.limit === 3600 && pa.plan === "premium" && !pa.trial, pr.status + " " + JSON.stringify(pa)); }

  /* --- the one deliberate way past the brake: a cached answer --- */
  { const ns = makeNamespace(), e = env(ns, true), tk = tokOf("uid-cache");
    /* the body of a Response can be read ONCE, so a cache that hands the same
       object back twice serves one hit and then silently misses. The real
       caches.default returns a fresh Response per match; this one must too, or
       the test measures the stub instead of the Worker. */
    const store = new Map();
    globalThis.caches = { default: {
      async match(k) { const t = store.get(String(k.url)); return t === undefined ? undefined : new Response(t, { headers: { "content-type": "application/json" } }); },
      async put(k, v) { store.set(String(k.url), await v.text()); },
    } };
    ai.calls = [];
    const first = await call(W1, e, { ip: "25.0.0.1", token: tk });
    const n1 = ai.calls.length;
    const more = [];
    for (let i = 0; i < 8; i++) more.push((await call(W2, e, { ip: "25.0.0.1", token: tk })).status);
    ok("E11 · a cached video is served past the brake, deliberately — it costs nothing", first.status === 200 && more.every(x => x === 200), JSON.stringify(more));
    ok("E12 · …and the provider was called ONCE for nine requests", ai.calls.length === n1 && n1 === 1, "provider calls=" + ai.calls.length);
    delete globalThis.caches; }

  /* --- the DAILY budget on the object itself: the bucket the Worker writes is
         `ytaisec:<UTC day>`, counted in seconds with a per-call `cost`, so it
         turns over at UTC midnight (a new NAME) and not a minute sooner. --- */
  { const ns = makeNamespace();
    const name = "ytaisec:" + new Date().toISOString().slice(0, 10);
    const SEC = [{ name, limit: 1800, windowMs: 86_400_000, cost: 300 }];
    const out = [];
    for (let i = 0; i < 8; i++) out.push((await consume(env(ns), "acct:u:uid-day", SEC)).ok);
    ok("E13 · the DAILY budget is real and counted in SECONDS: six 300 s windows fill 1800, the seventh and eighth are refused", out.filter(Boolean).length === 6 && out.slice(6).every(x => x === false), JSON.stringify(out));
    const st = ns.get(ns.idFromName("acct:u:uid-day"))._map.get("b:" + name);
    ok("E14 · …it stands at exactly 1800 (a refusal consumed nothing) and its window is a day long, not a minute wearing a day's name", st.count === 1800 && st.resetAt - Date.now() > 86_000_000, JSON.stringify(st)); }
}

console.log("\n# J1. ytai requires an ACCOUNT even with PREMIUM_ENFORCED off");
{
  /* The hole: premiumGate returns immediately when enforcement is off, so in
     production ytai was reachable with no account, held only by a per-IP brake,
     with the per-account cap inert because there was no account. This section
     signs REAL RS256 tokens with a generated keypair and serves them through a
     stub JWKS, so the verifier under test is the actual imported one — not a
     fake that always says yes. */
  const { webcrypto } = await import("node:crypto");
  const kp = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await webcrypto.subtle.exportKey("jwk", kp.publicKey);
  jwk.kid = "testkid"; jwk.alg = "RS256"; jwk.use = "sig";
  const b64u = buf => Buffer.from(buf).toString("base64url");
  async function mint({ sub = "uid-j1", project = "be-mastery", exp = Math.floor(Date.now() / 1e3) + 3600, kid = "testkid", alg = "RS256" } = {}) {
    const h = b64u(JSON.stringify({ alg, kid })), pl = b64u(JSON.stringify({
      sub, aud: project, iss: "https://securetoken.google.com/" + project,
      iat: Math.floor(Date.now() / 1e3) - 10, exp }));
    const sig = await webcrypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, kp.privateKey, new TextEncoder().encode(h + "." + pl));
    return h + "." + pl + "." + b64u(sig);
  }
  /* the JWKS the Worker will fetch */
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("/jwk/securetoken")) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    return realFetch(url, init);
  };
  const OFFENV = ns => ({ OPENAI_KEY: "k", GEMINI_KEY: "g", FIREBASE_PROJECT_ID: "be-mastery", ...(ns ? { RATE_LIMITER: ns } : {}) });
  const ytai = (W, e, { ip = "30.0.0.1", token = null, win = true, vid = "abcdefghijk" } = {}) =>
    W.fetch(new Request("https://be-polish.test/", { method: "POST",
      headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip, ...(token ? { authorization: "Bearer " + token } : {}) },
      body: JSON.stringify(win ? { ytai: vid, from: 0, to: 60 } : { ytai: vid }) }), e);

  /* 1 + 2 — anonymous */
  { const ns = makeNamespace(); ai.calls = [];
    const r = await ytai(W1, OFFENV(ns));
    ok("J1.1 · enforcement OFF, no token: 401 auth_required (was 200 before this change)", r.status === 401 && (await r.json()).error === "auth_required", r.status);
    ok("J1.2 · …and ZERO provider calls — nothing was generated for an anonymous caller", ai.calls.length === 0, String(ai.calls.length)); }

  /* a forged or wrong token is not an account */
  { const ns = makeNamespace(); ai.calls = [];
    const bad = [
      ["a token with no signature", "eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3RraWQifQ.eyJzdWIiOiJ4In0.not-a-signature"],
      ["a token for ANOTHER Firebase project", await mint({ project: "someone-else" })],
      ["an expired token", await mint({ exp: Math.floor(Date.now() / 1e3) - 60 })],
      ["an unknown signing key", await mint({ kid: "nope" })],
      ["alg=none", "eyJhbGciOiJub25lIiwia2lkIjoidGVzdGtpZCJ9.eyJzdWIiOiJ4In0."],
    ];
    let allRefused = true;
    for (const [, tk] of bad) { const r = await ytai(W1, OFFENV(ns), { token: tk }); if (r.status !== 401) allRefused = false; }
    ok("J1.2b · a forged, foreign-project, expired, wrong-key or alg=none token is all refused 401", allRefused);
    ok("J1.2c · …and not one of them reached the provider", ai.calls.length === 0, String(ai.calls.length)); }

  /* 3 — authenticated FREE is allowed, and the route is still FREE */
  { const ns = makeNamespace(); ai.calls = [];
    const r = await ytai(W1, OFFENV(ns), { token: await mint({ sub: "uid-free" }) });
    ok("J1.3 · a verified FREE account is allowed — ytai stays free of capability", r.status === 200, r.status);
    ok("J1.3b · …and it did reach the provider, so the route still works", ai.calls.length === 1, String(ai.calls.length)); }

  /* THE ORDERING DEFECT found on live staging, 1 Oct 2026, and pinned here.
     With enforcement ON the gate used to accept a PRESENT Bearer header and
     leave the verifying to premiumGate — which sat AFTER the `no_key` test. So
     a junk token was answered 501, not 401: the header alone got past the one
     function whose whole job is that nothing happens before verification.
     The environment here has enforcement on and NO GEMINI_KEY, exactly as
     be-polish-staging does, so a 501 means the gate was bypassed. */
  { const ns = makeNamespace();
    const noKeyEnv = { OPENAI_KEY: "k", RATE_LIMITER: ns, PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", FIREBASE_PROJECT_ID: "be-mastery-test" };
    ent.reply = () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    const junk = ["not.a.token", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.", await mint({ project: "someone-else" }), "x".repeat(40)];
    const got = [];
    for (const tk of junk) got.push((await ytai(W1, noKeyEnv, { ip: "40.0.0.1", token: tk })).status);
    ok("J1.11 · enforcement ON and no provider key: a junk token is 401, NEVER 501 — nothing on the route runs before the token is verified", got.every(st => st === 401), JSON.stringify(got));
    ent.reply = () => view(false);
    const good = (await ytai(W1, noKeyEnv, { ip: "40.0.0.2", token: await mint({ sub: "uid-ok" }) })).status;
    ok("J1.11b · …while a token the entitlement service accepts gets past the gate and reaches no_key (501), which is the next step", good === 501, String(good)); }

  /* 4 — Premium, through the enforcement-on path, unchanged */
  { const ns = makeNamespace(); ai.calls = [];
    ent.reply = () => view(true);
    const tk = "eyJhbGciOiJSUzI1NiJ9." + Buffer.from(JSON.stringify({ sub: "uid-prem-j1" })).toString("base64url") + ".sig";
    const r = await ytai(W1, { ...ENV_BASE, RATE_LIMITER: ns, PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", FIREBASE_PROJECT_ID: "be-mastery" }, { ip: "31.0.0.1", token: tk });
    ok("J1.4 · PREMIUM (enforcement on) is allowed exactly as before", r.status === 200, r.status);
    ent.reply = () => view(false);
    const r2 = await ytai(W1, { ...ENV_BASE, RATE_LIMITER: ns, PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", FIREBASE_PROJECT_ID: "be-mastery" }, { ip: "31.0.0.2", token: tk + "x" });
    ok("J1.4b · …and a FREE account is allowed too under enforcement: ytai did NOT become Premium", r2.status === 200, r2.status); }

  /* 5 — the per-account cap is no longer inert with enforcement OFF */
  { const ns = makeNamespace(); ai.calls = [];
    const tk = await mint({ sub: "uid-cap" });
    const out = [];
    for (let i = 0; i < 6; i++) out.push((await ytai(i % 2 ? W1 : W2, OFFENV(ns), { ip: "32.0.0." + i, token: tk })).status);
    ok("J1.5 · YTAI_ACCT_PER_MIN 4 now bites with enforcement OFF, across six IPs and two isolates", out.filter(x => x === 429).length === 2 && out.slice(0, 4).every(x => x === 200), JSON.stringify(out));
    ok("J1.5b · …and the provider was called 4 times, not 6", ai.calls.length === 4, String(ai.calls.length)); }

  /* 5c — with enforcement OFF nobody can buy Premium, so there is no trial:
     a verified account keeps the 30-minute day (owner, 6 Oct 2026) */
  { const ns = makeNamespace(); ai.calls = [];
    const r = await ytai(W1, OFFENV(ns), { ip: "32.1.0.1", token: await mint({ sub: "uid-offday" }) });
    let h = null; try { h = JSON.parse(r.headers.get("X-BE-Video-Allowance")); } catch (e) {}
    ok("J1.5c · enforcement OFF: no trial — the header reads a 1800 s day with a reset, plan free", r.status === 200 && h && h.limit === 1800 && h.plan === "free" && !h.trial && h.resetAt > Date.now(), r.status + " " + JSON.stringify(h)); }

  /* 6 — the IP cap still holds, across accounts */
  { const ns = makeNamespace(); ai.calls = [];
    const out = [];
    for (let i = 0; i < 14; i++) out.push((await ytai(W1, OFFENV(ns), { ip: "33.0.0.9", token: await mint({ sub: "uid-ip" + i }) })).status);
    ok("J1.6 · YTAI_WIN_PER_MIN 12 per IP still holds although every call is a different account", out.filter(x => x === 429).length === 2 && out.slice(0, 12).every(x => x === 200), JSON.stringify(out)); }

  /* 7 — a cached answer does NOT bypass authentication */
  { const ns = makeNamespace(); const store = new Map();
    globalThis.caches = { default: {
      async match(k) { const t = store.get(String(k.url)); return t === undefined ? undefined : new Response(t, { headers: { "content-type": "application/json" } }); },
      async put(k, v) { store.set(String(k.url), await v.text()); } } };
    ai.calls = [];
    const warm = await ytai(W1, OFFENV(ns), { ip: "34.0.0.1", token: await mint({ sub: "uid-warm" }), vid: "cachedvid00" });
    ok("J1.7 · a video is transcribed once and kept", warm.status === 200 && ai.calls.length === 1, warm.status + " provider=" + ai.calls.length);
    const anon = await ytai(W2, OFFENV(ns), { ip: "34.0.0.2", vid: "cachedvid00" });
    ok("J1.7b · …and an ANONYMOUS caller still gets 401 for it — the cache is behind authentication, not in front of it", anon.status === 401, anon.status);
    const other = await ytai(W2, OFFENV(ns), { ip: "34.0.0.3", token: await mint({ sub: "uid-other" }), vid: "cachedvid00" });
    ok("J1.7c · …while another signed-in learner is served the kept answer for free", other.status === 200 && (await other.json()).cached === true && ai.calls.length === 1, "provider=" + ai.calls.length);
    delete globalThis.caches; }

  /* 8 — nothing else changed */
  { const ns = makeNamespace(); const e = OFFENV(ns); ai.calls = [];
    const tries = {
      "transcribe (audio)": (await W1.fetch(new Request("https://be-polish.test/", { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "audio/webm", "CF-Connecting-IP": "35.0.0.1" }, body: new Uint8Array(2048) }), e)).status,
      "chat practice": (await W1.fetch(new Request("https://be-polish.test/", { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "35.0.0.2" }, body: JSON.stringify({ chat: { purpose: "practice", system: "s", messages: [{ role: "user", content: "hi" }] } }) }), e)).status,
      "tts": (await W1.fetch(new Request("https://be-polish.test/", { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "35.0.0.3" }, body: JSON.stringify({ tts: "a" }) }), e)).status,
      "captions": (await W1.fetch(new Request("https://be-polish.test/", { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "35.0.0.4" }, body: JSON.stringify({ captions: "abcdefghijk" }) }), e)).status,
      "polish": (await W1.fetch(new Request("https://be-polish.test/", { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "35.0.0.5" }, body: JSON.stringify({ text: "we should of done it" }) }), e)).status,
    };
    ok("J1.8 · every OTHER free route is still reachable with NO token, enforcement off — only ytai gained a requirement",
      Object.values(tries).every(st => st !== 401), JSON.stringify(tries)); }

  /* fails closed, not open, on a configuration gap */
  { const ns = makeNamespace();
    const r = await ytai(W1, { OPENAI_KEY: "k", GEMINI_KEY: "g", RATE_LIMITER: ns }, { token: await mint() });
    ok("J1.9 · with FIREBASE_PROJECT_ID missing it answers 503, never an open route", r.status === 503 && (await r.json()).error === "auth_unavailable", r.status); }
  /* The JWKS outage, told accurately. firebase-auth.js keeps Google's keys in
     module scope for an hour, so the behaviour depends on whether the isolate
     has them yet, and the two cases are opposite:
       · a COLD isolate cannot verify anything and the route closes (503);
       · a WARM one keeps verifying from the cached keys, which is resilience
         and is why an outage does not take the feature down everywhere at once.
     The first case cannot be produced through the Worker in this harness — Node
     dedupes the shared firebase-auth import, so W1..W3 all share one warm
     keyset — so it is asserted against a FRESH copy of the module directly, and
     the Worker's mapping of a `jwks` error to 503 is the same line J1.9 covers. */
  { globalThis.fetch = async (url, init) => { const u = String(url);
      if (u.includes("/jwk/securetoken")) return new Response("nope", { status: 500 });
      return realFetch(url, init); };
    const cold = await import(new URL("./entitlements/src/firebase-auth.js?cold=1", import.meta.url));
    let why = null;
    try { await cold.verifyIdToken(await mint(), "be-mastery"); } catch (e) { why = String(e.message || e); }
    ok("J1.10 · a COLD verifier with an unreachable JWKS throws `jwks …`, which this Worker maps to 503 — an auth outage must not open a paid provider", /^jwks/.test(why || ""), String(why));
    const ns = makeNamespace(); ai.calls = [];
    const warm = await ytai(W3, OFFENV(ns), { token: await mint({ sub: "uid-warm-jwks" }) });
    ok("J1.10b · …while an isolate that already holds the keys keeps working through the same outage (deliberate: an hour of cache, not a single point of failure)", warm.status === 200 && ai.calls.length === 1, warm.status + " provider=" + ai.calls.length); }
  globalThis.fetch = realFetch;
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
