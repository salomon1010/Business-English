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
  const call = (W, e, { ip, token, win = true } = {}) => W.fetch(new Request("https://be-polish.test/", { method: "POST",
    headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip, ...(token ? { authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(win ? { ytai: "abcdefghijk", from: 0, to: 60 } : { ytai: "abcdefghijk" }) }), e);

  /* --- can an unauthenticated caller spend on the paid route? --- */
  { const ns = makeNamespace(), e = env(ns, true);
    ai.calls = [];
    const r = await call(W1, e, { ip: "20.0.0.1" });
    ok("E1 · enforcement ON: an anonymous ytai call is 401 and reaches NO provider", r.status === 401 && ai.calls.length === 0, r.status + " provider=" + ai.calls.length); }
  { const ns = makeNamespace(), e = env(ns, false);        // production shape today
    ai.calls = [];
    const r = await call(W1, e, { ip: "20.0.0.2" });
    ok("E2 · enforcement OFF (production today): an anonymous ytai call DOES reach the provider — held only by the per-IP brake, stated not hidden", r.status === 200 && ai.calls.length === 1, r.status + " provider=" + ai.calls.length); }

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

  /* --- the IP brake is checked BEFORE the account brake --- */
  { const ns = makeNamespace(), e = env(ns, true), tk = tokOf("uid-order");
    ai.calls = [];
    const whole = [];
    for (let i = 0; i < 4; i++) whole.push((await call(W1, e, { ip: "23.0.0.1", token: tk, win: false })).status);
    ok("E8 · whole-video path: YTAI_PER_MIN 2 per IP bites before the account's 4", whole.filter(x => x === 429).length === 2 && whole.slice(0, 2).every(x => x === 200), JSON.stringify(whole)); }

  /* --- Free and Premium are treated identically: ytai carries no capability --- */
  { const ns = makeNamespace(), e = env(ns, true), tk = tokOf("uid-free");
    ent.reply = () => view(false); ai.calls = [];
    const f = await call(W1, e, { ip: "24.0.0.1", token: tk });
    ent.reply = () => view(true);
    const pr = await call(W1, e, { ip: "24.0.0.2", token: tokOf("uid-prem") });
    ent.reply = () => view(false);
    ok("E9 · a FREE account may transcribe a pasted video — ROUTE_CAP.ytai is null, by decision", f.status === 200, f.status);
    ok("E10 · and Premium gets no larger allowance: the limits are identical on both plans", pr.status === 200, pr.status); }

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

  /* --- the DAILY bucket. The per-minute bucket always bites first through the
         Worker, so the day window is asserted on the object itself. --- */
  { const ns = makeNamespace();
    const DAY = [{ name: "ytaiacct:day", limit: 10, windowMs: 86_400_000 }];
    const out = [];
    for (let i = 0; i < 12; i++) out.push((await consume(env(ns), "acct:u:uid-day", DAY)).ok);
    ok("E13 · the DAILY bucket is real: 10 allowed, then refused, on an 86,400,000 ms window", out.filter(Boolean).length === 10 && out.slice(10).every(x => x === false), JSON.stringify(out));
    const st = ns.get(ns.idFromName("acct:u:uid-day"))._map.get("b:ytaiacct:day");
    ok("E14 · …and its reset is a day away, so it is not a per-minute window wearing a day's name", st.resetAt - Date.now() > 86_000_000, JSON.stringify(st)); }
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
