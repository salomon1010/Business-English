/* Translation review, both directions.
   ---------------------------------------------------------------------------
   The review/ CSVs were built once by hand in August and review/ is gitignored,
   so there was nothing to re-run when the English copy moved — and it has moved
   a lot. This is that missing script, and it also takes the reviewer's file back
   in, which was the part with no path at all: corrections were going to arrive
   as a spreadsheet and someone was going to retype 189 rows into JSON.

       node scripts/translation-review.mjs build fr          -> review/fr-french.csv
       node scripts/translation-review.mjs build all
       node scripts/translation-review.mjs apply fr <file>   -> writes i18n/fr.json
       node scripts/translation-review.mjs apply fr <file> --dry

   WHAT GOES IN THE PACK. Only the writing — full sentences a human can judge as
   prose. Buttons and labels are excluded because a wrong one is obvious and
   rare, and because 1,300 rows is a job nobody finishes, while 190 is an
   evening. The filter is deliberately about sentence-ness, not key names, so a
   new narrative string is picked up without anyone maintaining a list.

   APPLY IS DELIBERATELY STRICT. A translation that drops a {{placeholder}} does
   not fail loudly at runtime — it renders "{{name}}" to a learner, or silently
   loses the number in "{{n}} words are due". So a replacement that loses a
   placeholder the English has is REJECTED and reported, never written. Same for
   unbalanced HTML tags. The reviewer is a language expert, not a template
   expert; catching this is the tool's job, not theirs.
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const [, , cmd, code, file, ...rest] = process.argv;
const DRY = rest.includes("--dry");

const NAMES = {
  es: "spanish", fr: "french", pt: "portuguese", it: "italian", de: "german",
  ru: "russian", ar: "arabic", ur: "urdu", hi: "hindi", bn: "bengali",
  id: "indonesian", vi: "vietnamese", zh: "chinese", ja: "japanese", ko: "korean",
};

/* I18N_EN is a JS object literal inside index.html, not JSON, so it is read the
   way the app's own audits read it: by key/value pair, not by parsing. */
function englishMaster() {
  const h = readFileSync("index.html", "utf8");
  const i = h.indexOf("I18N_EN=");
  const j = h.indexOf("\n};", i);
  const body = h.slice(i, j);
  const out = {};
  const re = /"([A-Za-z0-9_.\-]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(body))) {
    out[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  }
  return out;
}

const words = (s) => s.trim().split(/\s+/).length;
/* Prose, not chrome: a real sentence, long enough to have a voice in it. */
const isProse = (s) => words(s) >= 7 && /[.!?…]/.test(s);

const PH = (s) => (s.match(/\{\{[a-zA-Z0-9_]+\}\}/g) || []).sort();
const TAGS = (s) => (s.match(/<\/?[a-z][^>]*>/gi) || []).map(t => t.toLowerCase().replace(/\s.*?>/, ">")).sort();

const csvCell = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
const csvLine = (a) => a.map(csvCell).join(",");

/* A minimal RFC-4180 reader: quoted fields, doubled quotes, embedded newlines.
   Spreadsheets emit all three and a split(",") would corrupt exactly the rows
   that matter most — the long ones. */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  text = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x !== ""));
}

function build(lang) {
  const EN = englishMaster();
  const cur = JSON.parse(readFileSync(`i18n/${lang}.json`, "utf8"));
  const keys = Object.keys(EN).filter(k => isProse(EN[k])).sort();
  const head = ["key", "English source", "Current translation",
    "Verdict (OK / Fix)", "Your replacement", "Notes"];
  const lines = [csvLine(head)];
  let untranslated = 0;
  for (const k of keys) {
    const t = cur[k];
    if (t == null) untranslated++;
    lines.push(csvLine([k, EN[k], t == null ? "" : t, "", "", ""]));
  }
  mkdirSync("review", { recursive: true });
  const out = `review/${lang}-${NAMES[lang] || lang}.csv`;
  writeFileSync(out, "﻿" + lines.join("\n") + "\n");
  const wc = keys.reduce((n, k) => n + words(EN[k]), 0);
  console.log(`${out}  ${keys.length} rows, ~${wc.toLocaleString()} English words`
    + (untranslated ? `, ${untranslated} with no translation yet` : ""));
}

function apply(lang, path) {
  if (!existsSync(path)) { console.error(`No such file: ${path}`); process.exit(1); }
  const EN = englishMaster();
  const target = `i18n/${lang}.json`;
  const cur = JSON.parse(readFileSync(target, "utf8"));
  const rows = parseCSV(readFileSync(path, "utf8"));
  const head = rows.shift().map(h => h.trim().toLowerCase());
  const col = (name) => head.findIndex(h => h.startsWith(name));
  const cK = col("key"), cV = col("verdict"), cR = col("your replacement");
  if (cK < 0 || cV < 0 || cR < 0) {
    console.error("Missing a column. Expected key / Verdict / Your replacement.");
    process.exit(1);
  }
  let applied = 0, ok = 0, blank = 0;
  const rejected = [];
  for (const r of rows) {
    const key = (r[cK] || "").trim();
    const verdict = (r[cV] || "").trim().toLowerCase();
    const repl = (r[cR] || "").trim();
    if (!key || !(key in EN)) continue;
    if (verdict.startsWith("ok")) { ok++; continue; }
    if (!verdict.startsWith("fix")) continue;
    if (!repl) { blank++; rejected.push([key, "marked Fix but no replacement given"]); continue; }
    const wantPH = PH(EN[key]).join(","), gotPH = PH(repl).join(",");
    if (wantPH !== gotPH) {
      rejected.push([key, `placeholders changed: English has [${wantPH || "none"}], replacement has [${gotPH || "none"}]`]);
      continue;
    }
    const wantT = TAGS(EN[key]).join(","), gotT = TAGS(repl).join(",");
    if (wantT !== gotT) {
      rejected.push([key, `HTML tags changed: English has [${wantT || "none"}], replacement has [${gotT || "none"}]`]);
      continue;
    }
    if (cur[key] !== repl) { cur[key] = repl; applied++; }
  }
  console.log(`${path}: ${ok} kept as OK, ${applied} corrections`
    + (blank ? `, ${blank} marked Fix with nothing to apply` : ""));
  if (rejected.length) {
    console.log(`\n${rejected.length} row(s) NOT applied — these need a look:`);
    for (const [k, why] of rejected) console.log(`  ${k}\n     ${why}`);
  }
  if (DRY) { console.log("\n--dry: nothing written."); return; }
  if (!applied) { console.log("Nothing to write."); return; }
  writeFileSync(target, JSON.stringify(cur, null, 1) + "\n");
  console.log(`\nWrote ${target}. Check it with git diff before committing.`);
}

const LANGS = Object.keys(NAMES);
if (cmd === "build") {
  const list = code === "all" ? LANGS : [code];
  if (!code || (code !== "all" && !NAMES[code])) { console.error(`Usage: build <${LANGS.join("|")}|all>`); process.exit(1); }
  list.forEach(build);
} else if (cmd === "apply") {
  if (!NAMES[code] || !file) { console.error("Usage: apply <lang> <filled.csv> [--dry]"); process.exit(1); }
  apply(code, file);
} else {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0].replace(/^\/\*/, ""));
}
