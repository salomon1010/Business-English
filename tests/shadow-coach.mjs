/* The post-shadow COACH REPORT — browser end-to-end on a phone viewport.
   Run:  cd tests && node shadow-coach.mjs          (no Worker needed)
         BASE=http://localhost:8011 node shadow-coach.mjs

   What it asserts: after a take, the first screen answers four questions
   (how did I do, what went well, the ONE word to fix, what next), the
   detailed analysis is intact one fold away, the micro-practice grades a
   real recording through the same engine the Challenge drills use, "Shadow
   again" restarts the clip with the microphone open, the vocabulary is three
   rows by default, history is written, and nothing from one area leaks into
   the other. The Polish Worker is answered by a route in this file, so the
   pronunciation pass is a fixture: mode "ai", mode "whisper" or a 502, per
   check. Chromium's fake microphone drives the real MediaRecorder path.

   The speech recogniser (the live transcript beside the take) is not
   available in headless Chromium, so the report is invoked the way shFBDone
   invokes it — fbShowResults(target, heard, "new") with fbCtx set — after a
   real take has been filed, which is exactly what the Challenge suite does. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = new URL("..", import.meta.url).pathname;
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8794"], { cwd: ROOT, stdio: "ignore" }); await sleep(700); BASE = "http://localhost:8794"; }
const SHOT = process.env.SHOT || "";                 // a folder: write screenshots of the report there
if (SHOT) mkdirSync(SHOT, { recursive: true });
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const FLAGS = { shadow_studio_v2_enabled: true, shadow_apply_phrase_enabled: true, shadow_challenge_enabled: true };
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const CLIP = "MZAjfsyJa1U";

/* the fake Worker: what the current check wants the audio model to have said */
let heard = "", assessMode = "ai", assessScores = {}, assessDefault = 92, polishMode = "ok";   // ok | abort | 500
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
async function learner(id, track) {
  /* against the live site the service worker would answer the Worker fetches the route below is meant to fake — block it there */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"], serviceWorkers: /^https:/.test(BASE) ? "block" : "allow" });
  await ctx.addInitScript(({ track, FLAGS }) => {
    /* Headless Chromium has no working speech recogniser. This stand-in returns
       window.__srText once per instance, as one final result, the shape
       srText() reads — so shRec() → shFBDone() and a Welding line's
       shLineRecord() run their real paths. */
    class FakeSR { constructor() { this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.onresult = null; this.onend = null; this.onerror = null; this._done = false; this._t = null; }
      start() { const me = this; this._t = setTimeout(() => { const txt = window.__srText || ""; if (txt && !me._done) { me._done = true; const alt = { transcript: txt, confidence: 0.9 }; const r = { 0: alt, length: 1, isFinal: true, [Symbol.iterator]: function* () { yield alt; } }; const results = { 0: r, length: 1, [Symbol.iterator]: function* () { yield r; } }; me.onresult && me.onresult({ results, resultIndex: 0 }); } }, 250); }
      stop() { clearTimeout(this._t); const me = this; setTimeout(() => me.onend && me.onend(), 60); }
      abort() { this.stop(); } }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
    localStorage.setItem("be_flags", JSON.stringify(FLAGS));
    localStorage.setItem("be_events_api", "");          // no beacon leaves the test; track() is captured after load
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name: "Test", role: "", goal: "Speak with confidence in meetings", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      localStorage.setItem("be12_v1", JSON.stringify(st)); sessionStorage.setItem("be_view", "#shadow");
    }
  }, { track, FLAGS });
  await ctx.route(u => u.href.startsWith(POLISH), async route => {
    if (polishMode === "abort") return route.abort("failed");
    if (polishMode === "500") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    const req = route.request(); const ct = req.headers()["content-type"] || "";
    let body = {};
    if (ct.includes("json")) { try { body = JSON.parse(req.postData() || "{}"); } catch (e) {} }
    if (body.captions) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: "no_captions" }) });
    if (body.chat) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "…" }) });
    if (body.assess) {
      if (assessMode === "502") return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "assess_unavailable" }) });
      const words = String(body.assess).toLowerCase().replace(/[^a-z' ]/g, "").split(/\s+/).filter(Boolean)
        .map(w => { const s = assessScores[w] != null ? assessScores[w] : assessDefault; return { word: w, score: s, note: s < 80 ? "stress the first syllable" : "" }; });
      const overall = Math.round(words.reduce((a, w) => a + w.score, 0) / Math.max(1, words.length));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall, words, mode: assessMode === "whisper" ? "whisper" : "ai" }) });
    }
    /* audio blob → Whisper-shaped answer built from `heard` */
    const ws = heard.split(/\s+/).filter(Boolean).map((w, i) => ({ w, start: i * 0.3, end: i * 0.3 + 0.25 }));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: heard, words: ws }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?coach=" + Date.now() + "#shadow", { waitUntil: "load" });
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); window.__ev = []; window.track = (n, p) => { window.__ev.push({ n, p: p || null }); }; });
  return { ctx, page, id };
}
const txt = (page, sel) => page.evaluate(s => (document.querySelector(s)?.innerText || "").replace(/\s+/g, " ").trim(), sel);
const has = (page, sel) => page.evaluate(s => !!document.querySelector(s), sel);
const count = (page, sel) => page.evaluate(s => document.querySelectorAll(s).length, sel);
const events = page => page.evaluate(() => window.__ev.map(e => e.n));
const recording = page => page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 }).then(() => true, () => false);
/* file a real take under the clip's context (what the studio's Record button does, minus the recogniser) */
async function take(page) {
  await page.evaluate(() => recToggle(shRecCtx(shClip.vid), "Shadow — test"));
  if (!await recording(page)) return false;
  await sleep(1600);
  await page.evaluate(() => recToggle(shRecCtx(shClip.vid), "Shadow — test"));
  await page.evaluate(() => recFiled);
  return true;
}
/* the report, the way shFBDone draws it */
const report = (page, target, spoken, how = "new") => page.evaluate(([target, spoken, how]) => { fbCtx = { vid: shClip.vid, recCtx: shRecCtx(shClip.vid) }; fbT0 = Date.now() - 6000; fbShowResults(target, spoken, how); }, [target, spoken, how]).then(() => sleep(120));
const pronDone = page => page.waitForFunction(() => { const c = document.querySelector("#fbSumPron"); return c && !c.classList.contains("pend") || (c && c.querySelector("b").textContent !== t("sv.ch_st_pending")); }, null, { timeout: 8000 }).then(() => true, () => false);

const A = await learner("alice", "general-english");
const W = await learner("wendy", "welding");

/* ---------- the clip, Shadow mode ---------- */
await A.page.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
await A.page.evaluate(() => shOpenWork()); await sleep(300);
await A.page.evaluate(() => { svPick = 5; svSetMode("shadow"); }); await sleep(200);
/* the fold: the top of whichever bottom bar this workspace shows (the V3 dock or the V2 sticky bar), else the viewport bottom */
await A.page.evaluate(() => { window.__fold = () => { for (const id of ["shv3Bar", "svShBar"]) { const el = document.getElementById(id); if (el) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.bottom > innerHeight - 200) return { id, top: r.top }; } } return { id: "viewport", top: innerHeight }; }; });
const bar0 = await A.page.evaluate(() => ({ mode: svMode, fold: window.__fold() }));
ok("General English: the clip opens in Shadow mode with a bottom bar on screen", bar0.mode === "shadow" && bar0.fold.id !== "viewport" && bar0.fold.top > 600, JSON.stringify(bar0));

/* ---------- 1. a completed shadow session (medium score, one clear focus) ---------- */
const TARGET = "So I applied to one job and I applied to probably around ninety";
const HEARD  = "So I applied to one job and I applied to probable around ninety";
heard = HEARD; assessMode = "ai"; assessScores = { probably: 58 }; assessDefault = 92;
ok("A take is filed under the clip's track-scoped context", await take(A.page));
await report(A.page, TARGET, HEARD);
const L1 = await A.page.evaluate(() => {
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const folds = qa("#fbOut details.fb-sec");
  return { score: q(".fbc-score")?.textContent, verdict: q(".fbc-verdict")?.textContent.trim(), done: q(".fbc-eyebrow")?.textContent.trim(),
    good: qa(".fbc-good li").map(x => x.innerText.trim()), goodNone: !!q(".fbc-none"),
    focusN: qa(".fbc-focus").length, focusEmpty: !!q(".fbc-focus.empty"), focusW: q(".fbc-focus-w")?.textContent.trim(), focusWhy: q(".fbc-focus-why")?.innerText.trim(), stress: q(".fbc-stress b")?.textContent,
    primaryN: qa(".fbc-next .btn-primary").length, primary: q(".fbc-next .btn-primary")?.innerText.trim(), secondary: qa(".fbc-next-row .btn").map(b => b.innerText.trim()),
    folds: folds.map(d => d.dataset.kind), open: folds.filter(d => d.open).length,
    sum: qa(".fbc-sum-c").map(c => c.querySelector("small").textContent + "=" + c.querySelector("b").textContent),
    vocRows: qa(".fbc-voc .voc-row").length, dupIds: (() => { const ids = qa("#fbOut [id]").map(e => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); })() };
});
ok("Level 1: score, an evidence-based verdict and 'Shadow complete' lead the report", /^\d+%$/.test(L1.score || "") && L1.verdict.length > 10 && /Shadow complete/i.test(L1.done), JSON.stringify(L1));
ok("Level 1: two or three strengths, each a fact from the take", L1.good.length >= 2 && L1.good.length <= 3 && L1.good.some(x => /clear pronunciation|landed/i.test(x)), JSON.stringify(L1.good));
ok("Level 1: exactly ONE focus word — 'probably', heard as 'probable', with its stress pattern", L1.focusN === 1 && !L1.focusEmpty && L1.focusW === "probably" && /probable/.test(L1.focusWhy) && L1.stress === "PROBably", JSON.stringify([L1.focusW, L1.focusWhy, L1.stress]));
ok("Level 1: one primary action (Shadow again) and two quiet ones (vocabulary, details)", L1.primaryN === 1 && /Shadow again/i.test(L1.primary) && L1.secondary.length === 2, JSON.stringify([L1.primary, L1.secondary]));
ok("Level 3: every detail fold is present and closed — pronunciation, word by word, full practice, vocabulary, history, grammar", L1.open === 0 && ["pron", "words", "practice", "vocab", "history"].every(k => L1.folds.includes(k)), JSON.stringify(L1.folds));
ok("Summary strip: words %, pronunciation (pending), pace in wpm and fillers — nothing invented", L1.sum.length === 4 && /=\d+%$/.test(L1.sum[0]) && /Listening|^Pronunciation=\d+%$/.test(L1.sum[1]) && /wpm$/.test(L1.sum[2]) && /=\d+$/.test(L1.sum[3]), JSON.stringify(L1.sum));
ok("Vocabulary is secondary: three rows on the first level, the rest one fold away, no duplicated row ids", L1.vocRows === 3 && L1.dupIds.length === 0, JSON.stringify([L1.vocRows, L1.dupIds]));
ok("The dense analysis is intact behind the folds: word chips, ranked practice cards with save chips, pace/fillers stats", await A.page.evaluate(() => {
  const f = k => document.querySelector(`#fbOut .fb-sec[data-kind="${k}"] .home-more-body`);
  return f("words").querySelectorAll(".fb-chip").length > 8 && f("practice").querySelectorAll(".fb-item").length >= 1 && !!f("practice").querySelector(".voc-pick") && f("history").querySelectorAll(".stat").length === 3;
}));
ok("Analytics: the report reports itself once, with the band and the source, nothing else", await A.page.evaluate(() => { const v = window.__ev.filter(e => e.n === "shadow_report_viewed"); const sc = parseInt(document.querySelector(".fbc-score").textContent); return v.length === 1 && v[0].p.band === (sc >= 80 ? "good" : sc >= 55 ? "fair" : "poor") && v[0].p.source === "new"; }));
ok("The pronunciation pass lands in the summary as a real percentage when an audio model listened (mode ai)", await pronDone(A.page) && await A.page.evaluate(() => { const b = document.querySelector("#fbSumPron b"); return /^\d+%$/.test(b.textContent) && !!document.querySelector('#fbOut .fb-sec[data-kind="pron"] .fb-pron .fb-pw'); }), await txt(A.page, "#fbSumPron"));
if (SHOT) { await A.page.evaluate(() => svChReveal(document.getElementById("fbOut"))); await sleep(600); await A.page.screenshot({ path: SHOT + "/report-dark.png" }); await A.page.screenshot({ path: SHOT + "/report-dark-full.png", fullPage: false }); }

/* ---------- mobile: the first screen holds result, strengths, the focus and the primary action ---------- */
const view = await A.page.evaluate(() => {
  const body = document.querySelector(".sh-work-body"), out = document.getElementById("fbOut");
  svChReveal(out);
  return new Promise(r => setTimeout(() => {
    const top = out.querySelector(".fbc").getBoundingClientRect().top, cta = out.querySelector(".fbc-next .btn-primary").getBoundingClientRect();
    const pinB = document.querySelector(".sh-stick").getBoundingClientRect().bottom;
    const bar = window.__fold(), fold = bar.top;
    r({ pinB: Math.round(pinB), top: Math.round(top), ctaBottom: Math.round(cta.bottom), vh: innerHeight, fold: Math.round(fold), barId: bar.id, overflowX: body.scrollWidth > body.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1,
      scoreVisible: out.querySelector(".fbc-score").getBoundingClientRect().bottom <= fold, goodVisible: out.querySelector(".fbc-good").getBoundingClientRect().bottom <= fold,
      focusVisible: out.querySelector(".fbc-focus .fbc-cta").getBoundingClientRect().bottom <= fold, nextH: Math.round(out.querySelector(".fbc-next").getBoundingClientRect().height) });
  }, 700));
});
ok("Mobile: under the 273px pinned player the first screen holds the result, the strengths, the focus with 'Practise it' AND 'Shadow again' above the bottom bar; no horizontal overflow (390×844)", view.scoreVisible && view.goodVisible && view.focusVisible && view.ctaBottom <= view.fold && !view.overflowX, JSON.stringify(view));
/* the same first screen in the four translated languages (the other eleven fall back to English) */
for (const code of ["fr", "es", "pt", "ar"]) {
  const v = await A.page.evaluate(async (code) => {
    DICT = await (await fetch("i18n/" + code + ".json")).json(); applyDirLang(code);
    fbCtx = { vid: shClip.vid, recCtx: shRecCtx(shClip.vid) }; fbT0 = Date.now() - 6000;
    fbShowResults("So I applied to one job and I applied to probably around ninety", "So I applied to one job and I applied to probable around ninety", "new");
    const out = document.getElementById("fbOut"); svChReveal(out);
    return new Promise(r => setTimeout(() => {
      const cta = out.querySelector(".fbc-next .btn-primary").getBoundingClientRect(), bar = window.__fold();
      const body = document.querySelector(".sh-work-body");
      r({ code, ctaBottom: Math.round(cta.bottom), fold: Math.round(bar.top), barId: bar.id, verdictH: Math.round(out.querySelector(".fbc-verdict").getBoundingClientRect().height), focusVisible: out.querySelector(".fbc-focus .fbc-cta").getBoundingClientRect().bottom <= bar.top, overflowX: body.scrollWidth > body.clientWidth + 1, dir: document.documentElement.dir || "ltr", verdict: out.querySelector(".fbc-verdict").textContent });
    }, 600));
  }, code);
  ok(`Mobile · ${code}${v.dir === "rtl" ? " (RTL)" : ""}: 'Shadow again' sits above the bottom bar, one-line verdict, no horizontal overflow`, v.ctaBottom <= v.fold && v.verdictH <= 24 && v.focusVisible && !v.overflowX, JSON.stringify(v));
  if (SHOT && (code === "fr" || code === "ar")) await A.page.screenshot({ path: SHOT + "/report-" + code + ".png" });
}
await A.page.evaluate(() => { DICT = {}; applyDirLang("en"); });
await report(A.page, TARGET, HEARD); await pronDone(A.page);

/* ---------- the real path: the studio's own Record button → transcript → report ---------- */
const real = await A.page.evaluate(async () => {
  const para = document.getElementById("shNote").value.trim();
  const word = para.replace(/[^A-Za-z' ]/g, " ").split(/\s+/).filter(w => w.length >= 6)[0];
  window.__srText = para.replace(word, word.slice(0, -2));
  document.getElementById("fbOut").innerHTML = "";
  shRec(); await new Promise(r => setTimeout(r, 1700)); shRec();
  for (let i = 0; i < 40 && !document.querySelector("#fbOut .fbc"); i++) await new Promise(r => setTimeout(r, 150));
  return { word: word.toLowerCase(), drawn: !!document.querySelector("#fbOut .fbc"), heard: (document.getElementById("shHeardBox").innerText || "").slice(0, 30), fold: document.getElementById("fbFold") ? !document.getElementById("fbFold").hidden : null, focus: document.querySelector(".fbc-focus-w")?.textContent };
});
ok("Record → stop in the studio: the transcript lands, the coach report is drawn against the paragraph, its clipped word is the focus, the fold chevron appears", real.drawn && real.heard.length > 10 && real.fold !== false && real.focus === real.word, JSON.stringify(real));

/* ---------- expandable sections ---------- */
const fold = await A.page.evaluate(async () => {
  const btn = document.querySelector(".fbc-next-row .btn:last-child"); btn.click();
  await new Promise(r => setTimeout(r, 200));
  const first = document.querySelector("#fbOut details.fb-sec");
  const d = document.querySelector('#fbOut details.fb-sec[data-kind="words"]'); d.open = true; await new Promise(r => setTimeout(r, 50)); d.open = false; await new Promise(r => setTimeout(r, 50)); d.open = true; await new Promise(r => setTimeout(r, 50));
  const ev = window.__ev.filter(e => e.n === "shadow_details_opened");
  return { firstOpen: first.open, kinds: ev.map(e => e.p.kind) };
});
ok("'See detailed feedback' opens the first fold; each fold counts once however often it is toggled", fold.firstOpen && fold.kinds.filter(k => k === "words").length === 1 && fold.kinds.includes(fold.kinds[0]), JSON.stringify(fold));

/* ---------- vocabulary ---------- */
const voc = await A.page.evaluate(async () => {
  const words = [...document.querySelectorAll(".fbc-voc .voc-row .wd")].map(x => x.textContent.trim());
  document.querySelector(".fbc-voc-acts .btn").click(); await new Promise(r => setTimeout(r, 100));
  return { words, saved: words.every(w => vocHas(w)), ev: window.__ev.filter(e => e.n === "shadow_vocab_saved").map(e => e.p.kind), more: document.querySelector(".fbc-more")?.innerText.trim() };
});
ok("Vocabulary: 'Save all' puts the three words into the area's vocabulary and counts once; the rest sit behind 'See N more'", voc.words.length === 3 && voc.saved && voc.ev.length === 1 && voc.ev[0] === "all" && /See \d+ more/.test(voc.more || ""), JSON.stringify(voc));

/* ---------- history ---------- */
ok("History: the take joins the studio's History as a Shadow entry with score and the words to fix", await A.page.evaluate(() => { const e = aList("chHist")[0]; return e && e.kind === "shadow" && typeof e.score === "number" && Array.isArray(e.fix) && e.fix.length > 0; }));

/* ---------- 2. the micro-practice on the focus word ---------- */
heard = HEARD; assessScores = { probably: 58 }; assessDefault = 92;
await report(A.page, TARGET, HEARD); await pronDone(A.page);
heard = "probably"; assessScores = { probably: 91 };
const mp1 = await A.page.evaluate(async () => {
  const tbBefore = troubleMap()[document.querySelector(".fbc-focus-w").textContent] || 0;
  document.querySelector(".fbc-focus .fbc-cta").click(); await new Promise(r => setTimeout(r, 150));
  const fix = document.getElementById("fbFix");
  return { open: !!fix, steps: [...(fix?.querySelectorAll(".fbc-step-b > small") || [])].map(s => s.textContent.trim()), listen: fix?.querySelectorAll(".fbc-step:first-child .sv-ch-play").length, ctaHidden: document.querySelector(".fbc-focus .fbc-cta").hidden && getComputedStyle(document.querySelector(".fbc-focus .fbc-cta")).display === "none", tbBefore, ev: window.__ev.filter(e => e.n === "shadow_focus_practiced").length };
});
ok("'Practise it' opens the micro-practice in place: Listen (example, slow, you) → Say it; the button steps aside", mp1.open && mp1.steps[0] === "Listen" && mp1.steps[1] === "Say it" && mp1.listen === 3 && mp1.ctaHidden && mp1.ev === 1, JSON.stringify(mp1));
await A.page.click("#fbFixRecBtn");
ok("Say it: the round button opens the microphone (a real take, filed under a track-scoped 'shadow-fix' context)", await recording(A.page) && await A.page.evaluate(() => /^shadow-fix-/.test(rec.ctx) && document.getElementById("fbFixRecBtn").classList.contains("on")));
await sleep(1600); await A.page.click("#fbFixRecBtn");
const graded = await A.page.waitForFunction(() => fbFix && fbFix.attempts.length === 1 && fbFix.phase === "ready", null, { timeout: 12000 }).then(() => true, () => false);
const mp2 = await A.page.evaluate(() => ({ att: fbFix.attempts.map(a => a.state + ":" + a.mode + ":" + a.score), improved: fbFix.improved, better: !!document.querySelector(".fbc-better"), fixed: document.querySelector(".fbc-focus").classList.contains("fixed"),
  compare: document.querySelectorAll(".fbc-fix-att .sv-ch-hist-a").length, again: !!document.querySelector(".fbc-fix-acts .btn-primary"), tb: troubleMap()[fbFix.word] || 0, word: fbFix.word, ev: window.__ev.filter(e => e.n === "shadow_micro_completed").map(e => e.p.result) }));
ok("Compare: the attempt is graded by the same drill engine (ShadowSync.drillState, mode ai) and a clear attempt reads 'Better'", graded && mp2.word === "probably" && mp2.att[0] === "strong:ai:91" && mp2.improved && mp2.better && mp2.fixed && mp2.compare === 1 && mp2.ev[0] === "pass", JSON.stringify(mp2));
ok("An improved word comes off the trouble list and 'Shadow again' is offered right there", mp2.tb === mp1.tbBefore - 1 && mp2.again, JSON.stringify([mp1.tbBefore, mp2.tb]));
/* a second attempt while the Worker is unreachable: saved, honest, no crash */
polishMode = "abort";
await A.page.click("#fbFixRecBtn"); await recording(A.page); await sleep(1600); await A.page.click("#fbFixRecBtn");
const gradedErr = await A.page.waitForFunction(() => fbFix && fbFix.phase === "ready" && !!fbFix.err, null, { timeout: 12000 }).then(() => true, () => false);
ok("Worker unreachable during a micro-practice: the take is kept, the state line says the coach did not answer (not 'too short'), nothing breaks", gradedErr && await A.page.evaluate(() => fbFix.attempts.length === 1 && (fbFix.err === "ai" || fbFix.err === "net") && document.querySelector(".sv-ch-state.err")?.textContent.length > 10), await A.page.evaluate(() => fbFix && fbFix.err));
polishMode = "ok";
if (SHOT) { await A.page.evaluate(() => svChReveal(document.querySelector(".fbc-focus"))); await sleep(500); await A.page.screenshot({ path: SHOT + "/micro-practice.png" }); }
ok("Back to the report: the panel closes and the focus button returns as 'Practise it again'", await A.page.evaluate(async () => { document.querySelector(".fbc-fix-acts .btn:last-child").click(); await new Promise(r => setTimeout(r, 100)); const c = document.querySelector(".fbc-focus .fbc-cta"); return !document.getElementById("fbFix") && !c.hidden && /again/i.test(c.textContent); }));

/* ---------- 3. Shadow again ---------- */
const again = await A.page.evaluate(async () => {
  const body = document.querySelector(".sh-work-body"); body.scrollTop = 400;
  document.querySelector(".fbc-next .btn-primary").click();
  await new Promise(r => setTimeout(r, 900));
  return { rec: !!(rec.mr && rec.mr.state === "recording"), ctx: rec.ctx, barOn: document.getElementById("svShRec").classList.contains("on"), top: body.scrollTop, ev: window.__ev.filter(e => e.n === "shadow_again_clicked").length };
});
ok("'Shadow again' restarts the clip from the top, opens the microphone under the clip's own context and lights the bar", again.rec && again.ctx === await A.page.evaluate(() => shRecCtx(shClip.vid)) && again.barOn && again.top < 60 && again.ev === 1, JSON.stringify(again));
await sleep(1500); await A.page.evaluate(() => recToggle(shRecCtx(shClip.vid), "x")); await A.page.evaluate(() => recFiled); await sleep(300);

/* ---------- 4. the second take on the same clip: progress, second_completed ---------- */
heard = TARGET; assessScores = {}; assessDefault = 94;
await report(A.page, TARGET, TARGET);
const P2 = await A.page.evaluate(() => ({ score: document.querySelector(".fbc-score").textContent, prog: document.querySelector(".fbc-prog")?.innerText.replace(/\s+/g, " ").trim(), delta: document.querySelector(".fbc-prog-d")?.className, good: [...document.querySelectorAll(".fbc-good li")].map(x => x.innerText.trim()), focusEmpty: !!document.querySelector(".fbc-focus.empty"), focusTxt: document.querySelector(".fbc-focus")?.innerText.trim(), verdict: document.querySelector(".fbc-verdict").textContent, second: window.__ev.filter(e => e.n === "shadow_second_completed").length, att: (S.fbV[shClip.vid] || []).length }));
ok("High score: 100%, 'every word landed', the improvement on the previous attempt, and 'nothing to fix' instead of an invented problem", P2.score === "100%" && P2.good.some(x => /Every word landed/.test(x)) && P2.focusEmpty && /Nothing to fix/.test(P2.focusTxt) && /Nice work/.test(P2.verdict), JSON.stringify(P2));
ok("Progress: one line — this clip's attempts and '+N from your previous attempt' — and the second take is counted", /→/.test(P2.prog || "") && /up$/.test(P2.delta || "") && P2.second >= 1 && P2.att >= 2, JSON.stringify([P2.prog, P2.delta, P2.second, P2.att]));
ok("A perfect transcript can still get its focus from the listener: the AI's weak word fills the empty focus, never a random one", await (async () => {
  assessScores = { ninety: 61 }; await report(A.page, TARGET, TARGET); await pronDone(A.page); await sleep(100);
  return A.page.evaluate(() => { const f = document.querySelector(".fbc-focus"); return !f.classList.contains("empty") && document.querySelector(".fbc-focus-w").textContent === "ninety" && /unclear/.test(f.innerText) && !!f.querySelector(".fbc-cta"); });
})());

/* ---------- 5. low score: honest, no false praise ---------- */
heard = "so uh one job um around"; assessScores = {}; assessDefault = 40;
await report(A.page, TARGET, heard);
const LOW = await A.page.evaluate(() => ({ score: parseInt(document.querySelector(".fbc-score").textContent), verdict: document.querySelector(".fbc-verdict").textContent, good: [...document.querySelectorAll(".fbc-good li")].map(x => x.innerText.trim()), none: document.querySelector(".fbc-good") ? null : document.querySelector(".fbc-sec .fbc-none")?.textContent, focus: document.querySelector(".fbc-focus-w")?.textContent, lead: document.querySelector(".fbc-focus-why")?.innerText, band: window.__ev.filter(e => e.n === "shadow_report_viewed").pop().p.band }));
ok("Low score: 'Keep going' verdict, poor band, no 'every word landed', no natural-pace or no-filler claim on a take with fillers", LOW.score < 50 && /Keep going/.test(LOW.verdict) && LOW.band === "poor" && !LOW.good.some(x => /Every word|No fillers|Natural pace/.test(x)) && /start with the word/i.test(LOW.lead || ""), JSON.stringify(LOW));

/* ---------- 6. no clear pronunciation issue (only short words slipped) ---------- */
heard = "So I applied to a job and I applied to probably around ninety"; assessScores = {}; assessDefault = 92;
await report(A.page, TARGET, heard); await pronDone(A.page);
ok("Only a short word slipped: the focus says 'no clear pronunciation issue' rather than naming 'one'", await A.page.evaluate(() => document.querySelector(".fbc-focus.empty") && /No clear pronunciation issue/.test(document.querySelector(".fbc-focus").innerText)));

ok("Severity first: 'applied' heard as 'apply' (71% similar, a curriculum word) outranks 'probably' heard as 'probable' (88%)", await (async () => {
  await A.page.evaluate(() => { const tb = troubleMap(); Object.keys(tb).forEach(k => delete tb[k]); });
  await report(A.page, TARGET, "So I apply to one job and I applied to probable around ninety");
  return A.page.evaluate(() => document.querySelector(".fbc-focus-w").textContent === "applied" && [...document.querySelectorAll('#fbOut .fb-sec[data-kind="practice"] .fb-item .w')].map(x => x.textContent).includes("probably"));
})());

/* ---------- 7. multiple issues: recurrence and learning value decide, deterministically ---------- */
await A.page.evaluate(() => { const tb = troubleMap(); Object.keys(tb).forEach(k => delete tb[k]); tb.finished = 2; });
const T7 = "I probably applied to one job and I finished around ninety", H7 = "I probable apply to one job and I finish around ninety";
await report(A.page, T7, H7);
const pick1 = await A.page.evaluate(() => document.querySelector(".fbc-focus-w").textContent);
await report(A.page, T7, H7);
const pick2 = await A.page.evaluate(() => document.querySelector(".fbc-focus-w").textContent);
ok("Three near-misses: the word already on the trouble list wins ('finished'), and the pick is the same on a repeat", pick1 === "finished" && pick2 === "finished", JSON.stringify([pick1, pick2]));
ok("Full practice fold still lists every problem, ranked worst-first, so nothing was dropped", await A.page.evaluate(() => [...document.querySelectorAll('#fbOut .fb-sec[data-kind="practice"] .fb-item .w')].map(x => x.textContent).length === 3));

/* ---------- 8. insufficient confidence: whisper-mode pronunciation is not shown as a precise number ---------- */
assessMode = "whisper"; heard = H7;
await report(A.page, T7, H7); await pronDone(A.page);
const WH = await A.page.evaluate(() => ({ sum: document.querySelector("#fbSumPron b").textContent, note: document.querySelector('#fbOut .fb-sec[data-kind="pron"] .fbc-pron-note')?.textContent, head: document.querySelector('#fbOut .fb-sec[data-kind="pron"] .fb-pron-score')?.textContent }));
ok("Transcript cross-check (mode whisper): the summary shows a state marked 'approx.', the fold says listening was not available, the number is marked ~", !/^\d+%$/.test(WH.sum) && /approx/.test(WH.sum) && /not available/.test(WH.note || "") && /^~\d+%$/.test(WH.head || ""), JSON.stringify(WH));

/* ---------- 9. score unavailable (the pass fails) ---------- */
assessMode = "502";
await report(A.page, T7, H7); await pronDone(A.page);
ok("Pronunciation pass fails (502): the cell reads 'Not available' and the rest of the report is complete", await A.page.evaluate(() => document.querySelector("#fbSumPron b").textContent === "Not available" && !!document.querySelector(".fbc-score") && !!document.querySelector(".fbc-focus-w") && !!document.querySelector(".fbc-next .btn-primary")));
assessMode = "ai";

/* ---------- 10. missing transcript / recording failure ---------- */
await report(A.page, "", H7);
ok("Missing transcript: no score and no focus (nothing to score against), but pace, fillers, 'Shadow again' and the folds remain", await A.page.evaluate(() => !document.querySelector(".fbc-score") && !document.querySelector(".fbc-focus") && document.querySelectorAll(".fbc-sum-c").length === 2 && !!document.querySelector(".fbc-next .btn-primary") && !!document.querySelector('#fbOut .fb-sec[data-kind="history"]')));
await report(A.page, T7, "");
ok("Recording failure (nothing heard): the empty state and the retry, no dashboard", await A.page.evaluate(() => !!document.querySelector("#fbOut .fb-nothing") && !!document.querySelector("#fbOut .fb-again") && !document.querySelector(".fbc")));

/* ---------- 11a. Welding: a workplace line, recorded for real, gets the same coach report in its own slot ---------- */
heard = "we need to check the joint before welding"; assessMode = "ai"; assessScores = {}; assessDefault = 90;
const wl = await W.page.evaluate(async () => {
  go("shadow"); await new Promise(r => setTimeout(r, 500));
  const btn = document.querySelector(".sh-line-rec"); if (!btn) return { noLines: true };
  const id = btn.id.slice(4), line = shWorkplaceLines().find(x => x.id === id);
  /* say the line with one word wrong, so the report has a focus */
  const words = line.text.replace(/[^A-Za-z' ]/g, " ").split(/\s+/).filter(w => w.length >= 5);
  const miss = words[0] || "";
  window.__srText = line.text.replace(miss, miss.slice(0, -2));
  btn.click(); await new Promise(r => setTimeout(r, 1800)); btn.click();
  const slotOf = () => document.getElementById("shfbx-" + id);
  for (let i = 0; i < 60 && !(slotOf() && slotOf().querySelector(".fbc")); i++) await new Promise(r => setTimeout(r, 200));
  const slot = slotOf(), fbc = slot && slot.querySelector(".fbc");
  return { id, miss, drawn: !!fbc, score: fbc?.querySelector(".fbc-score")?.textContent, focus: fbc?.querySelector(".fbc-focus-w")?.textContent, primary: fbc?.querySelectorAll(".fbc-next .btn-primary").length, folds: fbc?.querySelectorAll("details.fb-sec").length, openFolds: fbc?.querySelectorAll("details.fb-sec[open]").length,
    width: Math.round(fbc?.getBoundingClientRect().width || 0), overflowX: document.documentElement.scrollWidth > innerWidth + 1, hist: S.fbHist.length, tk: S.fbHist.every(x => x.tk === "welding") };
});
ok("Welding: Record on a workplace line → the coach report is drawn in that line's slot with a score, one focus, one primary action and closed folds", !wl.noLines && wl.drawn && /^\d+%$/.test(wl.score || "") && wl.focus && wl.primary === 1 && wl.folds >= 3 && wl.openFolds === 0 && wl.width > 200 && !wl.overflowX && wl.hist === 1 && wl.tk, JSON.stringify(wl));
ok("Welding: 'Shadow again' in a line's report brings that line's Record button into focus", await W.page.evaluate(async (id) => { document.getElementById("shfbx-" + id).querySelector(".fbc-next .btn-primary").click(); await new Promise(r => setTimeout(r, 500)); return document.activeElement && document.activeElement.id === "shr-" + id; }, wl.id));
const wmp = await W.page.evaluate(async (id) => {
  const slot = document.getElementById("shfbx-" + id);
  slot.querySelector(".fbc-focus .fbc-cta").click(); await new Promise(r => setTimeout(r, 200));
  return { open: !!slot.querySelector("#fbFix"), ctx: fbFix && fbFix.ctx, recCtx: fbCtx.recCtx };
}, wl.id);
ok("Welding: the micro-practice opens inside that slot and records under the Welding-prefixed context of THAT line", wmp.open && /^welding:shadow-fix-line-/.test(wmp.ctx || "") && wmp.recCtx === "line-" + wl.id, JSON.stringify(wmp));
await W.page.click("#fbFixRecBtn"); await recording(W.page); await sleep(1600); await W.page.click("#fbFixRecBtn");
ok("Welding: the micro-practice grades the take through the same engine", await W.page.waitForFunction(() => fbFix && fbFix.attempts.length === 1 && fbFix.phase === "ready", null, { timeout: 12000 }).then(() => true, () => false) && await W.page.evaluate(() => fbFix.attempts[0].mode === "ai"));
ok("Welding: the pronunciation pass fills that slot's own summary cell", await W.page.waitForFunction((id) => { const b = document.getElementById("shfbx-" + id).querySelector("#fbSumPron b"); return b && /^\d+%$/.test(b.textContent); }, wl.id, { timeout: 10000 }).then(() => true, () => false));
if (SHOT) { await W.page.evaluate((id) => document.getElementById("shfbx-" + id).scrollIntoView({ block: "start" }), wl.id); await sleep(400); await W.page.screenshot({ path: SHOT + "/welding-line-report.png" }); }

/* ---------- 11. General English / Welding isolation ---------- */
const iso = await W.page.evaluate(async () => {
  const before = { fb: areaFbHist().length, ch: aList("chHist").length, tb: Object.keys(troubleMap()).length };
  fbCtx = { vid: "sess-welding:w1mon", recCtx: "welding:w1mon" }; fbT0 = Date.now() - 5000;
  fbShowResults("Weld the joint carefully and check the bead", "Weld the joint careful and check the bead", true);
  const weld = { fb: areaFbHist().length, ch: aList("chHist").length, tb: Object.keys(troubleMap()), stamped: S.fbHist.every(x => x.tk === "welding") };
  S.professionalTracks.activeId = "general-english";
  const ge = { fb: areaFbHist().length, ch: aList("chHist").length, tb: Object.keys(troubleMap()) };
  S.professionalTracks.activeId = "welding";
  return { before, weld, ge };
});
ok("Welding: a report on the Welding side writes Welding-stamped history and Welding trouble words only", iso.weld.fb === iso.before.fb + 1 && iso.weld.stamped && iso.weld.tb.includes("carefully"), JSON.stringify(iso));
ok("General English (same device) sees none of it: no history, no trouble words, no History entry", iso.ge.fb === 0 && iso.ge.tb.length === 0 && iso.ge.ch === 0, JSON.stringify(iso.ge));
ok("General English: every history row the report wrote carries the General English stamp", await A.page.evaluate(() => S.fbHist.length > 5 && S.fbHist.every(x => x.tk === "general-english") && aList("chHist").every(e => e.kind === "shadow" || e.kind.startsWith("ch"))));

/* ---------- 12. every event this report sends is on the Worker's allow-list ---------- */
const worker = readFileSync(ROOT + "backend/events/events-worker.js", "utf8");
const EV = new Set([...worker.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([a-z_0-9]+)"/g)].map(m => m[1]));
const PK = new Set([...worker.match(/const PROP_KEYS = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([a-z_0-9]+)"/g)].map(m => m[1]));
const sent = await A.page.evaluate(() => window.__ev);
const badN = sent.filter(e => !EV.has(e.n)).map(e => e.n), badP = sent.filter(e => e.p && Object.keys(e.p).some(k => !PK.has(k))).map(e => e.n);
ok("Analytics: every name and prop key the report sends is on the be-events allow-list (would otherwise be dropped with 204)", sent.length >= 8 && badN.length === 0 && badP.length === 0, JSON.stringify({ n: sent.length, badN, badP }));
ok("The seven report events exist on the allow-list", ["shadow_report_viewed", "shadow_focus_practiced", "shadow_micro_completed", "shadow_again_clicked", "shadow_details_opened", "shadow_vocab_saved", "shadow_second_completed"].every(n => EV.has(n)));

/* ---------- light theme screenshot ---------- */
if (SHOT) {
  heard = HEARD; assessScores = { probably: 58 }; assessDefault = 92;
  await A.page.evaluate(() => { localStorage.setItem("be_theme", "light"); applyTheme("light"); });
  await report(A.page, TARGET, HEARD); await pronDone(A.page);
  await A.page.evaluate(() => svChReveal(document.getElementById("fbOut"))); await sleep(600);
  await A.page.screenshot({ path: SHOT + "/report-light.png" });
  await A.page.evaluate(async () => { document.querySelector(".fbc-focus .fbc-cta").click(); });
  await sleep(300); await A.page.evaluate(() => svChReveal(document.querySelector(".fbc-focus"))); await sleep(400);
  await A.page.screenshot({ path: SHOT + "/micro-practice-light.png" });
  await A.page.evaluate(() => { document.querySelectorAll("#fbOut details.fb-sec").forEach(d => d.open = true); svChReveal(document.querySelector(".fbc-details")); });
  await sleep(500); await A.page.screenshot({ path: SHOT + "/details-open-light.png" });
  await A.page.evaluate(() => { localStorage.setItem("be_theme", "dark"); applyTheme("dark"); });
}

ok("No JavaScript errors on either learner's page", errors.length === 0, errors.join(" | "));

await browser.close(); if (server) server.kill();
const fails = res.filter(r => !r.pass).length;
console.log(`\n${res.length - fails}/${res.length} pass (${BASE})`);
process.exit(fails ? 1 : 0);
