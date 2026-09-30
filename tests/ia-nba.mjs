/* Information architecture + next best action (29 Sep 2026, feature/bemastery-complete-ux-redesign).
   docs/NEXT_BEST_ACTION_UX.md is the specification these checks hold.
   Run: cd tests && node ia-nba.mjs   (BASE=… for another tree; PORT=… for the server it starts) */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8149);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await webkit.launch();
const DAY = 864e5, d = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const F = (o = {}) => ({ placed: "full", finished: true, day: 1, done: {}, ...o });
const seed = (area, o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: area, tradeId: "welder" }, fnd: { "general-english": F(), welding: F() }, areaSplit: true,
  days: {}, dates: [], dayLog: {}, steps: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
const ge3 = { days: { w1Mon: true, w1Tue: true, w1Wed: true }, dates: [d(1)], dayLog: { [d(1)]: 1 }, dayLogA: { "general-english": { [d(1)]: 1 } } };
async function open(state, { w = 390, lang = "en", flags = { home_v2_enabled: true } } = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: 800 }, serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s, f]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", f) } }, [JSON.stringify(state), JSON.stringify(flags)]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(2000);
  if (lang !== "en") { await p.evaluate(l => setLang(l), lang); await sleep(1000); }
  return { ctx, p, errs };
}
const view = async (p, v) => { await p.evaluate(v => { document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel,#fndCheckOv,.sync-nudge").forEach(e => e.remove()); go(v); scrollTo(0, 0) }, v); await sleep(1000); };
/* the Road map card (30 Sep 2026): today's session is a line in the current-stage panel (.rm2-today),
   and the card's one button (.rm2-cta) is worded as a place on the journey — "Start Week 1" */
const today = p => p.evaluate(() => { const r = document.querySelector("#v-journey .rm2-today"); if (!r) return null; const b = document.querySelector("#v-journey .rm2-cta"), q = document.querySelector("#v-journey .rm2").getBoundingClientRect();
  return { k: r.querySelector(".rm2-today-k").innerText, pos: (r.querySelector(".rm2-today-pos") || {}).innerText || "", t: r.querySelector("b").innerText, cta: b.querySelector(".rm2-cta-l").innerText.trim(), go: b.getAttribute("onclick"), h: Math.round(b.getBoundingClientRect().height), fits: q.left >= 0 && q.right <= innerWidth, primaries: document.querySelectorAll("#v-journey .rm2 .btn-primary, #v-journey .rm2 .rm2-cta").length } });
const heroGo = p => p.evaluate(() => { const c = document.querySelector(".hx .hx-cta"); return c && c.getAttribute("onclick") });
const jsErr = errs => errs.filter(e => !/MIME type/.test(e));

console.log("\n# Learn (Road map) answers 'what is today?' with one button — the same state Home reads");
{ const { ctx, p, errs } = await open(seed("general-english", { fnd: {} })); await view(p, "journey");
  const r = await today(p);
  ok("1 · placement not taken: Today = the one-minute check", r && /one-minute check/i.test(r.cta) && /fndOpenCheck/.test(r.go), JSON.stringify(r)); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", { fnd: { "general-english": F({ placed: "foundations", finished: false, day: 3, done: { d1: true, d2: true } }) } })); await view(p, "journey");
  const r = await today(p);
  ok("2 · in Foundations: Today = the Foundations day", r && /go\('foundations'\)/.test(r.go), JSON.stringify(r)); await ctx.close(); }
{ const { ctx, p, errs } = await open(seed("general-english")); await view(p, "journey");
  const r = await today(p);
  /* the row is the map's pin (29 Sep 2026): the day and its place in the week — Home keeps "what next?" */
  ok("3 · placed, nothing done: 'Week 1 · Monday', 'Session 1 of 7 in Week 1', the day's focus, 'Start Week 1' → Week 1 Monday", r && r.k === "Week 1 · Monday" && r.pos === "Session 1 of 7 in Week 1" && r.t === "Pronunciation baseline" && r.cta === "Start Week 1" && /go\('session',1,'Mon'\)/.test(r.go), JSON.stringify(r));
  ok("3b · one primary button in the Road map header, ≥44px, inside the screen", r.primaries === 1 && r.h >= 44 && r.fits, JSON.stringify(r));
  await view(p, "home");
  ok("3c · Home's hero points at the same session", /go\('session',1,'Mon'\)/.test(await heroGo(p) || ""), await heroGo(p));
  ok("3d · no JavaScript errors", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", { ...ge3, steps: { w1Thu: [0, 1] } })); await view(p, "journey");
  const r = await today(p);
  ok("4 · three sessions done, Thursday begun: 'Resume Week 1' → Week 1 Thursday", r && /Thursday/.test(r.k) && r.cta === "Resume Week 1" && /go\('session',1,'Thu'\)/.test(r.go), JSON.stringify(r)); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", ge3)); await view(p, "journey");
  const r = await today(p);
  ok("5 · three sessions done, Thursday not begun: 'Continue Week 1' → Week 1 Thursday", r && r.cta === "Continue Week 1" && /go\('session',1,'Thu'\)/.test(r.go), JSON.stringify(r));
  /* the same row in the full-screen map sheet: its button closes the sheet and opens the session */
  await p.evaluate(() => rmOpen()); await sleep(800);
  await p.evaluate(() => document.querySelector("#rmOv .rm2-cta").click()); await sleep(900);
  const s = await p.evaluate(() => ({ ov: !!document.getElementById("rmOv"), v: cur.v, w: cur.arg1, d: cur.arg2 }));
  ok("5b · in the map sheet, the button closes the sheet and opens that session", !s.ov && s.v === "session" && String(s.w) === "1" && s.d === "Thu", JSON.stringify(s)); await ctx.close(); }
{ const days = {}; for (let w = 1; w <= 12; w++) for (const x of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) days["w" + w + x] = true;
  const { ctx, p } = await open(seed("general-english", { days })); await view(p, "journey");
  ok("6 · programme finished: no Today row", (await today(p)) === null);
  ok("6b · …and the button is 'Review your journey' → Progress", await p.evaluate(() => { const b = document.querySelector("#v-journey .rm2-cta"); return b && b.innerText.includes("Review your journey") && /go\('review'\)/.test(b.getAttribute("onclick")) })); await ctx.close(); }
{ const st = seed("general-english"); st.fnd["general-english"] = { placed: "full", finished: true };   // a state written without its done map
  const { ctx, p, errs } = await open(st); await view(p, "journey");
  const r = await p.evaluate(() => ({ failed: /could not be drawn/.test(document.getElementById("v-journey").innerText), pins: document.querySelectorAll("#v-journey .rm-lbl").length }));
  ok("7 · a Foundations record without its 'done' map no longer takes the Road map down", !r.failed && r.pins > 5, JSON.stringify(r)); await ctx.close(); }

console.log("\n# Welding before placement: one decision — the check; then the mission (Career Dashboard = welding_studio_enabled off, as in production; the studio's Home V2 is tests/welding-studio.mjs)");
{ const { ctx, p, errs } = await open(seed("welding", { fnd: { "general-english": F() } }), { flags: { welding_studio_enabled: false } }); await view(p, "home");
  const r = await p.evaluate(() => { const v = document.getElementById("v-home"); return { check: !!v.querySelector(".fnd-home, [onclick*='fndOpenCheck']"), mission: !!v.querySelector(".career-dashboard-mission"), btn: [...v.querySelectorAll("button")].some(x => /Continue Today/.test(x.innerText)), coach: !!v.querySelector(".career-dashboard-coach"), gated: (v.querySelector(".career-dash-gated") || {}).innerText || "", why: (v.querySelector(".career-dash-why") || {}).innerText || "", pick: !!v.querySelector(".career-dash-pick select") } });
  ok("8 · the check is the one action; today's mission, its coach card and its button are not offered yet", r.check && !r.mission && !r.btn && !r.coach, JSON.stringify(r));
  ok("9 · one line says what comes next: 'Your first mission appears after the one-minute check above.'", /first mission appears after the one-minute check/.test(r.gated), r.gated);
  ok("10 · 'Not measured yet' says how it gets measured; the profession can still be set", /Answer one workshop question/.test(r.why) && r.pick, JSON.stringify(r));
  await view(p, "journey");
  const t = await today(p);
  ok("11 · Welding's Road map: Today = the check", t && /fndOpenCheck/.test(t.go), JSON.stringify(t));
  ok("11b · no JavaScript errors", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { fnd: { "general-english": F(), welding: F({ placed: "foundations", finished: false }) } }), { flags: { welding_studio_enabled: false } }); await view(p, "home");
  const g = await p.evaluate(() => (document.querySelector("#v-home .career-dash-gated") || {}).innerText || "");
  ok("12 · Welding in Foundations: 'Your first mission opens when Foundations is finished.'", /opens when Foundations is finished/.test(g), g); await ctx.close(); }
{ const { ctx, p, errs } = await open(seed("welding", { days: { "welding:w1Mon": true } }), { flags: { home_v2_enabled: true, welding_studio_enabled: false } }); await view(p, "home");
  const r = await p.evaluate(() => { const v = document.getElementById("v-home"); return { mission: !!v.querySelector(".career-dashboard-mission"), btn: [...v.querySelectorAll("button")].some(x => /Continue Today/.test(x.innerText)), gated: !!v.querySelector(".career-dash-gated") } });
  ok("13 · Welding placed: the mission and its button are back, no gated line", r.mission && r.btn && !r.gated, JSON.stringify(r));
  const iso = [];
  for (const v of ["home", "journey", "practice", "review", "profile"]) { await view(p, v);
    iso.push(await p.evaluate(() => ({ v: cur.v, hx: !!document.querySelector(".view.on .hx"), pill: !!document.querySelector("#hxOnline:not([hidden])"), fab: !!(document.getElementById("ppFab") && document.getElementById("ppFab").offsetParent), pp: /Practice Partner|in line|online now/.test(document.querySelector(".view.on").innerText) }))); }
  ok("14 · Welding (General English Home V2 flag on, Welding studio flag off — production): no Home V2 hero, online pill, partner button or Practice Partner on any tab", iso.every(x => !x.hx && !x.pill && !x.fab && !x.pp), JSON.stringify(iso.filter(x => x.hx || x.pill || x.fab || x.pp)));
  ok("14b · no JavaScript errors", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english")); await view(p, "home");
  ok("15 · General English Home has no Career Dashboard", !(await p.evaluate(() => !!document.querySelector("#v-home .career-dashboard")))); await ctx.close(); }

console.log("\n# Empty states say why and what next");
{ const { ctx, p } = await open(seed("general-english"));
  const s = await p.evaluate(() => t("sh.lib_empty_cat"));
  ok("16 · an empty Shadow group: 'No videos in this group yet. Pick another group, or paste any YouTube link.'", /No videos in this group yet\. Pick another group, or paste any YouTube link\./.test(s), s); await ctx.close(); }

console.log("\n# French and Arabic at 375px");
for (const [lang, word, pos] of [["fr", "Semaine 1", "Séance 4 sur 7"], ["ar", "الأسبوع 1", "الجلسة 4 من 7"]]) {
  const { ctx, p } = await open(seed("general-english", ge3), { w: 375, lang }); await view(p, "journey");
  const r = await today(p); const dir = await p.evaluate(() => { const e = document.querySelector("#v-journey .rm2-today"); return e && getComputedStyle(e).direction });
  const flip = await p.evaluate(() => { const a = document.querySelector("#v-journey .rm2-cta .go-arrow"); return a ? getComputedStyle(a).transform : null });
  ok(`17a · ${lang}: the button's arrow ${lang === "ar" ? "is mirrored" : "is not mirrored"}`, lang === "ar" ? /matrix\(-1/.test(flip || "") : (flip === "none"), String(flip));
  ok(`17 · ${lang}: the Today row is translated, fits the screen, its button ≥44px${lang === "ar" ? ", right-to-left" : ""}`, r && r.k.startsWith(word) && r.pos.startsWith(pos) && r.fits && r.h >= 44 && (lang !== "ar" || dir === "rtl"), JSON.stringify({ r, dir }));
  if (process.env.OUT) { await p.evaluate(() => document.querySelector("#v-journey .rm2").scrollIntoView({ block: "center" })); await sleep(300); await p.screenshot({ path: `${process.env.OUT}/today-${lang}.png` }) }
  await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { fnd: { "general-english": F() } }), { w: 375, lang: "fr", flags: { welding_studio_enabled: false } }); await view(p, "home");
  const g = await p.evaluate(() => (document.querySelector("#v-home .career-dash-gated") || {}).innerText || "");
  ok("18 · fr: the Welding gated line is translated", /Votre première mission apparaît après le test/.test(g), g);
  if (process.env.OUT) { await p.evaluate(() => document.querySelector("#v-home .career-dash-gated").scrollIntoView({ block: "center" })); await sleep(300); await p.screenshot({ path: `${process.env.OUT}/weld-gated-fr.png` }) }
  await ctx.close(); }

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
