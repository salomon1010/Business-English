/* Executive Polish — hear it back (owner, 6 Oct 2026).
   1. A "Read it aloud" button between Polish it and the mic reads the box.
   2. Stopping a recording plays the take straight back.
   3. Each saved report keeps its transcript AND the learner's voice (on the
      phone, IndexedDB), and the Polish history shows both — on every
      programme, with plans on or off.
   Run: cd tests && node polish-hear.mjs        (PORT=nnnn for another port) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
const ROOT = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8794), BASE = `http://localhost:${PORT}`;
const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };

const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(BASE + "/index.html?t=" + Date.now(), { waitUntil: "load" });
await p.evaluate(() => { OB.name = "Check"; obFinish(); }); await sleep(700);
await p.evaluate(() => { try { wcClose() } catch (e) {} document.querySelectorAll(".cf-ov,.wc-ov,#fndCheckOv").forEach(e => e.remove()); });

/* the Worker and the audio pass, stubbed; the players, spied */
await p.evaluate(() => {
  window.__said = []; window.__played = []; window.__tx = "Today I will walk you through my role and one strength I bring to the team";
  window.fbSay = (w) => { window.__said.push(String(w)); };
  window.exTranscribe = async () => ({ text: window.__tx, words: null });
  window.exAudioStats = async () => ({ dur: 9, pitch: null, pauses: [] });
  window.__ai = 0; window.exAI = async () => (window.__ai++, { key_message: "KEY", coach_script: "Coach", versions: [], idioms: [] });
  const real = window.exPlayBlob; window.exPlayBlob = blob => { window.__played.push(blob && blob.size); };
  window.__realPlay = real;
});

console.log("\n# the Read it aloud button");
await p.evaluate(() => go("phrases")); await sleep(400);
const row = await p.evaluate(() => [...document.querySelectorAll(".ex-btnrow > button")].map(x => x.className.split(" ").find(c => /^ex-/.test(c))));
ok("H1 · the row is a wide Record button, Read it aloud, bin — Polish it removed (owner, 6 Oct 2026)", JSON.stringify(row) === JSON.stringify(["ex-mic", "ex-read", "ex-clear"]), JSON.stringify(row));
const rd = await p.evaluate(() => { const ta = document.getElementById("exIn"); ta.value = "I introduced myself yesterday and today I will be reciting my job"; exDraft(ta); exReadBox(); const on = document.getElementById("exReadBtn").classList.contains("is-on"); exReadBox(); return { said: window.__said.slice(), on, after: exReading, label: document.getElementById("exReadBtn").getAttribute("aria-label") }; });
ok("H2 · it reads exactly what is in the box, shows that it is reading, and a second tap stops it", rd.said.length === 1 && /reciting my job/.test(rd.said[0]) && rd.on && rd.after === false && rd.label === "Read it aloud", JSON.stringify(rd));
const em = await p.evaluate(() => { window.__said = []; const ta = document.getElementById("exIn"); ta.value = ""; exDraft(ta); exReadBox(); return { said: window.__said.length, toast: (document.getElementById("toast") || {}).textContent || "" }; });
ok("H3 · an empty box reads nothing and says what to do", em.said === 0 && /record something first/i.test(em.toast), JSON.stringify(em));

console.log("\n# record, stop, hear it back — General English");
await p.evaluate(() => exRecord()); await sleep(9300); await p.evaluate(() => exStopRec());
for (let i = 0; i < 40 && !(await p.evaluate(() => aList("exRep").length)); i++) await sleep(150);
const ge = await p.evaluate(async () => { const r = aList("exRep")[0]; const recs = await getRecs("polish"); return { played: window.__played.slice(), rep: r && { tx: r.tx, rec: r.rec, secs: r.secs, at: r.at }, recs: recs.map(x => ({ ts: x.ts, size: x.blob && x.blob.size })) }; });
ok("H4 · stopping the recording plays the take straight back", ge.played.length === 1 && ge.played[0] > 2000, JSON.stringify(ge.played));
ok("H5 · the report keeps the transcript and marks that it has a voice", ge.rep && ge.rep.tx === "Today I will walk you through my role and one strength I bring to the team" && ge.rep.rec === 1 && ge.rep.secs >= 8, JSON.stringify(ge.rep));
await sleep(400);
const geRecs = await p.evaluate(async () => (await getRecs("polish")).map(x => x.ts));
ok("H6 · the voice is saved on the phone under General English, matched to its report", geRecs.length === 1 && geRecs[0] === ge.rep.at, JSON.stringify({ geRecs, at: ge.rep.at }));

console.log("\n# Another version glows when there is something to polish");
const cue = await p.evaluate(async () => {
  go("phrases"); await new Promise(r => setTimeout(r, 300));
  const q = () => document.getElementById("exQuickBtn"), rb = document.getElementById("exRecBtn");
  const out = { glow: q().classList.contains("is-cue"), anim: getComputedStyle(q()).animationName, wide: rb.getBoundingClientRect().width > document.querySelector(".ex-btnrow").getBoundingClientRect().width * 0.5, label: rb.textContent.trim(), noPolish: !document.querySelector(".ex-polish") };
  const real = window.fetch; window.fetch = async (u, o) => { let bd = null; try { bd = JSON.parse(o && o.body) } catch (e) {} if (bd && bd.repolish) return { ok: true, json: async () => ({ version: { style: "Better", text: "A better version of what I said today", learn: [] }, idioms: [] }) }; return real(u, o); };
  await exQuick(q()); await new Promise(r => setTimeout(r, 200));
  out.afterTap = q().classList.contains("is-cue"); out.version = !!document.querySelector(".ex-qv");
  exClear(); const ta = document.getElementById("exIn"); out.cleared = q().classList.contains("is-cue");
  ta.value = "two words"; exDraft(ta); out.short = q().classList.contains("is-cue");
  ta.value = "I lead a team of ten data engineers in Paris"; exDraft(ta); out.typed = q().classList.contains("is-cue");
  window.fetch = real; exClear();
  return out;
});
ok("H17 · after a recording, Another version breathes softly and the wide Record button replaces Polish it", cue.glow && cue.anim === "exCue" && cue.wide && /Record/.test(cue.label) && cue.noPolish, JSON.stringify(cue));
ok("H18 · tapping it gives the better version and ends the glow; Clear ends it too", !cue.afterTap && cue.version && !cue.cleared, JSON.stringify(cue));
ok("H19 · typed text glows once it has enough words to polish (five), not before", !cue.short && cue.typed, JSON.stringify(cue));

console.log("\n# What you said: the take beside its transcript");
const said = await p.evaluate(async () => {
  exRenderReport(aList("exRep")[0]); await new Promise(r => setTimeout(r, 900));
  const f = exQ(".ex-said"), box = exQ("#exTxRec");
  const out = { open: !!(f && f.open), shown: !!(box && !box.hidden), canvas: !!(box && box.querySelector("canvas.ex-txrec-wave")), audio: !!(box && box.querySelector("audio[src^='blob:']")), tx: (f && f.querySelector(".ex-tx") || {}).textContent || "", order: box ? (box.compareDocumentPosition(f.querySelector(".ex-tx")) & 4) === 4 : false };
  const au = box.querySelector("audio"), btn = box.querySelector(".ex-txrec-play");
  btn.click(); await new Promise(r => setTimeout(r, 700)); out.playing = !au.paused; out.icon = btn.innerHTML.length > 0;
  btn.click(); await new Promise(r => setTimeout(r, 200)); out.paused = au.paused;
  const cv = box.querySelector("canvas"), r = cv.getBoundingClientRect();
  cv.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + r.width * 0.5, clientY: r.top + 5 })); await new Promise(r => setTimeout(r, 300));
  out.seek = au.currentTime > 0; au.pause();
  out.time = (box.querySelector(".ex-txrec-time") || {}).textContent || "";
  return out;
});
ok("H14 · after a recording the 'What you said' fold opens with the waveform and the player above the transcript", said.open && said.shown && said.canvas && said.audio && /walk you through my role/.test(said.tx) && said.order, JSON.stringify(said));
ok("H15 · play and pause work, a tap on the waveform jumps into the take, and the time is shown", said.playing && said.paused && said.seek && /\d:\d\d \/ \d:\d\d/.test(said.time), JSON.stringify(said));
const typed = await p.evaluate(async () => { const tx = "Typed words only, no recording behind them at all here"; const r = { at: Date.now(), tk: areaId(), m: exTextStats(tx, null, null), ai: null, tx, targets: [] }; ex.blob = null; exSetUrl(null); exRenderReport(r); await new Promise(r => setTimeout(r, 400)); const box = exQ("#exTxRec"), f = exQ(".ex-said"); return { hidden: !box || box.hidden, open: !!(f && f.open), tx: (f && f.querySelector(".ex-tx") || {}).textContent || "" }; });
ok("H16 · a typed-text report keeps the transcript alone — no empty player", typed.hidden && !typed.open && /Typed words only/.test(typed.tx), JSON.stringify(typed));

console.log("\n# the history — plans OFF, as in production today");
const hi = await p.evaluate(async () => {
  exRenderReport(aList("exRep")[0]); ex.showReport = false; go("phrases"); await new Promise(r => setTimeout(r, 300));
  const btn = !!document.querySelector(".ex-hist-btn"); exHistSheet();
  const ov = document.getElementById("exHistOv");
  const out = { planOn: planOn(), btn, tx: (ov.querySelector(".ex-hist-tx") || {}).textContent || "", play: !!ov.querySelector(".ex-hist-play") };
  window.__played = []; await exHistPlay(0); out.replayed = window.__played.slice();
  await exHistOpen(0); await new Promise(r => setTimeout(r, 300));
  out.audio = !!document.querySelector(".ex-audio") && !!ex.url;
  return out;
});
ok("H7 · the history button shows with plans off, and each row carries the transcript and a play button", hi.planOn === false && hi.btn && /walk you through my role/.test(hi.tx) && hi.play, JSON.stringify(hi));
ok("H8 · play in the history replays the saved take; opening the report gives its audio player the take back", hi.replayed.length === 1 && hi.replayed[0] > 2000 && hi.audio, JSON.stringify(hi));

console.log("\n# Welding English — the same, filed apart");
const wd = await p.evaluate(async () => {
  areaSwitch("welding", "phrases"); await new Promise(r => setTimeout(r, 500)); go("phrases"); await new Promise(r => setTimeout(r, 300));
  const row = [...document.querySelectorAll(".ex-btnrow > button")].map(x => x.className.split(" ").find(c => /^ex-/.test(c)));
  window.__played = []; window.__tx = "Before I strike the arc I check the ground clamp and the gas flow on the torch";
  const blob = new Blob([new Uint8Array(6000)], { type: "audio/webm" });
  await exRun({ blob, secs: 10 }); await new Promise(r => setTimeout(r, 400));
  const r = aList("exRep")[0];
  return { area: areaId(), row, rep: r && { tx: r.tx, rec: r.rec, at: r.at }, wRecs: (await getRecs("welding:polish")).map(x => x.ts), gRecs: (await getRecs("polish")).length, histBtn: !!document.querySelector(".ex-hist-btn") };
});
ok("H9 · Welding has the same row of buttons", JSON.stringify(wd.row) === JSON.stringify(["ex-mic", "ex-read", "ex-clear"]), JSON.stringify(wd.row));
ok("H10 · a Welding take is saved under Welding, never under General English", wd.area === "welding" && wd.rep.rec === 1 && wd.wRecs.length === 1 && wd.wRecs[0] === wd.rep.at && wd.gRecs === 1, JSON.stringify(wd));
const sep = await p.evaluate(async () => { exHistSheet(); const t = [...document.querySelectorAll("#exHistOv .ex-hist-tx")].map(x => x.textContent).join("|"); document.getElementById("exHistOv").remove(); return t; });
ok("H11 · the Welding history shows only the Welding take", /strike the arc/.test(sep) && !/walk you through/.test(sep), sep);

console.log("\n# old takes leave with their reports");
const pr = await p.evaluate(async () => {
  for (let i = 0; i < 6; i++) { window.__tx = "Take number " + i + " about the welding procedure and the safety checks today"; await exRun({ blob: new Blob([new Uint8Array(3000 + i)], { type: "audio/webm" }), secs: 9 }); }
  await new Promise(r => setTimeout(r, 600));
  const keep = aList("exRep").map(r => r.at), recs = (await getRecs("welding:polish")).map(x => x.ts);
  return { reps: keep.length, recs: recs.length, allMatch: recs.every(ts => keep.includes(ts)) };
});
ok("H12 · a take is deleted when its report leaves the history — the phone keeps no orphan audio", pr.reps === pr.recs && pr.allMatch, JSON.stringify(pr));

ok("H13 · no JavaScript errors", !errs.length, errs.join(" | "));
await b.close(); srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
