/* Nudge Engine — unit tests (pure).   Run: cd tests && node nudge-engine.test.mjs */
import { createRequire } from "node:module";
const E = createRequire(import.meta.url)("../nudge-engine.js");
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const NOW = Date.UTC(2026, 8, 23, 17), H = 3_600_000, D = 24 * H;
const base = () => ({ ge: true, now: NOW, pos: { w: 3, d: "Wed", topic: "Clear updates", done: false }, practicedToday: false, daysAway: 0, wordsReady: 0, trouble: 0, weakest: null, challenge: null, partner: { available: false, consented: false, waiting: 0 }, aiCoach: true });

console.log("\n# rules — each reads real evidence, each points at an existing activity");
{
  const r = E.best(base());
  ok("N1 · today's lesson not done → the lesson, deep link session(3,'Wed'), curriculum reference, 25 min", r.kind === "lesson" && r.view === "session" && r.args[0] === 3 && r.args[1] === "Wed" && r.curriculum.topic === "Clear updates" && r.minutes === 25 && r.messageKey === "nudge.lesson", JSON.stringify(r));
  ok("N2 · a structured record: reason, skill, activity, priority, confidence, minutes, expiry, deep link, message key", ["reason", "skill", "activity", "priority", "confidence", "minutes", "expiresInMs", "view", "messageKey", "rid"].every(k => r[k] != null), Object.keys(r).join(","));
  const back = E.best({ ...base(), daysAway: 4 });
  ok("N3 · four days away → 'comeback' on the same lesson, 5 minutes", back.kind === "comeback" && back.args[0] === 3 && back.minutes === 5 && /inactive_4d/.test(back.reason), JSON.stringify(back));
  const w = E.best({ ...base(), practicedToday: true, wordsReady: 7 });
  ok("N4 · practised today, 7 words due → word review (practice / study-due), n=7", w.kind === "words" && w.view === "practice" && w.act === "study-due" && w.vars.n === 7, JSON.stringify(w));
  ok("N5 · fewer than 3 words due → no word nudge", !E.candidates({ ...base(), wordsReady: 2 }).some(x => x.kind === "words"));
  const ch = E.best({ ...base(), practicedToday: true, challenge: { vid: "abcdefghijk", title: "Steve Jobs at Stanford — commencement", ts: NOW - D, pass: false } });
  ok("N6 · a Challenge not passed this week → that clip (shadow / clip / vid)", ch.kind === "challenge" && ch.view === "shadow" && ch.act === "clip" && ch.args[0] === "abcdefghijk", JSON.stringify(ch));
  ok("N7 · a passed Challenge, or one older than a week, → nothing", !E.candidates({ ...base(), challenge: { vid: "x", ts: NOW, pass: true } }).some(x => x.kind === "challenge") && !E.candidates({ ...base(), challenge: { vid: "x", ts: NOW - 8 * D, pass: false } }).some(x => x.kind === "challenge"));
  const pn = E.best({ ...base(), practicedToday: true, partner: { available: true, consented: true, waiting: 2 } });
  ok("N8 · a partner waiting → Practice Partner, sent 10 min later, expires in 90 min", pn.kind === "partner_now" && pn.view === "partner" && pn.delayMs === 10 * 60_000 && pn.expiresInMs === 90 * 60_000, JSON.stringify(pn));
  const ps = E.candidates({ ...base(), partner: { available: true, consented: true, waiting: 0, streakWeeks: 3, practisedThisWeek: false } }).find(x => x.kind === "partner_streak");
  ok("N9 · a 3-week streak not yet kept this week → partner_streak", ps && ps.vars.n === 3);
  const ai = E.candidates({ ...base(), partner: { available: true, consented: true, waiting: 0, daysSincePartner: 5 } }).find(x => x.kind === "ai_coach");
  ok("N10 · consented, nobody free, no partner practice for 5 days → the AI coach (partner / ai)", ai && ai.act === "ai");
  ok("N11 · every candidate's kind is a known kind with a message key", E.candidates({ ...base(), wordsReady: 9, trouble: 5, challenge: { vid: "v", ts: NOW, pass: false }, partner: { available: true, consented: true, waiting: 1, streakWeeks: 2 } }).every(x => E.KINDS.includes(x.kind)));
}

console.log("\n# ranking, weakest skill, cooldowns");
{
  const s = { ...base(), practicedToday: true, wordsReady: 4, trouble: 4, weakest: "pronunciation" };
  const r = E.rank(s);
  ok("R1 · the weakest competency lifts its action: pronunciation weak → Shadow above 4 words due", r[0].kind === "shadow", r.map(x => x.kind + ":" + x.score.toFixed(1)).join(" "));
  const big = E.rank({ ...s, wordsReady: 12 });
  ok("R1b · … but a large review backlog (12 words) still comes first", big[0].kind === "words", big.map(x => x.kind + ":" + x.score.toFixed(1)).join(" "));
  const hist = { sent: { lesson: NOW - 10 * H } };
  ok("R2 · a lesson nudge sent 10 h ago is not sent again (48 h per kind)", E.best(base(), hist) === null || E.best(base(), hist).kind !== "lesson");
  ok("R3 · a swiped-away kind stays quiet for 7 days", !E.rank(base(), { dismissed: { lesson: NOW - 3 * D } }).some(x => x.kind === "lesson") && E.rank(base(), { dismissed: { lesson: NOW - 8 * D } }).some(x => x.kind === "lesson"));
  ok("R4 · deterministic: same state → same winner and rid", JSON.stringify(E.best(base())) === JSON.stringify(E.best(base())));
}

console.log("\n# completed-action invalidation");
{
  const r = E.best(base());
  ok("I1 · the lesson recommendation is satisfied once the learner practised today", E.satisfied(r, { ...base(), practicedToday: true }) && !E.satisfied(r, base()));
  const w = E.best({ ...base(), practicedToday: true, wordsReady: 6 });
  ok("I2 · the words recommendation is satisfied once fewer than 3 are due", E.satisfied(w, { ...base(), wordsReady: 1 }) && !E.satisfied(w, { ...base(), wordsReady: 6 }));
  const pn = E.best({ ...base(), practicedToday: true, partner: { available: true, consented: true, waiting: 1 } });
  ok("I3 · 'a partner is free' is void once nobody is waiting", E.satisfied(pn, { ...base(), partner: { available: true, waiting: 0 } }));
}

console.log("\n# General English only");
{
  ok("G1 · a Welding learner gets no recommendation at all, whatever the signals", E.candidates({ ...base(), ge: false, wordsReady: 20, trouble: 9, partner: { available: true, consented: true, waiting: 3 } }).length === 0 && E.best({ ...base(), ge: false }) === null);
}
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
