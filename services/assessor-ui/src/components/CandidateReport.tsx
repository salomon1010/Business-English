/* ============================================================================
   Candidate-facing report.

   Design intent: this is read by a skilled tradesperson who may have just been
   told they failed a safety module. It has to be unambiguous without being
   humiliating — the verdict is stated plainly, and everything below it is framed
   as the route to passing next time.

   Accessibility notes that are not optional here:
     • Colour never carries meaning alone — every badge has a word and an icon.
     • The score ring is aria-hidden and the number is read from live text.
     • Motion is suppressed under prefers-reduced-motion.
   ============================================================================ */
import React from "react";
import type { EvaluationReport } from "../types";

const VERDICT = {
  PASS: { label: "Pass",  ring: "stroke-emerald-500", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40", icon: "✓" },
  FAIR: { label: "Fair",  ring: "stroke-amber-500",   chip: "bg-amber-500/15 text-amber-300 ring-amber-500/40",     icon: "!" },
  FAIL: { label: "Fail",  ring: "stroke-rose-500",    chip: "bg-rose-500/15 text-rose-300 ring-rose-500/40",        icon: "×" },
} as const;

function ScoreRing({ value, verdict }: { value: number; verdict: keyof typeof VERDICT }) {
  const r = 54, c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-36 w-36 shrink-0 place-items-center">
      <svg viewBox="0 0 128 128" className="h-36 w-36 -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-slate-700/60" />
        <circle
          cx="64" cy="64" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          className={`${VERDICT[verdict].ring} transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold tabular-nums text-slate-50">{value}%</div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">covered</div>
      </div>
    </div>
  );
}

function Bullets({ title, items, tone }: { title: string; items: string[]; tone: "good" | "gap" }) {
  if (!items.length) return null;
  const good = tone === "good";
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-200">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                good ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {good ? "✓" : "⚑"}
            </span>
            <span>
              <span className="sr-only">{good ? "Covered: " : "Missing: "}</span>
              {t}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CandidateReport({ report }: { report: EvaluationReport }) {
  const e = report.evaluation;
  const v = VERDICT[e.verdict];

  return (
    <article className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl sm:p-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreRing value={e.overall_score_percentage} verdict={e.verdict} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Module {e.module_id} · {e.jurisdiction_framework}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ring-1 ${v.chip}`}>
              <span aria-hidden="true">{v.icon}</span>
              {v.label}
            </span>
            <span className="text-sm text-slate-400" role="status">
              Scored {e.overall_score_percentage} percent
            </span>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-100">{e.feedback_to_candidate}</p>
        </div>
      </header>

      <Bullets title="What you said correctly" items={e.analysis.what_was_said_correctly} tone="good" />
      <Bullets title="What was missing" items={e.analysis.what_is_missing_or_incorrect} tone="gap" />

      <footer className="mt-8 border-t border-slate-700/60 pt-4">
        <p className="text-xs leading-relaxed text-slate-500">{e.assessment_basis}</p>
      </footer>
    </article>
  );
}
