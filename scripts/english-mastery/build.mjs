/* English Mastery — builds tracks/general/mastery.json (10 Oct 2026).
   Run from the repo root: node scripts/english-mastery/build.mjs

   The curriculum stays the single source: the 116 professional phrases and 36
   idioms (tracks/general/phrases.json), the mission expressions and the
   situations of the 24 competency missions (missions.json), the 48 grammar
   exercises (vocabulary.json) and the 45 Foundations sentences with their 15
   glosses (foundations.json) are READ from those files, never copied by hand.
   What this folder adds: an example sentence for each phrase and expression,
   about 150 everyday words (everyday.json) and the three replies of each
   Real-Life Mission (missions.json here). Every example is checked against its
   word; the build stops on any problem rather than ship a broken card. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const here = f => rd("scripts/english-mastery/" + f);
const errors = [];
const fail = m => errors.push(m);

const phrases = rd("tracks/general/phrases.json").phrases;
const comps = rd("tracks/general/missions.json").competencies;
const vocab = rd("tracks/general/vocabulary.json");
const fnd = rd("tracks/general/foundations.json");
const weeks = rd("tracks/general/weeks.json").weeks;
const phEx = here("phrase-examples.json"), xEx = here("expression-examples.json"), every = here("everyday.json"), mis = here("missions.json");

const norm = s => String(s || "").toLowerCase().replace(/[’‘]/g, "'").replace(/…/g, " ").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
const slug = s => norm(s).replace(/'/g, "").replace(/ /g, "-").slice(0, 40).replace(/-+$/, "");
/* an example must contain its word: the whole phrase, or every segment of a chained phrase
   ("At a high level… the main blocker is…"), or for a single word its stem (greet → greeted) */
function contains(ex, word) {
  const e = " " + norm(ex) + " ";
  const segs = String(word).split(/…|\b[XY]\b/).map(norm).filter(Boolean);   /* "X" / "Y" in a phrase are placeholders */
  if (segs.every(s => e.includes(" " + s + " ") || e.includes(" " + s))) return true;
  const w = norm(word);
  if (!/ /.test(w) && w.length >= 4) return e.includes(" " + w.slice(0, Math.max(4, w.length - 2)));
  if (/ /.test(w)) { const parts = w.split(" "); return parts.every(p => p.length < 4 ? e.includes(" " + p + " ") || e.includes(" " + p) : e.includes(" " + p.slice(0, Math.max(3, p.length - 2)))); }
  return false;
}

/* ---- stages: 1 Foundations, 5 everyday topics, 6 two-week blocks of the plan, idioms ---- */
const WK = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]];
const wkStage = w => "wk" + WK.find(([a, b]) => w >= a && w <= b)[0];
const theme = n => (weeks.find(x => x.n === n) || {}).theme || "";
const shortTheme = n => theme(n).split(/[&,]/)[0].trim();
const categories = [{ id: "first", en: "First steps", fr: "Premiers pas", ic: "spark", kind: "sentence", sub: "Foundations — 45 everyday sentences, A1–A2" }]
  .concat(every.categories.map(c => ({ id: c.id, en: c.en, fr: c.fr, ic: c.ic, kind: "everyday" })))
  .concat(WK.map(([a, b]) => ({ id: "wk" + a, en: `Weeks ${a}–${b}: ${shortTheme(a)} · ${shortTheme(b)}`, fr: `Semaines ${a}–${b}`, ic: "briefcase", kind: "work", weeks: [a, b] })))
  .concat([{ id: "idioms", en: "Business idioms", fr: "Expressions idiomatiques", ic: "chat", kind: "idiom" }]);

const terms = [], seen = new Set();
function add(t) {
  if (seen.has(t.id)) return fail("duplicate id " + t.id);
  const k = norm(t.en); if (terms.some(x => norm(x.en) === k)) return fail("duplicate word " + t.en);
  seen.add(t.id); terms.push(t);
}

/* 1. Foundations: the sentence and its 15 glosses, straight from the pack */
const GLOSS_LANGS = ["fr", "es", "pt", "it", "de", "ru", "ar", "ur", "hi", "bn", "id", "vi", "zh", "ja", "ko"];
fnd.days.forEach(d => d.items.forEach((it, i) => {
  const gl = {}; GLOSS_LANGS.forEach(l => { if (it[l]) gl[l] = it[l]; });
  add({ id: `em-f-${d.n}-${i}`, en: it.en, cat: "first", lvl: d.n <= 7 ? "A1" : "A2", wk: 0, kind: "sentence",
    def: { en: `Foundations, day ${d.n}: ${d.theme}` }, use: { en: "" }, ex: { en: "" }, syn: [], gl, src: "foundations.json" });
}));

/* 2. Everyday words (new, A1–B1) */
every.categories.forEach(c => c.words.forEach(([en, lvl, def, ex, syn]) => {
  if (!contains(ex, en)) fail(`everyday "${en}": example does not use the word — "${ex}"`);
  if (!/^[ABC][12]$/.test(lvl)) fail(`everyday "${en}": level ${lvl}`);
  add({ id: "em-" + slug(en), en, cat: c.id, lvl, wk: 0, kind: "word", def: { en: def }, use: { en: "" }, ex: { en: ex }, syn: syn || [], src: "everyday" });
}));

/* 3. The plan's phrases and idioms, with the expressions' plain definitions where they match */
const exprByNorm = {}; comps.forEach(c => c.expressions.forEach(e => { exprByNorm[norm(e.w)] = Object.assign({ week: c.week, comp: c.id }, e); }));
phrases.forEach((p, i) => {
  if (p.i) {
    const m = /^(.*?)\s+—\s+“(.+)”\s*$/.exec(p.u);
    if (!m) return fail("idiom without meaning — example: " + p.p);
    add({ id: "em-i-" + slug(p.p), en: p.p, cat: "idioms", lvl: "B2", wk: p.w, kind: "idiom", def: { en: m[1].replace(/^To /, "to ").replace(/^./, c => c.toUpperCase()) + "." }, use: { en: "" }, ex: { en: m[2] }, syn: [], src: "phrases.json" });
    return;
  }
  const ex = phEx[String(i)];
  if (!ex) return fail("phrase without example #" + i + " " + p.p);
  if (!contains(ex, p.p)) fail(`phrase #${i} "${p.p}": example does not use it — "${ex}"`);
  const x = exprByNorm[norm(p.p)];
  let pid = "em-p-" + slug(p.p); if (seen.has(pid)) pid += "-" + i;   /* two long phrases can share their first 40 characters */
  add({ id: pid, en: p.p, cat: wkStage(p.w), lvl: x ? x.l : p.w <= 4 ? "B1" : "B2", wk: p.w, kind: "phrase",
    def: { en: x ? x.def.replace(/^./, c => c.toUpperCase()) + "." : p.u + "." }, use: { en: p.u }, ex: { en: ex }, syn: [], src: "phrases.json", comp: x ? x.comp : undefined });
});
/* 4. The expressions that are not already a phrase */
comps.forEach(c => c.expressions.forEach(e => {
  const k = norm(e.w);
  if (terms.some(t => norm(t.en) === k)) return;
  const ex = xEx[e.w];
  if (!ex) return fail("expression without example: " + e.w);
  if (!contains(ex, e.w)) fail(`expression "${e.w}": example does not use it — "${ex}"`);
  add({ id: "em-x-" + slug(e.w), en: e.w, cat: wkStage(c.week), lvl: e.l, wk: c.week, kind: "expression", def: { en: e.def.replace(/^./, ch => ch.toUpperCase()) + "." }, use: { en: "" }, ex: { en: ex }, syn: [], src: "missions.json", comp: c.id });
}));

/* 5. Grammar: the 48 exercises, as they are */
const grammar = [];
Object.entries(vocab.grammarExercises).forEach(([cat, list]) => list.forEach((g, i) => {
  if (!Array.isArray(g.o) || g.o[g.a] == null) return fail("grammar " + cat + i);
  grammar.push({ id: `em-g-${cat}-${i}`, cat, q: g.q, o: g.o, a: g.a, why: g.why });
}));

/* 6. Real-Life Missions: the competency situations word for word + the replies written here */
const missions = [];
const compOf = id => comps.find(c => c.missions.some(m => m.id === id));
mis.work.forEach(m => {
  const c = compOf(m.mission); if (!c) return fail("unknown mission " + m.mission);
  const src = c.missions.find(x => x.id === m.mission);
  if (m.options.length !== 3) fail("mission options " + m.mission);
  missions.push({ id: "em-m-" + m.mission, cat: wkStage(c.week), wk: c.week, comp: c.id, kind: "work", title: c.title,
    where: src.see.where, who: src.see.who, asks: src.see.asks, goal: src.see.goal || "", context: src.context || "",
    options: m.options.map((en, k) => ({ en, ok: k === 0 })), why: m.why, shadow: c.shadow ? { vid: c.shadow.vid, title: c.shadow.title } : null });
});
mis.everyday.forEach(m => {
  if (!categories.some(c => c.id === m.cat)) fail("mission cat " + m.id);
  missions.push({ id: "em-m-" + m.id.replace(/^ev-/, "ev-"), cat: m.cat, wk: 0, comp: null, kind: "everyday", title: "",
    where: m.where, who: m.who, asks: m.asks, goal: "", context: "", options: m.options.map((en, k) => ({ en, ok: k === 0 })), why: m.why, shadow: null });
});

categories.forEach(c => { c.n = terms.filter(t => t.cat === c.id).length; if (!c.n) fail("empty stage " + c.id); });
if (errors.length) { console.error(errors.join("\n")); console.error(`\n${errors.length} problem(s) — nothing written.`); process.exit(1); }
const out = { schemaVersion: 1, trackId: "general", title: { en: "English Mastery", fr: "English Mastery" }, built: "scripts/english-mastery/build.mjs", categories, terms, grammar, missions };
fs.writeFileSync(path.join(ROOT, "tracks/general/mastery.json"), JSON.stringify(out) + "\n");
const by = k => terms.filter(t => t.kind === k).length;
console.log(`terms ${terms.length} (sentences ${by("sentence")}, everyday ${by("word")}, phrases ${by("phrase")}, expressions ${by("expression")}, idioms ${by("idiom")}) · grammar ${grammar.length} · missions ${missions.length} · stages ${categories.length}`);
console.log(categories.map(c => `${c.id}:${c.n}`).join(" "));
