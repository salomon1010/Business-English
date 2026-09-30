/* Navigation, final UX pass (29 Sep 2026, feature/bemastery-complete-ux-redesign).
   The owner kept the six tabs; Home is found through its one permanent control, the logo.
   Run: cd tests && node nav-final.mjs   (BASE=… for another tree; PORT=… for the server it starts) */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8151);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await webkit.launch();
const DAY = 864e5, d = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const F = (o = {}) => ({ placed: "full", finished: true, day: 1, done: {}, ...o });
const seed = (area, o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: area, tradeId: "welder" }, fnd: { "general-english": F(), welding: F() }, areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
const ge3 = { days: { w1Mon: true, w1Tue: true, w1Wed: true }, dates: [d(1)], dayLog: { [d(1)]: 1 }, dayLogA: { "general-english": { [d(1)]: 1 } } };
async function open(state, { w = 390, h = 844, lang = "en", flags = { home_v2_enabled: true }, hash = "", beacons = null } = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800, serviceWorkers: "block" });
  await ctx.route(u => /be-events/.test(u.href), async r => { try { if (beacons) beacons.push(r.request().postData() || "") } catch (e) {} await r.fulfill({ status: 204, body: "" }) });
  await ctx.route(u => /cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s, f]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", f) } }, [JSON.stringify(state), JSON.stringify(flags)]);
  /* record every track() call in the page: sendBeacon is not reliably interceptable in WebKit */
  if (beacons) await ctx.addInitScript(() => { let _t; Object.defineProperty(window, "track", { configurable: true, get() { return _t }, set(fn) { const w = function (n, p) { const top = !window.__trIn; if (top) { try { (window.__tr = window.__tr || []).push({ name: n, props: p }) } catch (e) {} } window.__trIn = true; try { return fn.apply(this, arguments) } finally { if (top) window.__trIn = false } }; w.geGuard = fn && fn.geGuard; _t = w } }) });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + hash); await sleep(2000);
  if (lang !== "en") { await p.evaluate(l => setLang(l), lang); await sleep(1000); }
  await p.evaluate(() => document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel,#fndCheckOv,.sync-nudge").forEach(e => e.remove()));
  return { ctx, p, errs };
}
const view = async (p, v, a1, a2) => { await p.evaluate(([v, a1, a2]) => { document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel,#fndCheckOv,.sync-nudge").forEach(e => e.remove()); go(v, a1, a2); scrollTo(0, 0) }, [v, a1, a2]); await sleep(1000); };
const jsErr = errs => errs.filter(e => !/MIME type/.test(e));
const brand = p => p.evaluate(() => { const b = document.querySelector(".brand"); return { on: b.classList.contains("on"), cur: b.getAttribute("aria-current"), name: b.getAttribute("aria-label"), chip: !!b.querySelector(".brand-home"), track: (b.querySelector("#brandTrack") || {}).textContent } });
/* the header avatar that replaced the Home chip (owner, 30 Sep 2026) */
const hdrAva = p => p.evaluate(() => { const a = document.getElementById("hdrAva"); if (!a) return null; const q = a.getBoundingClientRect(); return { initial: a.querySelector("#hdrAvaIn").textContent.trim(), name: a.getAttribute("aria-label"), on: a.classList.contains("on"), cur: a.getAttribute("aria-current"), round: getComputedStyle(a).borderRadius, right: Math.round(innerWidth - q.right), w: Math.round(q.width) } });

console.log("\n# the six tabs stay; Home is not a seventh");
{ const { ctx, p, errs } = await open(seed("general-english", ge3), { w: 375 });
  const m = await p.evaluate(() => ({ tabs: [...document.querySelectorAll(".bottom-nav .bnav-item")].map(x => x.dataset.v + ":" + x.innerText.trim()), home: !!document.querySelector('.bottom-nav [data-v="home"]') }));
  ok("1 · phone: Road map · Shadow · Phrase Lab · Practice · Progress · Profile, and no Home tab", m.tabs.join("|") === "journey:Road map|shadow:Shadow|phrases:Phrase Lab|practice:Practice|review:Progress|profile:Profile" && !m.home, JSON.stringify(m));
  ok("1b · no JavaScript errors", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", ge3), { w: 1280, h: 800 }); await view(p, "review");
  const m = await p.evaluate(() => ({ tabs: [...document.querySelectorAll(".nav-in button.tab")].map(x => x.dataset.v + ":" + x.innerText.trim()), on: (document.querySelector(".nav-in button.tab.on") || {}).dataset?.v, bar: getComputedStyle(document.querySelector(".bottom-nav")).display }));
  ok("2 · desktop: its own header tabs (order kept), the Progress page named 'Progress' there too (was 'Reviews'), active tab marked, no bottom bar", m.tabs.join("|") === "journey:Road map|phrases:Phrase Lab|shadow:Shadow Studio|practice:Practice|review:Progress|profile:Profile" && m.on === "review" && m.bar === "none", JSON.stringify(m));
  await p.evaluate(() => { document.querySelector(".brand").focus() }); await p.keyboard.press("Enter"); await sleep(900);
  ok("3 · desktop keyboard: focus the logo, press Enter → Home", await p.evaluate(() => cur.v === "home"));
  await ctx.close(); }
/* 821–1023px: the header row once scrolled Profile off the edge in French, Russian, Japanese… (29 Sep 2026) */
for (const [w, lang] of [[821, "ru"], [834, "fr"], [834, "ja"], [900, "fr"]]) {
  const { ctx, p } = await open(seed("general-english", ge3), { w, h: 900, lang }); await view(p, "review");
  const r = await p.evaluate(() => { const n = document.querySelector(".nav-in"), t = [...n.querySelectorAll(".tab")].filter(x => x.offsetParent); return { over: n.scrollWidth - n.clientWidth, n: t.length, off: t.filter(x => { const q = x.getBoundingClientRect(); return q.right > innerWidth + .5 || q.left < -.5 }).map(x => x.dataset.v), h: Math.min(...t.map(x => Math.round(x.getBoundingClientRect().height))), lbl: t.every(x => x.innerText.trim().length > 1) } });
  ok(`3b · ${w}px ${lang}: all six header tabs fit on screen with their labels (no sideways scroll), targets ≥24px`, r.n === 6 && r.over <= 0 && !r.off.length && r.h >= 24 && r.lbl, JSON.stringify(r)); await ctx.close(); }

console.log("\n# the lockup is still the way Home, without a Home chip of its own (owner, 30 Sep 2026)");
for (const [lang, word] of [["en", "Home"], ["fr", "Accueil"], ["ar", "الرئيسية"]]) {
  const { ctx, p } = await open(seed("general-english", ge3), { lang }); await view(p, "journey");
  const off = await brand(p); await view(p, "home"); const on = await brand(p);
  ok(`4 · ${lang}: no 'Home' chip in the header; the lockup's accessible name is still '${word}'; 'current page' only on Home`, !off.chip && !on.chip && off.name.includes(word) && !off.on && off.cur === null && on.on && on.cur === "page", JSON.stringify({ off, on }));
  await ctx.close();
}
console.log("\n# the learner's avatar, top right (owner, 30 Sep 2026)");
for (const area of ["general-english", "welding"]) {
  const { ctx, p, errs } = await open(seed(area, ge3), { w: 375 }); await view(p, "journey");
  await p.evaluate(() => { S.profile.name = "Alex"; save(); go("journey") }); await sleep(400);
  const off = await hdrAva(p); await view(p, "profile"); const on = await hdrAva(p);
  ok(`4b · ${area}: a round avatar carrying the learner's initial, flush to the right edge, named Profile`, off && off.initial === "A" && off.round === "50%" && off.name.length > 1 && off.right <= 16 && off.w >= 24, JSON.stringify(off));
  ok(`4c · ${area}: it marks 'current page' on Profile only`, !off.on && off.cur === null && on.on && on.cur === "page", JSON.stringify({ off, on }));
  await p.evaluate(() => go("journey")); await sleep(400);
  await p.click("#hdrAva"); await sleep(900);
  ok(`4d · ${area}: tapping it opens Profile`, await p.evaluate(() => cur.v === "profile"));
  ok(`4e · ${area}: no JavaScript errors`, !jsErr(errs).length, errs.join(" | "));
  await ctx.close();
}
{ const { ctx, p } = await open(seed("general-english", { fnd: { "general-english": F({ placed: "foundations", finished: false, day: 2, done: { d1: true } }) } }));
  await view(p, "foundations"); const f = await brand(p);
  ok("5 · Foundations (a Home page with no tab): the logo shows 'you are here'; no tab lit", f.on && f.cur === "page" && !f.chip && !(await p.evaluate(() => !!document.querySelector(".bnav-item.on"))), JSON.stringify(f));
  await ctx.close(); }
/* a session is drawn by its own go() wrapper, which never reaches the base router (found on the iPhone, 29 Sep 2026) */
for (const area of ["general-english", "welding"]) {
  const { ctx, p } = await open(seed(area, ge3), { flags: {} }); await view(p, "home"); const h = await brand(p);
  await view(p, "session", 1, "Tue"); const s = await brand(p), tab = await p.evaluate(() => (document.querySelector(".bnav-item.on") || {}).dataset?.v || null);
  ok(`5b · ${area}: Home → a session: the logo drops 'current page', the Road map tab is lit`, h.on && h.cur === "page" && !s.on && s.cur === null && tab === "journey", JSON.stringify({ h, s, tab }));
  await ctx.close(); }

console.log("\n# pages with no tab light the tab they belong to");
{ const { ctx, p } = await open(seed("general-english", ge3));
  const lit = async (v, a1, a2) => { await view(p, v, a1, a2); return p.evaluate(() => (document.querySelector(".bnav-item.on") || {}).dataset?.v || null) };
  const r = { session: await lit("session", 1, "Thu"), week: await lit("journey", 1), phrasebank: await lit("phrasebank", 1), partner: await lit("partner"), data: await lit("data") };
  ok("6 · session → Road map, a week page → Road map, phrase bank → Phrase Lab, partner → Practice, settings → Profile", r.session === "journey" && r.week === "journey" && r.phrasebank === "phrases" && r.partner === "practice" && r.data === "profile", JSON.stringify(r));
  /* the lit tab is the one announced as the current page, on the phone bar and the desktop header */
  const cur = async (v, a1, a2) => { await view(p, v, a1, a2); return p.evaluate(() => ({ b: [...document.querySelectorAll(".bnav-item[aria-current=page]")].map(x => x.dataset.v), bOn: [...document.querySelectorAll(".bnav-item.on")].map(x => x.dataset.v), d: [...document.querySelectorAll(".nav-in .tab[aria-current=page]")].map(x => x.dataset.v), brand: document.querySelector(".brand").getAttribute("aria-current") })) };
  const a = { review: await cur("review"), session: await cur("session", 1, "Thu"), phrasebank: await cur("phrasebank", 1), home: await cur("home") };
  ok("6b · aria-current=page sits on exactly the lit tab (phone and desktop), and on the logo only on Home", a.review.b.join() === "review" && a.review.d.join() === "review" && !a.review.brand && a.session.b.join() === "journey" && a.session.d.join() === "journey" && a.phrasebank.b.join() === "phrases" && a.home.b.length === 0 && a.home.d.length === 0 && a.home.brand === "page" && Object.values(a).every(x => x.b.join() === x.bOn.join()), JSON.stringify(a));
  await ctx.close(); }

console.log("\n# Road map: the same step as Home, told as a place on the journey");
{ const { ctx, p } = await open(seed("general-english", ge3)); await view(p, "journey");
  const r = await p.evaluate(() => { const x = document.querySelector("#v-journey .rm2-today"); return { k: x.querySelector(".rm2-today-k").innerText, pos: x.querySelector(".rm2-today-pos").innerText, pin: !!x.closest(".rm2-cta"), hero: !!document.querySelector("#v-journey .hx") } });
  ok("7 · 'Week 1 · Thursday', 'Session 4 of 7 in Week 1' (real counts), carried by the Road map button — not Home's hero card", r.k === "Week 1 · Thursday" && r.pos === "Session 4 of 7 in Week 1" && r.pin && !r.hero, JSON.stringify(r));
  await ctx.close(); }

console.log("\n# Phrase Lab: Executive Polish and the week's phrases, from the tab itself");
for (const lang of ["en", "ar"]) {
  const { ctx, p } = await open(seed("general-english", { ...ge3, days: { ...ge3.days, w1Thu: true, w1Fri: true, w1Sat: true, w1Sun: true, w2Mon: true } }), { lang }); await view(p, "phrases");
  const r = await p.evaluate(() => { const x = document.querySelector("#v-phrases .ph-bank-row"); return x && { t: x.innerText.replace(/\s+/g, " ").trim(), go: x.getAttribute("onclick"), polish: !!document.querySelector("#v-phrases .ex-polish,#v-phrases [class*=ex-]"), chev: getComputedStyle(x.querySelector(".pf-chev")).transform } });
  ok(`8 · ${lang}: under Executive Polish, a row to this week's phrases & idioms (the learner's week, 2)${lang === "ar" ? ", chevron mirrored" : ""}`, r && r.polish && /go\('phrasebank',2\)/.test(r.go) && (lang === "en" ? /Open this week's phrases & idioms Week 2/.test(r.t) : /matrix\(-1/.test(r.chev)), JSON.stringify(r));
  if (lang === "en") { await p.click("#v-phrases .ph-bank-row"); await sleep(900); ok("8b · tapping it opens the phrase bank on Week 2", await p.evaluate(() => cur.v === "phrasebank" && String(cur.arg1) === "2")); }
  await ctx.close();
}

console.log("\n# Welding: each session button names where it goes");
{ const days = {}; for (const x of ["Mon", "Tue", "Wed", "Thu", "Fri"]) days["welding:w1" + x] = true;
  for (const lang of ["en", "fr"]) {
    const { ctx, p } = await open(seed("welding", { days }), { flags: {}, lang });
    const out = {};
    for (const dd of ["Wed", "Thu", "Sat"]) { await view(p, "session", 1, dd); out[dd] = await p.evaluate(() => { const j = document.querySelector(".sess-jump"); return j ? { t: j.innerText.replace(/[→←\s]+$/, "").trim(), go: j.getAttribute("onclick") } : null }); }
    const want = lang === "en" ? { Wed: "Open the Phrase Lab", Thu: "Practise with your AI mentor", Sat: "Open the workplace simulation" } : { Wed: null, Thu: "S'entraîner avec votre mentor IA", Sat: "Ouvrir la simulation de travail" };
    ok(`9 · ${lang}: Wednesday → Phrase Lab, Thursday → AI mentor (roleplay), Saturday → workplace simulation, each labelled for its destination`,
      out.Wed && /sessGo\('phrases'/.test(out.Wed.go) && (!want.Wed || out.Wed.t === want.Wed) && out.Thu && /sessGo\('roleplay'/.test(out.Thu.go) && out.Thu.t === want.Thu && out.Sat && /sessGo\('simulation'/.test(out.Sat.go) && out.Sat.t === want.Sat, JSON.stringify(out));
    await ctx.close();
  } }
{ const { ctx, p } = await open(seed("general-english"));
  /* the label is decided when the button is drawn (sessLinkLabel), not in the pack: a pack precached by
     sw.js must never name a key the previous index.html lacks (raw "sess.link_roleplay", 29 Sep 2026) */
  const packs = await p.evaluate(async () => { const out = []; for (const t of ["general", "welding"]) { const j = await (await fetch(`tracks/${t}/weeks.json`)).json(); for (const [dd, l] of Object.entries(j.sessionLinks || {})) out.push({ t, dd, v: l.v, lk: l.lk, shown: sessLinkLabel(l), known: l.lk in I18N_EN }) } return { out, phrases: t("sess.link_phrases") } });
  const wrong = packs.out.filter(x => (x.shown === packs.phrases && x.v !== "phrases") || !x.known || /^sess\./.test(x.shown));
  ok("10 · both packs: no session button shows the Phrase Lab label unless it opens Phrase Lab; every label key a pack names exists; no raw key is ever drawn", !wrong.length && packs.out.length >= 8, JSON.stringify(wrong));
  await ctx.close(); }

console.log("\n# return_open records where the comeback landed (existing prop 'kind', no Worker change)");
for (const [flags, area, want] of [[{ home_v2_enabled: true }, "general-english", "home"], [{}, "general-english", "journey"], [{}, "welding", "journey"]]) {
  const beacons = [];
  const { ctx, p } = await open(seed(area, { ...ge3, lastSeen: Date.now() - 3 * 3600e3 }), { flags, beacons }); await sleep(600);
  const ro = (await p.evaluate(() => window.__tr || [])).filter(x => x && x.name === "return_open");
  const where = await p.evaluate(() => cur.v);
  ok(`11 · ${area}, Home V2 ${flags.home_v2_enabled ? "on" : "off"}: lands on ${want}; return_open carries kind:'${want}', gap and track`, where === want && ro.length === 1 && ro[0].props && ro[0].props.kind === want && ro[0].props.gap === "2h-1d" && ro[0].props.track === area, JSON.stringify({ where, ro }));
  await ctx.close();
}

console.log("\n# deep links still land where they did");
{ const { ctx, p } = await open(seed("general-english", ge3), { hash: "#journey" }); ok("12 · #journey → the Road map", await p.evaluate(() => cur.v === "journey")); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", ge3), { hash: "#phrasebank/2" }); ok("13 · #phrasebank/2 → the phrase bank, Week 2", await p.evaluate(() => cur.v === "phrasebank" && String(cur.arg1) === "2")); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", ge3), { hash: "#partner" }); ok("14 · General English #partner → the partner page", await p.evaluate(() => cur.v === "partner")); await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { days: { "welding:w1Mon": true } }), { hash: "#partner", flags: {} }); await sleep(600);
  const r = await p.evaluate(() => ({ v: cur.v, pp: /Practice Partner|Find a partner|Match me/.test(document.querySelector(".view.on").innerText), fab: !!(document.getElementById("ppFab") && document.getElementById("ppFab").offsetParent) }));
  ok("15 · Welding #partner → sent to Practice; no partner UI, no partner button", r.v === "practice" && !r.pp && !r.fab, JSON.stringify(r)); await ctx.close(); }

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
