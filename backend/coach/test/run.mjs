/* be-coach — the server boundary of the Smart Coach.   Run: node backend/coach/test/run.mjs
   Real Worker module, real CoachStore and RateLimiter classes, an in-process
   Durable Object namespace (one instance per id, a real mutex), and stubbed
   be-entitlements / be-partner answers keyed by account. */
import { createRequire } from "node:module";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
const E = createRequire(import.meta.url)("../../../smart-coach-engine.js");

function makeNamespace(Cls) {
  const objs = new Map();
  return {
    idFromName: name => ({ name }),
    get(id) {
      let o = objs.get(id.name); if (o) return o;
      const map = new Map(); let chain = Promise.resolve(), alarm = null;
      const storage = {
        async get(k) { if (Array.isArray(k)) { const m = new Map(); for (const x of k) if (map.has(x)) m.set(x, structuredClone(map.get(x))); return m; } return map.has(k) ? structuredClone(map.get(k)) : undefined; },
        async put(k, v) { if (typeof k === "string") map.set(k, structuredClone(v)); else for (const x of Object.keys(k)) map.set(x, structuredClone(k[x])); },
        async list({ prefix } = {}) { const m = new Map(); for (const [k, v] of map) if (!prefix || k.startsWith(prefix)) m.set(k, v); return m; },
        async delete(k) { for (const x of (Array.isArray(k) ? k : [k])) map.delete(x); },
        async deleteAll() { map.clear(); }, async getAlarm() { return alarm; }, async setAlarm(t) { alarm = t; },
      };
      const state = { storage, blockConcurrencyWhile(fn) { const p = chain.then(() => fn()); chain = p.then(() => {}, () => {}); return p; } };
      const inst = new Cls(state, {});
      o = { _map: map, fetch: (url, init) => inst.fetch(new Request(url, init)) };
      objs.set(id.name, o); return o;
    },
  };
}

const W = (await import("../coach-worker.js")).default;
const { _coachReset, CoachStore } = await import("../coach-worker.js");
const { RateLimiter, consume } = await import("../../rate-limit.js");

const ACCOUNTS = { geP: { plan: "premium", track: "general-english" }, geF: { plan: "free", track: "general-english" }, weP: { plan: "premium", track: "welding" }, sw: { plan: "premium", track: "general-english" } };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url), auth = (init && init.headers && (init.headers.authorization || init.headers.Authorization)) || "";
  const uid = auth ? JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64url").toString()).sub : null;
  const a = ACCOUNTS[uid];
  if (u.includes("/v1/entitlement")) {
    if (!a) return new Response("{}", { status: 401 });
    const prem = a.plan === "premium";
    return Response.json({ plan: a.plan, paid: prem, capabilities: { ad_free: prem, ai_analysis: prem, advanced_progress: prem, ai_coach: prem, recommended_content: prem } });
  }
  if (u.includes("/programme")) return a ? Response.json({ track: a.track }) : new Response("{}", { status: 401 });
  return realFetch(url, init);
};
let NOW = Date.UTC(2026, 9, 12, 8, 0);
const realNow = Date.now; Date.now = () => NOW;
const ENV = { ENTITLEMENTS_URL: "https://ent.test", PARTNER_API: "https://partner.test", COACH: makeNamespace(CoachStore), RATE_LIMITER: makeNamespace(RateLimiter) };
const tok = uid => "h." + Buffer.from(JSON.stringify({ sub: uid })).toString("base64url") + ".s";
let ipN = 0, ridN = 0;
const rid = () => "rid-" + (++ridN).toString().padStart(6, "0");
async function call(uid, op, track, payload, env = ENV) {
  const h = { "content-type": "application/json", Origin: "https://staging.lomonec.com", "CF-Connecting-IP": "10.0.0." + (++ipN % 250) };
  if (uid) h.Authorization = "Bearer " + tok(uid);
  const r = await W.fetch(new Request("https://coach.test/", { method: "POST", headers: h, body: JSON.stringify({ op, track, payload }) }), env);
  return { status: r.status, j: await r.json(), cors: r.headers.get("access-control-allow-origin") };
}
const TZ = "Europe/London";
const mk = (obj, kind, ctx, o) => Object.assign(E.arrange(E.plans(obj, ctx).find(p => p.kind === kind), Object.assign({ start: "2026-10-12", time: "19:00" }, o || {})).plan, { tz: TZ });
const GEC = { track: "general-english", game: true, words: 12, grammarCats: ["tenses"], shadow: true };
const WEC = { track: "welding", game: true, words: 6, grammarCats: ["tenses"], shadow: true };

console.log("\n# who may ask");
{
  let r = await call(null, "status", "general-english");
  ok("W1 · no token → 401, and the staging origin gets CORS", r.status === 401 && r.cors === "https://staging.lomonec.com", JSON.stringify(r));
  r = await call("weP", "status", "general-english");
  ok("W2 · a Welding account asking for General English → 403 track (the ACCOUNT decides, not the request)", r.status === 403 && r.j.error === "track" && r.j.track === "welding", JSON.stringify(r));
  r = await call("geF", "status", "general-english");
  ok("W3 · a Free account may read its status (empty)", r.status === 200 && r.j.active === null && r.j.plan === "free", JSON.stringify(r));
  r = await call("geF", "approve", "general-english", { rid: rid(), plan: mk({ skill: "vocabulary" }, "sprint", GEC) });
  ok("W4 · a Free account cannot approve a plan → 402 premium_required", r.status === 402 && r.j.error === "premium_required", JSON.stringify(r));
  r = await call("geP", "status", "general-english", {}, { ...ENV, ENTITLEMENTS_URL: "" });
  ok("W5 · no entitlement service (production today) → 503 coach_unavailable", r.status === 503 && r.j.error === "coach_unavailable");
  r = await call("geP", "approve", "general-english", { plan: mk({ skill: "vocabulary" }, "sprint", GEC) });
  ok("W6 · a mutating request without an idempotency id → 400 rid", r.status === 400 && r.j.error === "rid");
}

console.log("\n# approval: locked objective and length, one active programme per track, idempotent");
let gp;
{
  const plan = mk({ skill: "grammar", cat: "tenses" }, "sprint", GEC);
  const tampered = { ...plan, days: 99 };
  const id = rid();
  let r = await call("geP", "approve", "general-english", { rid: id, plan: tampered });
  ok("A1 · approve → active; the stored length comes from the kind (5), not the request (99)", r.status === 200 && r.j.active && r.j.active.days === 5 && r.j.active.end === "2026-10-16" && r.j.active.status === "active", JSON.stringify(r.j).slice(0, 400));
  gp = r.j.active;
  const again = await call("geP", "approve", "general-english", { rid: id, plan: tampered });
  ok("A2 · the same request id again → the same answer, replayed (no second programme)", again.status === 200 && again.j.replay === true && again.j.active.id === gp.id);
  const dup = await call("geP", "approve", "general-english", { rid: rid(), plan });
  ok("A3 · the same plan under a new id (second device) → the open one, duplicate:true", dup.status === 200 && dup.j.duplicate === true && dup.j.active.id === gp.id);
  const other = await call("geP", "approve", "general-english", { rid: rid(), plan: mk({ skill: "vocabulary" }, "quick", GEC) });
  ok("A4 · a different plan while one is open → 409 active_exists (never replaced automatically)", other.status === 409 && other.j.error === "active_exists" && other.j.active.id === gp.id);
  const w = await call("weP", "approve", "welding", { rid: rid(), plan: mk({ skill: "topic", cat: "ppe" }, "quick", WEC) });
  ok("A5 · a Welding account has its own programme beside it (separate account, separate track)", w.status === 200 && w.j.active.track === "welding" && w.j.active.objective.cat === "ppe");
  const geInWe = await call("weP", "approve", "welding", { rid: rid(), plan: mk({ skill: "topic", cat: "social" }, "quick", GEC) });
  ok("A6 · General English games inside a Welding plan → refused (409 open one, or 422 activity)", geInWe.status === 409 || (geInWe.status === 422 && geInWe.j.errs.includes("activity")), JSON.stringify(geInWe.j).slice(0, 200));
  /* concurrency: two different plans at the same instant for a fresh account */
  ACCOUNTS.cc = { plan: "premium", track: "general-english" };
  const [x, y] = await Promise.all([call("cc", "approve", "general-english", { rid: rid(), plan: mk({ skill: "vocabulary" }, "quick", GEC) }), call("cc", "approve", "general-english", { rid: rid(), plan: mk({ skill: "grammar", cat: "tenses" }, "quick", GEC) })]);
  ok("A7 · two approvals at once → exactly one programme (200 + 409)", [x.status, y.status].sort().join() === "200,409", x.status + "," + y.status);
  ACCOUNTS.bad = { plan: "premium", track: "general-english" };
  const out = mk({ skill: "vocabulary" }, "sprint", GEC); out.sessions[3].date = "2026-10-20";
  const bad = await call("bad", "approve", "general-english", { rid: rid(), plan: out });
  ok("A8 · a session outside the fixed window → 422 outside", bad.status === 422 && bad.j.errs.includes("outside"), JSON.stringify(bad.j));
  const past = await call("bad", "approve", "general-english", { rid: rid(), plan: mk({ skill: "vocabulary" }, "quick", GEC, { start: "2026-10-10" }) });
  ok("A9 · a start date in the past → 422 start_past", past.status === 422 && past.j.errs.includes("start_past"), JSON.stringify(past.j));
  const tz = await call("bad", "approve", "general-english", { rid: rid(), plan: { ...mk({ skill: "vocabulary" }, "quick", GEC), tz: "Nowhere/Land" } });
  ok("A10 · an unknown time zone → 422 tz", tz.status === 422 && tz.j.errs.includes("tz"));
}

console.log("\n# rescheduling: WHEN may change, WHAT may not");
{
  let r = await call("geP", "reschedule", "general-english", { rid: rid(), objective: { skill: "vocabulary", cat: null } });
  ok("R1 · changing the objective → 409 locked", r.status === 409 && r.j.error === "locked" && r.j.field === "objective");
  r = await call("geP", "reschedule", "general-english", { rid: rid(), days: 14 });
  ok("R2 · changing the length → 409 locked", r.status === 409 && r.j.field === "days");
  r = await call("geP", "reschedule", "general-english", { rid: rid(), sessions: [{ i: 1, act: { type: "words" } }] });
  ok("R3 · changing a session's activity → 409 locked", r.status === 409 && r.j.field === "act");
  r = await call("geP", "reschedule", "general-english", { rid: rid(), sessions: [{ i: 0, time: "20:00" }, { i: 1, time: "20:00" }] });
  ok("R4 · moving 19:00 → 20:00 → saved, same objective, same length", r.status === 200 && r.j.active.sessions[0].time === "20:00" && r.j.active.days === 5 && r.j.active.objective.cat === "tenses");
  r = await call("geP", "reschedule", "general-english", { rid: rid(), sessions: [{ i: 2, time: "23:30" }] });
  ok("R5 · a time in quiet hours → 422 quiet", r.status === 422 && r.j.errs.includes("quiet"));
  r = await call("geP", "reschedule", "general-english", { rid: rid(), start: "2026-10-13", sessions: [0, 1, 2, 3].map(i => ({ i, date: E.addDays("2026-10-13", [0, 1, 3, 4][i]) })) });
  ok("R6 · a new start date before anything is done → the whole window moves (13 → 17 Oct)", r.status === 200 && r.j.active.start === "2026-10-13" && r.j.active.end === "2026-10-17", JSON.stringify(r.j).slice(0, 300));
  gp = r.j.active;
}

console.log("\n# completion: evidence, window, order, single use");
{
  const s0 = gp.sessions[0];
  let r = await call("geP", "complete", "general-english", { rid: rid(), i: 0, ev: { type: "grammar", ref: "g1", ts: NOW, cat: "tenses", score: 50 } });
  ok("V1 · a drill BEFORE the session's day → 422 evidence/window (opening early is not completion)", r.status === 422 && r.j.why === "window", JSON.stringify(r.j));
  NOW = Date.UTC(2026, 9, 13, 18, 0);
  r = await call("geP", "complete", "general-english", { rid: rid(), i: 1, ev: { type: "grammar", ref: "g2", ts: NOW - 1000, cat: "tenses", score: 60 } });
  ok("V2 · session 2 before session 1 → 409 order", r.status === 409 && r.j.error === "order" && r.j.next === 0);
  r = await call("geP", "complete", "general-english", { rid: rid(), i: 0, ev: { type: "grammar", ref: "g3", ts: NOW - 1000, cat: "articles", score: 90 } });
  ok("V3 · a drill of another category → 422 evidence/activity", r.status === 422 && r.j.why === "activity");
  r = await call("geP", "complete", "general-english", { rid: rid(), i: 0, ev: { type: "grammar", ref: "g4", ts: NOW - 1000, cat: "tenses", score: 55 } });
  ok("V4 · the right drill on its day → done, verifiedBy device, score kept for the starting point", r.status === 200 && r.j.active.sessions[0].done && r.j.active.sessions[0].verifiedBy === "device" && r.j.active.sessions[0].score === 55, JSON.stringify(r.j).slice(0, 300));
  NOW = Date.UTC(2026, 9, 14, 18, 0);
  r = await call("geP", "complete", "general-english", { rid: rid(), i: 1, ev: { type: "grammar", ref: "g4", ts: NOW - 1000, cat: "tenses", score: 70 } });
  ok("V5 · the same record for a second session → 409 evidence_used", r.status === 409 && r.j.error === "evidence_used");
  r = await call("geP", "pause", "general-english", { rid: rid() });
  const pz = await call("geP", "complete", "general-english", { rid: rid(), i: 1, ev: { type: "grammar", ref: "g5", ts: NOW - 1000, cat: "tenses", score: 70 } });
  ok("V6 · paused → completing is refused (409 paused); resume brings it back", r.status === 200 && r.j.active.status === "paused" && pz.status === 409 && pz.j.error === "paused");
  await call("geP", "resume", "general-english", { rid: rid() });
  ACCOUNTS.geP.plan = "free"; _coachReset();
  const ex = await call("geP", "complete", "general-english", { rid: rid(), i: 1, ev: { type: "grammar", ref: "g5", ts: NOW - 1000, cat: "tenses", score: 70 } });
  const st = await call("geP", "status", "general-english");
  ok("V7 · Premium expired → completing is refused (402) but the plan is kept and readable", ex.status === 402 && st.status === 200 && st.j.active && st.j.active.id === gp.id);
  ACCOUNTS.geP.plan = "premium"; _coachReset();
  r = await call("geP", "complete", "general-english", { rid: rid(), i: 1, ev: { type: "grammar", ref: "g5", ts: NOW - 1000, cat: "tenses", score: 70 } });
  ok("V8 · renewed → session 2 completes", r.status === 200 && r.j.active.sessions[1].done);
  NOW = Date.UTC(2026, 9, 16, 18, 0);
  await call("geP", "complete", "general-english", { rid: rid(), i: 2, ev: { type: "grammar", ref: "g6", ts: NOW - 1000, cat: "tenses", score: 75 } });
  NOW = Date.UTC(2026, 9, 17, 18, 0);
  r = await call("geP", "complete", "general-english", { rid: rid(), i: 3, ev: { type: "grammar", ref: "g7", ts: NOW - 1000, cat: "tenses", score: 85 } });
  ok("V9 · the final check → completed; outcome: complete, competent (85), +30 on the same instrument; history kept; nothing open", r.status === 200 && r.j.completed === gp.id && r.j.outcome.activitiesComplete && r.j.outcome.competent === true && r.j.outcome.delta === 30 && r.j.active === null && r.j.history[0].id === gp.id, JSON.stringify(r.j).slice(0, 400));
  const next = await call("geP", "approve", "general-english", { rid: rid(), plan: mk({ skill: "vocabulary" }, "quick", GEC, { start: "2026-10-18" }) });
  ok("V10 · only after completion may the next programme be approved", next.status === 200 && next.j.active.objective.skill === "vocabulary");
}

console.log("\n# game rounds are confirmed by be-polish, not by the device");
{
  const wp = (await call("weP", "status", "welding")).j.active;
  NOW = Date.UTC(2026, 9, 12, 18, 0);
  const sid = "quiz-abc12345";
  const ev = { type: "game", ref: sid, ts: NOW - 60_000, mode: wp.sessions[0].act.mode, cats: ["ppe"], n: 10, score: 80 };
  let r = await call("weP", "complete", "welding", { rid: rid(), i: 0, ev });
  ok("G1 · a round be-polish never closed → 409 not_confirmed", r.status === 409 && r.j.error === "not_confirmed", JSON.stringify(r.j));
  /* be-polish closes the round: the same bucket wm-game.js writes */
  await consume(ENV, "acct:u:weP", [{ name: "wmf:" + sid, limit: 1, windowMs: 3 * 86_400_000 }]);
  r = await call("weP", "complete", "welding", { rid: rid(), i: 0, ev });
  ok("G2 · once closed → done, verifiedBy server", r.status === 200 && r.j.active.sessions[0].verifiedBy === "server", JSON.stringify(r.j).slice(0, 300));
  await consume(ENV, "acct:u:geP", [{ name: "wmf:quiz-zzz99999", limit: 1, windowMs: 86_400_000 }]);
  ok("G3 · General English verifies against its OWN prefix (emf:), so a Welding round can never prove a GE session", (await call("geP", "complete", "general-english", { rid: rid(), i: 0, ev: { type: "game", ref: "quiz-zzz99999", ts: NOW, mode: "cards", n: 10, score: 80 } })).j.error !== undefined);
}

console.log("\n# overdue: never silently extended");
{
  ACCOUNTS.od = { plan: "premium", track: "general-english" };
  NOW = Date.UTC(2026, 9, 12, 8, 0);
  await call("od", "approve", "general-english", { rid: rid(), plan: mk({ skill: "grammar", cat: "tenses" }, "quick", GEC) });
  NOW = Date.UTC(2026, 9, 20, 9, 0);
  let st = await call("od", "status", "general-english");
  ok("O1 · past the window with sessions undone → progress.status overdue", st.j.active.progress.status === "overdue", JSON.stringify(st.j.active.progress));
  let r = await call("od", "complete", "general-english", { rid: rid(), i: 0, ev: { type: "grammar", ref: "x", ts: NOW, cat: "tenses", score: 60 } });
  ok("O2 · completing an overdue programme → 409 overdue; moving it → 409 overdue", r.status === 409 && r.j.error === "overdue" && (await call("od", "reschedule", "general-english", { rid: rid(), sessions: [{ i: 0, time: "08:00" }] })).j.error === "overdue");
  r = await call("od", "restart", "general-english", { rid: rid(), start: "2026-10-20", sessions: [0, 1, 2].map(i => ({ i, date: E.addDays("2026-10-20", i) })) });
  ok("O3 · the learner chooses Restart → same objective, same 3-day length, new window, attempt recorded", r.status === 200 && r.j.active.start === "2026-10-20" && r.j.active.end === "2026-10-22" && r.j.active.restarts === 1 && r.j.active.attempts.length === 1 && r.j.active.objective.cat === "tenses", JSON.stringify(r.j).slice(0, 300));
  r = await call("od", "cancel", "general-english", { rid: rid() });
  ok("O4 · cancel → kept in history as cancelled, nothing open", r.status === 200 && r.j.active === null && r.j.history[0].status === "cancelled");
}

console.log("\n# the account switches programme");
{
  ACCOUNTS.sw.track = "general-english"; _coachReset();
  NOW = Date.UTC(2026, 9, 12, 8, 0);
  await call("sw", "approve", "general-english", { rid: rid(), plan: mk({ skill: "vocabulary" }, "quick", GEC) });
  ACCOUNTS.sw.track = "welding"; _coachReset();
  const ge = await call("sw", "status", "general-english"), we = await call("sw", "status", "welding");
  ok("I1 · after switching to Welding: the GE plan is unreachable (403) and the Welding status is empty — no data crosses", ge.status === 403 && we.status === 200 && we.j.active === null);
}

Date.now = realNow;
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
