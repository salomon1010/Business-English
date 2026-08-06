# IMPLEMENTATION_ROADMAP

## Professional Tracks

### Sprint 11 — Professional Workplace Simulations Redesign — Complete (2026-08-05)

Reframed the Welding simulation catalog as a progressive set of professional workplace scenarios rather than interview questions. Each of the existing 12 scenarios now communicates its real work context, skills developed, estimated duration, difficulty, recommended stage, visible objectives, workplace story, and available professional contacts.

The learner chooses who to speak with using a direct **Talk to [name]** action. That selected professional now opens the existing voice-first simulation screen, preserving the current conversation orchestration, natural voices, objective tracking, local session memory, competency award, and workplace debrief. Returning to the catalog keeps the learner in the scenario journey; no new learning engine, screen runtime, backend, or deployment was added.

### Sprint 10 — Live AI Workplace Engine — Complete (2026-08-05)

Replaced the Professional Simulation interaction with a voice-first workplace experience. The new Conversation Orchestrator is profession-independent: track packs continue to provide characters, scenarios, objectives, and unexpected events, while the orchestrator manages active speaker, objective completion, conversation memory, service-backed follow-up turns, character changes, and persistence.

The simulation UI now uses the established full-screen conversation layout: character header, one active spoken prompt, microphone control, speaking/listening state, and collapsible talking points instead of a call-style dashboard, typing, or a scrolling transcript. It uses the existing natural-voice service with track-defined female or male character voices, falling back to the app's gender-matched browser voices when needed, plus the existing secured AI conversation endpoint for contextual follow-ups. Active sessions, voice metadata, response-derived feedback signals, conversation history, objectives, competency awards, and debriefs are retained in the existing local learner state. Browser voice capability remains a client dependency; when recognition is unavailable the UI states that limitation without reintroducing text entry.

The Welding learner-facing route now prioritizes the established **Talk it out** coach-card experience. Its twelve existing track conversations are labelled as professional interview types and retain their appropriate coaches and subject matter. The separate Workshop Simulation entry is intentionally withheld from the Welding Practice and Career Center paths, so the learner experience stays consistent with the role-play pattern.

### Sprint 9 — Global Career Readiness Center — Complete (2026-08-05)

Delivered a local, track-aware Career Center that turns existing professional learning evidence into career-preparation guidance. Learners can choose Cameroon, Nigeria, South Africa, Canada, the United States, or an International Contractor context and receive destination-specific interview, workplace communication, culture, and certification-preparation guidance.

The Center reuses the active track, Adaptive Learning Engine, Skills Passport, AI mentors, and Professional Simulation Engine. It surfaces career and interview readiness, existing gap analysis, an AI-assisted professional-summary coach, and direct entry points to the relevant mentor and simulation. Certification information remains educational; learners are directed to verify current employer, licensing, legal, and authority requirements themselves. No new learning engine, backend, or deployment was introduced.

### Sprint 8 — Complete Welding Professional Track Curriculum — Complete (2026-08-05)

Expanded the Welding track from a single foundation week into a 12-stage Professional Journey. The stages progress from workshop entry and team communication through equipment, materials, safety, procedures, drawings, construction, QA, industrial work, interviews, and career readiness.

Every stage now has a learning objective, shadow focus, phrase focus, vocabulary focus, AI mentor, professional simulation, daily task sequence, stage mission, and competency-focus mapping. The existing Curriculum Provider, Competency Engine, AI Coach, Simulation Engine, Career Readiness, Adaptive Learning, and Skills Passport continue to consume the same track data model. No new platform architecture was added.

### Sprint 7 — Adaptive Learning Intelligence — Complete (2026-08-05)

Delivered an explainable, local Adaptive Learning Engine that continuously prioritizes the learner’s next activity using active-track competency results, coaching evidence, simulation history, vocabulary retention, confidence, and pronunciation signals. The existing Home coach card now expresses the engine’s single best recommendation instead of a static curriculum next step.

Profile now includes a Career Readiness Roadmap and Professional Activity Calendar; Progress includes a Weekly Growth Dashboard. Milestone labels replace generic completion language in the adaptive experience. Readiness, interview readiness, and estimated time to the next milestone are transparent formative predictions, not employment guarantees.

### Sprint 6 — Professional Simulation Engine — Complete (2026-08-05)

Delivered a reusable, track-configured Professional Simulation Engine alongside the existing Practice and AI conversation experiences. Simulation packs define the workplace scenario, characters, objectives, unexpected events, evaluation criteria, and debrief recommendation. The engine maintains the learner’s conversation state locally, carries forward stated facts into later character responses, records completed simulations, and awards existing configurable competency points.

The initial Welding implementation is **First Day at a Welding Workshop**. It includes HR Recruiter, Supervisor, Coworker, Safety Officer, and QA Inspector interactions, an early-job safety event, and a six-area readiness debrief. No Week 2 curriculum was added.

### Sprint 5 — AI Learning Coach — Complete (2026-08-05)

Delivered a local-first learning coach that turns completed competency-mapped activities into immediate, personalized feedback. The coach persists activity summaries and a small track-scoped memory, then uses existing competency history, learning evidence, and curriculum position to generate the daily mission, smart Home recommendation, weekly review, and professional growth narrative.

The coaching layer does not send learner content to a new service. It complements the existing AI conversation and speech capabilities while remaining available offline and preserving the established storage and synchronization model.

### Sprint 4 — Professional Skills Passport & Competency Engine — Complete (2026-08-05)

Delivered a reusable, track-scoped competency system backed by the existing local-first storage strategy. Curriculum packs now define their passport competencies, activity mappings, career-readiness weights, and achievement rules. The Profile and Progress pages render the shared Passport and Professional Growth views without changing the existing English progress experience.

Mapped activities currently include session completion, shadow-session completion, Phrase Lab mastery, vocabulary practice, speaking feedback, and completed AI conversations. General English displays only communication competencies; Welding additionally displays professional technical, safety, QA/QC, blueprint-reading, and interview-readiness dimensions.

### Sprint 3 — Welding Week 1 — Complete (2026-08-05)

Delivered the first learner-facing Professional Track curriculum: **Professional Introduction to Welding**. The pack provides one week of seven guided sessions, shadowing starters, professional phrases, starter vocabulary, a weekly mission, and one HR Recruiter AI mentor conversation. The existing General English experience remains the default and uses its existing curriculum and role-play scenarios.

Next: define and implement Welding Week 2 only after Sprint 3 approval.

> Status: authored 2026-08-02. One screen at a time. **Never start the next
> screen without approval.**

## Per-screen loop

Audit (measured) → name problems and why they matter → propose → check against
`DESIGN_SYSTEM.md` → implement → self-review as if reviewing someone else's PR
→ fix what's still inconsistent → report → **stop and wait**.

Report format: Summary · Files changed · Components changed · Accessibility ·
Performance · Regression risks · Next recommended screen. Nothing else.

## Frozen screens

Dashboard, Session, Shadowing Studio, Speaking Feedback, Executive Polish and
Vocabulary are **frozen**. Do not revisit them unless one of these is true:

1. a **shared component** changes (then update every consumer and re-measure),
2. a **regression** is introduced,
3. a **critical defect** is discovered,
4. the owner **explicitly requests** another pass.

State which of the four applies before touching a frozen screen.

**Overlap warnings.** Vocabulary (frozen) and Practice Hub share `rPractice`.
Frozen there: `vocRow`, `vocSave`, `.voc-*`, the `#v-practice` touch-target
floors and the `.prac-subtab.on` contrast fix. The Practice Hub pass owns the
surrounding structure — Knowledge Boosters, the group tabs, the layout.
Calendar (frozen) lives inside `rProfile`: `calHTML`, `calDayDetailHTML`,
`calLocale`, `calDowInitials` and every `.pcal-*`/`.cal-*` rule are frozen; the
Profile pass owns the header, the menu rows and the account block.

## Ship discipline

**Local-first. Do not `git push` until the user says "deploy".** They test
locally first (`python3 -m http.server 8000`). Local commits are fine; pushing
to `origin/main` is what auto-deploys.

On an approved deploy: JS-parse + i18n validate → bump `sw.js`
`be12-vNN` → commit → push → poll live in a **background** job until the new
version appears (`curl` + grep, 30–60s typical, occasionally 10 min).

A TWA loads the live site, so **web changes ship by push alone** — no Play
upload unless the native shell changes.

Commit trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## Sequence

| # | Screen | Renderer | Status |
|---|---|---|---|
| 1 | **Dashboard** | `rHome` | ✅ `9450bed` |
| 2 | **Session** | `rSession` → `#v-journey` | ✅ `479b094`, `77685e9` |
| 3 | **Shadowing Studio** | `rShadow` / `shOpenWork` | ✅ |
| 4 | **Speaking Feedback** | `fbShowResults` → `#fbOut` | ✅ |
| 5 | **Executive Polish** | `ex*` in `rPhrases` | ✅ `a1cd17f`, truthful-labels follow-up |
| 6 | **Vocabulary** | `vocRow` in `rPractice` | ✅ |
| 7 | **Practice Hub** | `rPractice` shell | ✅ |
| 8 | **Calendar** | `calHTML` in `rProfile` | ✅ |
| 9 | **Profile** | `rProfile` shell | ✅ |
| 10 | **Settings** | `rSetup` + `rData` | ✅ |
| 11 | **Help** | `rManual` | ✅ |
| 12 | **Onboarding** | `obRender` | ✅ |

---

## Screen 1 — Dashboard ✅

CTA 472→**344**px · page 2257→**1856**px · metric panel 825→**487**px ·
sub-44px targets 2→**0** · infinite animations 2→**0** · contrast failures
2→**0**. Full findings in `UX_AUDIT.md`.

Added `.btn-primary`, `.home-week`, `.home-more`, `.home-step`, `.stat-empty`.
Removed `.home-tabs`, `.stat-next`, `.stat-todo`, `homeTab()`.
One new i18n key (`home.week_days`), translated ×15, parity 1112.

---

## Screen 2 — Session ✅

Taps to the recorder 1→**0** · controls hidden behind a tab 19→**0** · visible
targets <44px 5→**0** · infinite animations 1→**0** · contrast failures 3→**0**
· inline styles 42→**18** · DOM 195→**191** · timer card 306→**196**px.
Document height grew 1804→2291px, the intended cost of un-hiding the practice
half. Full findings in `UX_AUDIT.md`.

Removed the plan/do tab entirely (`sessTab`, `_sessTab`, `#sessPlan`,
`#sessDo`). Added `.sess-body`, `.sess-jump`, `.sess-plan`, `.sess-aloud`,
`.sess-heard`, `.sess-reset`, `.sess-act`, `.sess-timer-foot`. No new i18n keys.

`sess.tabs_label` and `sess.tab_practise` are retained but unused.

---

## Screen 3 — Shadowing Studio (next)

Carried forward:
- **`.glow-cta` ×1** — the last one outside Executive Polish.
- The posture button is a byte-identical copy of the 38px `.btn-sm` block fixed
  in Session (~line 4581); fix it here rather than reaching across screens.
- Every dense screen renders third-party YouTube artwork — relevant to store
  art, not to this pass.

---

## Cross-screen work

Each needs a decision, not a per-screen patch. Recommend scheduling 1 and 2
before the passes that would otherwise re-patch them.

| | Item | Recommendation |
|---|---|---|
| 1 | `.help-fab` overlaps interactive content at rest on multiple screens | **Delete it** — Profile → Help already exists, one tap from the bottom nav |
| 2 | `.glow-cta` now live only on Shadow ×1; `.ex-micbtn` shares the infinite conic animation | Remove in the Shadow and Executive Polish passes; delete the keyframes when the last use goes |
| 3 | Radius sprawl — raw 12/10/9/8/7/22px beside `--r-md`/`--r-lg` | Migrate opportunistically, per pass |
| 4 | Header streak pill shows a gold flame **0** on day one | Hide below 1 — one line, but shared chrome, so needs its own commit |
| 5 | Progress Calendar labels hardcoded English, no i18n keys | Fix in the Calendar pass (screen 8) |
| 7 | Five `→` "go" arrows still unmirrored in RTL (Session's is fixed) | One shared `html[dir="rtl"]` rule, once the owning screens are passed |
| 6 | `.btn-p` gradient buttons app-wide | Fold into `.btn-primary` as screens are touched |

## RC1 stabilisation — complete

| | Task | Commit |
|---|---|---|
| 1 | Duplicated CSS | verified clean (only keyframe stops) |
| 2 | Duplicated JS | the three theme setters collapsed to two real ones |
| 3 | Dead CSS | verified clean; `.ttl` is **live** in `manual/*.html` — an index-only scan calls it dead, do not delete |
| 4 | Dead JavaScript | `a23dab2` |
| 5 | Shared components — 44px floor + focus ring on `.btn` | `b916209` |
| 6 | Obsolete tokens | added `--accent-text`; `--mut2` contract enforced where measurable |
| 7 | Malformed CSS block killing two rules | `f748936` |
| 8 | Performance / bundle loading | Firebase deferred, `0eef9a5` |
| 9 | Memory | no leak: 96 renders, 0 node/listener growth |
| 10 | Offline / PWA | verified on the live https site |
| 11 | Accessibility — contrast document-wide | `4432c6f` |
| 12 | Localisation | parity 1147×15 holds; 14 hardcoded aria-labels remain |
| 13 | Regression | corrected gate clean, both themes + reduced motion |

**The measurement rig itself was the biggest defect.** Scoping every query to
`#v-<name>` and testing only `height` made 11 of 11 screens report clean while
each carried 6–8 sub-44px controls. Any future audit must follow
`INTERACTION_SPECIFICATION.md` §10.

## Infrastructure not blocking design

- **Events Worker not deployed** — `npx wrangler deploy` in `backend/events/`,
  or every `track()` call is silently lost.
- **Push Worker not deployed** — no KV id, no VAPID pair. Harmless; the old
  `setTimeout` reminder path is untouched.
- Native-speaker review of the emotional translations still recommended.
- `rp-photos/` has no recorded image sources — needed for the Play AI-asset
  declaration and cannot be reconstructed from the repo.

## Definition of done

See `INTERACTION_SPECIFICATION.md` §11. A screen is not done because it looks
better. It is done when it is measured, keyed, keyboard-complete, contrast-clean
in both themes, and self-reviewed.
