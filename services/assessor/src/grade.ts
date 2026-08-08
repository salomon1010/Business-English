/* ============================================================================
   Deterministic grading, and the rule that decides who wins.

   The model is good at meaning and bad at consistency. Keyword cues are the
   reverse. So both run, and they are combined under one fixed rule:

       a core safety benchmark may be ADDED by the model, never REMOVED.

   If the cues found it, it is met. If the model found it and the cues did not,
   it is met. If neither found it, it is missing — and the model cannot argue.
   That makes the safety floor auditable: a report can always be re-derived from
   the transcript, and no prompt change can quietly start passing people who did
   not mention gas testing.
   ============================================================================ */
import type { AssessmentModule, LlmVerdict } from "./schema";
import { ASSESSMENT_BASIS } from "./schema";
import { codesFor, emphasisFor, JURISDICTIONS, DEFAULT_JURISDICTION } from "./jurisdictions";
import type { JurisdictionId } from "./jurisdictions";

export interface BenchmarkResult {
  id: string;
  must: string;
  critical: boolean;
  met: boolean;
  by: "cue" | "model" | null;
}

const WORD = /[a-z0-9']+/g;
const norm = (s: string) => String(s || "").toLowerCase().replace(/[’]/g, "'");
export const wordCount = (s: string) => (norm(s).match(WORD) || []).length;

/** Word-boundary match with a light stem. A trailing silent "e" is dropped
 *  before most endings, so "isolate" has to reach "isolated" and "isolation". */
export function hits(text: string, cue: string): boolean {
  const c = norm(cue).trim();
  if (!c) return false;
  if (/\s/.test(c)) return norm(text).includes(c);
  const esc = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stem = c.length > 3 && /e$/.test(c) ? esc.slice(0, -1) : esc;
  return new RegExp(`\\b${stem}[a-z']{0,5}\\b`).test(norm(text));
}

export interface Grade {
  verdict: "PASS" | "FAIR" | "FAIL";
  score: number;
  compliance: boolean;
  results: BenchmarkResult[];
  missedCritical: BenchmarkResult[];
  vocabUsed: string[];
  vocabMissed: string[];
  answered: boolean;
}

export function grade(mod: AssessmentModule, transcript: string, llm?: LlmVerdict | null): Grade {
  const answered = wordCount(transcript) >= 2;
  const fromModel = new Set(llm?.benchmarks_met ?? []);

  const results: BenchmarkResult[] = mod.benchmarks.map((b) => {
    const byCue = answered && b.cues.some((c) => hits(transcript, c));
    const byModel = answered && fromModel.has(b.id);
    return { id: b.id, must: b.must, critical: b.critical, met: byCue || byModel, by: byCue ? "cue" : byModel ? "model" : null };
  });

  const vocabUsed = answered ? mod.vocab.filter((v) => hits(transcript, v)) : [];
  const vocabMissed = mod.vocab.filter((v) => !vocabUsed.includes(v));

  /* Core safety benchmarks weigh double: they are the spine of the module, not
     one item among equals. */
  const w = (b: { critical: boolean }) => (b.critical ? 2 : 1);
  const total = mod.benchmarks.reduce((n, b) => n + w(b), 0);
  const earned = results.filter((r) => r.met).reduce((n, r) => n + w(r), 0);
  const bScore = total ? earned / total : 0;
  const vScore = mod.vocab.length ? vocabUsed.length / mod.vocab.length : 0;
  const score = answered ? Math.round((bScore * 0.8 + vScore * 0.2) * 100) : 0;

  const missedCritical = results.filter((r) => r.critical && !r.met);
  const verdict: Grade["verdict"] =
    !answered || missedCritical.length ? "FAIL" : score >= 80 ? "PASS" : score >= 50 ? "FAIR" : "FAIL";

  return { verdict, score, compliance: verdict === "PASS", results, missedCritical, vocabUsed, vocabMissed, answered };
}

const codeList = (mod: AssessmentModule, j: JurisdictionId) => codesFor(j, mod.id, mod.codes).join("; ");

/** Wording used when the model is unavailable, so an outage still produces a
 *  complete, honest report rather than a 500. */
export function deterministicNarrative(
  mod: AssessmentModule,
  g: Grade,
  jurisdiction: JurisdictionId = DEFAULT_JURISDICTION
) {
  const codes = codeList(mod, jurisdiction);
  const j = JURISDICTIONS.get(jurisdiction)!;
  const emphasis = emphasisFor(jurisdiction, mod.id);
  const correct = g.results.filter((r) => r.met).map((r) => r.must + (r.critical ? " (core safety benchmark)" : ""));
  if (g.vocabUsed.length) correct.push(`Used correct terminology: ${g.vocabUsed.join(", ")}.`);

  const missing = g.results.filter((r) => !r.met).map((r) => `${r.critical ? "CRITICAL — " : ""}Did not address: ${r.must}.`);
  if (g.vocabMissed.length) missing.push(`Did not use expected terminology: ${g.vocabMissed.join(", ")}.`);
  if (!g.answered) missing.push("No usable spoken answer was recorded for this module.");

  let feedback: string;
  if (!g.answered) {
    feedback = `You did not give an answer that could be assessed. This module is measured against ${codes}. Record a full spoken answer and it will be assessed properly.`;
  } else if (g.verdict === "PASS") {
    feedback = `Pass — ${g.score}%. You covered every core benchmark for this module under ${codes}.` +
      (g.vocabMissed.length ? ` To sharpen it further, work these terms into your answer: ${g.vocabMissed.join(", ")}.` : " Your terminology was accurate throughout.");
  } else if (g.missedCritical.length) {
    feedback = `Fail — ${g.score}%. You missed a core safety requirement under ${codes}: ` +
      `${g.missedCritical.map((r) => r.must.toLowerCase()).join("; ")}. On a real site this is the part that stops the job or gets someone hurt, so it has to be said out loud every time.` +
      (g.vocabMissed.length ? ` Terminology to learn: ${g.vocabMissed.join(", ")}.` : "");
  } else {
    feedback = `Fair — ${g.score}%. You understood the task, but you left out detail an assessor listens for under ${codes}: ` +
      `${g.results.filter((r) => !r.met).map((r) => r.must.toLowerCase()).join("; ")}.` +
      (g.vocabMissed.length ? ` Terminology to learn: ${g.vocabMissed.join(", ")}.` : "");
  }
  /* Appended after the branch, so every verdict carries the jurisdiction note. */
  if (emphasis) feedback += ` For ${j.label}: ${emphasis}`;

  const notes =
    `Assessed against ${codes}. Requirement: ${mod.requirement} ` +
    `Benchmarks covered ${g.results.filter((r) => r.met).length}/${mod.benchmarks.length}` +
    (g.missedCritical.length ? `; CRITICAL gaps: ${g.missedCritical.map((r) => r.id).join(", ")}` : "; no critical gaps") +
    `. Framework applied: ${j.framework}. ${j.verify} ` +
    `This records what the candidate SAID. Verify qualification, certification and eligibility independently.`;

  return { correct, missing, feedback, notes };
}

export { ASSESSMENT_BASIS };
