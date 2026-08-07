# BE Mastery — workflow and evidence audit

**Date:** 2026-08-07
**Audited at commit:** `955ed4b`
**Method:** read against the code as it exists, not against the documentation.
Ten role lenses applied (`skills/*.md`). Browser-verified where a finding was
about rendered behaviour.

**Disclosure:** a large share of the recent work audited here is my own. Findings
1, 3 and 4 are self-critical: evidence honesty was fixed on the Progress page and
the identical problem was left standing on Home, Profile and the Career Center.
Finding 3 also carries a correction to this audit's own first draft.

---

## Verdict

The product has a good spine — one engine, data-driven tracks, offline-first, and
a workshop system that measures what a learner actually said against a rubric.

But the app runs **two evidence systems in parallel, and the weaker one drives
every headline number.** Speech is measured in three places — the daily session,
shadowing and the workshops — and none of that measurement reaches "Career
readiness", "Career milestone" or "Skills Missing". Those come from counters:
activities completed, days practised, and a 1-to-10 self-rating the learner gives
themselves at the end of a session.

Correcting that inversion is worth more than any new feature.

**Disclosure on method:** the first draft of this audit claimed the daily session
measured nothing at all. Driving it in a real browser disproved that. The finding
was rewritten rather than quietly dropped — see Finding 3.

---

## What is well done

### The overlay architecture

`trades.js` and `jurisdictions.js` change *specifics* over one shared engine —
codes, vocabulary, questions, model answers, week wording, phrase-bank lines —
with no forked screens. Adding a fourth trade is a data edit.

This survived real pressure. Three trades now differ substantially across nine
workshops each, with zero duplicated UI. `architecture-reviewer`'s central rule
is being followed in practice, not just in intent.

### The workshop assessment is real

`AnswerEvaluator.evaluate` scores an actual transcript against rubric points with
word-boundary matching and stem handling. The report cites the model answer,
attempts are tracked across time, and no score band is labelled "fail". This is
the most defensible thing in the application.

### Evidence honesty, where it was fixed

`ConversationOrchestrator.feedback` and `debrief.scores` were deleted rather than
patched around. The Progress page states "not enough evidence yet" instead of
printing a number. `AnswerEvaluator.portfolio` is the only readiness-shaped figure
in the app derived from speech.

### Internationalisation discipline

1,220 keys across 15 language packs, with exact key parity enforced on every
commit. Very few projects of this size hold that line.

### The two-Home split

General English and the Professional Track are genuinely different products
sharing one engine — no invented destination, no career milestone, correct header
chip visibility, each Home offering only the track the learner is not on.

---

## The structural problem

### Finding 1 — The strong signal is siloed; the weak signal is the headline

**Severity: high.** Lenses: `ai-coach`, `learning-designer`, `gamification`,
`chief-product-officer`.

Evidence in the code:

- `CompetencyEngine.score()` is `totals / max` — a count of completed activities.
  `consistency` is literally `dates.length * 5`.
- `readiness()` is a weighted average of those counts.
- The session awards competency using `S.scores[key]` — the learner's own
  slider. **Correction, found while fixing this:** the slider value is stored on
  the log and then ignored. `logActivity` awards from `activityMappings` keyed on
  activity *type*, so completing a session scores the same whether the learner
  spoke well or tapped through in silence. The counter is even blunter than this
  finding first claimed.

That number then appears as:

| Surface | Label shown |
|---|---|
| Home (professional) | Career milestone: Professional Foundation |
| Career Center | Career readiness N% · Interview readiness N% |
| Profile | Career Readiness Roadmap · "Skills Missing — Communication 40%" |

Meanwhile `AnswerEvaluator` — which knows what the learner said, which rubric
points they hit, and which trade vocabulary they used — feeds only the Progress
page and the workshop report.

A learner can complete thirty sessions, self-rate highly, and be told they are
approaching "Interview Ready" without ever having spoken a scored sentence. That
is exactly the `gamification` guardrail against rewards implying career readiness
without evidence, and the `ai-coach` evidence rule.

**Changed.** `AnswerEvaluator.readiness(s, sims)` is now the single source.
Readiness is *demonstrated answers ÷ answers your trade's workshops ask for*,
where demonstrated means coverage of 0.7 or better on that question — the same
bar the workshop report uses, so the two cannot disagree. Each question counts
once at its best attempt, so repeating one workshop cannot inflate the figure
without widening what has been shown. Interview readiness is the interview
workshop's own best coverage, reported separately rather than averaged in.

With no evidence it returns **null, not zero** — zero says the learner tried and
failed, null says nobody has looked yet, and every surface can now tell them
apart. No consumer of `CompetencyEngine.readiness` remains.

---

## Findings by area

### Finding 2 — The coach recommends a deliberately hidden feature

**Severity: high.** Lenses: `ux-reviewer`, `chief-product-officer`.

`ACTIONS.communication` and `ACTIONS.interview` in `adaptive-learning-engine.js`
both route to `go:"roleplay"`. AI Conversation is hidden from navigation because
browser speech was not good enough. The most prominent recommendation in the
app — "Coach recommendation · AI Conversation", visible on both Homes — sends the
learner into a screen the product decided not to ship, with no nav route back.

**Change:** repoint both at the workshops, which do the same job and are assessed.

### Finding 3 — The session scores speech, but the score was not evidence

**Severity: high.** Lenses: `learning-designer`, `ai-coach`.

> **Correction.** The first version of this finding claimed the session measured
> nothing. That was wrong, and the error was mine. Driving the real session in a
> browser — seeding a target script and a transcript, then tapping Analyze —
> returned a full feedback panel: **92%, 11 of 12 words recognised**, word-level
> chips, and a `pronunciation_feedback` competency award. `sessRec` starts the
> same recorder Shadow uses and `sessAnalyze` runs the same engine. The finding
> below is what is actually wrong, which is narrower and more specific.

Every scored take — from the daily session, from shadowing, from workplace
lines — lands in `S.fbHist`. `AnswerEvaluator.portfolio` read **only**
`s.simulations.attempts`. So a learner could record a scored session every day
for a fortnight and Progress would still say nothing had been recorded.

Alongside it, completing a day awards competency from `S.scores[key]` — a 1-to-10
self-rating — which feeds the readiness counter with the same standing as the
measured score. The strong signal was discarded and the weak one kept.

**Changed:** `portfolio` now reports a `spoken` stream from `fbHist` — takes
scored, average clarity, best take — and Progress shows it under "Speaking
clarity". It is deliberately **not** averaged into workshop coverage: coverage
asks whether the required points were made, clarity asks whether the words were
recognised. One number answering both questions would answer neither.

Still open: the self-rating continues to award competency equally. That is part
of item 3.

### Finding 4 — Profile prints activity-derived percentages

**Severity: medium.** Lens: `ai-coach`.

`rProfile` renders `narrativeCard`, `roadmapCard` and `heatmapCard`. The roadmap
shows a correct "Spoken evidence: N answers" line directly beside percentages
derived from counters — the two disagree inside the same card.

**Change:** keep the milestone narrative and the spoken-evidence line, drop the
percentages until they are evidence-backed. Mirrors what was already done on
Progress.

### Finding 5 — The prompt boundary is thin

**Severity: medium.** Lens: `prompt-engineer`.

`transcript()` maps learner turns to `role:"user"`, which is structurally right,
but learner text enters the model with no delimiting, and the system prompt now
carries trade context assembled from application state. The guide requires
testing with weak, empty, ambiguous and adversarial inputs. No such test exists.

Not demonstrated as an exploit — this is a design gap visible in the code.

**Improve:** delimit learner turns explicitly, add a standing instruction that
text inside the delimiters is speech to respond to and never instruction, and
keep a small adversarial fixture set.

### Finding 6 — Phrase Lab mastery is self-declared

**Severity: medium.** Lenses: `learning-designer`, `gamification`.

`S.phMaster` is a checkbox. "Phrases mastered 24/24" is a claim the app cannot
support, and it sits beside genuinely measured numbers.

**Improve:** require one recorded attempt scored by the same `hits()` function
the workshops use — or rename it "marked as learned", which is honest and free.

### Finding 7 — Nine workshops inside a twelve-week plan

**Severity: medium.** Lens: `learning-designer`.

Pipefitters have no workshop in weeks 3, 6 and 10; boilermakers none in 4, 6 and
7. Those weeks still carry shadowing, phrases and practice, so nothing breaks,
but a quarter of the plan is thinner for two of three trades and nothing explains
why.

**Improve:** author trade workshops for those slots, or have the week card state
what it does offer.

### Finding 8 — Trade content has had no qualified review

**Severity: medium. A liability, not a bug.** Lens: `welding-domain-expert`.

Ninety authored answers describe isometrics, rolling offsets, tube rolling,
blinding and rigging. The communication patterns are sound and inside the guide's
boundary. The technical specifics are not reviewed. The guide is explicit that
this needs qualified review, and the product is heading toward informing hiring
conversations.

**Change:** review by a qualified pipefitter and boilermaker before promoting
these tracks.

### Finding 9 — index.html is 11,860 lines

**Severity: low, rising.** Lens: `architecture-reviewer`.

Not worth a rewrite. But two bugs in a single working session traced directly to
file size: an over-broad CSS range replacement that blanked the score ring, and a
duplicated `const` from a splice. The engines were extracted correctly; the views
were not.

**Improve incrementally:** extract one view per change when you touch it. Shadow
first — it is the largest.

### Finding 10 — Analytics cannot answer the product question

**Severity: low.** Lens: `chief-product-officer`.

Events are instrumented and the Worker is written but not deployed. `sendBeacon`
reports no errors, so every event is silently lost. There is also no event for
what now matters most: workshop started, completed, and score band.

**Change:** deploy the events Worker; add `workshop_start` and
`workshop_score_band` to the allow-list.

---

## How the surfaces should come together

Each surface today is competent and self-contained. There is no chain.

```
        ┌──────────── ONE EVIDENCE LEDGER ────────────┐
        │   every scored utterance, with rubric,      │
        │   coverage, vocabulary used, timestamp      │
        └─────────────────────────────────────────────┘
              ▲          ▲            ▲          ▲
              │          │            │          │
          SESSION     SHADOW      PHRASE LAB   WORKSHOP
        (25-min      (line-by-    (say it,     (5 scored
         speaking)    line score)  scored)      answers)
              │          │            │          │
              └──────────┴─────┬──────┴──────────┘
                               ▼
                    PRACTICE  ← what you missed, due for review
                               ▼
                    PROGRESS  ← what you have proven, per trade
                               ▼
                 CAREER CENTER ← what your destination still needs
```

Rules that make it cohere:

1. **One ledger, one truth.** Every surface writes scored utterances to the same
   place. Nothing else may produce a readiness number.
2. **Practice is the gap list, not a second curriculum.** Words and rubric points
   the learner missed, sourced from the ledger rather than a static file.
3. **Progress is the proof.** Already correct in shape. It becomes the single
   readiness surface once the ledger exists.
4. **Career Center is the delta.** "Your destination is Canada. Your last five
   answers cited no standard. CSA W47.1 is what employers there ask about."
   Today it gives generic guidance regardless of what the learner has said.
5. **Home asks one question, answerable from the ledger.** Today's mission should
   come from the largest measured gap — never from a counter, and never pointing
   at a hidden screen.

---

## Priority order

| # | Action | Type | Effort | Status |
|---|---|---|---|---|
| 1 | Repoint coach recommendations off `roleplay` | Change | minutes | done — see changelog |
| 2 | Session's scored speech counts as evidence on Progress | Change | hours | done — see changelog |
| 3 | Readiness derives from `AnswerEvaluator`, not counters | Change | ~1 day | done — see changelog |
| 4 | Profile roadmap drops counter percentages | Improve | hours | done with item 3 |
| 5 | Deploy events Worker + 2 workshop events | Change | ~1 hour | open |
| 6 | Phrase mastery requires one scored attempt | Improve | hours | open |
| 7 | Prompt delimiters + adversarial fixtures | Improve | hours | open |
| 8 | Tradesperson review of the 90 answers | Change | external | open |
| 9 | Workshops for the empty weeks | Improve | days | open |
| 10 | Extract views from index.html as touched | Improve | ongoing | open |

**Leave alone:** the overlay architecture, the workshop report, i18n discipline,
the two-Home split, the trade scoping. Those work as designed.

---

## Changelog against this audit

Items are struck off here as they land, with the commit that did it.

- **Item 1 — coach recommendations repointed.** `ACTIONS.communication` and
  `ACTIONS.interview` now open the assessed workshops instead of the hidden
  roleplay screen.
- **Item 2 — scored speech is now evidence.** `AnswerEvaluator.portfolio` gained
  a `spoken` stream read from `S.fbHist`, and the Progress page shows it as
  "Speaking clarity" — takes scored, average, best — separate from workshop
  coverage. Before this, a fortnight of scored daily sessions showed on Progress
  as "nothing recorded yet". Verified in the browser: with three takes and no
  workshops, Progress reports 3 takes / 85% average / 92% best, and still says
  plainly that there are no workshop answers yet.

  The audit's original wording for this item was wrong — see the correction in
  Finding 3.

- **Item 3 — readiness now comes from evidence.** `AnswerEvaluator.readiness`
  replaced `CompetencyEngine.readiness` at every consumer: the Home career
  milestone, the Career Center's two figures, the Profile roadmap, and
  `weeklyReview` (unrendered today, but it would have reported the old counter
  the moment it was shown).

  The decisive test: a learner with **20 activity logs, several practice days and
  zero spoken answers** now reads "Not measured yet" on Home, "—" for both
  Career Center figures, and 0/45 on the roadmap. Previously that learner was
  awarded a milestone. With one workshop and two answers at the bar: 2/45, 4%.
  Adding the interview workshop: 7/45, 16%, interview 88%.

- **Item 4 — the roadmap's counter percentages are gone.** "Skills Missing —
  Communication 40%" was three competency counters wearing percentage signs. The
  card now shows answers demonstrated, readiness, the interview workshop, and a
  "Not shown yet" list of workshops with no attempt — which is something the
  learner can act on — plus a line stating the basis.
