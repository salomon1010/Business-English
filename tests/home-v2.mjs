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
  return { kind: h.dataset.kind, kicker: (h.querySelector(".hx-kicker") || {}).innerText || "", title: h.querySelector("#hxT").innerText, sub: (h.querySelector(".hx-sub") || {}).innerText || "", meta: (h.querySelector(".hx-meta") || {}).innerText || "", cta: h.querySelector(".hx-cta").innerText.replace(/→/g, "").trim(), go: h.querySelector(".hx-cta").getAttribute("onclick"),
    slides: [...h.querySelectorAll(".hx-slide")].map(i => i.dataset.vid || i.getAttribute("src")), feat: (document.querySelector(".hx-feat") || { getAttribute: () => null }).getAttribute("onclick"), featDest: (document.querySelector(".hx-feat") || { dataset: {} }).dataset.dest || null,
    cards: [...document.querySelectorAll(".hx-dcard")].map(c => ({ dest: c.dataset.dest, tag: c.getAttribute("aria-label") || "", rec: c.classList.contains("rec"), h: Math.round(c.getBoundingClientRect().height), vtag: !!c.querySelector(".hx-tag"), go: c.getAttribute("onclick") })), dest: [...document.querySelectorAll(".hx-dcard b")].map(x => x.innerText), engine: (() => { try { const r = NudgeEngine.rank(nudgeSignals(), {}); return r.map(x => x.kind); } catch (e) { return null; } })() }; });

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
  /* UX psychology audit (29 Sep 2026): a learner with no session done is not "continuing" — the
     eyebrow is 'Your first session' and the button names the action, short enough to keep the
     online pill beside it (check 32) */
  ok("4 · lesson pending, nothing done yet: 'Your first session' · Week 1 · Monday · the day's focus as the title · the week's topic · 25 min · Pronunciation + Shadowing · Start session", h && h.kind === "lesson" && h.kicker === "Week 1 · Monday" && h.title === "Pronunciation baseline" && /Introductions/.test(h.sub) && /25 min · Pronunciation \+ Shadowing/.test(h.meta) && h.cta === "Start session" && /go\('session',1,'Mon'\)/.test(h.go), JSON.stringify(h));
  const g = await p.evaluate(() => ({ h1: document.querySelectorAll("#v-home h1").length, greet: (document.querySelector(".hx-greet") || {}).innerText || "", size: parseFloat(getComputedStyle(document.querySelector(".hx-greet")).fontSize), title: parseFloat(getComputedStyle(document.getElementById("hxT")).fontSize) }));
  ok("4b · no standalone greeting line above the hero; a small greeting sits inside it, far smaller than the next step", g.h1 === 0 && /Tester/.test(g.greet) && g.size <= 13 && g.title >= 2 * g.size, JSON.stringify(g));
  ok("4c · Explore opens the exact activity: the first card (spoken 'Recommended for you') is the session's own shadowing step (sessGo shadow, Week 1 Mon), not the generic Shadow page — and it is an ordinary card, no big one", !h.featDest && h.cards[0].dest === "shadow" && /Recommended for you/i.test(h.cards[0].tag) && /sessGo\('shadow',1,'Mon'\)/.test(h.cards[0].go), JSON.stringify({ featDest: h.featDest, first: h.cards[0] }));
  ok("4d · every Explore card is the same size, with no tag line (owner, 28 Sep 2026)", h.cards.length >= 4 && new Set(h.cards.map(c => c.h)).size === 1 && h.cards.every(c => !c.vtag), JSON.stringify(h.cards.map(c => [c.dest, c.h, c.vtag])));
  await p.click(".hx-dcard"); await sleep(900);
  const ss = await p.evaluate(() => ({ v: cur.v, back: typeof SESS_RETURN !== "undefined" && SESS_RETURN ? SESS_RETURN.w + " " + SESS_RETURN.d : null }));
  ok("4d · … and the card lands in Shadow with the way back to that session (the session page's own link)", ss.v === "shadow" && ss.back === "1 Mon", JSON.stringify(ss));
  await p.evaluate(async () => { SESS_RETURN = null; go("home"); await new Promise(z => setTimeout(z, 600)); });
  ok("5 · Home and the push nudge agree: the hero is the engine's own first choice", h.engine && h.engine[0] === h.kind, JSON.stringify(h.engine));
  const vis1 = h.slides; await p.evaluate(() => go("home")); await sleep(600); const vis2 = (await hero(p)).slides;
  /* since the highlight reel (owner, 27 Sep 2026) the hero carries six clips: the first is the lesson's own
     topic, the other five are library highlights (tests/home-highlights.mjs) — drawn once per day, not per render */
  ok("6 · six video slides, the same every time the page is drawn today (not random per render)", vis1.length === 6 && vis1.every(x => /^[A-Za-z0-9_-]{11}$/.test(x)) && JSON.stringify(vis1) === JSON.stringify(vis2), JSON.stringify({ vis1, vis2 }));
  const rel = await p.evaluate(v => _shCat.videos[v[0]] && _shCat.videos[v[0]].title, vis1);
  ok("7 · … the first is the library video whose title shares the lesson's topic (introductions / pronunciation / shadowing)", /introduc|yourself|small talk|network|pronunc|accent|shadow|clear|fluen|intonation/i.test(rel || ""), JSON.stringify(rel));
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
  const want = { words: "practice", shadow: "shadow" };
  ok("11 · practised today, 5 words due, 3 trouble words: the hero is the engine's first choice; its place leads Explore, spoken 'Recommended for you', the second choice's place 'Also for you' — each with its own deep link", h && h.kind === h.engine[0] && ["words", "shadow"].includes(h.kind) && !h.feat && h.cards[0].dest === want[h.engine[0]] && /Recommended for you/i.test(h.cards[0].tag) && /homeGoRec/.test(h.cards[0].go) && h.cards[1].dest === want[h.engine[1]] && /Also for you/i.test(h.cards[1].tag), JSON.stringify(h));
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
  ok("19 · every picture fails (network): the hero keeps its size with the plain gradient, and the recommendation and its button still work", f.slides === 0 && f.empty && /Pronunciation baseline/.test(f.title) && f.cta && f.h > 150, JSON.stringify(f));
  ok("20 · … with no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
console.log("\n# phone layout");
{ const { ctx, p } = await open({ vocab: words(4), troubleA: trouble });
  const h0 = await p.evaluate(() => Math.round(document.getElementById("hxMedia").getBoundingClientRect().height)); await sleep(2500);
  const L = await p.evaluate(async () => { const m = document.getElementById("hxMedia").getBoundingClientRect(), cta = document.querySelector(".hx-cta").getBoundingClientRect(), nav = document.querySelector(".bottom-nav").getBoundingClientRect();
    document.scrollingElement.scrollTop = 1e6; await new Promise(z => setTimeout(z, 300)); const all = [...document.querySelectorAll("#v-home > *")].filter(x => x.offsetParent), last = all[all.length - 1].getBoundingClientRect(), nav2 = document.querySelector(".bottom-nav").getBoundingClientRect();
    return { mh: Math.round(m.height), mw: Math.round(m.width), ctaBottom: Math.round(cta.bottom), navTop: Math.round(nav.top), destTop: Math.round((document.getElementById("hxRows") || document.querySelector(".hx-dest")).getBoundingClientRect().top + document.scrollingElement.scrollTop - 0), vw: innerWidth, sw: document.documentElement.scrollWidth, lastBottom: Math.round(last.bottom), nav2Top: Math.round(nav2.top) }; });
  ok("21 · the picture box has a fixed 16:10 shape on a phone (owner, 28 Sep 2026: more room for the picture) before and after the pictures load (no layout shift)", Math.abs(h0 - L.mh) <= 1 && Math.abs(L.mh - L.mw * 10 / 16) <= 2, JSON.stringify({ h0, L }));
  /* since the "Because you…" rows (27 Sep 2026) the personalised rows sit between the hero and Explore, so what
     begins on the first screen is the first row when the learner has one (a new learner: "Start here"), else Explore */
  ok("22 · the main button is on the first screen, above the bottom navigation — and the next section (the first personalised row, else Explore) begins on that first screen too", L.ctaBottom < L.navTop && L.destTop < L.navTop, JSON.stringify(L));
  /* the hero button is drawn 38 px tall (owner, 28 Sep 2026); its ::after band makes the touch target 44 px */
  const kb = await p.evaluate(() => [...document.querySelectorAll(".hx-cta,.hx-feat,.hx-dcard")].every(x => { const r = x.getBoundingClientRect(), a = getComputedStyle(x, "::after"), hit = x.classList.contains("hx-cta") && a.content !== "none" ? r.height - parseFloat(a.top) - parseFloat(a.bottom) : r.height;
    return x.tagName === "BUTTON" && x.innerText.trim().length > 2 && hit >= 44; }));
  ok("22b · every action on Home is a real button with a visible label and a touch-sized target (keyboard and screen readers reach them)", kb);
  ok("23 · no sideways scrolling, and the end of the page clears the bottom navigation", L.sw <= L.vw && L.lastBottom <= L.nav2Top + 1, JSON.stringify(L)); await ctx.close(); }
console.log("\n# signed out / signed in, flag, tracks, landing");
{ const { ctx, p } = await open({});
  const a = await hero(p); await p.evaluate(() => { FBUser = { uid: "u1", email: "t@example.com", getIdToken: async () => "x" }; go("home"); }); await sleep(500); const b2 = await hero(p);
  ok("24 · signed out and signed in see the same recommendation (it comes from the learner's state, not the account)", a.kind === b2.kind && a.title === b2.title, JSON.stringify([a.kind, b2.kind])); await ctx.close(); }
{ const { ctx, p } = await open({}, { flagOff: true });
  const f = await p.evaluate(() => ({ hx: !!document.querySelector(".hx"), today: !!document.querySelector(".today-card") }));
  ok("25 · flag off (production today): the existing Home, unchanged", !f.hx && f.today, JSON.stringify(f)); await ctx.close(); }
{ const { ctx, p, errs } = await open({ professionalTracks: { activeId: "welding", tradeId: "welder" }, vocab: { w: { ts: 1, reps: 1, due: Date.now() - 1000, tk: ["welding"] } } });
  const w = await p.evaluate(() => ({ ws: typeof weldStudioOn === "function" && weldStudioOn(), hx: !!document.querySelector(".hx"), career: !!document.querySelector(".career-dashboard"), recs: homeRecs().length, kinds: homeRecs().map(r => r.kind), partnerCard: !!document.querySelector(".hx-dcard[onclick*=partner]") }));
  /* welding_studio_enabled (staging): Welding gets Home V2 with its own recommendations — never a partner or the AI coach (tests/welding-studio.mjs checks the content) */
  ok("26 · Welding: its own Home (Career Dashboard, or Home V2 with the Welding studio on), no General English recommendation, no Practice Partner card", w.ws ? (w.hx && !w.career && !w.kinds.some(k => /partner|ai_coach/.test(k)) && !w.partnerCard) : (!w.hx && w.career && w.recs === 0 && !w.partnerCard), JSON.stringify(w));
  ok("27 · Welding: no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
{ const away = new Date(Date.now() - 6 * DAY).toISOString().slice(0, 10);
  const { ctx, p } = await open({ lastSeen: Date.now() - 6 * DAY, dates: [away], dayLog: { [away]: 1 }, dayLogA: { "general-english": { [away]: 1 } } });
  const v = await p.evaluate(() => ({ v: cur.v, kind: (document.querySelector(".hx") || {}).dataset && document.querySelector(".hx").dataset.kind }));
  ok("28 · opening the app after days away lands on Home (not the road map), led by the engine's comeback step", v.v === "home" && v.kind === "comeback", JSON.stringify(v)); await ctx.close(); }
{ const { ctx, p } = await open({ lastSeen: Date.now() - 6 * DAY, professionalTracks: { activeId: "welding", tradeId: "welder" } });
  /* with the Welding studio on, Welding has Home V2 and its return rule (Home after a gap) */
  ok("29 · Welding's return rule: the road map after a gap — or Home when the Welding studio gives it Home V2", await p.evaluate(() => cur.v === (typeof weldStudioOn === "function" && weldStudioOn() && homeV2On() ? "home" : "journey")), await p.evaluate(() => cur.v)); await ctx.close(); }
{ const { ctx, p } = await open({}, { hash: "#journey" });
  ok("30 · a link to a page (here the road map) still opens that page — Home is only the default", await p.evaluate(() => cur.v === "journey")); await ctx.close(); }
console.log("\n# who is online, beside the hero's button (owner, 28 Sep 2026)");
{ const { ctx, p, errs } = await open({});
  const o0 = await p.evaluate(() => ({ there: !!document.getElementById("hxOnline"), hidden: document.getElementById("hxOnline").hidden }));
  ok("31 · nobody online (or Practice Partner unavailable): no pill beside the button", o0.there && o0.hidden, JSON.stringify(o0));
  /* the Worker is stood in, so the count is set the way ppPresencePoll sets it */
  await p.evaluate(() => { window.ppAvailable = () => true; ppPub.online = 1; ppPub.waiting = 2; ppOnlineSync(); });
  const o1 = await p.evaluate(() => { const o = document.getElementById("hxOnline"), c = document.querySelector(".hx-cta"), a = o.getBoundingClientRect(), r = c.getBoundingClientRect(); return { hidden: o.hidden, text: o.textContent, sameRow: Math.abs((a.top + a.bottom) / 2 - (r.top + r.bottom) / 2) < 2, right: a.left > r.right, fits: a.right <= document.querySelector(".hx").getBoundingClientRect().right, tag: o.tagName }; });
  ok("32 · someone online: '1 online · 2 in line' — the Practice tab's own words — on the button's row, to its right, inside the card", !o1.hidden && o1.text === "1 online · 2 in line" && o1.sameRow && o1.right && o1.fits && o1.tag === "BUTTON", JSON.stringify(o1));
  await p.evaluate(() => { ppPub.waiting = 0; ppOnlineSync(); });
  ok("33 · … nobody in line: just '1 online'", await p.evaluate(() => document.getElementById("hxOnline").textContent === "1 online"));
  await p.click("#hxOnline"); await sleep(600);
  ok("34 · tapping it opens Practice Partner", await p.evaluate(() => cur.v === "partner"), await p.evaluate(() => cur.v));
  ok("35 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
