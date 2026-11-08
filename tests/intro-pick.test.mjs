/* Week 1 baseline clip selection. Pure, no browser.  Run: node tests/intro-pick.test.mjs */
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../intro-pick.js", import.meta.url), "utf8");
(0, eval)(src);
const { IntroPick } = globalThis;
const cat = readFileSync(new URL("../onboarding-catalog.js", import.meta.url), "utf8");
const PROF = new Map([...cat.matchAll(/\["((?:[a-z0-9_]+)\.(?:[a-z0-9_]+))","([^"]*)","([a-z]+)","([^"]*)"\]/g)].map(m => [m[1], { label: m[2], group: m[3] }]));
const overlay = JSON.parse(readFileSync(new URL("../catalogue/ideas-growth.json", import.meta.url)));
const intro = (overlay.categories.find(c => c.id === "introductions") || { vids: [] }).vids;
const clips = intro.map(id => { const v = overlay.videos[id]; return { id, dur: v.dur, caps: v.cap === "player" ? "auto" : "none", embeddable: true, role: v.role, roleGroup: v.roleGroup }; });

let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

console.log("\n# the vocabularies are real, not invented");
ok("every INTRO_SITUATIONS id exists in the catalogue", IntroPick.INTRO_SITUATIONS.every(s => cat.includes(`["${s}","`)), IntroPick.INTRO_SITUATIONS.join());
ok("every INTRO_GOALS id exists in the catalogue", IntroPick.INTRO_GOALS.every(g => cat.includes(`["${g}","`)), IntroPick.INTRO_GOALS.join());
ok("every clip's role is a real profession id", clips.every(c => !c.role || PROF.has(c.role)), clips.filter(c => c.role && !PROF.has(c.role)).map(c => c.role).join());
ok("every clip's roleGroup is that profession's catalogue group (not the id prefix)",
   clips.every(c => !c.role || PROF.get(c.role).group === c.roleGroup),
   clips.filter(c => c.role && PROF.get(c.role).group !== c.roleGroup).map(c => `${c.role}:${c.roleGroup}`).join());

console.log("\n# the trap: roleCat is not roleId's prefix");
ok("the catalogue really does disagree, so the rule is load-bearing",
   ["eng.civil_eng", "tech.product_manager", "energy.process_operator"].some(id => PROF.has(id) && PROF.get(id).group !== id.split(".")[0]),
   "if this fails the premise changed");

console.log("\n# eligibility is machine-checkable only");
ok("a clip outside 40-75s is not eligible", !IntroPick.eligible({ id: "aaaaaaaaaaa", dur: 200 }));
ok("a non-embeddable clip is not eligible", !IntroPick.eligible({ id: "aaaaaaaaaaa", dur: 55, embeddable: false }));
ok("a seed-label id is not eligible", !IntroPick.eligible({ id: "ipg-001", dur: 55 }));
ok("every ranked clip is marked editorial:pending", IntroPick.choose({}, clips).ranked.every(r => r.editorial === "pending"));

const show = (t, r) => console.log(`     -> ${r.ranked[r.picked].id}  ${r.ranked[r.picked].start}-${r.ranked[r.picked].end}s  tier ${r.ranked[r.picked].tier} (${r.ranked[r.picked].why.match}${r.ranked[r.picked].why.value ? ":" + r.ranked[r.picked].why.value : ""})  role ${r.ranked[r.picked].role}`);

console.log("\n# 1. EXACT ROLE MATCH — a real estate agent");
const exact = IntroPick.choose({ roleId: "retail.real_estate", roleCat: "retail", situations: ["clients"], goalId: "customer_clients" }, clips);
ok("tier 1", exact.ranked[exact.picked].tier === 1, JSON.stringify(exact.ranked[exact.picked]));
ok("the chosen clip is a real estate introduction", exact.ranked[exact.picked].role === "retail.real_estate", String(exact.ranked[exact.picked].role));
show("exact", exact);

console.log("\n# 2. RELATED ROLE, SAME INDUSTRY — a nurse (no nurse clip at tier 1 unless tagged)");
const rel = IntroPick.choose({ roleId: "health.dentist", roleCat: "health", situations: ["clients"], goalId: "" }, clips);
ok("tier 2, not 1 (no dentist clip exists)", rel.ranked[rel.picked].tier === 2, `tier ${rel.ranked[rel.picked].tier}`);
ok("the chosen clip is in the health group", rel.ranked[rel.picked].roleGroup === "health", String(rel.ranked[rel.picked].roleGroup));
show("related", rel);

console.log("\n# 3. NO PROFILE AT ALL — the degraded case (onboarding V2 off)");
const none = IntroPick.choose({}, clips);
ok("flagged degraded", none.degraded === true);
ok("lands on tier 4, the general introduction", none.ranked[none.picked].tier === 4, `tier ${none.ranked[none.picked].tier}`);
show("none", none);

console.log("\n# a goal-only profile reaches tier 3, not 4");
const goalOnly = IntroPick.choose({ roleId: "", roleCat: "", situations: ["interviews"], goalId: "ace_interviews" }, clips);
ok("tier 3 via the situation", goalOnly.ranked[goalOnly.picked].tier === 3, `tier ${goalOnly.ranked[goalOnly.picked].tier}`);
ok("why names the matched field", goalOnly.ranked[goalOnly.picked].why.field === "situations" && goalOnly.ranked[goalOnly.picked].why.value === "interviews", JSON.stringify(goalOnly.ranked[goalOnly.picked].why));

console.log("\n# the contract the step depends on");
ok("a ranked list is returned, not one clip", Array.isArray(exact.ranked) && exact.ranked.length > 1);
ok("picked is an index into it", exact.ranked[exact.picked] !== undefined);
ok("every entry carries start and end", exact.ranked.every(r => r.start === 0 && typeof r.end === "number" && r.end > 0));
ok("why is structured, never prose", exact.ranked.every(r => r.why && typeof r.why.tier === "number" && typeof r.why.match === "string"));
ok("the same input gives the same order", JSON.stringify(IntroPick.choose({ roleId: "retail.real_estate", roleCat: "retail", situations: ["clients"], goalId: "customer_clients" }, clips)) === JSON.stringify(exact));
ok("no clip needing an unapproved excerpt is offered", exact.ranked.every(r => r.end <= IntroPick.MAX_S && r.end >= IntroPick.MIN_S));
ok("an empty pool degrades instead of throwing", (() => { const r = IntroPick.choose({}, []); return r.picked === -1 && r.ranked.length === 0; })());

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
