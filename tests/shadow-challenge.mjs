/* Shadow Studio CHALLENGE — browser end-to-end on a phone viewport.
   Run:  cd tests && node shadow-challenge.mjs      (no Worker needed)
   Chromium's fake microphone drives the real MediaRecorder path; the Polish
   Worker (transcription + AI grade) is answered by a route in this file, so
   no key, no cost and no network: the fake "heard" text is set per check.
   Three learners: General English (fake mic), Welding (same flags — the mode
   must not exist there), and a General English learner whose microphone is
   refused. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const sleep = ms => new Promise(r => setTimeout(r, ms));
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8766"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(700); BASE = "http://localhost:8766"; }
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const FLAGS = { shadow_studio_v2_enabled: true, shadow_apply_phrase_enabled: true, shadow_challenge_enabled: true };
const POLISH = "https://be-polish.nore-ngou.workers.dev";

/* the fake AI: whatever the current check wants to have been heard */
let heard = "", assessScore = 90, polishHits = 0, polishMode = "ok";   // ok | abort | 500
let retellVerdict = { ok: true, missed: "", tip: "Say it a little slower." };
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
async function learner(id, track, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: opts.noMic ? [] : ["microphone"] });
  await ctx.addInitScript(({ track, FLAGS, noMic }) => {
    localStorage.setItem("be_flags", JSON.stringify(FLAGS)); localStorage.setItem("be_sv_txopen", "1"); localStorage.setItem("be_sv_watchopen", "1");   // the suite measures the list; the defaults (folded) have their own checks
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name: "Test", role: "", goal: "Speak with confidence in meetings", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      localStorage.setItem("be12_v1", JSON.stringify(st)); sessionStorage.setItem("be_view", "#shadow");
    }
    if (noMic) { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")); }
  }, { track, FLAGS, noMic: !!opts.noMic });
  await ctx.route(u => u.href.startsWith(POLISH), async route => {
    polishHits++;
    if (polishMode === "abort") return route.abort("failed");
    if (polishMode === "slow") await sleep(1500);                            // long enough to tap twice while grading
    if (polishMode === "500") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    const req = route.request(); const ct = req.headers()["content-type"] || "";
    let body = {};
    if (ct.includes("json")) { try { body = JSON.parse(req.postData() || "{}"); } catch (e) {} }
    if (body.captions) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: "no_captions" }) });
    if (body.chat && /says what it meant|said, in their OWN words/i.test(String(body.chat.system || ""))) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(retellVerdict) });
    if (body.chat) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Traduction : " + String(body.chat.messages[0].content).slice(0, 40), covered: [] }) });
    if (body.assess && polishMode === "assessSlow") await sleep(3500);                  // the transcript lands first, the grade later
    if (body.assess && polishMode === "assessFail") return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "assess_unavailable" }) });
    if (body.assess) { const words = String(body.assess).toLowerCase().replace(/[^a-z' ]/g, "").split(/\s+/).filter(Boolean).map(w => ({ word: w, score: assessScore })); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: assessScore, words, mode: "ai" }) }); }
    /* audio blob → Whisper-shaped answer built from `heard` */
    const ws = heard.split(/\s+/).filter(Boolean).map((w, i) => ({ w, start: i * 0.3, end: i * 0.3 + 0.25 }));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: heard, words: ws }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?ch=" + Date.now() + "#shadow", { waitUntil: "load" });
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
  return { ctx, page, id };
}
/* Drop the learner straight onto a rung. The ladder has its own checks; the
   ones that are about the report, the drills or the history should not have
   to walk it first. */
const toRung = (page, rung) => page.evaluate(r => { svCh.rung = r; svCh.fails = 0; svCh.next = null; svCh.gate = null; svCh.sync = null; svCh.retell = null; svCh.use = null; svCh.fb = null; svCh.phase = "ready"; svRender(); }, rung).then(() => new Promise(r => setTimeout(r, 150)));
const txt = (page, sel) => page.evaluate(s => (document.querySelector(s)?.innerText || "").replace(/\s+/g, " ").trim(), sel);
const phase = page => page.evaluate(() => svCh && svCh.phase);
const waitPhase = (page, p, ms = 8000) => page.waitForFunction(p => svCh && svCh.phase === p, p, { timeout: ms }).then(() => true, () => false);
/* tap the round button, speak (fake mic) for a moment, tap again */
const recording = page => page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 }).then(() => true, () => false);
async function record(page, sel = "#svChRecBtn") { await page.click(sel); await recording(page); await sleep(1600); await page.click(sel); }   // > the recorder's 1.2 KB / 400 ms floor

const A = await learner("alice", "general-english");
const W = await learner("wendy", "welding");
const M = await learner("mia", "general-english", { noMic: true });

/* ---------- the clip, WATCH and SHADOW as before ---------- */
await A.page.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
await A.page.evaluate(() => shOpenWork()); await sleep(300);
const sv = await A.page.evaluate(() => ({ level: svAsset && svAsset.level, tabs: [...document.querySelectorAll("#svTabs .seg-tab, #shV2 .sv-tabs .seg-tab")].map(b => b.innerText.trim()), segs: document.querySelectorAll("#shV2 .sv-seg").length, mode: svMode }));
ok("General English: library clip → word-level asset, the four tabs, Watch by default, no Challenge panel yet", sv.level === "word" && sv.tabs.map(x => x.replace("▾", "")).join() === "Watch,Shadow,Challenge,Apply it" && sv.segs > 10 && sv.mode === "watch" && !(await A.page.$("#svCh")), JSON.stringify(sv));
const lit = await A.page.evaluate(() => { const s = svAsset.segments[5]; shSeek = { t: (s.words[2].startMs + 10) / 1000, at: Date.now() }; svTick(); return { seg: document.querySelector(".sv-seg.now")?.dataset.i, word: document.querySelector(".sv-w.now")?.innerText, expect: s.words[2].text }; });
ok("WATCH still works: playback time lights the current sentence and word", lit.seg === "5" && lit.word === lit.expect, JSON.stringify(lit));
await A.page.evaluate(() => { svPick = 5; svSetMode("shadow"); }); await sleep(150);
const sh = await A.page.evaluate(() => { const g = svShGroup(); const card = document.querySelector("#svSh .sv-sh-card"); return { card: !!card, inPara: g.from <= 5 && g.to >= 5, lines: g.to - g.from + 1, words: document.querySelectorAll("#svSh .sv-sh-w").length, text: card && card.querySelector(".sv-sh-text").innerText, want: g.text, start: shClip.start === g.startMs / 1000, end: shClip.end === g.endMs / 1000, loop: shLooping, note: document.getElementById("shNote").value === g.text, pick: svPick, bar: !document.getElementById("svShBar").hidden, barBtns: [...document.querySelectorAll("#svShBar button")].map(b => b.innerText.replace(/\s+/g, " ").trim()), panel: !!document.getElementById("svCh"), noList: !document.getElementById("svTx"), noCtl: getComputedStyle(document.querySelector(".sh-ctl")).display === "none", lang: (S.profile && S.profile.lang) || "en", trNa: document.getElementById("svShTrBtn")?.getAttribute("aria-disabled") === "true", trOn: document.getElementById("svShTrBtn")?.getAttribute("aria-pressed"), ipaOn: document.getElementById("svShIpaBtn")?.getAttribute("aria-pressed") }; });
ok("SHADOW is the paragraph page: the paragraph holding the picked line (2–3 lines) comes whole (word chips + plain text), the clip snaps to it and loops, the notes carry its text for the report, the Speed / Record / Replay bar is at the foot; svPick is left alone; no transcript list, no transport row, no Challenge panel; Translate and Pronunciation both off, Translate unavailable while the app language is English", sh.card && sh.inPara && sh.lines >= 1 && sh.lines <= 3 && sh.words === sh.want.split(/\s+/).length && sh.text === sh.want && sh.start && sh.end && sh.loop && sh.note && sh.pick === 5 && sh.bar && /Speed/.test(sh.barBtns[0]) && /Record/.test(sh.barBtns[1]) && /Replay/.test(sh.barBtns[2]) && !sh.panel && sh.noList && sh.noCtl && sh.trOn === "false" && sh.ipaOn === "false" && (sh.lang !== "en" || sh.trNa), JSON.stringify(sh));
const shn = await A.page.evaluate(() => { const g0 = svShGroup(); svShStep(1); const g1 = svShGroup(); const r = { moved: g1.from === g0.to + 1, start: shClip.start === g1.startMs / 1000, text: document.querySelector("#svSh .sv-sh-text").innerText === g1.text, pick: svPick }; svShStep(-1); r.back = svShGroup().from === g0.from; return r; });
ok("Next / previous paragraph moves the card and the clip together (svPick untouched)", shn.moved && shn.start && shn.text && shn.back && shn.pick === 5, JSON.stringify(shn));
const fav = await A.page.evaluate(() => { const g = svShGroup(); const b = () => document.querySelector("#svSh .sv-sh-fav"); const n0 = aList("clips").length; svShFav(); const r = { on: b().classList.contains("on"), n1: aList("clips").length, saved: aList("clips")[0] && aList("clips")[0].vid === shClip.vid && Math.abs(aList("clips")[0].start - g.startMs / 1000) < 0.11 && aList("clips")[0].txt === g.text }; svShFav(); r.off = !b().classList.contains("on"); r.n2 = aList("clips").length; r.n0 = n0; return r; });
ok("The star on the paragraph card: one tap saves this paragraph's clip to My clips and turns the star yellow; a second tap removes it and clears the star", fav.on && fav.n1 === fav.n0 + 1 && fav.saved && fav.off && fav.n2 === fav.n0, JSON.stringify(fav));
const trf = await A.page.evaluate(async () => { S.profile.lang = "fr"; svRender(); const btn = document.getElementById("svShTrBtn"); const r = { btn: !!btn, code: btn && btn.querySelector("small")?.innerText.trim(), na: btn && btn.getAttribute("aria-disabled") }; svShTrToggle(); await new Promise(x => setTimeout(x, 400)); const b = document.getElementById("svShTr"); r.text = b.textContent; r.cls = b.className; r.on = document.getElementById("svShTrBtn").getAttribute("aria-pressed"); svShTrToggle(); S.profile.lang = "en"; svRender(); return r; });
ok("Translate (French app language): the control carries the language code and, switched on, the paragraph's translation appears under the text (mocked Worker chat route)", trf.btn && trf.code === "FR" && trf.na !== "true" && /Traduction/.test(trf.text) && !/err|wait/.test(trf.cls) && trf.on === "true", JSON.stringify(trf));

/* ---------- CHALLENGE starts ---------- */
await A.page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { __ev.push([n, p || {}]); return t0 && t0(n, p); }; });
await A.page.evaluate(() => svSetMode("challenge")); await sleep(200);
ok("Analytics: entering the tab sends shadow_challenge_opened, then shadow_challenge_started (+level, the constant 'guided' so the figures stay comparable)", await A.page.evaluate(() => __ev.some(e => e[0] === "shadow_challenge_opened") && __ev.some(e => e[0] === "shadow_challenge_started" && e[1].level === "guided")), await A.page.evaluate(() => JSON.stringify(__ev)));

/* ---------- THE LADDER ----------
   Five rungs on one paragraph, the app choosing. These checks walk the whole
   ladder on the clip's second paragraph, then put the learner back on the
   recall rung so the rest of the suite (the report, the drills, the history)
   keeps testing what it always tested. */
const lad = await A.page.evaluate(() => ({ rung: svCh.rung, rungs: svCh.rungs.slice(), strip: [...document.querySelectorAll("#svCh .sv-ch-rung")].map(e => e.innerText.trim()), now: document.querySelector("#svCh .sv-ch-rung.now")?.innerText.trim(), eyebrow: document.querySelector("#svCh .eyebrow")?.innerText.trim(), rec: !!document.getElementById("svChRecBtn"), blanks: document.querySelectorAll("#svCh .sv-ch-blank").length, chips: document.querySelectorAll("#svCh .sv-ch-chip").length, ev: __ev.filter(e => e[0] === "shadow_challenge_rung").map(e => e[1].rung) }));
ok("A paragraph opens at the bottom of the ladder: five rungs drawn as a map (not tabs), the listening gate lit, blanked words with chips to tap and NO microphone yet", lad.rung === "gate" && lad.rungs.join() === "gate,sync,recall,blind,retell" && lad.strip.length === 5 && /Listen/.test(lad.now) && !lad.rec && lad.blanks === 3 && lad.chips === 9 && lad.ev.includes("gate"), JSON.stringify(lad));
ok("The rung strip is a map, not a menu — none of the five is clickable, because the app is what chooses", await A.page.evaluate(() => [...document.querySelectorAll("#svCh .sv-ch-rung")].every(e => e.tagName !== "BUTTON" && !e.getAttribute("onclick"))));
/* every chip right → through the gate */
const gate = await A.page.evaluate(async () => {
  svCh.gate.items.forEach(it => svChGatePick(it.wi, it.answer));
  const filled = document.querySelectorAll("#svCh .sv-ch-blank.filled").length;
  svChGateCheck(); await new Promise(r => setTimeout(r, 60));
  const r = { filled, pass: svCh.gate.pass, okMarks: document.querySelectorAll("#svCh .sv-ch-blank.ok").length, state: document.querySelector("#svCh .sv-ch-state").innerText.trim() };
  svChGateDone(); await new Promise(r2 => setTimeout(r2, 60));
  r.card = document.querySelector("#svCh .sv-ch-move")?.innerText.replace(/\s+/g, " ").trim();
  r.next = svCh.next && svCh.next.rung; r.stillGate = svCh.rung;
  svChTakeNext(); await new Promise(r3 => setTimeout(r3, 120));
  r.landed = svCh.rung; r.attempt = svCh.attempt;
  return r;
});
ok("Gate passed: every blank filled and marked right, then a card explaining the move — and the rung only changes when the learner taps it, never behind their back", gate.filled === 3 && gate.pass && gate.okMarks === 3 && /ear is working/i.test(gate.state) && /yours/i.test(gate.card) && gate.next === "sync" && gate.stillGate === "gate" && gate.landed === "sync", JSON.stringify(gate));
ok("Landing on a new rung wipes the last rung's report — the old exercise's score must not sit under the new one's instructions", gate.attempt === 0 && await A.page.evaluate(() => !svCh.fb && !svCh.gate && svCh.fails === 0));
/* missing the gate twice must never trap: the ladder moves past it */
ok("A learner who misses the gate twice is moved ON, not held there — a gate that can trap somebody is worse than no gate", await A.page.evaluate(() => { const L = ["gate", "sync", "recall", "blind", "retell"]; const a = ShadowSync.nextRung({ rung: "gate", rungs: L, pass: false, speed: 1, fails: 0 }); const b = ShadowSync.nextRung({ rung: "gate", rungs: L, pass: false, speed: 1, fails: 1 }); return a.move === "again" && a.rung === "gate" && b.move === "past" && b.rung === "sync"; }));
/* ---- sync: speak WITH the speaker ---- */
const syn = await A.page.evaluate(() => ({ eyebrow: document.querySelector("#svCh .eyebrow")?.innerText.trim(), line: !!document.querySelector("#svCh .sv-ch-syncline"), shown: document.getElementById("svCh").innerText.includes(svChSegObj().text), privacy: /Nothing is recorded/i.test(document.getElementById("svCh").innerText), start: !![...document.querySelectorAll("#svCh button")].find(b => /Start together/.test(b.innerText)), speeds: document.querySelectorAll("#svCh .sv-ch-speed button").length }));
ok("SYNC is synchronised reading: the paragraph stays on screen, the speeds are there, and the panel says plainly that nothing is recorded in this round — only loudness", /Speak with them/i.test(syn.eyebrow) && syn.line && syn.shown && syn.privacy && syn.start && syn.speeds === 3, JSON.stringify(syn));
const synRun = await A.page.evaluate(async () => {
  svChSyncGo(); await new Promise(r => setTimeout(r, 300));
  const r = { counting: svCh.sync && svCh.sync.phase, count: document.querySelector("#svCh .sv-ch-count")?.innerText };
  await new Promise(r2 => setTimeout(r2, 2400));
  r.phase = svCh.sync && svCh.sync.phase; r.mic = !!svChMic; r.samples = svCh.sync && svCh.sync.samples.length; r.meter = !!document.querySelector("#svCh .sv-ch-meter");
  svChSyncStop(); await new Promise(r3 => setTimeout(r3, 120));
  r.stopped = svCh.sync; r.micAfter = !!svChMic;
  return r;
});
ok("Sync round: three-second count-in, then a live round that takes loudness samples from a real microphone and shows a meter — and stopping it lets the microphone go at once", synRun.counting === "count" && /[123]/.test(synRun.count || "") && synRun.phase === "live" && synRun.mic && synRun.samples > 5 && synRun.meter && synRun.stopped === null && !synRun.micAfter, JSON.stringify(synRun));
/* the report is built from the loudness trace, and the trace does not outlive the round */
const synRep = await A.page.evaluate(async () => {
  const s = svChSegObj(), step = ShadowSync.SYNC_STEP;
  /* a learner who spoke a fifth of a second behind, all the way through */
  const lag = 0.2, v = [], t0 = s.words[0].startMs / 1000 - 0.3;
  for (let i = 0; i < Math.ceil((s.endMs - s.startMs) / 1000 / step) + 30; i++) {
    const tt = t0 + i * step - lag;
    v.push(s.words.some(w => tt >= w.startMs / 1000 && tt <= w.endMs / 1000) ? 0.55 : 0.02);
  }
  svCh.sync = { phase: "live", samples: v, t0, iv: null };
  svChSyncFinish(svCh, s); await new Promise(r => setTimeout(r, 200));
  const rep = svCh.sync.rep;
  return { lag: rep.lag, cover: rep.cover, state: rep.state, pass: rep.pass, kept: svCh.sync.samples.length,
    chips: [...document.querySelectorAll("#svCh .sv-ch-dim")].map(e => e.innerText.replace(/\s+/g, " ")),
    hist: aList("chHist")[0] && { kind: aList("chHist")[0].kind, ctx: aList("chHist")[0].ctx || null } };
});
ok("Sync report: a take a fifth of a second behind is measured as such and passes, the chips name what was measured, and the loudness trace is thrown away the moment the report exists", Math.abs(synRep.lag - 0.2) <= 0.09 && synRep.cover >= 0.7 && synRep.pass && synRep.kept === 0 && synRep.chips.some(c => /Behind by/.test(c)) && synRep.chips.some(c => /Speaking with them/.test(c)), JSON.stringify(synRep));
ok("A microphone sending one unbroken level is refused rather than read as speaking the whole way through", await A.page.evaluate(() => { const s = svChSegObj(); const r = ShadowSync.syncReport({ v: new Array(300).fill(0.5), t0: s.words[0].startMs / 1000 }, s.words); return r.state === "na" && r.reason === "flat"; }));
ok("A take a full second behind is told so, and does not pass", await A.page.evaluate(() => { const s = svChSegObj(), step = ShadowSync.SYNC_STEP, v = [], t0 = s.words[0].startMs / 1000 - 0.5; for (let i = 0; i < 400; i++) { const tt = t0 + i * step - 1.0; v.push(s.words.some(w => tt >= w.startMs / 1000 && tt <= w.endMs / 1000) ? 0.55 : 0.02); } const r = ShadowSync.syncReport({ v, t0 }, s.words); return !r.pass && r.lag >= 0.9 && r.issues.some(i => i.type === "behind"); }));
ok("Starting with the speaker and falling behind by the end is caught as drift — the thing a shadower feels and no transcript can show", await A.page.evaluate(() => { const s = svChSegObj(), step = ShadowSync.SYNC_STEP, v = [], t0 = s.words[0].startMs / 1000 - 0.5; for (let i = 0; i < 500; i++) { const tt = t0 + i * step; v.push(s.words.some((w, wi) => { const lg = 0.15 + (wi / s.words.length) * 0.8; return tt >= w.startMs / 1000 + lg && tt <= w.endMs / 1000 + lg; }) ? 0.55 : 0.02); } const r = ShadowSync.syncReport({ v, t0 }, s.words); return r.drift >= 0.35 && r.issues.some(i => i.type === "drift") && !r.pass; }));
ok("A sync round leaves a history entry that carries no recording context, because the round kept no recording", synRep.hist && synRep.hist.kind === "chsync" && synRep.hist.ctx === null, JSON.stringify(synRep.hist));
ok("A microphone hearing the video itself is called out rather than scored — the engine will not award a top mark to the speaker's own voice", await A.page.evaluate(() => { const s = svChSegObj(), step = ShadowSync.SYNC_STEP, v = [], t0 = s.words[0].startMs / 1000; for (let i = 0; i < 400; i++) { const tt = t0 + i * step; v.push(s.words.some(w => tt >= w.startMs / 1000 && tt <= w.endMs / 1000) ? 0.55 : 0.01); } const r = ShadowSync.syncReport({ v, t0 }, s.words); return r.bleed === true && r.state === "na" && r.issues[0].type === "bleed"; }));
/* ---- the ladder carries on: sync passed → recall ---- */
const toRecall = await A.page.evaluate(async () => { svChSyncDone(); await new Promise(r => setTimeout(r, 80)); const n = svCh.next && svCh.next.rung; svChTakeNext(); await new Promise(r2 => setTimeout(r2, 150)); return { n, rung: svCh.rung, rec: !!document.getElementById("svChRecBtn") }; });
ok("Passing sync hands the learner to the recall rung, where the microphone appears", toRecall.n === "recall" && toRecall.rung === "recall" && toRecall.rec, JSON.stringify(toRecall));

/* the unit is a PARAGRAPH — the same group Shadow uses — with a pager to skip
   through them, and Guided (the paragraph on screen) is where a learner starts */
const par = await A.page.evaluate(() => { const g = svChSegObj(), q = svParaOf(5), ps = svParas(svAsset); return { seg: svCh.seg, from: q.from, lines: g.to - g.from + 1, text: g.text, want: svAsset.segments.slice(q.from, q.to + 1).map(x => x.text).join(" "), k: g.k, n: g.n, nWords: g.words && g.words.length, nav: document.querySelector("#svCh .sv-sh-nav span")?.textContent.trim(), level: svCh.level, shown: document.getElementById("svCh").innerText.includes(g.text), paras: ps.length }; });
ok("CHALLENGE works on the PARAGRAPH holding the picked line (2–3 lines, its word times joined), the paragraph on screen, with a 'k / N' pager", par.seg === par.from && par.lines >= 1 && par.lines <= 3 && par.text === par.want && par.level === "guided" && par.shown && par.nav === (par.k + 1) + " / " + par.n && par.n === par.paras && par.nWords === par.text.split(/\s+/).length, JSON.stringify(par));
ok("There is ONE way to challenge a paragraph: no difficulty tabs, no Reveal row under the card — the pager in the card is the only transport", await A.page.evaluate(() => !document.querySelector("#svCh .sv-ch-lv") && !document.querySelector("#svCh .seg-tab") && !document.querySelector("#shV2 .sv-ctl-row") && typeof window.svChLevel === "undefined" && !!document.querySelector("#svCh .sv-sh-nav")));
/* Listen is one button: play → pause → carry on, and it releases itself at the end of the paragraph */
const lt = await A.page.evaluate(async () => { const btn = () => [...document.querySelectorAll("#svCh button")].find(b => /Listen|Pause/.test(b.innerText));
  const r = {}; btn().click(); await new Promise(x => setTimeout(x, 120));
  r.p1 = { play: svCh.play, label: btn().innerText.trim(), stopAt: svChStopAt, seeked: Math.abs(shSeek.t - svChSegObj().startMs / 1000) < 0.2 };
  btn().click(); await new Promise(x => setTimeout(x, 120));
  r.p2 = { play: svCh.play, label: btn().innerText.trim() };
  const t0 = shSeek.t; btn().click(); await new Promise(x => setTimeout(x, 120));
  r.p3 = { play: svCh.play, label: btn().innerText.trim(), noReseek: shSeek.t === t0 };
  svChStopAll(); svChDraw(); r.p4 = { play: svCh.play, label: btn().innerText.trim() };
  return r; });
ok("Listen is a play / pause / carry-on toggle on one button: tap plays the paragraph from its start and arms the stop at its end, tap again pauses (label 'Pause'), tap again carries on WITHOUT seeking back, and stopping releases it", lt.p1.play === "on" && /Pause/.test(lt.p1.label) && lt.p1.stopAt > 0 && lt.p1.seeked && lt.p2.play === "paused" && /Listen/.test(lt.p2.label) && lt.p3.play === "on" && lt.p3.noReseek && lt.p4.play === null && /Listen/.test(lt.p4.label), JSON.stringify(lt));
const st = await A.page.evaluate(() => { const s = svChSegObj(); const panel = document.getElementById("svCh"); return { panel: !!panel, hidden: document.getElementById("svTx").classList.contains("hidden"), blur: getComputedStyle(document.getElementById("svTx")).display, recTop: document.getElementById("svChRecBtn")?.getBoundingClientRect().top, panelFirst: (document.getElementById("svCh")?.compareDocumentPosition(document.getElementById("svTx")) & 4) === 4, level: svCh && svCh.level, phase: svCh && svCh.phase, seg: svCh && svCh.seg, tabs: [...panel.querySelectorAll(".sv-ch-lv .seg-tab")].map(b => b.innerText.trim()), leak: panel.innerText.includes(s.text), turn: /your turn/i.test(panel.innerText), listen: !![...panel.querySelectorAll("button")].find(b => /Listen/.test(b.innerText)), rec: !!document.getElementById("svChRecBtn"), words: panel.innerText.includes(ShadowSync.tokens(s.text).length + " words") }; });
ok("CHALLENGE starts: panel with 'Your turn', the picked line's paragraph as target, phase ready", st.panel && st.turn && st.tabs.length === 0 && st.level === "guided" && st.phase === "ready" && st.seg === par.from, JSON.stringify(st));
const sep = await A.page.evaluate(() => { const box = document.getElementById("shV2"); const below = []; let el = box.nextElementSibling; while (el) { below.push(getComputedStyle(el).display); el = el.nextElementSibling; } svSetMode("shadow"); const box2 = document.getElementById("shV2"); const shown = []; let e2 = box2.nextElementSibling; while (e2) { shown.push(getComputedStyle(e2).display); e2 = e2.nextElementSibling; } svSetMode("challenge"); return { n: below.length, allHidden: below.every(d => d === "none"), shadowShows: shown.some(d => d !== "none") }; });
ok("Challenge is its own page: every card under the panel (notes, recordings, the Shadow report) is hidden there and back in Shadow", sep.n > 0 && sep.allHidden && sep.shadowShows, JSON.stringify(sep));
ok("Ready: the paragraph is on screen to read, the long transcript list stays collapsed, and Listen + Record are both there", !st.hidden && st.leak && st.listen && st.rec, JSON.stringify(st));
ok("Phone: 'Your turn' sits before the transcript and the Record button is inside the first screen, no scrolling", st.panelFirst && st.recTop > 0 && st.recTop < 844 - 48, JSON.stringify({ recTop: st.recTop, panelFirst: st.panelFirst }));

/* ---------- record → feedback → retry → complete ---------- */
const target = await A.page.evaluate(() => svChSegObj().text);
const tgtWords = target.toLowerCase().replace(/[^a-z' ]/g, "").split(/\s+/).filter(Boolean);
const DROP = Math.max(3, Math.ceil(tgtWords.length * 0.3));                 // short enough to fail on a paragraph, not just on a line
heard = tgtWords.slice(0, Math.max(2, tgtWords.length - DROP)).join(" ");
await A.page.click("#svChRecBtn"); ok("Tapping Record acquires the microphone and starts the recorder", await recording(A.page));
const recS = await A.page.evaluate(() => { const b = document.getElementById("svChRecBtn"); const s = svChSegObj(); const tgt = document.querySelector("#svCh .sv-ch-target"); return { phase: svCh.phase, on: b.classList.contains("on"), pressed: b.getAttribute("aria-pressed"), label: b.getAttribute("aria-label"), state: document.querySelector("#svCh .sv-ch-state").innerText, mr: rec.mr && rec.mr.state, leak: !!(tgt && !tgt.classList.contains("blur")) && document.getElementById("svCh").innerText.includes(s.text), listHidden: getComputedStyle(document.getElementById("svTx")).display === "none" }; });
ok("Recording state is explicit: phase recording, button lit + aria-pressed, 'Tap to stop', live status line, MediaRecorder running, and the paragraph is hidden the moment the mic opens — the take is from memory", recS.phase === "recording" && recS.on && recS.pressed === "true" && /stop/i.test(recS.label) && /Recording/.test(recS.state) && recS.mr === "recording" && !recS.leak, JSON.stringify(recS));
await sleep(1600); await A.page.click("#svChRecBtn");
ok("Stop → grading → feedback", await waitPhase(A.page, "feedback"), "phase=" + await phase(A.page));
const fb1 = await A.page.evaluate(() => { const p = document.getElementById("svCh"); const s = svChSegObj(); const tx = p.innerText; return { attempt: svCh.attempt, good: p.querySelector(".sv-ch-line.good")?.innerText, lines: p.querySelectorAll(".sv-ch-line").length, ai: tx.includes("AI feedback"), heard: /YOU SAID/i.test(tx), target: tx.includes(s.text), again: !![...p.querySelectorAll("button")].find(b => /Try again/.test(b.innerText)), pass: svCh.fb.pass,
  eyebrow: p.querySelector(".sv-ch-rep .eyebrow")?.innerText, headline: p.querySelector(".sv-ch-hd")?.innerText, verdict: svCh.fb.verdict, dims: [...p.querySelectorAll(".sv-ch-dim")].map(d => d.innerText.replace(/\s+/g, " ")), issues: [...p.querySelectorAll(".sv-ch-issue")].map(e => e.querySelector(".sv-ch-issue-t").innerText.replace(/\s+/g, " ")), open: p.querySelectorAll(".sv-ch-issue.open").length, missingText: svCh.fb.issues[0].text, cmpTokens: p.querySelectorAll(".sv-ch-cmp-t .sv-ch-tk").length, miss: p.querySelectorAll(".sv-ch-tk.miss").length, next: p.querySelector(".sv-ch-next")?.innerText, orig: !![...p.querySelectorAll(".sv-ch-sec button")].find(b => /^Speaker$/.test(b.innerText.trim())), ab: !!document.getElementById("svChAbBtn"), primary: p.querySelectorAll(".btn-primary").length, hint: /say it from memory/.test(tx), plainTarget: !!p.querySelector(".sv-ch-target.small"), cased: p.querySelector(".sv-ch-cmp-t").innerText.includes(s.text) }; });
ok("Report: eyebrow 'Shadow report · Attempt 1', one verdict headline with a focus line, dimension chips only for measured dimensions (words / pronunciation / fluency; no rhythm — the fake take's words are all one length? no: rhythm is drawn only with real clip word times — MZAjfsyJa1U has them), one GOOD line, AI-labelled, the target revealed, Try again the only primary action", fb1.attempt === 1 && /Shadow report · Attempt 1/i.test(fb1.eyebrow) && /attempt|start|going/i.test(fb1.headline) && fb1.lines === 1 && /^GOOD/i.test(fb1.good) && fb1.ai && fb1.target && fb1.again && !fb1.pass && fb1.primary === 1 && fb1.dims.some(d => /^Words/.test(d)) && fb1.dims.some(d => /^Pronunciation/.test(d)) && fb1.dims.some(d => /^Fluency/.test(d)), JSON.stringify(fb1));
ok("Your focus: the missing tail comes as ONE missing-phrase issue, first, already expanded; the coloured target marks exactly those words red; 'You said' shown; Next attempt names the phrase", fb1.issues.length >= 1 && /Missing phrase/.test(fb1.issues[0]) && fb1.open === 1 && fb1.missingText.split(" ").length === DROP && fb1.cmpTokens === tgtWords.length && fb1.miss === DROP && fb1.heard && fb1.next && fb1.next.includes(fb1.missingText), JSON.stringify({ issues: fb1.issues, open: fb1.open, miss: fb1.miss, drop: DROP, next: fb1.next }));
ok("Listen block under the verdict: the target in the speaker's own words (case and punctuation), Speaker / Me / A/B, Loop and a speed group; the ready-phase hint and the plain 'Target:' line are gone", fb1.orig && fb1.ab && fb1.cased && !fb1.hint && !fb1.plainTarget && await A.page.evaluate(() => document.querySelectorAll("#svCh .sv-ch-speed button").length === 3 && !!document.getElementById("svChLoopBtn")), JSON.stringify({ orig: fb1.orig, cased: fb1.cased, hint: fb1.hint, plainTarget: fb1.plainTarget }));
await sleep(700);   // the reveal is a smooth scroll
const rv = await A.page.evaluate(() => { const body = document.querySelector(".sh-work-body"), pin = body.querySelector(".sh-stick"), rep = document.querySelector("#svCh .sv-ch-rep"); return { scrolled: body.scrollTop > 0, top: rep.getBoundingClientRect().top - (pin ? pin.getBoundingClientRect().bottom : body.getBoundingClientRect().top) }; });
ok("When feedback lands the workspace scrolls so the report's first line sits right under the pinned player (no hunting below the fold)", rv.scrolled && rv.top >= 0 && rv.top < 40, JSON.stringify(rv));
/* the audio controls do what they say (the player is real; the take is the fake mic's) */
const play = await A.page.evaluate(async () => { const s = svChSegObj(); svChPlayOrig(); const a = { stopAt: svChStopAt, seekT: shSeek.t, near: Math.abs(shSeek.t - s.startMs / 1000) < 0.2 };
  svChSpeed(0.75); a.rate = shClip.rate; a.on = document.querySelector("#svCh .sv-ch-speed button.on")?.innerText; a.btn = document.getElementById("shRateBtn")?.innerText;
  svChLoop(); a.loop = svRepeat && svRepeat.i === svCh.seg && Math.abs(svRepeat.start - s.startMs / 1000) < 0.01; a.loopOn = document.getElementById("svChLoopBtn")?.classList.contains("on");
  svChLoop(); a.loopOff = svRepeat === null; svChSpeed(1);
  await svChPlayMe(); a.me = !!fbAud; return a; });
ok("Play seeks to the paragraph and arms the stop at its end; speed 0.75× sets the player rate (and the transport's own button); Loop toggles a repeat on this line; Me plays the take", play.near && play.stopAt > 0 && play.rate === 0.75 && /75/.test(play.on) && /75/.test(play.btn) && play.loop && play.loopOn && play.loopOff && play.me, JSON.stringify(play));
const ab = await A.page.evaluate(async () => { svChAB(); await new Promise(r => setTimeout(r, 200)); const a = { on: !!svCh.ab, label: document.getElementById("svChAbBtn")?.innerText }; svChAB(); await new Promise(r => setTimeout(r, 100)); a.off = !svCh.ab; a.label2 = document.getElementById("svChAbBtn")?.innerText; return a; });
ok("A/B compare starts a speaker → me cycle (button turns into Stop) and a second tap stops it", ab.on && /Stop/.test(ab.label) && ab.off && /A\/B/.test(ab.label2), JSON.stringify(ab));
/* the word drill on the missing phrase's issue */
const dr0 = await A.page.evaluate(() => { svChOpen(0); svChDrillOpen(0); const d = document.getElementById("svChDrill"); return { drill: svCh.drill && svCh.drill.text, panel: !!d, rec: !!document.getElementById("svChDrillRecBtn"), speaker: !![...d.querySelectorAll("button")].find(b => /Speaker/.test(b.innerText)), voice: !![...d.querySelectorAll("button")].find(b => /Model voice/.test(b.innerText)), slow: !![...d.querySelectorAll("button")].find(b => /Slow/.test(b.innerText)) }; });
ok("Practise opens the drill for the weak phrase: its own recorder, Speaker (clip word times), Model voice and Slow", dr0.drill === fb1.missingText && dr0.panel && dr0.rec && dr0.speaker && dr0.voice && dr0.slow, JSON.stringify(dr0));
const savedHeard = heard; heard = fb1.missingText; assessScore = 70;
await record(A.page, "#svChDrillRecBtn"); await A.page.waitForFunction(() => svCh.drill && svCh.drill.attempts.length === 1, null, { timeout: 8000 }).catch(() => {});
assessScore = 92; await record(A.page, "#svChDrillRecBtn"); await A.page.waitForFunction(() => svCh.drill && svCh.drill.attempts.length === 2, null, { timeout: 8000 }).catch(() => {});
const dr = await A.page.evaluate(() => ({ att: svCh.drill.attempts.map(a => [a.state, a.score, a.mode]), rows: [...document.querySelectorAll("#svChDrill .sv-ch-hist-a")].map(e => e.innerText.replace(/\s+/g, " ")), line: svCh.attempt, phase: svCh.phase, blobs: svCh.drill.attempts.every(a => a.blob && a.blob.size > 0) }));
ok("Two drill takes → Attempt 1 Good · 70%, Attempt 2 Strong · 92% (AI mode), each with its own playable take; the line's own attempt count and phase untouched", dr.att.length === 2 && dr.att[0][0] === "good" && dr.att[0][1] === 70 && dr.att[1][0] === "strong" && dr.att[1][1] === 92 && /Attempt 1 Good · 70%/.test(dr.rows[0]) && /Attempt 2 Strong · 92%/.test(dr.rows[1]) && dr.blobs && dr.line === 1 && dr.phase === "feedback", JSON.stringify(dr));
assessScore = 90; heard = savedHeard;
const ctxs = await A.page.evaluate(async () => { const rs = await allRecs(); return rs.map(r => r.ctx).filter(c => /shadow-chw/.test(c)); });
ok("Drill takes are filed under their own track-scoped context (shadow-chw…), not as line attempts", ctxs.length === 2 && ctxs.every(c => c.startsWith("shadow-chw")), JSON.stringify(ctxs));
const dc = await A.page.evaluate(() => { svChDrillClose(); return { drill: svCh.drill, panel: !!document.getElementById("svChDrill"), report: !!document.querySelector("#svCh .sv-ch-rep") }; });
ok("Back to the report closes the drill and keeps the report", dc.drill === null && !dc.panel && dc.report);
const vc = await A.page.evaluate(() => { const ws = svCh.fb.weakWords; const c = ws.findIndex(w => w.vocab), f = ws.findIndex(w => !w.vocab); const out = { c: c >= 0 && ws[c].text, f: f >= 0 && ws[f].text, chips: document.querySelectorAll("#svCh .sv-ch-wk").length };
  if (c >= 0) { svChDrillWord(c); const b = [...document.querySelectorAll("#svChDrill button")].find(x => /vocabulary/i.test(x.innerText)); out.star = !!b; if (b) { b.click(); out.saved = vocHas(ws[c].k); out.lit = /In your vocabulary/.test([...document.querySelectorAll("#svChDrill button")].find(x => /vocabulary/i.test(x.innerText))?.innerText || ""); [...document.querySelectorAll("#svChDrill button")].find(x => /vocabulary/i.test(x.innerText)).click(); out.dropped = !vocHas(ws[c].k); } }
  if (f >= 0) { svChDrillWord(f); out.fnStar = !![...document.querySelectorAll("#svChDrill button")].find(x => /vocabulary/i.test(x.innerText)); }
  svChDrillClose(); return out; });
ok("Vocabulary: the drill of a content word offers ⭐ Save to vocabulary (vocPut, reads 'In your vocabulary' once saved, tap again removes it); a function word's drill offers none; the weakest-words chips are not drawn when the focus list already covers every weak word", (!vc.c || (vc.star && vc.saved && vc.lit && vc.dropped)) && (!vc.f || vc.fnStar === false) && vc.chips === 0, JSON.stringify(vc));
const vis = await A.page.evaluate(() => { const g = svChSegObj(); return { disp: getComputedStyle(document.getElementById("svTx")).display, pick: [...document.querySelectorAll("#svTx .sv-seg.pick")].map(e => +e.dataset.i), want: g && [g.from, g.to], reveal: !!document.querySelector("#shV2 .sv-ctl button[onclick='svReveal()']"), ev: __ev.filter(e => e[0] === "shadow_challenge_feedback_received" && e[1].rung === "recall").map(e => e[1].result), done: __ev.some(e => e[0] === "shadow_challenge_completed" && e[1].rung === "recall") }; });
ok("Feedback state: the scrolling transcript stays hidden in Challenge (it is the answer sheet), no Reveal button; feedback_received{retry} sent, completed NOT sent", vis.disp === "none" && !vis.reveal && vis.ev.includes("retry") && !vis.done, JSON.stringify(vis));
await A.page.click("#svCh .btn-primary"); await sleep(150);
const rt = await A.page.evaluate(() => ({ phase: svCh.phase, fb: svCh.fb, attempt: svCh.attempt, state: document.querySelector("#svCh .sv-ch-state").innerText, hidden: getComputedStyle(document.getElementById("svTx")).display === "none", shown: document.getElementById("svCh").innerText.includes(svChSegObj().text) }));
ok("Try again → ready for attempt 2, feedback cleared, attempt count kept, last result shown as words ('16 of 23'), the paragraph back on screen to read, transcript still hidden", rt.phase === "ready" && rt.fb === null && rt.attempt === 1 && /Attempt 2/.test(rt.state) && /last time \d+ of \d+ words/.test(rt.state) && rt.hidden && rt.shown, JSON.stringify(rt));
heard = tgtWords.join(" ");
await record(A.page);
ok("Full line → done", await waitPhase(A.page, "done"), "phase=" + await phase(A.page));
const dn = await A.page.evaluate(() => { const p = document.getElementById("svCh"); const s = svChSegObj(); const m = aMap("svCh")["MZAjfsyJa1U:" + s.id]; return { title: p.innerText.includes("You said it without reading"), good: p.querySelector(".sv-ch-line.good")?.innerText, next: !![...p.querySelectorAll("button")].find(b => /Next paragraph/.test(b.innerText)), up: !![...p.querySelectorAll("button")].find(b => /level/i.test(b.innerText)), saved: m && m.done === true && m.n === 2 && m.best === 100 && m.level === "guided", use: !![...p.querySelectorAll("button")].find(b => /Use it yourself/.test(b.innerText)) }; });
ok("Completion: success line, GOOD 'every word', Next paragraph and NO level-up offer, per-area record {done, n:2, best:100, level:'guided'}", dn.title && /every word/.test(dn.good) && dn.next && !dn.up && dn.saved, JSON.stringify(dn));
ok("No 'Use it yourself' when the paragraph carries no curriculum expression", !dn.use);
const h2 = await A.page.evaluate(() => { const p = document.getElementById("svCh"); return { hist: svCh.hist.map(h => [h.n, h.fb.verdict, !!h.blob]), rows: [...p.querySelectorAll(".sv-ch-rep > .sv-ch-sec .sv-ch-hist-a")].map(e => e.innerText.replace(/\s+/g, " ")), prog: p.querySelector(".sv-ch-prog")?.innerText, next: !!p.querySelector(".sv-ch-next"), pron: svCh.fb.dims.pron.state, pending: svCh.pending, issues: svCh.fb.issues.some(x => x.type !== "levelup") }; });
const pl = await A.page.evaluate(() => { const p = document.getElementById("svCh"); return { left: svCh.fb.issues.filter(x => x.type !== "levelup").length, sub: p.querySelector(".sv-ch-done .sv-ch-meta")?.innerText, primary: p.querySelector(".sv-ch-row .btn-primary")?.innerText, again: !![...p.querySelectorAll("button")].find(b => /Try again/.test(b.innerText)) }; });
ok("A pass never claims perfection while the report still names something: the done line says 'Good progress — … still needs practice', and the ladder's 'Carry on' is the primary action with another go one tap away", (pl.left === 0 ? /yours now/.test(pl.sub) : /Good progress/.test(pl.sub)) && /Carry on/.test(pl.primary || "") && pl.again, JSON.stringify(pl));
ok("Attempt history: two attempts kept with their takes, drawn as Attempt 1 Needs practice / Attempt 2 Strong, the eyebrow says 'Better than last time'; the Next-attempt box stays only while something is left to fix; pronunciation graded (AI mode)", h2.hist.length === 2 && h2.hist[0][2] && h2.hist[1][2] && h2.rows.length === 2 && /Attempt 1 Needs practice/.test(h2.rows[0]) && /Attempt 2 Strong/.test(h2.rows[1]) && /Better than last time/i.test(h2.prog) && h2.next === h2.issues && h2.pron !== "na" && !h2.pending, JSON.stringify(h2));
ok("Analytics: a pass on a rung sends shadow_challenge_completed once, tagged with that rung, after that rung's feedback_received{pass} — every rung reports separately so the funnel can show where learners stop", await A.page.evaluate(() => __ev.filter(e => e[0] === "shadow_challenge_completed" && e[1].rung === "recall").length === 1 && __ev.filter(e => e[0] === "shadow_challenge_feedback_received" && e[1].rung === "recall").map(e => e[1].result).join() === "retry,pass" && __ev.filter(e => e[0] === "shadow_challenge_completed").every(e => !!e[1].rung)));
const nxFrom = await A.page.evaluate(() => { const ps = svParas(svAsset), k = svChParaK(); return ps[k + 1] ? ps[k + 1].from : -1; });
await A.page.click("#svCh button:has-text('Next paragraph')"); await sleep(200);
ok("Next paragraph moves the target to the next group and resets the loop", nxFrom > 0 && await A.page.evaluate(f => svCh.seg === f && svCh.phase === "ready" && svCh.attempt === 0 && svPick === f, nxFrom));
/* the pager: « » walk the paragraphs and a tap in Watch jumps to a line's own one */
const pg = await A.page.evaluate(() => { const ps = svParas(svAsset), k0 = svChParaK(); svChStep(-1); const back = svChParaK(); svChStep(1); const fwd = svChParaK(); const last = ps[ps.length - 1]; svTapSeg(last.to); const tapped = svChParaK(); const nav = document.querySelector("#svCh .sv-sh-nav span")?.textContent.trim(); const dis = [...document.querySelectorAll("#svCh .sv-sh-nav button")].map(b => b.disabled); return { k0, back, fwd, tapped, wantTapped: ps.length - 1, nav, dis, n: ps.length, fresh: svCh.phase === "ready" && svCh.attempt === 0 }; });
ok("Pager: « and » step one paragraph either way, a tap on any line in Watch jumps to that line's paragraph with a fresh attempt, and the pager reads 'k / N' with » disabled on the last one", pg.back === pg.k0 - 1 && pg.fwd === pg.k0 && pg.tapped === pg.wantTapped && pg.nav === pg.n + " / " + pg.n && pg.dis[1] === true && pg.fresh, JSON.stringify(pg));

/* ---------- the history: every attempt kept, grouped by day, back to the line ---------- */
const shr = await A.page.evaluate(() => { const before = aList("chHist").length; fbCtx = { vid: shClip.vid, recCtx: shRecCtx(shClip.vid) }; fbT0 = Date.now() - 4000; fbShowResults("want to solve our climate crisis as an actor", "want to solve the climate crisis as an actor", "new"); const e = aList("chHist")[0]; return { added: aList("chHist").length === before + 1, kind: e.kind, score: e.score, heard: e.heard, fix: e.fix, ctx: e.ctx, wpm: e.wpm }; });
ok("A Shadow report (the studio's own, from a take) is filed in the same history as kind 'shadow' with its score, what was said, the words to fix and the take's context", shr.added && shr.kind === "shadow" && Number.isFinite(shr.score) && /climate/.test(shr.heard) && Array.isArray(shr.fix) && /^shadow-/.test(shr.ctx) && shr.wpm > 0, JSON.stringify(shr));
ok("No 'AI learning coach' pop-up after a Shadow report — the report is the page", await A.page.evaluate(() => !document.querySelector("#coachSummary,.coach-modal-ov")));
await A.page.evaluate(() => { aList("chHist").shift(); });   // keep the Challenge-only checks below exact (the Shadow card is checked on its own)
const hs = await A.page.evaluate(() => { const L = aList("chHist").filter(e => e.kind === "challenge"); return { n: L.length, sync: aList("chHist").some(e => e.kind === "chsync"), first: L[0] && { n: L[0].n, verdict: L[0].verdict, text: L[0].text, issues: L[0].issues.length, heard: !!L[0].heard, ctx: L[0].ctx, drills: L[0].drills.length }, second: L[1] && { n: L[1].n, verdict: L[1].verdict, issues: L[1].issues.map(x => x.text), drills: L[1].drills.map(d => [d.text, d.attempts.length]) }, order: L.every((e, i) => !i || e.ts <= L[i - 1].ts) }; });
ok("History store: the two attempts of the previous line are kept newest first under this area, each with verdict, line, issues, what was said, the take's context; the drill is filed under the attempt it followed; the sync round is filed beside them as its own kind", hs.n === 2 && hs.sync && hs.first.n === 2 && hs.second.n === 1 && hs.second.issues.length >= 1 && hs.second.drills.length === 1 && hs.second.drills[0][1] === 2 && hs.first.heard && /shadow-ch/.test(hs.first.ctx) && hs.order, JSON.stringify(hs));
await A.page.evaluate(() => { shCloseWork(); shTab("trouble"); }); await sleep(400);
const hv = await A.page.evaluate(() => { const box = document.getElementById("shHist"); const tab = [...document.querySelectorAll("#v-shadow .seg-tab")].find(b => /History/.test(b.innerText)); return { n: aList("chHist").length, tab: tab && tab.innerText.replace(/\s+/g, " "), days: [...box.querySelectorAll(".sh-hist-day")].map(d => d.innerText), items: box.querySelectorAll(".sh-hist-item").length, first: box.querySelector(".sh-hist-item")?.innerText.replace(/\s+/g, " "), trouble: !!document.getElementById("tbBox"), visible: box.offsetParent !== null }; });
ok("History tab: the count matches the entries, the page groups by day ('Today'), one card per attempt with the line, the verdict and the focus; trouble words keep their section below", new RegExp("History " + hv.n).test(hv.tab || "") && /^today$/i.test(hv.days[0]) && hv.items === hv.n && /Attempt 2/.test(hv.first) && /Strong|Good|Needs/i.test(hv.first) && hv.trouble && hv.visible, JSON.stringify(hv));
const shc = await A.page.evaluate(() => { const L = aList("chHist"); L.unshift({ kind: "shadow", ts: Date.now() + 5, vid: shClip.vid, title: "Shadow clip", text: "want to solve our climate crisis as an actor", heard: "want to solve the climate crisis as an actor", score: 88, wpm: 140, fillers: 1, fix: ["climate"], ctx: shRecCtx(shClip.vid) }); shHistRender(); const it = document.querySelector("#shHist .sh-hist-item"); const kinds = [...document.querySelectorAll("#shHist .sh-hist-kind")].map(k => k.innerText.trim().toLowerCase()); shHistToggle(L[0].ts); const open = document.querySelector("#shHist .sh-hist-item.open"); const tx = open.innerText.replace(/\s+/g, " "); const r = { first: it.innerText.replace(/\s+/g, " "), kinds, said: /YOU SAID/i.test(tx), pace: /wpm/.test(tx), fixWord: /climate/.test(tx), openClip: /Open this clip/.test(tx) }; shHistToggle(L[0].ts); L.shift(); shHistRender(); return r; });
ok("Both kinds live in one list, each labelled: a Shadow card shows its score and words to fix, opens to what you said, the pace and 'Open this clip'; the Challenge cards keep their own shape", /^\s*Shadow/i.test(shc.first) && /88%/.test(shc.first) && shc.kinds[0] === "shadow" && shc.kinds.slice(1).every(k => k === "challenge" || k === "together") && shc.said && shc.pace && shc.fixWord && shc.openClip, JSON.stringify(shc));
await A.page.evaluate(() => shHistToggle(aList("chHist")[1].ts)); await sleep(200);
const hd = await A.page.evaluate(() => { const it = document.querySelectorAll("#shHist .sh-hist-item")[1]; const tx = it.innerText.replace(/\s+/g, " "); return { open: it.classList.contains("open"), said: /YOU SAID/i.test(tx), issue: it.querySelectorAll(".sh-hist-issue").length, fix: /whole line|Say/.test(tx), drill: /Word practice/i.test(tx) && it.querySelectorAll(".sh-hist-drill .sv-ch-hist-a").length === 2, play: !![...it.querySelectorAll("button")].find(b => /Play my take/.test(b.innerText)), openBtn: !![...it.querySelectorAll("button")].find(b => /Open this line/.test(b.innerText)) }; });
ok("Tapping an attempt opens its detail: what you said, each issue with what to improve, the word practice with its attempts, Play my take and Open this line", hd.open && hd.said && hd.issue >= 1 && hd.fix && hd.drill && hd.play && hd.openBtn, JSON.stringify(hd));
const hp = await A.page.evaluate(async () => { await shHistPlay(aList("chHist")[1].ts); await new Promise(r => setTimeout(r, 400)); return !!fbAud && fbAud.currentTime >= 0 && !fbAud.error; });
ok("Play my take plays the recording that produced that attempt from the device store", hp);
await A.page.evaluate(() => shHistOpen(aList("chHist")[1].ts)); await sleep(3500);
const ho = await A.page.evaluate(() => ({ work: getComputedStyle(document.querySelector(".sh-work")).display !== "none", mode: svMode, seg: svCh && svCh.seg, text: svChSegObj() && svChSegObj().text, want: aList("chHist")[1].text, phase: svCh && svCh.phase }));
ok("Open this line reloads the clip, opens the workspace in Challenge on that very line, ready for a new attempt", ho.work && ho.mode === "challenge" && ho.text === ho.want && ho.phase === "ready", JSON.stringify(ho));
/* ---------- double submission, network failure, retry of the grade ---------- */
heard = await A.page.evaluate(() => svAsset.segments[6].text); polishHits = 0; polishMode = "slow";
await A.page.click("#svChRecBtn"); await recording(A.page); await sleep(1600);
await A.page.evaluate(() => svChRecord());                                  // the stop
await A.page.waitForFunction(() => svCh && svCh.phase === "grading", null, { timeout: 5000 }).catch(() => {});
const dup = await A.page.evaluate(async () => { const before = svCh.attempt; svChRecord(); svChRecord(); await new Promise(r => setTimeout(r, 100)); return { phase: svCh.phase, before, mr: rec.mr && rec.mr.state }; });
await A.page.waitForFunction(() => svCh && (svCh.phase === "done" || svCh.phase === "feedback" || svCh.phase === "error"), null, { timeout: 12000 });
const dup2 = await A.page.evaluate(() => ({ attempt: svCh.attempt, phase: svCh.phase }));
polishMode = "ok";
ok("Taps while grading are ignored: one attempt counted, no second recording started, at most two Worker calls (transcript + grade)", dup.phase === "grading" && dup.before === 0 && dup.mr !== "recording" && dup2.attempt === 1 && polishHits <= 2, JSON.stringify({ dup, dup2, polishHits }));
await A.page.click("#svCh button:has-text('Try again')"); await sleep(100);
await A.ctx.setOffline(true); await A.page.evaluate(() => { svPick = 7; svChReset(); svRender(); });
await record(A.page);
ok("Offline: no fake score — a network state with 'Retry feedback', the recording kept", await waitPhase(A.page, "error") && await A.page.evaluate(() => svCh.err === "net" && !!svCh.blob && document.querySelector("#svCh").innerText.includes("needs a connection") && !![...document.querySelectorAll("#svCh button")].find(b => /Retry feedback/.test(b.innerText))), "phase=" + await phase(A.page));
await A.ctx.setOffline(false); heard = await A.page.evaluate(() => svAsset.segments[7].text);
await A.page.click("#svCh button:has-text('Retry feedback')");
ok("Back online, Retry feedback grades the saved take without recording again", await A.page.waitForFunction(() => svCh && (svCh.phase === "done" || svCh.phase === "feedback"), null, { timeout: 8000 }).then(() => true, () => false) && await A.page.evaluate(() => svCh.attempt === 1));
/* progressive: the report draws on the transcript, the grade joins it */
polishMode = "assessSlow"; heard = await A.page.evaluate(() => svAsset.segments[8].text); await A.page.evaluate(() => { svPick = 8; svChReset(); svRender(); }); await record(A.page);
await A.page.waitForFunction(() => svCh && (svCh.phase === "done" || svCh.phase === "feedback"), null, { timeout: 8000 }).catch(() => {});
const pg1 = await A.page.evaluate(() => ({ pending: svCh.pending, chip: [...document.querySelectorAll("#svCh .sv-ch-dim")].find(d => /Pronunciation/.test(d.innerText))?.innerText.replace(/\s+/g, " "), pron: svCh.fb.dims.pron.state, attempt: svCh.attempt }));
await A.page.waitForFunction(() => svCh && !svCh.pending, null, { timeout: 8000 }).catch(() => {});
const pg2 = await A.page.evaluate(() => ({ pending: svCh.pending, chip: [...document.querySelectorAll("#svCh .sv-ch-dim")].find(d => /Pronunciation/.test(d.innerText))?.innerText.replace(/\s+/g, " "), pron: svCh.fb.dims.pron.state, attempt: svCh.attempt, hist: svCh.hist[svCh.hist.length - 1].fb.dims.pron.state }));
ok("Progressive: with the grade still out, the report is already drawn from the transcript with Pronunciation 'Listening…' (dim na underneath, no number); when the grade lands the same attempt is re-scored in place (attempt count unchanged, history updated)", pg1.pending && /Listening/.test(pg1.chip) && pg1.pron === "na" && pg1.attempt === 1 && !pg2.pending && /Strong|Good/.test(pg2.chip) && pg2.pron !== "na" && pg2.attempt === 1 && pg2.hist !== "na", JSON.stringify({ pg1, pg2 }));
/* the grade fails: no pronunciation claim, a plain note */
polishMode = "assessFail"; await A.page.evaluate(() => { svPick = 9; svChReset(); svRender(); }); heard = await A.page.evaluate(() => svAsset.segments[9].text); await record(A.page);
await A.page.waitForFunction(() => svCh && (svCh.phase === "done" || svCh.phase === "feedback") && !svCh.pending, null, { timeout: 8000 }).catch(() => {});
const af = await A.page.evaluate(() => ({ pron: svCh.fb.dims.pron.state, chip: !![...document.querySelectorAll("#svCh .sv-ch-dim")].find(d => /Pronunciation/.test(d.innerText)), note: document.getElementById("svCh").innerText.includes("Pronunciation listening was not available"), words: svCh.fb.dims.words.state, pronIssues: svCh.fb.issues.filter(x => x.type === "pron").length }));
ok("Pronunciation grade unavailable: no Pronunciation chip, no pronunciation issue, the words still reported, and the note says the listening was not available — nothing invented", af.pron === "na" && !af.chip && af.note && af.words !== "na" && af.pronIssues === 0, JSON.stringify(af));
polishMode = "ok";
const rr = await A.page.evaluate(async () => { svCh.blob = null; await svChPlayMe(); return { restored: !!svCh.blob, playing: !!fbAud }; });
ok("The take is re-read from the device store when it is not in memory (Me still plays after a reload-like loss)", rr.restored && rr.playing, JSON.stringify(rr));
polishMode = "abort"; await A.page.evaluate(() => { svPick = 10; svChReset(); svRender(); }); await record(A.page);
ok("The Worker unreachable while online → an honest 'AI coach did not answer' state, not a score", await waitPhase(A.page, "error") && await A.page.evaluate(() => svCh.err === "ai" && document.querySelector("#svCh").innerText.includes("did not answer")));
polishMode = "ok";

/* ---------- Use it yourself (a line with a curriculum expression, from a pasted transcript) ---------- */
const phrase = await A.page.evaluate(() => trackPhrases()[0].p.replace(/\s*(\.{3}|…)\s*$/, ""));
const line = phrase + " a project manager in Lyon.";
await A.page.evaluate(async (line) => { await shLoad({ vid: "nocaps12345", start: 0, end: 0, title: "pasted" }, true); const nb = document.getElementById("shNote"); nb.value = line + " Thanks for your time today."; await shV2Load(); }, line); await sleep(600);
await A.page.evaluate(() => { shOpenWork(); svPick = 0; svSetMode("challenge"); }); await sleep(200);
const noTimes = await A.page.evaluate(() => svCh.rungs.slice());
ok("A clip with no word times carries a shorter ladder: there is no way to measure a lag against timings that do not exist, so the sync rung is simply not offered", noTimes.join() === "gate,recall,blind,retell", JSON.stringify(noTimes));
await toRung(A.page, "recall");
const ex = await A.page.evaluate(() => ({ level: svAsset.level, hint: document.querySelector("#svCh").innerText }));
ok("A pasted transcript (no timings) can be challenged; the curriculum expression is shown as the hint", ex.level === "text" && ex.hint.includes("Expression:") && ex.hint.includes(phrase), JSON.stringify(ex).slice(0, 200));
heard = await A.page.evaluate(() => svChSegObj().text.toLowerCase().replace(/[^a-z' ]/g, ""));   // the whole paragraph, expression included
await record(A.page);
ok("Done → 'Use it yourself' offered for the expression", await waitPhase(A.page, "done") && !!(await A.page.$("#svCh button:has-text('Use it yourself')")));
await A.page.click("#svCh button:has-text('Use it yourself')"); await sleep(150);
ok("Use it yourself: the prompt names the expression, own recorder, no chat", await A.page.evaluate((phrase) => { const u = document.getElementById("svChUse"); return !!u && u.innerText.includes("Use “" + phrase + "”") && !!document.getElementById("svChUseRecBtn") && !u.querySelector("textarea,input"); }, phrase));
heard = phrase.toLowerCase().replace(/[^a-z' ]/g, "") + " a nurse in paris since march";
await record(A.page, "#svChUseRecBtn");
ok("Own sentence with the expression → GOOD 'You used …', AI-labelled", await A.page.waitForFunction(() => svCh && svCh.use && svCh.use.phase === "feedback", null, { timeout: 8000 }).then(() => true, () => false) && await A.page.evaluate(() => svCh.use.res.used && /You used/.test(document.querySelector("#svChUse .sv-ch-line.good")?.innerText || "") && document.querySelector("#svChUse").innerText.includes("AI feedback")));
await A.page.click("#svChUse button:has-text('Try again')"); await sleep(100);
heard = "i am a nurse in paris";
await record(A.page, "#svChUseRecBtn");
ok("Own sentence without the expression → IMPROVE 'I did not hear …', try again is primary", await A.page.waitForFunction(() => svCh && svCh.use && svCh.use.phase === "feedback", null, { timeout: 8000 }).then(() => true, () => false) && await A.page.evaluate(() => !svCh.use.res.used && /did not hear/.test(document.querySelector("#svChUse .sv-ch-line.imp")?.innerText || "") && !!document.querySelector("#svChUse .btn-primary")));
await A.page.click("#svChUse button:has-text('Done')"); await sleep(100);
ok("Done closes the Use-it panel; the challenge stays complete", await A.page.evaluate(() => !svCh.use && svCh.phase === "done" && !document.getElementById("svChUse")));

/* ---------- the existing APPLY IT tab is untouched ---------- */
await A.page.evaluate(() => svSetMode("apply")); await sleep(200);
ok("APPLY IT still there: expression + 'Practise with AI' (partner button only with its own flag)", (await txt(A.page, ".sv-apply")).includes("Practise with AI") && (await txt(A.page, ".sv-apply")).includes("Use it with a partner") === await A.page.evaluate(() => flag("practice_partner_enabled")) && !(await A.page.$("#svCh")));
await A.page.evaluate(() => (svMode === "watch" ? svRender() : svSetMode("watch"))); await sleep(100);
ok("Leaving Challenge drops its state; Watch shows the transcript again", await A.page.evaluate(() => svCh === null && !document.getElementById("svTx").classList.contains("hidden")));

/* ---------- the workspace layout: tabs pinned with the player, clip tools first, the list folded by default ---------- */
const lay = await A.page.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); await new Promise(r => setTimeout(r, 2500)); shOpenWork(); });

/* The follow-along card is gone (owner, 22 Sep 2026: "remove this from the
   challenge page"). Watch already hid it in CSS and Shadow blanks it on render,
   so Challenge was the only mode it ever appeared in — removing it there
   removed it everywhere. This asserts that, in every mode, with the video
   playing, rather than leaving a test for a card that can no longer be drawn. */
const fa = await A.page.evaluate(async () => {
  const body = document.querySelector(".sh-work-body"), nw = document.getElementById("svNow");
  const shown = {};
  for (const m of ["watch", "shadow", "challenge"]) {
    svPick = 5; svSetMode(m);
    const s = svAsset.segments[5]; shSeek = { t: (s.words[2].startMs + 5) / 1000, at: Date.now() }; svTick();
    await new Promise(r => setTimeout(r, 400));
    shown[m] = getComputedStyle(nw).display !== "none" || nw.querySelectorAll(".sv-w").length > 0;
  }
  svSetMode("challenge"); svReveal();
  const s2 = svAsset.segments[5]; shSeek = { t: (s2.words[2].startMs + 5) / 1000, at: Date.now() }; svTick();
  await new Promise(r => setTimeout(r, 400));
  shown.challengeRevealed = getComputedStyle(nw).display !== "none" || nw.querySelectorAll(".sv-w").length > 0;
  (svMode === "watch" ? svRender() : svSetMode("watch")); svPick = -1;
  body.scrollTop = 0; await new Promise(r => setTimeout(r, 300));
  const stick = document.querySelector(".sh-stick");
  return { shown, stickTop: Math.round(stick.getBoundingClientRect().top), bodyTop: Math.round(body.getBoundingClientRect().top) };
});
ok("The follow-along card is shown in no mode — not Watch, not Shadow, not Challenge, not Challenge after Reveal", Object.values(fa.shown).every(v => v === false), JSON.stringify(fa.shown));
ok("Pinned: after the learner scrolls the workspace, the player block is still at the top of the scroll area", fa.stickTop === fa.bodyTop, JSON.stringify({ stickTop: fa.stickTop, bodyTop: fa.bodyTop }));
await A.page.evaluate(() => { svPick = 5; svSetMode("challenge"); }); await sleep(200);
ok("Challenge: the now-line card is hidden with the transcript — the line does not leak through the card", await A.page.evaluate(() => document.getElementById("svNow").hidden && !document.getElementById("svNow").innerText.trim()));
await A.page.evaluate(() => { (svMode === "watch" ? svRender() : svSetMode("watch")); svPick = -1; }); await sleep(200);

/* ---------- sentence-only captions get estimated word timing, honestly labelled ---------- */
const est = await A.page.evaluate(async () => { await shLoad({ vid: "UF8uR6Z6KLc", start: 0, end: 0, title: "Jobs" }, true); await new Promise(r => setTimeout(r, 2500)); return { level: svAsset && svAsset.level, estimated: !!(svAsset && svAsset.estimated), words: !!(svAsset && svAsset.segments[0].words && svAsset.segments[0].words.length), note: document.querySelector("#shV2 .sv-note")?.innerText || "" }; });
ok("Jobs clip (cue times only): words estimated from the sentence timing, level word, note says 'estimated'", est.level === "word" && est.estimated && est.words && /estimated/i.test(est.note), JSON.stringify(est));
await A.page.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); await new Promise(r => setTimeout(r, 2500)); shOpenWork(); });
ok("Back on a word-timed clip: not estimated, plain word note", await A.page.evaluate(() => svAsset.level === "word" && !svAsset.estimated && !/estimated/i.test(document.querySelector("#shV2 .sv-note").innerText)));

/* ---------- a learner's own video + pasted transcript behaves like a library clip ---------- */
const noCaps = u => /\/captions\/MZAjfsyJa1U\.json$/.test(u.href);
await A.ctx.route(noCaps, r => r.fulfill({ status: 404, body: "" }));   // pretend this clip ships no captions
const stamped = "0:00\nI stand before you not as an expert but as a concerned citizen.\n0:06\nOne of the 400,000 people who marched in the streets of New York on Sunday.\n0:12\nAnd the billions of others around the world who want to solve our climate crisis.";
await A.page.evaluate(async () => { shCloseWork(); go("shadow"); delete _capCache.MZAjfsyJa1U; }); await sleep(300);
await A.page.evaluate(s => { document.getElementById("shUrl").value = "https://www.youtube.com/watch?v=MZAjfsyJa1U"; document.getElementById("shPaste").value = s; shLoadFromInput(); }, stamped); await sleep(4000);
const pst = await A.page.evaluate(() => { const s = svAsset.segments[1]; shSeek = { t: (s.words[3].startMs + 5) / 1000, at: Date.now() }; svTick(); return { saved: !!(S.shTx && S.shTx.MZAjfsyJa1U), boxCleared: document.getElementById("shPaste").value === "", notesPlain: !/0:0/.test(document.getElementById("shNote").value) && document.getElementById("shNote").value.startsWith("I stand"), level: svAsset.level, source: svAsset.source, segs: svAsset.segments.length, line2: [svAsset.segments[1].startMs, svAsset.segments[1].endMs], lit: document.querySelector("#svTx .sv-seg.now .sv-w.now")?.innerText, want: s.words[3].text, note: document.querySelector("#shV2 .sv-note").innerText, tabs: [...document.querySelectorAll("#svTabs .seg-tab, #shV2 .sv-tabs .seg-tab")].map(x => x.innerText.trim()).join() }; });
ok("Own video + transcript pasted with YouTube's timestamps: kept with the video, box cleared, notes get the plain text; cues at the stamps (6.0–12.0 s), words estimated, the card lights the word; Watch / Shadow / Challenge tabs", pst.saved && pst.boxCleared && pst.notesPlain && pst.level === "word" && pst.source === "stamps" && pst.segs === 3 && pst.line2.join() === "6000,12000" && pst.lit === pst.want && /timestamps/i.test(pst.note) && pst.tabs.replace("▾", "").startsWith("Watch,Shadow,Challenge"), JSON.stringify(pst));
await A.page.evaluate(() => { svPick = 1; svSetMode("challenge"); }); await sleep(200);
ok("Challenge on the pasted clip: panel ready on the picked line's paragraph, transcript hidden", await A.page.evaluate(() => !!document.getElementById("svCh") && svCh.phase === "ready" && svCh.seg === svParaOf(1).from && getComputedStyle(document.getElementById("svTx")).display === "none"));
await A.page.evaluate(async () => { (svMode === "watch" ? svRender() : svSetMode("watch")); svPick = -1; shCloseWork(); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "again" }, true); }); await sleep(3000);
ok("Continue the same video later: the pasted transcript and its timing are still there", await A.page.evaluate(() => svAsset.source === "stamps" && svAsset.level === "word"));
await A.page.evaluate(() => { delete S.shTx.MZAjfsyJa1U; save(); shCloseWork(); go("shadow"); delete _capCache.MZAjfsyJa1U; }); await sleep(300);
await A.page.evaluate(() => { document.getElementById("shUrl").value = "https://www.youtube.com/watch?v=MZAjfsyJa1U"; document.getElementById("shPaste").value = "I stand before you not as an expert but as a concerned citizen. One of the 400,000 people who marched in the streets of New York on Sunday. And the billions of others around the world who want to solve our climate crisis."; shLoadFromInput(); }); await sleep(5000);
const spr = await A.page.evaluate(() => ({ level: svAsset.level, source: svAsset.source, est: svAsset.estimated, dur: Math.round(ytPlayer.getDuration()), last: svAsset.segments[svAsset.segments.length - 1].endMs, note: document.querySelector("#shV2 .sv-note").innerText }));
ok("Own video + transcript WITHOUT timestamps: spread over the real video length once the player reports it, estimated, note says so", spr.level === "word" && spr.source === "spread" && spr.est && spr.dur > 100 && Math.abs(spr.last - spr.dur * 1000) < 1500 && /video's length/i.test(spr.note), JSON.stringify(spr));
await A.page.evaluate(() => { delete S.shTx.MZAjfsyJa1U; delete _capCache.MZAjfsyJa1U; save(); }); await A.ctx.unroute(noCaps);
await A.page.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); await new Promise(r => setTimeout(r, 2500)); shOpenWork(); });

/* ---------- Your videos: the learner's own link + transcript is kept, listed under the library with an "Added by you" badge, up to five, openable, removable ---------- */
const own = await A.page.evaluate(async () => {
  const r = {};
  r.keptOnLoad = shOwn().length === 1 && shOwn()[0].vid === "MZAjfsyJa1U";                      // the two Loads above added it once
  shCloseWork(); go("shadow"); shTab("create"); await new Promise(r => setTimeout(r, 200));
  /* with at least one video the section leads the page in #shOwnTop (406058d); #shOwn keeps only the empty-state hint */
  const sec = document.getElementById("shOwnTop");
  r.section = !!sec && /Your videos/i.test(sec.innerText) && /1\/5/.test(sec.innerText) && !!(sec.compareDocumentPosition(document.getElementById("shUrl")) & Node.DOCUMENT_POSITION_PRECEDING) && !!(sec.compareDocumentPosition(document.querySelector(".sh-starter:not(.sh-own)")) & Node.DOCUMENT_POSITION_FOLLOWING);   // after the link box, before the starter clips
  const card = sec && sec.querySelector(".sh-own"); r.card = !!card; r.badge = !!card && /Added by you/.test(card.innerText); r.txChip = !!card && /Transcript added|No transcript/.test(card.innerText);
  r.thumb = !!card && card.querySelector("img").src.includes("MZAjfsyJa1U"); r.remove = !!card && !!card.querySelector(".sh-own-del");
  /* the cap: four more fill it, the sixth still plays but is not kept */
  const st = ["aaaaaaaaaa1", "aaaaaaaaaa2", "aaaaaaaaaa3", "aaaaaaaaaa4"].map(v => shOwnAdd(v, "https://youtu.be/" + v)); r.filled = st.every(x => x === "saved") && shOwn().length === 5;
  r.sixth = shOwnAdd("aaaaaaaaaa5", "x") === "full" && shOwn().length === 5; r.again = shOwnAdd("MZAjfsyJa1U", "x") === "exists" && shOwn().length === 5;
  r.five = document.querySelectorAll("#shOwnTop .sh-own").length === 5 && /5\/5/.test(document.getElementById("shOwnTop").innerText);
  /* opening one loads the video with its transcript; removing one takes its transcript with it and never resurrects through "Continue" */
  S.shTx.aaaaaaaaaa1 = "0:01 hello there\n0:03 second line"; S.lastClip = { vid: "aaaaaaaaaa1" }; save();
  const i1 = shOwnFind("aaaaaaaaaa1"); const realConfirm = window.askConfirm; window.askConfirm = async () => true;
  try { await shOwnDel(i1, { stopPropagation() {} }); } finally { window.askConfirm = realConfirm; }
  r.removed = shOwn().length === 4 && shOwnFind("aaaaaaaaaa1") < 0 && !S.shTx.aaaaaaaaaa1 && !S.lastClip && document.querySelectorAll("#shOwnTop .sh-own").length === 4;
  r.openBtn = !!document.querySelector("#shOwnTop .sh-own button[onclick^='shOwnOpen']");
  /* clean up: keep only the real one */
  ["aaaaaaaaaa2", "aaaaaaaaaa3", "aaaaaaaaaa4"].forEach(v => { const i = shOwnFind(v); if (i >= 0) shOwn().splice(i, 1); }); save(); shOwnRender();
  r.cleaned = shOwn().length === 1 && /1\/5/.test(document.getElementById("shOwnTop").innerText) && document.getElementById("shOwn").innerHTML === "";
  return r;
});
ok("Your videos: the loaded link is kept once; the picker lists it right after the link box, before the starter clips, with an 'Added by you' badge, transcript chip, thumbnail, open and remove; five is the cap (the sixth is not kept, a repeat is not duplicated); removing one drops its transcript and 'Continue your last clip'", own.keptOnLoad && own.section && own.card && own.badge && own.txChip && own.thumb && own.remove && own.filled && own.sixth && own.again && own.five && own.removed && own.openBtn && own.cleaned, JSON.stringify(own));
const ownW = await W.page.evaluate(() => ({ list: (S.shOwnA && S.shOwnA.welding) ? S.shOwnA.welding.length : 0, section: !!document.getElementById("shOwn") && document.getElementById("shOwn").offsetParent !== null }));
const clr = await A.page.evaluate(() => { if (!_shAdd) shAddToggle(); const u = document.getElementById("shUrl"), pb = document.getElementById("shPaste"); u.value = "https://youtu.be/MZAjfsyJa1U"; pb.value = "0:01 something"; const btn = document.querySelector(".sh-load-row .sh-in-clear"); const before = JSON.stringify([shOwn(), S.shTx]); const r = { btn: !!btn, beside: !!btn && btn.previousElementSibling === document.querySelector(".sh-load-row .btn-primary"), big: !!btn && btn.getBoundingClientRect().height >= 44 }; btn && btn.click(); r.cleared = u.value === "" && pb.value === ""; r.kept = JSON.stringify([shOwn(), S.shTx]) === before && shOwn().length === 1; r.focused = document.activeElement === u; return r; });
ok("A bin beside Load video empties the link box and the transcript box (≥44 px, focus back on the link) and touches nothing saved", clr.btn && clr.beside && clr.big && clr.cleared && clr.kept && clr.focused, JSON.stringify(clr));
ok("Welding: no Your videos section (the picker is General English) and nothing in its own list", ownW.list === 0 && !ownW.section, JSON.stringify(ownW));
await A.page.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); await new Promise(r => setTimeout(r, 2500)); shOpenWork(); });

/* ---------- current expression chip, in every mode ---------- */
const chip = await A.page.evaluate(() => { const phr = trackPhrases(); const first = (typeof phr[0] === "string" ? phr[0] : phr[0] && phr[0].p) || ""; const tk = ShadowSync.tokens(first.replace(/\.{3}|…/g, " ")).join(" ");
  const i = svAsset.segments.length - 1; svAsset.segments[i].text = "so " + tk + " tomorrow"; svPick = i; (svMode === "watch" ? svRender() : svSetMode("watch")); const el = document.getElementById("svExpr");
  const r = { first, shown: !!el && !el.hidden, text: el && el.innerText, expr: svExprText() }; svAsset.segments[i].text = "zzz"; svRender(); r.gone = document.getElementById("svExpr").hidden; r.seg0 = svExprText(); svPick = 0; svRender(); return r; });
ok("Watch: a line that carries a curriculum expression shows the 'Current expression' chip; a line without one hides it", chip.shown && /Current expression/i.test(chip.text) && chip.expr && chip.gone, JSON.stringify(chip));
const rtEv = await A.page.evaluate(() => __ev.some(e => e[0] === "shadow_challenge_retry"));
ok("Analytics: Try again sends shadow_challenge_retry", rtEv);


/* ---------- RETELL, CHORUS, BUILD-UP ---------- */
await A.page.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
await A.page.evaluate(() => { shOpenWork(); svPick = 8; svSetMode("challenge"); }); await sleep(250);
await toRung(A.page, "retell");
const rt0 = await A.page.evaluate(() => ({ eyebrow: document.querySelector("#svCh .eyebrow")?.innerText.trim(), shown: document.getElementById("svCh").innerText.includes(svChSegObj().text), prompt: /in your own words/i.test(document.getElementById("svCh").innerText), rec: !!document.getElementById("svChRetellRecBtn") }));
ok("RETELL shows the paragraph (nothing is being memorised here) and asks for the meaning in the learner's own words", /what it meant/i.test(rt0.eyebrow) && rt0.shown && rt0.prompt && rt0.rec, JSON.stringify(rt0));
/* saying the line again is the usual way out, and it is caught here rather than paid for */
heard = await A.page.evaluate(() => svChSegObj().text.toLowerCase().replace(/[^a-z' ]/g, ""));
const hits0 = polishHits;
await record(A.page, "#svChRetellRecBtn");
await A.page.waitForFunction(() => svCh && svCh.retell && svCh.retell.res, null, { timeout: 12000 });
const rtEcho = await A.page.evaluate(() => ({ ok: svCh.retell.res.ok, why: svCh.retell.res.why, text: document.querySelector("#svCh .sv-ch-line.imp")?.innerText }));
ok("Saying the line again is not a retell: it is caught on the device, told plainly, and no AI call is spent on it", !rtEcho.ok && rtEcho.why === "echo" && /line again/i.test(rtEcho.text || "") && polishHits - hits0 <= 1, JSON.stringify(rtEcho) + " calls=" + (polishHits - hits0));
/* a real retell: different words, same meaning — judged by the AI, labelled as AI */
await A.page.evaluate(() => svChRetellRetry()); await sleep(150);
heard = "he is saying that ordinary people marched and that the world has to fix this problem now";
retellVerdict = { ok: true, missed: "", tip: "Say it a little slower." };
await record(A.page, "#svChRetellRecBtn");
await A.page.waitForFunction(() => svCh && svCh.retell && svCh.retell.res, null, { timeout: 12000 });
const rtOk = await A.page.evaluate(() => ({ ok: svCh.retell.res.ok, tip: svCh.retell.res.tip, ai: /AI feedback/.test(document.getElementById("svCh").innerText), good: document.querySelector("#svCh .sv-ch-line.good")?.innerText, hist: aList("chHist")[0] && aList("chHist")[0].kind }));
ok("A real retell — the learner's own words, the same meaning — passes, carries the coach's tip, is labelled AI feedback and is filed in the history", rtOk.ok && /slower/.test(rtOk.tip) && rtOk.ai && /own words/i.test(rtOk.good || "") && rtOk.hist === "chretell", JSON.stringify(rtOk));
const rtDone = await A.page.evaluate(async () => { svChRetellDone(); await new Promise(r => setTimeout(r, 120)); return { move: svCh.next && svCh.next.move, card: document.querySelector("#svCh .sv-ch-move")?.innerText.replace(/\s+/g, " ") }; });
ok("Passing the last rung finishes the paragraph rather than inventing a sixth: the card says so and points at the next paragraph", rtDone.move === "done" && /finished/i.test(rtDone.card || ""), JSON.stringify(rtDone));
/* ---- the chorus drill ---- */
await A.page.evaluate(() => { svChStay(); }); await sleep(120);
await toRung(A.page, "recall");
const tw2 = await A.page.evaluate(() => ShadowSync.tokens(svChSegObj().text));
heard = tw2.slice(0, Math.max(2, tw2.length - Math.max(3, Math.ceil(tw2.length * 0.3)))).join(" ");
await record(A.page);
ok("A miss on recall gives a report to work from", await waitPhase(A.page, "feedback"));
const ch0 = await A.page.evaluate(async () => { const b = [...document.querySelectorAll("#svCh .sv-ch-issue-body button")].find(x => /Chorus/.test(x.innerText)); if (!b) return { btn: false }; b.click(); await new Promise(r => setTimeout(r, 200));
  return { btn: true, open: !!document.getElementById("svChChorus"), text: svCh.chorus.text, reps: svCh.chorus.reps, dots: document.querySelectorAll("#svChChorus .sv-ch-reps i").length, words: svCh.chorus.text.split(/\s+/).length, ev: __ev.filter(e => e[0] === "shadow_challenge_drill").map(e => e[1].kind) }; });
ok("Chorus opens from a trouble spot in the report: a phrase, not a single word (a word is too small to carry a rhythm), six passes drawn as pips", ch0.btn && ch0.open && ch0.reps === 6 && ch0.dots === 6 && ch0.words >= 3 && ch0.ev.includes("chorus"), JSON.stringify(ch0));
const ch1 = await A.page.evaluate(async () => { svChChorusGo(); await new Promise(r => setTimeout(r, 400)); const mid = { phase: svCh.chorus.phase, at: svCh.chorus.at }; svChChorusStop(); await new Promise(r => setTimeout(r, 120)); return { mid, stopped: svCh.chorus.phase }; });
ok("The chorus runs pass by pass and can be stopped part-way", ch1.mid.phase === "chorus" && ch1.mid.at >= 0 && ch1.stopped === "ready", JSON.stringify(ch1));
const ch2 = await A.page.evaluate(async () => { svCh.chorus.at = svCh.chorus.reps; svChDraw(); await new Promise(r => setTimeout(r, 100)); return { alone: !!document.getElementById("svChChorusRecBtn"), label: document.querySelector("#svChChorus .sv-ch-reclbl")?.innerText }; });
ok("After the six passes the drill asks for the piece said ALONE — the chorus itself cannot honestly be graded, because the learner is speaking over the audio", ch2.alone && /alone/i.test(ch2.label || ""), JSON.stringify(ch2));
heard = await A.page.evaluate(() => svCh.chorus.text.toLowerCase().replace(/[^a-z' ]/g, ""));
const attBefore = await A.page.evaluate(() => svCh.attempt);
await record(A.page, "#svChChorusRecBtn");
await A.page.waitForFunction(() => svCh && svCh.chorus && svCh.chorus.attempts.length, null, { timeout: 12000 });
const chGrade = await A.page.evaluate(() => ({ n: svCh.chorus.attempts.length, mode: svCh.chorus.attempts[0].mode, state: svCh.chorus.attempts[0].state, attempt: svCh.attempt }));
ok("The take after the chorus is graded like any other, and does not touch the line's own attempt count", chGrade.n === 1 && chGrade.mode === "ai" && chGrade.attempt === attBefore, JSON.stringify(chGrade) + " before=" + attBefore);
await A.page.evaluate(() => svChChorusClose()); await sleep(120);
/* ---- backward build-up ---- */
const bu0 = await A.page.evaluate(async () => { const before = !![...document.querySelectorAll("#svCh button")].find(b => /Break it down/.test(b.innerText)); svChRetry(); await new Promise(r => setTimeout(r, 120)); return { before, fails: svCh.fails }; });
ok("The ways out of a wall are not offered on the first miss — one more go is usually the right answer", bu0.before === false && bu0.fails === 1, JSON.stringify(bu0));
await record(A.page);
await waitPhase(A.page, "feedback");
const bu1 = await A.page.evaluate(async () => { const b = [...document.querySelectorAll("#svCh button")].find(x => /Break it down/.test(x.innerText)); if (!b) return { btn: false }; b.click(); await new Promise(r => setTimeout(r, 200));
  const steps = svCh.build.steps, full = svChSegObj().text;
  return { btn: true, open: !!document.getElementById("svChBuild"), steps: steps.length, growing: steps.every((s, i) => !i || s.split(/\s+/).length > steps[i - 1].split(/\s+/).length), fromEnd: steps.every(s => full.endsWith(s)), last: steps[steps.length - 1] === full, shown: document.querySelector("#svChBuild .sv-ch-build-w").innerText, ev: __ev.filter(e => e[0] === "shadow_challenge_drill").map(e => e[1].kind) }; });
ok("A second miss offers Break it down: growing chunks that all END where the paragraph ends, the last one the whole thing — the tail is the part that gets dropped, so it is the part that gets said most", bu1.btn && bu1.open && bu1.steps >= 2 && bu1.growing && bu1.fromEnd && bu1.last && bu1.ev.includes("buildup"), JSON.stringify(bu1));
heard = await A.page.evaluate(() => svCh.build.steps[0].toLowerCase().replace(/[^a-z' ]/g, ""));
await record(A.page, "#svChBuildRecBtn");
await A.page.waitForFunction(() => svCh && svCh.build && svCh.build.last, null, { timeout: 12000 });
const bu2 = await A.page.evaluate(async () => { const r = { ok: svCh.build.last.ok, at0: svCh.build.at, next: !![...document.querySelectorAll("#svChBuild button")].find(b => /A little more/.test(b.innerText)) };
  svChBuildNext(); await new Promise(x => setTimeout(x, 120)); r.at1 = svCh.build.at; r.cleared = !svCh.build.last; return r; });
ok("Saying a chunk right moves the drill one step further back through the paragraph, with a clean slate for the longer piece", bu2.ok && bu2.at0 === 0 && bu2.next && bu2.at1 === 1 && bu2.cleared, JSON.stringify(bu2));
const bu3 = await A.page.evaluate(async () => { svCh.build.at = svCh.build.steps.length - 1; svCh.build.last = { ok: true, ok_n: 9, total: 9 }; svChDraw(); await new Promise(r => setTimeout(r, 100));
  const fin = !![...document.querySelectorAll("#svChBuild button")].find(b => /Say the whole thing/.test(b.innerText));
  svChBuildFinish(); await new Promise(r => setTimeout(r, 150));
  return { fin, closed: !svCh.build, rung: svCh.rung, phase: svCh.phase, rec: !!document.getElementById("svChRecBtn") }; });
ok("Finishing the build-up hands the learner straight back to the rung it was unblocking, ready to record the whole paragraph", bu3.fin && bu3.closed && bu3.rung === "recall" && bu3.phase === "ready" && bu3.rec, JSON.stringify(bu3));

/* ---------- microphone refused ---------- */
await M.page.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
await M.page.evaluate(() => { shOpenWork(); svPick = 3; svSetMode("challenge"); }); await sleep(200);
await toRung(M.page, "recall");
await M.page.click("#svChRecBtn"); await sleep(900);
ok("Microphone refused → back to ready with a clear mic message, nothing recorded, nothing graded", await M.page.evaluate(() => svCh.phase === "ready" && svCh.err === "mic" && /Microphone/.test(document.querySelector("#svCh .sv-ch-state").innerText) && svCh.attempt === 0));

/* ---------- Welding: the mode does not exist ---------- */
await W.page.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
const wd = await W.page.evaluate(() => { shOpenWork(); const b = document.getElementById("shV2"); const r = { on: svOn(), chOn: svChOn(), asset: svAsset, hidden: !b || b.style.display === "none", classic: !!document.getElementById("recBtn") };
  svSetMode("challenge"); svChStart(); svChRecord(); svChListen(); svChStep(1); svChUse(); svChNext();
  svChGateCheck(); svChGateDone(); svChGateSkip(); svChSyncGo(); svChSyncStop(); svChSyncDone(); svChRetellRecord(); svChRetellDone(); svChChorusOpen(0); svChChorusGo(); svChBuildOpen(); svChBuildRecord(); svChShowNext(); svChTakeNext(); svChStay();
  svChPlayOrig(); svChLoop(); svChSpeed(1.25); svChAB(); svChDrillOpen(0); svChDrillWord(0); svChDrillRecord(); svChSaveVocab("honored"); svChOpen(0); svChPlayMe();
  r.rate = shClip.rate; r.repeat = svRepeat; r.voc = vocHas("honored");
  r.state = svCh; r.panel = !!document.getElementById("svCh"); r.level = (S.svChA && S.svChA.welding && S.svChA.welding._level) || null; r.map = JSON.stringify(S.svChA || {}); r.mr = rec.mr && rec.mr.state; return r; });
ok("Welding, same flags: V2 panel hidden, svChOn() false, every entry point is a no-op — no state, no panel, no level saved, no recorder started; the classic Shadow recorder is unchanged", !wd.on && !wd.chOn && wd.asset === null && wd.hidden && wd.classic && wd.state === null && !wd.panel && wd.level === null && wd.mr !== "recording" && wd.rate !== 1.25 && wd.repeat === null && !wd.voc, JSON.stringify({ ...wd, map: undefined }));
ok("Welding: the General English challenge record is not readable through the per-area map", await W.page.evaluate(() => Object.keys(aMap("svCh")).length === 0));
ok("Welding: the General English Challenge history is not visible either — its own list is empty and the History tab counts 0", await W.page.evaluate(() => aList("chHist").length === 0 && (S.chHistA && S.chHistA["general-english"] || []).length === 0));
const forced = await W.page.evaluate(() => { svMode = "challenge"; svAsset = ShadowSync.normalizeText("I will get back to you by the end of the day."); svPick = 0; svRender(); svChStart(); return { panel: !!document.getElementById("svCh"), state: svCh, chOn: svChOn(), html: (document.getElementById("shV2") || {}).innerHTML || "" }; });
ok("Welding: forcing svMode/svAsset by hand still draws no Challenge panel and creates no state — the gate is svChOn(), not the tab", !forced.panel && forced.state === null && !forced.chOn && !/Your turn/i.test(forced.html), JSON.stringify({ panel: forced.panel, chOn: forced.chOn }));
ok("General English learner's challenge record lives under its own area only", await A.page.evaluate(() => S.svChA && S.svChA["general-english"] && !S.svChA.welding));

/* ---------- mobile fit, i18n parity, no JS errors ---------- */
await A.page.evaluate(() => { svPick = 0; svSetMode("challenge"); }); await sleep(200);
const fitGate = await A.page.evaluate(() => { const p = document.getElementById("svCh"), l = p.querySelector(".sv-ch-ladder"); return { over: p.scrollWidth > p.clientWidth + 1, page: document.documentElement.scrollWidth > window.innerWidth + 1, ladder: l.scrollWidth <= l.clientWidth + 1, chips: [...p.querySelectorAll(".sv-ch-chip")].every(c => c.getBoundingClientRect().height >= 40) }; });
ok("Phone width, listening gate: the panel and the five-rung strip both fit, no horizontal page scroll, every word chip is a real target", !fitGate.over && !fitGate.page && fitGate.ladder && fitGate.chips, JSON.stringify(fitGate));
await toRung(A.page, "recall");
const fit = await A.page.evaluate(() => { const p = document.getElementById("svCh"); const b = document.getElementById("svChRecBtn").getBoundingClientRect(); return { over: p.scrollWidth > p.clientWidth + 1, page: document.documentElement.scrollWidth > window.innerWidth + 1, hit: b.width >= 44 && b.height >= 44 }; });
ok("Phone width: the panel does not overflow, no horizontal page scroll, the record button is a ≥44 px target", !fit.over && !fit.page && fit.hit, JSON.stringify(fit));
const fab = await A.page.evaluate(() => { const f = [...document.querySelectorAll("button,a")].find(e => /real person/i.test(e.innerText || "") && getComputedStyle(e).position === "fixed"); if (!f) return { none: true };
  const r = f.getBoundingClientRect(); const work = document.querySelector(".sh-work"); const zi = +getComputedStyle(work).zIndex, zf = +getComputedStyle(f).zIndex;
  const rec = document.getElementById("svChRecBtn").getBoundingClientRect(); const overlap = !(r.right < rec.left || r.left > rec.right || r.bottom < rec.top || r.top > rec.bottom);
  return { none: false, coveredByWorkspace: zi > zf, hitsWorkspace: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".sh-work") !== null, overlap }; });
ok("Practice Partner floating button: present, sits under the full-screen workspace (never over the mic or the transcript)", fab.none || (fab.coveredByWorkspace && fab.hitsWorkspace && !fab.overlap), JSON.stringify(fab));
const parity = (() => { const h = readFileSync(new URL("../index.html", import.meta.url), "utf8"); const m = h.match(/const I18N_EN\s*=\s*\{/); const s = h.indexOf("{", m.index); let d = 0, i = s; for (; i < h.length; i++) { if (h[i] === "{") d++; else if (h[i] === "}") { d--; if (!d) break; } }
  const keys = new Set(); const re = /"([A-Za-z0-9_.\-]+)"\s*:/g; let x; const blk = h.slice(s, i + 1); while ((x = re.exec(blk))) keys.add(x[1]);
  const bad = []; for (const f of readdirSync(new URL("../i18n", import.meta.url))) { const j = JSON.parse(readFileSync(new URL("../i18n/" + f, import.meta.url), "utf8")); const jk = Object.keys(j); const miss = [...keys].filter(k => !(k in j)).length, orph = jk.filter(k => !keys.has(k)).length; if (miss || orph) bad.push(f + ":" + miss + "/" + orph); }
  return { n: keys.size, ch: [...keys].filter(k => k.startsWith("sv.ch_")).length, bad }; })();
ok("i18n parity: every sv.ch_* key exists in all 15 language files, no orphans", parity.ch >= 50 && parity.bad.length === 0, JSON.stringify(parity));
ok("No page errors on any of the three learners", errors.length === 0, errors.join(" | "));

await browser.close(); if (server) server.kill();
const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
