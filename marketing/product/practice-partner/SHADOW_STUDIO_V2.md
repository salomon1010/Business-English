# Shadow Studio V2 — synchronised transcript (as built, 2026-09-18)

"BE Mastery teaches you what to say. **Shadow Studio helps you say it.**"

General English only, behind `shadow_studio_v2_enabled` (off in production).
The classic Shadow Studio — player, clip marks, transcript box, recorder,
word-by-word feedback — is untouched underneath; V2 is a panel (`#shV2`)
added to the `.sh-work` workspace after the clip controls.

## Engine — `shadow-sync.js`
A dependency-free UMD module (works in the browser and in Node tests).

| Function | Does |
|---|---|
| `normalizeCaptions(cap, clipStartS, clipEndS)` | `captions/<vid>.json` `{cues:[{t,txt}], words?:[{t,w}]}` → `{level, segments:[{id, text, startMs, endMs, words?:[{text,startMs,endMs}]}]}`. Segment end = next cue start (last gets a short tail). Words are assigned to the cue they fall in. Segments outside the clip marks are dropped. `level` = `word` when every kept segment has words, else `sentence`. |
| `normalizeText(txt)` | Pasted transcript → untimed sentences, `level: "text"`. Empty → `level: "none"`. |
| `locate(asset, tMs, {graceMs})` | Binary search → `{seg, word}` (−1 when nothing is lit). A grace window keeps the last sentence/word lit briefly after its end. Stateless, so seeking backwards needs no hint. |
| `neighbour(asset, i, dir)` | Previous / next segment, clamped. |
| `levelOf(asset)` | The level string. |

Highlight levels degrade honestly: **word → sentence → text → none**. The
panel says which one it has (`sv.level_word` / `sv.level_sentence` /
`sv.level_text`) and never pretends to word timing it does not have.

## Caption assets
`captions/<vid>.json` for the curated library clips (18 files; 13 carry
`words` from YouTube json3 tracks, 5 are cue-only). `loadCaptions(vid)` fetches
the bundled file. `shadow_word_timing_enabled` (on by default) can force a
word-level asset down to sentence level.

## Panel — `shV2Load()` at the end of `shLoad()`
- Builds the asset: bundled captions first, else the transcript box, else the
  "no transcript" note (`sv.none`).
- **Modes** (`svSetMode`): `watch` (highlight only) · `shadow` (adds "Shadow
  this sentence", which sets the clip marks to the sentence, fills the
  transcript box if empty and opens the recorder) · `challenge` (text hidden
  until "Reveal"; listen and say it before you look) · `apply` (behind
  `shadow_apply_phrase_enabled`; see below).
- **Controls**: previous / repeat (loops the sentence by seeking back at its
  end) / next; tap a sentence to seek there and play.
- **Render loop** `svTick` on `requestAnimationFrame` only while the workspace
  is open and the asset is timed. Reads `shCurT()` (player time, or the last
  `shSeek` when the player is not ready). Class changes only on an index
  change; auto-scroll only on a sentence change and never within 3 s of the
  learner scrolling. `svStop()` from `shCloseWork()`.
- Record / replay / re-record use the existing recorder (`shRec`) against the
  sentence's clip marks.

## Apply It → AI or a human
`svApplyHTML()` shows the picked (or current) sentence with two buttons:
- **Practise with AI** → `S.applyPhrase = {text, vid, ts}`, closes the
  workspace, opens `roleplay`.
- **Use with a partner** (only when `practice_partner_enabled`) →
  `ppState().applyPhrase = {text ≤ 160, vid, ts}`, opens `partner`. The next
  session's round-1 and round-2 prompts (`pp.r1_phrase`, `pp.r2_phrase`)
  carry the phrase; the Worker stores it in `pairs.prompt_json` so the partner
  gets the same task. "Use the lesson task instead" clears it.

## Analytics (allow-listed in `be-events`, not deployed)
`shadow_v2_opened {level}` · `shadow_v2_mode {mode}` ·
`shadow_v2_challenge_started {mode}` · `shadow_v2_sentence_shadowed {level}` ·
`shadow_apply_phrase {to: ai|partner}`.

## Strings
`sv.*` (16 keys) in `I18N_EN` and all 15 `i18n/*.json`.

## Tests
`tests/shadow-sync.test.mjs` (27, pure; includes malformed caption files) and the Shadow V2 block of
`tests/partner.mjs` (word-level asset, four modes, highlight follows time,
Challenge hides text, Apply It hands the phrase to Practice Partner and it
appears in round 1). Real-device timing (iOS Safari, Android Chrome) is in
the manual checklist in TEST_PLAN.md and has **not** been performed.

## Challenge (2026-09-19, branch `feature/shadow-challenge`, not merged)
The Challenge tab used to blur the transcript and stop. It is now the step from
imitation to production: **imitate → retrieve → produce → one correction →
again → use the expression.** General English only, behind
`shadow_challenge_enabled` (off in production; on for the staging host through
`FLAGS_STAGING`), and `svChOn()` is checked at every entry point, not only when
the tab is drawn — on Welding the functions are no-ops and no state is written.

**Loop** (one line of the clip, the sentence picked in Watch/Shadow or the
current one): Listen → Record (tap / tap to stop; `phRecInto`, ctx
`shadow-ch-<vid>-<seg>`) → grade → **GOOD** + **IMPROVE** (exactly one each,
labelled AI) → Try again / Play my attempt / Next sentence → on a pass,
"Use it yourself" when the line carries a curriculum phrase
(`ShadowSync.findExpression(text, trackPhrases())`): one own sentence, graded
only on whether the expression was used (`usedExpression`) — no chat.

**Levels** (`aMap("svCh")._level`, default Recall): *Guided* shows the line
until recording starts; *Recall* hides it, Listen allowed; *Independent* hides
it and allows no replay before the first attempt (prompt = the expression, or
the first word).

**Grading** reuses the Polish Worker calls the app already makes:
`fbWords` (Whisper text + word times; `fbTranscribe` if no times) and
`fbAssess` (AI per-word scores). `ShadowSync.challenge(target, heard, {words,
assess, targetMs})` is pure and returns i18n keys: coverage (target words
said, pass ≥ 0.8), missing / substituted / swapped words, extra words,
fillers, pauses ≥ 0.55 s (→ "Connect ‘get back to’ more smoothly"), pace vs
the clip segment, weakest AI-scored word (< 60) with its note. Priority:
production first (nothing heard → order → missing → wrong), then pauses,
pronunciation, pace, fillers, extras; GOOD never names the dimension IMPROVE
is about. No signal → the rule is skipped; nothing is scored locally.
Offline / Worker down → an explicit network state with "Retry feedback" on
the saved take; microphone refused → a mic message; too short → say the
whole line. A second tap while acquiring the microphone or while grading is
ignored (`busy` / `grading`), so a double-tap cannot submit twice.

**State** `svCh = {seg, level, phase: ready|recording|grading|feedback|done|
error, attempt, fb, heard, err: mic|short|net|ai, busy, blob, use}`;
completion per area in `aMap("svCh")[vid+":"+segId] = {best, n, level, ts,
done}`. Takes are filed in the local recordings store like every other take
(same retention as the Shadow recorder); the Worker receives audio for the
grade exactly as `fbAssess` already does for Foundations and the phrases.

**Events** (allow-listed in `backend/events/events-worker.js` on the branch —
**the Worker must be deployed before the flag goes on**, otherwise dropped with
204): `shadow_challenge_opened` (the tab) · `shadow_challenge_started {level}` ·
`shadow_challenge_recorded {level}` · `shadow_challenge_feedback_received
{level, result: pass|retry}` (every graded take) · `shadow_challenge_completed
{level}` (a pass only) · `shadow_challenge_retry {level}` ·
`shadow_challenge_apply_it {result: used|missed}`.

**Strings** `sv.ch_*` (59 keys) + `sv.cur_expr`, `sv.ch_last_words` in
`I18N_EN` and all 15 files (machine transcreation — native review
recommended, fr first).

## V2.1 — the player as a learning player (2026-09-19, branch `feature/shadow-studio-v21`, not merged)
Built on the Challenge branch after merging `main` (be12-v358). What changed:

- **Transcript by mode**, enforced in `svTxHiddenNow()`: Watch / Shadow
  visible and synchronised; Challenge collapsed (`display:none`, no longer a
  blurred block that pushed the microphone 1,100 px down a phone) while the
  learner should be recalling — ready / recording / grading at Recall and
  Independent, recording and grading at Guided — and **visible again with the
  target line outlined** at feedback, pass and error. "Show transcript" is the
  escape hatch and shows it un-blurred; the control reads Show / Hide to match
  the real state and is secondary, so Record stays the one accent.
- **"Your turn" sits directly under the mode tabs** in Challenge, so on a
  390×844 phone Record is at ~360 px — inside the first screen, no scrolling.
- **Current expression chip** (`svExprText()` / `svExprDraw()`): in every
  mode, when the picked or currently spoken line carries a curriculum phrase,
  a one-line "CURRENT EXPRESSION · get back to you" appears under the tabs.
  `svTick` updates one text node when the sentence changes — no re-render.
- **Progress between attempts**: the ready state after Try again reads
  "Attempt 2 · last time 6 of 8 words" (`fb.ok` / `fb.total`, the same count
  the pass rule uses — not a score).
- **Desktop**: the player stops at 44 vh, centred (`.sh-work .yt-shell` at
  ≥ 900 px), so video + transport + modes + "Your turn" fit a 1280×800 laptop.
- **Safe area**: `.sh-work-body` pads the bottom by
  `env(safe-area-inset-bottom)`.
- **Practice Partner floating button**: unchanged, and verified to sit under
  the full-screen workspace (z 120 < 130) and clear the bottom nav on the
  picker page — covered, never overlapping the mic or transcript.
- **Events**: `shadow_challenge_opened` and `shadow_challenge_feedback_received`
  added (see above); `completed` now means a pass.
- **Tests**: `tests/shadow-challenge.mjs` 36 → 44 (panel-before-transcript and
  mic in the first screen, transcript back at feedback with the line marked,
  progress line, expression chip, the seven events, Welding by direct state
  manipulation — `svMode`/`svAsset` forced by hand still draw nothing —
  floating button under the workspace). Not run on a real phone.

**Tests** `tests/shadow-sync.test.mjs` (+19: every rule and its priority,
expression detection) and `tests/shadow-challenge.mjs` (36, headless Chromium
390×844, fake microphone, the Polish Worker answered by a route: Watch and
Shadow unchanged, start, transcript hidden, levels, recording state, feedback,
retry, completion, per-area record, next sentence, double-tap guard, offline
→ retry, Worker unreachable, pasted transcript, Use it yourself used/missed,
Apply It untouched, microphone refused, Welding no-op, i18n parity, phone fit,
no JS errors). Not yet done on real phones (iOS Safari, Android Chrome).

**Known gap (pre-existing, untouched):** `svApplyAI` writes `S.applyPhrase`
but the role-play never reads it, so Apply It → AI opens a plain role-play.

## Translate + Pronunciation on the Shadow card (2026-09-23, branch `feature/shadow-translate-ipa`, not merged)

Two compact switches at the foot of the "Original transcript" card, both OFF
by default, the English always the primary text. General English only —
everything runs behind `svOn()`; Welding never renders the card, never
fetches, never writes the preference.

- **Native language = `S.profile.lang`** (the onboarding answer "What's your
  native language?"). Reused as is; no second setting. `svShLang()` adds
  `ok` (not English and known in `LANGS`) and `rtl`.
- **Preference:** `aMap("svPref")` = `{tr, ipa}` per area, in S (refresh-
  and merge-safe). Welding's bucket is never created.
- **Translate:** `svShTrFetch` → Polish Worker `chat` route (`{"reply"}`),
  cached in `localStorage.be_sv_tr` ≤200 keyed `vid:paragraph:lang`, one
  request in flight per key. Block `#svShTr`: the language named above the
  text, `lang` + `dir` (RTL for ar/ur/fa/he), `aria-live`, wait / error
  (Try again) states; 429 says "too many requests". App in English → the switch
  is `aria-disabled` and a tap explains (`sv.sh_tr_none`).
- **Pronunciation:** General American IPA under each word chip. Per-WORD cache
  `localStorage.be_sv_ipa` ≤3000 + `SV_IPA_SEED` (~200 common words). Only
  the unknown words of the paragraph are requested, ≤25 per call
  (`SV_IPA_BATCH`), the sentence as context, `svIpaParse` validates every
  `word=ipa` pair. Status line `#svShIpaSt` (wait / error / the honest note:
  AI-written, a guide). IPA spans are `aria-hidden`. A word tap plays the word
  (existing `fbSay`) and, with the switch off, peeks that word's IPA.
- **Server side:** unchanged. The Polish Worker is stateless (origin
  allow-list + IP rate limit, no identity, no track), so there is no track
  claim to authorise; the be-partner Worker (which does authorise tracks) is
  untouched.
- **Analytics** (be-events allow-list on the branch, NOT deployed):
  `shadow_translation_toggled` (+state on|off, +lang), `shadow_pronunciation_toggled`
  (+state), `shadow_word_played`, `shadow_translation_viewed` (+lang, once
  per paragraph per session).
- **Strings:** `sv.sh_ipa_btn/_wait/_err/_note`, `sv.sh_tr_none/_a11y`,
  `sv.sh_helpers`, `sv.sh_busy`, `sh.report_fold/_unfold` — in all 15
  files, translated for fr/es/pt/ar, English elsewhere.
- **Tests:** `tests/shadow-helpers.mjs` (28 checks: defaults, toggles, cache
  reuse, per-word IPA correspondence, tap + peek, next paragraph, Worker down /
  429 / offline, away-and-back, refresh, the v3 Shadow button while recording,
  the report fold, Watch sync, same-account track switch, a Welding learner, an
  English-app learner, Spanish and Arabic targets, no JS errors).
- **Also on the branch (owner, 23 Sep 2026):** the v3 foot-bar Shadow button
  is red / "Stop" exactly while the recorder runs (`shv3RecSync`); the
  report under "Analyze my last shadowing recording" folds (`#fbFold`).
- **Follow-ups (2026-09-23, be12-v439):** homographs (`SV_IPA_HOMOGRAPHS`) are
  cached per `word@video:paragraph`, so each paragraph shows the reading the
  model gave for its own sentence; Watch carries the same two switches above
  the list and applies them to the paragraph being spoken only
  (`svWatchDraw`), moving with the speech; the helpers pace themselves to 10
  chat calls a rolling minute and retry a 429 once after 20 s before showing
  the busy message; the help centre has a tip after the Shadow figure in all
  15 manuals; `backend/events/` carries the 20-blob row-layout fix, with
  `state` + `lang` added to the shadow_* column map.
- **Known limits:** IPA is still written by the model (gpt-4o-mini via the
  chat route) — good for common words, not a dictionary; a real lexicon would
  need a Worker-side dictionary, which is a separate decision.
