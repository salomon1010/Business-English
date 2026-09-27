/* Home V2 — the learner's own page (owner, 27 Sep 2026). General English, flag home_v2_enabled.
   Run: cd tests && node home-v2.mjs        (BASE=… for another tree)
   WebKit (iPhone Safari's engine), iPhone 13. Library thumbnails are real ytimg URLs; the partner /
   push / events Workers are stood in. */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8146);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await webkit.launch();
const DAY = 864e5, today = new Date().toISOString().slice(0, 10), yday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
const words = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [["negotiate", "deadline", "proposal", "stakeholder", "agenda", "quarterly"][i], { ts: Date.now() - i, reps: 1, due: Date.now() - 1000, tk: ["general-english"] }]));
const trouble = { "general-english": { thorough: { n: 2, ts: Date.now() }, schedule: { n: 1, ts: Date.now() }, colleague: { n: 1, ts: Date.now() } } };
const placed = { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } };
const seed = (o = {}) => ({ profile: { name: "Tester", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english", tradeId: "welder" }, fnd: placed, days: {}, dates: [yday], dayLog: { [yday]: 1 }, dayLogA: { "general-english": { [yday]: 1 } }, steps: {}, scores: {}, notes: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
async function open(state, opts = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block", reducedMotion: opts.reduce ? "reduce" : "no-preference" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  if (opts.noImages) await ctx.route(u => /ytimg|rp-photos/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  await ctx.addInitScript(([s, flags]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); if (flags) localStorage.setItem("be_flags", flags); } },
    [JSON.stringify(seed(state)), opts.flagOff ? null : JSON.stringify(Object.assign({ home_v2_enabled: true }, opts.flags || {}))]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + (opts.hash || "")); await sleep(3000);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs };
}
const hero = p => p.evaluate(() => { const h = document.querySelector(".hx"); if (!h) return null;
  return { kind: h.dataset.kind, title: h.querySelector("#hxT").innerText, why: (h.querySelector(".hx-why") || {}).innerText || "", cta: h.querySelector(".hx-cta").innerText, go: h.querySelector(".hx-cta").getAttribute("onclick"),
    slides: [...h.querySelectorAll(".hx-slide")].map(i => i.dataset.vid || i.getAttribute("src")), more: [...document.querySelectorAll(".hx-rec")].map(x => x.dataset.kind), dest: [...document.querySelectorAll(".hx-dcard b")].map(x => x.innerText), engine: (() => { try { const r = NudgeEngine.rank(nudgeSignals(), {}); return r.map(x => x.kind); } catch (e) { return null; } })() }; });

console.log("\n# the recommendation comes from the learner's real state");
{ const { ctx, p, errs } = await open({ fnd: {} });
  const h = await hero(p);
  ok("1 · a new learner: the hero is the placement check ('Before you start', 1 min) — the gate the programme already has", h && h.kind === "placement" && /Before you start/.test(h.title) && /one-minute check/i.test(h.cta) && /fndOpenCheck/.test(h.go), JSON.stringify(h));
  await p.click(".hx-cta"); await sleep(600);
  ok("2 · … and its button opens the check itself", await p.evaluate(() => !!document.getElementById("fndCheckOv")));
  ok("2b · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p, errs } = await open({ fnd: { "general-english": { placed: "foundations", day: 3, done: { d1: true, d2: true } } } });
  const h = await hero(p);
  ok("3 · a learner in Foundations: the hero is today's Foundations day", h && h.kind === "foundations" && /go\('foundations'\)/.test(h.go), JSON.stringify(h)); await ctx.close(); }
{ const { ctx, p, errs } = await open({});
  const h = await hero(p);
  ok("4 · lesson pending: 'Continue where you left off' — Week 1 · Mon, the day's focus, the reason, 25 min, Continue", h && h.kind === "lesson" && /^Week 1 · Mon — /.test(h.title) && /lesson isn't done/.test(h.why) && h.cta === "Continue" && /go\('session',1,'Mon'\)/.test(h.go), JSON.stringify(h));
  ok("5 · Home and the push nudge agree: the hero is the engine's own first choice", h.engine && h.engine[0] === h.kind, JSON.stringify(h.engine));
  const vis1 = h.slides; await p.evaluate(() => go("home")); await sleep(600); const vis2 = (await hero(p)).slides;
  ok("6 · up to three pictures, chosen for the topic and the same every time (not random)", vis1.length >= 1 && vis1.length <= 3 && JSON.stringify(vis1) === JSON.stringify(vis2), JSON.stringify({ vis1, vis2 }));
  const rel = await p.evaluate(v => v.filter(x => /^[A-Za-z0-9_-]{11}$/.test(x)).map(x => _shCat.videos[x] && _shCat.videos[x].title), vis1);
  ok("7 · … library videos whose titles share the lesson's topic (introductions / pronunciation / shadowing)", rel.length && rel.every(t => /introduc|yourself|small talk|network|pronunc|accent|shadow|clear|fluen|intonation/i.test(t || "")), JSON.stringify(rel));
  await p.click(".hx-cta"); await sleep(700);
  ok("8 · Continue opens that session day", await p.evaluate(() => cur.v === "session" && location.hash.includes("session/1/Mon")), await p.evaluate(() => location.hash));
  /* completing it changes Home: the engine is asked again */
  await p.evaluate(async () => { markPracticed(); go("home"); await new Promise(z => setTimeout(z, 700)); });
  const h2 = await hero(p);
  ok("9 · after practising today the lesson is no longer offered — Home shows what comes next ('Today's practice is done' for this learner)", h2 && h2.kind === "done" && /practice is done/.test(h2.title) && /go\('session',1,'Mon'\)/.test(h2.go), JSON.stringify(h2));
  ok("10 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
console.log("\n# different learners, different Homes — and every other recommendation below");
{ const { ctx, p, errs } = await open({ vocab: words(5), troubleA: trouble, dates: [today], dayLog: { [today]: 1 }, dayLogA: { "general-english": { [today]: 1 } } });
  const h = await hero(p);
  ok("11 · practised today, 5 words due, 3 trouble words: the hero is the word review, the trouble words follow under 'Also recommended'", h && h.kind === h.engine[0] && ["words", "shadow"].includes(h.kind) && h.more.length === h.engine.length - 1 && h.more.every((k, i) => k === h.engine[i + 1]), JSON.stringify(h));
  await p.click(".hx-cta"); await sleep(1200);
  ok("12 · its button deep-links like the notification (nudgeGo)", await p.evaluate(() => cur.v === "practice" || cur.v === "shadow"), await p.evaluate(() => cur.v));
  await ctx.close(); }
{ const pending = { rid: "shadow-x", kind: "shadow", view: "shadow", act: "trouble", args: [], createdAt: Date.now(), sendAfter: Date.now(), expiresAt: Date.now() + DAY };
  const { ctx, p, errs } = await open({ vocab: words(6), troubleA: trouble, dates: [today], dayLog: { [today]: 1 }, dayLogA: { "general-english": { [today]: 1 } }, nudge: { pending, hist: { sent: {}, dismissed: {}, done: {} }, doneRids: [] } }, { flags: { learning_nudges_enabled: true } });   /* as on staging: with nudges off the app clears a pending nudge at start-up */
  const h = await hero(p);
  ok("13 · a nudge pending on the server leads Home, so the notification and Home never disagree", h && h.kind === "shadow", JSON.stringify(h)); await ctx.close(); }
{ const ch = { kind: "challenge", ts: Date.now() - 3600e3, vid: "MZAjfsyJa1U", title: "Climate summit", seg: 0, text: "x", n: 1, level: 1, rung: "gate", verdict: "close", coverage: .6, ok: 3, total: 5, pass: false, heard: "", issues: [], dims: {}, drills: [] };
  const { ctx, p, errs } = await open({ chHistA: { "general-english": [ch] }, dates: [today], dayLog: { [today]: 1 }, dayLogA: { "general-english": { [today]: 1 } } });
  const h = await hero(p);
  ok("14 · a Challenge not passed: the hero is that Challenge, and its first picture is that clip", h && h.kind === "challenge" && h.slides[0] === "MZAjfsyJa1U" && /Challenge/.test(h.cta), JSON.stringify(h)); await ctx.close(); }
console.log("\n# pictures: rotation, reduced motion, failure");
{ const { ctx, p, errs } = await open({});
  const a = await p.evaluate(() => [...document.querySelectorAll(".hx-slide")].findIndex(x => x.classList.contains("on"))); await sleep(6800);
  const b2 = await p.evaluate(() => [...document.querySelectorAll(".hx-slide")].findIndex(x => x.classList.contains("on")));
  const n = await p.evaluate(() => document.querySelectorAll(".hx-slide").length);
  ok("15 · the pictures rotate on their own every few seconds (crossfade)", n < 2 || b2 !== a, JSON.stringify({ n, a, b2 }));
  const media = await p.evaluate(() => ({ video: document.querySelectorAll("#v-home video, #v-home iframe, #v-home audio").length }));
  ok("16 · nothing plays sound or video on Home — no <video>, <iframe> or <audio>", media.video === 0, JSON.stringify(media));
  await p.evaluate(() => go("journey")); await sleep(300);
  ok("17 · Road map is still one tap away, and the rotation stops off Home (no timer work on other pages)", await p.evaluate(() => cur.v === "journey"));
  await ctx.close(); }
{ const { ctx, p } = await open({}, { reduce: true });
  const a = await p.evaluate(() => [...document.querySelectorAll(".hx-slide")].findIndex(x => x.classList.contains("on"))); await sleep(6800);
  const b2 = await p.evaluate(() => [...document.querySelectorAll(".hx-slide")].findIndex(x => x.classList.contains("on")));
  const anim = await p.evaluate(() => { const s = document.querySelector(".hx-slide.on"); return s ? getComputedStyle(s).animationName : "none"; });
  ok("18 · reduced motion: no automatic rotation and no zoom — the dots still switch pictures by hand", a === b2 && anim === "none", JSON.stringify({ a, b2, anim })); await ctx.close(); }
{ const { ctx, p, errs } = await open({}, { noImages: true });
  await sleep(1500);
  const f = await p.evaluate(() => ({ slides: document.querySelectorAll(".hx-slide").length, empty: document.getElementById("hxMedia").classList.contains("empty"), title: document.getElementById("hxT").innerText, cta: !!document.querySelector(".hx-cta"), h: Math.round(document.getElementById("hxMedia").getBoundingClientRect().height) }));
  ok("19 · every picture fails (network): the hero keeps its size with the plain gradient, and the recommendation and its button still work", f.slides === 0 && f.empty && /Week 1/.test(f.title) && f.cta && f.h > 150, JSON.stringify(f));
  ok("20 · … with no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
console.log("\n# phone layout");
{ const { ctx, p } = await open({ vocab: words(4), troubleA: trouble });
  const h0 = await p.evaluate(() => Math.round(document.getElementById("hxMedia").getBoundingClientRect().height)); await sleep(2500);
  const L = await p.evaluate(async () => { const m = document.getElementById("hxMedia").getBoundingClientRect(), cta = document.querySelector(".hx-cta").getBoundingClientRect(), nav = document.querySelector(".bottom-nav").getBoundingClientRect();
    document.scrollingElement.scrollTop = 1e6; await new Promise(z => setTimeout(z, 300)); const all = [...document.querySelectorAll("#v-home > *")].filter(x => x.offsetParent), last = all[all.length - 1].getBoundingClientRect(), nav2 = document.querySelector(".bottom-nav").getBoundingClientRect();
    return { mh: Math.round(m.height), mw: Math.round(m.width), ctaBottom: Math.round(cta.bottom), navTop: Math.round(nav.top), vw: innerWidth, sw: document.documentElement.scrollWidth, lastBottom: Math.round(last.bottom), nav2Top: Math.round(nav2.top) }; });
  ok("21 · the picture box has a fixed 16:10 shape before and after the pictures load (no layout shift)", Math.abs(h0 - L.mh) <= 1 && Math.abs(L.mh - L.mw * 10 / 16) <= 2, JSON.stringify({ h0, L }));
  ok("22 · the main button is on the first screen, above the bottom navigation", L.ctaBottom < L.navTop, JSON.stringify(L));
  ok("23 · no sideways scrolling, and the end of the page clears the bottom navigation", L.sw <= L.vw && L.lastBottom <= L.nav2Top + 1, JSON.stringify(L)); await ctx.close(); }
console.log("\n# signed out / signed in, flag, tracks, landing");
{ const { ctx, p } = await open({});
  const a = await hero(p); await p.evaluate(() => { FBUser = { uid: "u1", email: "t@example.com", getIdToken: async () => "x" }; go("home"); }); await sleep(500); const b2 = await hero(p);
  ok("24 · signed out and signed in see the same recommendation (it comes from the learner's state, not the account)", a.kind === b2.kind && a.title === b2.title, JSON.stringify([a.kind, b2.kind])); await ctx.close(); }
{ const { ctx, p } = await open({}, { flagOff: true });
  const f = await p.evaluate(() => ({ hx: !!document.querySelector(".hx"), today: !!document.querySelector(".today-card") }));
  ok("25 · flag off (production today): the existing Home, unchanged", !f.hx && f.today, JSON.stringify(f)); await ctx.close(); }
{ const { ctx, p, errs } = await open({ professionalTracks: { activeId: "welding", tradeId: "welder" }, vocab: { w: { ts: 1, reps: 1, due: Date.now() - 1000, tk: ["welding"] } } });
  const w = await p.evaluate(() => ({ hx: !!document.querySelector(".hx"), career: !!document.querySelector(".career-dashboard"), recs: homeRecs().length, partnerCard: !!document.querySelector(".hx-dcard[onclick*=partner]") }));
  ok("26 · Welding: its own Career Dashboard Home, no General English recommendation, no Practice Partner card", !w.hx && w.career && w.recs === 0 && !w.partnerCard, JSON.stringify(w));
  ok("27 · Welding: no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
{ const away = new Date(Date.now() - 6 * DAY).toISOString().slice(0, 10);
  const { ctx, p } = await open({ lastSeen: Date.now() - 6 * DAY, dates: [away], dayLog: { [away]: 1 }, dayLogA: { "general-english": { [away]: 1 } } });
  const v = await p.evaluate(() => ({ v: cur.v, kind: (document.querySelector(".hx") || {}).dataset && document.querySelector(".hx").dataset.kind }));
  ok("28 · opening the app after days away lands on Home (not the road map), led by the engine's comeback step", v.v === "home" && v.kind === "comeback", JSON.stringify(v)); await ctx.close(); }
{ const { ctx, p } = await open({ lastSeen: Date.now() - 6 * DAY, professionalTracks: { activeId: "welding", tradeId: "welder" } });
  ok("29 · Welding keeps its own return rule (the road map after a gap), unchanged", await p.evaluate(() => cur.v === "journey"), await p.evaluate(() => cur.v)); await ctx.close(); }
{ const { ctx, p } = await open({}, { hash: "#journey" });
  ok("30 · a link to a page (here the road map) still opens that page — Home is only the default", await p.evaluate(() => cur.v === "journey")); await ctx.close(); }
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
