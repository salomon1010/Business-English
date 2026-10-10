/* Smart Coach engine — unit tests (pure).   Run: cd tests && node smart-coach-engine.test.mjs */
import { createRequire } from "node:module";
const E = createRequire(import.meta.url)("../smart-coach-engine.js");
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const NOW = Date.UTC(2026, 9, 12, 9), D = 86_400_000;
const GE = { track: "general-english", game: true, words: 12, grammarCats: ["tenses", "articles"], shadow: true };
const WE = { track: "welding", game: true, words: 6, grammarCats: ["tenses"], shadow: true };
const sig = o => Object.assign({ track: "general-english", now: NOW, vocab: { saved: 0, ready: 0, quiz: [] }, game: null, trouble: { n: 0, words: [] }, shadow: { scores: [] }, grammar: [], history: [] }, o);

console.log("\n# evidence → priority");
{
  const a = E.analyse(sig({}), GE);
  ok("C1 · no evidence at all → a diagnostic, never a guessed weakness", a.priority.skill === "diagnostic" && !a.sufficient && a.priority.evidence[0].k === "sc.ev_none", JSON.stringify(a));
  const thin = E.analyse(sig({ vocab: { ready: 8, quiz: [] } }), GE);
  ok("C2 · one weak signal and fewer than 3 measured activities → diagnostic (sc.ev_thin when something was measured)", thin.priority.skill === "diagnostic", JSON.stringify(thin.priority));
  const pr = E.analyse(sig({ trouble: { n: 6, words: ["schedule", "thorough", "rural"] }, shadow: { scores: [80, 78, 77, 66, 64, 60] } }), GE);
  ok("C3 · six trouble words + falling Shadow scores → pronunciation, with the learner's own numbers", pr.priority.skill === "pronunciation" && pr.priority.evidence.some(e => e.k === "sc.ev_trouble" && e.vars.n === 6 && /schedule/.test(e.vars.words)) && pr.priority.evidence.some(e => e.k === "sc.ev_shadow_drop" && e.vars.from === 78 && e.vars.to === 63), JSON.stringify(pr.priority));
  const gr = E.analyse(sig({ grammar: [{ cat: "tenses", runs: 3, best: 70, last: [60, 50] }], shadow: { scores: [90, 92, 88] } }), GE);
  ok("C4 · a grammar category under 70 % twice → grammar on THAT category, recurring", gr.priority.skill === "grammar" && gr.priority.cat === "tenses" && gr.priority.recurring && gr.priority.evidence.some(e => e.k === "sc.ev_gram_rep"), JSON.stringify(gr.priority));
  const nocat = E.analyse(sig({ grammar: [{ cat: "phrasal", runs: 3, last: [40, 40] }], shadow: { scores: [90, 92, 88] } }), GE);
  ok("C5 · a grammar category the track has no drill for is not proposed", nocat.priority.skill !== "grammar", JSON.stringify(nocat.priority));
  const w = E.analyse(sig({ track: "welding", game: { answers: 60, due: 2, cats: [{ id: "ppe", open: 4 }, { id: "tools", open: 3 }], skills: [] } }), WE);
  ok("C6 · Welding: open errors in PPE → the safety category first, with the safety reason", w.priority.skill === "topic" && w.priority.cat === "ppe" && w.priority.evidence.some(e => e.k === "sc.ev_safety"), JSON.stringify(w.priority));
  ok("C7 · a candidate needing the game hub is dropped when the hub is not reachable", E.analyse(sig({ track: "welding", game: { answers: 60, cats: [{ id: "ppe", open: 6 }], skills: [] } }), { ...WE, game: false }).priority.skill !== "topic");
  ok("C8 · an unknown track gets nothing", E.candidates(sig({ track: "plumbing", trouble: { n: 9, words: [] } })).length === 0);
}

console.log("\n# history → the next step");
{
  const base = { grammar: [{ cat: "tenses", runs: 3, last: [65] }], vocab: { ready: 12, quiz: [60, 62, 64] }, shadow: { scores: [90, 90, 90] } };
  const failed = E.analyse(sig({ ...base, history: [{ status: "completed", skill: "vocabulary", cat: null, kind: "sprint", endedAt: NOW - D, outcome: { start: 55, final: 62, competent: false, delta: 7 } }] }), GE);
  ok("H1 · a failed final check → reinforce the same skill, one size up (sprint → mastery)", failed.priority.skill === "vocabulary" && failed.priority.reinforce === "sprint" && E.recommendKind(failed.priority) === "mastery" && failed.priority.evidence[0].k === "sc.ev_reinforce", JSON.stringify(failed.priority));
  const passed = E.analyse(sig({ ...base, history: [{ status: "completed", skill: "vocabulary", cat: null, kind: "sprint", endedAt: NOW - D, outcome: { start: 60, final: 90, competent: true, delta: 30 } }] }), GE);
  ok("H2 · a skill passed yesterday rests → the next objective is a different one", passed.priority.skill !== "vocabulary", JSON.stringify(passed.priority));
  const old = E.analyse(sig({ shadow: { scores: [90, 90, 90] }, grammar: [{ cat: "articles", runs: 2, last: [95] }], history: [{ status: "completed", skill: "grammar", cat: "tenses", kind: "quick", endedAt: NOW - 12 * D, outcome: { competent: true } }] }), GE);
  ok("H3 · a skill passed 12 days ago and nothing weaker → a spaced review, Quick Boost", old.priority.skill === "grammar" && old.priority.review && E.recommendKind(old.priority) === "quick" && old.priority.evidence.some(e => e.k === "sc.ev_review" && e.vars.d === 12), JSON.stringify(old));
  ok("H4 · a cancelled programme is not an outcome", E.candidates(sig({ history: [{ status: "cancelled", skill: "vocabulary", outcome: { competent: false } }] })).length === 0);
}

console.log("\n# three plans, one objective");
{
  const obj = { skill: "vocabulary", cat: null };
  const ps = E.plans(obj, GE, "2026-10-12");
  ok("P1 · quick / sprint / mastery for the same objective", ps.map(p => p.kind).join() === "quick,sprint,mastery" && ps.every(p => p.objective.skill === "vocabulary"));
  ok("P2 · lengths 3 / 5 / 14 days; 3 / 4 / 7 sessions", ps.map(p => p.days).join() === "3,5,14" && ps.map(p => p.sessions.length).join() === "3,4,7");
  ok("P3 · sprint and mastery start AND end with the same measured instrument; quick has no check", ps[0].sessions.every(s => s.role === "practice") && [1, 2].every(k => { const s = ps[k].sessions; return s[0].role === "start" && s[s.length - 1].role === "check" && JSON.stringify(s[0].act) === JSON.stringify(s[s.length - 1].act); }));
  ok("P4 · the plans differ in more than length: activity sequences are not identical", JSON.stringify(ps[0].sessions.map(s => s.act)) !== JSON.stringify(ps[1].sessions.map(s => s.act).slice(0, 3)));
  ok("P5 · a diagnostic is only ever a Quick Boost", E.plans({ skill: "diagnostic" }, GE, "2026-10-12").map(p => p.kind).join() === "quick");
  const wp = E.plans({ skill: "topic", cat: "defects" }, WE, "2026-10-12");
  ok("P6 · Welding topic plans use Welding games only, on that category", wp.every(p => p.sessions.every(s => s.act.type === "game" && E.GAME_MODES.welding.includes(s.act.mode) && s.act.cat === "defects")));
  ok("P7 · every generated plan validates", [...ps, ...wp].every(p => { const a = E.arrange(p, { start: "2026-10-12", time: "19:00" }).plan; return E.validate(a, { today: "2026-10-12", track: p === wp[0] || wp.includes(p) ? "welding" : "general-english" }).length === 0; }));
}

console.log("\n# schedule: editable dates and times, locked objective and length");
{
  const p = E.plans({ skill: "grammar", cat: "tenses" }, GE)[1];
  const a = E.arrange(p, { start: "2026-10-13", time: "20:00" }).plan;
  ok("S1 · arrange: start Tue 13 → end Sat 17 (5 days fixed), sessions on day 0,1,3,4 at 20:00", a.start === "2026-10-13" && a.end === "2026-10-17" && a.sessions.map(s => s.date).join() === "2026-10-13,2026-10-14,2026-10-16,2026-10-17" && a.sessions.every(s => s.time === "20:00"), JSON.stringify(a.sessions));
  const wd = E.arrange(E.plans({ skill: "grammar", cat: "tenses" }, GE)[2], { start: "2026-10-12", time: "19:00", weekdays: [1, 3, 5, 6] });
  ok("S2 · weekdays Mon/Wed/Fri/Sat inside the 14-day window → 7 sessions only on those days", wd.plan && wd.plan.sessions.every(s => [1, 3, 5, 6].includes(E.weekday(s.date))) && wd.plan.end === "2026-10-25", JSON.stringify(wd));
  const few = E.arrange(E.plans({ skill: "grammar", cat: "tenses" }, GE)[2], { start: "2026-10-12", time: "19:00", weekdays: [0] });
  ok("S3 · Sundays only cannot hold 7 sessions in 14 days → error few_days, need 7, have 2", few.error === "few_days" && few.need === 7 && few.have === 2, JSON.stringify(few));
  const bad = JSON.parse(JSON.stringify(a)); bad.days = 7;
  ok("S4 · a changed duration is refused", E.validate(bad, { today: "2026-10-12", track: "general-english" }).includes("duration"));
  const out = JSON.parse(JSON.stringify(a)); out.sessions[3].date = "2026-10-19";
  ok("S5 · a session moved outside the fixed window is refused", E.validate(out, { today: "2026-10-12", track: "general-english" }).includes("outside"));
  const ord = JSON.parse(JSON.stringify(a)); ord.sessions[1].date = "2026-10-13";
  ok("S6 · two sessions on one day / out of order is refused", E.validate(ord, { today: "2026-10-12", track: "general-english" }).includes("order"));
  const q = JSON.parse(JSON.stringify(a)); q.sessions[0].time = "23:15";
  ok("S7 · a time in quiet hours (22:00–07:00) is refused", E.validate(q, { today: "2026-10-12", track: "general-english" }).includes("quiet"));
  ok("S8 · a start in the past / more than 14 days ahead is refused", E.validate(a, { today: "2026-10-14", track: "general-english" }).includes("start_past") && E.validate(a, { today: "2026-09-20", track: "general-english" }).includes("start_far"));
  const swap = JSON.parse(JSON.stringify(a)); swap.objective.cat = "articles";
  ok("S9 · lockedOf: moving dates/times keeps the lock, changing the category does not", E.lockedOf(a) === E.lockedOf(E.arrange(a, { start: "2026-10-14", time: "08:00" }).plan) && E.lockedOf(swap) !== E.lockedOf(a));
  const ge = E.arrange(E.plans({ skill: "topic", cat: "social" }, GE)[0], { start: "2026-10-12", time: "19:00" }).plan;
  ok("S10 · a General English game in a Welding programme is refused (track isolation)", E.validate(ge, { today: "2026-10-12", track: "welding" }).includes("activity") === ge.sessions.some(s => !E.GAME_MODES.welding.includes(s.act.mode)));
  const easy = JSON.parse(JSON.stringify(a)); easy.sessions[1].act = { type: "words" };
  ok("S11 · a grammar programme cannot swap a drill for an easier activity (curriculum destination locked)", E.validate(easy, { today: "2026-10-12", track: "general-english" }).includes("activity"));
  const swapCheck = JSON.parse(JSON.stringify(a)); swapCheck.sessions[3].act = { type: "grammar", cat: "articles" };
  ok("S12 · the final check must be the starting check's instrument", E.validate(swapCheck, { today: "2026-10-12", track: "general-english" }).length > 0);
}

console.log("\n# time zones and daylight saving");
{
  const L = "Europe/London";
  ok("T1 · 19:00 in London on 12 Oct (BST) is 18:00 UTC", E.atOf("2026-10-12", "19:00", L) === Date.UTC(2026, 9, 12, 18));
  ok("T2 · 19:00 in London on 26 Oct (after the clocks go back) is 19:00 UTC", E.atOf("2026-10-26", "19:00", L) === Date.UTC(2026, 9, 26, 19));
  ok("T3 · New York across 1 Nov 2026: 19:00 = 23:00 UTC before, 00:00 UTC after", E.atOf("2026-10-31", "19:00", "America/New_York") === Date.UTC(2026, 9, 31, 23) && E.atOf("2026-11-02", "19:00", "America/New_York") === Date.UTC(2026, 10, 3, 0));
  ok("T4 · localParts round-trips through atOf (Tokyo, no DST)", JSON.stringify(E.localParts(E.atOf("2026-10-12", "07:30", "Asia/Tokyo"), "Asia/Tokyo")) === JSON.stringify({ date: "2026-10-12", time: "07:30" }));
  ok("T5 · an invalid time zone is refused", !E.tzOk("Mars/Olympus") && E.tzOk("Africa/Douala"));
}

console.log("\n# sessions, missed, completion, outcome");
{
  const tz = "Europe/London";
  const p = E.arrange(E.plans({ skill: "grammar", cat: "tenses" }, GE)[1], { start: "2026-10-12", time: "19:00" }).plan;
  Object.assign(p, { tz, status: "active", approvedAt: Date.UTC(2026, 9, 12, 8) });
  const s0 = p.sessions[0];
  ok("M1 · before its day → upcoming; on its day before 19:00 → today; after → due", E.sessionState(s0, Date.UTC(2026, 9, 11, 12), tz) === "upcoming" && E.sessionState(s0, Date.UTC(2026, 9, 12, 12), tz) === "today" && E.sessionState(s0, Date.UTC(2026, 9, 12, 20), tz) === "due");
  ok("M2 · still due the next day; missed only after the end of the following day", E.sessionState(s0, Date.UTC(2026, 9, 13, 22), tz) === "due" && E.sessionState(s0, Date.UTC(2026, 9, 13, 23, 1), tz) === "missed");
  const recs = [
    { type: "grammar", ref: "g1", ts: Date.UTC(2026, 9, 11, 10), cat: "tenses", score: 50 },   // before the programme: never counts
    { type: "grammar", ref: "g2", ts: Date.UTC(2026, 9, 12, 19, 5), cat: "articles", score: 90 }, // wrong category
    { type: "grammar", ref: "g3", ts: Date.UTC(2026, 9, 12, 19, 10), cat: "tenses", score: 55 },
  ];
  const e0 = E.evidenceFor(p, s0, recs, []);
  ok("M3 · evidence: only a drill of the SAME category, inside the session's window", e0 && e0.ref === "g3", JSON.stringify(e0));
  ok("M4 · a record already used by another session cannot prove a second one", E.evidenceFor(p, s0, recs, ["grammar:g3"]) === null);
  ok("M5 · opening is not completion: no record → no evidence", E.evidenceFor(p, s0, [], []) === null);
  const early = E.evidenceFor(p, p.sessions[1], [{ type: "grammar", ref: "g4", ts: Date.UTC(2026, 9, 12, 20), cat: "tenses", score: 70 }], []);
  ok("M6 · a drill done the day BEFORE a session's date does not complete it", early === null);
  const game = { type: "game", mode: "quiz", cat: "ppe" };
  ok("M7 · a game round counts only with 5+ answers, the planned game and category", E.matches(game, { type: "game", mode: "quiz", n: 10, cats: ["ppe"], score: 80 }) && !E.matches(game, { type: "game", mode: "quiz", n: 4, cats: ["ppe"], score: 80 }) && !E.matches(game, { type: "game", mode: "cards", n: 10, cats: ["ppe"], score: 80 }) && !E.matches(game, { type: "game", mode: "quiz", n: 10, cats: ["tools"], score: 80 }));
  p.sessions.forEach((s, i) => { s.done = true; s.score = [55, null, null, 85][i]; });
  const o = E.outcome(p);
  ok("M8 · outcome keeps three answers apart: activities complete, competent (85 ≥ 80), improvement +30 on the same instrument", o.activitiesComplete && o.competent === true && o.delta === 30 && o.start === 55 && o.final === 85, JSON.stringify(o));
  const q = E.arrange(E.plans({ skill: "vocabulary" }, GE)[0], { start: "2026-10-12", time: "19:00" }).plan; q.sessions.forEach(s => s.done = true);
  ok("M9 · a Quick Boost has no check: complete, but competence and improvement are not claimed (null)", E.outcome(q).activitiesComplete && E.outcome(q).competent === null && E.outcome(q).delta === null);
  const p2 = E.arrange(E.plans({ skill: "grammar", cat: "tenses" }, GE)[1], { start: "2026-10-12", time: "19:00" }).plan; Object.assign(p2, { tz, status: "active", approvedAt: 0 });
  ok("M10 · progress: unfinished after the window closes → overdue (never silently extended)", E.progress(p2, Date.UTC(2026, 9, 18, 0)).status === "overdue" && E.progress(p2, Date.UTC(2026, 9, 17, 12)).status === "active");
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
