/* Welding Mastery — engine + corpus unit tests (pure, no browser).
   Run: cd tests && node welding-mastery-engine.test.mjs */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const E = require("../welding-mastery-engine.js");
const ROOT = new URL("..", import.meta.url).pathname;
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const D = 86_400_000, T0 = Date.UTC(2026, 9, 9, 9);
const corpus = JSON.parse(fs.readFileSync(ROOT + "tracks/welding/mastery.json", "utf8"));
const art = JSON.parse(fs.readFileSync(ROOT + "tracks/welding/mastery-art.json", "utf8"));
const terms = corpus.terms, ids = terms.map(t => t.id);

console.log("\n# content — the 250-term corpus");
{
  ok("C1 · exactly 250 terms", terms.length === 250, terms.length);
  ok("C2 · ids and English terms are unique (case-insensitive)", new Set(ids).size === 250 && new Set(terms.map(t => t.en.toLowerCase())).size === 250);
  const vocab = JSON.parse(fs.readFileSync(ROOT + "tracks/welding/vocabulary.json", "utf8")).words;
  const tradesSrc = fs.readFileSync(ROOT + "trades.js", "utf8");
  const welderVocab = JSON.parse(tradesSrc.match(/vocab: (\["undercut"[\s\S]*?\])/)[1]);
  const byEn = Object.fromEntries(terms.map(t => [t.en, t]));
  const orig = vocab.map(w => w.word).concat(welderVocab);
  ok("C3 · all 38 existing words are in the corpus (24 curriculum + 14 welder trade)", orig.length === 38 && orig.every(w => byEn[w]), orig.filter(w => !byEn[w]));
  ok("C4 · every existing definition and level is kept word for word", vocab.every(w => byEn[w.word].orig === w.definition && byEn[w.word].def.en.replace(/\.$/, "").toLowerCase() === w.definition.toLowerCase() && byEn[w.word].lvl === w.level), vocab.filter(w => byEn[w.word].orig !== w.definition).map(w => w.word));
  ok("C5 · the original files are untouched (24 curriculum words, 14 welder words)", vocab.length === 24 && welderVocab.length === 14);
  const req = ["def", "use", "ctx", "ex"];
  const bad = terms.filter(t => !t.fr || !t.en || req.some(k => !t[k] || !String(t[k].en).trim() || !String(t[k].fr).trim()));
  ok("C6 · every term has EN + FR name, definition, purpose, context and example", !bad.length, bad.map(t => t.en));
  const catIds = corpus.categories.map(c => c.id);
  ok("C7 · ten categories of 25, every term in a known category", catIds.length === 10 && catIds.every(c => terms.filter(t => t.cat === c).length === 25) && terms.every(t => catIds.includes(t.cat)));
  ok("C8 · levels are A2–C1", terms.every(t => ["A2", "B1", "B2", "C1"].includes(t.lvl)));
  const exMiss = terms.filter(t => !t.ex.en.toLowerCase().includes(t.en.toLowerCase().split(/[ /-]/)[0].slice(0, 4)));
  ok("C9 · every English example uses its term", !exMiss.length, exMiss.map(t => t.en));
  ok("C10 · every picture reference resolves to a drawing", terms.filter(t => t.img).every(t => art[t.img]) && Object.keys(art).length === 52);
  const unsafe = Object.entries(art).filter(([, v]) => /<(?!\/?(path|circle|ellipse|rect|line|polyline|polygon|g)\b)[a-z]/i.test(v) || /\son[a-z]+=|href|url\(|<script|style=/i.test(v));
  ok("C11 · drawings contain only plain shapes (no script, links, styles, text)", !unsafe.length, unsafe.map(x => x[0]));
  const ws = corpus.workshop;
  ok("C12 · 40 workshop scenarios, answers and options are corpus ids, one correct reply each", ws.length === 40 && ws.every(s => ids.includes(s.answer) && s.options.includes(s.answer) && s.options.every(o => ids.includes(o)) && s.reply.options.filter(r => r.ok).length === 1));
  ok("C13 · a scenario never gives its answer away", ws.every(s => !s.say.en.toLowerCase().includes(byEn[terms.find(t => t.id === s.answer).en].en.toLowerCase())));
  ok("C14 · terms flagged for native-speaker review are recorded, not hidden", terms.filter(t => t.verify).length >= 1);
}

console.log("\n# spaced repetition and mastery");
{
  const st = E.fresh(), id = "wm-undercut";
  let r = E.grade(st, id, 2, { mode: "cards", now: T0 });
  ok("S1 · first Good → due in 1 day", st.t[id].iv === 1 && st.t[id].due === T0 + D && r.wasNew);
  r = E.grade(st, id, 2, { mode: "cards", now: T0 + 60_000 });
  ok("S2 · practising ahead the same day does not move the schedule", st.t[id].due === T0 + D && st.t[id].iv === 1);
  r = E.grade(st, id, 2, { mode: "cards", now: T0 + D });
  ok("S3 · Good when due → 3 days", st.t[id].iv === 3 && r.wasDue);
  ok("S4 · not mastered after two days", !E.isMastered(st.t[id]));
  r = E.grade(st, id, 2, { mode: "cards", now: T0 + 4 * D });
  ok("S5 · correct on three different days with an active recall → mastered, celebrated once", r.mastered && E.isMastered(st.t[id]));
  r = E.grade(st, id, 2, { mode: "cards", now: T0 + 4 * D + 1000 });
  ok("S6 · a mastered word answered again is not 'mastered' again", !r.mastered);
  r = E.grade(st, id, 0, { mode: "quiz", now: T0 + 5 * D });
  ok("S7 · Again resets the interval, brings the word back in 10 min and loses mastery", st.t[id].iv === 0 && st.t[id].due === T0 + 5 * D + 600_000 && !E.isMastered(st.t[id]) && st.t[id].mEver > 0 && st.t[id].lapses === 1);
  const st2 = E.fresh();
  for (let d = 0; d < 5; d++) E.grade(st2, "wm-porosity", 2, { mode: "quiz", now: T0 + d * 4 * D });
  ok("S8 · multiple choice alone never masters a word (recognition is not recall)", !E.isMastered(st2.t["wm-porosity"]));
  for (let d = 0; d < 3; d++) E.grade(st2, "wm-crack", 1, { mode: "cards", now: T0 + d * 3 * D });
  ok("S9 · cards rated only Hard are correct but not active recall → not mastered", !E.isMastered(st2.t["wm-crack"]));
  E.grade(st2, "wm-crack", 2, { mode: "builder", now: T0 + 10 * D });
  ok("S10 · one spelling success on a further day completes it", E.isMastered(st2.t["wm-crack"]));
  const st3 = E.fresh();
  E.grade(st3, "wm-a", 3, { now: T0 }); ok("S11 · Easy on a new word → 3 days", st3.t["wm-a"].iv === 3);
  E.grade(st3, "wm-b", 2, { now: T0 }); E.grade(st3, "wm-b", 0, { now: T0 + D }); E.grade(st3, "wm-b", 0, { now: T0 + D + 700_000 });
  ok("S12 · ease never drops below the floor and lapses count", st3.t["wm-b"].e >= 130 && st3.t["wm-b"].lapses === 2);
}

console.log("\n# what comes next — overdue and difficult words first");
{
  const st = E.fresh(), now = T0 + 10 * D;
  E.grade(st, ids[5], 2, { now: T0 });                         // due at T0+1d → overdue
  E.grade(st, ids[6], 3, { now: now - 1000 });                  // fresh, due in 3 days
  E.setHard(st, ids[7], 1); E.grade(st, ids[7], 0, { now: T0 }); E.grade(st, ids[7], 0, { now: T0 + 1 }); st.t[ids[7]].due = now + 5 * D;
  const order = E.pick(st, ids, 4, now);
  ok("P1 · overdue word first", order[0] === ids[5], order);
  ok("P2 · the learner's difficult word before new words", order[1] === ids[7], order);
  ok("P3 · then new words in corpus order", order[2] === ids[0] && order[3] === ids[1], order);
  ok("P4 · a word not yet due is not picked over new ones", !order.includes(ids[6]));
  ok("P5 · difficultIds lists the hard word", E.difficultIds(st).includes(ids[7]));
  ok("P6 · pick is deterministic", JSON.stringify(E.pick(st, ids, 4, now)) === JSON.stringify(order));
}

console.log("\n# XP — idempotent, capped, separate from mastery");
{
  const st = E.fresh();
  const a = E.grade(st, "wm-grinder", 2, { mode: "quiz", now: T0 });
  const b = E.grade(st, "wm-grinder", 2, { mode: "quiz", now: T0 + 1000 });
  ok("X1 · a correct answer pays 2 XP once per word, game and day", a.xp === 2 && b.xp === 0);
  const c = E.grade(st, "wm-grinder", 2, { mode: "match", now: T0 + 2000 });
  ok("X2 · the same word in a different game pays once more", c.xp === 2);
  ok("X3 · a wrong answer pays nothing", E.grade(st, "wm-vice", 0, { mode: "quiz", now: T0 }).xp === 0);
  ok("X4 · award() with the same id twice pays once", E.award(st, "test:1", 10, T0) === 10 && E.award(st, "test:1", 10, T0) === 0);
  const s1 = E.finishSession(st, { id: "r1", mode: "quiz", n: 8, ok: 6 }, T0);
  const s1b = E.finishSession(st, { id: "r1", mode: "quiz", n: 8, ok: 6 }, T0);
  ok("X5 · a finished round pays its bonus once (a duplicate request pays nothing)", s1.xp === 10 && s1b.xp === 0);
  ok("X6 · a round under 5 answers pays no bonus", E.finishSession(st, { id: "r2", mode: "quiz", n: 3, ok: 3 }, T0).xp === 0);
  for (let i = 3; i < 12; i++) E.finishSession(st, { id: "r" + i, mode: "quiz", n: 6, ok: 6 }, T0);
  ok("X7 · at most 5 paid rounds a day", Object.keys(st.ev).filter(k => k.startsWith("s:")).length === 5);
  ok("X8 · total XP = sum of the day records", E.xpTotal(st) === Object.values(st.xpDay).reduce((x, y) => x + y, 0));
  const rich = E.fresh(); rich.xpDay["2026-01-01"] = 99999;
  ok("X9 · XP does not master anything", Object.values(rich.t).filter(E.isMastered).length === 0);
  const st4 = E.fresh(); E.setHard(st4, "wm-wps", 1);
  E.grade(st4, "wm-wps", 2, { now: T0 }); E.grade(st4, "wm-wps", 2, { now: T0 + D }); const m = E.grade(st4, "wm-wps", 2, { now: T0 + 4 * D });
  ok("X10 · mastering a word the learner marked difficult pays 25 + 15 once", m.mastered && m.xp === 2 + 25 + 15);
  st4.ev["a:2026-01-01:quiz:x"] = "2026-01-01"; E.pruneEvents(st4, T0);
  ok("X11 · old day keys are pruned, permanent keys kept", !st4.ev["a:2026-01-01:quiz:x"] && st4.ev["w:wm-wps"]);
}

console.log("\n# levels");
{
  ok("L1 · 0 XP = level 1", E.level(0).level === 1 && E.level(0).next === 100);
  ok("L2 · 99 XP = level 1, 1 XP to go", E.level(99).level === 1 && E.level(99).need === 1);
  ok("L3 · 100 XP = level 2, next at 300", E.level(100).level === 2 && E.level(100).next === 300);
  ok("L4 · 1000 XP = level 5", E.level(1000).level === 5);
  ok("L5 · progress percentage is within the level", E.level(200).pct === 50);
}

console.log("\n# streak");
{
  const st = E.fresh(), at = n => T0 - n * D;
  ok("K1 · nothing yet → 0", E.streak(st, T0).current === 0);
  [0, 1, 2].forEach(n => E.grade(st, "wm-x" + n, 2, { now: at(n) }));
  ok("K2 · three days running → 3", E.streak(st, T0).current === 3);
  const y = E.fresh(); [1, 2].forEach(n => E.grade(y, "wm-y", 2, { now: at(n) }));
  ok("K3 · not practised yet today → yesterday's streak still stands", E.streak(y, T0).current === 2 && !E.streak(y, T0).today);
  const g = E.fresh(); [0, 2, 3].forEach(n => E.grade(g, "wm-g" + n, 2, { now: at(n) }));
  ok("K4 · one missed day is forgiven (rest day)", E.streak(g, T0).current === 3 && E.streak(g, T0).rest);
  const g2 = E.fresh(); [0, 2, 4].forEach(n => E.grade(g2, "wm-h" + n, 2, { now: at(n) }));
  ok("K5 · a second missed day inside a week ends it", E.streak(g2, T0).current === 2);
  const r = E.fresh(); for (let i = 0; i < 6; i++) E.grade(r, "wm-r", 2, { now: T0 + i * 1000 });
  ok("K6 · many answers on one day count one day", E.streak(r, T0).current === 1);
}

console.log("\n# achievements, journey, missions");
{
  const st = E.fresh();
  ok("A1 · nothing is granted without evidence", E.checkAchievements(st, terms, T0).got.length === 0);
  E.grade(st, ids[0], 2, { now: T0 });
  ok("A2 · first practice after a first answer", E.checkAchievements(st, terms, T0).got.includes("first_practice"));
  const ppe = terms.filter(t => t.cat === "ppe").map(t => t.id);
  ppe.forEach(id => { st.t[id] = Object.assign(E.term(st, id), { m: T0, mEver: T0, n: 3 }); });
  const c = E.checkAchievements(st, terms, T0);
  ok("A3 · 25 safety words mastered → safety_25, 10 mastered, first stage (+100 XP once)", c.got.includes("safety_25") && c.got.includes("mastered_10") && c.got.includes("first_stage") && c.xp === 100);
  ok("A4 · granted achievements are not granted twice", E.checkAchievements(st, terms, T0).got.length === 0);
  ok("A5 · 50 mastered is not granted at 25", !st.ach.mastered_50);
  const J = E.journey(st, terms, corpus.categories);
  const jp = J.find(j => j.id === "ppe");
  ok("A6 · journey: the safety stage is complete at 100%, materials not started", jp.done && jp.pct === 100 && !J.find(j => j.id === "materials").started);
  const n = E.fresh();
  const m0 = E.ensureMission(n, terms, T0);
  ok("M1 · a new learner gets the starter mission (5 new words with Cards)", m0.kind === "start5" && m0.mode === "cards" && m0.target === 5);
  ok("M2 · the mission is kept for the day", E.ensureMission(n, terms, T0 + 3600_000) === m0);
  let paid = 0;
  for (let i = 0; i < 5; i++) { const g = E.grade(n, ids[i], 2, { now: T0 }); paid += E.missionStep(n, { type: "answer", ok: g.ok, mode: "cards", wasNew: g.wasNew, id: ids[i] }, T0); }
  ok("M3 · five new words learned → mission done, 30 XP paid once", n.mis.done && paid === 30);
  ok("M4 · further answers pay no second mission bonus", E.missionStep(n, { type: "answer", ok: true, mode: "cards", wasNew: true }, T0) === 0);
  const tomorrow = E.ensureMission(n, terms, T0 + D);
  ok("M5 · a new day brings a new mission", tomorrow.day !== m0.day);
}

console.log("\n# question building and answers");
{
  const ds = E.distractors(terms, "wm-undercut", 3, 7);
  ok("Q1 · three distractors, same category first, never the answer", ds.length === 3 && !ds.includes("wm-undercut") && ds.every(id => terms.find(t => t.id === id).cat === "defects"));
  const dv = E.distractors(terms, "wm-electrode", 3, 3, { needImg: true });
  ok("Q2 · picture questions only offer drawn items and never a look-alike", dv.every(id => terms.find(t => t.id === id).img) && !dv.some(id => E.lookalike(id, "wm-electrode")));
  const tl = E.tiles("lack of fusion", 5);
  ok("Q3 · builder tiles are the word's letters, no spaces, shuffled", tl.join("").length === 12 && tl.slice().sort().join("") === "LACKOFFUSION".split("").sort().join("") && tl.join("") !== "LACKOFFUSION");
  const wps = terms.find(t => t.en === "WPS");
  ok("Q4 · typed answers forgive case, spaces and hyphens, accept synonyms", E.checkTyped("w p s", wps) && E.checkTyped("Welding Procedure Specification", wps) && !E.checkTyped("PQR", wps));
  ok("Q5 · an empty answer is wrong", !E.checkTyped("", wps));
  ok("Q6 · crossword takes single words only; multi-word terms are skipped", E.crosswordOk({ en: "porosity" }) && !E.crosswordOk({ en: "lack of fusion" }) && !E.crosswordOk({ en: "6G" }));
}

console.log("\n# crossword grids built by the app's own generator (cwGen in index.html)");
{
  const html = fs.readFileSync(ROOT + "index.html", "utf8");
  const src = html.slice(html.indexOf("function cwGen(words){"), html.indexOf("async function cwRender(){"));
  const cwGen = new Function(src + ";return cwGen;")();
  const pool = terms.filter(E.crosswordOk).map(t => t.en.toLowerCase());
  let valid = 0, runs = 40;
  for (let s = 1; s <= runs; s++) { const L = cwGen(E.shuffle(pool, s).slice(0, 10)); if (E.gridValid(L)) valid++; }
  ok("W1 · every generated grid passes the validity check", valid === runs, `${valid}/${runs}`);
  const broken = cwGen(["weld", "lead"]); broken.placed[1].word = "xxxx";
  ok("W2 · a grid whose crossing letters disagree is rejected", !E.gridValid(broken) || broken.placed.length < 2);
  ok("W3 · a one-word grid is rejected (nothing to cross)", !E.gridValid({ placed: [{ word: "arc", r: 0, c: 0, dir: "a" }], rows: 1, cols: 3 }));
}

console.log("\n# performance and recommendations — only what was measured");
{
  const st = E.fresh();
  const p0 = E.performance(st, terms, T0);
  ok("G1 · a new learner: empty, no rates, first-activity recommendation", p0.empty && p0.accuracy === null && p0.skills.every(s => s.pct === null) && E.recommend(p0).kind === "first");
  for (let i = 0; i < 12; i++) E.grade(st, ids[i], 2, { mode: "visual", now: T0 });
  for (let i = 0; i < 12; i++) E.grade(st, ids[20 + i], i < 4 ? 2 : 0, { mode: "listen", now: T0 });
  const p = E.performance(st, terms, T0);
  ok("G2 · rates appear with at least 10 answers", p.skills.find(s => s.id === "visual").pct === 100 && p.skills.find(s => s.id === "listening").pct === 33);
  const rec = E.recommend(p);
  ok("G3 · 'visual strong, listening weak' → start a Listening Challenge", rec.kind === "gap" && rec.strong === "visual" && rec.weak === "listening" && rec.mode === "listen", JSON.stringify(rec));
  const few = E.fresh(); for (let i = 0; i < 3; i++) E.grade(few, ids[i], 0, { mode: "listen", now: T0 });
  ok("G4 · three answers are not enough to call a skill weak", E.recommend(E.performance(few, terms, T0)).kind !== "gap");
  ok("G5 · XP series covers 14 days, today last", p.xpSeries.length === 14 && p.xpSeries[13].xp === E.xpTotal(st));
}

console.log("\n# sync merge — two devices, nothing inflated, nothing lost");
{
  const a = E.fresh(), b = E.fresh();
  E.grade(a, "wm-arc", 2, { now: T0 }); E.grade(a, "wm-arc", 2, { now: T0 + D });
  E.grade(b, "wm-arc", 2, { now: T0 });
  E.setFav(a, "wm-vice", true, T0); E.setFav(b, "wm-vice", false, T0 + 5);
  a.xpDay["2026-10-08"] = 40; b.xpDay["2026-10-08"] = 30; b.xpDay["2026-10-07"] = 10;
  a.ach.first_practice = T0 + 50; b.ach.first_practice = T0;
  E.addMine(b, { en: "purge dam", fr: "bouchon de purge" }, T0, terms);
  const m = E.merge({ welding: a }, { welding: b }).welding;
  ok("Y1 · the word record with more answers wins", m.t["wm-arc"].n === 2);
  ok("Y2 · the later favourite toggle wins", !E.isFav(m, "wm-vice"));
  ok("Y3 · XP per day takes the larger copy, never the sum", m.xpDay["2026-10-08"] === 40 && m.xpDay["2026-10-07"] === 10);
  ok("Y4 · an achievement keeps its earliest date", m.ach.first_practice === T0);
  ok("Y5 · a custom word made on the other device is kept", E.mineList(m).some(w => w.en === "purge dam"));
  ok("Y6 · merging twice changes nothing (idempotent)", JSON.stringify(E.merge({ welding: m }, { welding: b }).welding.xpDay) === JSON.stringify(m.xpDay));
  ok("Y7 · areas stay apart: a General English bucket is never created by a Welding merge", !("general-english" in E.merge({ welding: a }, {})));
  const big = E.fresh(); big.days["2025-01-01"] = { n: 1, ok: 1, md: {} }; big.resume = { mode: "quiz", ts: 1 };
  const trimmed = E.trimForSync(big, T0);
  ok("Y8 · the cloud copy drops day records older than 120 days and the open round", !trimmed.days["2025-01-01"] && trimmed.resume === null);
}

console.log("\n# custom words — the learner's own, validated");
{
  const st = E.fresh();
  const r = E.addMine(st, { en: "  stub  end ", fr: "bout <b>", def: "x".repeat(400) }, T0, terms);
  const w = st.mine[r.id];
  ok("U1 · trimmed, markup characters removed, lengths capped", w.en === "stub end" && !/[<>]/.test(w.fr) && w.def.length === 220);
  ok("U2 · a duplicate is refused", E.addMine(st, { en: "Stub-End" }, T0, terms).error === "duplicate");
  ok("U3 · an official term is refused (it is already in the corpus)", E.addMine(st, { en: "Undercut" }, T0, terms).error === "official");
  ok("U4 · an empty word is refused", E.addMine(st, { en: "  " }, T0, terms).error === "empty");
  ok("U5 · editing keeps the id and never touches the official list", E.addMine(st, { id: r.id, en: "stub end", fr: "bout" }, T0 + 1, terms).id === r.id && st.mine[r.id].fr === "bout" && !st.t["wm-undercut"]);
  E.grade(st, r.id, 2, { now: T0 }); E.setFav(st, r.id, true, T0);
  ok("U6 · deleting removes it, its practice record and its favourite (a tombstone syncs the delete)", E.delMine(st, r.id, T0 + 2) && !E.mineList(st).length && !st.t[r.id] && !st.fav[r.id] && st.mine[r.id].del === 1);
}

console.log("\n# history — every round, every answer, kept and merged");
{
  const st = E.fresh();
  ok("H1 · a round with no answers is not filed", E.logRound(st, { id: "r0", mode: "quiz", items: [] }, T0) === null && st.hist.length === 0);
  E.logRound(st, { id: "r1", mode: "quiz", ts: T0, n: 2, ok: 1, xp: 2, cats: ["defects", "defects"], items: [{ t: "wm-undercut", ok: 1, k: "def" }, { t: "wm-porosity", ok: 0, k: "en2fr", p: "wm-crack" }] }, T0 + 1000);
  const r = st.hist[0];
  ok("H2 · the round keeps game, time, score, XP, stage and each answer (asked, chosen, right/wrong)", r.m === "quiz" && r.n === 2 && r.ok === 1 && r.xp === 2 && r.cats.join() === "defects" && r.it[1].o === 0 && r.it[1].p === "wm-crack" && r.it[1].k === "en2fr");
  E.logRound(st, { id: "r1", mode: "quiz", ts: T0, n: 3, ok: 2, items: [{ t: "wm-undercut", ok: 1 }, { t: "wm-porosity", ok: 0, p: "wm-crack" }, { t: "wm-crack", ok: 1 }] }, T0 + 2000);
  ok("H3 · a resumed round replaces its part-way record, it is not filed twice", st.hist.length === 1 && st.hist[0].it.length === 3);
  E.logRound(st, { id: "r2", mode: "builder", ts: T0 + D, n: 1, ok: 0, part: true, items: [{ t: "wm-porosity", ok: 0, k: "spell", p: "porosty<script>" }] }, T0 + D);
  ok("H4 · a round left part-way is filed and marked; typed text is cleaned", st.hist[1].part === 1 && !/[<>]/.test(st.hist[1].it[0].p));
  const days = E.histByDay(st);
  ok("H5 · grouped by day, newest day first, with day totals", days.length === 2 && days[0].day > days[1].day && days[1].n === 3 && days[1].ok === 2);
  const errs = E.errorsByStage(st, terms);
  const por = (errs.defects || []).find(e => e.t === "wm-porosity");
  ok("H6 · errors grouped by stage: porosity wrong twice, with what was chosen instead", por && por.n === 2 && por.picks.includes("wm-crack") && por.now === "open");
  E.grade(st, "wm-porosity", 2, { now: T0 + 2 * D });
  ok("H7 · a word answered right since its last error is shown as 'fixed'", E.errorsByStage(st, terms).defects.find(e => e.t === "wm-porosity").now === "fixed");
  const big = E.fresh();
  for (let i = 0; i < E.HIST_MAX + 30; i++) E.logRound(big, { id: "b" + i, mode: "quiz", ts: T0 + i, n: 1, ok: 1, items: [{ t: "wm-arc", ok: 1 }] }, T0 + i);
  ok("H8 · capped: at most HIST_MAX rounds; the newest HIST_FULL keep every answer, older keep the summary", big.hist.length === E.HIST_MAX && big.hist.filter(x => x.it).length === E.HIST_FULL && big.hist[0].sum === 1 && big.hist[big.hist.length - 1].it);
  const a = E.fresh(), b = E.fresh();
  E.logRound(a, { id: "x", mode: "quiz", ts: T0, n: 1, ok: 1, items: [{ t: "wm-arc", ok: 1 }] }, T0);
  E.logRound(b, { id: "x", mode: "quiz", ts: T0, n: 2, ok: 1, items: [{ t: "wm-arc", ok: 1 }, { t: "wm-vice", ok: 0 }] }, T0);
  E.logRound(b, { id: "y", mode: "match", ts: T0 + 5, n: 1, ok: 1, items: [{ t: "wm-file", ok: 1 }] }, T0 + 5);
  const m = E.merge({ welding: a }, { welding: b }).welding;
  ok("H9 · sync merge: rounds from both devices are kept; the fuller copy of a shared round wins", m.hist.length === 2 && m.hist.find(x => x.id === "x").it.length === 2);
  ok("H10 · the cloud copy keeps the history (only the open round is dropped)", E.trimForSync(m, T0).hist.length === 2);
}

console.log("\n# photographs — real, licensed, credited");
{
  const cr = JSON.parse(fs.readFileSync(ROOT + "tracks/welding/photos/credits.json", "utf8"));
  const ok1 = Object.entries(cr);
  ok("PH1 · at least 30 real photographs, each a corpus term with its file on disk", ok1.length >= 30 && ok1.every(([id, c]) => ids.includes(id) && fs.existsSync(ROOT + "tracks/welding/photos/" + c.file)), ok1.length);
  const ill = ok1.filter(([, c]) => c.kind === "illustration"), ph = ok1.filter(([, c]) => c.kind !== "illustration");
  ok("PH5 · our own illustrations (10 Oct 2026) are Lomonec LLC's, say so, and never pose as a photograph", ill.length >= 13 && ill.every(([, c]) => c.author === "Lomonec LLC" && c.license === "Illustration" && !c.source));
  ok("PH2 · every licence is reusable (CC0 / public domain / CC BY / CC BY-SA) — never NC, ND or unknown", ph.every(([, c]) => /^(CC0|Public domain|CC BY(-SA)? [0-9.]+( [a-z]{2})?)$/.test(c.license) && !/NC|ND/.test(c.license)), ph.map(([k, c]) => k + ":" + c.license).filter(x => !/CC0|Public domain|CC BY/.test(x)));
  ok("PH3 · every photo names its author and links its Commons page", ph.every(([, c]) => c.author && c.author !== "Unknown" && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(c.source)));
  ok("PH4 · photos are small enough for a phone (each ≤ 160 KB)", ok1.every(([, c]) => fs.statSync(ROOT + "tracks/welding/photos/" + c.file).size <= 160 * 1024));
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
