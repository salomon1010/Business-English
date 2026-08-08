/* ============================================================================
   Contracts. Every boundary of this service is validated here — the incoming
   request, the model's reply, and the report that leaves. Nothing reaches the
   database pipeline without passing through one of these schemas.
   ============================================================================ */
import { z } from "zod";
import { JURISDICTION_IDS, DEFAULT_JURISDICTION } from "./jurisdictions";

/* ---- module dictionary (see modules.ts, generated from the track pack) ---- */

export const CodeSchema = z.object({
  code: z.string(),
  title: z.string(),
  /** Editions move. AWS D1.1 renumbered its clauses in 2020, so a clause
   *  reference carries the caveat with it rather than in someone's memory. */
  note: z.string().default(""),
});

export const BenchmarkSchema = z.object({
  id: z.string(),
  must: z.string(),
  cues: z.array(z.string()),
  /** Core safety benchmarks. Missing one is a fail regardless of score, and the
   *  model is not permitted to overturn that — see grade.ts. */
  critical: z.boolean(),
});

export const AssessmentModuleSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  scenario: z.string(),
  codes: z.array(CodeSchema),
  requirement: z.string(),
  benchmarks: z.array(BenchmarkSchema),
  vocab: z.array(z.string()),
});
export type AssessmentModule = z.infer<typeof AssessmentModuleSchema>;

/* ---- inbound request ---- */

export const EvaluateRequestSchema = z.object({
  candidate_id: z.string().min(1).max(128),
  session_id: z.string().min(1).max(128),
  module_id: z.number().int().min(1).max(12),
  candidate_transcript: z.string().trim().min(1).max(20000),
  /** Where the candidate is applying. The benchmarks do not change; the codes
   *  they are cited against do. Defaults to the ISO/IIW baseline. */
  target_jurisdiction: z.enum(JURISDICTION_IDS).default(DEFAULT_JURISDICTION),
});
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

/* ---- what we allow the model to return ----
   Deliberately narrower than the final report. The model supplies judgement on
   benchmark coverage and the wording of feedback. It does NOT supply the score,
   the verdict, or the compliance flag: those are computed from its benchmark
   findings under fixed rules, so an articulate model cannot inflate a result. */

export const LlmVerdictSchema = z.object({
  benchmarks_met: z.array(z.string()).max(32),
  what_was_said_correctly: z.array(z.string().max(400)).max(20),
  what_is_missing_or_incorrect: z.array(z.string().max(400)).max(20),
  feedback_to_candidate: z.string().max(2000),
  interviewer_crosscheck_notes: z.string().max(2000),
});
export type LlmVerdict = z.infer<typeof LlmVerdictSchema>;

/* ---- outbound report: the exact shape the pipeline consumes ---- */

export const EvaluationReportSchema = z.object({
  evaluation: z.object({
    module_id: z.number().int(),
    verdict: z.enum(["PASS", "FAIR", "FAIL"]),
    overall_score_percentage: z.number().int().min(0).max(100),
    regulatory_compliance_met: z.boolean(),
    analysis: z.object({
      what_was_said_correctly: z.array(z.string()),
      what_is_missing_or_incorrect: z.array(z.string()),
    }),
    feedback_to_candidate: z.string(),
    interviewer_crosscheck_notes: z.string(),

    /* Additive fields. They do not disturb the agreed shape, and they carry the
       things a downstream consumer must not have to guess. */
    assessment_basis: z.string(),
    graded_by: z.enum(["deterministic", "hybrid"]),
    jurisdiction: z.string(),
    jurisdiction_framework: z.string(),
    candidate_id: z.string(),
    session_id: z.string(),
    assessed_at: z.string(),
  }),
});
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;

/** The sentence that must survive every hop to the database and the UI. */
export const ASSESSMENT_BASIS =
  "Communication assessment only. This score reflects whether the candidate stated the required points in English during a practice simulation. " +
  "It is not evidence of welding competence, certification, or legal eligibility to work. Verify qualifications through test certificates, the awarding body and the employer.";
