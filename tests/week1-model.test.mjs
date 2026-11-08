/* FIXTURE TESTS for the Week 1 model introduction (pure). Run: node tests/week1-model.test.mjs
   The clips here are real captioned library videos given TEST role tags. They exercise the logic; they
   are NOT approved content, and a pass here says nothing about the real catalogue.
   (tests/week1-baseline.mjs drives the same logic through the real lesson in a browser.) */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root = new URL("..", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
(0, eval)(read("week-pick.js")); (0, eval)(read("week1-model.js"));
const { WeekPick: WP, Week1Model: M } = globalThis;
const { buildEntry } = await import(new URL("scripts/shadow/build-week1-models.mjs", root));
const idx = JSON.parse(read("tracks/general/clip-index.json")).weeks;
const readCaps = vid => { try { return JSON.parse(read("captions/" + vid + ".json")); } catch { return null; } };

let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 250)}`); };

/* three DIFFERENT captioned videos whose passages are shadowable whole */
const src = Object.values(idx).flat().filter(e => e.seconds >= 40 && e.seconds <= 72);
const distinct = []; for (const e of src) if (!distinct.some(d => d.vid === e.vid)) distinct.push(e);
const [A, B, G, X] = distinct;
const approval = (e, o) => Object.assign({ vid: e.vid, title: "FIXTURE " + e.title, start: e.startMs / 1000, end: e.endMs / 1000, editorial: "approved",
  approvedBy: "fixture", approvedOn: "2026-11-08", fixture: true }, o);
const build = (e, o) => buildEntry(approval(e, o), readCaps);
/* a start in the MIDDLE of a long caption line cannot align with any line boundary (an offset can, by luck) */
const _w = {}; new Function("window", read("shadow-sync.js"))(_w);
const midLine = (() => { const sg = _w.ShadowSync.normalizeCaptions(readCaps(A.vid)).segments.filter(x => x.startMs >= A.startMs && x.endMs <= A.endMs && x.endMs - x.startMs >= 3300)[0];
  return sg ? (sg.startMs + sg.endMs) / 2000 : null; })();

console.log("\n# the builder only turns a PERSON's approval into a passage");
ok("a good approval builds a passage with real caption text", (r => r.ok && r.entry.text.length > 40 && r.entry.seconds >= 25)(build(A, { role: "retail.real_estate" })));
ok("it refuses anything not marked approved", !build(A, { editorial: "pending" }).ok);
ok("it refuses an approval nobody signed", !build(A, { approvedBy: "" }).ok);
ok("it refuses a clip with no bundled captions (no transcript, no passage)", /not bundled/.test(buildEntry(approval(A, { vid: "ZZZZZZZZZZZ" }), readCaps).error || ""));
ok("it refuses a role that is not in the onboarding catalogue", !build(A, { role: "made.up_role" }).ok);
ok("the test found a caption line long enough to aim at", midLine !== null);
ok("it refuses an approved range that does not match the caption lines", /does not align/.test(build(A, { start: midLine }).error || ""), JSON.stringify(build(A, { start: midLine })));
ok("roleGroup is READ from the catalogue, not taken from the id prefix", build(A, { role: "eng.civil_eng" }).entry.roleGroup === "trades");
ok("an unknown industry is refused", !build(A, { industries: ["nonsense"] }).ok);

/* the three fixture clips: a real-estate intro, a doctor intro and a GENERAL one */
const eA = build(A, { role: "retail.real_estate", situations: ["clients"] }).entry, eB = build(B, { role: "health.doctor" }).entry, eG = build(G).entry;
const pool = M.poolOf({ clips: [eA, eB, eG] });
const prof = (o) => Object.assign({ selfLevel: "Can get by" }, o);
const RE = prof({ roleId: "retail.real_estate", roleCat: "retail" }), DR = prof({ roleId: "health.doctor", roleCat: "health" });
const DENT = prof({ roleId: "health.dentist", roleCat: "health" }), NONE = {};

console.log("\n# selection through the freeze");
const fRE = M.freeze(RE, pool, null, 1000), fDR = M.freeze(DR, pool, null, 1000), fDent = M.freeze(DENT, pool, null, 1000), fNone = M.freeze(NONE, pool, null, 1000);
const pick = f => M.current(f.model);
console.log(`     exact role      ${pick(fRE).vid}  ${pick(fRE).startMs / 1000}-${pick(fRE).endMs / 1000}s  tier ${pick(fRE).tier}  (${eA.role})`);
console.log(`     same level, other job  ${pick(fDR).vid}  tier ${pick(fDR).tier}`);
console.log(`     related role    ${pick(fDent).vid}  tier ${pick(fDent).tier}`);
console.log(`     no profile      ${pick(fNone).vid}  tier ${pick(fNone).tier}`);
ok("an exact role match is tier 1 and is the real-estate clip", pick(fRE).tier === 1 && pick(fRE).vid === A.vid);
ok("TWO learners at the SAME level get DIFFERENT clips because of their professions", pick(fRE).vid !== pick(fDR).vid, `${pick(fRE).vid} vs ${pick(fDR).vid}`);
ok("a related role in the same industry is tier 2 (a dentist gets the doctor's clip)", pick(fDent).tier === 2 && pick(fDent).vid === B.vid);
ok("a learner with no profile gets the GENERAL fallback, not somebody's job", pick(fNone).vid === G.vid && pick(fNone).tier === 4);
ok("a learner who answered 'Other' is an exact match for nothing", pick(M.freeze(prof({ roleId: "other.other", roleCat: "career" }), pool, null, 1000)).vid === G.vid);

console.log("\n# what is frozen, and what is written once");
ok("freeze keeps a short ranked list and a snapshot of each passage", fRE.model.ranked.length === 3 && Object.keys(fRE.model.passages).length === 3);
ok("the snapshot carries the transcript, so the lesson never depends on the live catalogue", pick(fRE).text.length > 40);
ok("the assignment records the exact id and segment", fRE.assign.vid === A.vid && fRE.assign.start === pick(fRE).startMs / 1000 && fRE.assign.end === pick(fRE).endMs / 1000 && fRE.assign.src === "week-pick");
const again = M.freeze(DR, pool, fRE.assign, 2000);
ok("a RESTART rebuilds from the stored assignment and never re-selects (a doctor still gets the real-estate clip)", M.current(again.model).vid === A.vid && again.assign === null);
ok("…even though this profile would choose differently on its own", pick(fDR).vid !== A.vid);
ok("…and the clip keeps the REASON it was assigned for, not a new one for today's profile", M.current(again.model).tier === 1 && M.current(again.model).why.match === "profession" && M.current(again.model).why.value === "retail.real_estate");
ok("the original assignment is unavailable-but-preserved if its clip leaves the catalogue", (f => f.model.unavailable === true && f.model.original.vid === A.vid)(M.freeze(RE, M.poolOf({ clips: [eB, eG] }), fRE.assign, 3000)));

console.log("\n# an empty catalogue keeps the baseline usable");
const empty = M.freeze(RE, M.poolOf({ clips: [] }), null, 1000);
ok("an empty catalogue is a gap with a reason, not a crash", empty.model.gap === true && empty.assign === null && /empty/.test(empty.model.reason));
ok("…and nothing is assigned, so Week 12 is never handed a clip that was never shown", empty.assign === null);
ok("the model block is absent but the learner is told why", M.status(empty.model, 0, true).phase === "empty" && !!M.status(empty.model, 0, true).reason);
ok("a missing models file behaves like an empty one", M.freeze(RE, M.poolOf(null), null, 1).model.gap === true);

console.log("\n# a clip that cannot play is never a dead end");
let m = fRE.model; const first = M.current(m).key;
ok("another eligible clip is offered", M.alternatives(m) === 2);
m = M.fail(m, first, "player error");
ok("a failure moves to the NEXT clip and records why", M.current(m).key !== first && m.failed[0].key === first && m.failed[0].reason === "player error");
ok("a failed clip is never offered again", M.alternatives(m) === 1);
m = M.fail(m, M.current(m).key, "captions");
m = M.fail(m, M.current(m).key, "player error");
ok("when every clip has failed the model is exhausted — and says so", m.exhausted === true && M.current(m) === null && M.status(m, 0, true).phase === "exhausted");
ok("failing a clip never touches the stored assignment", fRE.assign.vid === A.vid);

console.log("\n# the learner's path: baseline first, then the model, then a second take");
ok("before the baseline nothing is revealed", M.status(fRE.model, 0, false).reveal === false && M.status(fRE.model, 0, false).phase === "baseline");
ok("after the baseline the model is revealed and shadowing may start", (s => s.reveal && s.canShadow && !s.canRecordAfter && s.phase === "shadowing")(M.status(fRE.model, 0, true)));
ok("5 shadows are not enough to record again", M.status(fRE.model, 5, true).canRecordAfter === false);
ok("6 shadows unlock the second take", M.status(fRE.model, 6, true).canRecordAfter === true && M.status(fRE.model, 6, true).phase === "ready-for-second-take");
ok("8 is where the guidance stops asking for more, but more is never refused", M.status(fRE.model, 8, true).atMax === true && M.status(fRE.model, 11, true).canShadow === true);
ok("the model is gated on the baseline TAKE, so a typed baseline also counts as uncoached", M.status(fRE.model, 0, true).reveal === true);

console.log("\n# the shipping catalogue");
const shipped = JSON.parse(read("catalogue/week1-models.json")), approvals = JSON.parse(read("catalogue/drafts/week1-model-approvals.json"));
ok("it ships EMPTY: nobody has approved a clip", shipped.clips.length === 0 && approvals.clips.length === 0);
ok("the generated catalogue is exactly what the approvals produce", (() => { const d = mkdtempSync(join(tmpdir(), "w1m-")); const o = join(d, "out.json"); const r = spawnSync("node", ["scripts/shadow/build-week1-models.mjs", "--out", o], { cwd: new URL(".", root).pathname }); return r.status === 0; })());
const sw = read("mobile/ios/scripts/sync-web.mjs");
ok("it is dropped from the WELDING bundle (a General English feature must not ship there)", /"catalogue\/week1-models\.json"/.test(sw));
ok("the approvals file lives under catalogue/drafts, which BOTH bundles prune", /catalogue\/drafts\/week1-model-approvals\.json/.test(read("scripts/shadow/build-week1-models.mjs")) && (sw.match(/"catalogue\/drafts"/g) || []).length >= 2);

console.log("\n# purity");
ok("no DOM, network, storage or timers", !/\b(document|window|fetch|localStorage|sessionStorage|XMLHttpRequest|setTimeout|Math\.random|Date\.now)\b/.test(read("week1-model.js").replace(/\/\*[\s\S]*?\*\//g, "")));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
