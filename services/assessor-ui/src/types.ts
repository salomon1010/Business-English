/* Mirrors services/assessor/src/schema.ts (EvaluationReportSchema).
   If the API contract changes, change it there first and re-derive this. */
export type Verdict = "PASS" | "FAIR" | "FAIL";

export interface EvaluationReport {
  evaluation: {
    module_id: number;
    verdict: Verdict;
    overall_score_percentage: number;
    /** The candidate's ANSWER met the module benchmarks. Not a compliance finding
     *  about the person — see assessment_basis. */
    regulatory_compliance_met: boolean;
    analysis: {
      what_was_said_correctly: string[];
      what_is_missing_or_incorrect: string[];
    };
    feedback_to_candidate: string;
    interviewer_crosscheck_notes: string;
    assessment_basis: string;
    graded_by: "deterministic" | "hybrid";
    jurisdiction: string;
    jurisdiction_framework: string;
    candidate_id: string;
    session_id: string;
    assessed_at: string;
  };
}
