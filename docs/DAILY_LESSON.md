# The guided daily lesson (Week 1 Monday pilot)

General English only, behind `daily_learning_plan_pilot_enabled`, Week 1 Monday only
(`dlpOn(w, d)`). Every other day and Welding entirely keep the session page they have.
Engine: `daily-learning-plan.js` (pure, unit-tested). Screens: the `dlp*` block in
`index.html`. The lesson renders into `#v-journey` through `rSession` → `rGuidedLesson`.

## The seven steps

`DailyPlan.STEPS = try · learn · listen · rehearse · converse · improve · finish`

| # | Step | What the learner does | How it is evaluated |
|---|------|----------------------|---------------------|
| 1 | try | One baseline minute, big mic, live words | The Executive Polish speaking report (`sessReport`) |
| 2 | learn | Five sentences written for **them**, mastered one at a time | The **Foundations report** (`fndAlign` ≥ `FND_PASS`) |
| 3 | listen | Shadow the week's two curriculum passages in the studio | The **Foundations report**, plus the speaker's pace against theirs |
| 4 | rehearse | Five sentences from their **working day**, mastered one at a time | The **Foundations report** — the same page as step 2 |
| 5 | converse | A spoken **conversation** with an AI partner, three talking points | The role-play engine + the speaking report |
| 6 | improve | Pronunciation focus | — |
| 7 | finish | Before/after on the day's own numbers | `DailyPlan.compareAttempts` — costs nothing |

`DailyPlan.evaluationPlan({account, premium})` decides which steps may buy an AI verdict.
**The free allowance is sized to exactly one complete day** (owner, 7 Nov 2026): baseline,
conversation and the closing report = 3, against `VERDICTS_FREE_PER_DAY` = 3. Guarded by
`tests/lesson-allowance.test.mjs`, which reads the cap out of `backend/polish-worker.js`
so the two can never drift.

## One report, three homes

The Foundations day report — percentage, *What you said*, *The sentence*, *Words to fix*
with IPA + respelling + a tip in the learner's own language, and *Practise this word* —
is the evaluation the owner asked for in step 2 and again in step 3 ("exactly the same
thing, don't change anything"). It is **not copied**. A HOST says where a report draws and
what its buttons do:

```
_fndHost[key] = { sentence, boxId, lang, again, recheck, drill(w), wordCtx(w), evidence }
```

Foundations is the DEFAULT host, resolved from a `"<day>-<i>"` key exactly as before.
Step 2 registers `dlp:learn:<i>`, step 3 registers `dlp:shadow:<ix>:<from>`. The renderer
(`fndDrawScoreKey`), the word drill (`fndDrillKey`) and the tips (`fndTipsLoadKey`) are
shared, so a change to the report reaches all three at once.

A report is held in memory (`_fndRep`), but the transcript is saved. After a reload — or
after walking back from a later step — the report is **rebuilt** with `fndAlign(target,
heard)`, which is pure. Nothing is re-transcribed and nothing is invented.

## Step 3 — the shadows

The passages come from `tracks/general/clip-index.json` (`dlpPassages(w, 2)`), built
offline and matched with the same `ShadowSync.findExpression` the Challenge uses.

Shadowing happens **where the video is**, so the lesson goes with the learner:

1. *Watch & shadow it* → `dlpShadowGo` arms a stage (`_dlpSh = {w, d, ix, total, vid, para}`)
   and opens the Shadow workspace on that passage.
2. In the workspace a lesson card (`#dlpShCard`, `data-sv-keep="1"`, right under the
   paragraph) carries the target, the report and exactly one next action. It is hidden for
   everybody else: `dlpShLive()` requires an armed stage, Shadow mode and the lesson's own
   clip.
3. The learner records with the studio's **own** foot-bar button. The transcript arrives
   through `fbRecStart`'s `onDone` seam — the one the V2 missions already use — so there is
   no second recorder, no second transcription, and the studio's own coach panel does not
   draw beside the lesson's report.
4. The report is the Foundations report on the paragraph on screen, plus two measured
   lines: the speaker's words-a-minute and the learner's. "Matched" means within a tenth of
   the speaker's pace (never under 10 a minute), so 99 against 115 reads as *slower*.
5. **One highlighted button.** After the first passage: *Go to shadow 2 of 2*
   (`dlpShNext`). After the last: *Go to the next step* (`dlpShFinish` → `shCloseWork` →
   `setStep("listen")` → the lesson at REHEARSE).
6. **A skip, but only once one real shadow is behind them** (owner, 7 Nov 2026). *Skip the
   second one and move on* (`dlpShSkip`) appears under the primary, in the studio and on the
   step card, and only when `dlpShMaySkip` — at least one passage shadowed, at least one still
   open. A skipped passage is recorded as `{skipped:true}`, never as shadowed: `dlpShHasRec`
   excludes it, `dlpShSettled` includes it, and the step says "You shadowed one of the two."

### The shadowing coach

Owner, 7 Nov 2026: *"generally people are just shadowing, they don't know exactly how to do."*
So the step teaches the method and then coaches the attempt against it.

**The method** (`dlpShMethodHTML`, keys `dlp.how_*`) is written content, identical for every
learner and on every plan — the established shadowing method, in four parts: before you record,
while you shadow, when you stop, one thing per pass. It is open on the step card until the first
shadow is done, and open again in the studio whenever a take came in under the bar. A model is
never asked to invent the method; it is asked which part of it this attempt needs.

**The spoken coach** (`dlpShCoachHTML` / `dlpShCoach`, keys `dlp.cch_*`) reads the script aloud
line by line through `fbSayLine`, highlighting each line, with its own Play/Stop. The script is:

1. the score, opening with the learner's name;
2. which words were skipped, and which came out as something else — from the alignment;
3. the attempt number, if this is a repeat;
4. the one step of the method this attempt needs (under 55% → read it aloud first; too fast →
   stay half a word behind; too slow → drop to 0.75; words missing → drill them; otherwise →
   eyes off the text);
5. one thing per pass;
6. what this buys **them** — their job and the situation they named.

`DailyPlan.evaluationPlan().shadowCoach` says whether a model rewrites that script
(`dlpShAdvice`, `chat` purpose `coach` → the `ai_coach` cap). It is `"ai"` on Premium and
`"device"` on Free, because a free day is already sized to the free cap of 3 — **the coach itself
is never withheld**, only the model's pass over it. The AI reply is JSON (`{read, tips[]}`),
length-capped, fenced JSON tolerated, and the whole thing dropped on anything malformed; the
assembled script stands in. It is stored on the record, so it is not re-bought on a redraw.

### When the day's credit runs out

Owner, 7 Nov 2026: *"it can work, but no AI report."* The shadow is deliberately the cheapest
step in the lesson — transcription and the word tips are unmetered — so running out of verdicts
on steps 1 and 5 does not close it:

- the learner still records, and the take **plays straight back** (`dlpShPlayMine`, matched to the
  report by timestamp so shadow 1 never plays shadow 2's take) beside **Hear the speaker**. The
  audio is on the device: no account, no network, no allowance;
- the word-by-word report still appears — it is their own recording, aligned on the device;
- the coach still speaks, from the assembled script;
- the next shadow and the next step are still there.

What stops is the model's pass over the coaching, and the app's **one gate card**
(`premLockHTML("ai_coach")`, via `dlpShAllowHTML`) says so: "Today's AI verdicts are used up …
yours come back at 01:10 … Premium gives 120 a day", the Unlock Premium button, and
"Your shadow still counts … only the AI coaching is paused." No second notice is written here,
so the wording and its 15 translations stay the ones every other spent-credit screen uses.
`dlpShCoachAi()` also checks `aiAllowOut()`, so a learner with no credit never spends a request
to be told they have none.

### Nothing reads as generic

Owner, 7 Nov 2026: every report must name the learner and speak to their job. `dlpProfileLine()`
is one English sentence — name, profession, where they speak English, what they want to fix —
plus two instructions: use their name, and say what sharper English lets *that* job do at work.
It rides in the speaking report's `task` field (steps 1, 5 and the closing verdict), which the
Worker caps at 300 characters, so `dlpFitTask` drops whole sentences off the end of the persona
rather than truncating mid-instruction. The shadowing coach gets the same through
`dlpProfileBrief(true)` in its system prompt, and the assembled script closes on it without any
model at all.

**Two label helpers, on purpose.** `dlpProfileLabel` / `dlpSituationLabel` return the catalogue's
ENGLISH label, because they feed prompt text. `dlpRoleLoc` / `dlpSitLoc` prefer the translated
key and are what the learner reads — otherwise a French learner is told they are a "Welder" who
speaks English in "Presentations".

Rules that keep it honest:

- **The recording finishes a shadow; the report is feedback.** A failed transcription never
  holds the learner at step 3 — the same offline-first rule Foundations uses.
- Repeating a shadow is encouraged and never counts twice (`n` rises, `done` does not).
- The paragraph is **pinned at Stop** (`_dlpSh.pend`), so stepping to the next paragraph
  while Whisper is still running cannot have the take graded against words nobody said.
- Step 3's Continue stays disabled until every passage has been shadowed once.
- Only one passage button is accented at a time: the next one still to do.

## Steps 2 and 4 are one page

Owner, 8 Nov 2026: *"I don't want this kind of page any more. I want complete sentences."* Step 4
used to list the week's bare patterns with a recorder beside each. It is now
`dlpSentPageHTML(step, …)` — the same exercise as step 2, with `step` the LAST argument
everywhere and defaulting to `"learn"`, so every older call site keeps its meaning. Step 2 keeps
its element ids; step 4 has its own, and its own report keys (`dlp:rehearse:<i>`).

Only the content differs (`DLP_SENT_ANGLE`): step 2 introduces the learner; step 4 is a real
moment in their working day. Both prompts receive every sentence already seen in **either** step,
so nothing is handed back twice. "Another version" is available from the start (three times), and
round 3 differs from round 2 in both steps. Neither step buys a verdict: the AI writes the
sentences (content, unmetered), the device grades them.

When the sentences came from the device, the page now says **why** — on a phone the real reason is
usually that nobody is signed in, and `aiOffNote()` says so with a Sign in button.

## Step 5 — the conversation

Owner, 8 Nov 2026: the day ends in a spoken conversation, shaped like Life Simulations.

The role-play engine is not rebuilt: `rpStart` / `rpUserTurn` / `rpSummary` / `rpReport` already do
the conversation, the talking-point judging, the summary and the speaking report. What step 5 adds
is a **scenario built from the lesson** (`dlpScenarioBuild`), handed to that engine by id:

- `dlpDayBrief()` gives the writer the whole day — the objective, the expressions, what the
  learner said in step 1, and the sentences they practised in steps 2 and 4;
- it returns a persona, a role in the learner's own working world, a scenario, **three talking
  points** and a first line that **greets the learner by name** (enforced after the fact, so a
  model that forgets cannot drop it);
- `dlpRpBrief()` goes into the conversation's system prompt: the learner's name, with an explicit
  instruction to use it, and their job and situation;
- `rpById` resolves `dlp-lesson` to it. It is never in the catalogue — it belongs to one day.
- The partner is **drawn, not photographed**: `dlpOrbHTML` (`rpAvatar` branches on `sc.ai`), a
  core that breathes and two rings that travel out, still under `prefers-reduced-motion`.

**The talking points are the gate.** `dlpConverseDone` is called by `rpSummary` the moment the
conversation ends; Continue opens only when all three are covered, judged by the engine's own
strict rule (`ConversationOrchestrator.creditable`), never by the model's claim alone. A second,
worse run cannot take away a point already earned. What the learner said is measured for the
day's before/after — words, expressions, hesitation — but **pace is not claimed**, because a
conversation turn carries no duration.

Step 6 reads that conversation and opens its speaking report, rather than a single take into
`recCtx("dlp-converse")` that no longer exists.

## Walking back

Owner, 7 Nov 2026: from step 3 you can look at step 2 and step 1 again.

- `entry.reached` is the furthest step the learner GOT to; `entry.step` is where they are
  looking. `DailyPlan.setStep` maintains the mark, `DailyPlan.reached(entry)` reads it (an
  entry written before this reads its open step as the mark), and `DailyPlan.goStep` moves
  the view and **refuses any step past the mark**, so a look back can never hand out a
  later step.
- On screen: each finished dot is a button (its 44px tap area is drawn inside the dots row,
  never over the title or Back), a named Previous/Next pair sits above the card, and a
  strip says plainly that this is a look back with one button back to their place.
- Step 1 revisited re-mounts its stored Executive Polish report (`dlpSessCur` +
  `sessRepMount`); step 2 and step 3 rebuild theirs from the kept transcript.

## Tests

| Suite | What it holds |
|-------|---------------|
| `tests/lesson-evaluation.test.mjs` (25) | who may spend a verdict, the measurements, the before/after, the step history |
| `tests/lesson-allowance.test.mjs` (18) | the free day costs exactly the free cap |
| `tests/learn-mastery.mjs` (36) | step 2: the 80% gate, locking, polish rounds, the shared report |
| `tests/lesson-converse.mjs` (21) | step 5: the scenario built from the day, the name in the greeting and the prompt, the AI figure, the gate, the measurement |
| `tests/rehearse-sentences.mjs` (17) | step 4: complete sentences, its own keys, three rewrites |
| `tests/lesson-shadow.mjs` (72) | step 3 and the navigation: the armed stage, the shared report, the pace lines, the coach script, the method, the skip, playback, the spent-credit card, the two buttons, the gate, the pinned paragraph, the dots' tap area |
| `tests/curriculum-clips.mjs` (32) | the clip index is real and matched |
