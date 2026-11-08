/* Evaluation after each step: who gets a verdict, what the numbers say, and what the day's
   before/after is allowed to claim. Pure engine — no browser. Run: node tests/lesson-evaluation.test.mjs */
import { readFileSync } from "node:fs";
const win = {};
new Function("window", readFileSync(new URL("../shadow-sync.js", import.meta.url), "utf8"))(win);
new Function("window", readFileSync(new URL("../daily-learning-plan.js", import.meta.url), "utf8"))(win);
const D = win.DailyPlan, SS = win.ShadowSync;
/* the app's own rule, not the raw matcher: ShadowSync alone cannot see "I'm" as "I am" */
const has = D.makeSays(SS.findExpression);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 220)}`); };

console.log("\n# who may spend a verdict");
{
  const anon = D.evaluationPlan({}), free = D.evaluationPlan({ account: true }), prem = D.evaluationPlan({ account: true, premium: true });
  ok("1 · no account: measured, but never a verdict (an AI route needs an account)", anon.verdicts === 0 && anon.try === "device" && anon.converse === "device", JSON.stringify(anon));
  /* Owner, 7 Nov 2026: the free allowance buys ONE complete day — the baseline, the conversation
     take and the CLOSING report. The closing report used to be Premium; a free learner could not
     finish the day they had started. What Premium buys is doing it again, not finishing it. */
  ok("2 · free with an account: baseline, conversation AND the closing report", free.verdicts === 3 && free.try === "ai" && free.converse === "ai" && free.overall === true && free.rehearse === "device", JSON.stringify(free));
  ok("3 · a free day fits the 3-a-day allowance exactly, with nothing spare", free.verdicts === 3);
  ok("4 · premium: the baseline, the conversation, the closing verdict and a coach on each shadow", prem.overall === true && prem.verdicts === 5, JSON.stringify(prem));
  /* Steps 2 and 4 are the same exercise: the AI WRITES the sentences (content) and the device
     grades them. Neither step may buy a verdict, or the free day stops fitting the free cap. */
  ok("4c · the practice-sentence steps cost nothing on any plan", free.rehearse === "device" && prem.rehearse === "device");
  /* The shadowing coach speaks on every plan — what changes is whether a model wrote the script.
     Free must not spend a verdict there, or the day it is sized for no longer fits. */
  ok("4b · the shadowing coach is drawn on every plan, and costs a free learner nothing", free.shadowCoach === "device" && prem.shadowCoach === "ai" && free.verdicts === 3);
  ok("5 · premium without an account is still treated as free-without-account", D.evaluationPlan({ premium: true }).verdicts === 0);
  ok("6 · shadowing is never a metered verdict (the Challenge grades on the device)", anon.shadow === "device" && prem.shadow === "device");
  ok("7 · the finish comparison costs nothing on any plan", [anon, free, prem].every(p => p.finish === "compare"));
}

console.log("\n# the lesson can be walked back through");
{
  /* Owner, 7 Nov 2026: from step 3 you can look at step 2 and step 1 again. The mark of how far
     the learner GOT must not move when they do, or a look back would hand them a later step. */
  const S = { dlp: { a: { lessonId: "a", step: "try", stepData: {} } } };
  D.setStep(S, "a", "try", { recorded: true });
  D.setStep(S, "a", "learn", { done: true });
  const e = S.dlp.a;
  ok("19 \u00b7 two steps forward: the open step and the mark agree", e.step === "listen" && D.reached(e) === 2);
  D.goStep(S, "a", "try");
  ok("20 \u00b7 walking back moves the view, never the mark", e.step === "try" && D.reached(e) === 2);
  D.goStep(S, "a", "converse");
  ok("21 \u00b7 a step never reached is refused, so nothing is skipped", e.step === "try");
  D.setStep(S, "a", "try", { recorded: true });
  ok("22 \u00b7 Continue from a revisited step advances one and credits nothing new", e.step === "learn" && D.reached(e) === 2);
  ok("23 \u00b7 an entry written before any of this reads its open step as the mark", D.reached({ step: "rehearse" }) === 3);
  D.complete(S, "a");
  ok("24 \u00b7 a completed lesson is reachable end to end", e.step === "finish" && D.reached(e) === 6);
}

console.log("\n# what a recording shows without spending anything");
{
  const targets = ["I currently work as", "My focus is on", "I am responsible for"];
  const m = D.measure("I currently work as a data engineer. My focus is on pipelines.", targets, 20, has);
  ok("8 · counts which of the day's expressions were really said", m.used === 2 && m.coverage === 67, JSON.stringify(m.usedList));
  ok("9 · pace is words per minute from the real duration", m.wpm === Math.round(m.words / (20 / 60)), m.wpm);
  const f = D.measure("um so like you know I um work there", targets, 12, has);
  ok("10 · hesitation is counted, not guessed", f.fillers >= 4 && f.coverage === 0, JSON.stringify({ f: f.fillers, c: f.coverage }));
  ok("11 · a silent or failed recording measures as nothing, never as zero skill", D.measure("", targets, 0, has).wpm === null);
  ok("12 · contractions and spelling fold like the Challenge (I am ≡ I'm)", D.measure("I'm responsible for the pipeline", targets, 10, has).used === 1);
}

console.log("\n# the day's before/after may only claim what both sides support");
{
  const targets = ["I currently work as", "My focus is on"];
  const before = D.measure("um I uh work there you know", targets, 20, has);
  const after = D.measure("I currently work as a data engineer. My focus is on reliability.", targets, 22, has);
  const c = D.compareAttempts(before, after);
  ok("13 · a real gain in the day's language is reported", c.comparable && c.changes.some(x => x.k === "coverage" && x.dir === "up"), JSON.stringify(c.changes));
  ok("14 · less hesitation is reported as less hesitation", c.changes.some(x => x.k === "fillers" && x.dir === "down"));
  ok("15 · with only one attempt there is nothing to compare, and it says so", D.compareAttempts(before, null).comparable === false);
  const same = D.compareAttempts(before, before);
  ok("16 · no movement is reported as steady, never as improvement", same.comparable && same.steady === true && same.changes.length === 0);
  /* the honesty rule: small wobble is noise, not progress */
  const tiny = D.compareAttempts(D.measure("I currently work as a data engineer here", targets, 20, has),
                                 D.measure("I currently work as a data engineer now", targets, 20.5, has));
  ok("17 · a tiny difference is not dressed up as a change", tiny.steady === true, JSON.stringify(tiny.changes));
  const slower = D.compareAttempts(D.measure("one two three four five six seven eight nine ten", [], 10, has),
                                   D.measure("one two three", [], 10, has));
  ok("18 · going backwards is reported too, not hidden", slower.changes.some(x => x.dir === "down"), JSON.stringify(slower.changes));
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
