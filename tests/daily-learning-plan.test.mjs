/* DailyLearningPlan — pure unit tests. Run: node daily-learning-plan.test.mjs */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const DailyPlan = require("../daily-learning-plan.js");

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };

const PACK = {
  weeks: [{ n: 1, phase: 1, days: { Mon: { focus: "Pronunciation baseline", task: "Shadow a 45-60 sec clip...", out: "Transcript · 1 recording · 3 pronunciation weaknesses noted" } } }],
  missions: { competencies: [{ id: "explain-work", week: 1, objective: "Explain your role and your current work", pattern: "ROLE → RESPONSIBILITY → RIGHT NOW → WHO IT'S FOR → WHY IT MATTERS" }] }
};
const PHRASES = [{ w: 1, p: "I currently work as…" }, { w: 1, p: "My focus is on…" }, { w: 1, p: "I work closely with…" }];

console.log("\n# proficiencyRange — selfLevel ALONE never produces a verified narrow range");
ok("1 · no profile at all → wide, low confidence, basis 'none'", JSON.stringify(DailyPlan.proficiencyRange({}).range) === '["A1","C2"]' && DailyPlan.proficiencyRange({}).confidence === "low" && DailyPlan.proficiencyRange({}).basis === "none");
ok("2 · selfLevel declared, NO baseline evidence → still wide, low confidence — selfLevel alone changes nothing", JSON.stringify(DailyPlan.proficiencyRange({ selfLevel: "Fluent, want to sound sharper" }).range) === '["A1","C2"]' && DailyPlan.proficiencyRange({ selfLevel: "Fluent, want to sound sharper" }).confidence === "low");
ok("3 · selfLevel + a real high baseline attempt → narrows toward the self-declared band, medium confidence", JSON.stringify(DailyPlan.proficiencyRange({ selfLevel: "Fluent, want to sound sharper", baseline: 85 }).range) === '["B2","C1"]' && DailyPlan.proficiencyRange({ selfLevel: "Fluent, want to sound sharper", baseline: 85 }).confidence === "medium");
ok("4 · a low baseline score does NOT narrow, even with selfLevel declared — one weak attempt isn't evidence of anything", JSON.stringify(DailyPlan.proficiencyRange({ selfLevel: "Fluent, want to sound sharper", baseline: 30 }).range) === '["A1","C2"]');

console.log("\n# canonicalCore / build — the non-personalizable core comes ONLY from the curriculum pack");
{
  const core = DailyPlan.canonicalCore(PACK, 1, "Mon");
  ok("5 · competencyObjective is the real Week-1-Monday focus, verbatim", core.competencyObjective === "Pronunciation baseline");
  ok("6 · the week-1 mission pattern is carried as context, not as the objective itself", core._missionPattern.includes("ROLE"));
  ok("7 · a day with no curriculum entry returns null, not a fabricated plan", DailyPlan.canonicalCore(PACK, 2, "Mon") === null);
}
{
  const plan = DailyPlan.build({ trackId: "general", w: 1, d: "Mon", pack: PACK, profile: { selfLevel: "Can get by" }, phrases: PHRASES, video: { id: "abc", title: "A professional introduces herself" } });
  ok("8 · build() returns a plan with every required contract field", DailyPlan.validate(plan).valid, JSON.stringify(DailyPlan.validate(plan)));
  ok("9 · staticFallback carries its own competencyObjective — never AI-only, works with zero network", plan.staticFallback.competencyObjective === "Pronunciation baseline" && plan.staticFallback.expressions.length === 3);
  ok("10 · targetExpressions come from the real week-1 phrase bank, not invented text", plan.targetExpressions.join("|") === "I currently work as…|My focus is on…|I work closely with…");
  ok("11 · learnerContext carries selfLevel as its own labelled field, proficiency as a SEPARATE, honestly-wide estimate", plan.learnerContext.selfLevel === "Can get by" && plan.learnerContext.proficiency.confidence === "low");
}

console.log("\n# validate() / validateAgainstCurriculum() — AI personalization cannot move the objective or criteria");
{
  const plan = DailyPlan.build({ trackId: "general", w: 1, d: "Mon", pack: PACK, profile: {}, phrases: PHRASES });
  ok("12 · an unmodified plan validates clean against the curriculum", DailyPlan.validateAgainstCurriculum(plan, PACK).valid);
  const drifted = { ...plan, competencyObjective: "Something an AI call invented" };
  ok("13 · a drifted competencyObjective is caught", !DailyPlan.validateAgainstCurriculum(drifted, PACK).valid);
  const drifted2 = { ...plan, assessmentCriteria: ["anythingGoes"] };
  ok("14 · drifted assessmentCriteria is caught too", !DailyPlan.validateAgainstCurriculum(drifted2, PACK).valid);
  ok("15 · an invalid plan shape fails validate() with readable errors", !DailyPlan.validate({}).valid && DailyPlan.validate({}).errors.length > 0);
}

console.log("\n# persistence — resumable across days, multiple lessons per day, immune to a mid-lesson profile edit");
{
  const S = { dlp: {} };
  const opts = { trackId: "general", w: 1, day: "Mon", pack: PACK, profile: { selfLevel: "Can get by" }, phrases: PHRASES };
  const e1 = DailyPlan.start(S, opts);
  ok("16 · start() creates an entry keyed by lessonId, not by today's date", e1.lessonId === "general:w1Mon" && e1.step === "try");
  DailyPlan.setStep(S, e1.lessonId, "try", { recorded: true });
  ok("17 · setStep advances to the next step and stores step data", DailyPlan.load(S, e1.lessonId).step === "learn" && DailyPlan.load(S, e1.lessonId).stepData.try.recorded === true);
  /* simulate the learner changing their profile mid-lesson, then opening the lesson again "tomorrow" */
  const e2 = DailyPlan.start(S, { ...opts, profile: { selfLevel: "Fluent, want to sound sharper", baseline: 90 } });
  ok("18 · re-entering an IN-PROGRESS lesson after a profile change returns the SAME entry, same snapshot — the plan was not silently rewritten", e2 === DailyPlan.load(S, e1.lessonId) && e2.profileSnapshot.selfLevel === "Can get by" && e2.step === "learn");

  const other = DailyPlan.start(S, { trackId: "general", w: 1, day: "Tue", pack: { weeks: [{ n: 1, days: { Tue: { focus: "Different day", task: "x", out: "y" } } }] }, profile: {}, phrases: [] });
  ok("19 · a second lesson the same calendar day gets its own entry and does not touch the first", other.lessonId !== e1.lessonId && DailyPlan.load(S, e1.lessonId).step === "learn");

  DailyPlan.complete(S, e1.lessonId);
  ok("20 · complete() stamps completedAt and sets step to finish", !!DailyPlan.load(S, e1.lessonId).completedAt && DailyPlan.load(S, e1.lessonId).step === "finish");
  const e3 = DailyPlan.start(S, opts);
  ok("21 · starting again after completion builds a FRESH entry (a real retry), attempt number increments", e3.attempt === 2 && e3.step === "try" && !e3.completedAt);
}

console.log("\n# evidenceStatus — four states, strictly from real evidence counts");
ok("22 · zero attempts → not_assessed", DailyPlan.evidenceStatus(0) === "not_assessed");
ok("23 · one attempt → initial", DailyPlan.evidenceStatus(1) === "initial");
ok("24 · two attempts → developing", DailyPlan.evidenceStatus(2) === "developing");
ok("25 · three or more → established", DailyPlan.evidenceStatus(3) === "established" && DailyPlan.evidenceStatus(9) === "established");

const fails = res.filter(x => !x).length;
console.log(`\n${res.length - fails}/${res.length} passed`);
process.exit(fails ? 1 : 0);
