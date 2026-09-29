# Ethical UX psychology audit

*29 September 2026 · branch `feature/bemastery-complete-ux-redesign` · READY FOR REVIEW — DO NOT MERGE OR DEPLOY*

| | |
|---|---|
| **Base commit** | `78b16a83` — "fix(push, staging): KV LIST only where someone is booked; staging on its own Firebase and Workers" |
| **Why this base** | The newest development commit. It contains everything staging last served (`84402d54`, be12-v568 on staging), all of `origin/main` (be12-v486 and v487) and the iOS wording fixes. It contains none of the four release-only commits on `release/1.1.0-ios` (bundle ID, version bump, release hardening). |
| **Branch** | `feature/bemastery-complete-ux-redesign` (local only, not pushed) |
| **Worktree** | Session scratchpad `…/08dcf2df-…/scratchpad/ux-wt` |
| **Untouched** | `release/1.1.0-ios` (`25148677`) and its worktree, the TestFlight 1.1.0 (1) submission and archive, `main`, the Play release, every Worker, Firebase, flags, entitlements, billing, ads, `stash@{0}`, other sessions' worktrees |
| **Test environment** | Local only: `python3 -m http.server` on 127.0.0.1 serving the worktree, headless WebKit on an iPhone 13 profile, all Workers stubbed. Staging was not running and was not restaged. Nothing touched production. |

## 1. The reference, and what we did not take from it

The source is the uxpeak video "The UX Psychology Behind Apps People Can't Stop
Using" (https://youtu.be/2TlIg3VokY8). It was read from its English transcript
(auto-captions via yt-dlp). The frames were not viewed, so any claim here about
what its screens show comes from the narration.

It presents six principles: decision fatigue, smart defaults, goal-gradient
progress, value before commitment (reciprocity), the IKEA / endowment effect,
and loss aversion with contrast.

**Rejected, because the brief's ethics section forbids them:**

| The video's advice | Why it is rejected here |
|---|---|
| "Never start a user at zero… that artificial head start creates real motivation"; "progress, even a fake one, creates real momentum" | Fake progress. BE Mastery counts only what the learner did. We change the *starting point shown* (where you are, what you set up), never the *number*. |
| Show "their actual files, by name, with the countdown" | A countdown over the learner's own data is a threat, not information. No countdowns anywhere. |
| A dismiss button reading "I'll risk it" | Confirm-shaming. Every dismiss says what it does ("Not now", "Close"). |
| Show an overpriced option first so the real one "feels like a deal" | Decoy anchoring. The Premium sheet may compare only real store prices (annual against monthly × 12). |
| "Your users aren't making logical decisions" | Our learners are adults choosing how to spend 25 minutes. Design helps the decision; it does not route around it. |

**Statistics the video quotes are not repeated as fact.** These include the
jam-display study figures, "70 to 90% never change defaults", and "free
samples increase purchases by up to 2,000%". None was checked against a
source, and none is needed for any decision below.

## 2. What BE Mastery already does (checked in code and on screen, no change)

| Principle | Where it already holds |
|---|---|
| Reduce decision fatigue | **Home V2 (General English)** leads with one next step, ranked by `NudgeEngine.rank(nudgeSignals())` from the learner's real record: placement gate, Foundations day, the curriculum day, words due, a failed Challenge, a waiting partner. With no signal, it falls back to the next curriculum day. **Practice** opens on "Best tool for your step" with one tool marked Recommended. |
| Smart defaults | Onboarding offers "Skip — continue in English". The session opens on the next unfinished day (`currentPos()`). Practice Partner has **Match me** and **Practise now** rather than a list. Shadow Studio preselects the session's own clip. |
| Value before commitment | No account is needed to practise. Sign-in is optional and only adds backup and sync. Onboarding ends on "Your first win takes 60 seconds": the learner hears and says a real sentence before anything else is asked. The placement check takes one minute. |
| Momentum after an activity | A session ends in the coach summary ("Your path" + one "Recommended improvement"), then the progress strip ("n of 84 sessions · Next: …"). The Home "today is done" card offers the next session. |
| User investment | Words collected (Study / Review / Mastered), saved Shadow clips, the Practice Partner History tab, the progress calendar, and the certificate. All are exportable or deletable: backup and export in Settings, "Clear my history", and account deletion with `DELETE /me`. |
| Ethical contrast on Premium | "Save n%" is computed from the store's own annual and monthly prices, and shown only at 5% or more. The benefit list names only built features (`premBenHTML`). A Free vs Premium table sits behind "See what's included". "Cancel anytime in {store}" is shown. There are no timers, no "only n left" and no fake activity. Billing is off in production. |
| Streak honesty | "Your partner streak is at risk this week" is true: the weekly streak would end. It sits beside an action ("Practise with your partner this week to keep it going"), not a threat. |

## 3. Interventions made on this branch

### I1 · The Home hero says what is true for this learner (General English, Home V2)

- **Current experience:** a learner with no session done sees "Continue where you left off" and a button reading "Continue". They have not left off anywhere.
- **Psychology principle:** reduce decision fatigue; progress should read as a real starting line. Button labels name the action (microcopy audit).
- **Proposed change (done):**
  - Eyebrow: "Your first session" while `totalDone()===0`.
  - Button: "Start session" when the day has no ticked step, "Resume session" when it has one, and "Restart with 5 minutes" for a comeback (unchanged).
  - `homeCard()` reads `S.steps[dayKey(w,d)]`.
- **Expected user benefit:** the first screen tells a new learner exactly where they are and what the button does.
- **Ethical risk:** none found. The wording is more accurate than before.
- **Mitigation / constraint:** the owner's online pill ("1 online · 2 in line") must stay on the button's row. Measured on an iPhone 13: "Start session" (154 px) and "Resume session" (171 px) fit beside it. "Start today's session" (202 px) wraps it, so the sentence lives in the eyebrow and the button stays a short verb. On an iPhone SE the pill already wrapped with the old "Continue", so that is not new.

### I2 · Progress opens on "Here is where you start", not four zeros (both areas)

- **Current experience:** before any practice, Progress shows 0/6 days, 0 streak, 0 sessions, 0 words spoken, a "—" score and "0 of 84 sessions". The page reads as "you have done nothing".
- **Psychology principle:** goal gradient, applied honestly. Show the real position and what the learner has genuinely set up, then one small next step.
- **Proposed change (done):** `pgStartHTML()` replaces the four-number grid while the open area has no completed session, no feedback record and no streak. It shows:
  - the curriculum position ("Week 1 · Monday — Pronunciation baseline");
  - only facts from the learner's own record: their goal, their practice time, "Placement check done", "n words saved";
  - one sentence on what the page will show after the first session;
  - one button: the session, or the placement check or Foundations day when those gate the programme.
  The weekly dots and the calendar stay. The numbers return as soon as there is one thing to count.
- **Expected user benefit:** a new learner sees a starting point and a way forward instead of a blank scoreboard.
- **Ethical risk:** listing setup choices could read as inflated achievement.
- **Mitigation:**
  - Nothing is counted or scored, and no percentage appears.
  - Each line is a fact the learner created: the goal and time they chose, a check they took.
  - A fact that is absent is not shown; for example there is no words line with zero words.
  - Tested per area: a Welding learner's panel is built from the Welding record.

### I3 · A near milestone under the certificate (both areas)

- **Current experience:** "0 of 84 sessions done — the certificate unlocks at 84." The only visible goal is twelve weeks away.
- **Psychology principle:** break a large goal into a near, achievable step.
- **Proposed change (done):** one line under the bar: "Next milestone: finish Week 1 — 2 of 7 sessions", computed from `currentPos()` and `weekDone()`.
- **Expected user benefit:** the next finish line is days away, not months.
- **Ethical risk:** none. Both numbers are real counts.
- **Mitigation:** not applicable.

### I4 · The welcome card praises only what happened

- **Current experience:** "Excellent start, Alex." appears even when the learner skipped the first-win sentence.
- **Psychology principle:** feedback must be earned (ai-coach guide: "celebrate demonstrated effort, not assumed performance"). Unearned praise also cheapens earned praise.
- **Proposed change (done):** "Excellent start" only when the first win was spoken (`OB.best>0`). Otherwise: "Welcome, {name}. This is day one of the speaker you're becoming."
- **Expected user benefit:** the praise stays credible.
- **Ethical risk:** none.
- **Mitigation:** not applicable.

### I5 · "Your record" on Progress, as a Premium report (added 29 Sep 2026, owner request)

- **Current experience:** since 28 Sep the learner's record sat closed inside
  "See all details". It holds phrases mastered, clips saved, best streak, days
  practised, consistency and the year grid. The owner asked for it back on the
  page, as part of Premium.
- **Psychology principle:**
  - user investment: the record is the learner's own work, made visible;
  - ethical contrast: what Free keeps and what Premium adds.
- **Proposed change (done):**
  - The block is back under the certificate.
  - Where Premium can be bought (billing on plus an entitlement service), on
    General English, a free learner sees a card instead of the figures. The
    card names the six parts, says the practice "is still counted and kept",
    states what Free keeps (this week, the streak, the sessions, the
    certificate) and has one plans button.
  - With billing off (production today) and on Welding, everyone sees the
    record.
- **Expected user benefit:** the record is visible again, and the Premium
  boundary is stated plainly, not discovered.
- **Ethical risk:** holding a learner's own data behind a payment can read as
  holding it hostage, which is the video's "blurred report" pattern.
- **Mitigation:**
  - Nothing is deleted or stops being counted, and the card says so.
  - No figures are blurred or teased, and there is no countdown or loss
    wording (`tests/mobile-density.mjs` check 13b).
  - The core progress (this week's four numbers, the certificate and its
    milestone) stays free (check 14).
  - Unlocking shows the same record.
- **Owner decision still open:** whether other Progress figures join Premium.
  One option follows the reference: longer history views (30 and 90 days, the
  full year) as the paid layer, with the current period free.

**Strings:**
- 14 new keys in `I18N_EN` and in all 15 `i18n/*.json` files. Key parity was checked: 0 missing and 0 extra in every file.
- French, Spanish, Portuguese and Arabic are translated. The other eleven carry English, per the French-first rule.
- The Arabic count forms ("{{n}} كلمات") need a native speaker's review.

## 4. Proposals not implemented (owner decisions)

These change designs the owner set explicitly, or need a product call. They are
recorded here instead of being built.

| # | Current experience | Principle | Proposed change | Benefit | Ethical risk | Mitigation |
|---|---|---|---|---|---|---|
| P1 | **Home V2 is off in production** (`home_v2_enabled:false`; on only on staging). Production General English learners do not get the ranked next step. | Decision fatigue / next best action | Release Home V2 once the owner is satisfied with staging. | The biggest single lever in this audit; the engine already exists and is tested (48 + 41 checks). | Recommendation errors become visible to everyone. | It is deterministic, evidence-only and has an empty-state fallback. Keep `recommendation_*` analytics watched after release. |
| P2 | Below the Home V2 hero: up to eight "Because you…" rows, ten Explore cards, the install card, the other-programme card and Professional Tracks. That is about 25 further choices under one clear hero. | Decision fatigue | For learners with fewer than ~3 sessions, show at most two rows and put Explore behind "More ways to practise". | New learners see the hero, not a catalogue. | Hiding content could feel restrictive. | Nothing is removed; everything stays one tap away. It is the owner's layout (27–28 Sep), so it needs a yes first. |
| P3 | **Welding Home** before placement shows the placement card, then the install card, then a Career Dashboard containing a profession drop-down, "Career milestone: Not measured yet", a Today's Mission that the gate blocks, and a locked coach card. | Decision fatigue; honest zero states | While the placement gate is open, show the gate alone and fold the dashboard. Replace "Not measured yet" with the engine's own explanation ("Answer one workshop question and this starts reporting what you have shown", already in `adaptive-learning-engine.js`). | One thing to do on day one, and an empty state that says how to fill it. | Low. | Keep the dashboard reachable. Check with the welding-domain lens that nothing trade-specific is lost. |
| P4 | The progress strip after a session opens the road map when tapped; the "Next: …" text is not itself a way in. | Learning momentum | Add a small "Start next" action on the strip (the comeback strip already uses `pathGoNext()`). | Result → next action in one tap. | Could push learners past a natural stopping point. | The strip still auto-dismisses; no auto-start. It is the owner's design, so ask first. |
| P5 | Premium's button reads "Continue with Premium" (billing is off). | Clear commitment language | Name the commitment ("Subscribe — {price}/year", or "Start 7-day free trial, then {price}/year"). | The learner knows it is a purchase. | "Continue" can blur a purchase into the flow, which Apple and Google review. | Change it before billing goes on, with the store listing texts. |
| P6 | Curriculum titles such as "Pronunciation baseline" stay English in a French interface. | Localisation / clarity | Translate curriculum day titles in the track packs (content work, not UI). | French-speaking learners (the main audience) read their position in their language. | None. | Native review. |
| P7 | "Today's practice is done" appears after any practice today, even when the session day is not finished. | Honest progress | Consider "You practised today — finish Monday's session any time" when the day has ticked steps but is not complete. | The label matches the record. | Low; the current wording avoids nagging. | Owner call. |

## 5. The core loop, stage by stage

| Stage | Learner's question | Decision asked | Now | Gap |
|---|---|---|---|---|
| Learn | What is today? | None: the day is chosen | Home hero / session page | Fixed wording (I1) |
| Practise | Which tool? | One recommended of three | "Best tool for your step" | None |
| Speak | Record now? | Tap to record | Session "Record yourself" | None |
| Feedback | How did I do? | None | AI speaking report (five closed folds), coach summary | None |
| Human practice | With whom? | Match me / Practise now | Practice Partner, AI coach always reachable | None |
| Improve | What exactly? | One recommended improvement | Coach summary | None |
| Return | Where was I? | None | Comeback strip, Home hero, reminder | Progress zero state (I2), near milestone (I3) |

## 6. Microcopy audit

| Where | Before | After |
|---|---|---|
| Home hero eyebrow, first session | Continue where you left off | Your first session |
| Home hero button | Continue | Start session / Resume session |
| Welcome lead, first win skipped | Excellent start, {name}. | Welcome, {name}. |
| Progress, nothing done | 0 · 0 · 0 · — | Here is where you start + Start your first session |
| Certificate | 0 of 84 sessions done | + Next milestone: finish Week 1 — 0 of 7 sessions |
| Premium button | Continue with Premium | *(proposal P5)* |

## 7. The ethical test

Each intervention was checked against the brief's question: does it make the
decision clearer, easier, better informed, more useful or more motivating
without pressure, deceit or artificial urgency?

- I1–I4 pass. Each one replaces an inaccurate or empty message with a true one.
- No fake timers, scarcity, activity, progress or discounts were added.
- No dismiss option was reworded to shame.
- No data is withheld behind sign-up.
- No default was added that the learner cannot change.

## 8. Verification

| Suite | Result |
|---|---|
| `tests/ux-psychology.mjs` (new) | 16/16. Hero wording in three states, Progress start panel for General English and Welding, near milestone (0 of 7, 2 of 7), welcome lead with and without a first win, French strings, no JS errors |
| `tests/home-v2.mjs` | 41/41. Check 4 was updated deliberately (it pinned "Continue"); check 32 (online pill on the button's row) passes |
| `tests/smoke.mjs` | 33/33 |
| `tests/premium-acquisition.mjs` | 37/37 |
| `tests/premium-value.mjs` | 78/81. A0, A3 and C5 fail identically on the unchanged base `78b16a83` |
| `tests/home-highlights.mjs` | 28/29. Check 20 fails identically on the unchanged base |
| Inline script parse check | 4 scripts, 0 errors |
| i18n key parity | 15/15 files, 0 missing, 0 extra |

Screens were checked by eye at iPhone 13 size in dark (default) and light, in
English and French.

**Not done:** a physical-device check (the owner's iPhone pass), staging, any deploy.
