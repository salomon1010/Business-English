/* Road map card — one design for General English and Welding (owner, 30 Sep 2026).
   Run: cd tests && node roadmap-card.mjs        (BASE=… to test another tree; SHOTS=dir for screenshots)

   One presentation (rmCardHTML) fed by track data (rmData) and a per-area look
   (rmLook: photo + two icons). These checks hold the data to the curriculum on
   each track, the button to the learner's real state, and the two areas apart. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8133);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch();
const F = (o = {}) => ({ placed: "full", finished: true, day: 15, done: {}, checkedAt: 1, ...o });
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const seed = (tr, o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" }, fnd: { "general-english": F(), welding: F() }, areaSplit: true,
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1, ...o });
const weekDays = (w, pre = "") => Object.fromEntries(DAYS.map(d => [pre + "w" + w + d, true]));
async function open(state, { w = 390, h = 844, lang = "en", reduce = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.addInitScript(([s, l]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); localStorage.setItem("be_lang", l) } }, [JSON.stringify(state), lang]);
  await ctx.route(u => /be-events|be-polish|be-partner|be-push|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1500);
  if (lang !== "en") { await p.evaluate(l => setLang(l), lang); await sleep(900); }
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()); go("journey"); scrollTo(0, 0) }); await sleep(1500);
  return { ctx, p, errs };
}
const card = p => p.evaluate(() => {
  const c = document.querySelector("#v-journey .rm2"); if (!c) return null;
  const q = s => c.querySelector(s), tx = s => (q(s) || {}).innerText?.trim() ?? null;
  return { look: c.dataset.look, title: tx(".rm2-title"), sub: tx(".rm2-sub"), count: tx(".rm2-count"), pct: tx(".rm-ring-txt b"),
    stats: [...c.querySelectorAll(".rm2-stat")].map(s => s.innerText.replace(/\s+/g, " ").trim()),
    badge: tx(".rm2-badge"), cur: tx(".rm2-cur h3"), curSub: tx(".rm2-cur-sub"), curN: tx(".rm2-cur-n"), curPct: tx(".rm2-cur-p > b"), desc: tx(".rm2-cur-d"),
    segs: [...c.querySelectorAll(".rm2-segs i")].map(i => i.className), today: tx(".rm2-today"),
    nextK: tx(".rm2-next-k"), next: tx(".rm2-next-t b"), nextGo: q(".rm2-next")?.getAttribute("onclick"),
    jourH: tx(".rm2-jour-h h3"), all: tx(".rm2-all"),
    rows: [...c.querySelectorAll(".rm2-row")].map(r => ({ n: r.querySelector(".rm2-num").innerText.trim(), t: r.querySelector(".rm2-row-t").innerText, p: r.querySelector(".rm2-row-p").innerText, s: r.className.replace("rm2-row", "").trim() })),
    cta: tx(".rm2-cta-l"), ctaGo: q(".rm2-cta")?.getAttribute("onclick"), img: getComputedStyle(q(".rm2-art")).backgroundImage, text: c.innerText };
});
const ser = x => JSON.stringify(x);

console.log("\n# General English — new learner");
{ const { ctx, p, errs } = await open(seed("general-english"));
  const c = await card(p);
  ok("GE · header: 'Your 12-week road map' + the General English line", /12-week road map/i.test(c.title) && c.sub === "Build the English skills you need for real workplace success.", ser(c));
  ok("GE · progress: 0%, '0 of 84 sessions done', 12 weeks · 84 sessions (real counts)", c.count === "0 of 84 sessions done" && /^12 Weeks/i.test(c.stats[0]) && /^84 Sessions/i.test(c.stats[1]), ser(c));
  ok("GE · current = Week 1 of 12, its curriculum theme, phase and goal", c.badge.toUpperCase() === "WEEK 1 OF 12" && c.cur === "Introductions, role clarity & speech baseline" && c.curSub === "Foundation" && c.desc === "Build your baseline and start speaking clearly about yourself and your role.", ser(c));
  ok("GE · 0 of 7 sessions, seven segments, Monday marked as the next one", c.curN === "0 of 7 sessions" && c.curPct === "0%" && c.segs.length === 7 && c.segs[0] === "now" && c.segs.slice(1).every(s => !s), ser(c.segs));
  ok("GE · today's session travels with the button (read out, not drawn — the reference shows no extra line): Week 1 · Monday, Pronunciation baseline, Session 1 of 7", /Week 1 · Monday/.test(c.today) && /Pronunciation baseline/.test(c.today) && /Session 1 of 7 in Week 1/.test(c.today), c.today);
  ok("GE · next = Week 2 and its theme; tapping it opens Week 2", /NEXT WEEK/i.test(c.nextK) && c.next === "Week 2 — Project updates & status communication" && /go\('journey',2\)/.test(c.nextGo), ser(c));
  ok("GE · journey = the three General English phases, Foundation current", c.jourH.toUpperCase() === "YOUR LEARNING JOURNEY" && ser(c.rows.map(r => r.t)) === ser(["Foundation", "Workplace Fluency", "Executive Communication"]) && c.rows[0].s === "now" && c.rows[0].n === "01" && c.all.startsWith("View all 12 weeks"), ser(c.rows));
  ok("GE · button: 'Start Week 1' → Week 1 Monday", c.cta === "Start Week 1" && /go\('session',1,'Mon'\)/.test(c.ctaGo), ser(c));
  ok("GE · photo is the General English one", /roadmap-art\/general\.jpg/.test(c.img) && c.look === "ge", c.img);
  ok("isolation · no Welding words on the General English card", !/Stage \d|Workshop|welding|professional journey/i.test(c.text), c.text);
  ok("no page errors", !errs.length, errs.join(" | "));
  await ctx.close(); }

console.log("\n# Welding — new learner");
{ const { ctx, p, errs } = await open(seed("welding"));
  const c = await card(p);
  ok("W · header: same title, the Welding line", /12-week road map/i.test(c.title) && /successful career in welding/.test(c.sub), ser(c));
  ok("W · 0 of 84 sessions, 12 stages · 84 sessions", c.count === "0 of 84 sessions done" && /^12 Stages/i.test(c.stats[0]) && /^84 Sessions/i.test(c.stats[1]), ser(c.stats));
  ok("W · current = Stage 1 of 12 — Entering the Workshop · Workshop Foundations · its goal", c.badge.toUpperCase() === "STAGE 1 OF 12" && c.cur === "Entering the Workshop" && c.curSub === "Workshop Foundations" && c.desc === "Make a clear first professional impression.", ser(c));
  ok("W · next = Stage 2 — Working With Your Team", /NEXT STAGE/i.test(c.nextK) && c.next === "Stage 2 — Working With Your Team", ser(c));
  ok("W · journey = the four Welding phases", c.jourH.toUpperCase() === "YOUR PROFESSIONAL JOURNEY" && ser(c.rows.map(r => r.t)) === ser(["Workshop Foundations", "Technical Communication", "Workplace Standards", "Career Readiness"]) && c.all.startsWith("View all 12 stages"), ser(c.rows));
  ok("W · button: 'Start Stage 1' → Stage 1 Monday", c.cta === "Start Stage 1" && /go\('session',1,'Mon'\)/.test(c.ctaGo), ser(c));
  ok("W · photo is the welding one", /roadmap-art\/welding\.jpg/.test(c.img) && c.look === "pro", c.img);
  ok("isolation · no General English words on the Welding card", !/Introductions|Foundation Skills|learning journey|Week \d of|Workplace Fluency|Executive Communication/i.test(c.text), c.text);
  ok("same system · both areas draw the same parts in the same order", await p.evaluate(() => [...document.querySelector("#v-journey .rm2").children].map(e => e.className.split(" ")[0]).join(",")) === "rm2-art,rm2-head,rm2-prog,rm2-cur,rm2-next,rm2-jour,rm2-cta");
  ok("no page errors", !errs.length, errs.join(" | "));
  await ctx.close(); }

console.log("\n# isolation — each area's progress stays its own");
{ const { ctx, p } = await open(seed("welding", { days: { ...weekDays(1), w2Mon: true } }));   // General English sessions only
  const c = await card(p);
  ok("Welding card ignores General English sessions: 0 of 84, Stage 1", c.count === "0 of 84 sessions done" && /STAGE 1 OF 12/i.test(c.badge), ser(c)); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", { days: { ...weekDays(1, "welding:"), "welding:w2Mon": true } }));
  const c = await card(p);
  ok("General English card ignores Welding sessions: 0 of 84, Week 1", c.count === "0 of 84 sessions done" && /WEEK 1 OF 12/i.test(c.badge), ser(c)); await ctx.close(); }

console.log("\n# states — the button follows the learner's real position");
{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true, w1Tue: true, w1Wed: true } }));
  const c = await card(p);
  ok("in progress: 3 of 84 → 4%, 3 of 7, three segments done + Thursday next, 'Continue Week 1' → Thursday", c.count === "3 of 84 sessions done" && c.curN === "3 of 7 sessions" && c.curPct === "43%" && ser(c.segs) === ser(["done", "done", "done", "now", "", "", ""]) && c.cta === "Continue Week 1" && /go\('session',1,'Thu'\)/.test(c.ctaGo), ser(c));
  await sleep(1400); ok("the ring counts up to the real figure (4%)", (await card(p)).pct === "4%"); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true, w1Tue: true, w1Wed: true }, steps: { w1Thu: [0, 1] } }));
  const c = await card(p);
  ok("returning mid-session: 'Resume Week 1' → Thursday", c.cta === "Resume Week 1" && /go\('session',1,'Thu'\)/.test(c.ctaGo), ser(c)); await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { days: weekDays(1, "welding:") }));
  const c = await card(p);
  ok("stage complete: current = Stage 2, 'Continue to Stage 2', Workshop Foundations 25%, next = Stage 3", /STAGE 2 OF 12/i.test(c.badge) && c.cta === "Continue to Stage 2" && c.rows[0].p === "25%" && c.rows[0].s === "now" && c.next === "Stage 3 — Tools & Equipment" && c.count === "7 of 84 sessions done", ser(c)); await ctx.close(); }
{ const days = {}; for (let w = 1; w <= 4; w++) Object.assign(days, weekDays(w));
  const { ctx, p } = await open(seed("general-english", { days }));
  const c = await card(p);
  ok("phase complete: Foundation row shows a check and 100%, Workplace Fluency is current, next skips the review checkpoint to Week 6", c.rows[0].s === "done" && c.rows[0].p === "100%" && c.rows[0].n === "" && c.rows[1].s === "now" && /WEEK 5 OF 12/i.test(c.badge) && c.next.startsWith("Week 6 — "), ser(c)); await ctx.close(); }
{ const days = {}; for (let w = 1; w <= 12; w++) Object.assign(days, weekDays(w));
  const { ctx, p } = await open(seed("general-english", { days }));
  const c = await card(p);
  ok("programme finished: 84 of 84, the certificate panel, 'Review your journey' → Progress, no today line", c.count === "84 of 84 sessions done" && /certificate/i.test(c.badge) && c.cta === "Review your journey" && /go\('review'\)/.test(c.ctaGo) && c.today === null && /Ready to download/.test(c.next), ser(c)); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", { fnd: { "general-english": {}, welding: F() } }));
  const c = await card(p);
  ok("placement not taken: Stage 0 Foundations is current and the button is the one-minute check", /Stage 0/i.test(c.badge) && c.cur === "Foundations" && /one-minute check/i.test(c.cta) && /fndOpenCheck/.test(c.ctaGo) && c.next.startsWith("Week 1 — "), ser(c)); await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { fnd: { "general-english": F(), welding: F({ placed: "foundations", finished: false, day: 3, done: { d1: true, d2: true } }) } }));
  const c = await card(p);
  ok("in Foundations: 2 of 15 days, a plain bar, the button opens the Foundations day", /Stage 0/i.test(c.badge) && c.curN === "2 of 15 sessions" && !c.segs.length && /go\('foundations'\)/.test(c.ctaGo), ser(c)); await ctx.close(); }

console.log("\n# navigation");
{ const { ctx, p, errs } = await open(seed("general-english"));
  await p.click("#v-journey .rm2-cta"); await sleep(600);
  ok("the button opens the session", await p.evaluate(() => cur.v === "session" && String(cur.arg1) === "1" && cur.arg2 === "Mon"));
  await p.evaluate(() => go("journey")); await sleep(800);
  await p.click("#v-journey .rm2-next"); await sleep(600);
  ok("Next week opens the Week 2 page", await p.evaluate(() => cur.v === "journey" && String(cur.arg1) === "2"));
  await p.evaluate(() => go("journey")); await sleep(800);
  await p.locator("#v-journey .rm2-row").nth(1).click(); await sleep(900);
  const ph = await p.evaluate(() => ({ v: cur.v, ph: String(_jPhase), top: Math.round(document.querySelector("#v-journey #rmDetail").getBoundingClientRect().top), tab: document.querySelector("#v-journey .seg-tab.on,#v-journey .seg-phase-tab.on")?.innerText }));
  ok("a journey row shows that phase's weeks and scrolls to them", ph.v === "journey" && ph.ph === "2" && ph.top < 300 && /Workplace Fluency/.test(ph.tab), ser(ph));
  await p.evaluate(() => { _jPhase = null; go("journey"); scrollTo(0, 0) }); await sleep(800);
  await p.click("#v-journey .rm2-all"); await sleep(900);
  const va = await p.evaluate(() => ({ y: scrollY, top: Math.round(document.querySelector("#v-journey .rm-road").getBoundingClientRect().top) }));
  ok("'View all 12 weeks' scrolls to the full board", va.y > 200 && va.top < 250, ser(va));
  await p.evaluate(() => rmOpen()); await sleep(700);
  ok("the full-screen map sheet carries the same card", await p.evaluate(() => !!document.querySelector("#rmOv .rm2 .rm2-cta")));
  await p.locator("#rmOv .rm2-row").nth(2).click(); await sleep(900);
  ok("a row in the sheet closes it and lands on that phase", await p.evaluate(() => !document.getElementById("rmOv") && cur.v === "journey" && String(_jPhase) === "3"));
  ok("no page errors", !errs.length, errs.join(" | "));
  await ctx.close(); }

console.log("\n# widths");
for (const tr of ["general-english", "welding"]) for (const w of [375, 390, 400, 428, 430, 768, 1280]) {
  const { ctx, p } = await open(seed(tr, { days: { [(tr === "welding" ? "welding:" : "") + "w1Mon"]: true } }), { w, h: w > 700 ? 900 : 844 });
  const m = await p.evaluate(() => {
    const c = document.querySelector("#v-journey .rm2"), r = e => e.getBoundingClientRect(), cr = r(c);
    const clipped = [...c.querySelectorAll(".rm2-badge,.rm2-cur h3,.rm2-next-t b,.rm2-cta-l,.rm2-title,.rm2-count,.rm2-stat b,.rm2-stat small,.rm2-row-t")].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className);
    const out = [...c.querySelectorAll("*")].filter(e => { const b = r(e); return b.width && (b.right > cr.right + 1 || b.left < cr.left - 1) && !e.closest(".rm2-art,svg,.rm2-sr") }).map(e => e.className).slice(0, 3);
    const taps = [...c.querySelectorAll(".rm2-row,.rm2-next,.rm2-cta")].map(e => Math.round(r(e).height));
    const two = r(c.querySelector(".rm2-cur")).left > r(c.querySelector(".rm2-prog")).right - 1;
    const allH = r(c.querySelector(".rm2-all")); const cta = r(c.querySelector(".rm2-cta"));
    return { hscroll: document.documentElement.scrollWidth > innerWidth, fits: cr.left >= 0 && cr.right <= innerWidth, clipped, out, minTap: Math.min(...taps), two, h: Math.round(cr.height), ctaBottom: Math.round(cta.bottom), vh: innerHeight };
  });
  /* the owner's call (30 Sep 2026): the phone shows the same two-column card, scaled down — rows ~24px, button ~30px */
  ok(`${tr === "welding" ? "W " : "GE"} ${w}px: fits, no sideways scroll, nothing clipped or outside the card, taps ≥ ${w >= 760 ? 36 : 22}px, two columns`, !m.hscroll && m.fits && !m.clipped.length && !m.out.length && m.minTap >= (w >= 760 ? 36 : 22) && m.two === true, ser(m));
  if (process.env.SHOTS) { await p.screenshot({ path: `${process.env.SHOTS}/rmc-${tr === "welding" ? "weld" : "ge"}-${w}.png` }) }
  await ctx.close();
}

console.log("\n# French and Arabic");
{ const { ctx, p, errs } = await open(seed("general-english", { days: { w1Mon: true } }), { w: 375, lang: "fr" });
  const c = await card(p); const m = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok("fr · translated: 'Semaine 1 sur 12', 'Continuer : Semaine 1', 'Votre parcours d'apprentissage', no sideways scroll", /Semaine 1 sur 12/i.test(c.badge) && c.cta === "Continuer : Semaine 1" && /parcours d'apprentissage/i.test(c.jourH) && !m, ser(c));
  const fc = await p.evaluate(() => [...document.querySelectorAll("#v-journey .rm2 .rm2-stat small,#v-journey .rm2 .rm2-badge,#v-journey .rm2 .rm2-cta-l")].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.innerText));
  ok("fr · longer French labels are not cut off (stats, badge, button)", !fc.length, ser(fc));
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/rmc-fr-375.png` });
  ok("fr · no page errors", !errs.length, errs.join(" | ")); await ctx.close(); }
console.log("\n# compact — the reference's proportions");
for (const [tr, w, maxH] of [["welding", 1280, 660], ["general-english", 1280, 660], ["welding", 390, 400], ["general-english", 390, 400], ["welding", 375, 400]]) {
  const { ctx, p } = await open(seed(tr), { w, h: w > 700 ? 900 : 844 });
  const m = await p.evaluate(() => { const c = document.querySelector("#v-journey .rm2").getBoundingClientRect(), b = document.querySelector("#v-journey .rm2-cta").getBoundingClientRect(), nav = document.querySelector(".bnav"); return { h: Math.round(c.height), w: Math.round(c.width), ctaBottom: Math.round(b.bottom), navTop: nav && getComputedStyle(nav).display !== "none" ? Math.round(nav.getBoundingClientRect().top) : innerHeight } });
  ok(`${tr === "welding" ? "W " : "GE"} ${w}px: card ≤ ${maxH}px tall${w < 760 ? ", and its button is above the tab bar without scrolling" : ""}`, m.h <= maxH && (w >= 760 || m.ctaBottom <= m.navTop), ser(m));
  await ctx.close(); }
{ const { ctx, p, errs } = await open(seed("general-english", { days: { w1Mon: true } }), { w: 375, lang: "ar" });
  const c = await card(p);
  const r = await p.evaluate(() => { const c = document.querySelector("#v-journey .rm2"), q = s => c.querySelector(s);
    return { dir: getComputedStyle(c).direction, arrow: getComputedStyle(q(".rm2-cta .go-arrow")).transform, chev: getComputedStyle(q(".rm2-chev svg")).transform, art: getComputedStyle(q(".rm2-art")).transform,
      numRight: q(".rm2-row .rm2-num").getBoundingClientRect().left > q(".rm2-row .rm2-row-t").getBoundingClientRect().left, hscroll: document.documentElement.scrollWidth > innerWidth } });
  ok("ar · right-to-left: rows start on the right, arrows and chevrons mirrored, the photo moves sides but is NOT flipped (it has words in it), no sideways scroll", r.dir === "rtl" && r.numRight && /matrix\(-1/.test(r.arrow) && /matrix\(0, 1, -1, 0/.test(r.chev) && r.art === "none" && !r.hscroll, ser(r));
  ok("ar · translated button 'تابع الأسبوع 1'", c.cta === "تابع الأسبوع 1", c.cta);
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/rmc-ar-375.png` });
  ok("ar · no page errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# reduced motion");
{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true, w1Tue: true, w1Wed: true } }), { reduce: true });
  const r = await p.evaluate(() => ({ pct: document.querySelector("#v-journey .rm-ring-txt b").innerText, tr: getComputedStyle(document.querySelector("#v-journey .rm2-knob")).transitionDuration }));
  ok("reduced motion: the figure is shown at once and the knob does not animate", r.pct === "4%" && parseFloat(r.tr) < 0.01, ser(r)); await ctx.close(); }

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
