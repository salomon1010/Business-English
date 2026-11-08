/* The approved Week 1 model introductions -> catalogue/week1-models.json.

   Usage: node scripts/shadow/build-week1-models.mjs [--approvals <file>] [--out <file>]

   INPUT is catalogue/drafts/week1-model-approvals.json, written by a PERSON: one row per clip they have
   watched and approved, with the exact start and end they approved. This script never approves
   anything. It turns an approval into a lesson passage using the clip's BUNDLED captions
   (captions/<vid>.json), the same source and the same segments the lesson's other passages use.
   No captions bundled means no passage, and no passage means the clip is not offered — nothing is
   exported from YouTube and no transcript is ever written by hand.

   OUTPUT rows have the shape of a tracks/general/clip-index.json passage plus the tags WeekPick ranks
   on. Role and industry are checked against the onboarding catalogue; roleGroup is READ from the
   catalogue and never derived from the id prefix (eng.civil_eng is in `trades`).

   An empty approvals file produces an empty catalogue. That is the state the app ships in today, and
   the lesson handles it: the baseline recording stays usable and the model block says why it is absent. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const R = p => resolve(root, p);
const win = {};
new Function("window", readFileSync(R("shadow-sync.js"), "utf8"))(win);
const SS = win.ShadowSync;

const catalogue = readFileSync(R("onboarding-catalog.js"), "utf8");
const PROF = new Map([...catalogue.matchAll(/\["((?:[a-z0-9_]+)\.(?:[a-z0-9_]+))","([^"]*)","([a-z]+)","[^"]*"\]/g)].map(m => [m[1], m[3]]));
const GROUPS = new Set([...catalogue.matchAll(/"GROUPS":\[(.*?)\],"PROFESSIONS"/g)].flatMap(m => [...m[1].matchAll(/\["([a-z]+)","/g)].map(x => x[1])));
const SITUATIONS = new Set([...(catalogue.match(/"SITUATIONS":\[(.*?)\],"SITGROUPS"/) || ["", ""])[1].matchAll(/\["([a-z_]+)","/g)].map(x => x[1]));

/* A caption line may begin or end a little off the instant a person reads off a player. Beyond this the
   approval does not describe the captions and is refused rather than silently moved. */
const TOLERANCE_S = 1.5;

export function buildEntry(a, readCaptions) {
  const why = m => ({ ok: false, vid: a && a.vid, error: m });
  if (!a || !/^[A-Za-z0-9_-]{11}$/.test(String(a.vid || ""))) return why("not a YouTube video id");
  if (a.editorial !== "approved") return why('editorial must be "approved" — this script does not approve');
  if (!a.approvedBy || !a.approvedOn) return why("approvedBy and approvedOn are required: an approval is a person's decision");
  if (!(typeof a.start === "number" && typeof a.end === "number" && a.end > a.start)) return why("start and end (seconds) are required");
  if (a.role != null && !PROF.has(a.role)) return why(`role ${a.role} is not in the onboarding catalogue`);
  for (const g of a.industries || []) if (!GROUPS.has(g)) return why(`industry ${g} is not a catalogue group`);
  for (const s of a.situations || []) if (!SITUATIONS.has(s)) return why(`situation ${s} is not a catalogue situation`);
  const cap = readCaptions(a.vid);
  if (!cap) return why(`captions/${a.vid}.json is not bundled — no transcript, so no lesson passage`);
  const segs = SS.normalizeCaptions(cap).segments;
  const s0 = segs.findIndex(s => s.endMs / 1000 > a.start + 0.2);
  let s1 = -1; segs.forEach((s, i) => { if (s.startMs / 1000 < a.end - 0.2) s1 = i; });
  if (s0 < 0 || s1 < s0) return why("no caption lines fall inside the approved range");
  const startMs = segs[s0].startMs, endMs = segs[s1].endMs;
  if (Math.abs(startMs / 1000 - a.start) > TOLERANCE_S || Math.abs(endMs / 1000 - a.end) > TOLERANCE_S)
    return why(`the approved ${a.start}-${a.end}s does not align with caption lines (${(startMs / 1000).toFixed(1)}-${(endMs / 1000).toFixed(1)}s); re-approve on a sentence boundary`);
  const text = segs.slice(s0, s1 + 1).map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length, seconds = Math.round((endMs - startMs) / 100) / 10;
  if (seconds < 25 || seconds > 75) return why(`${seconds}s is outside the 25-75s a learner can shadow whole`);
  return { ok: true, entry: {
    vid: a.vid, title: String(a.title || ""), phrase: "", teaches: [], match: "model", para: 0, of: 1, from: s0, to: s1,
    startMs, endMs, seconds, sentences: (text.match(/[.!?]+(\s|$)/g) || []).length || 1, words,
    wordTimes: Array.isArray(cap.words) && cap.words.length > 0, text: text.length > 600 ? text.slice(0, 597) + "…" : text,
    role: a.role || null, roleGroup: a.role ? PROF.get(a.role) : null,
    industries: a.industries || [], situations: a.situations || [],
    editorial: "approved", approvedBy: a.approvedBy, approvedOn: a.approvedOn, fixture: !!a.fixture } };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const inF = R(arg("--approvals") || "catalogue/drafts/week1-model-approvals.json"), outF = R(arg("--out") || "catalogue/week1-models.json");
  const approvals = existsSync(inF) ? JSON.parse(readFileSync(inF, "utf8")).clips || [] : [];
  const read = vid => { try { return JSON.parse(readFileSync(R("captions/" + vid + ".json"), "utf8")); } catch { return null; } };
  const out = [], refused = [];
  for (const a of approvals) { const r = buildEntry(a, read); r.ok ? out.push(r.entry) : refused.push(r); }
  writeFileSync(outF, JSON.stringify({ built: new Date().toISOString().slice(0, 10), clips: out }, null, 1) + "\n");
  console.log(`${approvals.length} approval(s): ${out.length} built, ${refused.length} refused -> ${outF}`);
  refused.forEach(r => console.log(`  REFUSED ${r.vid}: ${r.error}`));
  process.exit(refused.length ? 1 : 0);
}
