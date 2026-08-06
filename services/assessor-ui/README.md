# Assessor UI

Two React + Tailwind components for the evaluation report returned by
`POST /api/v1/evaluate-simulation`.

| Component | Reader | Purpose |
|---|---|---|
| `CandidateReport` | the welder | Grade badge, animated score ring, covered/missing bullets, coaching text |
| `InterviewerPanel` | hiring team | Dense cross-check view, stark compliance anchor, copyable notes |

```tsx
import CandidateReport from "./components/CandidateReport";
import InterviewerPanel from "./components/InterviewerPanel";

<CandidateReport report={report} />
<InterviewerPanel report={report} />
```

Both are presentational — they take the parsed report and render it. No fetching,
no state, so they drop into any React app or Storybook.

## Styling

Tailwind utility classes, dark palette, responsive from 360px. Requires Tailwind
configured with `content` covering `src/**/*.{ts,tsx}`. No other dependency.

## Two things deliberately built in

**Colour is never the only signal.** Each verdict carries a word and a glyph as
well as a colour, and the score ring is `aria-hidden` with the number exposed as
text — a red/green-blind recruiter and a screen-reader user both get the verdict.

**The compliance flag is labelled precisely.** It reads *"Answer met the
regulatory benchmarks for this module"*, never *"candidate is compliant"*, and the
`assessment_basis` line is not collapsible in either component. A recruiter
misreading that flag could reject a qualified welder or advance an unqualified
one, so the wording is load-bearing.
