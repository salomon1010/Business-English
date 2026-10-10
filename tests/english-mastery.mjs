/* English Mastery — the General English game hub, in a real browser (10 Oct 2026).
   Run: cd tests && node english-mastery.mjs          (PORT=… for a free port)

   Covers: the Practice-page portal (the Knowledge Boosters untouched), the hub and its tabs, all
   eight games end to end (Speak Up with a fake microphone and a stubbed transcription), the daily
   mission, energy (Free 5 a day, wrong answers free, Word Quest free), sign-in before play, the
   programme check, offline behaviour, Premium (unlimited, the advanced pack, trends), the AI coach
   and the machine translation labelled as such, curriculum order, History, persistence across a
   reload, Progress, Home, mobile layout — and the boundary: a Welding learner renders, loads and
   stores none of it. The server is a stand-in with the contract of backend/wm-game.js
   (prog "general-english"), whose own suite is backend/test-wm-game.mjs. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8661);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });

function fakeServer(o = {}) {
  const S = { plan: o.plan || "free", track: o.track || "general-english", down: false, used: 0, xp: 0, today: 0, daily: false, started: new Set(), finished: new Set(), coach: 0, tr: 0, calls: [], progs: new Set() };
  const CHARGED = new Set(["quiz", "sentence", "listen", "speak", "match", "puzzle", "missions", "advanced"]);
  const MAX = { cards: 20, quiz: 10, sentence: 8, listen: 10, speak: 6, match: 10, puzzle: 10, missions: 6, daily: 8, advanced: 8 };
  const prem = () => S.plan === "premium";
  const view = () => ({ day: new Date().toISOString().slice(0, 10), plan: S.plan, energy: { used: prem() ? 0 : S.used, limit: prem() ? null : 5, resetAt: Date.now() + 3600_000 }, xp: { total: S.xp, today: S.today, dayCap: 600 }, daily: { done: S.daily } });
  S.handle = (body, auth) => {
    if (S.down) return [503, { error: "wm_store_unavailable" }];
    if (body.chat) {
      if (!auth) return [401, { error: "auth_required" }];
      if (body.chat.purpose === "practice") { S.tr++; return [200, { reply: "Je suis responsable de… — Je suis responsable du planning des livraisons." }]; }
      S.coach++; if (!prem() && S.coach > 3) return [429, { error: "allowance", scope: "verdicts", limit: 3 }];
      return [200, { reply: "VERDICT: almost\nWELL: You answered the question politely.\nFIX: Add a short reason.\nBETTER: Thanks so much for inviting me — I'm afraid I'm away that weekend.\nTIP: Ajoute une raison courte." }];
    }
    const w = body.wm; if (!w) return [404, {}];
    S.calls.push(w.op + ":" + (w.mode || "")); S.progs.add(w.prog);
    if (!auth) return [401, { error: "auth_required" }];
    if (w.prog !== "general-english" || S.track !== "general-english") return [403, { error: "track", track: S.track }];
    if (w.op === "status") return [200, view()];
    if (w.op === "pack") return prem() ? [200, PACK] : [402, { error: "premium_required" }];
    if (w.mode === "advanced" && !prem()) return [402, { error: "premium_required" }];
    if (w.op === "start") {
      if (S.started.has(w.sid)) return [200, { ok: true, duplicate: true, ticket: "t:" + w.sid, ...view() }];
      const charged = CHARGED.has(w.mode) && !prem();
      if (charged && S.used >= 5) return [429, { error: "energy", used: 5, limit: 5, resetAt: Date.now() + 3600_000, plan: "free" }];
      S.started.add(w.sid); if (charged) S.used++;
      return [200, { ok: true, charged, ticket: "t:" + w.sid, ...view() }];
    }
    if (w.op === "finish") {
      if (w.ticket !== "t:" + w.sid) return [403, { error: "ticket" }];
      if (S.finished.has(w.sid)) return [200, { ok: true, duplicate: true, awarded: 0, ...view() }];
      S.finished.add(w.sid);
      const n = Math.min(MAX[w.mode] || 10, w.n | 0), ok = Math.min(n, w.ok | 0);
      let xp = ok * 2 + (n >= 5 ? 10 : 0), bonus = 0;
      if (w.mode === "daily" && ok >= 1 && !S.daily) { S.daily = true; bonus = 30; xp += 30; }
      S.xp += xp; S.today += xp;
      return [200, { ok: true, awarded: xp, dailyBonus: bonus, ...view() }];
    }
    return [400, { error: "bad_request" }];
  };
  return S;
}
const PACK = { v: 1, scenarios: [{ id: "ga-01", where: "A client asks for the report two weeks early.", who: "The client", asks: "Can you make the 1st work?", options: [{ en: "I understand why the 1st matters. I can send the summary by the 1st and the full report on the 10th.", ok: true }, { en: "No.", ok: false }, { en: "Of course, no problem.", ok: false }], why: "Acknowledge, explain the limit, offer an option.", task: "Negotiate a new deadline." }] };
const seed = (tr, o = {}) => Object.assign({ profile: { name: "Alex", lang: o.lang || "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }, o.extra || {});
const FLAGS = { english_mastery_enabled: true, welding_mastery_enabled: true, welding_studio_enabled: true, home_v2_enabled: true };
async function open(track, { width = 390, height = 844, hash = "", lang = "en", flags = FLAGS, extra, signed = true, plan = "free", server = null, txOk = true } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, serviceWorkers: "block", permissions: ["microphone"] });
  await ctx.addInitScript(([s, lang, f]) => { if (!sessionStorage.getItem("em_seeded")) { localStorage.setItem("be12_v1", s); sessionStorage.setItem("em_seeded", "1"); } localStorage.setItem("be_lang", lang); localStorage.setItem("be_flags", f); }, [JSON.stringify(seed(track, { lang, extra })), lang, JSON.stringify(flags)]);
  ctx._srv = server || fakeServer({ plan, track });
  await ctx.route(u => /be-polish/.test(u.href), async r => {
    const req = r.request(); if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch (e) {}
    const auth = /^Bearer /.test(req.headers()["authorization"] || "");
    const [status, j] = ctx._srv.handle(body, auth);
    return r.fulfill({ status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(j) });
  });
  await ctx.route(u => /be-events|be-partner|cloudflareinsights|gstatic\.com\/firebasejs|entitlements|workers\.dev/.test(u.href) && !/be-polish/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.addInitScript(() => { window.__said = []; try { Object.defineProperty(window, "speechSynthesis", { value: { speak: u => window.__said.push(u.text), cancel() {}, pause() {}, resume() {}, speaking: false, pending: false, getVoices: () => [] }, configurable: true }); } catch (e) {} });
  await p.goto(BASE + "/index.html" + hash); await sleep(1800);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()));
  /* the transcription route is the Worker's; here it answers with what the take "said" */
  await p.evaluate(ok => { window.__heard = null; window.fbTranscribe = async () => (ok ? (window.__heard != null ? window.__heard : window.__target || "") : ""); }, txOk);
  if (signed) { await p.evaluate(() => { FBUser = { uid: "test-user", email: "t@example.com", getIdToken: async () => "test-token" }; }); await p.evaluate(() => window.EMUI && EMUI._refresh && EMUI._refresh()); await sleep(200); }
  return { ctx, p, errs, srv: ctx._srv };
}
const click = async (p, sel) => { await p.locator(sel).first().click(); await sleep(120); };
const waitG = async (p, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(() => !!(EMUI._game() || document.getElementById("emSheet")))) { await sleep(150); return true; } await sleep(60); } return false; };
const game = p => p.evaluate(() => { const G = EMUI._game(); return G && { mode: G.mode, i: G.i, n: G.n, ok: G.ok, len: G.ids.length, done: !!G.done, id: G.ids[G.i] }; });
const hub = async (p, tab) => { await p.evaluate(t => { go("english", t); }, tab || "home"); await sleep(700); await p.evaluate(() => EMUI._load()); await sleep(300); await p.evaluate(t => EMUI._act("tab", t), tab || "home"); await sleep(300); };
const play = async (p, mode, opts) => { await p.evaluate(([m, o]) => EMUI._start(m, o || {}), [mode, opts || null]); return waitG(p); };
const endXp = p => p.evaluate(() => (document.querySelector("#emEndXp") || {}).textContent || "");
/* answer the open item correctly, whatever game it is */
async function solve(p) {
  return p.evaluate(async () => {
    const G = EMUI._game(); if (!G || G.done) return "none";
    const C = EMUI._corpus(), id = G.ids[G.i], t = C.terms.find(x => x.id === id), g = C.grammar.find(x => x.id === id), m = C.missions.find(x => x.id === id);
    const clk = sel => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };
    const tick = () => new Promise(r => setTimeout(r, 140));
    if (G.mode === "cards") { clk('[data-em="flip"]'); await tick(); clk('.wm-rate-b[data-a="2"]'); await tick(); return "card"; }
    if (g) { clk(`[data-em="${G.mode === "sentence" ? "fpick" : "gpick"}"][data-a="${g.a}"]`); await tick(); clk('[data-em="next"]'); await tick(); return "gram"; }
    if (G.mode === "quiz" || (G.mode === "listen" && document.querySelector('[data-em="lpick"]'))) { clk(`[data-em="${G.mode === "quiz" ? "qpick" : "lpick"}"][data-a="${id}"]`); await tick(); clk('[data-em="next"]'); await tick(); return "pick"; }
    if (G.mode === "listen") { document.getElementById("emLIn").value = t.en; document.getElementById("emLForm").requestSubmit(); await tick(); clk('[data-em="next"]'); await tick(); return "typed"; }
    if (G.mode === "sentence") {
      const want = (t.kind === "sentence" ? t.en : t.ex.en).replace(/…/g, " ").replace(/\bX or Y\b/g, "this or that").replace(/\bX\b/g, "it").replace(/\s+/g, " ").trim().split(" ");
      for (const wd of want) { const btn = [...document.querySelectorAll('[data-em="stile"]:not([disabled])')].find(x => x.textContent === wd); if (!btn) return "stuck:" + wd; btn.click(); await tick(); }
      clk('[data-em="next"]'); await tick(); return "built";
    }
    if (G.mode === "puzzle") { document.getElementById("emBIn").value = t.en; document.getElementById("emBForm").requestSubmit(); await tick(); clk('[data-em="next"]'); await tick(); return "spelled"; }
    if (G.mode === "missions") { const sc = C.missions.find(x => x.id === id) || null; const k = sc ? sc.options.findIndex(o => o.ok) : 0; clk(`[data-em="mpick"][data-a="${k}"]`); await tick(); clk('[data-em="next"]'); await tick(); return "mission"; }
    return "?" + G.mode;
  });
}
async function playOut(p, max = 30) { for (let i = 0; i < max; i++) { const g = await game(p); if (!g || g.done) return true; if (g.mode === "match") { await matchAll(p); continue; } const r = await solve(p); if (/^stuck|^\?/.test(r)) return r; } return false; }
async function matchAll(p) {
  await p.evaluate(async () => { const tick = () => new Promise(r => setTimeout(r, 120)); const G = EMUI._game(); if (!G || G.mode !== "match" || !G.st.items) return;
    for (const x of G.st.items.slice()) { const l = document.querySelector(`[data-em="mleft"][data-a="${x.id}"]`); if (!l) continue; l.click(); await tick();   /* the board redraws on each tap: find the partner after it */
      const r = document.querySelector(`[data-em="mright"][data-a="${x.id}"]`); if (r) { r.click(); await tick(); } } });
  await sleep(700);
}

console.log("\n# the boundary — a Welding learner gets none of it");
{
  const Wd = await open("welding", { plan: "premium" });
  const { p } = Wd;
  await p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(500);
  const v = await p.evaluate(() => ({ on: EMUI.on(), em: !!document.querySelector(".em-portal"), wm: !!document.querySelector(".wm-portal"), kb: (document.querySelector(".prac-kb-h") || {}).textContent }));
  ok("B1 · Welding: EMUI.on() is false, no English Mastery portal; Welding Mastery's portal and Quick Practice are as before", !v.on && !v.em && v.wm && v.kb === "Quick Practice", JSON.stringify(v));
  await p.evaluate(() => go("english")); await sleep(500);
  const off = await p.evaluate(() => ({ off: !!document.querySelector("#v-english .wm-off"), games: !!document.querySelector("#v-english .wm-games") }));
  ok("B2 · Welding: opening the English Mastery view draws only the 'part of General English' notice", off.off && !off.games, JSON.stringify(off));
  await p.evaluate(() => { try { EMUI._start("quiz"); } catch (e) {} go("home"); }); await sleep(600);
  const s = await p.evaluate(() => ({ wm: Object.keys((S.wm || {})), sig: (homeSignals().wm || {}).view || null, calls: 0 }));
  ok("B3 · Welding: nothing stored under general-english, and Home's game signals are Welding Mastery's", !s.wm.includes("general-english") && s.sig === null || s.sig === undefined || !s.wm.includes("general-english") && (s.sig === null || s.sig === "mastery" || s.sig === undefined), JSON.stringify(s));
  ok("B4 · Welding: English Mastery never called the server", !Wd.srv.calls.length, JSON.stringify(Wd.srv.calls));
  ok("B5 · Welding: no page errors", Wd.errs.length === 0, Wd.errs.join(" | "));
  await Wd.ctx.close();
}

console.log("\n# General English · the Practice page and the hub");
const G1 = await open("general-english", { plan: "premium" });
{
  const { p } = G1;
  await p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(600);
  const v = await p.evaluate(() => ({ em: !!document.querySelector(".em-portal-host .em-portal"), wm: !!document.querySelector(".wm-portal:not(.em)"), kb: (document.querySelector(".prac-kb-h") || {}).textContent, cards: document.querySelectorAll(".prac-ex .prac-ex-card").length, cta: (document.querySelector(".em-portal .wm-portal-cta") || {}).textContent }));
  ok("P1 · the English Mastery portal sits above the Knowledge Boosters, which are unchanged (4 cards, same title)", v.em && !v.wm && v.kb === "Knowledge Boosters" && v.cards === 4, JSON.stringify(v));
  ok("P2 · the portal says Enter English Mastery", /Enter English Mastery/.test(v.cta || ""), v.cta);
  await hub(p, "home");
  const h = await p.evaluate(() => { const st = [...document.querySelectorAll("#v-english .wm-stat")]; return { title: (document.querySelector("#v-english .wm-hero h1") || {}).textContent, tabs: document.querySelectorAll("#v-english .wm-tab").length, daily: !!document.querySelector("#v-english .wm-daily"), loop: !!document.querySelector("#v-english .em-loop"), stats: st.length, tops: new Set(st.map(x => Math.round(x.getBoundingClientRect().top))).size, chip: (document.querySelector(".wm-stat.en b") || {}).textContent, total: document.querySelector("#v-english .wm-ring small") && document.querySelector("#v-english .wm-ring small").textContent, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  ok("H1 · the hub: ENGLISH MASTERY, seven tabs, the Daily English Mission, five stats on one line", /ENGLISH/.test(h.title) && h.tabs === 7 && h.daily && h.stats === 5 && h.tops === 1, JSON.stringify(h));
  ok("H2 · the total is the corpus's real count (385), Premium shows ∞, nothing overflows at 390 px", /385/.test(h.total || "") && h.chip === "∞" && h.ov <= 0, JSON.stringify(h));
  await p.evaluate(() => EMUI._act("tab", "games")); await sleep(300);
  const g = await p.evaluate(() => ({ cards: [...document.querySelectorAll("#v-english .wm-game-card:not(.wm-adv) b")].map(x => x.textContent), art: document.querySelectorAll("#v-english .wm-game-card .wm-art3d").length, adv: !!document.querySelector("#v-english .wm-adv") }));
  ok("H3 · the eight games by name, each with its 3D illustration, plus the Premium advanced card", g.cards.join("|") === "Word Quest|Quick Quiz|Sentence Builder|Listen & Win|Speak Up|Phrase Match|Word Puzzle|Real-Life Missions" && g.art >= 9 && g.adv, JSON.stringify(g));
  ok("H4 · every server call named the programme general-english", [...G1.srv.progs].every(x => x === "general-english") && G1.srv.progs.size === 1, JSON.stringify([...G1.srv.progs]));
}

console.log("\n# all eight games, end to end");
{
  const { p } = G1;
  for (const mode of ["cards", "quiz", "sentence", "listen", "match", "puzzle", "missions"]) {
    const opened = await play(p, mode);
    const r = opened ? await playOut(p) : "no round";
    await sleep(500);
    const x = await endXp(p);
    ok(`G·${mode} · a full round plays to the end and the server's XP is shown`, r === true && /\+\d+ XP/.test(x), JSON.stringify({ r, x }));
    await p.evaluate(() => EMUI._act("gclose")); await sleep(200);
  }
  /* Speak Up: a fake microphone, the transcription answering with the target */
  await play(p, "speak", { n: 3 });
  let said = [];
  for (let i = 0; i < 3; i++) {
    const tgt = await p.evaluate(() => { const C = EMUI._corpus(), G = EMUI._game(), t = C.terms.find(x => x.id === G.ids[G.i]); const s = (t.kind === "sentence" ? t.en : t.ex.en).replace(/…/g, " ").replace(/\s+/g, " ").trim(); window.__target = s; window.__heard = null; return s; });
    await click(p, '[data-em="sprec"]'); await sleep(1600); await click(p, '[data-em="sprec"]');
    for (let k = 0; k < 30 && !(await p.evaluate(() => !!document.querySelector(".em-sp-res"))); k++) await sleep(150);
    said.push(await p.evaluate(() => ({ score: (document.querySelector(".em-sp-res b") || {}).textContent, marks: document.querySelectorAll(".em-say span.ok").length, graded: !!EMUI._game().st.graded, play: !!document.querySelector('[data-em="spplay"]') })));
    await click(p, '[data-em="next"]'); await sleep(200);
  }
  ok("G·speak · three takes recorded, heard and scored: 100% of the words, every word marked, the take can be played back", said.length === 3 && said.every(x => /100%/.test(x.score || "") && x.marks > 0 && x.graded && x.play), JSON.stringify(said));
  await sleep(500);
  ok("G·speak · the round finishes with the server's XP", /\+\d+ XP/.test(await endXp(p)), await endXp(p));
  await p.evaluate(() => EMUI._act("gclose")); await sleep(200);
  /* a take that could not be heard is not counted, and Skip costs nothing */
  await play(p, "speak", { n: 2 });
  await p.evaluate(() => { window.fbTranscribe = async () => ""; });
  await click(p, '[data-em="sprec"]'); await sleep(1500); await click(p, '[data-em="sprec"]'); await sleep(900);
  const empty = await p.evaluate(() => ({ err: (document.querySelector("#emGame .wm-err") || {}).textContent, n: EMUI._game().n, graded: !!EMUI._game().st.graded }));
  ok("G·speak · an unheard take says so and counts nothing (no answer graded)", /could not hear|connection/.test(empty.err || "") && empty.n === 0 && !empty.graded, JSON.stringify(empty));
  await click(p, '[data-em="spskip"]'); await sleep(200);
  ok("G·speak · Skip moves on without grading", await p.evaluate(() => EMUI._game().i === 1 && EMUI._game().n === 0));
  await p.evaluate(() => { EMUI._act("gclose"); window.fbTranscribe = async () => (window.__heard != null ? window.__heard : window.__target || ""); }); await sleep(200);
  /* a partial take: half the words → Hard, not Good */
  await play(p, "speak", { n: 1 });
  await p.evaluate(() => { const C = EMUI._corpus(), G = EMUI._game(), t = C.terms.find(x => x.id === G.ids[G.i]); const s = (t.kind === "sentence" ? t.en : t.ex.en).replace(/…/g, " ").trim().split(/\s+/); window.__heard = s.slice(0, Math.ceil(s.length * 0.6)).join(" "); });
  await click(p, '[data-em="sprec"]'); await sleep(1500); await click(p, '[data-em="sprec"]');
  for (let k = 0; k < 30 && !(await p.evaluate(() => !!document.querySelector(".em-sp-res"))); k++) await sleep(150);
  const part = await p.evaluate(() => ({ miss: document.querySelectorAll(".em-say span.miss").length, score: (document.querySelector(".em-sp-res b") || {}).textContent, last: (EMUI._game().log.slice(-1)[0] || {}) }));
  ok("G·speak · a partial take marks the missing words and is graded below Good", part.miss > 0 && !/100%/.test(part.score || "") && part.last.k === "speak", JSON.stringify(part));
  await p.evaluate(() => EMUI._act("gclose")); await sleep(200);
}

console.log("\n# the daily mission, Real-Life Missions extras, Premium");
{
  const { p } = G1;
  await p.evaluate(() => EMUI._act("daily")); await waitG(p);
  const d = await game(p);
  ok("D1 · the Daily English Mission is a quiz of eight from every stage but First steps", d && d.mode === "quiz" && d.len === 8 && await p.evaluate(() => EMUI._game().ids.every(id => { const t = EMUI._corpus().terms.find(x => x.id === id); return t && t.cat !== "first"; })), JSON.stringify(d));
  await playOut(p); await sleep(600);
  ok("D2 · finishing it pays the daily bonus (+30) from the server", /daily bonus/.test(await endXp(p)), await endXp(p));
  await p.evaluate(() => EMUI._act("gclose")); await sleep(200);
  await p.evaluate(() => EMUI._act("tab", "home")); await sleep(300);
  ok("D3 · the daily card then reads complete", await p.evaluate(() => !!document.querySelector("#v-english .wm-daily.done")));
  /* Real-Life Missions: the coach (AI, labelled) and the next rung of the loop */
  await play(p, "missions", { n: 1 });
  await p.evaluate(() => { const G = EMUI._game(), sc = EMUI._corpus().missions.find(x => x.id === G.ids[0]); document.querySelector(`[data-em="mpick"][data-a="${sc.options.findIndex(o => o.ok)}"]`).click(); }); await sleep(250);
  await p.evaluate(() => { document.getElementById("emCoachIn").value = "Thank you for the invitation but I can't come."; }); await click(p, '[data-em="coach"]'); await sleep(700);
  const co = await p.evaluate(() => ({ out: !!document.querySelector(".wm-coach-out"), better: (document.querySelector(".wm-coach-better") || {}).textContent, ai: /AI/.test((document.querySelector(".wm-coach-out .wm-mut") || {}).textContent || ""), say: !!document.querySelector("#emGame .em-mic") }));
  ok("M1 · the AI coach answers the learner's own words, labelled AI; the 'say it out loud' recorder is there", co.out && co.better && co.ai && co.say, JSON.stringify(co));
  await click(p, '[data-em="next"]'); await sleep(500);
  const links = await p.evaluate(() => ({ partner: !!document.querySelector('#emGame [data-em="partner"]'), avail: ppAvailable(), xp: (document.querySelector("#emEndXp") || {}).textContent }));
  ok("M2 · the end of a Missions round offers the human step (Practice Partner) exactly when Practice Partner is available", links.partner === links.avail && /XP|Saving/.test(links.xp || ""), JSON.stringify(links));
  if (links.partner) { await click(p, '#emGame [data-em="partner"]'); await sleep(400); ok("M3 · that link closes the round and opens Practice Partner", await p.evaluate(() => cur.v === "partner" && !EMUI._game())); await p.evaluate(() => go("english", "home")); await sleep(500); }
  await p.evaluate(() => EMUI._act("gclose")); await sleep(200);
  await p.evaluate(() => EMUI._act("advanced")); await waitG(p); await sleep(300);
  const adv = await game(p);
  ok("P3 · Premium: the advanced situations load from the server pack and play", adv && adv.mode === "missions" && adv.id === "ga-01" && G1.srv.calls.includes("pack:"), JSON.stringify({ adv, calls: G1.srv.calls.slice(-4) }));
  await p.evaluate(() => EMUI._act("gclose")); await sleep(200);
  await p.evaluate(() => EMUI._act("tab", "perf")); await sleep(300);
  ok("P4 · Premium: Game Performance shows the 30/90-day trends, unlocked", await p.evaluate(() => !!document.querySelector("#emTrends") && !document.querySelector("#emTrends.locked")));
  await p.evaluate(() => EMUI._act("trend", "90")); await sleep(200);
  ok("P5 · 90 days redraws 90 bars", await p.evaluate(() => document.querySelectorAll(".wm-actbars.s90 span").length === 90));
  await p.evaluate(() => EMUI._act("tab", "hist")); await sleep(300);
  ok("R1 · History lists the rounds played today, folded by day", await p.evaluate(() => document.querySelectorAll("#v-english .wm-hd").length >= 1 && document.querySelectorAll("#v-english .wm-hr").length >= 8));
  await p.evaluate(() => EMUI._act("tab", "rewards")); await sleep(300);
  ok("R2 · Rewards shows seven skill badges (incl. Speaking and Grammar) and the achievements", await p.evaluate(() => document.querySelectorAll("#v-english .wm-badge").length === 7 && /Speaking/.test(document.querySelector("#v-english .wm-badges").textContent) && document.querySelectorAll("#v-english .wm-ach").length === 10));
  ok("R3 · 'First words out loud' and 'Real-life ready' are earned from the rounds played", await p.evaluate(() => { const s = EMUI._state(); return !!s.ach.first_speak && !!s.ach.first_mission; }));
  const st = await p.evaluate(() => { const s = EMUI._state(); return { xp: s.sx && s.sx.total, hist: s.hist.length, keys: Object.keys(S.wm) }; });
  await p.reload(); await sleep(1800);
  await p.evaluate(() => { FBUser = { uid: "test-user", email: "t@example.com", getIdToken: async () => "test-token" }; });
  const st2 = await p.evaluate(() => { const s = EMUI._state(); return { xp: s.sx && s.sx.total, hist: s.hist.length }; });
  ok("S1 · XP (the server's) and History survive a reload, under S.wm['general-english'] only", st.xp > 0 && st2.xp === st.xp && st2.hist === st.hist && st.keys.join() === "general-english", JSON.stringify({ st, st2 }));
  await p.evaluate(() => go("review")); await sleep(900);
  ok("S2 · the Progress page carries English Mastery's Game Performance card, not Welding's", await p.evaluate(() => !!document.querySelector(".em-perf-card") && !document.querySelector(".wm-perf-card:not(.em)")));
  await p.evaluate(() => go("home")); await sleep(900);
  const hm = await p.evaluate(() => ({ view: (homeSignals().wm || {}).view, tile: !!(typeof homeExploreTiles === "function" ? true : true) }));
  ok("S3 · Home's recommendations read English Mastery's signals (view 'english')", hm.view === "english", JSON.stringify(hm));
  ok("S4 · no page errors on the General English run", G1.errs.length === 0, G1.errs.join(" | "));
  await G1.ctx.close();
}

console.log("\n# Free: sign-in, energy, offline, the programme check");
{
  const U = await open("general-english", { signed: false });
  const { p } = U;
  await hub(p, "home");
  ok("F1 · signed out: the hub shows the sign-in card; browsing works", await p.evaluate(() => !!document.querySelector("#v-english .wm-signin")));
  await p.evaluate(() => EMUI._start("quiz")); await sleep(400);
  ok("F2 · signed out: starting a game asks to sign in and calls no server", await p.evaluate(() => /Sign in to play/.test((document.getElementById("emSheet") || {}).textContent || "")) && !U.srv.calls.some(c => /^start/.test(c)), JSON.stringify(U.srv.calls));
  await U.ctx.close();

  const F = await open("general-english", { plan: "free" });
  await hub(F.p, "home");
  ok("F3 · Free: the energy chip shows 5", await F.p.evaluate(() => (document.querySelector(".wm-stat.en b") || {}).textContent === "5"));
  /* a round with WRONG answers costs one unit, no more */
  await play(F.p, "quiz", { n: 4 });
  for (let i = 0; i < 4; i++) { await F.p.evaluate(async () => { const G = EMUI._game(); const btn = [...document.querySelectorAll('#emGame [data-em="qpick"],#emGame [data-em="gpick"]')].find(b => b.dataset.a !== G.ids[G.i] && !(EMUI._corpus().grammar.find(g => g.id === G.ids[G.i]) && +b.dataset.a === EMUI._corpus().grammar.find(g => g.id === G.ids[G.i]).a)); if (btn) btn.click(); await new Promise(r => setTimeout(r, 140)); const n = document.querySelector('[data-em="next"]'); if (n) n.click(); await new Promise(r => setTimeout(r, 140)); }); }
  await sleep(500);
  ok("F4 · four wrong answers in a round: one unit spent, not four", F.srv.used === 1, F.srv.used);
  await F.p.evaluate(() => EMUI._act("gclose")); await sleep(200);
  for (let i = 0; i < 4; i++) { await play(F.p, "match"); await F.p.evaluate(() => EMUI._act("gclose")); await sleep(150); }
  ok("F5 · five challenge rounds: 5 of 5 used", F.srv.used === 5, F.srv.used);
  await F.p.evaluate(() => EMUI._start("listen")); await sleep(700);
  ok("F6 · the sixth challenge round is refused with the energy sheet (Word Quest and the daily mission stay open)", await F.p.evaluate(() => /energy is used up/.test((document.getElementById("emSheet") || {}).textContent || "")));
  await F.p.evaluate(() => { document.getElementById("emSheet") && document.getElementById("emSheet").remove(); });
  ok("F7 · Word Quest still starts with no energy left", await play(F.p, "cards") && (await game(F.p) || {}).mode === "cards");
  await F.p.evaluate(() => EMUI._act("gclose")); await sleep(200);
  await F.p.evaluate(() => EMUI._act("advanced")); await sleep(600);
  ok("F8 · Free: the advanced situations ask for Premium (no pack downloaded)", await F.p.evaluate(() => /English Mastery Premium/.test((document.getElementById("emSheet") || {}).textContent || "")) && !F.srv.calls.includes("pack:"));
  await F.p.evaluate(() => { document.getElementById("emSheet") && document.getElementById("emSheet").remove(); });
  /* offline: a challenge waits, nothing charged; Word Quest plays without XP */
  F.srv.down = true; const used = F.srv.used;
  await F.p.evaluate(() => EMUI._start("quiz")); await sleep(600);
  ok("F9 · server unreachable: a challenge explains and charges nothing", await F.p.evaluate(() => /No connection/.test((document.getElementById("emSheet") || {}).textContent || "")) && F.srv.used === used);
  await F.p.evaluate(() => { document.getElementById("emSheet") && document.getElementById("emSheet").remove(); });
  await play(F.p, "cards", { n: 5 }); await playOut(F.p); await sleep(300);
  ok("F10 · server unreachable: Word Quest still plays, and says it earned no XP", /offline/.test(await endXp(F.p)), await endXp(F.p));
  await F.p.evaluate(() => EMUI._act("gclose")); F.srv.down = false;
  /* translation: the learner's language (French), machine translation labelled; a Foundations card uses the course's own gloss */
  await F.p.evaluate(() => { S.profile.lang = "fr"; save(); }); await sleep(200);
  await F.p.evaluate(() => EMUI._act("word", "em-p-im-responsible-for")); await sleep(300);
  await click(F.p, '#emSheet [data-em="gloss"]'); await sleep(700);
  const gl = await F.p.evaluate(() => ({ txt: (document.querySelector("#emSheet .em-gl p") || {}).textContent, label: (document.querySelector("#emSheet .em-gl small") || {}).textContent }));
  ok("T1 · Translate (AI) puts the card into the learner's language, labelled machine translation, cached", /Je suis responsable/.test(gl.txt || "") && /(IA|AI)/.test(gl.label || "") && F.srv.tr === 1, JSON.stringify(gl));
  await F.p.evaluate(() => { document.getElementById("emSheet").remove(); EMUI._act("word", "em-f-1-0"); }); await sleep(300);
  const fg = await F.p.evaluate(() => ({ txt: (document.querySelector("#emSheet .em-gl p") || {}).textContent, label: (document.querySelector("#emSheet .em-gl small") || {}).textContent }));
  ok("T2 · a First steps sentence shows the Foundations course's own French, no AI call", /Bonjour/.test(fg.txt || "") && /Foundations/.test(fg.label || "") && F.srv.tr === 1, JSON.stringify(fg));
  await F.p.evaluate(() => { document.getElementById("emSheet") && document.getElementById("emSheet").remove(); S.profile.lang = "en"; save(); });
  /* curriculum order: a learner in week 5 meets weeks 4–6 first; a learner placed in Foundations meets First steps first */
  const al = await F.p.evaluate(() => { window.currentPos = () => ({ w: 5, d: "Mon" }); const ids = EMUI._choose("cards", { onlyNew: true, n: 10 }); const C = EMUI._corpus(); return ids.map(id => C.terms.find(t => t.id === id)).map(t => t.wk); });
  ok("C1 · curriculum order: in week 5, new cards come from weeks 4–6 of the plan first", al.length === 10 && al.every(wk => wk >= 4 && wk <= 6), JSON.stringify(al));
  const fn = await F.p.evaluate(() => { window.fndGated = () => true; const ids = EMUI._choose("cards", { onlyNew: true, n: 6 }); return ids.map(id => EMUI._corpus().terms.find(t => t.id === id).cat); });
  ok("C2 · a learner placed in Foundations meets First steps first", fn.every(c => c === "first"), JSON.stringify(fn));
  ok("F11 · no page errors on the Free run", F.errs.length === 0, F.errs.join(" | "));
  await F.ctx.close();

  const X = await open("general-english", { server: fakeServer({ track: "welding" }) });
  await hub(X.p, "games");
  await X.p.evaluate(() => EMUI._start("quiz")); await sleep(700);
  ok("F12 · an account whose programme is not General English is refused by the server, and told why", await X.p.evaluate(() => /another programme/.test((document.getElementById("emSheet") || {}).textContent || "")));
  await X.ctx.close();
}

console.log("\n# flag off — General English exactly as before");
{
  const O = await open("general-english", { flags: { english_mastery_enabled: false, home_v2_enabled: true } });
  await O.p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(500);
  ok("O1 · flag off: no portal, the Knowledge Boosters as before, the view refuses", await O.p.evaluate(() => !document.querySelector(".em-portal") && document.querySelectorAll(".prac-ex .prac-ex-card").length === 4 && !EMUI.on()));
  ok("O2 · flag off: no server call, nothing stored", !O.srv.calls.length && await O.p.evaluate(() => !(S.wm && S.wm["general-english"])));
  await O.ctx.close();
}

if (process.env.SHOTS) {
  /* SHOTS=<dir>: 390-px pictures of the hub and three games for a visual review (no checks) */
  const dir = process.env.SHOTS, V = await open("general-english", { plan: "free" });
  for (const t of ["home", "games", "journey", "rewards"]) { await hub(V.p, t); await V.p.screenshot({ path: `${dir}/em-${t}.png`, fullPage: true }); }
  for (const m of ["sentence", "speak", "missions"]) { await play(V.p, m); await sleep(500); await V.p.screenshot({ path: `${dir}/em-g-${m}.png` }); await V.p.evaluate(() => EMUI._act("gclose")); await sleep(200); }
  await V.p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(600); await V.p.screenshot({ path: `${dir}/em-practice.png` });
  await V.ctx.close();
}
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
