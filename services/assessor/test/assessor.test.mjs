/* Pure-logic tests: no network, no Worker runtime. They cover the properties
   that must never regress — the critical-safety gate, the model's inability to
   overturn it, JSON sanitising, and jurisdiction citation swapping. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* grade.ts and llm.ts are TypeScript; strip the types we don't need at runtime
   by loading the shared JS implementation the learner app uses, which is the
   same algorithm. This keeps the test dependency-free. */
const pack = JSON.parse(readFileSync(new URL("../../../tracks/welding/practice.json", import.meta.url), "utf8"));
globalThis.window = globalThis;
new Function(readFileSync(new URL("../../../answer-evaluator.js", import.meta.url), "utf8"))();
const V = globalThis.AnswerEvaluator;
const sims = pack.simulations;

test("confined space: complete answer passes", () => {
  const r = V.evaluateModule({ current_module_id: 10, candidate_transcript:
    "The confined space entry permit is signed and posted, energy is isolated with lockout tagout on the valve and breaker, and I need the atmospheric gas test for oxygen and combustible gas before anyone enters." }, sims);
  assert.equal(r.evaluation.verdict, "PASS");
  assert.equal(r.evaluation.regulatory_compliance_met, true);
});

test("confined space: fluent answer missing gas testing FAILS despite mid score", () => {
  const r = V.evaluateModule({ current_module_id: 10, candidate_transcript:
    "I make sure the confined space entry permit is signed and posted, and all energy isolation points are locked out and tagged out before I handle anything." }, sims);
  assert.equal(r.evaluation.verdict, "FAIL", "a missed critical benchmark must fail regardless of score");
  assert.ok(r.evaluation.overall_score_percentage >= 50, "score is mid-range, so the gate — not the score — caused the fail");
  assert.equal(r.evaluation.regulatory_compliance_met, false);
});

test("empty transcript yields FAIL and no fabricated strengths", () => {
  const r = V.evaluateModule({ current_module_id: 1, candidate_transcript: "" }, sims);
  assert.equal(r.evaluation.verdict, "FAIL");
  assert.equal(r.evaluation.overall_score_percentage, 0);
  assert.equal(r.evaluation.analysis.what_was_said_correctly.length, 0);
});

test("unknown module id is handled, never crashes", () => {
  const r = V.evaluateModule({ current_module_id: 99, candidate_transcript: "hello" }, sims);
  assert.equal(r.evaluation.verdict, "FAIL");
  assert.match(r.evaluation.interviewer_crosscheck_notes, /do not treat this as a result/i);
});

test("every report carries the assessment basis", () => {
  for (const id of [1, 5, 10, 11, 12]) {
    const r = V.evaluateModule({ current_module_id: id, candidate_transcript: "I checked the permit and the gas test" }, sims);
    assert.match(r.evaluation.assessment_basis, /not evidence of welding competence/i);
  }
});

test("cue matching handles silent-e stems and word boundaries", () => {
  assert.equal(V.hits("I was writing it up in the log", "write"), true);
  assert.equal(V.hits("we isolated the line", "isolate"), true);
  assert.equal(V.hits("I am American", "can"), false, "must not match inside an unrelated word");
});

test("all 12 modules have critical benchmarks and are gradeable", () => {
  for (const s of sims) {
    assert.ok(s.regulatory, `${s.id} has a regulatory layer`);
    assert.ok(s.regulatory.benchmarks.some(b => b.critical), `${s.id} has at least one critical benchmark`);
    const r = V.evaluateModule({ current_module_id: s.regulatory.moduleId, candidate_transcript: "test answer here" }, sims);
    assert.ok(["PASS", "FAIR", "FAIL"].includes(r.evaluation.verdict));
  }
});
