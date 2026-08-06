/* ============================================================================
   Hiring-side panel.

   Different reader, different job. A recruiter is cross-checking claims during a
   live conversation, so this is dense, scannable, and copy-paste friendly.

   The compliance flag is rendered as a stark true/false anchor BUT is labelled
   precisely — "answer met the benchmarks", not "candidate is compliant". A
   recruiter who misreads that flag could reject a qualified welder or advance an
   unqualified one, so the wording is load-bearing and the basis line is not
   collapsible.
   ============================================================================ */
import React from "react";
import type { EvaluationReport } from "../types";

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className={`truncate text-sm text-slate-200 ${mono ? "font-mono" : ""}`} title={value}>{value}</dd>
    </div>
  );
}

export default function InterviewerPanel({ report }: { report: EvaluationReport }) {
  const e = report.evaluation;
  const met = e.regulatory_compliance_met;
  const verdictTone =
    e.verdict === "PASS" ? "text-emerald-300 bg-emerald-500/10 ring-emerald-500/40"
    : e.verdict === "FAIR" ? "text-amber-300 bg-amber-500/10 ring-amber-500/40"
    : "text-rose-300 bg-rose-500/10 ring-rose-500/40";

  return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-950/80 text-slate-200 shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Assessor cross-check</h2>
          <p className="text-xs text-slate-500">Module {e.module_id} · {e.jurisdiction_framework}</p>
        </div>
        <span className={`rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${verdictTone}`}>
          {e.verdict} · {e.overall_score_percentage}%
        </span>
      </header>

      {/* Compliance anchor — precise label, unmissable state. */}
      <div className={`flex items-start gap-3 border-b border-slate-800 px-5 py-4 ${met ? "bg-emerald-950/30" : "bg-rose-950/30"}`}>
        <span
          aria-hidden="true"
          className={`grid h-9 w-14 shrink-0 place-items-center rounded font-mono text-sm font-bold ring-1 ${
            met ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/50" : "bg-rose-500/20 text-rose-300 ring-rose-500/50"
          }`}
        >
          {met ? "TRUE" : "FALSE"}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            Answer met the regulatory benchmarks for this module:{" "}
            <span className={met ? "text-emerald-300" : "text-rose-300"}>{met ? "yes" : "no"}</span>
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            This describes what the candidate <strong>said</strong> in a practice simulation. It is not a finding that
            the person is certified, qualified or legally eligible to work.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-b border-slate-800 px-5 py-4 sm:grid-cols-4">
        <Field label="Candidate" value={e.candidate_id} mono />
        <Field label="Session" value={e.session_id} mono />
        <Field label="Graded by" value={e.graded_by} />
        <Field label="Assessed" value={new Date(e.assessed_at).toLocaleString()} />
      </dl>

      <div className="px-5 py-4">
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Cross-check notes — verify these against the candidate's claims
        </h3>
        <div className="rounded-lg border-l-4 border-amber-500/70 bg-amber-500/5 p-4">
          <p className="text-sm leading-relaxed text-slate-200">{e.interviewer_crosscheck_notes}</p>
        </div>
      </div>

      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Stated correctly</h3>
          <ul className="space-y-1.5">
            {e.analysis.what_was_said_correctly.map((t, i) => (
              <li key={i} className="border-l-2 border-emerald-500/40 pl-3 text-xs leading-relaxed text-slate-300">{t}</li>
            ))}
            {!e.analysis.what_was_said_correctly.length && <li className="text-xs text-slate-600">None recorded.</li>}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-rose-400">Gaps and discrepancies</h3>
          <ul className="space-y-1.5">
            {e.analysis.what_is_missing_or_incorrect.map((t, i) => (
              <li key={i} className="border-l-2 border-rose-500/40 pl-3 text-xs leading-relaxed text-slate-300">{t}</li>
            ))}
            {!e.analysis.what_is_missing_or_incorrect.length && <li className="text-xs text-slate-600">None recorded.</li>}
          </ul>
        </div>
      </div>

      <footer className="border-t border-slate-800 px-5 py-3">
        <p className="text-[11px] leading-relaxed text-slate-500">{e.assessment_basis}</p>
      </footer>
    </section>
  );
}
