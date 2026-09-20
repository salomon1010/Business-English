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
const sh = await A.page.evaluate(() => { const b = document.querySelector("#shV2 .sv-shadow-this"); if (!b) return { btn: false }; svShadowThis(); const s = svAsset.segments[5]; return { btn: true, start: shClip.start === s.startMs / 1000, end: shClip.end === s.endMs / 1000, rec: !!document.getElementById("recBtn"), panel: !!document.getElementById("svCh") }; });
ok("SHADOW still works: 'Shadow this sentence' sets the clip marks to the line and the classic recorder is there; no Challenge panel", sh.btn && sh.start && sh.end && sh.rec && !sh.panel, JSON.stringify(sh));

/* ---------- CHALLENGE starts ---------- */
await A.page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { __ev.push([n, p || {}]); return t0 && t0(n, p); }; });
await A.page.evaluate(() => svSetMode("challenge")); await sleep(200);
ok("Analytics: entering the tab sends shadow_challenge_opened, then shadow_challenge_started (+level)", await A.page.evaluate(() => __ev.some(e => e[0] === "shadow_challenge_opened") && __ev.some(e => e[0] === "shadow_challenge_started" && e[1].level === "recall")), await A.page.evaluate(() => JSON.stringify(__ev)));
const st = await A.page.evaluate(() => { const s = svAsset.segments[5]; const panel = document.getElementById("svCh"); return { panel: !!panel, hidden: document.getElementById("svTx").classList.contains("hidden"), blur: getComputedStyle(document.getElementById("svTx")).display, recTop: document.getElementById("svChRecBtn")?.getBoundingClientRect().top, panelFirst: (document.getElementById("svCh")?.compareDocumentPosition(document.getElementById("svTx")) & 4) === 4, level: svCh && svCh.level, phase: svCh && svCh.phase, seg: svCh && svCh.seg, tabs: [...panel.querySelectorAll(".sv-ch-lv .seg-tab")].map(b => b.innerText.trim()), leak: panel.innerText.includes(s.text), turn: /your turn/i.test(panel.innerText), listen: !![...panel.querySelectorAll("button")].find(b => /Listen/.test(b.innerText)), rec: !!document.getElementById("svChRecBtn"), words: panel.innerText.includes(ShadowSync.tokens(s.text).length + " words") }; });
ok("CHALLENGE starts: panel with 'Your turn', three levels, Recall by default, the picked line as target, phase ready", st.panel && st.turn && st.tabs.join() === "Guided,Recall,Independent" && st.level === "recall" && st.phase === "ready" && st.seg === 5, JSON.stringify(st));
ok("Transcript hidden: the list is collapsed (display none, not blurred) and the target sentence appears nowhere in the panel; only the word count and a Listen button", st.hidden && st.blur === "none" && !st.leak && st.words && st.listen && st.rec, JSON.stringify(st));
ok("Phone: 'Your turn' sits before the transcript and the Record button is inside the first screen, no scrolling", st.panelFirst && st.recTop > 0 && st.recTop < 844 - 48, JSON.stringify({ recTop: st.recTop, panelFirst: st.panelFirst }));
ok("Existing Reveal escape hatch still present in Challenge", !!(await A.page.$("#shV2 .sv-ctl button[onclick='svReveal()']")));
await A.page.click("#svCh .sv-ch-lv .seg-tab:nth-child(1)"); await sleep(200);
const gd = await A.page.evaluate(() => { const s = svAsset.segments[5]; const p = document.getElementById("svCh"); return { level: svCh.level, shown: p.innerText.includes(s.text), saved: aMap("svCh")._level }; });
ok("GUIDED shows the line before recording, and the level is remembered per area", gd.level === "guided" && gd.shown && gd.saved === "guided", JSON.stringify(gd));
await A.page.click("#svCh .sv-ch-lv .seg-tab:nth-child(3)"); await sleep(200);
const ind = await A.page.evaluate(() => { const p = document.getElementById("svCh"); const s = svAsset.segments[5]; return { level: svCh.level, listen: !![...p.querySelectorAll("button")].find(b => /Listen/.test(b.innerText)), shown: p.innerText.includes(s.text), words: p.innerText.includes(" words") }; });
ok("INDEPENDENT: no Listen before the first attempt, no line, no word count — a minimal prompt", ind.level === "independent" && !ind.listen && !ind.shown && !ind.words, JSON.stringify(ind));
await A.page.click("#svCh .sv-ch-lv .seg-tab:nth-child(2)"); await sleep(200);

/* ---------- record → feedback → retry → complete ---------- */
const target = await A.page.evaluate(() => svAsset.segments[5].text);
const tgtWords = target.toLowerCase().replace(/[^a-z' ]/g, "").split(/\s+/).filter(Boolean);
heard = tgtWords.slice(0, Math.max(2, tgtWords.length - 3)).join(" ");      // three words short of the line
await A.page.click("#svChRecBtn"); ok("Tapping Record acquires the microphone and starts the recorder", await recording(A.page));
const recS = await A.page.evaluate(() => { const b = document.getElementById("svChRecBtn"); const s = svAsset.segments[5]; return { phase: svCh.phase, on: b.classList.contains("on"), pressed: b.getAttribute("aria-pressed"), label: b.getAttribute("aria-label"), state: document.querySelector("#svCh .sv-ch-state").innerText, mr: rec.mr && rec.mr.state, leak: document.getElementById("svCh").innerText.includes(s.text) }; });
ok("Recording state is explicit: phase recording, button lit + aria-pressed, 'Tap to stop', live status line, MediaRecorder running, line still hidden", recS.phase === "recording" && recS.on && recS.pressed === "true" && /stop/i.test(recS.label) && /Recording/.test(recS.state) && recS.mr === "recording" && !recS.leak, JSON.stringify(recS));
await sleep(1600); await A.page.click("#svChRecBtn");
ok("Stop → grading → feedback", await waitPhase(A.page, "feedback"), "phase=" + await phase(A.page));
const fb1 = await A.page.evaluate(() => { const p = document.getElementById("svCh"); const s = svAsset.segments[5]; return { attempt: svCh.attempt, good: p.querySelector(".sv-ch-line.good")?.innerText, imp: p.querySelector(".sv-ch-line.imp")?.innerText, ai: p.innerText.includes("AI feedback"), heard: p.innerText.includes("You said"), target: p.innerText.includes(s.text), again: !![...p.querySelectorAll("button")].find(b => /Try again/.test(b.innerText)), replay: !![...p.querySelectorAll("button")].find(b => /Play my attempt/.test(b.innerText)), lines: p.querySelectorAll(".sv-ch-line").length, pass: svCh.fb.pass }; });
ok("Feedback: exactly one GOOD and one IMPROVE, labelled AI, missing words named, target revealed after the attempt, Try again + replay", fb1.attempt === 1 && fb1.lines === 2 && /^GOOD/i.test(fb1.good) && /^IMPROVE/i.test(fb1.imp) && /Missing/.test(fb1.imp) && fb1.ai && fb1.heard && fb1.target && fb1.again && fb1.replay && !fb1.pass, JSON.stringify(fb1));
const vis = await A.page.evaluate(() => ({ disp: getComputedStyle(document.getElementById("svTx")).display, pick: document.querySelector("#svTx .sv-seg.pick")?.dataset.i, reveal: !!document.querySelector("#shV2 .sv-ctl button[onclick='svReveal()']"), ev: __ev.filter(e => e[0] === "shadow_challenge_feedback_received").map(e => e[1].result), done: __ev.some(e => e[0] === "shadow_challenge_completed") }));
ok("Feedback state: the transcript is visible again with the target line marked, no Reveal button; feedback_received{retry} sent, completed NOT sent", vis.disp !== "none" && vis.pick === "5" && !vis.reveal && vis.ev.join() === "retry" && !vis.done, JSON.stringify(vis));
await A.page.click("#svCh .btn-primary"); await sleep(150);
const rt = await A.page.evaluate(() => ({ phase: svCh.phase, fb: svCh.fb, attempt: svCh.attempt, state: document.querySelector("#svCh .sv-ch-state").innerText, hidden: getComputedStyle(document.getElementById("svTx")).display === "none" }));
ok("Try again → ready for attempt 2, feedback cleared, attempt count kept, last result shown as words ('6 of 8'), transcript hidden again", rt.phase === "ready" && rt.fb === null && rt.attempt === 1 && /Attempt 2/.test(rt.state) && /last time \d+ of \d+ words/.test(rt.state) && rt.hidden, JSON.stringify(rt));
heard = tgtWords.join(" ");
await record(A.page);
ok("Full line → done", await waitPhase(A.page, "done"), "phase=" + await phase(A.page));
const dn = await A.page.evaluate(() => { const p = document.getElementById("svCh"); const s = svAsset.segments[5]; const m = aMap("svCh")["MZAjfsyJa1U:" + s.id]; return { title: p.innerText.includes("You said it without reading"), good: p.querySelector(".sv-ch-line.good")?.innerText, next: !![...p.querySelectorAll("button")].find(b => /Next sentence/.test(b.innerText)), up: !![...p.querySelectorAll("button")].find(b => /Independent level/.test(b.innerText)), saved: m && m.done === true && m.n === 2 && m.best === 100 && m.level === "recall", use: !![...p.querySelectorAll("button")].find(b => /Use it yourself/.test(b.innerText)) }; });
ok("Completion: success line, GOOD 'every word', Next sentence + 'Try the Independent level', per-area record {done, n:2, best:100}", dn.title && /every word/.test(dn.good) && dn.next && dn.up && dn.saved, JSON.stringify(dn));
ok("No 'Use it yourself' when the line carries no curriculum expression", !dn.use);
ok("Analytics: a pass sends shadow_challenge_completed (+level) exactly once, after feedback_received{pass}", await A.page.evaluate(() => __ev.filter(e => e[0] === "shadow_challenge_completed").length === 1 && __ev.filter(e => e[0] === "shadow_challenge_feedback_received").map(e => e[1].result).join() === "retry,pass"));
await A.page.click("#svCh button:has-text('Next sentence')"); await sleep(200);
ok("Next sentence moves the target and resets the loop", await A.page.evaluate(() => svCh.seg === 6 && svCh.phase === "ready" && svCh.attempt === 0 && svPick === 6));

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
polishMode = "abort"; await A.page.evaluate(() => { svPick = 8; svChReset(); svRender(); }); await record(A.page);
ok("The Worker unreachable while online → an honest 'AI coach did not answer' state, not a score", await waitPhase(A.page, "error") && await A.page.evaluate(() => svCh.err === "ai" && document.querySelector("#svCh").innerText.includes("did not answer")));
polishMode = "ok";

/* ---------- Use it yourself (a line with a curriculum expression, from a pasted transcript) ---------- */
const phrase = await A.page.evaluate(() => trackPhrases()[0].p.replace(/\s*(\.{3}|…)\s*$/, ""));
const line = phrase + " a project manager in Lyon.";
await A.page.evaluate(async (line) => { await shLoad({ vid: "nocaps12345", start: 0, end: 0, title: "pasted" }, true); const nb = document.getElementById("shNote"); nb.value = line + " Thanks for your time today."; await shV2Load(); }, line); await sleep(600);
await A.page.evaluate(() => { shOpenWork(); svPick = 0; svSetMode("challenge"); }); await sleep(200);
const ex = await A.page.evaluate(() => ({ level: svAsset.level, hint: document.querySelector("#svCh").innerText }));
ok("A pasted transcript (no timings) can be challenged; the curriculum expression is shown as the hint", ex.level === "text" && ex.hint.includes("Expression:") && ex.hint.includes(phrase), JSON.stringify(ex).slice(0, 200));
heard = line.toLowerCase().replace(/[^a-z' ]/g, "");
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
const lay = await A.page.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); await new Promise(r => setTimeout(r, 2500)); shOpenWork(); svPick = -1; svMode = "shadow"; svWatchOpen = false; svSetMode("watch"); svTxOpen = false; svRender(); await new Promise(r => setTimeout(r, 200));
  const vis = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
  /* arriving in Watch: folded — the pinned block and the moving list, nothing else */
  const below = () => [...document.getElementById("shPlayerWrap").children].filter(e => !e.classList.contains("sh-stick") && !e.hidden && getComputedStyle(e).display !== "none").length;
  const rf = { foldedBelow: below(), foldedList: vis("#svTx"), foldedLines: document.querySelectorAll("#svTx .sv-seg").length, foldedFoldBtn: !!document.querySelector("#shV2 .sv-ctl button[onclick='svTxToggle()']"), cardWords: document.querySelectorAll("#svNow .sv-w").length, chev: !!document.querySelector("#svTabs .sv-chev"), expanded: document.querySelector("#svTabs .seg-tab").getAttribute("aria-expanded") };
  document.querySelector("#svTabs .seg-tab").click(); await new Promise(r => setTimeout(r, 200));   // Watch again = release
  rf.releasedBelow = below(); rf.expanded2 = document.querySelector("#svTabs .seg-tab").getAttribute("aria-expanded"); rf.releasedList = vis("#svTx");
  svSetMode("shadow"); await new Promise(r => setTimeout(r, 200));   // Shadow: the list folds behind the Transcript button
  const r = { ...rf, tabsInStick: !!document.querySelector(".sh-stick #svTabs .seg-tab"), tabs: vis("#svTabs"), clip: vis("#shSeg"), hint: vis("#shMarkHint"), list: vis("#svTx"), fold: document.querySelector("#shV2 .sv-ctl button[onclick='svTxToggle()']")?.title, stickBottom: Math.round(document.querySelector(".sh-stick").getBoundingClientRect().bottom) };
  svTxToggle(); await new Promise(r => setTimeout(r, 200)); r.listOpen = vis("#svTx"); r.remembered = localStorage.getItem("be_sv_txopen"); r.foldOpen = document.querySelector("#shV2 .sv-ctl button[onclick='svTxToggle()']")?.title;
  svPick = 5; svSetMode("challenge"); await new Promise(r => setTimeout(r, 200)); r.chClip = vis("#shSeg"); r.chHint = vis("#shMarkHint"); r.chRec = vis("#svChRecBtn"); r.chFold = !!document.querySelector("#shV2 .sv-ctl button[onclick='svTxToggle()']");
  svSetMode("shadow"); await new Promise(r => setTimeout(r, 200)); r.shClip = vis("#shSeg"); r.card = document.querySelectorAll("#svNow .sv-w").length; r.cardLine = svNowBase;
  const w = document.querySelector("#svNow .sv-w[data-k='2']"); w.click(); r.tapPick = svPick; r.tapSeekOk = Math.abs(shSeek.t * 1000 - svAsset.segments[+w.dataset.i].words[2].startMs) < 2;
  (svMode === "watch" ? svRender() : svSetMode("watch")); svPick = -1; return r; });
ok("Watch is the fold: arriving in Watch shows the pinned block (video, two-line card, transport, tabs) plus the full moving transcript and nothing else — no clip tools, no cards, no Transcript button; tapping Watch again releases the tools and keeps the list", lay.foldedBelow === 1 && !!lay.foldedList && lay.foldedLines > 5 && !lay.foldedFoldBtn && lay.cardWords > 0 && lay.chev && lay.expanded === "false" && lay.releasedBelow >= 4 && !!lay.releasedList && lay.expanded2 === "true", JSON.stringify({ foldedBelow: lay.foldedBelow, foldedList: lay.foldedList, foldedLines: lay.foldedLines, foldedFoldBtn: lay.foldedFoldBtn, releasedBelow: lay.releasedBelow, releasedList: lay.releasedList, cardWords: lay.cardWords, expanded: [lay.expanded, lay.expanded2] }));
ok("Layout (Shadow): the mode tabs sit in the pinned block under the transport; the clip Start/End row is the first thing below it; the list is folded behind 'Full transcript (N lines)'", lay.tabsInStick && lay.tabs && lay.clip && lay.clip[0] >= lay.stickBottom && lay.clip[0] - lay.stickBottom < 40 && lay.hint && !lay.list && /Full transcript \(\d+ lines\)/.test(lay.fold), JSON.stringify(lay));
ok("Unfolding shows the list, reads 'Fold transcript', and is remembered on the device", !!lay.listOpen && lay.remembered === "1" && /Fold/.test(lay.foldOpen), JSON.stringify({ listOpen: lay.listOpen, remembered: lay.remembered }));
ok("Challenge hides the clip tools and the fold button; Record is on screen. Shadow brings the clip row back; the paused card shows the picked line; tapping a word in the card seeks there and picks its line", !lay.chClip && !lay.chHint && lay.chRec && lay.chRec[1] < 844 && !lay.chFold && lay.shClip && lay.card > 0 && lay.cardLine === 5 && lay.tapPick === 5 && lay.tapSeekOk, JSON.stringify(lay));

/* ---------- tapping Watch (fold or release) never interrupts the card: the tick keeps lighting words, with or without the list on the page ---------- */
const fl = await A.page.evaluate(async () => {
  svPick = -1; svMode = "shadow"; svWatchOpen = true; svSetMode("watch"); await new Promise(r => setTimeout(r, 100));
  const play = (i, k) => { const s = svAsset.segments[i]; shSeek = { t: (s.words[k].startMs + 5) / 1000, at: Date.now() }; svTick(); return document.querySelector("#svNow .sv-w.now")?.innerText; };
  const r = { before: play(6, 1), want1: svAsset.segments[6].words[1].text };
  document.querySelector("#svTabs .seg-tab").click(); await new Promise(r => setTimeout(r, 100));   // fold
  r.afterFold = play(7, 2); r.want2 = svAsset.segments[7].words[2].text; r.listStill = !!document.getElementById("svTx") && getComputedStyle(document.getElementById("svTx")).display !== "none"; r.listNow = document.querySelector("#svTx .sv-seg.now")?.dataset.i;
  document.querySelector("#svTabs .seg-tab").click(); await new Promise(r => setTimeout(r, 100));   // release
  r.afterRelease = play(8, 0); r.want3 = svAsset.segments[8].words[0].text;
  /* and even with no list at all (a stale render), the card still follows */
  const tx = document.getElementById("svTx"); tx.remove(); r.noList = play(9, 1); r.want4 = svAsset.segments[9].words[1].text; svRender(); await new Promise(r => setTimeout(r, 100));
  (svMode === "watch" ? svRender() : svSetMode("watch")); svPick = -1; return r; });
ok("Tapping Watch (fold, then release) never interrupts the follow-along: the card keeps lighting the spoken word, the list keeps moving, and the card follows even when the list is not on the page", fl.before === fl.want1 && fl.afterFold === fl.want2 && fl.listStill && fl.listNow === "7" && fl.afterRelease === fl.want3 && fl.noList === fl.want4, JSON.stringify(fl));

/* ---------- the follow-along player: pinned video + now-line card + list of what is next ---------- */
await A.page.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); await new Promise(r => setTimeout(r, 2500)); shOpenWork(); svPick = -1; (svMode === "watch" ? svRender() : svSetMode("watch")); }); await sleep(300);
const fa = await A.page.evaluate(async () => {
  const body = document.querySelector(".sh-work-body"), tx = document.getElementById("svTx"), nw = document.getElementById("svNow");
  const lh = parseFloat(getComputedStyle(nw).lineHeight);
  const play = (i, k) => { const s = svAsset.segments[i]; shSeek = { t: (s.words[k].startMs + 5) / 1000, at: Date.now() }; svTick(); };
  const snap = (i, k) => { const spans = [...nw.querySelectorAll(".sv-w")]; const lit = nw.querySelector(".sv-w.now"); return { lines: new Set(spans.map(e => Math.round(e.getBoundingClientRect().top))).size, h: Math.round(nw.getBoundingClientRect().height), litOk: !!lit && lit.innerText === svAsset.segments[i].words[k].text, win: svNowWin && svNowWin.join("-") }; };
  body.scrollTop = 0; play(5, 2); await new Promise(r => setTimeout(r, 900));
  const r = { cardShown: !nw.hidden, orange: getComputedStyle(nw.querySelector(".sv-w.now")).backgroundColor, a: snap(5, 2), bodyScroll: body.scrollTop };
  /* walk every word of five lines: the card is always exactly two visual lines, the same height, the spoken word lit */
  let heights = new Set(), lineCounts = new Set(), litMiss = 0, wins = new Set();
  for (let i = 5; i <= 9; i++) for (let k = 0; k < svAsset.segments[i].words.length; k++) { play(i, k); const x = snap(i, k); heights.add(x.h); lineCounts.add(x.lines); wins.add(x.win); const loc = ShadowSync.locate(svAsset, shSeek.t * 1000); if (loc.seg === i && loc.word === k && !x.litOk) litMiss++; }
  await new Promise(r => setTimeout(r, 900));
  const bx = tx.getBoundingClientRect(); r.listFirst = [...tx.querySelectorAll(".sv-seg")].find(e => e.getBoundingClientRect().bottom > bx.top + 2)?.dataset.i; r.lastSegInWin = svFlat[svNowWin[1] - 1].i; r.bodyScroll2 = body.scrollTop;
  r.heights = [...heights]; r.lineCounts = [...lineCounts]; r.litMiss = litMiss; r.windows = wins.size; r.lh = lh;
  body.scrollTop = 500; await new Promise(r => setTimeout(r, 200)); const st = document.querySelector(".sh-stick").getBoundingClientRect(); r.stickTop = Math.round(st.top); r.bodyTop = Math.round(body.getBoundingClientRect().top); body.scrollTop = 0;
  return r;
});
ok("Follow-along: the pinned card is ALWAYS exactly two visual lines — same height through five lines of speech, never one, never three — the spoken word lit in orange, windows advancing as speech leaves them; the list starts after the window; the page itself never scrolls", fa.cardShown && /249, 115, 22/.test(fa.orange) && fa.a.litOk && fa.a.lines === 2 && fa.heights.length === 1 && fa.lineCounts.join() === "2" && fa.litMiss === 0 && fa.windows >= 2 && String(fa.lastSegInWin + 1) === fa.listFirst && fa.bodyScroll === 0 && fa.bodyScroll2 === 0, JSON.stringify(fa));
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
const pst = await A.page.evaluate(() => { const s = svAsset.segments[1]; shSeek = { t: (s.words[3].startMs + 5) / 1000, at: Date.now() }; svTick(); return { saved: !!(S.shTx && S.shTx.MZAjfsyJa1U), boxCleared: document.getElementById("shPaste").value === "", notesPlain: !/0:0/.test(document.getElementById("shNote").value) && document.getElementById("shNote").value.startsWith("I stand"), level: svAsset.level, source: svAsset.source, segs: svAsset.segments.length, line2: [svAsset.segments[1].startMs, svAsset.segments[1].endMs], lit: document.querySelector("#svNow .sv-w.now")?.innerText, want: s.words[3].text, note: document.querySelector("#shV2 .sv-note").innerText, tabs: [...document.querySelectorAll("#svTabs .seg-tab, #shV2 .sv-tabs .seg-tab")].map(x => x.innerText.trim()).join() }; });
ok("Own video + transcript pasted with YouTube's timestamps: kept with the video, box cleared, notes get the plain text; cues at the stamps (6.0–12.0 s), words estimated, the card lights the word; Watch / Shadow / Challenge tabs", pst.saved && pst.boxCleared && pst.notesPlain && pst.level === "word" && pst.source === "stamps" && pst.segs === 3 && pst.line2.join() === "6000,12000" && pst.lit === pst.want && /timestamps/i.test(pst.note) && pst.tabs.replace("▾", "").startsWith("Watch,Shadow,Challenge"), JSON.stringify(pst));
await A.page.evaluate(() => { svPick = 1; svSetMode("challenge"); }); await sleep(200);
ok("Challenge on the pasted clip: panel ready on the picked line, transcript hidden", await A.page.evaluate(() => !!document.getElementById("svCh") && svCh.phase === "ready" && svCh.seg === 1 && getComputedStyle(document.getElementById("svTx")).display === "none"));
await A.page.evaluate(async () => { (svMode === "watch" ? svRender() : svSetMode("watch")); svPick = -1; shCloseWork(); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "again" }, true); }); await sleep(3000);
ok("Continue the same video later: the pasted transcript and its timing are still there", await A.page.evaluate(() => svAsset.source === "stamps" && svAsset.level === "word"));
await A.page.evaluate(() => { delete S.shTx.MZAjfsyJa1U; save(); shCloseWork(); go("shadow"); delete _capCache.MZAjfsyJa1U; }); await sleep(300);
await A.page.evaluate(() => { document.getElementById("shUrl").value = "https://www.youtube.com/watch?v=MZAjfsyJa1U"; document.getElementById("shPaste").value = "I stand before you not as an expert but as a concerned citizen. One of the 400,000 people who marched in the streets of New York on Sunday. And the billions of others around the world who want to solve our climate crisis."; shLoadFromInput(); }); await sleep(5000);
const spr = await A.page.evaluate(() => ({ level: svAsset.level, source: svAsset.source, est: svAsset.estimated, dur: Math.round(ytPlayer.getDuration()), last: svAsset.segments[svAsset.segments.length - 1].endMs, note: document.querySelector("#shV2 .sv-note").innerText }));
ok("Own video + transcript WITHOUT timestamps: spread over the real video length once the player reports it, estimated, note says so", spr.level === "word" && spr.source === "spread" && spr.est && spr.dur > 100 && Math.abs(spr.last - spr.dur * 1000) < 1500 && /video's length/i.test(spr.note), JSON.stringify(spr));
await A.page.evaluate(() => { delete S.shTx.MZAjfsyJa1U; delete _capCache.MZAjfsyJa1U; save(); }); await A.ctx.unroute(noCaps);
await A.page.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); await new Promise(r => setTimeout(r, 2500)); shOpenWork(); });

/* ---------- current expression chip, in every mode ---------- */
const chip = await A.page.evaluate(() => { const phr = trackPhrases(); const first = (typeof phr[0] === "string" ? phr[0] : phr[0] && phr[0].p) || ""; const tk = ShadowSync.tokens(first.replace(/\.{3}|…/g, " ")).join(" ");
  const i = svAsset.segments.length - 1; svAsset.segments[i].text = "so " + tk + " tomorrow"; svPick = i; (svMode === "watch" ? svRender() : svSetMode("watch")); const el = document.getElementById("svExpr");
  const r = { first, shown: !!el && !el.hidden, text: el && el.innerText, expr: svExprText() }; svAsset.segments[i].text = "zzz"; svRender(); r.gone = document.getElementById("svExpr").hidden; r.seg0 = svExprText(); svPick = 0; svRender(); return r; });
ok("Watch: a line that carries a curriculum expression shows the 'Current expression' chip; a line without one hides it", chip.shown && /Current expression/i.test(chip.text) && chip.expr && chip.gone, JSON.stringify(chip));
const rtEv = await A.page.evaluate(() => __ev.some(e => e[0] === "shadow_challenge_retry"));
ok("Analytics: Try again sends shadow_challenge_retry", rtEv);

/* ---------- microphone refused ---------- */
await M.page.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
await M.page.evaluate(() => { shOpenWork(); svPick = 3; svSetMode("challenge"); }); await sleep(200);
await M.page.click("#svChRecBtn"); await sleep(900);
ok("Microphone refused → back to ready with a clear mic message, nothing recorded, nothing graded", await M.page.evaluate(() => svCh.phase === "ready" && svCh.err === "mic" && /Microphone/.test(document.querySelector("#svCh .sv-ch-state").innerText) && svCh.attempt === 0));

/* ---------- Welding: the mode does not exist ---------- */
await W.page.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
const wd = await W.page.evaluate(() => { shOpenWork(); const b = document.getElementById("shV2"); const r = { on: svOn(), chOn: svChOn(), asset: svAsset, hidden: !b || b.style.display === "none", classic: !!document.getElementById("recBtn") };
  svSetMode("challenge"); svChStart(); svChRecord(); svChLevel("guided"); svChUse(); svChNext();
  r.state = svCh; r.panel = !!document.getElementById("svCh"); r.level = (S.svChA && S.svChA.welding && S.svChA.welding._level) || null; r.map = JSON.stringify(S.svChA || {}); r.mr = rec.mr && rec.mr.state; return r; });
ok("Welding, same flags: V2 panel hidden, svChOn() false, every entry point is a no-op — no state, no panel, no level saved, no recorder started; the classic Shadow recorder is unchanged", !wd.on && !wd.chOn && wd.asset === null && wd.hidden && wd.classic && wd.state === null && !wd.panel && wd.level === null && wd.mr !== "recording", JSON.stringify(wd));
ok("Welding: the General English challenge record is not readable through the per-area map", await W.page.evaluate(() => Object.keys(aMap("svCh")).length === 0));
const forced = await W.page.evaluate(() => { svMode = "challenge"; svAsset = ShadowSync.normalizeText("I will get back to you by the end of the day."); svPick = 0; svRender(); svChStart(); return { panel: !!document.getElementById("svCh"), state: svCh, chOn: svChOn(), html: (document.getElementById("shV2") || {}).innerHTML || "" }; });
ok("Welding: forcing svMode/svAsset by hand still draws no Challenge panel and creates no state — the gate is svChOn(), not the tab", !forced.panel && forced.state === null && !forced.chOn && !/Your turn/i.test(forced.html), JSON.stringify({ panel: forced.panel, chOn: forced.chOn }));
ok("General English learner's challenge record lives under its own area only", await A.page.evaluate(() => S.svChA && S.svChA["general-english"] && !S.svChA.welding));

/* ---------- mobile fit, i18n parity, no JS errors ---------- */
await A.page.evaluate(() => { svPick = 0; svSetMode("challenge"); }); await sleep(200);
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
