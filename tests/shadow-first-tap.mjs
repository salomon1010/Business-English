/* BE Mastery V2.8 — the mission → Shadow hand-over on a FIRST tap.

   Pre-existing defect found during Week 7 validation: mvShadow() called
   shLoad() before go("shadow"). The studio's DOM is built by rShadow() when
   the view renders, so in a session that had never opened the Shadow tab the
   first tap on "Hear a professional do it" rejected inside shLoad on a null
   #shPlayerWrap. The clip still appeared, because rShadow() ends by restoring
   S.lastClip — which shLoad had already set before it threw. Weeks 2, 3 and 7
   all link a clip, so all three had it.

   This suite is the regression proof, walking every competency that names a
   clip: fresh session → mission NOTICE → real click on the Shadow row →
   no page error → the Shadow view is open → the studio holds THAT clip →
   its DOM exists → the click was worth no evidence. A second tap in the same
   session (view already built once) must behave the same. It fails on
   83100a5 and passes with the ordering fix.

   Run:  cd tests && node shadow-first-tap.mjs                                */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const PACK = JSON.parse(readFileSync(ROOT + "tracks/general/missions.json", "utf8"));
const CATALOGUE = JSON.parse(readFileSync(ROOT + "catalogue/general.json", "utf8"));
const res = [];
const ok = (n, c, d = "") => { res.push({ name: n, pass: !!c }); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

const LINKED = PACK.competencies.filter(c => c.shadow && c.shadow.vid);
ok("At least one competency links a clip, and every linked clip is in the catalogue with captions",
  LINKED.length >= 1 && LINKED.every(c => CATALOGUE.videos[c.shadow.vid] && (() => { try { readFileSync(ROOT + "captions/" + c.shadow.vid + ".json"); return true; } catch (e) { return false; } })()), LINKED.map(c => c.id + ":" + c.shadow.vid).join());

let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8151, 8152, 8153, 8154, 8155]) {
    const s = spawn("python3", ["-m", "http.server", String(port)], { cwd: ROOT, stdio: "ignore" });
    await sleep(700);
    let served = null;
    try { served = await (await fetch(`http://localhost:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://localhost:${port}`; break; }
    s.kill(); console.log(`  (port ${port} is serving another tree — next)`);
  }
  if (!BASE) { console.error("no free port; pass BASE="); process.exit(1); }
}
console.log("  serving: " + BASE);
const browser = await chromium.launch();

async function fresh(id, viewport) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, viewport || {}));
  await ctx.addInitScript(() => {
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", goal: "Speak with confidence in meetings", ts: Date.now() },
      professionalTracks: { activeId: "general-english" },
      fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} }, "welding": { placed: "full", finished: true, day: 15, done: {} } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
  });
  /* The player API stays off the network: this is about the hand-over, not YouTube. */
  await ctx.route(u => /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/.test(u.href), route => route.abort());
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?tap=" + Date.now(), { waitUntil: "load" });
  await sleep(1000);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov").forEach(e => e.remove()));
  return { ctx, page, errors };
}
const studio = page => page.evaluate(() => ({
  v: cur.v, clip: typeof shClip === "object" && shClip ? shClip.vid : null, last: S.lastClip && S.lastClip.vid,
  wrap: !!document.getElementById("shPlayerWrap"), wrapShown: (document.getElementById("shPlayerWrap") || {}).style?.display === "block",
  url: (document.getElementById("shUrl") || {}).value || "", ytBox: !!document.getElementById("ytBox"),
  shadowView: !!document.getElementById("v-shadow") && document.getElementById("v-shadow").innerHTML.length > 0,
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

for (const c of LINKED) {
  const g = c.missions.find(m => m.kind === "guided");
  for (const [mode, vp] of [["390", null], ["1280", { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false }]]) {
    const L = await fresh(c.id + "@" + mode, vp);
    const untouched = await L.page.evaluate(() => ({ wrap: !!document.getElementById("shPlayerWrap"), last: S.lastClip && S.lastClip.vid || null }));
    ok(`${c.id} @${mode} · a fresh session has never built the Shadow view (no #shPlayerWrap, no last clip)`, untouched.wrap === false && !untouched.last, JSON.stringify(untouched));
    await L.page.evaluate(id => mvGo(id, "notice"), g.id); await sleep(400);
    const row = await L.page.$("#v-mission .mv-shadow");
    ok(`${c.id} @${mode} · NOTICE shows the Shadow row for the linked clip`, !!row);
    const stateBefore = await L.page.evaluate(id => (mvStore()[id] || {}).state, c.id);
    await row.scrollIntoViewIfNeeded(); await row.click();
    await sleep(700);
    const s1 = await studio(L.page);
    ok(`${c.id} @${mode} · FIRST tap: no page error`, L.errors.length === 0, L.errors.join(" | "));
    ok(`${c.id} @${mode} · FIRST tap: the Shadow view is open, its DOM exists, and the studio holds this competency's clip (shClip, S.lastClip, the URL field, the player box)`,
      s1.v === "shadow" && s1.shadowView && s1.wrap && s1.wrapShown && s1.clip === c.shadow.vid && s1.last === c.shadow.vid && s1.url.includes(c.shadow.vid) && s1.ytBox, JSON.stringify(s1));
    ok(`${c.id} @${mode} · FIRST tap: no horizontal overflow`, s1.sw <= s1.cw, JSON.stringify({ sw: s1.sw, cw: s1.cw }));
    const stateAfter = await L.page.evaluate(id => (mvStore()[id] || {}).state, c.id);
    ok(`${c.id} @${mode} · opening the studio is worth no evidence — the competency state is unchanged`, stateAfter === stateBefore && stateBefore === "INTRODUCED", stateBefore + "→" + stateAfter);
    /* second tap, same session: the view has been built once already */
    await L.page.evaluate(id => mvGo(id, "notice"), g.id); await sleep(400);
    const row2 = await L.page.$("#v-mission .mv-shadow"); await row2.scrollIntoViewIfNeeded(); await row2.click(); await sleep(700);
    const s2 = await studio(L.page);
    ok(`${c.id} @${mode} · SECOND tap in the same session: still no error, same clip, DOM rebuilt`, L.errors.length === 0 && s2.v === "shadow" && s2.wrap && s2.clip === c.shadow.vid && s2.url.includes(c.shadow.vid) && s2.ytBox, L.errors.join(" | ") + " " + JSON.stringify(s2));
    await L.ctx.close();
  }
}
/* A Welding learner never sees the row: the mission route turns around. */
const Wd = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await Wd.addInitScript(() => { localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", goal: "g", ts: Date.now() }, professionalTracks: { activeId: "welding" }, fnd: { "welding": { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() })); });
const wp = await Wd.newPage(); const wErr = []; wp.on("pageerror", e => wErr.push(e.message));
await wp.goto(BASE + "/index.html?tapw=" + Date.now(), { waitUntil: "load" }); await sleep(1000);
await wp.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov").forEach(e => e.remove()));
const w = await wp.evaluate(async id => { go("mission", id, "notice"); await new Promise(r => setTimeout(r, 400)); return { v: cur.v, row: !!document.querySelector(".mv-shadow"), last: S.lastClip || null }; }, LINKED[0].missions[0].id);
ok("Welding: the mission route turns around, there is no Shadow row, and no last clip was parked", w.v === "home" && w.row === false && w.last === null && wErr.length === 0, JSON.stringify(w));
await Wd.close();

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
