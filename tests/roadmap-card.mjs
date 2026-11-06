/* Road map — two designs since 5 Nov 2026 (owner-approved).
   Welding keeps the single overview card + illustrated road (rmCardHTML / rmBoardHTML /
   rmDraw, "one design for both areas," owner 30 Sep 2026) completely unchanged.
   General English now gets a simplified Duolingo-style vertical path (rmHeaderHTML /
   rmPathHTML), fed by the SAME rmSteps()/rmData() both designs always read, so it
   cannot disagree with the curriculum, progression rules or the Practice/Progress pages.
   Run: cd tests && node roadmap-card.mjs        (BASE=… to test another tree; SHOTS=dir for screenshots) */
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
/* Welding's shared overview card — unchanged from before 5 Nov 2026. */
const card = p => p.evaluate(() => {
  const c = document.querySelector("#v-journey .rm2"); if (!c) return null;
  const q = s => c.querySelector(s), tx = s => (q(s) || {}).innerText?.trim() ?? null;
  return { look: c.dataset.look, title: tx(".rm2-title"), prof: tx(".rm2-prof"), sub: tx(".rm2-sub"), count: tx(".rm2-count"), pct: tx(".rm-ring-txt b"),
    stats: [...c.querySelectorAll(".rm2-stat")].map(s => s.innerText.replace(/\s+/g, " ").trim()),
    badge: tx(".rm2-badge"), cur: tx(".rm2-cur h3"), curSub: tx(".rm2-cur-sub"), curN: tx(".rm2-cur-n"), curPct: tx(".rm2-cur-p > b"), desc: tx(".rm2-cur-d"),
    segs: [...c.querySelectorAll(".rm2-segs i")].map(i => i.className), today: tx(".rm2-today"),
    nextK: tx(".rm2-next-k"), next: tx(".rm2-next-t b"), nextGo: q(".rm2-next")?.getAttribute("onclick"),
    jourH: tx(".rm2-jour-h h3"), all: tx(".rm2-all"),
    rows: [...c.querySelectorAll(".rm2-row")].map(r => ({ n: r.querySelector(".rm2-num").innerText.trim(), t: r.querySelector(".rm2-row-t").innerText, p: r.querySelector(".rm2-row-p").innerText, s: r.className.replace("rm2-row", "").trim() })),
    cta: tx(".rm2-cta-l"), ctaGo: q(".rm2-cta")?.getAttribute("onclick"), img: getComputedStyle(q(".rm2-art")).backgroundImage, text: c.innerText };
});
/* General English's new simplified path: a compact header (rmHeaderHTML) + a
   vertical list of steps (rmPathHTML), both fed by the same rmData()/rmSteps()
   the Welding card above reads — see index.html rmHTML(). */
const path = p => p.evaluate(() => {
  const h = document.querySelector("#v-journey .rm-head2"); if (!h) return null;
  const q = s => h.querySelector(s), tx = s => (q(s) || {}).innerText?.trim() ?? null;
  const rows = [...document.querySelectorAll("#v-journey .rm-path-row")].map(li => ({
    cls: li.className.replace("rm-path-row", "").trim(), k: (li.querySelector(".rm-path-k") || {}).innerText,
    title: (li.querySelector("h3") || {}).innerText, sub: (li.querySelector(".rm-path-sub") || {}).innerText ?? null,
    pct: (li.querySelector(".rm-path-bar i") || {}).style?.width ?? null, tag: (li.querySelector(".rm-path-tag") || {}).innerText ?? null,
    go: (li.querySelector(".rm-path-card") || {}).getAttribute?.("onclick") }));
  return { eyebrow: tx(".eyebrow"), pos: tx(".rm-head2-pos"), title: tx(".rm-head2-title"), sub: tx(".rm-head2-sub"),
    count: tx(".rm-head2-count"), barW: (q(".rm-head2-bar i") || {}).style?.width, cta: tx(".rm-head2-cta-l"),
    ctaGo: q(".rm-head2-cta")?.getAttribute("onclick"), rows, text: document.querySelector("#v-journey").innerText };
});
const ser = x => JSON.stringify(x);

console.log("\n# General English — new learner (simplified vertical path)");
{ const { ctx, p, errs } = await open(seed("general-english"));
  const r = await path(p);
  ok("GE · the old card and old road are gone; the new header and path render instead", !(await p.evaluate(() => !!document.querySelector("#v-journey .rm2") || !!document.querySelector("#v-journey #rmRoad"))), ser(r));
  ok("GE · header: 'Your 12-week road map' eyebrow, Week 1 of 12, 0 of 84 sessions done, 0% bar", r.eyebrow.toUpperCase() === "YOUR 12-WEEK ROAD MAP" && r.pos === "WEEK 1 OF 12" && r.count === "0 of 84 sessions done" && r.barW === "0%", ser(r));
  ok("GE · header names today's actual lesson and where it sits in the week — not just the week theme", r.title === "Pronunciation baseline" && r.sub === "Session 1 of 7 in Week 1", ser(r));
  ok("GE · one primary action: 'Start Week 1' → Monday's session", r.cta === "Start Week 1" && /go\('session',1,'Mon'\)/.test(r.ctaGo), ser(r));
  ok("GE · exactly one path, 17 rows: Stage 0 + 12 weeks + 3 review checkpoints (after 4/8/12) + certificate", r.rows.length === 17 && r.rows.filter(x => x.k === "REVIEW CHECKPOINT").length === 3 && r.rows[16].k === "YOUR CERTIFICATE", ser(r.rows.map(x => x.k)));
  ok("GE · Stage 0 already passed shows done; Week 1 is the one 'now' row; Week 2 is the one 'next' row; everything after is locked", /\bdone\b/.test(r.rows[0].cls) && /\bnow\b/.test(r.rows[1].cls) && r.rows[1].tag === "You are here" && /\bnext\b/.test(r.rows[2].cls) && r.rows[2].tag === "Next" && r.rows.slice(3).every(x => /\blocked\b/.test(x.cls)), ser(r.rows.map(x => [x.k, x.cls, x.tag])));
  ok("GE · the review checkpoints keep the curriculum's real words (Monthly review after WEEK 4/8/12) — no invented milestones", r.rows.filter(x => x.k === "REVIEW CHECKPOINT").map(x => x.title).join("|") === "Monthly review after WEEK 4|Monthly review after WEEK 8|Monthly review after WEEK 12", ser(r.rows.filter(x => x.k === "REVIEW CHECKPOINT")));
  ok("GE · the certificate row is last, locked, and names the real total", r.rows[16].title === "Unlocks when all 84 sessions are done", r.rows[16]);
  ok("GE · every row's tap destination is the same go('journey', w) the curriculum already uses — no new navigation invented", r.rows[1].go === "rmClose();go('journey',1)" && r.rows[2].go === "rmClose();go('journey',2)", ser(r.rows.slice(0, 3).map(x => x.go)));
  /* "Stage 0" is a SHARED label (rm.stage0) — both areas' Foundations placement
     step uses it, so it is not a leak. Welding-specific numbered stages start
     at Stage 1 (rmUnitName); General English's own weeks are always "WEEK n". */
  ok("isolation · no Welding words anywhere on the General English page", !/Stage [1-9]|Stage 1[0-2]|Workshop|welding|professional journey/i.test(r.text), r.text.slice(0, 200));
  ok("no page errors", !errs.length, errs.join(" | "));
  await ctx.close(); }

console.log("\n# Welding — new learner (unchanged: the overview card + illustrated road)");
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
  const r = await path(p);
  ok("General English path ignores Welding sessions: 0 of 84, Week 1", r.count === "0 of 84 sessions done" && r.pos === "WEEK 1 OF 12", ser(r)); await ctx.close(); }

console.log("\n# states — the button and the path follow the learner's real position");
{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true, w1Tue: true, w1Wed: true } }));
  const r = await path(p);
  ok("in progress: 3 of 84, today's real next lesson (Thursday), Week 1 row at 43% with three sub-segments implied by its own 'sub', 'Continue Week 1' → Thursday", r.count === "3 of 84 sessions done" && r.title === "Explain your role to a non-technical person" && r.sub === "Session 4 of 7 in Week 1" && r.rows[1].sub === "3 of 7 sessions" && r.rows[1].pct === "43%" && r.cta === "Continue Week 1" && /go\('session',1,'Thu'\)/.test(r.ctaGo), ser(r));
  await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true, w1Tue: true, w1Wed: true }, steps: { w1Thu: [0, 1] } }));
  const r = await path(p);
  ok("returning mid-session: 'Resume Week 1' → Thursday", r.cta === "Resume Week 1" && /go\('session',1,'Thu'\)/.test(r.ctaGo), ser(r)); await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { days: weekDays(1, "welding:") }));
  const c = await card(p);
  ok("stage complete: current = Stage 2, 'Continue to Stage 2', Workshop Foundations 25%, next = Stage 3", /STAGE 2 OF 12/i.test(c.badge) && c.cta === "Continue to Stage 2" && c.rows[0].p === "25%" && c.rows[0].s === "now" && c.next === "Stage 3 — Tools & Equipment" && c.count === "7 of 84 sessions done", ser(c)); await ctx.close(); }
{ const days = {}; for (let w = 1; w <= 4; w++) Object.assign(days, weekDays(w));
  const { ctx, p } = await open(seed("general-english", { days }));
  const r = await path(p);
  ok("phase complete: weeks 1-4 and the first checkpoint all show done+lit, Week 5 is 'now', Week 6 is 'next' (the checkpoint is correctly skipped, not counted as a week)", r.rows.slice(1, 5).every(x => /\bdone\b/.test(x.cls) && x.pct === "100%") && /\bdone\b/.test(r.rows[5].cls) && /\bnow\b/.test(r.rows[6].cls) && /\bnext\b/.test(r.rows[7].cls) && r.pos === "WEEK 5 OF 12" && r.count === "28 of 84 sessions done", ser(r.rows.map(x => [x.k, x.cls])));
  await ctx.close(); }
{ const days = {}; for (let w = 1; w <= 12; w++) Object.assign(days, weekDays(w));
  const { ctx, p } = await open(seed("general-english", { days }));
  const r = await path(p);
  ok("programme finished: 84 of 84, every row done+lit including the certificate, 'Review your journey' → Progress, the certificate reads 'ready to download'", r.count === "84 of 84 sessions done" && r.barW === "100%" && r.rows.every(x => /\bdone\b/.test(x.cls)) && r.cta === "Review your journey" && /go\('review'\)/.test(r.ctaGo) && r.rows[16].title === "Ready to download and share", ser(r)); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", { fnd: { "general-english": {}, welding: F() } }));
  const r = await path(p);
  ok("placement not taken: Stage 0 is the 'now' row and the button is the one-minute check; Week 1 is correctly 'next'", r.pos === "STAGE 0" && /one-minute check/i.test(r.cta) && /fndOpenCheck/.test(r.ctaGo) && /\bnow\b/.test(r.rows[0].cls) && /\bnext\b/.test(r.rows[1].cls) && r.rows[1].k === "WEEK 1", ser(r)); await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { fnd: { "general-english": F(), welding: F({ placed: "foundations", finished: false, day: 3, done: { d1: true, d2: true } }) } }));
  const c = await card(p);
  ok("in Foundations: 2 of 15 days, a plain bar, the button opens the Foundations day", /Stage 0/i.test(c.badge) && c.curN === "2 of 15 sessions" && !c.segs.length && /go\('foundations'\)/.test(c.ctaGo), ser(c)); await ctx.close(); }

console.log("\n# navigation — General English");
{ const { ctx, p, errs } = await open(seed("general-english"));
  await p.click("#v-journey .rm-head2-cta"); await sleep(600);
  ok("the primary button opens today's session", await p.evaluate(() => cur.v === "session" && String(cur.arg1) === "1" && cur.arg2 === "Mon"));
  await p.evaluate(() => go("journey")); await sleep(800);
  await p.locator("#v-journey .rm-path-row.next .rm-path-card").click(); await sleep(600);
  ok("tapping the 'Next' row (Week 2) opens Week 2", await p.evaluate(() => cur.v === "journey" && String(cur.arg1) === "2"));
  await p.evaluate(() => go("journey")); await sleep(800);
  /* Locked rows still open the week page (existing rule, unchanged): the days
     inside are what pathLocked()/pathNudge() actually gate, same as before. */
  await p.locator("#v-journey .rm-path-row.locked.week .rm-path-card").first().click(); await sleep(600);
  ok("tapping a locked week (Week 3) still opens its page — locking happens at the day level, same progression rule as before", await p.evaluate(() => cur.v === "journey" && String(cur.arg1) === "3"));
  await p.evaluate(() => go("journey")); await sleep(800);
  ok("the header button carries 'Continue Learning'-style wording consistent with the day it targets (Start on day 1)", await p.evaluate(() => document.querySelector("#v-journey .rm-head2-cta-l").innerText) === "Start Week 1");
  /* The full-screen map sheet (header button, elsewhere in the app) wraps the
     SAME rmHTML() — so it shows the new path too, not a second design. */
  await p.evaluate(() => rmOpen()); await sleep(700);
  ok("the full-screen map sheet carries the SAME simplified path, not a second design", await p.evaluate(() => !!document.querySelector("#rmOv .rm-path") && !!document.querySelector("#rmOv .rm-head2")));
  await p.locator("#rmOv .rm-path-row.next .rm-path-card").click(); await sleep(700);
  ok("a row in the sheet closes it and lands on that week", await p.evaluate(() => !document.getElementById("rmOv") && cur.v === "journey" && String(cur.arg1) === "2"));
  ok("no page errors", !errs.length, errs.join(" | "));
  await ctx.close(); }

console.log("\n# widths — General English (the simplified path)");
for (const w of [375, 390, 400, 428, 430, 768, 1280]) {
  const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true } }), { w, h: w > 700 ? 900 : 844 });
  const m = await p.evaluate(() => {
    const rm = document.querySelector("#v-journey .rm"), head = document.querySelector("#v-journey .rm-head2"), now = document.querySelector("#v-journey .rm-path-row.now .rm-path-card");
    const r = e => e.getBoundingClientRect();
    const clipped = [...rm.querySelectorAll(".rm-head2-title,.rm-head2-pos,.rm-head2-cta-l,.rm-path-k,h3,.rm-path-sub")].filter(e => e.scrollWidth > e.clientWidth + 1).length;
    const taps = [...rm.querySelectorAll(".rm-path-card,.rm-head2-cta")].map(e => Math.round(r(e).height));
    return { hscroll: document.documentElement.scrollWidth > innerWidth, clipped, minTap: Math.min(...taps), rmWidth: Math.round(r(rm).width), nowBottom: Math.round(r(now).bottom), vh: innerHeight };
  });
  /* "current lesson visible without unnecessary scrolling" (the brief's own words): the
     header + the current-week row both land well inside one phone screen's height. */
  ok(`GE ${w}px: no sideways scroll, nothing clipped, taps ≥44px, the current lesson is visible within the first screen (no unnecessary scrolling)`, !m.hscroll && !m.clipped && m.minTap >= 44 && m.nowBottom < m.vh, ser(m));
  if (w >= 720) ok(`GE ${w}px: the path is centred and capped to a readable column, not stretched edge-to-edge`, m.rmWidth <= 640, ser(m));
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/rmc-ge-${w}.png`, fullPage: true });
  await ctx.close();
}
{ /* The certificate row is now genuinely the last thing on the page, and #ppFab
     (the floating Partner button) is fixed over this view only (PP_FAB_VIEWS,
     owner 22 Sep 2026) — a learner who scrolls all the way down must still be
     able to read it. Found on a real device 5 Nov 2026; fixed with .rm-simple's
     own bottom padding, not by moving or hiding the shared, unrelated #ppFab. */
  const { ctx, p } = await open(seed("general-english"));
  const g = await p.evaluate(() => {
    const last = document.querySelector("#v-journey .rm-path-row:last-child .rm-path-card");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }); // html{scroll-behavior:smooth} makes a plain scrollTo async
    const b = last.getBoundingClientRect();
    const fabTopFromBottom = 92 + 60; // #ppFab: bottom offset + its own height
    return { clearance: Math.round(innerHeight - fabTopFromBottom - b.bottom) };
  });
  ok("GE: the certificate row can scroll clear of where the floating Partner button sits, on any device", g.clearance >= 0, ser(g));
  await ctx.close(); }
console.log("\n# widths — Welding (unchanged: the overview card)");
for (const w of [375, 390, 400, 428, 430, 768, 1280]) {
  const { ctx, p } = await open(seed("welding", { days: { "welding:w1Mon": true } }), { w, h: w > 700 ? 900 : 844 });
  const m = await p.evaluate(() => {
    const c = document.querySelector("#v-journey .rm2"), r = e => e.getBoundingClientRect(), cr = r(c);
    const clipped = [...c.querySelectorAll(".rm2-badge,.rm2-cur h3,.rm2-next-t b,.rm2-cta-l,.rm2-title,.rm2-count,.rm2-stat b,.rm2-stat small,.rm2-row-t")].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className);
    const out = [...c.querySelectorAll("*")].filter(e => { const b = r(e); return b.width && (b.right > cr.right + 1 || b.left < cr.left - 1) && !e.closest(".rm2-art,svg,.rm2-sr") }).map(e => e.className).slice(0, 3);
    const taps = [...c.querySelectorAll(".rm2-row,.rm2-next,.rm2-cta")].map(e => Math.round(r(e).height));
    const two = r(c.querySelector(".rm2-cur")).left > r(c.querySelector(".rm2-prog")).right - 1;
    return { hscroll: document.documentElement.scrollWidth > innerWidth, fits: cr.left >= 0 && cr.right <= innerWidth, clipped, out, minTap: Math.min(...taps), two, h: Math.round(cr.height) };
  });
  ok(`W ${w}px: fits, no sideways scroll, nothing clipped or outside the card, taps ≥ ${w >= 760 ? 36 : 22}px, two columns`, !m.hscroll && m.fits && !m.clipped.length && !m.out.length && m.minTap >= (w >= 760 ? 36 : 22) && m.two === true, ser(m));
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/rmc-weld-${w}.png` });
  await ctx.close();
}

console.log("\n# French and Arabic — General English");
{ const { ctx, p, errs } = await open(seed("general-english", { days: { w1Mon: true } }), { w: 375, lang: "fr" });
  const r = await path(p); const m = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok("fr · translated: 'Semaine 1 sur 12', 'Continuer : Semaine 1', 'Votre feuille de route…', no sideways scroll", /SEMAINE 1 SUR 12/i.test(r.pos) && r.cta === "Continuer : Semaine 1" && /feuille de route/i.test(r.eyebrow) && !m, ser(r));
  ok("fr · review checkpoints and the certificate are translated too ('Point de contrôle', 'Votre certificat')", r.rows.some(x => /point de contrôle/i.test(x.k)) && /votre certificat/i.test(r.rows[16].k), ser(r.rows.map(x => x.k)));
  const fc = await p.evaluate(() => [...document.querySelectorAll("#v-journey .rm-head2-pos,#v-journey .rm-head2-cta-l,#v-journey .rm-path-k")].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.innerText));
  ok("fr · longer French labels are not cut off", !fc.length, ser(fc));
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/rmc-fr-375.png` });
  ok("fr · no page errors", !errs.length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p, errs } = await open(seed("general-english", { days: { w1Mon: true } }), { w: 375, lang: "ar" });
  const r = await path(p);
  const rtl = await p.evaluate(() => { const rm = document.querySelector("#v-journey .rm"), row = document.querySelector("#v-journey .rm-path-row.now"), dot = row.querySelector(".rm-path-dot"), card = row.querySelector(".rm-path-card");
    return { dir: getComputedStyle(rm).direction, dotAfterCard: dot.getBoundingClientRect().left > card.getBoundingClientRect().right - 1, arrow: getComputedStyle(document.querySelector("#v-journey .rm-head2-cta .go-arrow")).transform, hscroll: document.documentElement.scrollWidth > innerWidth } });
  ok("ar · right-to-left: the current lesson's dot sits on the reading side (right of its card), the button arrow is mirrored, no sideways scroll", rtl.dir === "rtl" && rtl.dotAfterCard && /matrix\(-1/.test(rtl.arrow) && !rtl.hscroll, ser(rtl));
  ok("ar · translated button 'تابع الأسبوع 1'", r.cta === "تابع الأسبوع 1", r.cta);
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/rmc-ar-375.png` });
  ok("ar · no page errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# reduced motion");
{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true, w1Tue: true, w1Wed: true } }), { reduce: true });
  /* The new design has no JS-driven count-up ring or rotating knob to begin
     with (a static CSS bar), so there is nothing for reduced-motion to turn
     off — this just proves the bar still renders the right value either way. */
  const r = await path(p);
  ok("reduced motion: the progress bar still shows the real figure (4%) with no animation to suppress", r.barW === "4%", ser(r)); await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { days: { "welding:w1Mon": true, "welding:w1Tue": true, "welding:w1Wed": true } }), { reduce: true });
  /* rmMount's ring text is set inside requestAnimationFrame; "at once" under
     reduced motion still means "after the next paint" — poll for it instead
     of trusting a fixed sleep under a loaded test run. */
  try { await p.waitForFunction(() => document.querySelector("#v-journey .rm-ring-txt b").innerText !== "0%", { timeout: 4000 }); } catch (e) {}
  const r = await p.evaluate(() => ({ pct: document.querySelector("#v-journey .rm-ring-txt b").innerText, tr: getComputedStyle(document.querySelector("#v-journey .rm2-knob")).transitionDuration }));
  ok("W · reduced motion: the figure is shown at once and the knob does not animate", r.pct === "4%" && parseFloat(r.tr) < 0.01, ser(r)); await ctx.close(); }

/* The learner's profession, named on the card (owner, 30 Sep 2026) — Welding only.
   One source: Trades.active() — the same answer the workshops, the standards and
   the reports are built from — so these checks change the profession and read
   the card back. General English has no profession line on either design. */
console.log("\n# the profession the learner picked is named on the card (Welding)");
for (const [id, label, career] of [["welder", "Welder", "welding"], ["instrumentation", "Instrumentation Technician", "instrumentation and control"],
  ["hse", "HSE Officer", "health, safety and environment"], ["millwright", "Millwright", "industrial mechanical maintenance"]]) {
  const { ctx, p, errs } = await open(seed("welding", { professionalTracks: { activeId: "welding", tradeId: id } }));
  const c = await card(p);
  ok(`W · ${id}: the card names "${label}" and its career line follows`, c.prof === label && c.sub === `Track your progress and build the skills you need for a successful career in ${career}.`, ser({ prof: c.prof, sub: c.sub }));
  ok(`W · ${id}: no page errors`, !errs.length, errs.join(" | "));
  await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english"));
  const r = await path(p);
  ok("GE · no profession line — General English has no profession, on either design", !/Welder|Technician|Officer/i.test(r.text), r.text.slice(0, 150));
  await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { professionalTracks: { activeId: "welding", tradeId: "instrumentation" } }), { lang: "fr" });
  const c = await card(p);
  ok("fr · the profession is translated, not left in English", c.prof === "Technicien en instrumentation", ser({ prof: c.prof }));
  await ctx.close(); }
{ const { ctx, p } = await open(seed("welding", { professionalTracks: { activeId: "welding", tradeId: "instrumentation" } }), { w: 375 });
  const r = await p.evaluate(() => { const c = document.querySelector("#v-journey .rm2"), e = c.querySelector(".rm2-prof"), cb = c.getBoundingClientRect(), eb = e.getBoundingClientRect();
    return { inside: eb.right <= cb.right + 0.5 && eb.left >= cb.left - 0.5, hscroll: document.documentElement.scrollWidth > innerWidth, h: Math.round(cb.height) } });
  ok("375px · the profession stays inside the card, no sideways scroll, the card is still compact", r.inside && !r.hscroll && r.h <= 400, ser(r));
  await ctx.close(); }

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
