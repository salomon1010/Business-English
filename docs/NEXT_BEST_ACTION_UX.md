# Next best action — UX specification

*29 September 2026 · branch `feature/bemastery-complete-ux-redesign` · READY FOR REVIEW — DO NOT MERGE OR DEPLOY*

This page defines how BE Mastery tells a learner what to do next. It adds no
engine. It describes the ones that exist (`NudgeEngine`, the gates, the
curriculum pointer, `pathToolPick`, `LearningCoach`) and the rules every
screen follows when it shows their answer. `tests/ia-nba.mjs`,
`tests/home-v2.mjs` and `tests/ux-psychology.mjs` hold the behaviour described
here.

## 1. Principles
1. **One primary action per screen.** It is the only filled button in the
   first view. Everything else is secondary in weight.
2. **Only from real state.** An action is shown only if the learner's own
   record supports it: a day not yet done, words actually due, a clip actually
   failed, a partner actually waiting. With no signal, the fallback is the
   curriculum, never an invented recommendation.
3. **Say what is true.**
   - A learner who has not started is not "continuing".
   - A day with no ticked step is started, not resumed.
   - Praise follows something done.
4. **Name the action.** Buttons are verbs with an object: "Start session",
   "Resume session", "Take the one-minute check". Never a bare "Continue" or
   "Next".
5. **Gates come first.** If the programme cannot start (the placement check,
   Foundations), the gate is the action, and the things behind it say they
   are waiting ("Your first mission appears after the one-minute check").
6. **Each screen answers one question.** Home: what should I do? Learn: where
   am I, and what is today? Progress: how am I doing? Practice: which kind of
   practice?
7. **No pressure mechanics.** No countdowns, scarcity, fake progress or loss
   wording. `docs/ETHICAL_UX_PSYCHOLOGY_AUDIT.md` holds the tests.
8. **The track boundary holds.** General-English-only actions (Practice
   Partner, the Shadow Challenge, Home V2's ranking) never appear on Welding.

## 2. Priority order (what wins the one primary slot)
| # | Condition (real state) | Action | Source |
|---|---|---|---|
| 1 | Placement not taken (`fndNeedsPlacement`) | Take the one-minute check | `homeGateCard` |
| 2 | Placed in Foundations, not finished (`fndGated`) | Today's Foundations day | `homeGateCard` |
| 3 | Programme finished | Certificate / no curriculum action | `totalDone() ≥ trackSessionCount()` |
| 4 | General English, Home V2 on: the engine's first choice | For example: a comeback ("Restart with 5 minutes"), words due, a failed Challenge clip, a partner waiting, the lesson | `NudgeEngine.rank(nudgeSignals())`, with a still-valid server nudge moved first |
| 5 | Otherwise (Welding; General English without Home V2) | Today's curriculum day | `currentPos()` / `pathMissionBtn` |
| 6 | Already practised today | "Today's practice is done", with the next session offered | `homeDoneCard` |

Learn (the Road map) uses rows 1, 2, 3 and 5 only. It speaks for the
curriculum. The engine's other kinds (words, Challenge, partner) lead on Home.

## 3. Learner states and what each screen shows
| State | Home (primary) | Learn "Today" | Progress |
|---|---|---|---|
| New, not placed | Take the one-minute check | Take the one-minute check | "Here is where you start" + the check |
| In Foundations | Today's Foundations day | The Foundations day | Start panel |
| Placed, nothing done | "Your first session" · Start session | Today · Week 1 · Monday · Start session | Start panel · Start your first session |
| Lesson in progress (a step ticked) | Resume session | Resume session | The four numbers |
| Returning, day not begun | Start session (or the engine's first choice) | Start session | The four numbers + next milestone |
| Away 5+ days | Restart with 5 minutes | Start / Resume on the day | Unchanged: never "you missed N days" |
| Practised today | Today's practice is done · Open the next session | The next day | Updated counts |
| Programme finished | Certificate | (no row) | Certificate ready |
| Welding, not placed | The check; the mission waits, with a line saying so | The check | Start panel + the check |
| Welding, placed | Continue Today's Mission | Today's day | As General English, without Premium |

## 4. Available actions (the vocabulary)
**Curriculum:**
- Take the one-minute check
- Foundations day
- Start session / Resume session / Restart with 5 minutes
- Open the next session

**Engine (General English):**
- Review the words due
- Retry the Challenge
- Shadow this clip
- Practise with your partner / Practice Partner
- Practise with the AI coach

**Practice (`pathToolPick`):**
- The one best tool for the day's step, marked "Recommended"

**Coach (after an activity):**
- The recommended next activity
- Your performance analysis (the evidence)

## 5. Fallback behaviour
- **No engine signal** (new learner, flag off, Welding): the curriculum day.
- **The next day is locked** (`pathLocked`): the Road map instead of the
  session.
- **A partner action with no human available:** the AI coach, always labelled
  AI.
- **No network:** the local state still decides. Curriculum, gates and counts
  are all on the device. Server-held nudges simply do not lead.
- **A render error:** "This page could not be drawn." with Try again, never a
  blank page. One missing field no longer takes the Road map down
  (`fndDaysDone` guard).

## 6. Screen responsibilities
| Screen | Answers | Primary | Must not |
|---|---|---|---|
| Home | What should I do now? | One action (§2) | Show a second "today" card (owner, 24 Sep) |
| Learn (Road map) | Where am I? What is today? | Today's step | Recommend non-curriculum work |
| Practice | Which kind of practice now? | The best tool for the step | Present AI and humans as a social feed |
| Shadow | Which stage am I in? | The current mode: Watch → Shadow → Challenge → Apply it | Hide the transcript or the recording |
| Practice Partner | What is my partner state? | Match me · Practise now · the turn · Keep practising together · the AI coach | Skip consent, block, report or track checks |
| Coach summary | What did I do, what should I fix, what next? | The recommended next activity | Invent scores |
| Progress | How am I doing? | None (a report); the start panel's button when empty | Tell the learner what to do beyond the start panel |

## 7. Examples
- **A French-speaking learner on day one, placed.**
  - Home: "Your first session · Week 1 · Monday · Pronunciation baseline", with
    a Start session button.
  - Learn: the same day in the Today row.
  - Progress: "Here is where you start", with their goal, their practice time and
    "Placement check done".
- **A learner with three sessions done and Thursday half done.**
  - Home: "Resume session".
  - Learn: "Today · Week 1 · Thursday · Explain your role to a non-technical
    person", with Resume session.
- **A welder on day one.**
  - Home: the one-minute check.
  - The dashboard keeps the trade and destination pickers, and says the first
    mission appears after the check.
  - "Not measured yet" explains: "Answer one workshop question and this starts
    reporting what you have shown."

## 8. Edge cases
- **Foundations record without `done`:** the Road map still renders.
- **All 84 sessions done:** no Today row. Home and Progress lead with the
  certificate.
- **Right-to-left:** the arrows drawn in markup mirror (`.go-arrow`,
  `.hx-cta-go`); arrows inside translated strings were already right.
- **A long translation of the button:** the row wraps, and the button takes
  the full width at ≤480px.
- **The map sheet:** its Today button closes the sheet before navigating.
- **Premium:**
  - The Progress history (days practised, consistency, the year) is Premium
    only where Premium can be bought (`planOn`), on General English, for a
    learner who is not Premium.
  - The current period stays free.
  - No next-best-action ever sends a learner to a paywall as their "next
    step".
