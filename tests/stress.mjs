/* Navigation stress with a realistic large state, both tracks, phone emulation.
   For every tap: does the tap reach the button, does the page change, any
   long task / slow save / render error, and how big is the saved state. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const root = "/Users/salomonnorengoucheme/Documents/GitHub/Business-English";
const server = spawn("python3", ["-m", "http.server", "8781"], { cwd: root, stdio: "ignore" }); await sleep(700);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36" });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e.message).slice(0, 120)));
const cdp = await ctx.newCDPSession(page);

const LOREM = "We completed the root pass on the number two line and left the cap open for the inspector, who asked us to flag the porosity near the weld toe before the night shift took the handover. ";

async function fresh() {
  await page.goto("http://localhost:8781/index.html?t=" + Date.now(), { waitUntil: "load" });
}
async function seedBig() {
  return page.evaluate((LOREM) => {
    const now = Date.now(), day = 864e5;
    // 120 days of activity
    S.dates = []; S.dayLog = {};
    for (let i = 0; i < 120; i++) { if (i % 3 === 2) continue; const k = new Date(now - i * day).toISOString().slice(0, 10); S.dates.push(k); S.dayLog[k] = 1 + (i % 3); }
    for (const tr of ["general-english", "welding"]) {
      ProfessionalTrackContext.setActive(tr);
      // 5 weeks of sessions with notes and scores
      let n = 0;
      for (const w of trackWeeks().slice(0, 5)) for (const d of Object.keys(w.days || {})) {
        const k = dayKey(w.n, d); S.days[k] = { at: now - n * day }; S.scores[k] = 5 + (n % 5);
        S.notes["script:" + k] = LOREM.repeat(3); S.notes["shheard:sess-" + k] = LOREM.repeat(2); n++;
      }
      // 40 conversations with transcripts
      S.convos = S.convos || [];
      for (let i = 0; i < 20; i++) S.convos.push({ ts: now - i * day, id: "iv-tellme", title: "Tell me about yourself", cat: "interview", tk: tr, covered: 2, total: 3, turns: 8,
        lines: Array.from({ length: 16 }, (_, j) => ({ text: LOREM.slice(0, 120 + (j * 17) % 80) })) });
      // 15 clips with transcripts
      for (let i = 0; i < 15; i++) aList("clips").unshift({ vid: "abc" + i, start: 12.5, end: 40.2, title: "Clip " + i, ts: now - i * day, txt: LOREM.repeat(6) });
      // feedback history
      S.fbHist = S.fbHist || [];
      for (let i = 0; i < 50; i++) S.fbHist.push({ ts: now - i * 3600e3, score: 60 + (i % 40), wpm: 100 + i, words: 40 + i, tk: tr });
      // quizzes
      for (let i = 0; i < 30; i++) aList("quizHist").push({ t: now - i * day, p: 40 + (i % 60) });
      // vocabulary, 120 words each area
      for (let i = 0; i < 120; i++) vocPut((tr === "welding" ? "weld" : "biz") + "word" + i, ["A2", "B1", "B2", "C1"][i % 4]);
      // trouble words
      const tb = troubleMap(); for (let i = 0; i < 40; i++) tb["trouble" + tr[0] + i] = { n: 1 + (i % 5), ts: now - i * day };
      // workshop attempts with transcripts
      const at = simAttemptStore(S);
      for (let i = 0; i < 12; i++) { const id = "sim" + (i % 3); (at[id] = at[id] || []).push({ ts: now - i * day, tk: tr, score: 50 + i * 3, transcript: LOREM.repeat(8), objectives: [true, false, true] }); }
    }
    ProfessionalTrackContext.setActive("general-english");
    saveFlush();
    return Math.round((localStorage.getItem(LS_KEY) || "").length / 1024);
  }, LOREM);
}
async function onboard(track) {
  /* boot's own go("home") must land before the wizard is finished, as it always
     does for a human — on the live site the curriculum fetch made it arrive
     after obFinish(), which scheduled Home's backup nudge over the road map */
  await sleep(2500);   // a person spends far longer than this in the wizard; boot must not still be landing
  await page.evaluate(async (track) => { OB.name = "Stress"; OB.track = track; S.professionalTracks = { activeId: track }; ProfessionalTrackContext.setActive(track); if (track === "welding") OB.trade = "welder"; obFinish(); }, track);
  await sleep(500);
  const r = await page.evaluate(() => ({ landed: cur.v, hash: location.hash, track: activeProfessionalTrack().id, welcome: !!document.getElementById("wcOv"), homeFirst: document.getElementById("v-home").classList.contains("on") }));
  await page.evaluate(() => { try { wcClose(); } catch (e) {} document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov,#obWrap").forEach(e => e.remove()); });
  await sleep(300);
  return r;
}
/* tap a nav icon as a finger would (3 random spots), record everything */
async function tap(v, opts = {}) {
  return page.evaluate(async ({ v, opts }) => {
    const b = document.querySelector('.bnav-item[data-v="' + v + '"]'); const r = b.getBoundingClientRect();
    const fx = 0.2 + Math.random() * 0.6, fy = 0.15 + Math.random() * 0.7;
    const x = r.left + r.width * fx, y = r.top + r.height * fy;
    const top = document.elementFromPoint(x, y);
    const reachable = b.contains(top);
    const blockedBy = reachable ? "" : (top ? (top.id || (typeof top.className === "string" ? top.className : top.tagName)).toString().slice(0, 24) : "nothing");
    const before = _perfLog.length;
    const t0 = performance.now();
    b.click();                                         // the real onclick path
    const sync = performance.now() - t0;
    if (!opts.rapid) await new Promise(res => setTimeout(res, opts.wait || 350));
    const stalls = _perfLog.slice(before).map(x => x.kind + ":" + x.ms + (x.note ? "(" + x.note + ")" : ""));
    return { v, reachable, blockedBy, landed: cur.v, ok: reachable && cur.v === v, sync: Math.round(sync), stalls, scrollY: Math.round(window.scrollY) };
  }, { v, opts });
}
async function scrollDown(px) { await page.evaluate(px => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, px); document.documentElement.style.scrollBehavior = ""; }, px); await sleep(250); return page.evaluate(() => Math.round(window.scrollY)); }

const SEQ = ["journey", "shadow", "journey", "phrases", "journey", "practice", "journey", "review", "journey", "profile", "journey"];
const RAPID = ["journey", "shadow", "journey", "phrases", "practice", "review", "profile"];
const results = {};

for (const track of ["general-english", "welding"]) {
  await fresh();
  const ob = await onboard(track);
  const kb = await seedBig();
  await page.evaluate(t => { ProfessionalTrackContext.setActive(t); go("journey"); }, track);
  await sleep(400);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const R = { onboarding: ob, stateKB: kb, taps: 0, failures: [], stalls: [], maxSync: 0, scrolledFrom: [] };
  const rec = t => { R.taps++; R.maxSync = Math.max(R.maxSync, t.sync); if (!t.ok) R.failures.push(t); t.stalls.forEach(s => R.stalls.push(t.v + " " + s)); };
  // 1) the sequence, three times, polite pace
  for (let k = 0; k < 3; k++) for (const v of SEQ) rec(await tap(v));
  // 2) scrolled deep on the road map, then every icon, repeated
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => go("journey")); await sleep(300);
    const y = await scrollDown(1500 + k * 700); R.scrolledFrom.push(y);
    for (const v of ["shadow", "phrases", "practice", "review", "profile"]) { rec(await tap(v)); await page.evaluate(() => go("journey")); await sleep(200); await scrollDown(1500 + k * 700); }
  }
  // 3) rapid taps, no waiting between them, three rounds
  for (let k = 0; k < 3; k++) { for (const v of RAPID) rec(await tap(v, { rapid: true })); await sleep(500); }
  const settled = await page.evaluate(() => ({ view: cur.v, hash: location.hash, onView: [...document.querySelectorAll(".view.on")].map(e => e.id) }));
  R.settledAfterRapid = settled;
  // 4) the deferred save still coalesces at this size
  R.save = await page.evaluate(async () => { let writes = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === LS_KEY) writes++; return o.call(this, k, v); };
    const t0 = performance.now(); for (let i = 0; i < 15; i++) { S.burst = i; save(); } const inHandler = performance.now() - t0; await new Promise(r => setTimeout(r, 700)); Storage.prototype.setItem = o;
    const log = _perfLog.filter(x => x.kind === "save").slice(-1)[0]; return { writesFor15Saves: writes, msSpentInHandler: Math.round(inHandler), lastWriteMs: log ? log.ms : "<30" }; });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  results[track] = R;
}
console.log(JSON.stringify(results, null, 1));
console.log("PAGE ERRORS:", errors.length ? errors : "none");
await browser.close(); server.kill();
