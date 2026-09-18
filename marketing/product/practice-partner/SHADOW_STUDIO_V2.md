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
`tests/shadow-sync.test.mjs` (23, pure) and the Shadow V2 block of
`tests/partner.mjs` (word-level asset, four modes, highlight follows time,
Challenge hides text, Apply It hands the phrase to Practice Partner and it
appears in round 1). Real-device timing (iOS Safari, Android Chrome) is in
the manual checklist in TEST_PLAN.md and has **not** been performed.
