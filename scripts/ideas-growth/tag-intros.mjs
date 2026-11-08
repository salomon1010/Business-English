/* Tag each Introductions clip with a profession id from the REAL onboarding catalogue.
   Deterministic: an ordered keyword table, first match wins, applied to title + channel.
   The tag is DERIVED FROM TITLE TEXT and is marked as such — it is a starting point for
   the owner's editorial pass, never an assertion that the clip is what the title says. */
import { readFileSync, writeFileSync } from "node:fs";
const cat = readFileSync("onboarding-catalog.js","utf8");
const PROF = [...cat.matchAll(/\["((?:[a-z0-9_]+)\.(?:[a-z0-9_]+))","([^"]*)","([a-z]+)","([^"]*)"\]/g)]
  .map(m => ({ id:m[1], label:m[2], group:m[3] }));
const byId = new Map(PROF.map(p => [p.id, p]));
/* ordered: the most specific phrase first, so "nurse practitioner" never loses to "nurse" */
const RULES = [
  [/nurse practitioner|\bdnp\b|\bcrnp\b|\bfnp\b/i, "health.nurse"],
  [/physician assistant|\bp\.?a\.?\b(?!\w)/i,      "health.healthcare_assistant"],
  [/family (medicine|physician)|primary care|\bmd\b|\bdo\b(?!\w)|physician|doctor|\bdr\.?\s/i, "health.doctor"],
  [/attorney|lawyer|law firm|legal/i,              "fin.lawyer"],
  [/real estate|realtor|keller williams|property/i,"retail.real_estate"],
  [/foreman|site manager|superintendent/i,         "eng.site_manager"],
  [/manufacturing engineer/i,                      "eng.manufacturing_engineer"],
  [/chief engineer|plant engineer/i,               "energy.plant_engineer"],
  [/network engineer|networking/i,                 "tech.network_engineer"],
  [/construction|\bvp of construction\b/i,         "trades.construction_worker"],
  [/engineer|engineering/i,                        "eng.project_engineer"],
  [/city of |municipal|public service/i,           "public.government_officer"],
  [/employee spotlight|team member|meet the team/i,"other.other"],
];
const rows = JSON.parse(readFileSync(process.argv[2],"utf8"));
const out = {};
for (const v of rows) {
  const hay = `${v.title} ${v.ch}`;
  const hit = RULES.find(([re]) => re.test(hay));
  const id = hit ? hit[1] : "other.other";
  const p = byId.get(id);
  if (!p) { console.error(`FATAL: ${id} is not a real profession id`); process.exit(1); }
  out[v.id] = { role:id, roleGroup:p.group, roleLabel:p.label,
                roleBasis: hit ? "derived from the video title" : "no role phrase in the title",
                roleConfirmed:false, dur:v.dur, caps:v.caps, title:v.title, ch:v.ch };
}
writeFileSync(process.argv[3], JSON.stringify(out,null,1));
const tally={}; for(const r of Object.values(out)) tally[r.roleLabel]=(tally[r.roleLabel]||0)+1;
for (const [k,n] of Object.entries(tally).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(2)}  ${k}`);
const groups={}; for(const r of Object.values(out)) groups[r.roleGroup]=(groups[r.roleGroup]||0)+1;
console.log("\nindustry groups covered:", Object.entries(groups).map(([g,n])=>`${g}:${n}`).join("  "));
