/* Weekly model-clip selection. Pure, no browser.   Run: node tests/week-pick.test.mjs
   Pools are built from the COMMITTED data: the caption-backed clip index (the lesson's clips today),
   the Introductions overlay, and the owner's review queue. */
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const src = read("week-pick.js"); (0, eval)(src);
const { WeekPick: WP } = globalThis;
const cat = read("onboarding-catalog.js");
const overlay = JSON.parse(read("catalogue/ideas-growth.json"));
const clipIndex = JSON.parse(read("tracks/general/clip-index.json")).weeks;
const queue = JSON.parse(read("catalogue/week-clips.json")).weeks;

let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 260)}`); };

/* the vocabularies, parsed from the catalogue so no id here is mine */
const PROF = [...cat.matchAll(/\["((?:[a-z0-9_]+)\.(?:[a-z0-9_]+))","([^"]*)","([a-z]+)","[^"]*"\]/g)].map(m => ({ id: m[1], label: m[2], group: m[3] }));
const PBYID = new Map(PROF.map(p => [p.id, p]));
const LEVELS = [...cat.match(/"CONFIDENCE":\[(.*?)\],"PRIORITIES"/)[1].matchAll(/\["[a-z_]+","([^"]+)"\]/g)].map(m => m[1]);
const inCatalogue = id => cat.includes(`["${id}","`);

const introIds = (overlay.categories.find(c => c.id === "introductions") || { vids: [] }).vids;
const intros = introIds.map(id => WP.fromIntro(id, overlay.videos[id]));
const idx = w => (clipIndex[String(w)] || []).map(e => WP.fromClipIndex(w, e));
const q = w => queue.filter(r => r.week === w).map(r => WP.fromQueue(r.week, r));
const pool = w => idx(w).concat(w === 1 ? intros : [], q(w));

/* a synthetic, fully-ready clip, for the rules that need a controlled input */
const mk = (id, o) => Object.assign({ key: id, id, week: 9, start: 0, end: 50, dur: 50, source: "test", editorial: "approved",
  role: null, roleGroup: null, industries: [], situations: [], wpm: 140, hasText: true, boundaries: "exact", embeddable: true, title: id }, o || {});

console.log("\n# the vocabularies are the catalogue's, not invented");
ok("every situation the module names exists in the catalogue", [...WP.INTRO_SITUATIONS, ...Object.values(WP.GOAL_SITUATIONS).flat()].every(inCatalogue));
ok("every goal it maps exists in the catalogue", Object.keys(WP.GOAL_SITUATIONS).every(inCatalogue));
ok("every level it sets a ceiling for is a real onboarding answer", Object.keys(WP.CEILING).every(l => LEVELS.includes(l)), Object.keys(WP.CEILING).filter(l => !LEVELS.includes(l)).join("|"));
ok("the catalogue has ~280 professions to cover", PROF.length > 250, String(PROF.length));
ok("all five onboarding answers were parsed (a regex that drops one is how this suite once under-counted)", LEVELS.length === 5, LEVELS.join("|"));
ok("the trap is live: a profession's GROUP differs from its id prefix", ["eng.civil_eng", "tech.product_manager", "energy.process_operator"].every(id => PBYID.get(id).group !== id.split(".")[0]));

console.log("\n# the data is honest");
ok("no clip carries other.other as a profession", Object.values(overlay.videos).every(v => v.role !== "other.other"));
ok("every tagged intro role is a real profession in its real group", introIds.every(id => { const v = overlay.videos[id]; return !v.role || (PBYID.has(v.role) && PBYID.get(v.role).group === v.roleGroup); }));
ok("the review queue holds the owner's 11 links, Weeks 1-11, once each", queue.length === 11 && queue.map(r => r.week).join() === "1,2,3,4,5,6,7,8,9,10,11");
ok("not one queue row claims to be lesson-ready", queue.every(r => r.lessonReady === false && r.editorial === "pending" && r.rights === "pending"));
ok("a segment is 'claimed' only where BOTH ends were given", queue.every(r => (r.boundaries === "claimed") === (r.start != null && r.end != null)));
ok("no stated start is past the end of its video", queue.every(r => r.technical.startInsideVideo !== false));
ok("every queue video was read as embeddable", queue.every(r => r.technical.state === "checked" && r.embeddable));
ok("no Introductions clip has a transcript in the app (so none can drive the shadow step)", intros.every(c => c.hasText === false));

console.log("\n# PRODUCTION: only what a human approved or the lesson already ships");
const re = { roleId: "retail.real_estate", roleCat: "retail", situations: ["clients"], goalId: "customer_clients", selfLevel: "Can get by" };
const prod = WP.choose(re, 1, pool(1));
ok("Week 1's usable clips are the shipping, caption-backed ones", prod.ranked.length === idx(1).length && prod.ranked.every(r => r.source === "clip-index"), prod.ranked.map(r => r.source).join());
ok("no Introductions clip is usable yet", !prod.ranked.some(r => r.source === "intros"));
ok("…but the would-be pick is an Introductions clip, and says why it is blocked", prod.wouldPick && prod.wouldPick.source === "intros" && prod.wouldPick.blockers.includes("no transcript in the app") && prod.wouldPick.blockers.includes("editorial review pending"), JSON.stringify(prod.wouldPick && prod.wouldPick.blockers));
const prev = WP.choose(re, 1, pool(1), { preview: true });
ok("preview relaxes editorial review but NEVER the transcript", !prev.ranked.some(r => r.source === "intros") && prev.wouldPick.blockers.length === 1 && prev.wouldPick.blockers[0] === "no transcript in the app", JSON.stringify(prev.wouldPick.blockers));

console.log("\n# the four required cases (would-be picks; blocked today, see blockers)");
const show = (label, r) => { const w = r.wouldPick; console.log(`     ${label.padEnd(24)} https://youtu.be/${w.id}  ${w.start}-${w.end}s  tier ${w.tier} ${w.why.match}${w.why.value ? ":" + w.why.value : ""}  [${w.role || "no role tag"}]`); };
const exact = WP.choose(re, 1, pool(1)); show("exact role", exact);
ok("1 · exact role: tier 1, the same profession", exact.wouldPick.tier === 1 && exact.wouldPick.role === "retail.real_estate");
const related = WP.choose({ roleId: "health.dentist", roleCat: "health", situations: [], goalId: "" }, 1, pool(1)); show("related role, same industry", related);
ok("2 · related role: tier 2, a clip in the same industry group, not the same profession", related.wouldPick.tier === 2 && related.wouldPick.roleGroup === "health" && related.wouldPick.role !== "health.dentist");
const sit = WP.choose({ roleId: "", roleCat: "", situations: ["interviews"], goalId: "ace_interviews" }, 1, pool(1)); show("work situation / goal", sit);
ok("3 · situation: tier 3, and why names the field", sit.wouldPick.tier === 3 && sit.wouldPick.why.field === "situations" && sit.wouldPick.why.value === "interviews");
const none = WP.choose({}, 1, pool(1)); show("no profile", none);
ok("4 · no profile: degraded, falls to the general tier", none.degraded === true && none.wouldPick.tier === 4);
const dr = WP.choose({ roleId: "health.doctor", roleCat: "health", situations: [], goalId: "" }, 1, pool(1));
ok("two different profiles get different clips for the same week", exact.wouldPick.id !== dr.wouldPick.id, exact.wouldPick.id + " vs " + dr.wouldPick.id);
const other = WP.choose({ roleId: "other.other", roleCat: "career", situations: [], goalId: "" }, 1, pool(1));
ok("an 'Other' learner is not an exact match for anything", other.degraded && other.wouldPick.tier === 4 && !other.candidates.some(c => c.tier < 4));
const stu = WP.choose({ roleId: "early.university_student", roleCat: "career", situations: [], goalId: "" }, 1, pool(1));
ok("a student is not matched on the non-industry group 'career'", stu.candidates.every(c => c.tier === 4));
ok("a goal alone reaches tier 3 through the situation it implies", WP.choose({ goalId: "speak_meetings" }, 1, pool(1)).wouldPick.tier === 3);

console.log("\n# level and pace — measured where there is a transcript, and only there");
const lvl = l => WP.choose({ selfLevel: l }, 9, idx(9)).ranked[0];
const nu = lvl("New to speaking English"), fl = lvl("Fluent, want to sound sharper");
console.log(`     Week 9, beginner: ${nu.wpm} wpm   fluent: ${fl.wpm} wpm   (the week's clips run ${Math.min(...idx(9).map(c => c.wpm))}-${Math.max(...idx(9).map(c => c.wpm))})`);
ok("two learners get different clips for the same weekly skill, by pace", nu.id !== fl.id && nu.wpm < fl.wpm, `${nu.wpm} vs ${fl.wpm}`);
ok("a beginner is never handed a too-fast clip while a gentler one exists", [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(w => { const r = WP.choose({ selfLevel: "New to speaking English" }, w, idx(w)); return !r.ranked[0].tooHard || r.ranked.every(c => c.tooHard); }));
const lev = WP.choose({ roleId: "x.y", roleCat: "tech", selfLevel: "Can get by" }, 9, [mk("AAAAAAAAAAA", { role: "x.y", wpm: 200 }), mk("BBBBBBBBBBB", { roleGroup: "tech", wpm: 140 })]);
ok("level outranks tier: a gentle related-role clip beats an exact-role clip they cannot follow", lev.ranked[0].id === "BBBBBBBBBBB", lev.ranked.map(r => r.id + ":" + r.tier + ":" + r.tooHard).join());
ok("pace is null, not guessed, for a clip with no transcript", intros.every(c => c.wpm === null));
ok("an unknown pace is never penalised", WP.choose({ selfLevel: "New to speaking English" }, 9, [mk("CCCCCCCCCCC", { wpm: null })]).ranked[0].tooHard === false);

console.log("\n# gaps keep the existing lesson usable");
const gap = WP.choose(re, 6, q(6));
ok("a week with only unapproved, transcript-less clips is a GAP, not a crash", gap.gap === true && gap.picked === -1 && gap.ranked.length === 0);
ok("…and its candidates are still listed, each with what blocks it", gap.candidates.length === 1 && gap.candidates[0].blockers.length >= 3, JSON.stringify(gap.candidates[0] && gap.candidates[0].blockers));
ok("an empty pool is a gap too", WP.choose({}, 3, []).gap === true);
ok("a clip outside the length band is held, with the reason", WP.choose({}, 1, [mk("DDDDDDDDDDD", { week: 1, dur: 300, end: 300 })]).held[0].reasons[0].includes("outside"));
ok("a clip with embedding off is held", WP.choose({}, 9, [mk("EEEEEEEEEEE", { embeddable: false })]).held.length === 1);
ok("a seed-label id is held", WP.choose({}, 9, [mk("ipg-001")]).held.length === 1);

console.log("\n# every supported profile has a path through Weeks 1-11");
let combos = 0, empty = [], bad = [];
const SIT = [[], ["interviews"], ["meetings", "calls"]];
for (const p of PROF) for (const lv of [...LEVELS, ""]) for (const sits of SIT) for (let w = 1; w <= 11; w++) {
  const r = WP.choose({ roleId: p.id, roleCat: p.group, situations: sits, selfLevel: lv }, w, pool(w)); combos++;
  if (r.gap || r.picked !== 0) empty.push(`${p.id}/${lv}/W${w}`); else if (!(r.ranked[0].tier >= 1 && r.ranked[0].tier <= 4)) bad.push(`${p.id}/W${w}`);
}
ok(`${PROF.length} professions × ${LEVELS.length + 1} levels × ${SIT.length} situation sets × 11 weeks = ${combos} profiles, each resolves to a usable clip`, empty.length === 0 && bad.length === 0, empty.slice(0, 3).join(" ") + " " + bad.slice(0, 3).join(" "));
ok("the learner with incomplete onboarding data resolves in every week", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(w => WP.choose({}, w, pool(w)).picked === 0));
console.log("     how many DIFFERENT clips the whole catalogue of professions actually produces, per week:");
const spread = {};
for (let w = 1; w <= 11; w++) { const s = new Set(); for (const p of PROF) s.add(WP.choose({ roleId: p.id, roleCat: p.group, situations: ["meetings"], selfLevel: "Can get by" }, w, pool(w)).ranked[0].key); spread[w] = s.size; }
console.log("     " + Object.entries(spread).map(([w, n]) => `W${w}:${n}`).join("  ") + "   <- 1 means every profession gets the same clip");

console.log("\n# stability");
const a = JSON.stringify(WP.choose(re, 9, pool(9))), b = JSON.stringify(WP.choose(re, 9, pool(9).slice().reverse()));
ok("the same input gives the same answer", a === JSON.stringify(WP.choose(re, 9, pool(9))));
ok("the order the pool arrives in does not change the ranking", JSON.parse(a).ranked.map(r => r.key).join() === JSON.parse(b).ranked.map(r => r.key).join());
ok("every ranked entry carries a stable key (id + start + end)", WP.choose(re, 9, pool(9)).ranked.every(r => /^[A-Za-z0-9_-]{11}:[\d.]+-[\d.]+$/.test(r.key)));
ok("why is structured data, never prose", WP.choose(re, 1, pool(1)).candidates.every(c => c.why && typeof c.why.tier === "number" && typeof c.why.match === "string" && c.why.match.indexOf(" ") < 0));

console.log("\n# Week 12 replays the exact Week 1 assignment");
const base = WP.choose(re, 1, pool(1)).ranked[0], asg = { id: base.id, start: base.start, end: base.end };
const same = WP.reuseWeek1(asg, pool(1), re);
ok("the same clip and segment come back", same.same === true && same.clip.id === asg.id && same.clip.start === asg.start && same.clip.end === asg.end);
const gone = WP.reuseWeek1(asg, pool(1).filter(c => c.id !== asg.id), re);
ok("if it is gone the original is preserved untouched", gone.same === false && gone.original.id === asg.id && gone.original.start === asg.start && gone.original.end === asg.end);
ok("…and any substitute is labelled a DIFFERENT clip", /DIFFERENT/.test(gone.label) && (!gone.substitute || gone.substitute.id !== asg.id));
ok("a different segment of the same video is not 'the same clip'", WP.reuseWeek1({ id: asg.id, start: asg.start + 1, end: asg.end }, pool(1), re).same === false);
ok("no assignment is stated plainly, not invented", WP.reuseWeek1(null, pool(1), re).original === null);

console.log("\n# the module is pure and track-agnostic");
ok("no DOM, network, storage or timers", !/\b(document|window|fetch|localStorage|sessionStorage|XMLHttpRequest|setTimeout|Math\.random|Date\.now)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")));
ok("the Welding bundle drops the registry", /catalogue\/week-clips\.json/.test(read("mobile/ios/scripts/sync-web.mjs")));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
