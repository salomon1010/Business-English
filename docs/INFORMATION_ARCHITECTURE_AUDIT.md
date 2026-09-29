# Information architecture audit

*29 September 2026 · branch `feature/bemastery-complete-ux-redesign`, on `717e0ae7` · READY FOR REVIEW — DO NOT MERGE OR DEPLOY*

Every screen was checked against four questions:
- **Where am I?**
- **What have I done?**
- **What should I do next?**
- **Why does it matter?**

The audit came before any change. The changes that followed are the small,
low-risk set in §9. Everything else is a proposal for the owner.

## Method
The app was opened in WebKit on an iPhone 13 profile, with all Workers stubbed,
for seven real learner states:
- General English: not placed; placed with nothing done; returning (3 sessions);
  mid-lesson (a step ticked); back after 5 days away;
- Welding: not placed; placed.

For each state, every visible tappable control on each main screen was listed,
with its label, whether it sits above the fold, and whether it is a primary
button. Screenshots were taken of each screen. Code was read for the
recommendation engines, gates, entitlements and flags. The raw inventory is in
the session scratchpad (`ia/inventory.json`, `ia/shots/`).

## 1. Current navigation
- **Bottom bar (≤820px), both areas:** Road map · Shadow · Phrase Lab ·
  Practice · Progress · Profile. On Welding, "Shadow" is the workplace-lines
  practice, not General English's Shadow Studio.
- **Home has no tab.** The only way to Home is the logo; the small "Home" under
  "BE Mastery" is its label. The page that carries the next best action is
  the one screen the bar cannot reach.
- **There is no "Saved" or "Settings" tab.** The brief assumes those (they are
  the reference app's tabs). BE Mastery keeps saved things where they are
  used:
  - words and expressions in Practice;
  - clips and trouble words in Shadow;
  - phrases in Phrase Lab.

  Settings live under Profile.
- **Always reachable:** a full-screen road-map sheet (`rmOpen`), and the
  Practice Partner button (`#ppFab`, General English only).

## 2. Current journeys
| Journey | Path | Assessment |
|---|---|---|
| First run | Onboarding (7 steps, a 60-second first win, no account) → welcome card → Home | Value before commitment already holds |
| Daily session | Home hero → session page (timer, template, record, AI speaking report) → coach summary → progress strip | One primary action each step |
| Curriculum | Road map → week → day | It said where and what next week, but not **today** (fixed, §9 B) |
| Shadow | Library → workspace: Watch → Shadow (record → coach report) → Challenge → Apply it | Progression is explicit, as a mode switch |
| Practice Partner | Consent (18+) → preferences → Match me / Practise now → session → decide → connection or rematch; AI coach always reachable | State-driven |
| Progress | This week → four numbers → calendar → certificate + next milestone → Your record → See all details | The Free/Premium split did not match the owner's decision (fixed, §9 A) |
| Welding first run | Home: the check card → install card → Career Dashboard (profession, destination, "Not measured yet", **today's mission in full**, coach card) | Two decisions at once (fixed, §9 C) |

## 3. Competing choices
Tappable controls per screen (whole page; figures above the fold in brackets):

| Screen | GE new | GE returning | Welding |
|---|---|---|---|
| Home | 25 (8) | 27–28 (8) | 7 (3) |
| Road map | 42 (5) | 42 (5) | 43 (5) |
| Practice | 20 (4) | 22 (4) | 21–22 (4) |
| Shadow | 45 (36) | 45 (36) | — |
| Progress | 35 | 34 | 34–35 |
| Profile | 15 (7) | 15 (7) | 15 (7) |

**Every Home state has exactly one primary action, and it is the right
one:**
- not placed: the one-minute check;
- nothing done: "Start session";
- mid-lesson: "Resume session";
- five days away: "Restart with 5 minutes".

The overload is below the hero, not in it.

### Home, General English, a returning learner: the 27 controls classified
| Class | Controls |
|---|---|
| **A. Primary learning action** | The hero button (1) |
| **B. Recommended supporting** | The "Because you…" rows: the week's clip, Week 1's expressions, the role-play, words due, related clips (≈6–8, from `NudgeEngine.rows`) |
| **C. Secondary exploration** | Explore cards (9): Shadow Studio, Practice Partner, Vocabulary, Phrase Lab, Grammar exercises, Road map, Progress, Practise a real conversation, plus a "Recommended for you" card |
| **D. Rare / advanced** | Add to Home Screen; the other programme (Welding); Professional Tracks |
| **E. Redundant entry points** | The hero's picture carousel (7 controls: one video link + six "Picture n of 6" dots); Explore's Shadow, Phrase Lab, Road map and Progress cards, which repeat the bottom bar; "Phrase Lab · Week 1's expressions", shown twice (two rows) |

## 4. Duplicated entry points
- Explore repeats four bottom-bar tabs.
- The Life Simulations conversation appears on Home (Explore), Practice
  ("Practise a real conversation") and the best-tool card on Thursdays. This
  one is deliberate, by the owner, 2026-09-19.
- The same week's expressions can appear in two Home rows.
- The road map has two entries (tab and header sheet). Both are deliberate.

## 5. Dead ends and failures found
- **Road map crash (fragile, now guarded).** `fndDaysDone()` read
  `Object.keys(fndState().done)`. A Foundations record without its `done` map
  made the whole Road map "could not be drawn". The app itself always writes
  `done:{}`, so real learners were not seen hitting this. But one missing
  field took down a whole tab, and test seeds do write that shape. Guarded
  (§9 D).
- **Welding, before placement:** a full "Today's mission" card that cannot be
  started (fixed, §9 C).
- **No dead-end screens found** in the flows audited. Every page has the bar,
  and every sheet has a close.

## 6. Unclear labels
- **The Welding Career Dashboard is English-only:** "Career Dashboard",
  "Current profession", "Today's mission · 25 minutes", "Why it matters",
  "Career Center", the coach lines. The main audience reads French. This is
  not changed here; it is a larger translation job.
- **The coach summary is English-only:** the "Recommended improvement" line
  ("Focus next on clarity.") is built in English in `learning-coach.js`.
- **Curriculum titles** ("Pronunciation baseline") stay English in every
  language (content, known).
- **The "Home" label under the logo** reads like a page title, not a button.

## 7. Unnecessary decisions
- **Welding before placement:** profession, destination, the check, and an
  unstartable mission, all at once (fixed in part, §9 C; the profession and
  destination pickers stay, since they are real settings).
- **Practice** asks "which tool" and then lists the whole Vocabulary & Grammar
  library below. The best-tool card already recommends one, so the page
  answers its own question, then asks it again.

## 8. The recommendation logic that already exists
Nothing new was invented. The engines:
- **`NudgeEngine.rank(nudgeSignals())`** (`nudge-engine.js`): the one ranking
  behind Home V2's hero, its rows (`rows()`) and the push nudges. It reads
  real signals:
  - curriculum position;
  - inactivity;
  - words due;
  - failed Challenge clips;
  - trouble words;
  - partner waiting or streak;
  - saved clips;
  - verified watching.

  It is deterministic, and it is General English only.
- **Gates before the engine** (`homeGateCard`): the placement check and the
  Foundations day.
- **The curriculum pointer:** `currentPos()` / `pathSummary()` / `rmSteps()`,
  shared by Home, the Road map, the progress strip and the reminder.
- **`pathToolPick()`:** Practice's "best tool for your step".
- **`LearningCoach.mission` / `summary` / `present`:** the coach summary
  after an activity.
- **`AdaptiveLearningEngine`:** Welding readiness, milestone and heat map.
- **Premium:** `planOn()` (billing on + an entitlement service; off in
  production), `premOffered()` (General English only), `entIsPremiumForDisplay()`.
- **Flags:**
  - `home_v2_enabled`: **off in production**; production General English
    Home is the programme card;
  - Practice Partner: on;
  - Shadow V2 / Challenge: on;
  - `billing_enabled`: off.
- **Analytics:** Home V2 reports `recommendation_*` events. This phase adds
  none; the Worker allow-list would drop them.

## 9. Changes made (low risk, existing architecture, tested)
- **A. Progress: Free/Premium aligned with the owner's decision.**
  - Free: this week, sessions, current and best streak, the certificate, and
    what the learner has now (phrases mastered, clips saved).
  - Premium: the history (days practised over time, consistency, the full
    year grid).
  - 717e0ae7 had gated best streak and the two counts too. The Premium card
    now names only the history and promises nothing unbuilt. There are no
    30- or 90-day views in the app, so none are named.
  - No change while billing is off, as in production, or on Welding.
- **B. Learn: "Today" on the Road map.** One row under the header: today's
  step and one button (`rmTodayHTML`), from the state Home reads:
  - the placement check;
  - else the Foundations day;
  - else the curriculum day, worded "Start session" / "Resume session";
  - nothing when the programme is finished or the day is locked.

  The same row appears in the map sheet, where its button closes the sheet.
- **C. Welding before placement.** While the check (or Foundations) gates the
  programme, today's mission, its coach card and its button give way to one
  line: "Your first mission appears after the one-minute check above." (or
  "…when Foundations is finished"). "Not measured yet" now carries the
  engine's own sentence on how it gets measured. The profession and
  destination pickers are unchanged.
- **D. A guard:** `fndDaysDone()` tolerates a missing `done` map.
- **E. Empty state:** an empty Shadow library group now says "No videos in
  this group yet. Pick another group, or paste any YouTube link." (was
  "Nothing here yet.").
- **F. Right-to-left arrows:** the arrows drawn in markup on the new buttons,
  and on Home's hero button, now mirror in Arabic and Urdu (`.go-arrow`,
  `.hx-cta-go`). Arrows inside translated strings were already right.

## 10. Proposals not implemented (owner decisions)
1. **Give Home a tab.** Either replace "Phrase Lab" (also reachable from
   Practice, Home and the session) or turn "Road map" into "Home" with the
   map a tap inside it.
   - Consequence: the six-tab bar stays six tabs. Phrase Lab becomes one tap
     deeper.
   - Without it, the next-best-action page is reachable only by the logo.
2. **Release Home V2 to production** (`home_v2_enabled`). Production General
   English Home is still the programme card. The ranked hero and rows exist
   only on staging.
3. **Home below the hero, for learners with fewer than ~3 sessions:**
   - hero (A);
   - at most two rows (B);
   - Explore behind "More ways to practise" (C).

   For everyone:
   - drop Explore's four bar-duplicate cards (E);
   - move Add to Home Screen, the other programme and Professional Tracks into
     one "More" row (D).
   - This changes the owner's 27–28 Sep layout, so it needs a yes.
4. **Practice by intent.** Group the page as Speak · Shadow · With the AI ·
   With a partner · Review. Show the Vocabulary & Grammar library once, under
   Review, instead of after the best-tool card.
5. **The coach summary:** Improve → Try it → Practise.
   - Improve: one line, as now, translated.
   - Try it: the report's own "better version" of what the learner said.
     That is real feedback data, but the modal is not given it today.
   - Practise: the existing button.
6. **Translate the Welding Career Dashboard and the coach lines.** French
   first.
7. **Partner:** keep as is. The primary action already follows server state.
   A signed-out learner sees only "Create my free account", which is needed
   (18+ consent, safety), not friction.
8. **Welding sequence:** check → result → confirm the trade → first mission.
   The first two steps exist and the third is the dashboard's picker. What is
   missing is a "confirm the trade" moment after the result. The trade is
   chosen in onboarding, so this needs a product call on whether to ask
   twice.

## 11. Empty, loading and error states
- **Empty states:** 87 strings describe an empty state. Almost all say why
  the space is empty and what to do, e.g. "No past sessions yet — finish a
  conversation and it will appear here."
  - One bare one was fixed (§9 E).
  - Short titles that pair with a sub-line were left.
  - Still bare: "No idioms available", "No questions available yet.", "No
    recordings yet for this item.". Each is shown where the missing content is
    the app's, not the learner's.
- **Errors:** no technical detail reaches learners in the flows checked.
  - Practice Partner errors map to translated messages (`pp.err_*`, fallback
    `pp.err_generic`).
  - `e.message` reaches the screen only in the hidden maker-only GitHub sync
    and in staging-only test tools.
  - The one string containing "127.0.0.1" (`sh.line_blocked`) is never
    shown: no code uses it.
- **Loading:**
  - AI waits use the design system's AI state (`DS.aiInline`).
  - The Road map, Home and Progress render from local state, so they have no
    loading phase.
  - A page that throws shows "This page could not be drawn." with Try again,
    so it is never blank.

## 12. Screens reviewed
- **Both areas:** Home, the Road map (Learn), Practice, Progress, Profile /
  Settings.
- **General English:** Phrase Lab, Shadow (library, and the workspace modes by
  code), Practice Partner (signed-out start; states by code), Life
  Simulations.
- **Welding:** Home before and after placement, and Foundations.
- **Also:** the onboarding and welcome states (previous phases), the coach
  summary (by code), the Premium card.

## 13. Track boundary
Nothing General-English-only was added to Welding. `tests/ia-nba.mjs` check
14 opens every Welding tab with the General English Home V2 flag on and finds
none of the following:
- a Home V2 hero;
- the online pill;
- the partner button;
- Practice Partner text.
