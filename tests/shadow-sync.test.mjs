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

const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass`);
process.exit(pass === res.length ? 0 : 1);
