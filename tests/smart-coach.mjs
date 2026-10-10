/* Smart Coach — the app against the REAL be-coach Worker (run in this process).
   Run: cd tests && PORT=8961 node smart-coach.mjs
   The page's requests to the coach are answered by backend/coach/coach-worker.js with its real
   CoachStore and RateLimiter classes; only be-entitlements / be-partner (who is Premium, which
   programme the account is on) are stood in for. Covers both programmes. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const PORT = +(process.env.PORT || 8961);
const root = new URL("..", import.meta.url).pathname;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 500)}`); };

/* ---- the server, in process ---- */
function makeNamespace(Cls) {
  const objs = new Map();
  return { idFromName: name => ({ name }), get(id) {
    let o = objs.get(id.name); if (o) return o;
    const map = new Map(); let chain = Promise.resolve(), alarm = null;
    const storage = { async get(k) { if (Array.isArray(k)) { const m = new Map(); for (const x of k) if (map.has(x)) m.set(x, structuredClone(map.get(x))); return m; } return map.has(k) ? structuredClone(map.get(k)) : undefined; },
      async put(k, v) { if (typeof k === "string") map.set(k, structuredClone(v)); else for (const x of Object.keys(k)) map.set(x, structuredClone(k[x])); },
      async delete(k) { for (const x of (Array.isArray(k) ? k : [k])) map.delete(x); }, async deleteAll() { map.clear(); }, async getAlarm() { return alarm; }, async setAlarm(t) { alarm = t; }, async list() { return new Map(map); } };
    const state = { storage, blockConcurrencyWhile(fn) { const p = chain.then(() => fn()); chain = p.then(() => {}, () => {}); return p; } };
    const inst = new Cls(state, {}); o = { fetch: (u, i) => inst.fetch(new Request(u, i)) }; objs.set(id.name, o); return o; } };
}
const W = (await import("../backend/coach/coach-worker.js")).default;
const { CoachStore, _coachReset } = await import("../backend/coach/coach-worker.js");
const { RateLimiter, consume } = await import("../backend/rate-limit.js");
const ACC = {};
const nodeFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url), auth = (init && init.headers && (init.headers.authorization || init.headers.Authorization)) || "";
  const a = ACC[auth.slice(7)];
  if (u.includes("/v1/entitlement")) return a ? Response.json({ plan: a.plan, paid: a.plan === "premium", capabilities: { ad_free: a.plan === "premium" } }) : new Response("{}", { status: 401 });
  if (u.includes("/programme")) return a ? Response.json({ track: a.track }) : new Response("{}", { status: 401 });
  return nodeFetch(url, init);
};
const ENV = { ENTITLEMENTS_URL: "https://ent.test", PARTNER_API: "https://partner.test", COACH: makeNamespace(CoachStore), RATE_LIMITER: makeNamespace(RateLimiter) };
const tokFor = uid => "h." + Buffer.from(JSON.stringify({ sub: uid })).toString("base64url") + ".s";
const seen = [];

/* the shell's BEPush, with the local-notification methods */
const BRIDGE = perm => {
  const be = window.__push = { perm, sched: [] };
  const P = { available: async () => ({ available: true, permission: be.perm }), permission: async () => ({ permission: be.perm }), register: async () => { throw Object.assign(new Error("no"), { code: "denied" }); },
    pendingTap: async () => ({ tap: null }), clear: async () => {}, addListener: () => ({ remove() {} }), removeAllListeners: async () => {},
    coachSchedule: async o => { if (o.ask && be.perm === "default") be.perm = be.answer || "granted"; be.sched.push(o); return { scheduled: be.perm === "granted" ? o.items.length : 0, permission: be.perm }; } };
  const a = (window.Capacitor = window.Capacitor || {}); a.getPlatform = () => "ios"; a.isNativePlatform = () => true;
  (a.Plugins = a.Plugins || {}).BEPush = P;
  (a.PluginHeaders = a.PluginHeaders || []).push({ name: "BEPush", methods: ["available", "permission", "register", "pendingTap", "clear", "coachSchedule"].map(n => ({ name: n, rtype: "promise" })) });
};

const b = await chromium.launch();
const NOW = Date.now(), DAY = 864e5;
async function open({ track = "general-english", uid, plan = "premium", accTrack, state = {}, ios = false, perm = "granted", premium = true, lang = "en" }) {
  ACC[tokFor(uid)] = { plan, track: accTrack || track }; _coachReset();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", timezoneId: "Europe/London" });
  await ctx.addInitScript(([s, tr]) => {
    localStorage.setItem("be12_v1", s); localStorage.setItem("be_coach_api", "https://coach.test");
    localStorage.setItem("be_flags", JSON.stringify({ smart_coach_enabled: true, english_mastery_enabled: true, welding_mastery_enabled: true }));
  }, [JSON.stringify(Object.assign({ profile: { name: "Alex", lang, ts: 1 }, professionalTracks: { activeId: track },
    fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: NOW, lastSeen: NOW, reminder: { on: false, time: "19:00" } }, state)), track]);
  if (ios) await ctx.addInitScript(BRIDGE, perm);
  await ctx.route(/coach\.test/, async r => {
    const q = r.request();
    if (q.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "POST" } });
    const headers = { "content-type": "application/json", Origin: "http://localhost:8000", "CF-Connecting-IP": "10.1.1." + (seen.length % 200), authorization: "Bearer " + tokFor(uid) };
    let body = {}; try { body = JSON.parse(q.postData() || "{}"); } catch (e) {}
    seen.push({ uid, op: body.op, track: body.track });
    const out = await W.fetch(new Request("https://coach.test/", { method: "POST", headers, body: q.postData() || "{}" }), ENV);
    return r.fulfill({ status: out.status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: await out.text() });
  });
  await ctx.route(u => /be-events|be-partner|be-push|cloudflareinsights|entitlements|gstatic|be-polish|be-widget/.test(u.href), r => r.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`); await sleep(1800);
  await p.evaluate(prem => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,.lang-modal-ov,#fndCheckOv,#pfSetupOv").forEach(e => e.remove());
    FBUser = { uid: "u", getIdToken: async () => "x" }; planOn = () => true; entIsPremiumForDisplay = () => prem; premOffered = () => true; }, premium);
  return { ctx, p, errs };
}
const txt = async p => p.evaluate(() => (document.getElementById("scBody") || {}).innerText || "");

console.log("\n# General English — evidence, proposal, locked fields, approval");
{
  const t = NOW - 2 * DAY;
  const { ctx, p, errs } = await open({ uid: "ge1", state: { gramA: { "general-english": { tenses: { best: 62, runs: 2, hist: [{ t, p: 55 }, { t: t + 1000, p: 50 }] } } }, quizHistA: { "general-english": [{ t, p: 90 }, { t, p: 88 }] } } });
  await p.evaluate(() => pfSetupSheet("setRem", "Daily reminder")); await sleep(800);
  const sheet = await p.evaluate(() => { const o = document.getElementById("pfSetupOv"); return o ? { card: !!o.querySelector(".sc-entry"), remOn: !!o.querySelector("#remOn"), gcal: /calGoogle/.test(o.innerHTML), ics: /calDownload/.test(o.innerHTML) } : null; });
  ok("G1 · the Daily reminder sheet carries the Smart Coach card, and keeps the reminder switch and BOTH calendar buttons", sheet && sheet.card && sheet.remOn && sheet.gcal && sheet.ics, JSON.stringify(sheet));
  await p.evaluate(() => document.querySelector("#pfSetupOv .sc-entry").click()); await sleep(1500);
  let body = await txt(p);
  ok("G2 · the priority is the learner's real weakness, with their own numbers (Grammar · tenses, 50 %, under 70 % twice)", /Grammar/.test(body) && /50 %/.test(body) && /under 70 % twice/.test(body), body.slice(0, 600));
  ok("G3 · the recommended plan shows its length as FIXED, its sessions, minutes, exact dates, how it is judged and when it is complete", /Focus Sprint|Mastery Cycle/.test(body) && /Fixed/.test(body) && /How the result is judged/.test(body) && /It is complete when/.test(body) && /about \d+ min/.test(body), body.slice(0, 900));
  await p.evaluate(() => document.querySelector('[data-sc="alts"]').click()); await sleep(200);
  body = await txt(p);
  ok("G4 · 'Not for me' offers the two OTHER plans, same focus", (body.match(/Choose this plan/g) || []).length === 2 && /Grammar/.test(body), body.slice(0, 400));
  await p.evaluate(() => document.querySelector('[data-sc="pick"][data-k="mastery"]').click()); await sleep(150);
  await p.evaluate(() => document.querySelector('[data-sc="review"]').click()); await sleep(200);
  const ed = await p.evaluate(() => { const el = document.getElementById("scBody"); return { focusInput: el.querySelectorAll('[data-sc-in="focus"],[data-sc-in="kind"],[data-sc-in="days"]').length, locks: el.querySelectorAll(".sc-locked .sc-lock").length, rows: el.querySelectorAll(".sc-edit li").length, text: el.innerText }; });
  ok("G5 · the editor: focus and duration are shown locked (no control for them); 7 session rows with date + time", ed.focusInput === 0 && ed.locks === 2 && ed.rows === 7 && /Chosen by your coach/.test(ed.text), JSON.stringify(ed).slice(0, 300));
  await p.evaluate(() => { const i = document.querySelector('[data-sc-in="time"][data-i="1"]'); i.value = "23:15"; i.dispatchEvent(new Event("change", { bubbles: true })); }); await sleep(100);
  const quiet = await p.evaluate(() => ({ err: (document.querySelector("#scBody .sc-note.warn") || {}).innerText || "", dis: document.querySelector('[data-sc="approve"]').disabled }));
  ok("G6 · a session at 23:15 → a plain error and Approve is disabled", /22:00 and 07:00/.test(quiet.err) && quiet.dis, JSON.stringify(quiet));
  await p.evaluate(() => { const i = document.querySelector('[data-sc-in="time"][data-i="1"]'); i.value = "20:00"; i.dispatchEvent(new Event("change", { bubbles: true })); }); await sleep(100);
  await p.evaluate(() => { for (const d of [1, 2, 3, 4, 5, 6]) document.querySelector(`[data-sc="wd"][data-d="${d}"]`).click(); }); await sleep(100);
  const few = await p.evaluate(() => (document.querySelector("#scBody .sc-note.warn") || {}).innerText || "");
  ok("G7 · Sundays only cannot hold 7 sessions in the fixed 14-day window → explained, not stretched", /needs 7/.test(few) && /14-day/.test(few), few);
  await p.evaluate(() => { for (const d of [1, 2, 3, 4, 5, 6]) document.querySelector(`[data-sc="wd"][data-d="${d}"]`).click(); }); await sleep(100);
  const before = seen.filter(x => x.op === "approve").length;
  ok("G8 · nothing is sent to the server before the learner approves", before === 0);
  await p.evaluate(() => document.querySelector('[data-sc="approve"]').click()); await sleep(900);
  body = await txt(p);
  const srvState = await p.evaluate(() => { const b = aMap("coach"); return b.srv && b.srv.active && { kind: b.srv.active.kind, days: b.srv.active.days, n: b.srv.active.sessions.length, t1: b.srv.active.sessions[1].time }; });
  ok("G9 · approved on the server: Mastery Cycle, 14 days, 7 sessions, the moved time kept (20:00); the dashboard shows 0 of 7 verified", srvState && srvState.kind === "mastery" && srvState.days === 14 && srvState.n === 7 && srvState.t1 === "20:00" && /0 of 7 verified/.test(body), JSON.stringify(srvState) + body.slice(0, 200));

  /* opening is not completing */
  await p.evaluate(() => document.querySelector('[data-sc="start"]').click()); await sleep(900);
  const drill = await p.evaluate(() => !!document.querySelector("#gxOpts"));
  await p.evaluate(() => pvClose()); await sleep(1800);
  const after = await p.evaluate(() => aMap("coach").srv.active.sessions[0].done || false);
  ok("G10 · Start opens the grammar drill on THAT category; closing it unfinished leaves the session incomplete", drill && after === false, JSON.stringify({ drill, after }));
  /* a finished drill proves it */
  await p.evaluate(() => document.querySelector("#pfSetupOv") && document.querySelector("#pfSetupOv").remove());
  await p.evaluate(() => { SmartCoach.open(); }); await sleep(900);
  await p.evaluate(() => document.querySelector('[data-sc="start"]').click()); await sleep(800);
  for (let i = 0; i < 10; i++) { const more = await p.evaluate(async () => { const o = document.querySelector("#gxOpts:not([data-done]) .pv-opt"); if (!o) return !!document.querySelector("#gxOpts"); o.click(); return true; }); if (!more) break; await sleep(2500); }
  await sleep(2500);
  const s0 = await p.evaluate(() => { const a = aMap("coach").srv.active; return a && a.sessions[0]; });
  ok("G11 · the finished drill is the evidence: session 1 done on the server, 'from your saved result', its score kept as the starting point", s0 && s0.done === true && s0.verifiedBy === "device" && typeof s0.score === "number", JSON.stringify(s0));
  body = await p.evaluate(() => { SmartCoach.open(); return new Promise(r => setTimeout(() => r((document.getElementById("scBody") || {}).innerText || ""), 1200)); });
  ok("G12 · back on the dashboard: 1 of 7 verified, the session labelled 'from your saved result'", /1 of 7 verified/.test(body) && /from your saved result/.test(body), body.slice(0, 400));
  const icsTxt = await p.evaluate(() => SmartCoach._ics(aMap("coach").srv.active));
  ok("G13 · calendar file: one event per REMAINING session, each with a stable UID", (icsTxt.match(/BEGIN:VEVENT/g) || []).length === 6 && (icsTxt.match(/UID:cp-[a-z0-9-]+-\d@coach\.lomonec\.com/g) || []).length === 6, icsTxt.slice(0, 300));
  /* a second approval is refused while this one is open */
  const second = await p.evaluate(async () => { const r = await fetch("https://coach.test/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "approve", track: "general-english", payload: { rid: "r-abcdefgh1", plan: { kind: "quick", objective: { skill: "vocabulary" }, start: "2099-01-01", tz: "Europe/London", sessions: [] } } }) }); return r.status; });
  ok("G14 · one open plan per programme: another approval → 409", second === 409, second);
  /* the server refuses a forged completion even if the page asks */
  const forged = await p.evaluate(async () => { const r = await fetch("https://coach.test/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "complete", track: "general-english", payload: { rid: "r-forged0001", i: 1, ev: { type: "grammar", ref: "fake", ts: Date.now(), cat: "tenses", score: 100 } } }) }); return [r.status, (await r.json()).error]; });
  ok("G15 · a forged completion for a session whose day has not come → refused (422 evidence)", forged[0] === 422 && forged[1] === "evidence", JSON.stringify(forged));
  ok("G16 · no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Free plan and no evidence");
{
  const { ctx, p, errs } = await open({ uid: "free1", plan: "free", premium: false });
  await p.evaluate(() => SmartCoach.open()); await sleep(1300);
  const body = await txt(p);
  const btn = await p.evaluate(() => !!document.querySelector('[data-sc="review"]'));
  ok("F1 · no measured results → a diagnostic, said plainly (never a guessed weakness)", /no measured results yet/.test(body) && /Find your starting point/.test(body), body.slice(0, 300));
  ok("F2 · Free: the recommendation and its evidence are readable; scheduling shows the Premium offer instead", !btn && /part of Premium/.test(body), body.slice(0, 500));
  const r = await p.evaluate(async () => { const r = await fetch("https://coach.test/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "approve", track: "general-english", payload: { rid: "r-free00001", plan: {} } }) }); return r.status; });
  ok("F3 · and the server refuses a Free approval whatever the page does (402)", r === 402, r);
  ok("F4 · no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Welding — its own evidence, its own games, notifications on iPhone");
{
  /* General English data present in the SAME save must not leak into Welding's recommendation */
  const t = NOW - DAY;
  const { ctx, p, errs } = await open({ track: "welding", uid: "we1", ios: true, perm: "default", state: { gramA: { "general-english": { tenses: { runs: 3, hist: [{ t, p: 20 }, { t, p: 20 }] } } }, troubleA: { "general-english": { schedule: 4, thorough: 3, rural: 3 } } } });
  const sig = await p.evaluate(async () => { const s = await SmartCoach._signals(); return { track: s.sig.track, gram: s.sig.grammar.length, trouble: s.sig.trouble.n, game: !!s.sig.game }; });
  ok("W1 · Welding signals read Welding records only (General English grammar / trouble words are not there)", sig.track === "welding" && sig.gram === 0 && sig.trouble === 0 && sig.game === true, JSON.stringify(sig));
  /* give Welding real evidence: open errors in the PPE category, from Welding Mastery rounds */
  await p.evaluate(async () => { await WMUI._load(); const st = WMUI._state(), C = WMUI._corpus(); const ppe = C.terms.filter(x => x.cat === "ppe").slice(0, 5);
    st.hist.push({ id: "quiz-seed00001", m: "quiz", ts: Date.now() - 3600e3, end: Date.now() - 3500e3, n: 10, ok: 5, xp: 0, cats: ["ppe"], it: ppe.map(x => ({ o: 0, t: x.id, s: "recognition", k: "q" })) }); save(); });
  await p.evaluate(() => SmartCoach.open()); await sleep(1500);
  let body = await txt(p);
  ok("W2 · Welding priority: PPE vocabulary, with the safety reason", /Vocabulary · /.test(body) && /safety terms/.test(body), body.slice(0, 500));
  await p.evaluate(() => document.querySelector('[data-sc="review"]').click()); await sleep(200);
  const acts = await p.evaluate(() => SmartCoach._V.draft.sessions.map(s => s.act.type + ":" + s.act.mode + ":" + s.act.cat).join(","));
  ok("W3 · every session is a Welding Mastery game on the PPE category (no Shadow Studio, no Partner)", acts.split(",").every(a => /^game:(cards|quiz|visual|listen|builder|match|workshop):ppe$/.test(a)), acts);
  await p.evaluate(() => document.querySelector('[data-sc="approve"]').click()); await sleep(1000);
  const sched = await p.evaluate(() => window.__push.sched.slice(-1)[0]);
  const prog = await p.evaluate(() => aMap("coach").srv.active);
  const future = prog.sessions.filter(s => Date.parse(s.date + "T" + s.time + ":00") > Date.now()).length;
  ok("W4 · approval asks iOS for permission ON the approval (ask:true) and schedules one notification per future session, unique ids", sched && sched.ask === true && sched.items.length === future && new Set(sched.items.map(i => i.id)).size === sched.items.length, JSON.stringify(sched).slice(0, 300));
  ok("W5 · the lock-screen text names no score, no skill, no mistake — just the session", sched.items.every(i => /^Session \d of \d is ready · about \d+ minutes\.$/.test(i.body) && !/ppe|PPE|%/.test(i.body + i.title)), JSON.stringify(sched.items[0]));
  ok("W6 · each item carries the wall-clock date and time (DST-safe calendar trigger on the device)", sched.items.every(i => i.year && i.month && i.day && i.hour >= 7 && i.hour < 22 && i.coach.startsWith(prog.id + ":")));
  /* a round the server never closed is not completion; once be-polish closes it, it is */
  const s0 = prog.sessions[0];
  await p.evaluate(m => { const st = WMUI._state(); st.hist.push({ id: m.sid, m: m.mode, ts: Date.now(), end: Date.now() + 1000, n: 10, ok: 9, xp: 20, cats: ["ppe"], it: [] }); save(); }, { sid: "quiz-play0001", mode: s0.act.mode });
  await p.evaluate(() => SmartCoach.check(true)); await sleep(1200);
  const pend = await p.evaluate(() => ({ done: aMap("coach").srv.active.sessions[0].done || false, pend: JSON.stringify(aMap("coach").pend || {}) }));
  ok("W7 · a finished round the server has NOT confirmed → still not done, shown as waiting for confirmation", pend.done === false && /confirm/.test(pend.pend), JSON.stringify(pend));
  await consume(ENV, "acct:u:we1", [{ name: "wmf:quiz-play0001", limit: 1, windowMs: 3 * DAY }]);
  await sleep(3800);
  const d0 = await p.evaluate(() => aMap("coach").srv.active.sessions[0]);
  ok("W8 · once be-polish has closed that round → done, confirmed by the server", d0.done === true && d0.verifiedBy === "server", JSON.stringify(d0));
  const after = await p.evaluate(() => window.__push.sched.slice(-1)[0].items.length);
  ok("W9 · the notifications are re-synced: the completed session's reminder is gone (replace, never add)", after === sched.items.length - (Date.parse(s0.date + "T" + s0.time + ":00") > Date.now() ? 1 : 0), after + " vs " + sched.items.length);
  await p.evaluate(() => { document.getElementById("scOv") && document.getElementById("scOv").remove(); pushTapRoute({ coach: "x:1", view: "coach" }); }); await sleep(900);
  ok("W10 · tapping a Smart Coach notification opens the Smart Coach dashboard", await p.evaluate(() => !!document.getElementById("scOv")));
  /* pause → notifications cleared; cancel → history */
  await p.evaluate(() => document.querySelector('[data-sc="pause"]').click()); await sleep(800);
  ok("W11 · Pause clears every pending Smart Coach notification", await p.evaluate(() => window.__push.sched.slice(-1)[0].items.length === 0) && /Paused/.test(await txt(p)));
  ok("W12 · no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# isolation on the server, offline, notifications denied");
{
  /* the same account, now on General English, cannot see Welding's plan */
  const { ctx, p, errs } = await open({ uid: "we1", track: "general-english", accTrack: "general-english", ios: true, perm: "denied" });
  await p.evaluate(() => SmartCoach.open()); await sleep(1300);
  const a = await p.evaluate(() => aMap("coach").srv && aMap("coach").srv.active);
  ok("I1 · the same account on General English: no Welding plan crosses (its GE status is empty)", a === null || a === undefined, JSON.stringify(a));
  await ctx.setOffline(true); await p.evaluate(() => SmartCoach.open()); await sleep(1000);
  const off = await txt(p);
  ok("I2 · offline: said plainly; nothing claims to be saved", /You are offline/.test(off), off.slice(0, 300));
  await ctx.setOffline(false);
  ok("I3 · no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
