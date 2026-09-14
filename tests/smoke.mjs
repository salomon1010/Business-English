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

/* ── the bottom bar takes every tap, everywhere on every button ──
   The invisible toast used to park itself over Phrase Lab and Practice at
   z-index 150 after fading out; the old centre-point check missed it by a few
   pixels. Nine points per button, after a long message has shown and hidden. */
const grid = await page.evaluate(async () => {
  document.querySelectorAll(".cf-ov,.wc-ov").forEach(e => e.remove());
  toast("Twenty-five minutes — attention fades here. Wrap up and log what you did today, then rest.");
  await new Promise(r => setTimeout(r, 2700));                       // shown, then hidden again
  const bad = [];
  for (const b of document.querySelectorAll(".bnav-item")) {
    const r = b.getBoundingClientRect();
    for (const fy of [0.2, 0.5, 0.8]) for (const fx of [0.25, 0.5, 0.75]) {
      const el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
      if (!b.contains(el)) bad.push(b.dataset.v + "@" + fx + "," + fy + "→" + (el ? (el.id || el.className || el.tagName) : "?"));
    }
  }
  return bad;
});
ok("After a toast has hidden, every point on every bar button still reaches the button", grid.length === 0, grid.slice(0, 4).join(" | "));

/* ── an offer that opened on its own never blocks the bar ── */
const offer = await page.evaluate(async () => {
  go("phrases"); await new Promise(r => setTimeout(r, 300));
  localStorage.removeItem("be_ex_how"); exHow(); await new Promise(r => setTimeout(r, 250));
  const open = !!document.querySelector(".exd-ov");
  const b = document.querySelector('.bnav-item[data-v="practice"]'); const rc = b.getBoundingClientRect();
  const reach = b.contains(document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2));
  b.click(); await new Promise(r => setTimeout(r, 350));
  return { open, reach, landed: cur.v, offerGone: !document.querySelector(".exd-ov") };
});
ok("With a 'How it works' offer open, a bar tap still reaches the button, navigates, and clears the offer", offer.open && offer.reach && offer.landed === "practice" && offer.offerGone, JSON.stringify(offer));

/* ── a page that fails to draw does not take the bar down with it ── */
const broken = await page.evaluate(async () => {
  const real = rShadow; window.rShadow = () => { throw new Error("smoke: forced render failure"); };
  let threw = false; try { go("shadow"); } catch (e) { threw = true; }
  const retry = !!document.querySelector("#v-shadow .btn"); const logged = _perfLog.some(x => x.kind === "error");
  window.rShadow = real; go("practice"); await new Promise(r => setTimeout(r, 300));
  return { threw, retry, logged, recovered: cur.v === "practice" && document.getElementById("v-practice").innerText.length > 20 };
});
ok("A renderer that throws leaves a retry card, logs it, and the next tap still navigates", !broken.threw && broken.retry && broken.logged && broken.recovered, JSON.stringify(broken));

/* ── onboarding lands on the road map on both tracks ── */
const land = await page.evaluate(async () => {
  const out = {};
  for (const tr of ["general-english", "welding"]) {
    localStorage.removeItem(LS_KEY); S = load(); OB.name = "Smoke"; OB.track = tr;
    /* what obTrackPick does minus obNext(), which needs the wizard's DOM */
    if (tr === "welding") { S.professionalTracks = { activeId: "welding" }; ProfessionalTrackContext.setActive("welding"); OB.trade = "welder"; }
    else { S.professionalTracks = { activeId: "general-english" }; ProfessionalTrackContext.setActive("general-english"); }
    obFinish(); await new Promise(r => setTimeout(r, 300));
    out[tr] = { v: cur.v, track: activeProfessionalTrack().id, homeFirst: document.getElementById("v-home").classList.contains("on"), welcome: !!document.getElementById("wcOv") };
    try { wcClose(); } catch (e) {} document.querySelectorAll(".cf-ov,.wc-ov").forEach(e => e.remove()); await new Promise(r => setTimeout(r, 250));
  }
  return out;
});
ok("Onboarding lands on the road map, not Home — General English", land["general-english"].v === "journey" && !land["general-english"].homeFirst && land["general-english"].track === "general-english", JSON.stringify(land["general-english"]));
ok("Onboarding lands on the road map, not Home — Welding, with the welding track selected", land["welding"].v === "journey" && !land["welding"].homeFirst && land["welding"].track === "welding", JSON.stringify(land["welding"]));

/* ── no JavaScript errors anywhere above ── */
ok("No uncaught JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
