/* My clips in the Shadow workspace (owner, 27 Sep 2026): the star on the Shadow card keeps a passage,
   the … menu opens the list, a clip opens straight back into Shadow on its passage, and can be deleted.
   Free keeps 1, Premium 30 — where plans apply. The … menu no longer carries Clip / Transcript.
   Run: cd tests && node shadow-clips.mjs        (BASE=… for another tree)
   WebKit, iPhone 13; YouTube is a stand-in player, the clip's words are the bundled captions. */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8139);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await webkit.launch();
const VID = "MZAjfsyJa1U";
async function learner({ track = "general-english", plans = true, premium = false } = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-polish|youtube|ytimg|entitlements|ent\.test/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([track, plans]) => {
    if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1);
      localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Probe", lang: "en", ts: 1 }, professionalTracks: { activeId: track, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() }));
      if (plans) { localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true })); localStorage.setItem("be_ent_api", "http://ent.test"); } }
    const P = function (id, o) { const me = { destroy() {}, playVideo() {}, pauseVideo() {}, seekTo(t) { window.__t = t; }, setPlaybackRate() {}, getPlaybackRate: () => 1, getPlayerState: () => 2, getCurrentTime: () => window.__t || 0, getDuration: () => 200, getVideoData: () => ({ title: "Climate summit" }), getIframe: () => null };
      setTimeout(() => { try { o && o.events && o.events.onReady && o.events.onReady({ target: me }); } catch (e) {} }, 300); return me; };
    window.YT = { Player: P, PlayerState: { PLAYING: 1, PAUSED: 2, BUFFERING: 3, ENDED: 0 } };
  }, [track, plans]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html?sc=" + Date.now() + "#shadow"); await sleep(2500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  if (premium) await p.evaluate(() => { window.entIsPremiumForDisplay = () => true; });
  return { ctx, p, errs };
}
const openShadow = p => p.evaluate(async v => { await shLoad({ vid: v, start: 0, end: 0, title: "" });
  for (let i = 0; i < 40 && !(svAsset && svAsset.segments && svAsset.segments.length); i++) await new Promise(z => setTimeout(z, 200));
  svSetMode("shadow"); await new Promise(z => setTimeout(z, 300)); return { segs: svAsset && svAsset.segments.length, mode: svMode }; }, VID);
const star = p => p.evaluate(async () => { const toast0 = document.getElementById("toast").innerText; document.querySelector("#svSh .sv-sh-fav").click(); await new Promise(z => setTimeout(z, 300));
  const cf = document.querySelector(".cf-ov"); const b = document.querySelector("#svSh .sv-sh-fav");
  return { n: aList("clips").length, toast: document.getElementById("toast").innerText, dialog: cf ? cf.querySelector("h3").innerText : null, on: !!(b && b.classList.contains("on")) }; });
const closeDialog = p => p.evaluate(() => document.querySelectorAll(".cf-ov").forEach(e => e.remove()));

console.log("\n# General English, Free (plans on)");
{
  const { ctx, p, errs } = await learner();
  const o = await openShadow(p);
  ok("1 · a library clip opens in Shadow with its words", o.segs > 5 && o.mode === "shadow", JSON.stringify(o));
  const a = await star(p);
  ok("2 · the star on the Shadow card keeps this passage: 'Saved to My clips (1/1)', the star lights", a.n === 1 && /Saved to My clips \(1\/1\)/.test(a.toast) && a.on && !a.dialog, JSON.stringify(a));
  const saved = await p.evaluate(() => ({ c: aList("clips")[0], g: svShGroup() }));
  ok("3 · what is kept is the passage itself: this video, the passage's start and end, its words", saved.c.vid === "MZAjfsyJa1U" && Math.abs(saved.c.start * 1000 - saved.g.startMs) < 150 && saved.c.txt === saved.g.text, JSON.stringify(saved));
  await p.evaluate(() => svShStep(1)); await sleep(300);
  const full = await star(p);
  ok("4 · Free keeps one: a second passage is refused with 'My clips is full (1)' and a way to Premium — nothing is added", full.n === 1 && full.dialog === "My clips is full (1)" && !full.on, JSON.stringify(full));
  const body = await p.evaluate(() => { const c = document.querySelector(".cf-ov"); return c ? c.innerText : ""; });
  ok("5 · … the dialog says Premium keeps up to 30 and a clip can be deleted instead", /Premium keeps up to 30/.test(body) && /delete a clip/i.test(body), body);
  await closeDialog(p);
  const menu = await p.evaluate(async () => { shv3More(); await new Promise(z => setTimeout(z, 200)); const ov = document.getElementById("shv3MoreOv");
    const r = { rows: [...ov.querySelectorAll(".pf-row b")].map(x => x.innerText.trim()), clips: !!ov.querySelector("[onclick*='shClipsSheet']"), jump: !!ov.querySelector("[onclick*='shv3Jump']"), save: !!ov.querySelector("[onclick*='shSaveClip']") }; ov.querySelector(".sh-clips-row").click(); await new Promise(z => setTimeout(z, 300)); return r; });
  ok("6 · the … menu: Watch, Shadow, Challenge, My clips (with its count) — no Clip, no Transcript, no bare Save clip", menu.clips && !menu.jump && !menu.save && menu.rows.some(r => /^My clips\s*1$/.test(r)) && !menu.rows.some(r => /^(Clip|Transcript)$/.test(r)), JSON.stringify(menu));
  const sheet = await p.evaluate(() => { const ov = document.getElementById("shClipsOv"); return ov && { h: ov.querySelector("h2").innerText.trim(), items: ov.querySelectorAll(".sh-clip-item").length, say: (ov.querySelector(".sh-clip-say") || {}).innerText || "", del: ov.querySelectorAll(".sh-clip-del").length }; });
  const nm = await p.evaluate(() => { const b = document.querySelector("#shClipsOv .sh-clip-txt b"); return b && b.innerText; });
  ok("7b · a clip is named by the video's title, never its id", nm && nm !== "MZAjfsyJa1U" && nm.length > 3, nm);
  ok("7 · My clips opens a page of the saved clips: the count against the plan (1/1), the passage's words, a delete button", sheet && /My clips\s*1\/1/.test(sheet.h) && sheet.items === 1 && sheet.say.length > 10 && sheet.del === 1, JSON.stringify(sheet));
  await p.evaluate(async () => { document.getElementById("shClipsOv").remove(); svShStep(2); await new Promise(z => setTimeout(z, 200)); svSetMode("watch"); await new Promise(z => setTimeout(z, 200)); shCloseWork(); });
  const back = await p.evaluate(async () => { shClipsSheet(); await new Promise(z => setTimeout(z, 200)); document.querySelector("#shClipsOv .sh-clip-item").click();
    for (let i = 0; i < 40 && svMode !== "shadow"; i++) await new Promise(z => setTimeout(z, 200)); await new Promise(z => setTimeout(z, 300));
    const c = aList("clips")[0], g = svShGroup(), w = document.getElementById("shWork");
    return { mode: svMode, open: !!(w && getComputedStyle(w).display !== "none"), sheet: !!document.getElementById("shClipsOv"), same: Math.abs(c.start * 1000 - g.startMs) < 150, text: g.text === c.txt, on: document.querySelector("#svSh .sv-sh-fav").classList.contains("on") }; });
  ok("8 · tapping a clip opens it straight into Shadow on that passage (from Watch, another passage, the workspace closed) — the star shows it is kept", back.mode === "shadow" && back.open && !back.sheet && back.same && back.text && back.on, JSON.stringify(back));
  const del = await p.evaluate(async () => { shClipsSheet(); await new Promise(z => setTimeout(z, 200)); document.querySelector("#shClipsOv .sh-clip-del").click(); await new Promise(z => setTimeout(z, 300));
    const yes = document.querySelector(".cf-ov .cf-go, .cf-ov .btn-danger, .cf-ov .btn-p, .cf-ov button:last-child"); if (yes) yes.click(); await new Promise(z => setTimeout(z, 400));
    const ov = document.getElementById("shClipsOv"); return { n: aList("clips").length, empty: ov ? ov.querySelector(".sh-clips-sub").innerText : null, on: document.querySelector("#svSh .sv-sh-fav").classList.contains("on") }; });
  ok("9 · a clip can be deleted from the page (after a confirm): the list shows how to add one, the star goes out", del.n === 0 && /tap the star on a passage/.test(del.empty || "") && !del.on, JSON.stringify(del));
  const again = await star(p);
  ok("10 · with the slot free, the passage can be kept again (1/1)", again.n === 1 && /\(1\/1\)/.test(again.toast), JSON.stringify(again));
  ok("11 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
console.log("\n# General English, Premium");
{
  const { ctx, p, errs } = await learner({ premium: true });
  await openShadow(p);
  const st = [];
  for (let i = 0; i < 3; i++) { st.push(await star(p)); await p.evaluate(() => svShStep(1)); await sleep(250); }
  ok("12 · Premium keeps up to 30: three passages saved, counted against 30, no dialog", st.map(x => x.n).join(",") === "1,2,3" && /\(3\/30\)/.test(st[2].toast) && st.every(x => !x.dialog), JSON.stringify(st));
  ok("13 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
console.log("\n# plans off (production today): no cap, as before");
{
  const { ctx, p, errs } = await learner({ plans: false });
  await openShadow(p);
  const a = await star(p); await p.evaluate(() => svShStep(1)); await sleep(250); const c = await star(p);
  ok("14 · without plans nothing is capped: two passages kept, the plain 'Clip saved' message", a.n === 1 && c.n === 2 && !c.dialog && /Clip saved/.test(c.toast), JSON.stringify([a, c]));
  ok("15 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
console.log("\n# Save from the Watch page (owner, 27 Sep 2026): library and YouTube videos, each against its allowance");
{
  const { ctx, p, errs } = await learner();
  /* two pasted YouTube videos whose words are already kept on the phone (no Worker call) */
  const cues = Array.from({ length: 12 }, (_, i) => ({ t: i * 10, txt: "Line number " + i + " of a pasted talk." }));
  await p.evaluate(c => { const all = {}; ["yTpAsTe0001", "yTpAsTe0002"].forEach(v => { all[v] = { ts: Date.now(), full: true, source: "gemini", lang: "en", cues: c }; }); localStorage.setItem("be_caps", JSON.stringify(all)); }, cues);
  const btn = () => p.evaluate(() => { const b = document.getElementById("svWtSaveBtn"); const row = b && b.closest(".sv-wt-tg"); return b && { label: b.innerText.trim(), on: b.classList.contains("on"), beside: !!(row && row.querySelector("#svWtIpaBtn")) }; });
  const watch = v => p.evaluate(async v => { await shLoad({ vid: v, start: 0, end: 0, title: v === "-tubDR5XSRw" ? "" : "A pasted talk " + v.slice(-1) });
    for (let i = 0; i < 40 && !(svAsset && svAsset.segments && svAsset.segments.length && shClip.vid === v); i++) await new Promise(z => setTimeout(z, 200)); svSetMode("watch"); await new Promise(z => setTimeout(z, 300)); }, v);
  const tap = () => p.evaluate(async () => { document.getElementById("toast").innerText = ""; document.getElementById("svWtSaveBtn").click(); await new Promise(z => setTimeout(z, 400));
    const cf = document.querySelector(".cf-ov"); return { toast: document.getElementById("toast").innerText, dialog: cf ? cf.querySelector("h3").innerText : null }; });
  await watch("-tubDR5XSRw");
  const b0 = await btn();
  ok("18 · Watch, a library video: a Save button sits beside Translate and Pronunciation", b0 && b0.label === "Save" && !b0.on && b0.beside, JSON.stringify(b0));
  const t1 = await tap(), b1 = await btn();
  ok("19 · Save → 'Saved to Your videos (1/2)' and the button reads Saved", /Saved to Your videos \(1\/2\)/.test(t1.toast) && b1.label === "Saved" && b1.on, JSON.stringify({ t1, b1 }));
  await watch("yTpAsTe0001");
  const y0 = await btn(), t2 = await tap(), y1 = await btn();
  ok("20 · a YouTube video (words loaded): Save → 'Added to Your YouTube videos (1/1)'", y0 && y0.label === "Save" && /Added to Your YouTube videos \(1\/1\)/.test(t2.toast) && y1.on, JSON.stringify({ y0, t2, y1 }));
  await watch("yTpAsTe0002");
  const t3 = await tap(), y2 = await btn();
  ok("21 · Free keeps one YouTube video: a second is refused — 'You've reached your 1-video YouTube limit', Premium 20 — and stays unsaved", t3.dialog === "You've reached your 1-video YouTube limit" && !y2.on, JSON.stringify({ t3, y2 }));
  const body = await p.evaluate(() => { const c = document.querySelector(".cf-ov"); const t = c ? c.innerText : ""; document.querySelectorAll(".cf-ov").forEach(e => e.remove()); return t; });
  ok("22 · … the dialog offers Premium's 20", /up to 20 YouTube videos/.test(body), body);
  const mine = await p.evaluate(async () => { shCloseWork(); go("shadow"); await new Promise(z => setTimeout(z, 600)); shLibCat("mine"); await new Promise(z => setTimeout(z, 400));
    const rows = [...document.querySelectorAll("#shLibFeed .shl-row, #shLibFeed .shl-row-mine")].map(r => ({ t: (r.querySelector("b") || {}).innerText, src: (r.querySelector(".shl-src") || {}).innerText, cls: (r.querySelector(".shl-src") || { className: "" }).className })); shLibCat("foryou"); return rows; });
  ok("23 · Your videos tells them apart: the library video tagged 'BE Mastery library', the YouTube one 'From YouTube'", mine.length === 2 && mine.some(r => /\blib\b/.test(r.cls) && r.src === "BE Mastery library") && mine.some(r => /yt/.test(r.cls) && r.src === "From YouTube"), JSON.stringify(mine));
  await watch("-tubDR5XSRw");
  const t4 = await tap(), b4 = await btn();
  ok("24 · Saved again = removed ('Removed from your saved videos'), the button reads Save", /Removed from your saved videos/.test(t4.toast) && b4.label === "Save" && !b4.on, JSON.stringify({ t4, b4 }));
  ok("25 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
console.log("\n# Welding: My clips opens a clip as before");
{
  const { ctx, p, errs } = await learner({ track: "welding" });
  const w = await p.evaluate(async () => { aList("clips").unshift({ vid: "MZAjfsyJa1U", start: 10, end: 20, title: "Weld clip", ts: Date.now(), txt: "" }); save(); shOpen(0); await new Promise(z => setTimeout(z, 1500));
    return { vid: shClip.vid, start: shClip.start, end: shClip.end, v2: svOn(), cap: shClipCap() }; });
  ok("16 · Welding: a clip opens on its marks (no Shadow Studio V2), and no cap", w.vid === "MZAjfsyJa1U" && w.start === 10 && w.end === 20 && !w.v2 && w.cap === Infinity, JSON.stringify(w));
  ok("17 · Welding: no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
