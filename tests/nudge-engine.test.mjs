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

console.log("\n# Home rows — content relationships and the 'Because you…' rules (2026-09-27)");
{
  const C = { videos: {
      v01_intro_at_: { title: "How to introduce yourself at work with confidence", cat: "everyday", dur: 300, cap: "human" },
      v02_small_tlk: { title: "Small talk and networking: first impressions", cat: "everyday", dur: 400, cap: "auto" },
      v03_network__: { title: "Networking in English — introductions that land", cat: "everyday", dur: 500, cap: "human" },
      v04_pron_strs: { title: "Clear pronunciation: word stress and rhythm", cat: "skills", dur: 500, cap: "human" },
      v05_accent___: { title: "Accent training: the sounds of American English", cat: "skills", dur: 700, cap: "human" },
      v06_intonatn_: { title: "Intonation for fluent speech", cat: "skills", dur: 600, cap: null },
      v07_status_mt: { title: "Running a status update meeting", cat: "meetings", dur: 600, cap: "human" },
      v08_agenda___: { title: "Setting the agenda: how to lead a meeting", cat: "meetings", dur: 800, cap: "auto" },
      v09_idioms___: { title: "Business idioms and expressions you hear every day", cat: "skills", dur: 500, cap: "human" },
      v10_convo____: { title: "Better conversation questions in English", cat: "everyday", dur: 500, cap: "human" },
      v11_long_lect: { title: "A two-hour lecture on introductions", cat: "everyday", dur: 7200, cap: "human" },
      v12_disagree_: { title: "Disagreeing politely in a meeting", cat: "meetings", dur: 450, cap: "human" },
      v13_stress___: { title: "Word stress drills for clear speech", cat: "skills", dur: 350, cap: "human" },
    }, weeks: [{ n: 1, theme: "Introductions, role clarity & speech baseline", goal: "Build your baseline", days: { Mon: { focus: "Pronunciation baseline" } } }, { n: 2, theme: "Project updates & status communication", goal: "Give clear updates", days: { Mon: { focus: "Status update" } } }],
    starters: [{ vid: "UF8uR6Z6KLc", name: "Steve Jobs — Stanford", cap: true }] };
  ok("R1 · topicsOf places a lesson on its topics from its own words", E.topicsOf("Introductions, role clarity & speech baseline").join() === "introductions,pronunciation" && E.topicsOf("Running a status update meeting").includes("meetings") && !E.topicsOf("zzz").length, E.topicsOf("Introductions, role clarity & speech baseline").join());
  const rel = E.related(C, { vid: "v01_intro_at_" });
  ok("R2 · related(): clips sharing the seed's topic words, best first, the seed itself excluded, deterministic", rel.length === 3 && !rel.some(x => x.vid === "v01_intro_at_") && rel[0].vid === "v02_small_tlk" && rel[1].vid === "v03_network__" && rel.map(x => x.vid).join() === E.related(C, { vid: "v01_intro_at_" }).map(x => x.vid).join(), JSON.stringify(rel));
  ok("R3 · a two-hour lecture ranks below a short clip on the same topic", rel.findIndex(x => x.vid === "v11_long_lect") > rel.findIndex(x => x.vid === "v02_small_tlk") || !rel.some(x => x.vid === "v11_long_lect"), rel.map(x => x.vid).join());
  const relCh = E.related(C, { vid: "v04_pron_strs" }, { challenge: true });
  ok("R4 · for the Challenge only clips with captions are offered (the Challenge needs their lines)", relCh.length && relCh.every(x => x.cap) && !relCh.some(x => x.vid === "v06_intonatn_"), JSON.stringify(relCh));
  ok("R5 · exclude keeps clips the learner already has out", !E.related(C, { vid: "v01_intro_at_" }, { exclude: ["v03_network__"] }).some(x => x.vid === "v03_network__"));
  const S0 = { ge: true, now: NOW, pos: { w: 1, d: "Mon", done: false }, wordsReady: 0, partner: {}, recent: {} };
  const r0 = E.rows(S0, C);
  ok("R6 · a brand-new learner: one 'start' row (curriculum discovery), never a 'because you'", r0.length === 1 && r0[0].id === "start" && r0[0].reason === "new_learner" && r0[0].items[0].type === "session" && r0[0].items[0].args.join() === "1,Mon" && r0[0].items.some(x => x.vid === "UF8uR6Z6KLc"), JSON.stringify(r0));
  ok("R7 · not General English → no rows at all", !E.rows({ ...S0, ge: false }, C).length);
  const S1 = { ge: true, now: NOW, pos: { w: 2, d: "Mon", done: false }, wordsReady: 4, troubleWords: ["thorough", "schedule"], partner: { available: true, consented: true }, aiCoach: true,
    recent: { challengePassed: { vid: "v07_status_mt", title: "Running a status update meeting", ts: NOW - D }, shadowed: { vid: "v04_pron_strs", title: "Clear pronunciation: word stress and rhythm", ts: NOW - H, recorded: true }, seen: ["v07_status_mt", "v04_pron_strs"], weekDone: 1, phrasesMastered: 5, partnerAt: NOW - D } };
  const r1 = E.rows(S1, C);
  ok("R8 · at most three rows, three items each, best evidence first: the passed Challenge, then the shadowed clip, then the trouble words", r1.length === 3 && r1.map(r => r.id).join() === "challenge_done,shadowed,trouble" && r1.every(r => r.items.length <= 3 && r.items.length >= 1), JSON.stringify(r1.map(r => [r.id, r.items.length])));
  ok("R9 · the Challenge row names the clip that was passed and offers Challenge-capable clips on its subject, opened in the Challenge", r1[0].vars.title === "Running a status update meeting" && r1[0].items.every(x => x.type === "challenge" && x.challenge && x.view === "shadow" && x.act === "clip" && x.args[0] === x.vid && C.videos[x.vid].cap) && r1[0].items.some(x => x.vid === "v08_agenda___"), JSON.stringify(r1[0]));
  ok("R10 · a clip already seen (history, saved, last open) is never offered again", !r1.some(r => r.items.some(x => x.vid && S1.recent.seen.includes(x.vid))));
  ok("R11 · a clip is offered once across the rows", (() => { const v = r1.flatMap(r => r.items.map(x => x.vid).filter(Boolean)); return new Set(v).size === v.length; })(), JSON.stringify(r1.map(r => r.items.map(x => x.vid))));
  ok("R12 · the trouble row: the words themselves in the reason, Shadow's trouble tab first, then the words due, then a pronunciation clip", r1[2].vars.words.includes("thorough") && r1[2].items[0].type === "trouble" && r1[2].items[0].act === "trouble" && r1[2].items[1].type === "words" && r1[2].items[1].n === 4 && r1[2].items[2] && r1[2].items[2].type === "video", JSON.stringify(r1[2]));
  ok("R12b · a clip title in a heading: leading emoji dropped, cut at a word with an ellipsis, never longer than ~57 characters", E.clipTitle("\uD83D\uDC44 What is 'shadowing'? Pronunciation Shadowing Tutorial") === "What is 'shadowing'? Pronunciation Shadowing Tutorial" && E.clipTitle("Sound Fluent & Professional: English Phrases for Meetings & Presentations at Work") === "Sound Fluent & Professional: English Phrases for\u2026" && E.clipTitle("short") === "short", JSON.stringify([E.clipTitle("\uD83D\uDC44 What is 'shadowing'? Pronunciation Shadowing Tutorial"), E.clipTitle("Sound Fluent & Professional: English Phrases for Meetings & Presentations at Work")]));
  const r2 = E.rows({ ...S1, recent: { ...S1.recent, challengePassed: null, shadowed: null }, troubleWords: [] }, C);
  ok("R13 · a finished week: the next session on the road map, a clip on the new week's theme, a partner — and the week named", r2[0].id === "week_done" && r2[0].vars.n === 1 && r2[0].items[0].type === "session" && r2[0].items[0].args.join() === "2,Mon" && r2[0].items.some(x => x.vid === "v07_status_mt" || x.vid === "v08_agenda___") && r2[0].items.some(x => x.type === "partner"), JSON.stringify(r2[0]));
  ok("R14 · mastered expressions → Phrase Lab first, then clips full of expressions; a partner session → keep talking", r2.some(r => r.id === "phrases" && r.items[0].type === "phrases" && r.items[0].view === "phrases" && r.items.some(x => x.vid === "v09_idioms___")) && (r2.length === 3 || E.rows({ ...S1, recent: { partnerAt: NOW - D } }, C).some(r => r.id === "partner_done")), JSON.stringify(r2.map(r => r.id)));
  const old = E.rows({ ...S1, recent: { ...S1.recent, challengePassed: { ...S1.recent.challengePassed, ts: NOW - 20 * D } }, troubleWords: [] }, C);
  ok("R15 · a Challenge passed three weeks ago no longer drives a row; an opened-but-not-recorded clip says 'opened', not 'shadowed'", !old.some(r => r.id === "challenge_done") && E.rows({ ...S0, recent: { shadowed: { vid: "v04_pron_strs", title: "x", ts: NOW, recorded: false } } }, C)[0].id === "opened", JSON.stringify(old.map(r => r.id)));
  ok("R16 · no library index yet (offline first paint): rows that need clips wait, the ones that do not still come", (() => { const r = E.rows(S1, { videos: {}, weeks: C.weeks }); return !r.some(x => x.id === "challenge_done") && r.some(x => x.id === "trouble"); })());
}
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
