/* Foundations check (owner, 9 Oct 2026): a General English take is transcribed and
   compared word by word with the sentence; the learner sees what they said, the
   words to fix, practises a word until it is heard, and the next sentence opens
   only when the whole sentence reaches 80 %. Nothing passes when the check cannot
   run. The 15-day evaluation counts only what really happened. Welding keeps its
   production behaviour (the recording finishes the item).
   Run: cd tests && node foundations-check.mjs      (BASE=… for another tree)
   WebKit, iPhone 13. The microphone is the only stub: the Polish Worker is
   answered at the network level, so the app's own fbTranscribe / fbAssess run. */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8147);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 600)}`); };
const b = await webkit.launch();

/* the Worker, as the test wants it to answer */
const W = { tx: [], tx401: false, tx503: false, calls: { tx: 0, assess: 0, chat: 0 } };
async function learner(track) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /cloudflareinsights|be-events|youtube|ytimg/.test(u.href), r => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await ctx.route(u => /be-polish/.test(u.href), async r => {
    const req = r.request();
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST" } });
    const ct = req.headers()["content-type"] || "", H = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (!/json/.test(ct)) {                                  // speech to text
      W.calls.tx++;
      if (W.tx401) return r.fulfill({ status: 401, headers: H, body: '{"error":"auth_required"}' });
      if (W.tx503) return r.fulfill({ status: 503, headers: H, body: '{"error":"busy"}' });
      const text = W.tx.length ? W.tx.shift() : "";
      return r.fulfill({ status: 200, headers: H, body: JSON.stringify({ text, words: [] }) });
    }
    const body = JSON.parse(req.postData() || "{}");
    if (body.assess) { W.calls.assess++; return r.fulfill({ status: 200, headers: H, body: JSON.stringify({ overall: 90, mode: "whisper", words: body.assess.split(/\s+/).map(w => ({ word: w.toLowerCase().replace(/[^a-z']/g, ""), score: 95 })) }) }); }
    if (body.chat) { W.calls.chat++; return r.fulfill({ status: 200, headers: H, body: JSON.stringify({ reply: "sorry=ˈsɑri=SAH-ree=Le « o » est court.|i=aɪ=EYE=Comme « aïe ».|don't=doʊnt=DOHNT=Arrondissez les lèvres sur « o ».|understand=ˌʌndərˈstænd=un-der-STAND=Accentuez STAND." }) }); }
    return r.fulfill({ status: 404, headers: H, body: "{}" });
  });
  await ctx.addInitScript(tk => {
    if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1);
      localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Probe", lang: "fr", ts: 1 }, professionalTracks: { activeId: tk, tradeId: "welder" },
        fnd: { [tk]: { placed: "foundations", day: 2, done: { d1: true, d1r: { 0: true, 1: true, 2: true } } } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() })); }
  }, track);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html?fc=" + Date.now() + "#home"); await sleep(2800);
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    window.phRecInto = (c, l, bt, after, onBlob) => { window.__recCtx = c; onBlob(new Blob(["take" + Math.random()], { type: "audio/webm" })); };
    window.exPlayBlob = () => { window.__played = (window.__played || 0) + 1; };
    go("foundations", 2); });
  await sleep(700);
  return { ctx, p, errs };
}
const state = (p, i = 0) => p.evaluate(i => {
  const it = n => document.getElementById("fndItem" + n), box = document.getElementById("fndRes" + i), rep = box.querySelector("details.fnd-check");
  const grp = g => box.querySelector(`.fnd-grp[data-g="${g}"]`);
  const f = fndState(), e = (f.ev || {})["d2-" + i] || null;
  return { done: it(i).classList.contains("done"), nextLocked: it(i + 1) ? it(i + 1).classList.contains("locked") : null, nextRecDisabled: it(i + 1) ? document.getElementById("fndRec" + (i + 1)).disabled : null,
    report: !!rep, open: rep ? rep.open : null, pct: rep ? (rep.querySelector(".fnd-overall") || {}).textContent : null,
    said: grp("said") ? grp("said").innerText.replace(/\s+/g, " ").trim() : null, saidBad: grp("said") ? [...grp("said").querySelectorAll(".fnd-w.bad")].map(x => x.textContent) : [],
    tgtBad: grp("target") ? [...grp("target").querySelectorAll(".fnd-w.bad")].map(x => x.textContent) : [],
    fix: grp("fix") ? [...grp("fix").querySelectorAll(".fnd-fix .fnd-fix-top .fnd-w")].map(x => x.textContent) : [],
    fixText: grp("fix") ? grp("fix").innerText.replace(/\s+/g, " ").slice(0, 1200) : "", groupsCollapsible: ["said", "target", "fix"].filter(g => grp(g)).every(g => grp(g).tagName === "DETAILS"),
    again: !!box.querySelector(".fnd-again"), nextHint: (box.querySelector(".fnd-next-h") || {}).textContent || "", err: (box.querySelector(".fnd-err") || {}).textContent || "",
    errBtn: (box.querySelector(".fnd-err-acts button") || {}).textContent || "", tick: !!box.querySelector(".fnd-tick"), ev: e, played: window.__played || 0, text: box.innerText.slice(0, 300) };
}, i);

console.log("\n# General English — the check is required");
{
  const { ctx, p, errs } = await learner("general-english");
  W.calls = { tx: 0, assess: 0, chat: 0 };

  // S1 — says something else
  W.tx = ["Where do you go?"]; await p.evaluate(() => fndRecord(2, 0)); await sleep(1500);
  let s = await state(p);
  ok("1 · the take is played straight back", s.played >= 1, JSON.stringify(s));
  ok("2 · 'Where do you go?' → the actual transcript is shown under What you said", s.said && s.said.includes("Where do you go?"), JSON.stringify(s));
  ok("3 · every word said is marked wrong, every target word marked missing", s.saidBad.length === 4 && s.tgtBad.join(" ") === "Sorry I don't understand", JSON.stringify(s));
  ok("4 · 0 % and progression is blocked: not done, next sentence locked, its Record disabled", s.pct === "0%" && !s.done && s.nextLocked && s.nextRecDisabled, JSON.stringify(s));
  ok("5 · the report is one collapsible block of collapsible groups, open, with Say it again", s.report && s.open && s.groupsCollapsible && s.again, JSON.stringify(s));
  ok("6 · four words to fix, each with what was heard instead / not heard, IPA and a French tip", s.fix.length === 4 && /“go”|«\s*go\s*»/.test(s.fixText) && /\/ˌʌndərˈstænd\//.test(s.fixText) && /Accentuez/.test(s.fixText), s.fixText);
  ok("7 · the check used speech to text, not the metered assess route", W.calls.tx === 1 && W.calls.assess === 0, JSON.stringify(W.calls));

  // S2 — one word mispronounced
  W.tx = ["Sorry, I don't understan."]; await p.evaluate(() => fndRecord(2, 0)); await sleep(1300);
  s = await state(p);
  ok("8 · one word wrong → only 'understand' to fix, heard as 'understan', 75 %, still blocked", s.fix.join() === "understand" && /understan/.test(s.fixText) && s.pct === "75%" && !s.done && s.nextLocked, JSON.stringify(s));

  // S3 — the word improves, the sentence is still not passed
  W.tx = ["Understand."]; await p.evaluate(() => fndDrill(2, 0, "understand")); await sleep(1100);
  s = await state(p);
  ok("9 · Practise this word: the word alone is heard → 'Good — heard clearly'", /heard clearly|entendu clairement/.test(s.fixText), s.fixText);
  ok("10 · …but the sentence is still not passed: next locked, the hint asks for the whole sentence again", !s.done && s.nextLocked && s.again && s.nextHint.length > 10, JSON.stringify(s));
  W.tx = ["under stand"]; await p.evaluate(() => fndDrill(2, 0, "understand")); await sleep(1100);
  s = await state(p);
  ok("11 · a word drill that is not heard says what was heard and asks again", /under stand/.test(s.fixText), s.fixText);

  // S4 — passes
  W.tx = ["Sorry, I don't understand."]; await p.evaluate(() => fndRecord(2, 0)); await sleep(1600);
  s = await state(p);
  ok("12 · the whole sentence clear → 100 %, mastered, next sentence opens", s.pct === "100%" && s.done && s.nextLocked === false && s.nextRecDisabled === false, JSON.stringify(s));
  ok("13 · the evaluation records genuine performance: first 0, best 100, 3 tries, the word practised", s.ev && s.ev.first === 0 && s.ev.best === 100 && s.ev.tries === 3 && s.ev.passedAt && s.ev.words.understand === 2, JSON.stringify(s.ev));

  // S5 — services fail: nothing passes
  W.tx503 = true; await p.evaluate(() => fndRecord(2, 1)); await sleep(1300);
  s = await state(p, 1);
  ok("14 · transcription down (503) → an honest message, Check this take again, NOT done", !s.done && s.err.length > 10 && /again|revérifier/i.test(s.errBtn) && !s.tick, JSON.stringify(s));
  W.tx503 = false; W.tx401 = true; await p.evaluate(() => fndRecheck(2, 1)); await sleep(1200);
  s = await state(p, 1);
  ok("15 · no account (401) → asks to sign in, NOT done", !s.done && /connect|sign in/i.test(s.errBtn), JSON.stringify(s));
  W.tx401 = false; W.tx = [""]; await p.evaluate(() => fndRecheck(2, 1)); await sleep(1200);
  s = await state(p, 1);
  ok("16 · nothing heard → asks to record again, NOT done", !s.done && s.err.length > 10, JSON.stringify(s));
  W.tx = ["Can you repeat that, please?"]; await p.evaluate(() => fndRecheck(2, 1)); await sleep(1500);
  s = await state(p, 1);
  ok("17 · service back → Check this take again grades the SAME take and passes it", s.done && s.pct === "100%", JSON.stringify(s));
  const ev14 = await p.evaluate(() => fndState().ev["d2-1"]);
  ok("18 · failed checks are not counted as tries", ev14 && ev14.tries === 1 && ev14.first === 100, JSON.stringify(ev14));

  // S6 — the readiness report
  const rep = await p.evaluate(() => { const d = fndReportData(); const el = document.getElementById("fndReport"); return { d, html: el ? el.textContent.replace(/\s+/g, " ") : "", tag: el && el.tagName }; });
  ok("19 · readiness report: 2 of 45 passed, in progress, first-try average 50 %", rep.d.mastered === 2 && rep.d.total === 45 && rep.d.verdict === "progress" && rep.d.first === 50, JSON.stringify(rep.d));
  ok("20 · day 1 recorded before the check exists is reported as such, not as passed", rep.d.recOnly === 3 && /avant la vérification|before the check/.test(rep.html), rep.html);
  ok("21 · the report is collapsible and states what it measures", rep.tag === "DETAILS" && /reconnaissance vocale|speech recogniser/.test(rep.html), rep.html);
  const ready = await p.evaluate(() => { const f = fndState(), pack = fndPack(), save = JSON.stringify(f.ev);
    pack.days.forEach((d, di) => d.items.forEach((_, i) => { f.ev["d" + (di + 1) + "-" + i] = { first: 85, best: 100, tries: 1, words: {}, passedAt: 1 } }));
    const a = fndReportData().verdict; pack.days.forEach((d, di) => d.items.forEach((_, i) => f.ev["d" + (di + 1) + "-" + i].first = 40)); const w = fndReportData().verdict; f.ev = JSON.parse(save); return { a, w }; });
  ok("22 · verdict is honest: all passed + strong first tries = ready; all passed + weak first tries = keep practising", ready.a === "ready" && ready.w === "finish_weak", JSON.stringify(ready));
  ok("23 · no JavaScript errors", !errs.filter(e => !/access control|cloudflareinsights/.test(e)).length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Welding — production behaviour, unchanged");
{
  const { ctx, p, errs } = await learner("welding");
  W.calls = { tx: 0, assess: 0, chat: 0 };
  const lock = await p.evaluate(() => ({ l1: document.getElementById("fndItem1").classList.contains("locked"), d1: document.getElementById("fndRec1").disabled }));
  ok("24 · Welding: no sentence lock", !lock.l1 && !lock.d1, JSON.stringify(lock));
  await p.evaluate(() => fndRecord(2, 0)); await sleep(1500);
  const s = await state(p);
  ok("25 · Welding: the recording finishes the item, score shown as feedback, no transcript report", s.done && s.tick && !s.report && W.calls.tx === 0, JSON.stringify({ s, calls: W.calls }));
  const ev = await p.evaluate(() => fndState().ev || null);
  ok("26 · Welding: no evaluation record and no readiness report", !ev && !(await p.evaluate(() => !!document.getElementById("fndReport"))), JSON.stringify(ev));
  const ge = await p.evaluate(() => JSON.stringify((S.fnd["general-english"] || {}).ev || null));
  ok("27 · track isolation: Welding's state holds nothing of General English's evaluation", ge === "null", ge);
  ok("28 · Welding: no JavaScript errors", !errs.filter(e => !/access control|cloudflareinsights/.test(e)).length, errs.join(" | "));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`);
process.exit(n === res.length ? 0 : 1);
