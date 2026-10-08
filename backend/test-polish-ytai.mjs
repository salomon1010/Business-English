/* be-polish — the Gemini transcript route, windows and edge cache (27 Sep 2026).
   Run: node backend/test-polish-ytai.mjs
   The Worker module in Node, Gemini and caches.default replaced by stand-ins:
   no key, no network, no cost. */
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };

/* caches.default: a Map keyed by URL */
const store = new Map();
globalThis.caches = { default: {
  async match(req) { const r = store.get(req.url); return r ? new Response(r, { headers: { "content-type": "application/json" } }) : undefined; },
  async put(req, resp) { store.set(req.url, await resp.text()); },
} };
/* Gemini: answers from `gem.reply(body)`; every call is recorded */
const gem = { calls: [], reply: null };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  /* J1 (1 Oct 2026): `ytai` now requires a verified account in EVERY
     configuration, because it is the one free route that spends money per call.
     This suite is about windows and the edge cache, not about authentication,
     so it runs in the enforcement-on shape with be-entitlements stubbed — the
     cheapest way to satisfy the new requirement without re-testing it here.
     tests/../backend/test-rate-limit.mjs section J1 is where the requirement
     itself is proved, including that an anonymous caller gets 401 and spends
     nothing. */
  if (String(url).includes("/v1/entitlement")) {
    /* a PREMIUM view: the older-app checks send a whole video (1800 s), which
       is more than the Free trial (owner, 6 Oct 2026). Plans are tested in
       test-rate-limit.mjs and test-ytai-tiers.mjs, not here. */
    return new Response(JSON.stringify({ plan: "premium", paid: true, capabilities: { ad_free: true, ai_analysis: true, advanced_progress: true, ai_coach: true, recommended_content: true } }), { status: 200 });
  }
  if (String(url).includes("generativelanguage.googleapis.com")) {
    const body = JSON.parse(init.body); gem.calls.push(body);
    const cues = gem.reply(body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ cues }) }] } }] }), { status: 200 });
  }
  return realFetch(url, init);
};
const W = (await import(new URL("./polish-worker.js", import.meta.url))).default;
const env = { GEMINI_KEY: "test-key", PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test" };
let ipN = 0, tokN = 0;
/* one account per call by default, so the per-account ytai cap (4/min) does not
   become the thing this suite measures */
const ask = async (body, ip, token) => {
  const tok = token || ("eyJhbGciOiJSUzI1NiJ9." + Buffer.from(JSON.stringify({ sub: "uid-ytai-" + (++tokN) })).toString("base64url") + ".sig");
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip || "10.0.0." + (++ipN), authorization: "Bearer " + tok }, body: JSON.stringify(body) }), env);
  return { status: r.status, j: await r.json().catch(() => null) };
};
const mmss = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
const offsets = b => b.contents[0].parts[0].videoMetadata;

console.log("\n# a window");
gem.reply = b => { const m = offsets(b), from = parseInt(m.startOffset), to = parseInt(m.endOffset); const out = []; for (let t = from; t < to; t += 20) out.push({ ts: mmss(t), txt: "line at " + t }); return out; };
{
  const a = await ask({ ytai: "abcdefghijk", from: 0, to: 60 });
  ok("W1 · { from:0, to:60 } asks Gemini for 0–60 s only, with the clip prompt", gem.calls.length === 1 && offsets(gem.calls[0]).startOffset === "0s" && offsets(gem.calls[0]).endOffset === "60s" && /START OF THE VIDEO/.test(gem.calls[0].contents[0].parts[1].text), JSON.stringify(gem.calls[0] && offsets(gem.calls[0])));
  ok("W2 · the answer carries the window and only its lines", a.status === 200 && JSON.stringify(a.j.win) === "[0,60]" && a.j.cues.length === 3 && a.j.cues.every(c => c.t < 60), JSON.stringify(a.j));
  const b = await ask({ ytai: "abcdefghijk", from: 0, to: 60 });
  ok("W3 · the same window again is served from the edge cache: no second Gemini call", b.status === 200 && b.j.cached === true && gem.calls.length === 1 && b.j.cues.length === 3, JSON.stringify({ calls: gem.calls.length, b: b.j }));
  const c = await ask({ ytai: "abcdefghijk", from: 60, to: 360 });
  ok("W4 · a later window keeps absolute times (60 s onwards)", c.status === 200 && c.j.cues[0].t === 60 && c.j.cues.every(x => x.t >= 60 && x.t < 360), JSON.stringify(c.j.cues.slice(0, 3)));
  const d = await ask({ ytai: "abcdefghijk", from: 60, to: 5000 });
  ok("W5 · a window is capped at 5 minutes", offsets(gem.calls.at(-1)).endOffset === "360s" && JSON.stringify(d.j.win) === "[60,360]", JSON.stringify(offsets(gem.calls.at(-1))));
}
console.log("\n# clip-relative answers are moved to video time");
{
  gem.reply = () => [{ ts: "00:02", txt: "first" }, { ts: "01:10", txt: "second" }];
  const a = await ask({ ytai: "rel00000000", from: 300, to: 420 });
  ok("R1 · times that start from the clip (00:02, 01:10 in a 300–420 s window) become 302 and 370", a.status === 200 && a.j.cues.map(c => c.t).join(",") === "302,370", JSON.stringify(a.j));
  gem.reply = () => [{ ts: "05:02", txt: "first" }, { ts: "06:10", txt: "second" }];
  const b = await ask({ ytai: "abs00000000", from: 300, to: 420 });
  ok("R2 · times already from the start of the video stay as they are", b.j.cues.map(c => c.t).join(",") === "302,370", JSON.stringify(b.j));
  gem.reply = () => [{ ts: "00:02", txt: "first" }];
  const c = await ask({ ytai: "early000000", from: 0, to: 60 });
  ok("R3 · the first window is never shifted", c.j.cues[0].t === 2, JSON.stringify(c.j));
}
console.log("\n# older apps and bad input");
{
  gem.reply = () => [{ ts: "00:00", txt: "a" }, { ts: "12:00", txt: "b" }];
  const n = gem.calls.length;
  const a = await ask({ ytai: "whole000000", dur: 120 });
  ok("O1 · no `to` (the app before this change): the whole video, as before, with no window in the answer", offsets(gem.calls[n]).endOffset === "1800s" && a.j.cues.length === 2 && !a.j.win, JSON.stringify(a.j));
  const b = await ask({ ytai: "whole000000", dur: 120 });
  ok("O2 · the whole-video answer is cached too", b.j.cached === true && gem.calls.length === n + 1);
  const c = await ask({ ytai: "abcdefghijk", from: 100, to: 50 });
  const d = await ask({ ytai: "abcdefghijk", from: 1800, to: 1900 });
  ok("O3 · a window that ends before it starts, or starts past the 30-minute cap, is refused (400) without a call", c.status === 400 && d.status === 400 && gem.calls.length === n + 1, JSON.stringify([c, d]));
}
console.log("\n# the brake");
{
  gem.reply = b => [{ ts: mmss(parseInt(offsets(b).startOffset)), txt: "x" }];
  const ip = "10.9.9.9", st = [];
  for (let i = 0; i < 13; i++) st.push((await ask({ ytai: "brake000000", from: i * 60, to: i * 60 + 60 }, ip)).status);
  ok("B1 · windows have their own brake: 12 a minute from one address, the 13th is 429", st.slice(0, 12).every(s => s === 200) && st[12] === 429, st.join(","));
  const again = await ask({ ytai: "brake000000", from: 0, to: 60 }, ip);
  ok("B2 · a cached window is still served while the brake is on (it costs nothing)", again.status === 200 && again.j.cached === true, JSON.stringify(again));
  const w = [];
  for (let i = 0; i < 3; i++) w.push((await ask({ ytai: "whole" + i + "11111" }, "10.8.8.8")).status);
  ok("B3 · whole-video calls keep their old brake (2 a minute)", w.join(",") === "200,200,429", w.join(","));
}
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
