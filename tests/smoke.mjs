/* Smoke test: open the app in a real headless Chromium, walk every page, and
   assert the things a person would notice — pages render, the bottom bar
   navigates, nothing invisible covers the screen, Home shows what it should,
   the road map draws fast, the reminder and rating flows behave.

     cd tests && npm install && npm test          # against a local server it starts itself
     BASE=https://app.lomonec.com npm test        # against the live site

   Every check is something that was once broken in this app. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

let BASE = process.env.BASE, server = null;
if (!BASE) {
  server = spawn("python3", ["-m", "http.server", "8765"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
  await sleep(700); BASE = "http://localhost:8765";
}
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond, detail }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36" });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
await page.goto(BASE + "/index.html?smoke=" + Date.now(), { waitUntil: "load" });
const wait = ms => page.waitForTimeout(ms);

/* ── first run ── */
ok("First run shows the onboarding wizard", await page.$("#obWrap"));
await page.evaluate(async () => { OB.name = "Smoke"; obFinish(); });
await wait(600);
ok("Finishing onboarding shows ONE welcome card and no second dialog", await page.evaluate(() => !!document.getElementById("wcOv") && !document.getElementById("fndCheckOv")));
await page.evaluate(() => wcClose()); await wait(900);
ok("Closing the welcome leaves no overlay behind", await page.evaluate(() => document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov,#obWrap").length === 0));

/* ── the bottom bar reaches every page ── */
for (const v of ["journey", "shadow", "phrases", "practice", "review", "profile"]) {
  await page.evaluate(() => document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov").forEach(e => e.remove()));
  const r = await page.evaluate(async (v) => {
    const b = document.querySelector('.bnav-item[data-v="' + v + '"]'); const rc = b.getBoundingClientRect();
    const top = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
    const covered = top && !b.contains(top) ? (top.id || top.className) : null;
    b.click(); await new Promise(r => setTimeout(r, 400));
    const view = document.getElementById("v-" + v);
    return { covered, hash: location.hash, on: b.classList.contains("on"), rendered: !!view && view.classList.contains("on") && view.innerText.trim().length > 20 };
  }, v);
  ok(`Bar → ${v}: tap lands on the button, page renders`, !r.covered && r.hash === "#" + v && r.on && r.rendered, JSON.stringify(r));
}

/* ── an invisible sheet must not swallow taps; a shown one must block ── */
ok("An unshown modal sheet does not intercept taps; a shown one does", await page.evaluate(async () => {
  go("journey"); await new Promise(r => setTimeout(r, 300));
  const g = document.createElement("div"); g.className = "cf-ov"; g.innerHTML = "<div class='cf-card'>x</div>"; document.body.appendChild(g);
  const b = document.querySelector('.bnav-item[data-v="shadow"]'); const rc = b.getBoundingClientRect();
  const hit1 = b.contains(document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2));
  g.classList.add("show"); await new Promise(r => setTimeout(r, 250));
  const hit2 = b.contains(document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2));
  g.remove(); return hit1 && !hit2;
}));

/* ── road map: fast, and drawn ── */
const rm = await page.evaluate(async () => { go("journey"); await new Promise(r => setTimeout(r, 500)); const road = document.getElementById("rmRoad"); const a = performance.now(); rmDraw(road); return { ms: performance.now() - a, pins: road.querySelectorAll(".rm-pin").length, arrows: road.querySelectorAll(".rm-arw").length }; });
ok("Road map draws in under 300 ms", rm.ms < 300, Math.round(rm.ms) + " ms");
ok("Road map has pins and arrows", rm.pins > 5 && rm.arrows > 3, JSON.stringify(rm));
ok("Every page opens in under 500 ms", await page.evaluate(async () => { let worst = 0; for (const v of ["home","journey","shadow","phrases","practice","review","profile","data"]) { const t0 = performance.now(); go(v); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); worst = Math.max(worst, performance.now() - t0); document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov").forEach(e => e.remove()); } return worst < 500; }));

/* ── Home ── */
const home = await page.evaluate(async () => {
  const f = fndState(); delete f.placed; delete f.checkedAt; delete f.finished; save();
  go("shadow"); await new Promise(r => setTimeout(r, 100)); go("home"); await new Promise(r => setTimeout(r, 500));
  const cards = [...document.getElementById("v-home").querySelectorAll(":scope > .card, :scope > section.card, :scope > button.card")].map(c => c.className);
  return { first: cards[0] || "", optional: cards.filter(c => /home-ios|home-rate|coach-card/.test(c)).length, popup: !!document.getElementById("fndCheckOv") };
});
ok("Home: the placement check is the first card, and does not pop up on its own", /fnd-home/.test(home.first) && !home.popup, JSON.stringify(home));
ok("Home: at most one optional card", home.optional <= 1, String(home.optional));

/* ── the road-map notice waits to be read ── */
const notice = await page.evaluate(async () => {
  delete S.rmSeen; delete S.rmToasted; save(); go("shadow"); await new Promise(r => setTimeout(r, 100)); go("home"); await new Promise(r => setTimeout(r, 3000));
  const there = !!document.getElementById("rmNotice"); document.querySelector("#rmNotice .auth-go").click(); await new Promise(r => setTimeout(r, 300));
  return { there, gone: !document.getElementById("rmNotice"), onMap: location.hash === "#journey", dot: document.querySelector('.bnav-item[data-v="journey"]').classList.contains("rm-new") };
});
ok("Road-map notice stays until acted on; 'Show me' opens the map and clears it", notice.there && notice.gone && notice.onMap && !notice.dot, JSON.stringify(notice));

/* ── rating: persistent until posted, Android only ── */
const rate = await page.evaluate(async () => {
  let n = 0; for (const w of trackWeeks()) for (const d of trackDays()) { if (n < 7) { S.days[dayKey(w.n, d)] = { at: Date.now() }; n++; } }
  delete S.rated; delete S.rateSnoozed; S.rmSeen = Date.now(); const f = fndState(); f.placed = "full"; f.finished = true; save();
  go("shadow"); await new Promise(r => setTimeout(r, 100)); go("home"); await new Promise(r => setTimeout(r, 400));
  const a = !!document.getElementById("homeRate"); rateLater(); go("shadow"); await new Promise(r => setTimeout(r, 100)); go("home"); await new Promise(r => setTimeout(r, 400));
  const b = !!document.getElementById("homeRate"); return { a, b, dialogDue: rateDue() === false };
});
ok("Rating card appears after 7 sessions and returns after 'Not now'; the dialog waits 3 days", rate.a && rate.b && rate.dialogDue, JSON.stringify(rate));

/* ── reminder on iPhone-in-Safari explains the Home Screen step ── */
ok("Reminder note on an uninstalled iPhone says to add to Home Screen", await page.evaluate(() => { const io = iosIs, st = iosStandalone; iosIs = () => true; iosStandalone = () => false; const h = remNoteHTML(); iosIs = io; iosStandalone = st; return /Home Screen/.test(h) && /iosAsk/.test(h); }));

/* ── speech: sentence chunks, opener first ── */
ok("A colleague's line is split with the first sentence alone", await page.evaluate(() => { const c = ttsChunks("Hello there. Welcome to the workshop, please put on your helmet. Ready?"); return c.length >= 2 && c[0] === "Hello there."; }));

/* ── no JavaScript errors anywhere above ── */
ok("No uncaught JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
