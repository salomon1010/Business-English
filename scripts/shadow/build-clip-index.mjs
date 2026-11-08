/* Build the curriculum clip index: the passages in the General English library that actually
   SPEAK the curriculum's phrases.
     node scripts/shadow/build-clip-index.mjs            # writes tracks/general/clip-index.json
     node scripts/shadow/build-clip-index.mjs --dry      # report only

   Why a build-time index: the match has to be made against every caption file (934 of them,
   28 MB, 75k paragraphs). A phone cannot do that, and an AI call would cost money and vary.
   Here it is done once, offline, and the result is a few KB the lesson reads instantly.

   What counts as a match: ShadowSync.findExpression — the SAME check the Shadow Challenge uses
   to decide whether a learner said an expression. So an entry is never "close to" the phrase;
   the speaker says it. Paragraph numbering is DailyPlan.paragraphsOf, which is the studio's own
   grouping, so the number the lesson quotes is the number the studio shows.

   GENERAL ENGLISH ONLY: a video is kept only if it is in catalogue/general.json or is a General
   English starter. Welding videos match these phrases too (15 of them did) and must never be
   handed to a General English learner. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const R = p => resolve(root, p);
const J = p => JSON.parse(readFileSync(R(p), "utf8"));
const dry = process.argv.includes("--dry");

const win = {};
new Function("window", readFileSync(R("shadow-sync.js"), "utf8"))(win);
new Function("window", readFileSync(R("daily-learning-plan.js"), "utf8"))(win);
const { ShadowSync: SS, DailyPlan: DP } = win;
/* contractions folded both ways, so a speaker saying "I'm responsible for" is found for the
   curriculum's "I am responsible for" — and credited to a learner on exactly the same rule. */
const says = DP.makeSays(SS.findExpression);
const finds = DP.makeFinds(SS.findExpression);
/* The hot loop runs ~5 million phrase checks, so fold ONCE and compare folded-to-folded rather than
   re-expanding both sides every time. The result is identical; it just does not re-do the work. */
const foldCache = new Map();
const fold = (t) => { let v = foldCache.get(t); if (v === undefined) { v = DP.foldContractions(t); if (foldCache.size < 50000) foldCache.set(t, v); } return v; };

/* the curriculum's own phrases, per week, idioms excluded (an idiom is not a day's target language) */
const phrases = (() => {
  const raw = J("tracks/general/phrases.json");
  const list = raw.phrases || raw || [];
  const byWeek = {};
  for (const p of list) {
    if (!p || p.i) continue;
    const text = p.en || p.t || p.p || p.text;
    if (text && p.w) (byWeek[p.w] = byWeek[p.w] || []).push(text);
  }
  return byWeek;
})();

/* each week's phrases, folded once */
/* each week's phrases become the PARTS a speaker actually says, folded once */
const variants = Object.fromEntries(Object.keys(phrases).map(w => {
  const v = [];
  phrases[w].forEach(p => DP.phraseVariants(p).forEach(x => { if (!v.some(y => y.text === x)) v.push({ text: x, folded: DP.foldContractions(x), from: p }); }));
  return [w, v];
}));

/* ---------------------------------------------------------------- topic fallback
   Some weeks' language simply is not in the library (6, 10 and 11 at the time of writing). Rather
   than leave those days with nothing, the week also keeps the passages that are ABOUT its subject,
   scored on the curriculum's own words. They are marked match:"topic" and the lesson says plainly
   that they are the closest clip on the topic, not a model of the week's phrases. */
const STOP = new Set(("a an and are as at be but by for from had has have he her his i if in is it its of on or our she that the their them then there these they this to was we were what when which who will with you your about into over under more most can could would should your yours what's here's that's".split(" ")));
const contentWords = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(x => x.length > 3 && !STOP.has(x));
const weekMeta = J("tracks/general/weeks.json").weeks || [];
const topicWords = Object.fromEntries(Object.keys(phrases).map(w => {
  const meta = weekMeta.find(x => String(x.n) === String(w)) || {};
  const bag = new Set();
  contentWords((meta.theme || "") + " " + (meta.goal || "")).forEach(x => bag.add(x));
  phrases[w].forEach(ph => contentWords(ph).forEach(x => bag.add(x)));
  return [w, bag];
}));
const topicPool = Object.fromEntries(Object.keys(phrases).map(w => [w, []]));

const capOf = (vid) => { try { return J("captions/" + vid + ".json"); } catch (e) { return null; } };

const geVideos = J("catalogue/general.json").videos || {};
const starters = new Map(J("tracks/general/shadow.json").starters.map(s => [s.vid, s.name]));
const titleOf = vid => (geVideos[vid] && geVideos[vid].title) || starters.get(vid) || "";
const isGE = vid => !!geVideos[vid] || starters.has(vid);

const out = {};
let scannedFiles = 0, scannedParas = 0, skippedNonGE = 0;
const dropped = { noThought: 0, tooShort: 0, lostPhrase: 0, duplicate: 0, sameVideo: 0, samePhrase: 0 };
for (const f of readdirSync(R("captions")).filter(n => n.endsWith(".json"))) {
  const vid = f.slice(0, -5);
  if (!isGE(vid)) { skippedNonGE++; continue; }          /* Welding and unlisted videos never reach a GE learner */
  let cap; try { cap = J("captions/" + f); } catch (e) { continue; }
  const asset = SS.normalizeCaptions(cap);
  if (!asset.segments.length) continue;
  scannedFiles++;
  const paras = DP.paragraphsOf(asset.segments);
  const hasWordTimes = Array.isArray(cap.words) && cap.words.length > 0;
  paras.forEach((p, i) => {
    scannedParas++;
    const segs = asset.segments.slice(p.from, p.to + 1);
    const text = segs.map(s => s.text).join(" ").trim();
    const cw = contentWords(text);
    for (const week of Object.keys(phrases)) {
      /* remember how ON-TOPIC this paragraph is, in case the week ends up with no phrase at all */
      if (cw.length >= 12) {
        const bag = topicWords[week]; let n = 0; const got = new Set();
        for (const x of cw) if (bag.has(x) && !got.has(x)) { got.add(x); n++; }
        /* two of the week's own words in a paragraph is enough to be WORTH EXPANDING; the real
           bar is applied after expansion, where the passage is judged at its full length */
        if (n >= 2) { const pool = topicPool[week];
          pool.push({ vid, from: p.from, to: p.to, n, density: n / cw.length });
          if (pool.length > 400) { pool.sort((a, b) => b.n - a.n || b.density - a.density); pool.length = 200; } }
      }
      const hit = (() => { const ft = fold(text); const v = variants[week].find(x => SS.findExpression(ft, [x.folded])); return v ? { phrase: v.text } : null; })();
      if (!hit) continue;
      /* a paragraph is where the phrase was FOUND; the passage is what is worth shadowing */
      const ex = DP.expandPassage(asset.segments, p.from, p.to);
      if (!ex) { dropped.noThought++; continue; }
      if (ex.seconds < DP.PASSAGE.minS) { dropped.tooShort++; continue; }
      /* the phrase must survive the expansion — the clean-up strips [music] and ">>" marks */
      if (!says(ex.text, hit.phrase)) { dropped.lostPhrase++; continue; }
      /* teaching value: how many of the week's phrases this one passage actually contains */
      const fex = fold(ex.text);
      const teaches = variants[week].filter(x => SS.findExpression(fex, [x.folded])).map(x => x.text);
      (out[week] = out[week] || []).push({
        vid, title: titleOf(vid), phrase: hit.phrase, teaches, match: "phrase",
        para: i + 1, of: paras.length, from: ex.from, to: ex.to,
        startMs: ex.startMs, endMs: ex.endMs, seconds: ex.seconds,
        sentences: ex.sentences, words: ex.words, wordTimes: hasWordTimes,
        _noise: ex.noise,
        text: ex.text.length > 600 ? ex.text.slice(0, 597) + "…" : ex.text,
      });
    }
  });
}

/* ---------------------------------------------------------------- choose
   Two passages that say the same thing are one passage. The library repeats presenters across
   videos (Rachel's identical self-introduction turned up three times in week 1), so a different
   video id is NOT enough — the opening words decide (owner, 7 Nov 2026). */
const sigOf = e => DP.phraseSentence(e.text, e.phrase);
/* Two passages can open differently and still be the same recording of the same person saying the
   same thing — a channel's standing self-introduction, reused across videos. Compare the words
   themselves: if most of the shorter passage is inside the longer, it teaches nothing new. */
const wordsOf = t => new Set(String(t || "").toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(x => x.length > 2));
function overlaps(a, b) {
  const A = wordsOf(a), B = wordsOf(b);
  const small = A.size <= B.size ? A : B, big = A.size <= B.size ? B : A;
  if (!small.size) return false;
  let n = 0; small.forEach(w => { if (big.has(w)) n++; });
  return n / small.size > 0.55;
}
/* closer to the curriculum's 45-60 s is better; more of the week's phrases is better;
   word timings make the Challenge able to score rhythm; caption noise is worse */
function score(e) {
  const len = 1 - Math.min(1, Math.abs(e.seconds - DP.PASSAGE.targetS) / DP.PASSAGE.targetS);
  return e.teaches.length * 3 + len * 2 + (e.wordTimes ? 1 : 0) - Math.min(2, e._noise * 0.15);
}
for (const week of Object.keys(out)) {
  const ranked = out[week].slice().sort((a, b) => score(b) - score(a));
  const seen = new Set(), vids = new Set(), taught = new Set(), perPhrase = {}, kept = [];
  const take = (e) => { seen.add(sigOf(e)); vids.add(e.vid); e.teaches.forEach(t => { taught.add(t); perPhrase[t] = (perPhrase[t] || 0) + 1; }); delete e._noise; kept.push(e); };
  for (const e of ranked) {
    const sig = sigOf(e);
    if (seen.has(sig)) { dropped.duplicate++; continue; }        /* the same teaching moment */
    if (vids.has(e.vid)) { dropped.sameVideo++; continue; }      /* one passage per video */
    if (kept.some(k => overlaps(k.text, e.text))) { dropped.duplicate++; continue; }   /* the same words again */
    /* "I hear you" is a real match but a common one: ten passages teaching the same three words
       is not a week's worth of practice. Two per phrase, then make room for something else. */
    if (e.teaches.every(x => (perPhrase[x] || 0) >= 2)) { dropped.samePhrase++; continue; }
    /* the SECOND passage should widen the day, not repeat it: a different phrase if the library
       has one. Only the first two are offered to a learner, so the rule applies there. */
    if (kept.length === 1 && e.teaches.every(t => taught.has(t)) && ranked.some(o =>
        o !== e && !seen.has(sigOf(o)) && !vids.has(o.vid) && o.teaches.some(t => !taught.has(t)))) continue;
    take(e);
    if (kept.length >= 12) break;
  }
  out[week] = kept;
}

/* ------------------------------------------------- fill the weeks the phrases could not reach
   Every week gets an option (owner, 7 Nov 2026). Where the library never speaks the week's lines,
   the best ON-TOPIC passages stand in — expanded and filtered exactly like the others, and marked
   so the lesson can say what they are instead of implying they model the phrases. */
const TOPIC_MIN = 2;
let topicAdded = 0;
for (const week of Object.keys(phrases)) {
  const have = (out[week] || []).length;
  if (have >= TOPIC_MIN) continue;
  const pool = (topicPool[week] || []).sort((a, b) => b.n - a.n || b.density - a.density);
  const seen = new Set((out[week] || []).map(e => sigOf(e)));
  const vids = new Set((out[week] || []).map(e => e.vid));
  for (const c of pool) {
    if ((out[week] || []).length >= TOPIC_MIN) break;
    if (vids.has(c.vid)) continue;
    const cap = capOf(c.vid); if (!cap) continue;
    const asset = SS.normalizeCaptions(cap);
    const ex = DP.expandPassage(asset.segments, c.from, c.to);
    if (!ex || ex.seconds < DP.PASSAGE.minS) continue;
    /* judge the PASSAGE, not the paragraph that led to it */
    const pw = contentWords(ex.text); const bag = topicWords[week];
    const got = new Set(pw.filter(x => bag.has(x)));
    if (got.size < 3) continue;
    const e = { vid: c.vid, title: titleOf(c.vid), phrase: "", teaches: [], match: "topic",
      para: 0, of: 0, from: ex.from, to: ex.to, startMs: ex.startMs, endMs: ex.endMs,
      seconds: ex.seconds, sentences: ex.sentences, words: ex.words,
      wordTimes: Array.isArray(cap.words) && cap.words.length > 0,
      topicWords: got.size, topicHits: [...got].slice(0, 8),
      text: ex.text.length > 600 ? ex.text.slice(0, 597) + "\u2026" : ex.text };
    const sig = sigOf(e);
    if (seen.has(sig)) continue;
    if ((out[week] || []).some(k => overlaps(k.text, e.text))) continue;
    seen.add(sig); vids.add(c.vid);
    (out[week] = out[week] || []).push(e); topicAdded++;
  }
}
console.log(`topic passages added where the phrases were absent: ${topicAdded}`);

const weeks = Object.keys(out).map(Number).sort((a, b) => a - b);
const total = weeks.reduce((n, w) => n + out[w].length, 0);
console.log(`captions scanned: ${scannedFiles} files (${skippedNonGE} skipped as not General English), ${scannedParas} paragraphs`);
console.log(`passages found: ${total} across weeks ${weeks.join(", ")}`);
console.log(`dropped: ${JSON.stringify(dropped)}`);
const allWeeks = Object.keys(phrases).map(Number).sort((a, b) => a - b);
const empty = allWeeks.filter(w => !out[w]);
if (empty.length) console.log(`weeks with NO passage in the library: ${empty.join(", ")}  (the lesson will say so, not invent one)`);
for (const w of weeks) console.log(`  week ${String(w).padStart(2)}: ${String(out[w].length).padStart(2)} [${out[w].map(e => e.match[0]).join("")}]  e.g. ${out[w][0].seconds}s/${out[w][0].words}w "${out[w][0].phrase}" — ${out[w][0].title.slice(0, 34)}`);

if (dry) { console.log("\n--dry: nothing written"); process.exit(0); }
const file = { schemaVersion: "1", builtFrom: "captions/ + tracks/general/phrases.json", track: "general-english", weeks: out };
writeFileSync(R("tracks/general/clip-index.json"), JSON.stringify(file));
console.log(`\nwrote tracks/general/clip-index.json (${(JSON.stringify(file).length / 1024).toFixed(1)} KB)`);
