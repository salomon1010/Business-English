/* Shadow Studio mobile layout — the redressed workspace (General English, library on), 26 Sep 2026.
   Run: cd tests && node shadow-layout.mjs        (BASE=… to test another tree, e.g. staging)

   WebKit (the engine of iPhone Safari), iPhone 13 portrait. What a real iPhone showed: the pinned
   video pushed off the top and cropped over an empty screen (Watch or Challenge scrolled to the end),
   and a Shadow page reached from a scrolled Watch page opened with its card behind the video. Cause:
   the room under the content was 72vh of padding OUTSIDE the sticky video's container, and a mode
   change kept the old scroll position. Every state below must keep the video whole and the page's
   content visible between the video and the bottom bar. */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8135);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await webkit.launch();
const CLIP = "MZAjfsyJa1U";
async function learner(track) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-polish|entitlements/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(t => { if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Probe", lang: "en", ts: 1 }, professionalTracks: { activeId: t, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() })); }, track);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html?lay=" + Date.now() + "#shadow"); await sleep(2500);
  await p.evaluate(async c => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()); go("shadow"); await new Promise(r => setTimeout(r, 600)); await shLoad({ vid: c, start: 0, end: 0, title: "clip" }, true); }, CLIP);
  await sleep(3000); await p.evaluate(() => shOpenWork()); await sleep(800);
  return { ctx, p, errs };
}
/* where things are, in viewport pixels */
const lay = p => p.evaluate(() => {
  const W = document.getElementById("shWork"), body = W.querySelector(".sh-work-body"), st = W.querySelector(".sh-stick"), bar = document.getElementById("shv3Bar"), fr = W.querySelector("#shPlayerWrap .yt-ratio");   /* the video's frame (the iframe fills it) */
  const R = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width) }; };
  const top = R(body).t;
  return { mode: svMode, v3: !!W.dataset.v3, scroll: Math.round(body.scrollTop), maxScroll: body.scrollHeight - body.clientHeight, bodyTop: top, stick: R(st), video: R(fr), bar: R(bar), vw: innerWidth, vh: innerHeight,
    card: R(W.querySelector(".sv-sh-card")), ch: R(W.querySelector("#svCh")), tx: R(W.querySelector("#svTx")), v2: !!document.getElementById("shV2"),
    lastPara: R([...W.querySelectorAll("#svTx .sv-para")].pop()), nowSeg: R(W.querySelector("#svTx .sv-seg.now")),
    lastBottom: Math.round(Math.max(...[...document.getElementById("shPlayerWrap").children].filter(c => getComputedStyle(c).display !== "none").map(c => c.getBoundingClientRect().bottom))) };
});
/* the video is whole: pinned at the top of the page area, full height, 16:9, inside the screen */
const videoWhole = L => L.stick && L.stick.t === L.bodyTop && L.video && Math.abs(L.video.w / L.video.h - 16 / 9) < 0.05 && L.video.t >= L.stick.t && L.video.b <= L.stick.b && L.video.l >= 0 && L.video.r <= L.vw && L.video.h > 150;
/* content that opens right under the video (never behind it) and mostly on screen; what the bar
   covers at the bottom is reached by a short scroll — the bar floats over the page by design */
const opensUnder = (L, el) => el && el.t >= L.stick.b && visible(L, el) >= Math.min(el.h, 0.8 * (L.bar.t - L.stick.b)) - (el.t - L.stick.b);
/* an element's visible slice between the video and the bottom bar */
const visible = (L, el) => el ? Math.max(0, Math.min(el.b, L.bar ? L.bar.t : L.vh) - Math.max(el.t, L.stick.b)) : 0;
const scrollEnd = p => p.evaluate(() => { const b = document.querySelector("#shWork .sh-work-body"); b.scrollTop = b.scrollHeight; }).then(() => sleep(350));

console.log("\n# General English, the redressed workspace, iPhone 13 (WebKit)");
const { ctx, p, errs } = await learner("general-english");
let L = await lay(p);
ok("1 · Watch opens in the redressed workspace: the video is whole (pinned at the top, 16:9, inside the screen), the transcript under it, the bottom bar present", L.v3 && L.mode === "watch" && videoWhole(L) && visible(L, L.tx) > 200 && L.bar && L.bar.b <= L.vh, JSON.stringify(L));
ok("2 · the video never pushes the page: the bottom bar sits inside the screen and below the video", L.bar.t > L.stick.b && L.bar.b <= L.vh + 1, JSON.stringify({ stick: L.stick, bar: L.bar }));
await scrollEnd(p); L = await lay(p);
ok("3 · Watch scrolled to the very end: the video is still whole — not pushed off the top, not cropped (it was: the room under the page sat outside the pinned video's container)", videoWhole(L), JSON.stringify(L));
ok("4 · … and the last paragraph is on screen just under the video, not behind it, and not an empty screen", L.lastPara && L.lastPara.t >= L.stick.b && visible(L, L.lastPara) === L.lastPara.h, JSON.stringify({ stick: L.stick, last: L.lastPara, bar: L.bar }));
/* playback: the follow-along moves the page to the spoken paragraph */
for (const k of [0.3, 0.7, 0.98]) {
  await p.evaluate(k => { const n = svAsset.segments.length; const s = svAsset.segments[Math.floor((n - 1) * k)]; shSeek = { t: (s.startMs + 50) / 1000, at: Date.now() }; svUserScrollAt = 0; svTick(); }, k);
  await sleep(1200); L = await lay(p);
  ok(`5 · playback at ${Math.round(k * 100)}%: the follow-along keeps the video whole and the spoken line visible under it`, videoWhole(L) && L.nowSeg && visible(L, L.nowSeg) > 0 && L.nowSeg.t >= L.stick.b - 2, JSON.stringify({ stick: L.stick, now: L.nowSeg, bar: L.bar }));
}
/* from a scrolled Watch page to Shadow: the card must open in full under the video */
await scrollEnd(p);
await p.evaluate(() => svSetMode("shadow")); await sleep(600); L = await lay(p);
ok("6 · Watch (scrolled) → Shadow: the page starts at the top and the paragraph card opens right under the whole video, on screen (it opened behind the video)", L.scroll === 0 && videoWhole(L) && opensUnder(L, L.card), JSON.stringify({ scroll: L.scroll, stick: L.stick, card: L.card, bar: L.bar }));
await scrollEnd(p);
await p.evaluate(() => svShStep(1)); await sleep(600); L = await lay(p);
ok("7 · Shadow, the next paragraph (») after scrolling: back to the top with the new card right under the video", L.scroll === 0 && opensUnder(L, L.card) && videoWhole(L), JSON.stringify({ scroll: L.scroll, card: L.card }));
await scrollEnd(p); L = await lay(p);
ok("8 · Shadow scrolled to the end: the video is whole, and the page stops with its last card just above the bar — no empty screen", videoWhole(L) && L.maxScroll < 260 && L.bar.t - L.lastBottom <= 40, JSON.stringify({ stick: L.stick, max: L.maxScroll, lastBottom: L.lastBottom, bar: L.bar }));
/* Challenge: every rung keeps the page and the video */
await p.evaluate(() => { svPick = 3; svSetMode("challenge"); }); await sleep(600); L = await lay(p);
ok("9 · → Challenge: the page starts at the top and the Challenge panel opens right under the whole video", L.scroll === 0 && videoWhole(L) && opensUnder(L, L.ch), JSON.stringify({ scroll: L.scroll, ch: L.ch, stick: L.stick }));
for (const rung of ["sync", "recall", "blind", "retell", "gate"]) {
  await p.evaluate(r => { if (svCh && svCh.rungs.includes(r)) svChGoRung({ rung: r, speed: 1, fails: 0, move: "up" }); }, rung); await sleep(400); L = await lay(p);
  ok(`10 · rung ${rung}: the panel stays mounted and on screen, the video whole, the bar inside the screen`, L.v2 && L.ch && visible(L, L.ch) > 80 && videoWhole(L) && L.bar.b <= L.vh + 1, JSON.stringify({ ch: L.ch, stick: L.stick, bar: L.bar }));
}
await scrollEnd(p); L = await lay(p);
ok("11 · Challenge scrolled to the end: the video is whole and the panel is still visible above the bar (it was cropped over an empty screen)", videoWhole(L) && visible(L, L.ch) > 100, JSON.stringify({ stick: L.stick, ch: L.ch, bar: L.bar }));
/* the player re-renders (the same clip reopened), and player state changes redraw the bar */
await p.evaluate(async c => { shv3Sync(); svRender(); await shLoad({ vid: c, start: 0, end: 0, title: "again" }, true); }, CLIP); await sleep(3000);
await p.evaluate(() => { shOpenWork(); svSetMode("shadow"); }); await sleep(600); L = await lay(p);
ok("12 · the same video reopened (player re-rendered): the Shadow card is present and opens right under the whole video", L.v2 && opensUnder(L, L.card) && videoWhole(L), JSON.stringify({ card: L.card, stick: L.stick }));
/* Safari's toolbar: the page area changes height — the sizes follow, no stale measurement */
const readBefore = await p.evaluate(() => getComputedStyle(document.getElementById("shWork")).getPropertyValue("--sh-read"));
await p.evaluate(() => svSetMode("watch")); await sleep(400);
const r0 = await p.evaluate(() => getComputedStyle(document.getElementById("shWork")).getPropertyValue("--sh-read"));
await p.setViewportSize({ width: 390, height: 560 }); await sleep(500);
const r1 = await p.evaluate(() => getComputedStyle(document.getElementById("shWork")).getPropertyValue("--sh-read"));
await scrollEnd(p); L = await lay(p);
ok("13 · the viewport gets shorter (Safari's toolbar appears): the reading room is re-measured, and at the end the video is whole and the last paragraph visible", parseInt(r1) < parseInt(r0) && videoWhole(L) && L.lastPara && visible(L, L.lastPara) === L.lastPara.h, JSON.stringify({ r0, r1, L: { stick: L.stick, last: L.lastPara, bar: L.bar } }));
await p.setViewportSize({ width: 390, height: 664 }); await sleep(500);
const r2 = await p.evaluate(() => getComputedStyle(document.getElementById("shWork")).getPropertyValue("--sh-read"));
ok("14 · … and taller again: re-measured back", parseInt(r2) > parseInt(r1), JSON.stringify({ r1, r2, readBefore }));
/* Your videos is listed once */
const own = await p.evaluate(async () => { shCloseWork(); go("shadow"); await new Promise(r => setTimeout(r, 300)); shOwnAdd("aaaaaaaaaa9", "https://youtu.be/aaaaaaaaaa9"); const top = (document.getElementById("shOwnTop") || { innerHTML: "" }).innerHTML.trim(); const i = shOwnFind("aaaaaaaaaa9"); if (i >= 0) { shOwn().splice(i, 1); save(); shOwnRender(); } return { top, lib: !!document.getElementById("shLib") }; });
ok("15 · 'Your videos' is not drawn twice: nothing above the library after an add", own.lib && own.top === "", JSON.stringify(own));
ok("16 · no JavaScript errors", !errs.length, errs.join(" | "));
await ctx.close();

console.log("\n# Welding: the classic workspace, unchanged");
{
  const W = await learner("welding");
  const w = await W.p.evaluate(() => { const Wk = document.getElementById("shWork"), body = Wk.querySelector(".sh-work-body"); return { v3: !!Wk.dataset.v3, bar: !!document.getElementById("shv3Bar"), v2: svOn(), ch: svChOn(), pad: getComputedStyle(body).paddingBottom, wrapPad: getComputedStyle(document.getElementById("shPlayerWrap")).paddingBottom }; });
  ok("17 · Welding: no redressed workspace, no bottom bar, no Shadow Studio V2 or Challenge — and its padding is the classic one (on the page, not the player's container)", !w.v3 && !w.bar && !w.v2 && !w.ch && parseFloat(w.pad) > 0 && parseFloat(w.wrapPad) === 0, JSON.stringify(w));
  ok("18 · Welding: no JavaScript errors", !W.errs.length, W.errs.join(" | "));
  await W.ctx.close();
}
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
