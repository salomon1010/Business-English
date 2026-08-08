# Welding Simulation Assessor

`POST /api/v1/evaluate-simulation` — grades one spoken answer against the
regulatory benchmarks for one of twelve workshop modules.

**Stack: TypeScript on Cloudflare Workers, Zod for validation.** Chosen over
Python/FastAPI because the repository is already JavaScript, the OpenAI key
already lives in a Cloudflare Worker (`backend/polish-worker.js`), and this adds
no new language, server or hosting bill. If you would rather run FastAPI, the
grading logic in `grade.ts` is pure and ports directly; only `index.ts` changes.

---

## File structure

```
services/assessor/
├── package.json
├── tsconfig.json
├── wrangler.jsonc            # config; secrets are NOT here
├── scripts/
│   └── build-modules.mjs     # regenerates modules.ts from the track pack
├── src/
│   ├── index.ts              # endpoint: routing, auth, validation, errors
│   ├── schema.ts             # Zod contracts for every boundary
│   ├── modules.ts            # GENERATED — the 12-module dictionary
│   ├── jurisdictions.ts      # country/sector citation overlays
│   ├── prompt.ts             # dynamic single-module context assembly
│   ├── llm.ts                # model call, JSON sanitising, repair
│   └── grade.ts              # deterministic grading + narrative
└── test/
    └── assessor.test.mjs
```

## Request

```json
{
  "candidate_id": "cand_8842",
  "session_id": "sess_01H9",
  "module_id": 10,
  "candidate_transcript": "I check the entry permit is signed…",
  "target_jurisdiction": "canada"
}
```

`target_jurisdiction` is optional and defaults to `international`. Values:
`international`, `us`, `canada`, `uk_eu`, `africa`, `oil_gas`.

## Response

The agreed `evaluation` object, plus additive fields (`assessment_basis`,
`graded_by`, `jurisdiction`, `jurisdiction_framework`, `candidate_id`,
`session_id`, `assessed_at`). Existing consumers are unaffected.

## Status codes

| Code | When |
|---|---|
| 200 | Assessed. `x-graded-by` header is `hybrid` or `deterministic` |
| 400 | Invalid JSON, bad/absent field, module id outside 1–12, empty transcript |
| 401 | Missing or wrong `Authorization: Bearer <ASSESSOR_API_KEY>` |
| 404 / 405 | Unknown route / non-POST |
| 429 | More than 20 evaluations per candidate per minute |
| 500 | Unexpected, or the generated report failed its own schema |

There is no 504. A model timeout **downgrades** to deterministic grading and still
returns a complete 200 — see below.

## How grading works, and why it is not pure LLM

Two graders run and are combined under one fixed rule:

> **a core safety benchmark may be ADDED by the model, never REMOVED.**

- **Deterministic** — word-boundary cue matching over the benchmark set. Fast,
  free, repeatable, works offline, and auditable: any report can be re-derived
  from the transcript.
- **Model** — catches meaning the cues miss ("I'd shut it down" conveys stopping
  work without using the phrase). `temperature: 0`.

The model never returns the score, the verdict or the compliance flag. It reports
which benchmarks were conveyed; the service computes the rest. So an articulate
candidate — or a prompt-injected transcript — cannot talk its way to a PASS, and
a provider outage degrades wording rather than failing the request.

**Scoring:** 80% weighted benchmark coverage + 20% terminology.
Core safety benchmarks weigh double.
`PASS` ≥ 80 and every critical benchmark met · `FAIR` ≥ 50 · `FAIL` < 50 **or any
critical benchmark missed**.

That last clause matters. A candidate who talks fluently about a confined-space
permit but never says the atmosphere must be gas-tested scores 53% and **fails** —
averaging that away is the one failure mode of this engine that could get someone
hurt.

## Jurisdictions

Candidates apply in Cameroon, Nigeria, Canada, the US, and into international oil
and gas consortia. The **required behaviour is the same everywhere**; only the
citation differs. So benchmarks are universal and only codes are swapped —
`jurisdictions.ts` maps module → standards per region, with an `emphasis` note
where an expectation genuinely differs (Canada certifies *companies* under CSA
W47.1; oil and gas qualifies to ASME IX / API 1104; provincial law gives an
explicit right to refuse unsafe work).

The model is explicitly told never to withhold credit because a candidate cited
their own country's standard, or none.

## Setup

```bash
npm install
npx wrangler secret put OPENAI_KEY
npx wrangler secret put ASSESSOR_API_KEY
npx wrangler kv namespace create RATE_LIMIT   # optional, see below
npm run typecheck && npm test
npm run dev          # local
npm run deploy       # ships
```

`npm run build:modules` regenerates `src/modules.ts` from
`tracks/welding/practice.json`. **Run it after editing benchmarks** — one source
of truth means the assessment cannot drift from what the app teaches.

## Known limits

- **Rate limiting is per-isolate without KV.** Workers run many isolates across
  many colos, so the in-memory fallback is a soft local ceiling, not a global
  budget. Bind `RATE_LIMIT` in production.
- **AWS D1.1 clause numbers changed in the 2020 edition** (Fabrication 5→7,
  Inspection 6→8). Clause references are data in the track pack with an edition
  note attached; confirm against the edition in force on the project.
- **The welding content has not been reviewed by a qualified welding
  professional.** It was written from published standards and industry practice.
  Before this is used in a hiring decision it needs sign-off from a competent
  welding authority or a qualified welding engineer.
- **This grades communication, not competence.** `regulatory_compliance_met`
  means *the answer covered the benchmarks*. It is never a finding that a person
  is certified, qualified or eligible to work. `assessment_basis` carries that
  sentence into every response so it cannot be lost downstream.
