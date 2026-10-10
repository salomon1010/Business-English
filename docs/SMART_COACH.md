# Smart Coach — Smart Practice Planner (10 Oct 2026, staging only)

Flag `smart_coach_enabled`: staging ON, production OFF. Both programmes
(General English `general-english`, Welding `welding`). Entry point: Profile →
Daily reminder → the Smart Coach card at the top of the sheet. The daily
reminder switch, its time and both calendar buttons are unchanged.

## Pieces

| Piece | File | What it does |
|---|---|---|
| Engine (pure) | `smart-coach-engine.js` | evidence → priority, three plans, schedule rules, session states, outcome. Shared by the app and the Worker. |
| Screens | `smart-coach.js`, `smart-coach.css` | the sheet, the editor, the dashboard, verification, iOS reminders, `.ics`. Own en/fr strings; other languages fall back to English. |
| Server | `backend/coach/` (`be-coach-staging`) | sign-in, the account's programme, Premium, one open plan per programme, idempotency, completion checks. Durable Object `CoachStore`, one per account. |
| iOS | `BEPushPlugin.swift` `coachSchedule` / `coachPending` | local notifications with calendar triggers (wall clock, so DST-safe), replaced as a set, prefix `be-coach-`. |
| Analytics | `backend/events` `coach_*` + key `skill` | engagement (`coach_session_opened`) is kept apart from verified results (`coach_session_completed`, `coach_completed`). |

## Rules

- **Evidence only.** Grammar drills (`gramA`), word quizzes (`quizHistA`),
  scored recordings (`fbHist`), trouble words, words due, and the game hubs'
  rounds and open errors — all from the OPEN programme. Fewer than 3 measured
  exercises → a diagnostic, never a guessed weakness.
- **Locked.** The focus, the length and the activities are fixed when proposed.
  The server derives the length from the kind and refuses any change to focus,
  length or activities (`409 locked`), and refuses activities that do not
  belong to the focus (`422 activity`).
- **Editable.** Start date (within 14 days), practice weekdays, each session's
  date (inside the fixed window, one a day) and time (not 22:00–07:00).
- **Approval first.** Nothing is stored or scheduled until the learner taps
  Approve and the server answers 200.
- **One open plan per programme** (`409 active_exists`).
- **Completion = a saved record.** A record counts only once, only inside the
  session's window, and sessions complete in order. A game round counts only
  after be-polish closed it: the Worker reads `wmf:`/`emf:<round id>` in
  be-polish-staging's RateLimiter. Other records are labelled "from your saved
  result" (they live on the device).
- **Missed** after the end of the day after a session's date. **Overdue**
  after the end of the day after the last day: the learner chooses Restart
  (same plan, new window) or Cancel. Never extended silently.
- **Outcome** keeps three answers apart: sessions done; final check ≥ 80 %;
  change between the starting and final check (the same exercise). A Quick
  Boost has no check and claims neither.
- **Next step** comes only after completion: a failed check reinforces the same
  focus one size up; a skill just passed rests; one passed 10+ days ago gets a
  review.
- **Premium** is checked by the server (`402`). Status, pause and cancel stay
  open after Premium ends.

## Defaults (product choices, not research results)

Quick Boost 3 days / 3 × 5 min; Focus Sprint 5 days / 4 × 8 min; Mastery
Cycle 14 days / 7 × 8 min. Pass mark 80 %.

## Tests

`tests/smart-coach-engine.test.mjs` (46), `backend/coach/test/run.mjs` (40),
`tests/smart-coach.mjs` (35, the app against the real Worker in process),
Swift `BEPushCoachTests` (9). Deploy: `cd backend/coach && npx wrangler deploy --env staging`.

## Known limits

- Android and the web get in-app reminders only (no closed-app session push).
- Device-recorded results can be altered by a modified client; only game
  rounds are confirmed by a server.
- The schedule follows the device's wall clock; travelling across time zones
  moves sessions with it.
