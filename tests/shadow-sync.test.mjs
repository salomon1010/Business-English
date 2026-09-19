/* Shadow Studio V2 — sync engine unit tests.  Run:  node shadow-sync.test.mjs */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const S = require("../shadow-sync.js");

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

/* a caption file exactly like captions/<vid>.json */
const cap = {
  cues: [{ t: 10.0, txt: "Thank you. I am honored to be with you today." }, { t: 13.5, txt: "Truth be told, I never graduated from college." }, { t: 17.0, txt: "This is the closest I've ever gotten." }],
  words: [{ t: 10.0, w: "Thank" }, { t: 10.3, w: "you." }, { t: 11.0, w: "I" }, { t: 11.1, w: "am" }, { t: 11.4, w: "honored" }, { t: 12.0, w: "to" }, { t: 12.2, w: "be" }, { t: 12.4, w: "with" }, { t: 12.6, w: "you" }, { t: 12.9, w: "today." },
          { t: 13.5, w: "Truth" }, { t: 13.9, w: "be" }, { t: 14.1, w: "told," }, { t: 14.6, w: "I" }, { t: 14.8, w: "never" }, { t: 15.2, w: "graduated" }, { t: 15.9, w: "from" }, { t: 16.2, w: "college." },
          { t: 17.0, w: "This" }, { t: 17.2, w: "is" }, { t: 17.4, w: "the" }, { t: 17.6, w: "closest" }, { t: 18.1, w: "I've" }, { t: 18.3, w: "ever" }, { t: 18.6, w: "gotten." }],
};

/* normalisation */
const a = S.normalizeCaptions(cap, 0, 0);
ok("word-level asset from cues + words", a.level === "word" && a.segments.length === 3 && a.segments[0].words.length === 10);
ok("segment end = next cue start", a.segments[0].endMs === 13500 && a.segments[1].endMs === 17000);
ok("last segment gets a tail, not infinity", a.segments[2].endMs === 17000 + 2500);
ok("word end = next word start; last word ends with the segment", a.segments[0].words[0].endMs === 10300 && a.segments[0].words[9].endMs === 13500);
const clipped = S.normalizeCaptions(cap, 13.6, 17.5);
ok("clip marks drop segments that do not overlap [start,end] (s0 ends at 13.5)", clipped.segments.length === 2 && clipped.segments[0].id === "s1" && clipped.segments[1].id === "s2");
const sentenceOnly = S.normalizeCaptions({ cues: cap.cues }, 0, 0);
ok("cues without words → sentence level", sentenceOnly.level === "sentence" && !sentenceOnly.segments[0].words);
{ const est = ShadowSync.estimateWords(sentenceOnly); const w = est.segments[0].words, seg = est.segments[0];
  const mono = w.every((x, i) => i === 0 || x.startMs >= w[i - 1].startMs) && w.every(x => x.endMs > x.startMs);
  ok("estimateWords: a sentence-only asset becomes word level, marked estimated; words span the cue in order and every word is flagged", est.level === "word" && est.estimated === true && w.length === seg.text.split(/\s+/).length && w[0].startMs === seg.startMs && w[w.length - 1].endMs === seg.endMs && mono && w.every(x => x.estimated), JSON.stringify(w.slice(0, 3)));
  ok("estimateWords: longer words get more time", (() => { const a = ShadowSync.estimateWords({ level: "sentence", segments: [{ id: "s", text: "I understand", startMs: 0, endMs: 1300 }] }).segments[0].words; return a[1].endMs - a[1].startMs > a[0].endMs - a[0].startMs; })());
  ok("estimateWords: an asset that already has word times is returned untouched (not estimated)", (() => { const src = ShadowSync.normalizeCaptions({ cues: [{ t: 0, txt: "a b" }], words: [{ t: 0, w: "a" }, { t: 0.5, w: "b" }] }); const r = ShadowSync.estimateWords(src); return r.level === "word" && !r.estimated && r.segments[0].words[1].startMs === 500 && !r.segments[0].words[0].estimated; })());
  ok("estimateWords: locate() lights the estimated word for a time inside the cue", (() => { const l = ShadowSync.locate(est, seg.startMs + Math.round((seg.endMs - seg.startMs) * 0.9)); return l.seg === 0 && l.word === w.length - 1; })()); }
/* normalizePasted: the learner's own transcript, timed */
{ const yt = "0:00\nToday I want to tell you three stories.\n0:04\nThat's it. No big deal.\n0:07\nJust three stories.";
  const a = S.normalizePasted(yt, { durationS: 600 });
  ok("normalizePasted: YouTube's transcript panel (stamp on its own line) → sentence cues at the stamps, source 'stamps', plain text without stamps", a.level === "sentence" && a.source === "stamps" && a.segments.length === 3 && a.segments[1].startMs === 4000 && a.segments[1].endMs === 7000 && a.segments[0].text === "Today I want to tell you three stories." && !/0:0/.test(a.text) && a.text.split("\n").length === 3, JSON.stringify(a.segments.map(x => [x.startMs, x.endMs])));
  const b = S.normalizePasted("[00:10] Hello there. (00:14) How are you? 1:02:03 Late.");
  ok("normalizePasted: stamps inline, bracketed, and h:mm:ss all count", b.source === "stamps" && b.segments.map(x => x.startMs).join() === "10000,14000,3723000" && b.segments[2].text === "Late.", JSON.stringify(b.segments));
  const c = S.normalizePasted("One short sentence. And a much longer second sentence that carries on for a while.", { durationS: 20 });
  ok("normalizePasted: no stamps + a duration → sentences spread over the length by letter count, source 'spread', estimated", c.level === "sentence" && c.source === "spread" && c.estimated === true && c.segments[0].startMs === 0 && c.segments[1].endMs === 20000 && c.segments[1].endMs - c.segments[1].startMs > c.segments[0].endMs - c.segments[0].startMs, JSON.stringify(c.segments.map(x => [x.startMs, x.endMs])));
  const d = S.normalizePasted("No duration here. Two sentences.");
  ok("normalizePasted: no stamps and no duration → plain text level (nothing invented), text kept", d.level === "text" && d.segments.length === 2 && d.text === "No duration here. Two sentences.");
  const e = S.normalizePasted("Plain 12:30 meeting talk with no real stamps.");
  ok("normalizePasted: one lone time in prose stays prose", e.level === "text" && e.text.includes("12:30"));
  const f = S.estimateWords(a);
  ok("normalizePasted → estimateWords keeps source and text, gives word level", f.source === "stamps" && f.level === "word" && f.estimated && f.text === a.text && f.segments[1].words[0].startMs === 4000);
  ok("normalizePasted: empty → none", S.normalizePasted("").level === "none"); }
const mixed = S.normalizeCaptions({ cues: cap.cues, words: cap.words.filter(w => w.t < 13.5) }, 0, 0);
ok("per-segment fallback: word-level asset with a wordless segment", mixed.level === "word" && mixed.segments[0].words && !mixed.segments[1].words);
const txt = S.normalizeText("Hello there. How are you doing today? Fine, thanks!  ");
ok("pasted transcript → text level, sentence-split, untimed", txt.level === "text" && txt.segments.length === 3 && txt.segments[0].startMs === -1);
ok("empty inputs → none", S.normalizeCaptions({}, 0, 0).level === "none" && S.normalizeText("").level === "none" && S.normalizeCaptions(null, 0, 0).level === "none");

/* locate: boundaries, seeks, gaps */
const L = (t, o) => S.locate(a, t, o);
ok("before the first cue → nothing lit", L(9000).seg === -1);
ok("exact segment start → segment 0, word 0", L(10000).seg === 0 && L(10000).word === 0);
ok("inside a word → that word", L(11500).seg === 0 && L(11500).word === 4);
ok("exact boundary belongs to the next segment", L(13500).seg === 1 && L(13500).word === 0);
ok("seek backwards is stateless (no hint needed)", L(10100).seg === 0 && L(18200).seg === 2 && L(10100).seg === 0);
ok("grace keeps the last sentence and word lit briefly after their end, then drops both", L(20100).seg === 2 && L(20100).word === 6 && L(20300).seg === -1 && L(20300).word === -1);
ok("far past the end → nothing lit", L(30000).seg === -1);
ok("grace can be tuned", S.locate(a, 19600, { graceMs: 0 }).seg === -1 && S.locate(a, 19600, { graceMs: 5000 }).seg === 2);
ok("text-level assets never light anything", S.locate(txt, 5000).seg === -1);
ok("sentence-level asset lights sentences only", S.locate(sentenceOnly, 14000).seg === 1 && S.locate(sentenceOnly, 14000).word === -1);

/* stepping */
ok("neighbour clamps at both ends", S.neighbour(a, 0, -1).index === 0 && S.neighbour(a, 2, +1).index === 2 && S.neighbour(a, 0, +1).startMs === 13500);

/* a real bundled file, if present */
try {
  const real = JSON.parse(readFileSync(new URL("../captions/UF8uR6Z6KLc.json", import.meta.url), "utf8"));
  const ra = S.normalizeCaptions(real, 0, 0);
  const mono = ra.segments.every((s, i) => i === 0 || s.startMs >= ra.segments[i - 1].startMs);
  const wordsOk = ra.segments.every(s => !s.words || s.words.every((w, k) => k === 0 || w.startMs >= s.words[k - 1].startMs));
  ok("real sentence-level file (Jobs, Stanford: cues, no words) → " + ra.level + ", " + ra.segments.length + " segments, monotonic", ra.level === "sentence" && mono && wordsOk && ra.segments.length > 50);
  const realW = JSON.parse(readFileSync(new URL("../captions/MZAjfsyJa1U.json", import.meta.url), "utf8"));
  const rw = S.normalizeCaptions(realW, 0, 0);
  ok("real word-level file (YouTube json3 words) → word level, every segment has words", rw.level === "word" && rw.segments.length === realW.cues.length && rw.segments.filter(s => s.words && s.words.length).length >= rw.segments.length - 2);
  const mid = ra.segments[Math.floor(ra.segments.length / 2)];
  ok("locate inside a real segment finds it", S.locate(ra, mid.startMs + 10).seg === Math.floor(ra.segments.length / 2));
} catch (e) { ok("real caption file present", false, e.message); }

/* malformed caption files: unsorted cues, NaN / string times, empty text, words outside any cue */
{ const bad = { cues: [{ t: 8, txt: "Third." }, { t: 0, txt: "First." }, { t: NaN, txt: "ghost" }, { t: "4", txt: "string time" }, { t: 4, txt: "" }, { t: 4, txt: "Second." }],
    words: [{ t: 4.2, w: "Second." }, { t: NaN, w: "x" }, { t: 0.1, w: "First." }, { t: 99, w: "late" }] };
  const a = S.normalizeCaptions(bad, 0, 0);
  const texts = a.segments.map(x => x.text);
  ok("malformed captions: unsorted / NaN / string / empty cues → sorted valid segments only", texts.join("|") === "First.|Second.|Third." && a.segments.every((x, i, arr) => i === 0 || arr[i - 1].startMs < x.startMs), texts.join("|"));
  ok("malformed captions: NaN words dropped, words attached to the right cue, a word after the last cue's window is dropped (that segment falls back to sentence)", a.level === "word" && a.segments[0].words.length === 1 && a.segments[1].words.length === 1 && !a.segments[2].words && S.locate(a, 4300).word === 0 && S.locate(a, 8100).word === -1);
  ok("rapid seeks across a malformed file never throw", (() => { try { for (let t = -5000; t < 20000; t += 137) S.locate(a, t); return true; } catch (e) { return false; } })());
  ok("cues that are not an array → none", S.normalizeCaptions({ cues: "nope" }, 0, 0).level === "none" && S.normalizeCaptions(null, 0, 0).level === "none"); }

/* ---------- CHALLENGE: one strength, one correction, i18n keys only ---------- */
{ const T = "I'll get back to you by the end of the day.";
  const tw = (ws, gapAt = -1) => ws.map((w, i) => ({ w, start: i * 0.3 + (gapAt >= 0 && i >= gapAt ? 0.8 : 0), end: i * 0.3 + 0.25 + (gapAt >= 0 && i >= gapAt ? 0.8 : 0) }));
  const said = T.toLowerCase().replace(/[^a-z' ]/g, "");
  let r = S.challenge(T, said, { words: tw(said.split(" ")), targetMs: 2600 });
  ok("perfect line → pass, GOOD every word, IMPROVE = nothing to fix (level up)", r.pass && r.coverage === 1 && r.good.k === "sv.ch_good_all" && r.improve.k === "sv.ch_imp_levelup", JSON.stringify(r.improve));
  ok("tokens: apostrophes do not split a match (I'll ≡ Ill)", S.tokens("I'll").join() === S.tokens("Ill").join() && S.tokens("Don't stop!").length === 2);
  r = S.challenge(T, "I'll get back to you by the end of the day", { words: tw(said.split(" "), 2), targetMs: 2600 });
  ok("a 0.8 s pause before 'back' → IMPROVE connect 'get back to' (the spec's example), and GOOD is not about smoothness", r.improve.k === "sv.ch_imp_connect" && r.improve.v.phrase === "get back to" && r.good.k === "sv.ch_good_all", JSON.stringify(r));
  r = S.challenge(T, "I'll get back to you by the end of day");
  ok("one missing word → IMPROVE names it, still a pass, GOOD says most of the line was there", r.improve.k === "sv.ch_imp_missing" && r.improve.v.words === "the" && r.missing.length === 1 && r.pass && r.good.k === "sv.ch_good_most", JSON.stringify(r.improve));
  r = S.challenge(T, "I'll get back to you by the day");
  ok("three missing words → IMPROVE lists up to three, below the pass line", r.improve.k === "sv.ch_imp_missing" && r.missing.length === 3 && !r.pass, JSON.stringify(r.improve));
  r = S.challenge(T, "I'll get back to you");
  ok("half the line → not a pass, GOOD credits the attempt", !r.pass && r.coverage < 0.8 && r.good.k === "sv.ch_good_tried", JSON.stringify({ c: r.coverage, g: r.good }));
  r = S.challenge(T, "I'll get back to you by the end of the week");
  ok("a substituted word → IMPROVE 'I heard X for Y'", r.improve.k === "sv.ch_imp_wrong" && r.improve.v.said === "week" && r.improve.v.target === "day", JSON.stringify(r.improve));
  r = S.challenge("I need to follow up on the email.", "I need to follow on up the email");
  ok("same words, different order → IMPROVE order", r.improve.k === "sv.ch_imp_order", JSON.stringify(r.improve));
  r = S.challenge(T, "");
  ok("nothing heard → IMPROVE speak up, no pass", r.improve.k === "sv.ch_imp_nothing" && !r.pass);
  r = S.challenge(T, "um " + said + " uh", { words: tw(("um " + said + " uh").split(" ")), targetMs: 2600 });
  ok("fillers are not counted as missing or extra words, and are the improvement when nothing else is wrong", r.coverage === 1 && r.extra === 0 && r.fillers === 2 && r.improve.k === "sv.ch_imp_fillers" && r.improve.v.n === 2, JSON.stringify(r.improve));
  r = S.challenge(T, said + " okay thanks");
  ok("two extra words → IMPROVE keep to the line", r.extra === 2 && r.improve.k === "sv.ch_imp_extra");
  r = S.challenge(T, said, { words: tw(said.split(" ")), targetMs: 1000 });
  ok("far slower than the clip (pace 2.6×) → IMPROVE faster; GOOD stays on the words", r.pace > 1.6 && r.improve.k === "sv.ch_imp_slow" && r.good.k === "sv.ch_good_all", JSON.stringify({ pace: r.pace, imp: r.improve }));
  r = S.challenge(T, said, { assess: { overall: 70, words: [{ word: "get", score: 92 }, { word: "back", score: 40, note: "vowel too short" }] } });
  ok("AI grade: weakest word under 60 → IMPROVE pron with its note; GOOD is not the pronunciation of another word", r.improve.k === "sv.ch_imp_pron" && r.improve.v.word === "back" && r.improve.v.note === " — vowel too short" && r.good.k === "sv.ch_good_all", JSON.stringify(r.improve));
  r = S.challenge(T, "I'll get back to you by the day", { assess: { overall: 90, words: [{ word: "back", score: 95 }] } });
  ok("a strong word is the GOOD only when coverage is not already the strength", r.good.k === "sv.ch_good_most" || r.good.k === "sv.ch_good_word", r.good.k);
  r = S.challenge(T, said);
  ok("no timings and no AI grade → no pause, pace or pronunciation rule fires; nothing is invented", r.pauses.length === 0 && r.pace === null && r.weak.length === 0 && r.durS === null);
  const phrases = [{ w: 1, p: "I currently work as…" }, { w: 2, p: "follow up on…" }, { w: 3, p: "get back to you…" }, { w: 4, p: "by…" }];
  const ex = S.findExpression(T, phrases);
  ok("findExpression: the curriculum phrase inside the line, ellipsis stripped, one-word phrases ignored", ex && ex.phrase === "get back to you" && ex.tokens.join(" ") === "get back to you" && ex.w === 3, JSON.stringify(ex));
  ok("findExpression: the longest match wins; none → null", S.findExpression("I need to follow up on it", [{ p: "follow up…" }, { p: "follow up on…" }]).phrase === "follow up on" && S.findExpression("Good morning everyone.", phrases) === null);
  ok("usedExpression: in order and consecutive; punctuation and case ignored; split apart → false", S.usedExpression("Tomorrow I'll FOLLOW up on the email, promise.", ["follow", "up", "on"]) && !S.usedExpression("I follow the plan up on time", ["follow", "up", "on"]));
  ok("every feedback key is an i18n key the app defines", (() => { const en = readFileSync(new URL("../index.html", import.meta.url), "utf8"); const keys = ["sv.ch_good_all", "sv.ch_good_smooth", "sv.ch_good_rhythm", "sv.ch_good_word", "sv.ch_good_most", "sv.ch_good_tried", "sv.ch_imp_nothing", "sv.ch_imp_missing", "sv.ch_imp_wrong", "sv.ch_imp_order", "sv.ch_imp_connect", "sv.ch_imp_pron", "sv.ch_imp_slow", "sv.ch_imp_fast", "sv.ch_imp_fillers", "sv.ch_imp_extra", "sv.ch_imp_levelup"]; return keys.every(k => en.includes('"' + k + '":')); })());
}

const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass`);
process.exit(pass === res.length ? 0 : 1);
