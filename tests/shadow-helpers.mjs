/* Shadow Studio — the paragraph card's two helpers: Translate (the learner's
   native language, under the English) and Pronunciation (IPA under each word),
   plus the v3 Shadow button while recording and the report fold.
   Run:  cd tests && node shadow-helpers.mjs      (no Worker needed)
   The Polish Worker is answered by a route in this file: a translation is
   "Traduction [<language>] : <text>", an IPA request is answered word by word
   with "ˈ" + the word, so every value can be checked back against the request.
   Three learners: General English with French as native language, Welding
   with French (the card must not exist there), General English with English
   (Translate must explain itself rather than translate). */
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const sleep = ms => new Promise(r => setTimeout(r, ms));
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8781"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(700); BASE = "http://localhost:8781"; }
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const FLAGS = { shadow_studio_v2_enabled: true, shadow_challenge_enabled: true };
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const VID = "MZAjfsyJa1U";

/* the fake Worker */
let polishMode = "ok";                 // ok | 500 | 429 | 429once | abort
let once429 = 0;
const chat = [];                       // every chat request: {kind, lang, words, text}
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
async function learner(id, track, lang) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx.addInitScript(({ track, FLAGS, lang }) => {
    localStorage.setItem("be_flags", JSON.stringify(FLAGS)); localStorage.setItem("be_sv_txopen", "1"); localStorage.setItem("be_sv_watchopen", "1");
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name: "Test", role: "", goal: "Speak with confidence in meetings", slot: "", lang, ts: Date.now() }, professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      localStorage.setItem("be12_v1", JSON.stringify(st)); sessionStorage.setItem("be_view", "#shadow");
    }
  }, { track, FLAGS, lang });
  await ctx.route(u => u.href.startsWith(POLISH), async route => {
    if (polishMode === "abort") return route.abort("failed");
    if (polishMode === "500") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    if (polishMode === "429once" && once429++ === 0) return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "rate_limited" }) });
    if (polishMode === "429") return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "rate_limited" }) });
    const req = route.request(); const ct = req.headers()["content-type"] || "";
    let body = {};
    if (ct.includes("json")) { try { body = JSON.parse(req.postData() || "{}"); } catch (e) {} }
    if (body.captions) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: "no_captions" }) });
    if (body.tts) return route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(64) });
    if (body.chat) {
      const sys = String(body.chat.system || ""), content = String(body.chat.messages[0].content || "");
      if (/pronunciation dictionary/i.test(sys)) {
        const words = (content.match(/Words: (.*)$/m) || [, ""])[1].split(",").map(w => w.trim()).filter(Boolean);
        chat.push({ kind: "ipa", words, text: content });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: words.map(w => w + "=" + (w === "record" ? (/Sentence: "I will record/.test(content) ? "rɪˈkɔrd" : "ˈrɛkərd") : "ˈ" + w)).join("|"), covered: [] }) });
      }
      const lang = (sys.match(/into (\w+)/) || [, "?"])[1];
      chat.push({ kind: "tr", lang, text: content });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Traduction [" + lang + "] : " + content.slice(0, 40), covered: [] }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "", words: [] }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?sh=" + Date.now() + "#shadow", { waitUntil: "load" });
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
  return { ctx, page, id };
}
/* go("shadow") and shLoad() in one breath raced under a loaded machine: the
   Shadow view landed a beat later and shLoad found no player (seen in full
   runs, never alone). Wait for the player element before loading the clip. */
const openShadow = async (page, pick = 5) => {
  await page.evaluate(() => go("shadow"));
  await page.waitForSelector("#shPlayerWrap", { state: "attached", timeout: 15000 });
  await page.evaluate(async v => { await shLoad({ vid: v, start: 0, end: 0, title: "clip" }, true); }, VID); await sleep(2500);
  await page.evaluate(() => shOpenWork()); await sleep(300);
  await page.evaluate(p => { svPick = p; svSetMode("shadow"); }, pick); await sleep(200);
};
const card = page => page.evaluate(() => {
  const b = document.getElementById("svShTr"), tb = document.getElementById("svShTrBtn"), ib = document.getElementById("svShIpaBtn"), st = document.getElementById("svShIpaSt");
  const words = [...document.querySelectorAll("#svSh .sv-sh-w")];
  return { card: !!document.getElementById("svSh"), trBtn: !!tb, trOn: tb && tb.getAttribute("aria-pressed"), trNa: tb && tb.getAttribute("aria-disabled") === "true", trCode: tb && (tb.querySelector("small") || {}).innerText, trCheck: !!(tb && tb.classList.contains("on") && tb.querySelector("svg")),
    ipaBtn: !!ib, ipaOn: ib && ib.getAttribute("aria-pressed"), ipaCheck: !!(ib && ib.classList.contains("on")),
    trShown: !!(b && !b.hidden && !b.classList.contains("empty")), trCls: b && b.className, trLang: b && b.getAttribute("lang"), trDir: b && b.getAttribute("dir"), trLbl: b && (b.querySelector(".sv-sh-tr-l") || {}).textContent, trText: b && (b.querySelector(".sv-sh-tr-x") || {}).innerText, trRetry: !!(b && b.querySelector(".sv-sh-retry")),
    english: (document.querySelector("#svSh .sv-sh-text") || {}).innerText, want: svShGroup() && svShGroup().text, gid: svShGroup() && svShGroup().id,
    nWords: words.length, nIpa: document.querySelectorAll("#svSh .sv-sh-ipa").length,
    ipa: words.map(w => ({ w: w.dataset.w, t: (w.querySelector(".sv-sh-wt") || {}).innerText, ipa: (w.querySelector(".sv-sh-ipa") || {}).textContent })),
    stCls: st && st.className, stText: st && !st.hidden ? st.innerText : "", stRetry: !!(st && st.querySelector(".sv-sh-retry")),
    pref: JSON.parse(JSON.stringify(S.svPrefA || null)), seedN: Object.keys(SV_IPA_SEED).length,
    fits: (() => { const c = document.querySelector("#svSh .sv-sh-card"); return c && c.scrollWidth <= c.clientWidth + 1; })(),
    tgH: [tb, ib].filter(Boolean).map(b => Math.round(b.getBoundingClientRect().height)) };
});
const expIpa = (page, w) => page.evaluate(w => { const n = svIpaNorm(w); return n ? (SV_IPA_SEED[n] || "ˈ" + n) : ""; }, w);
const ipaRight = async (page, c) => { for (const x of c.ipa) { const e = await expIpa(page, x.w); if ((x.ipa || "") !== e) return "wrong for " + x.w + ": " + x.ipa + " ≠ " + e; } return ""; };

const A = await learner("amina", "general-english", "fr");
await A.page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { __ev.push([n, p || {}]); return t0 && t0(n, p); }; });
await openShadow(A.page);

/* ---------- defaults ---------- */
let c = await card(A.page);
ok("General English, French native language: the card carries Translate (FR) and Pronunciation, both OFF; no translation block, no IPA, nothing asked of the Worker", c.card && c.trBtn && c.trOn === "false" && !c.trNa && c.trCode === "FR" && c.ipaBtn && c.ipaOn === "false" && !c.trShown && c.nIpa === 0 && c.nWords === c.want.split(/\s+/).length && c.english === c.want && chat.length === 0, JSON.stringify(c));
ok("The two controls are real switches: 40 px tall, aria-pressed, and the card does not overflow a 390 px phone", c.tgH.every(h => h >= 40) && c.fits, JSON.stringify({ h: c.tgH, fits: c.fits }));

/* ---------- Translate ---------- */
const trOn = await A.page.evaluate(() => svShTrToggle()); await sleep(500);
c = await card(A.page);
ok("Translate ON: the control shows a tick and aria-pressed=true; the block appears under the English, labelled Français, lang=fr, with the French translation from the Worker; the English stays; exactly one chat request, asked for French", trOn && c.trOn === "true" && c.trCheck && c.trShown && c.trLang === "fr" && c.trDir === "ltr" && c.trLbl === "Français" && /^Traduction \[French\]/.test(c.trText) && c.english === c.want && c.nWords === c.want.split(/\s+/).length && chat.length === 1 && chat[0].kind === "tr" && chat[0].lang === "French" && chat[0].text === c.want, JSON.stringify({ trOn, c, chat }));
ok("The preference is kept per area in S (svPrefA.general-english.tr) — nothing under welding", c.pref && c.pref["general-english"] && c.pref["general-english"].tr === true && !c.pref.welding, JSON.stringify(c.pref));
const trOff = await A.page.evaluate(() => svShTrToggle()); await sleep(150);
c = await card(A.page);
ok("Translate OFF again: the block is gone, aria-pressed=false, the English untouched", !trOff && c.trOn === "false" && !c.trShown && c.english === c.want, JSON.stringify(c));
const n1 = chat.length;
await A.page.evaluate(() => svShTrToggle()); await sleep(300);
c = await card(A.page);
ok("Translate ON a second time on the same paragraph: served from the cache — the text is there at once, no new request, and the cache lives under be_sv_tr keyed by video, paragraph and language", c.trShown && /Traduction/.test(c.trText) && !/wait|err/.test(c.trCls) && chat.length === n1 && await A.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("be_sv_tr") || "{}")).some(k => k.startsWith("MZAjfsyJa1U:") && k.endsWith(":fr"))), JSON.stringify({ c, n1, now: chat.length }));

/* ---------- Pronunciation ---------- */
const ipaOn = await A.page.evaluate(() => svShIpaToggle()); await sleep(600);
c = await card(A.page);
const asked = chat.filter(x => x.kind === "ipa");
const seedHit = await A.page.evaluate(ws => ws.filter(w => SV_IPA_SEED[w]).length, asked.flatMap(x => x.words));
ok("Pronunciation ON: an IPA line under every word, each the value the Worker gave for THAT word (seed words from the built-in lexicon), the note says it is an AI-written American-English guide", ipaOn && c.ipaOn === "true" && c.ipaCheck && c.nIpa === c.nWords && (await ipaRight(A.page, c)) === "" && /IPA|API/.test(c.stText) && !/wait|err/.test(c.stCls), JSON.stringify(c) + await ipaRight(A.page, c));
ok("Only the words the device did not already know were asked for — none from the seed lexicon, all from this paragraph, in batches of at most 25, with the sentence as context", asked.length >= 1 && seedHit === 0 && asked.every(x => x.words.length <= 25 && x.words.length > 0 && x.text.includes(c.want.slice(0, 30))) && asked.flatMap(x => x.words).every(w => c.want.toLowerCase().includes(w.replace(/'/g, "").slice(0, 3))), JSON.stringify(asked));
ok("Both helpers on at once: English words + IPA + French, still one card that fits the phone", c.trShown && c.nIpa === c.nWords && c.english === c.want && c.fits, JSON.stringify({ trShown: c.trShown, nIpa: c.nIpa, fits: c.fits }));

/* ---------- a word tapped ---------- */
const tap = await A.page.evaluate(async () => {
  const calls = []; const f0 = window.fbSay; window.fbSay = (w, r) => calls.push([w, r]);
  const w = document.querySelectorAll("#svSh .sv-sh-w")[1]; w.click(); await new Promise(r => setTimeout(r, 100));
  const r = { calls, said: w.classList.contains("said"), word: w.dataset.w, ev: __ev.filter(e => e[0] === "shadow_word_played").length };
  window.fbSay = f0; return r;
});
ok("Tapping a word plays it (fbSay with the clean word) and marks it briefly; shadow_word_played is counted", tap.calls.length === 1 && tap.calls[0][0] === tap.word && tap.calls[0][1] === 1 && tap.said && tap.ev >= 1, JSON.stringify(tap));
await A.page.evaluate(() => svShIpaToggle()); await sleep(150);
c = await card(A.page);
ok("Pronunciation OFF: every IPA line goes", c.ipaOn === "false" && c.nIpa === 0, JSON.stringify({ ipaOn: c.ipaOn, nIpa: c.nIpa }));
const peek = await A.page.evaluate(async () => {
  const f0 = window.fbSay; window.fbSay = () => {};
  const ws = document.querySelectorAll("#svSh .sv-sh-w"); ws[2].click(); await new Promise(r => setTimeout(r, 300));
  const r = { n: document.querySelectorAll("#svSh .sv-sh-ipa").length, on: ws[2].querySelector(".sv-sh-ipa")?.textContent, w: ws[2].dataset.w, exp: (() => { const n = svIpaNorm(ws[2].dataset.w); return SV_IPA_SEED[n] || "ˈ" + n; })(), pref: !!(S.svPrefA && S.svPrefA["general-english"].ipa) };
  window.fbSay = f0; return r;
});
ok("With Pronunciation off, a tap still shows that one word's IPA under it — a peek, the switch stays off", peek.n === 1 && peek.on === peek.exp && !peek.pref, JSON.stringify(peek));

/* ---------- next paragraph, both on ---------- */
await A.page.evaluate(() => svShIpaToggle()); await sleep(100);
const n2 = chat.length, g0 = (await card(A.page)).gid;
await A.page.evaluate(() => svShStep(1)); await sleep(700);
c = await card(A.page);
const asked2 = chat.slice(n2).filter(x => x.kind === "ipa"), tr2 = chat.slice(n2).filter(x => x.kind === "tr");
ok("Next paragraph with both on: a new card, its own French translation fetched once, its IPA fetched for the unknown words only (the last paragraph's words are cached)", c.gid !== g0 && c.trShown && /Traduction \[French\]/.test(c.trText) && tr2.length === 1 && tr2[0].text === c.want && c.nIpa === c.nWords && (await ipaRight(A.page, c)) === "" && asked2.every(x => x.words.every(w => !chat.slice(0, n2).some(y => y.kind === "ipa" && y.words.includes(w)))), JSON.stringify({ gid: c.gid, g0, tr2, asked2 }));
ok("Analytics: shadow_translation_toggled on/off (+lang fr), shadow_pronunciation_toggled, and shadow_translation_viewed once per paragraph, not once per redraw", await A.page.evaluate(() => { const e = __ev; const tr = e.filter(x => x[0] === "shadow_translation_toggled"); const pr = e.filter(x => x[0] === "shadow_pronunciation_toggled"); const v = e.filter(x => x[0] === "shadow_translation_viewed"); return tr.length === 3 && tr[0][1].state === "on" && tr[0][1].lang === "fr" && tr[1][1].state === "off" && pr.length === 3 && v.length === 2 && v.every(x => x[1].lang === "fr"); }), await A.page.evaluate(() => JSON.stringify(__ev.filter(e => /^shadow_(trans|pron)/.test(e[0])))));

/* ---------- failures ---------- */
polishMode = "500";
await A.page.evaluate(() => svShStep(1)); await sleep(600);
c = await card(A.page);
const still = await A.page.evaluate(() => ({ words: document.querySelectorAll("#svSh .sv-sh-w").length, bar: !!document.querySelector("#shv3Bar .shv3-rec"), loop: shLooping, note: document.getElementById("shNote").value === svShGroup().text }));
ok("Worker down: the translation block says so with a Try again button, the IPA status too, and the card — the words, the loop, the notes, the Shadow bar — carries on", /err/.test(c.trCls) && c.trRetry && /err/.test(c.stCls) && c.stRetry && c.nWords === c.want.split(/\s+/).length && c.english === c.want && still.words > 0 && still.bar && still.loop && still.note, JSON.stringify({ c, still }));
polishMode = "ok";
await A.page.evaluate(() => { svShTrRetry(); svShIpaRetry(); }); await sleep(600);
c = await card(A.page);
ok("Try again after the Worker is back: the translation and the IPA both arrive", c.trShown && /Traduction/.test(c.trText) && !/err|wait/.test(c.trCls) && c.nIpa === c.nWords && (await ipaRight(A.page, c)) === "" && !/err/.test(c.stCls), JSON.stringify(c));
polishMode = "429";
await A.page.evaluate(() => { SV_AI_RETRY_MS = 300; _svAiTimes.length = 0; svShStep(1); }); await sleep(1500);   // the budget is cleared: the suite itself has spent it
c = await card(A.page);
await A.page.evaluate(() => { SV_AI_RETRY_MS = 20000; });
ok("Rate-limited (429) twice running: after the quiet retry the message says too many requests, not a generic failure", /Too many requests|Trop de demandes/.test(c.trText) && /Too many requests|Trop de demandes/.test(c.stText), JSON.stringify({ tr: c.trText, st: c.stText }));
polishMode = "ok";
const n3 = chat.length;
await A.ctx.setOffline(true);
await A.page.evaluate(() => svShStep(1)); await sleep(400);
c = await card(A.page);
await A.ctx.setOffline(false);
ok("Offline: the helpers say they need a connection at once — no request is even attempted; the English is there", /err/.test(c.trCls) && /connection|connexion/.test(c.trText) && /err/.test(c.stCls) && chat.length === n3 && c.english === c.want, JSON.stringify({ tr: c.trText, st: c.stText, hits: chat.length - n3 }));

/* ---------- away and back, then a refresh ---------- */
await A.page.evaluate(() => svShStep(-4)); await sleep(100);   // back to the first paragraph, already translated
await A.page.evaluate(() => { svSetMode("watch"); }); await sleep(150);
const away = await A.page.evaluate(() => ({ card: !!document.getElementById("svSh"), tr: !!(S.svPrefA["general-english"].tr), ipa: !!(S.svPrefA["general-english"].ipa) }));
await A.page.evaluate(() => { svSetMode("shadow"); }); await sleep(300);
c = await card(A.page);
ok("Leaving for Watch removes the card; coming back, both switches are still on and the paragraph's translation and IPA are back from the cache", !away.card && away.tr && away.ipa && c.trOn === "true" && c.ipaOn === "true" && c.trShown && c.nIpa === c.nWords, JSON.stringify({ away, c }));
const n4 = chat.length, gidBefore = c.gid;
await A.page.reload({ waitUntil: "load" }); await sleep(800);
await A.page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
await A.page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { __ev.push([n, p || {}]); return t0 && t0(n, p); }; });
await openShadow(A.page);
c = await card(A.page);
ok("After a refresh both switches are still on (the preference is in S), and the paragraph's translation and IPA come from the device caches — no new request", c.gid === gidBefore && c.trOn === "true" && c.ipaOn === "true" && c.trShown && /Traduction \[French\]/.test(c.trText) && c.nIpa === c.nWords && (await ipaRight(A.page, c)) === "" && !chat.slice(n4).some(x => x.text === c.want || x.text.includes(c.want.slice(0, 40))), JSON.stringify({ c, hits: chat.slice(n4) }));

/* ---------- the v3 Shadow button while recording ---------- */
const recBtn = await A.page.evaluate(async () => {
  const b = () => document.querySelector("#shv3Bar .shv3-rec");
  const r = { before: b().classList.contains("on"), lbl0: b().innerText.trim() };
  shv3Shadow();
  const t0 = Date.now(); while (!(rec.mr && rec.mr.state === "recording") && Date.now() - t0 < 8000) await new Promise(x => setTimeout(x, 50));
  await new Promise(x => setTimeout(x, 400));
  r.live = !!(rec.mr && rec.mr.state === "recording"); r.on = b().classList.contains("on"); r.lbl1 = b().innerText.trim(); r.bg = getComputedStyle(b()).backgroundColor;
  await new Promise(x => setTimeout(x, 1400));
  shv3Shadow();
  const t1 = Date.now(); while (rec.mr && rec.mr.state === "recording" && Date.now() - t1 < 8000) await new Promise(x => setTimeout(x, 50));
  await new Promise(x => setTimeout(x, 700));
  r.off = !b().classList.contains("on"); r.lbl2 = b().innerText.trim(); r.bg2 = getComputedStyle(b()).backgroundColor;
  return r;
});
ok("The Shadow button in the foot bar turns red and says Stop while the recorder is running, and goes back to blue / Shadow the moment it stops", !recBtn.before && recBtn.live && recBtn.on && /Stop/.test(recBtn.lbl1) && recBtn.off && /Shadow/.test(recBtn.lbl2) && recBtn.bg !== recBtn.bg2, JSON.stringify(recBtn));

/* ---------- the report fold ---------- */
const fold = await A.page.evaluate(async () => {
  const b = () => document.getElementById("fbFold"), out = () => document.getElementById("fbOut");
  const r = { hiddenAtFirst: b().hidden };
  S.notes["shheard:" + shClip.vid] = svShGroup().text; fbFromRec(); await new Promise(x => setTimeout(x, 200));
  r.shown = !b().hidden && !out().hidden && out().innerHTML.length > 50 && b().getAttribute("aria-expanded") === "true" && b().getAttribute("aria-controls") === "fbOut";
  r.lbl0 = b().getAttribute("aria-label");
  fbFoldToggle(); r.folded = out().hidden && b().getAttribute("aria-expanded") === "false"; r.lbl1 = b().getAttribute("aria-label");
  fbFoldToggle(); r.open = !out().hidden && b().getAttribute("aria-expanded") === "true";
  fbFoldToggle(); fbFromRec(); await new Promise(x => setTimeout(x, 200)); r.fresh = !out().hidden;
  return r;
});
ok("The report card folds: the chevron appears only once there is a report, hides the report body (aria-expanded false, label 'Show the report'), shows it again, and a NEW report always opens", fold.hiddenAtFirst && fold.shown && /Hide|Masquer/.test(fold.lbl0) && fold.folded && /Show|Afficher/.test(fold.lbl1) && fold.open && fold.fresh, JSON.stringify(fold));

/* ---------- Watch still lights the word ---------- */
await A.page.evaluate(() => svSetMode("watch")); await sleep(200);
const lit = await A.page.evaluate(() => { const s = svAsset.segments[5]; shSeek = { t: (s.words[2].startMs + 10) / 1000, at: Date.now() }; svTick(); return { seg: document.querySelector(".sv-seg.now")?.dataset.i, word: document.querySelector(".sv-w.now")?.firstChild?.textContent, expect: s.words[2].text }; });
ok("WATCH still works: playback time lights the current sentence and word", lit.seg === "5" && lit.word === lit.expect, JSON.stringify(lit));

/* ---------- WATCH: the same switches, the paragraph being spoken ---------- */
const wt = await A.page.evaluate(async () => {
  const r = { tr: document.getElementById("svWtTrBtn")?.getAttribute("aria-pressed"), ipa: document.getElementById("svWtIpaBtn")?.getAttribute("aria-pressed") };
  await new Promise(x => setTimeout(x, 500));
  const para = document.querySelector("#svTx .sv-para[data-p='" + svWtCur + "']");
  r.cur = svWtCur; r.trBox = para && para.querySelector(".sv-para-tr")?.innerText; r.trOnly = document.querySelectorAll("#svTx .sv-para-tr").length;
  r.ipaIn = para ? para.querySelectorAll(".sv-w-ipa").length : 0; r.wIn = para ? para.querySelectorAll(".sv-w").length : 0; r.ipaElsewhere = document.querySelectorAll("#svTx .sv-para:not([data-p='" + svWtCur + "']) .sv-w-ipa").length;
  r.first = para && para.querySelector(".sv-w-ipa")?.textContent; r.firstWord = para && para.querySelector(".sv-w")?.firstChild.textContent;
  /* the speech moves to the next paragraph */
  const nx = svParas(svAsset)[svWtCur + 1]; const sg = svAsset.segments[nx.from]; svPick = -1; shSeek = { t: (sg.startMs + 10) / 1000, at: Date.now() }; svTick(); await new Promise(x => setTimeout(x, 600));
  r.moved = svWtCur === r.cur + 1; r.trMoved = document.querySelectorAll("#svTx .sv-para-tr").length === 1 && !!document.querySelector("#svTx .sv-para[data-p='" + svWtCur + "'] .sv-para-tr"); r.ipaMoved = document.querySelectorAll("#svTx .sv-para:not([data-p='" + svWtCur + "']) .sv-w-ipa").length === 0 && document.querySelectorAll("#svTx .sv-para[data-p='" + svWtCur + "'] .sv-w-ipa").length > 0;
  return r;
});
ok("WATCH carries the same two switches (same preference, both on) and applies them to the paragraph being spoken only: its translation under it, IPA under each of its words, nothing on the other paragraphs — and they move with the speech", wt.tr === "true" && wt.ipa === "true" && /Traduction \[French\]/.test(wt.trBox || "") && wt.trOnly === 1 && wt.ipaIn === wt.wIn && wt.wIn > 0 && wt.ipaElsewhere === 0 && wt.first === await expIpa(A.page, wt.firstWord) && wt.moved && wt.trMoved && wt.ipaMoved, JSON.stringify(wt));

/* ---------- homographs: the reading THIS sentence gave, kept apart ---------- */
const hg = await A.page.evaluate(async () => {
  const r = {};
  const g1 = { id: "x1", text: "I will record the meeting.", vid: shClip.vid }, g2 = { id: "x2", text: "The record shows it.", vid: shClip.vid };
  await svShIpaFetch(g1); await svShIpaFetch(g2);
  r.v1 = svIpaGet("record", svIpaCtx(g1)); r.v2 = svIpaGet("record", svIpaCtx(g2)); r.plain = svIpaGet("record"); r.meeting = svIpaGet("meeting"); r.keys = Object.keys(JSON.parse(localStorage.getItem("be_sv_ipa"))).filter(k => k.startsWith("record")).sort();
  return r;
});
ok("A homograph is cached per paragraph: 'record' reads rɪˈkɔrd in one sentence and ˈrɛkərd in the other, never one for both; ordinary words stay cached once", hg.v1 === "rɪˈkɔrd" && hg.v2 === "ˈrɛkərd" && hg.plain === "" && hg.meeting === "ˈmeeting" && hg.keys.length === 2 && hg.keys.every(k => k.includes("@")), JSON.stringify(hg));

/* ---------- pacing: a 429 is retried once, quietly ---------- */
polishMode = "429once"; once429 = 0;
const pace = await A.page.evaluate(async () => {
  SV_AI_RETRY_MS = 300; const g = { id: "x3", text: "Nobody expected the verdict.", vid: shClip.vid };
  const t0 = Date.now(); const n = await svShIpaFetch(g); return { n, ms: Date.now() - t0, v: svIpaGet("verdict") };
});
ok("Pacing: a 429 from the route is retried once after the back-off instead of being shown — the IPA still arrives", pace.n >= 1 && pace.ms >= 280 && pace.v === "ˈverdict" && once429 === 2, JSON.stringify({ pace, once429 }));
polishMode = "ok";
const budget = await A.page.evaluate(async () => { SV_AI_PER_MIN = 2; _svAiTimes.length = 0; let third = false; [1, 2].forEach(i => svShIpaFetch({ id: "b" + i, text: "Word" + i + " alpha" + i, vid: shClip.vid }).catch(() => {})); svShIpaFetch({ id: "b3", text: "Word3 alpha3", vid: shClip.vid }).then(() => { third = true; }).catch(() => {}); await new Promise(x => setTimeout(x, 900)); const r = { sent: _svAiTimes.length, third }; SV_AI_PER_MIN = 10; return r; });
ok("Pacing: past the per-minute budget a call waits for a slot rather than being refused — two go out at once, the third is still waiting a second later", budget.sent === 2 && budget.third === false, JSON.stringify(budget));

/* ---------- track isolation on the same account ---------- */
const iso = await A.page.evaluate(() => {
  const r = {}; S.professionalTracks.activeId = "welding";
  r.on = svOn(); r.trOn = svShTrOn(); r.ipaOn = svShIpaOn(); r.tr = svShTrToggle(); r.ipa = svShIpaToggle(); r.weld = S.svPrefA.welding;
  S.professionalTracks.activeId = "general-english";
  r.back = svShTrOn() && svShIpaOn(); r.ge = S.svPrefA["general-english"];
  return r;
});
ok("Switched to Welding on the same device: both helpers read OFF, the switches refuse and write nothing under welding; back on General English they are still on", !iso.on && !iso.trOn && !iso.ipaOn && iso.tr === false && iso.ipa === false && iso.weld === undefined && iso.back && iso.ge.tr === true && iso.ge.ipa === true, JSON.stringify(iso));

/* ---------- a Welding learner ---------- */
const nW = chat.length;
const W = await learner("wendy", "welding", "fr");
await W.page.evaluate(() => go("shadow")); await W.page.waitForSelector("#shPlayerWrap", { state: "attached", timeout: 15000 });
await W.page.evaluate(async v => { await shLoad({ vid: v, start: 0, end: 0, title: "clip" }, true); }, VID); await sleep(2500);
await W.page.evaluate(() => shOpenWork()); await sleep(300);
const w = await W.page.evaluate(() => ({ v2: !!(document.getElementById("shV2") && document.getElementById("shV2").style.display !== "none" && document.getElementById("shV2").innerHTML.trim()), card: !!document.getElementById("svSh"), on: svOn(), tr: svShTrToggle(), ipa: svShIpaToggle(), pref: S.svPrefA, trCache: localStorage.getItem("be_sv_tr"), ipaCache: localStorage.getItem("be_sv_ipa") }));
ok("Welding (French native language): no V2 panel, no card, no switches; the switch functions refuse; nothing written to S or to the device caches; nothing asked of the Worker", !w.v2 && !w.card && !w.on && w.tr === false && w.ipa === false && w.pref === undefined && w.trCache === null && w.ipaCache === null && chat.length === nW, JSON.stringify(w));

/* ---------- an English-app learner ---------- */
const E = await learner("ed", "general-english", "en");
await openShadow(E.page);
const nE = chat.length;
const e1 = await E.page.evaluate(async () => {
  const tb = document.getElementById("svShTrBtn");
  const r = { na: tb.getAttribute("aria-disabled") === "true", cls: tb.className, code: !!tb.querySelector("small"), ret: svShTrToggle() };
  await new Promise(x => setTimeout(x, 100));
  r.toast = document.getElementById("toast").textContent; r.pref = S.svPrefA && S.svPrefA["general-english"] && S.svPrefA["general-english"].tr; r.block = !document.getElementById("svShTr").hidden;
  r.ipa = svShIpaToggle(); await new Promise(x => setTimeout(x, 500)); r.nIpa = document.querySelectorAll("#svSh .sv-sh-ipa").length; r.nW = document.querySelectorAll("#svSh .sv-sh-w").length;
  return r;
});
ok("English as the app language: Translate is shown but marked unavailable (aria-disabled, dimmed, no code); tapping it explains that the native language is needed, nothing is translated or requested; Pronunciation still works", e1.na && /\bna\b/.test(e1.cls) && !e1.code && e1.ret === false && /native language/.test(e1.toast) && !e1.pref && !e1.block && e1.ipa && e1.nIpa === e1.nW && chat.filter(x => x.kind === "tr").length === chat.slice(0, nE).filter(x => x.kind === "tr").length, JSON.stringify(e1));
const e2 = await E.page.evaluate(async () => {
  S.profile.lang = "es"; svRender(); const r = { code: document.getElementById("svShTrBtn").querySelector("small")?.innerText, ret: svShTrToggle() };
  await new Promise(x => setTimeout(x, 500));
  const b = document.getElementById("svShTr"); r.lbl = b.querySelector(".sv-sh-tr-l")?.textContent; r.text = b.querySelector(".sv-sh-tr-x")?.innerText; r.lang = b.getAttribute("lang");
  S.profile.lang = "ar"; svRender(); await new Promise(x => setTimeout(x, 500));
  const b2 = document.getElementById("svShTr"); r.arDir = b2.getAttribute("dir"); r.arLang = b2.getAttribute("lang"); r.arLbl = b2.querySelector(".sv-sh-tr-l")?.textContent; r.arText = b2.querySelector(".sv-sh-tr-x")?.innerText;
  S.profile.lang = "en"; svRender(); return r;
});
const langs = chat.slice(nE).filter(x => x.kind === "tr").map(x => x.lang);
ok("The target language follows the native-language setting, never a guess: Spanish → 'ES', Español, a Spanish request; Arabic → the block turns right-to-left with lang=ar and an Arabic request", e2.code === "ES" && e2.ret && e2.lbl === "Español" && /Traduction \[Spanish\]/.test(e2.text) && e2.lang === "es" && e2.arDir === "rtl" && e2.arLang === "ar" && e2.arLbl === "العربية" && /Traduction \[Arabic\]/.test(e2.arText) && langs.join() === "Spanish,Arabic", JSON.stringify({ e2, langs }));

ok("No JavaScript errors on any of the three pages", errors.length === 0, errors.join(" | "));

await browser.close(); if (server) server.kill();
const fails = res.filter(r => !r.pass).length;
console.log(`\n${res.length - fails}/${res.length} passed`);
process.exit(fails ? 1 : 0);
