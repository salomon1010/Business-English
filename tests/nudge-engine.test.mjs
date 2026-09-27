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
  /* the eight-row model (owner, 27 Sep 2026): one hero + up to eight conditional rows */
  C.videos.v14_toy_story = { title: "Learn English with TOY STORY — Meet Woody", cat: "everyday", dur: 420, cap: "human", ch: "Learn English With TV Series" };
  C.videos.v15_lion_king = { title: "Learn English with the LION KING — Simba", cat: "everyday", dur: 380, cap: "human", ch: "Learn English With TV Series" };
  C.videos.v16_coco_____ = { title: "Learn English with Disney's COCO", cat: "everyday", dur: 400, cap: "auto", ch: "Learn English With TV Series" };
  C.videos.v17_rambling_ = { title: "How to organize your thoughts (stop rambling)", cat: "skills", dur: 500, cap: "human", ch: "Speak Confident English" };
  C.videos.v18_fillers__ = { title: "Stop using fillers: sound confident", cat: "skills", dur: 330, cap: "human", ch: "Speak Confident English" };
  C.days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  C.scenarios = [{ id: "iv-tellme", title: "Tell me about yourself", persona: "Rachel", cat: "interview" }, { id: "neighbour", title: "Meeting a neighbour", persona: "Tom", cat: "daily" },
    { id: "standup", title: "Daily stand-up", persona: "Priya", cat: "work" }, { id: "oneone", title: "One-to-one with your manager", persona: "Sara", cat: "work" }, { id: "coffee", title: "In the coffee shop", persona: "Mia", cat: "daily" }];
  C.missions = { 2: { vid: "v07_status_mt" } };
  const VIEWS = ["shadow", "session", "practice", "partner", "phrasebank", "roleplay"];
  const exact = it => VIEWS.includes(it.view) && it.cid && (
    (it.type === "video" || it.type === "challenge") ? it.act === "clip" && it.args[0] === it.vid && (!!C.videos[it.vid] || C.starters.some(x => x.vid === it.vid)) || (it.saved && it.args[0] === it.vid)
    : it.type === "session" ? it.args.length === 2 && C.weeks.some(w => w.n === it.args[0]) && C.days.includes(it.args[1])
    : it.type === "roleplay" ? C.scenarios.some(x => x.id === it.args[0])
    : it.type === "phrases" ? it.view === "phrasebank" && it.args[0] >= 1
    : it.type === "trouble" ? it.act === "trouble" : it.type === "words" ? it.act === "study-due" : it.type === "partner" ? it.act === "match" : it.type === "ai" ? it.act === "ai" : false);
  const S0 = { ge: true, now: NOW, pos: { w: 1, d: "Mon", done: false }, wordsReady: 0, partner: {}, recent: { any: false } };
  const r0 = E.rows(S0, C);
  ok("R6 · a brand-new learner: 'Start here — Week 1 path' and 'Recommended for your level' only, no 'because you' evidence row", r0.map(r => r.id + ":" + (r.variant || "")).join() === "learning:new,level:" && r0[0].items[0].type === "session" && r0[0].items[0].args.join() === "1,Mon" && r0[0].items.some(x => x.vid === "UF8uR6Z6KLc") && r0.every(r => r.items.every(exact)), JSON.stringify(r0));
  ok("R7 · not General English → no rows at all", !E.rows({ ...S0, ge: false }, C).length);
  const S1 = { ge: true, now: NOW, pos: { w: 2, d: "Tue", done: false }, daysAway: 0, wordsReady: 4, troubleWords: ["thorough", "schedule"], partner: { available: true, consented: true }, aiCoach: true, weakest: "pronunciation",
    recent: { any: true, weekDone: 1, speakAway: 0,
      watched: { vid: "v14_toy_story", title: "Learn English with TOY STORY — Meet Woody", ts: NOW - 2 * H, secs: 240 },
      practiced: { kind: "shadow", vid: "v04_pron_strs", title: "Clear pronunciation: word stress and rhythm", ts: NOW - H },
      feedback: { need: "fluency", src: "session", ts: NOW - 3 * H, words: [] },
      challengeFailed: { vid: "v12_disagree_", title: "Disagreeing politely in a meeting", ts: NOW - D, fails: 2 },
      saved: { words: 6, newest: ["leverage", "milestone"], clips: [] },
      partner: { kind: "roleplay", ts: NOW - D, sid: "standup", title: "Daily stand-up", persona: "Priya", cat: "work", topic: "Project updates" },
      seen: ["v14_toy_story", "v04_pron_strs", "v12_disagree_"] } };
  const r1 = E.rows(S1, C);
  ok("R8 · an active learner with every kind of evidence sees all eight row types, 2–3 cards each", r1.length === 7 && E.ROW_IDS.filter(id => id !== "inactive").every(id => r1.some(r => r.id === id)) && r1.every(r => r.items.length >= 2 && r.items.length <= 3), JSON.stringify(r1.map(r => [r.id, r.variant, r.items.length])));
  const r1b = E.rows({ ...S1, daysAway: 4, practicedToday: false }, C);
  ok("R8b · … and after four days away the eighth ('haven't practised') joins — and leads: the strongest signal first", r1b.length === 8 && r1b[0].id === "inactive" && r1b[0].vars.n === 4 && r1b.every((r, i) => i === 0 || r1b[i - 1].score >= r.score), JSON.stringify(r1b.map(r => [r.id, r.score])));
  ok("R9 · every card is a specific piece of content with its exact deep link (clip → that clip, session → that day, scenario → that scenario, expressions → that week)", r1b.every(r => r.items.every(exact)), JSON.stringify(r1b.flatMap(r => r.items.filter(x => !exact(x)))));
  ok("R10 · a clip already seen (history, saved, watched, last open) is never offered as a new clip, and no clip twice across the rows", (() => { const v = r1b.flatMap(r => r.items.filter(x => x.type === "video" && !x.saved).map(x => x.vid)); return new Set(v).size === v.length && !v.some(x => S1.recent.seen.includes(x)); })(), JSON.stringify(r1b.map(r => r.items.map(x => x.vid))));
  const wat = r1.find(r => r.id === "watched");
  ok("R11 · 'watched' quotes the clip that actually played and offers its relations — the story clips reach each other through the channel and category, not title words", wat && wat.vars.title.startsWith("Learn English with TOY STORY") && wat.items.every(x => x.type === "video") && wat.items.some(x => x.vid === "v15_lion_king"), JSON.stringify(wat));
  ok("R12 · 'watched' needs verified playback: 10 seconds, or a clip only opened, produce no watched row", !E.rows({ ...S1, recent: { ...S1.recent, watched: { ...S1.recent.watched, secs: 10 } } }, C).some(r => r.id === "watched") && !E.rows({ ...S1, recent: { ...S1.recent, watched: null } }, C).some(r => r.id === "watched"));
  const st = r1.find(r => r.id === "struggled");
  ok("R13 · 'struggled': the Challenge missed twice comes back first, in the Challenge, with shorter Challenge clips beside it", st && st.variant === "challenge" && st.items[0].vid === "v12_disagree_" && st.items[0].challenge && st.items.slice(1).every(x => x.type === "challenge" || x.type === "trouble"), JSON.stringify(st));
  const stw = E.rows({ ...S1, recent: { ...S1.recent, challengeFailed: null } }, C).find(r => r.id === "struggled");
  ok("R14 · … without a failed Challenge, the trouble words themselves: quoted in the heading, Shadow's trouble tab first, then the words due", stw && stw.variant === "words" && stw.vars.words.includes("thorough") && stw.items[0].type === "trouble" && stw.items[1].type === "words" && stw.items[1].n === 4, JSON.stringify(stw));
  const pr = r1.find(r => r.id === "practiced");
  ok("R15 · 'practiced' a Shadow take → that same clip in the Challenge first (progression), then related clips", pr && pr.variant === "shadow" && pr.items[0].vid === "v04_pron_strs" && pr.items[0].challenge, JSON.stringify(pr));
  const fb = r1.find(r => r.id === "feedback");
  ok("R16 · 'feedback' fluency → captioned clips about fillers and rambling (remediation), opened in Shadow", fb && fb.variant === "fluency" && fb.items.some(x => x.vid === "v17_rambling_" || x.vid === "v18_fillers__"), JSON.stringify(fb));
  const fbw = E.rows({ ...S1, recent: { ...S1.recent, feedback: { need: "words", src: "shadow", ts: NOW - H, vid: "v13_stress___", title: "Word stress drills for clear speech", words: ["thorough"] } } }, C).find(r => r.id === "feedback");
  ok("R17 · 'feedback' words from a Shadow report → the Challenge on that clip, then the trouble words", fbw && fbw.items[0].vid === "v13_stress___" && fbw.items[0].challenge && fbw.items.some(x => x.type === "trouble") && fbw.vars.words.includes("thorough"), JSON.stringify(fbw));
  const ln = r1.find(r => r.id === "learning");
  ok("R18 · 'learning' after Week 1 is finished: Week 2 named, its session, its own mission clip, its expressions — each exact", ln && ln.variant === "week_done" && ln.vars.n === 2 && ln.vars.done === 1 && ln.items[0].type === "session" && ln.items[0].args.join() === "2,Tue" && ln.items.some(x => x.vid === "v07_status_mt"), JSON.stringify(ln));
  const lnH = E.rows({ ...S1, heroCid: "w2Tue" }, C).find(r => r.id === "learning");
  ok("R19 · the hero is never repeated: with today's session as the hero, no row offers that session", !E.rows({ ...S1, heroCid: "w2Tue" }, C).some(r => r.items.some(x => x.cid === "w2Tue")) && lnH && lnH.items.length >= 2, JSON.stringify(lnH));
  const pw = r1.find(r => r.id === "partner");
  ok("R20 · 'practised with' a role-play character → that conversation again, then the next scenario on the subject", pw && pw.variant === "roleplay" && pw.vars.persona === "Priya" && pw.items[0].type === "roleplay" && pw.items[0].args[0] === "standup" && pw.items[1].type === "roleplay" && pw.items[1].args[0] !== "standup", JSON.stringify(pw));
  const pwp = E.rows({ ...S1, recent: { ...S1.recent, partner: { kind: "partner", ts: NOW - D, topic: "x" } } }, C).find(r => r.id === "partner");
  ok("R21 · … with a human partner → find a partner (the match flow) and the AI coach", pwp && pwp.items[0].type === "partner" && pwp.items[0].act === "match" && pwp.items.some(x => x.type === "ai"), JSON.stringify(pwp));
  const sv = r1.find(r => r.id === "saved");
  ok("R22 · 'saved' words → the words in review, then this week's expressions; the saved words are quoted", sv && sv.variant === "words" && sv.items[0].type === "words" && sv.items[0].act === "study-due" && sv.items.some(x => x.type === "phrases" && x.args[0] === 2) && sv.vars.words.includes("leverage"), JSON.stringify(sv));
  const svc = E.rows({ ...S1, recent: { ...S1.recent, saved: { words: 0, clips: [{ vid: "v10_convo____", title: "Better conversation questions in English", start: 30, end: 75 }] } } }, C).find(r => r.id === "saved");
  ok("R23 · a saved clip opens that exact clip at its saved span (start / end)", svc && svc.variant === "clips" && svc.items[0].args.join() === "v10_convo____,30,75", JSON.stringify(svc));
  const six = NOW - 6 * D - H, sp = E.rows({ ...S1, recent: { ...S1.recent, speakAway: 6, practiced: { ...S1.recent.practiced, ts: six }, feedback: { ...S1.recent.feedback, ts: six }, challengeFailed: { ...S1.recent.challengeFailed, ts: six }, partner: { ...S1.recent.partner, ts: six } }, daysAway: 1 }, C);
  ok("R24 · practised this week (words, a clip) but nothing spoken for six days → 'haven't practised speaking', ranked first", sp[0].id === "inactive" && sp[0].variant === "speaking" && sp[0].vars.n === 6, JSON.stringify(sp.map(r => [r.id, r.variant, r.score])));
  const stale = E.rows({ ...S1, recent: { ...S1.recent, watched: { ...S1.recent.watched, ts: NOW - 40 * D }, practiced: { ...S1.recent.practiced, ts: NOW - 20 * D }, feedback: { ...S1.recent.feedback, ts: NOW - 20 * D }, challengeFailed: null, partner: { ...S1.recent.partner, ts: NOW - 20 * D } }, troubleWords: [] }, C);
  ok("R25 · stale evidence fades: a clip watched 40 days ago, practice / feedback / a conversation 20 days ago drive no row", !stale.some(r => ["watched", "practiced", "feedback", "partner"].includes(r.id)), JSON.stringify(stale.map(r => r.id)));
  const nolib = E.rows(S1, { weeks: C.weeks, days: C.days, scenarios: C.scenarios, videos: {} });
  ok("R26 · no library index yet (offline first paint): rows that need clips wait, the rest still come", !nolib.some(r => r.id === "watched") && nolib.some(r => r.id === "learning") && nolib.some(r => r.id === "saved"), JSON.stringify(nolib.map(r => r.id)));
  ok("R27 · deterministic: same state → same rows, same order, same cards", JSON.stringify(E.rows(S1, C)) === JSON.stringify(E.rows(S1, C)));
}
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
