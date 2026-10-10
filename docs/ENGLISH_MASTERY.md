# English Mastery — the General English game hub

Built 10 Oct 2026 on branch `feature/english-mastery`, from the Welding Mastery hub
(`docs/WELDING_MASTERY.md`). **General English only.** The flag is `english_mastery_enabled`:
ON on staging, OFF in production.

## Where it sits

- **View:** `go("english", tab)` → `#v-english`, drawn by `EMUI.render`. The Practice tab is lit.
  The tabs are Home, Games, Journey, Collection, Rewards, History and Performance.
- **Practice page:** a portal card sits above the Knowledge Boosters (`EMUI.portalHTML()`). The
  boosters themselves (flashcards, quiz, crossword and the conversation booster over the
  learner's saved words) are unchanged.
- **Home:** an Explore tile (`english`). The recommendations come through `homeSignals().wm`,
  filled by `EMUI.signals()` with `view: "english"`. The nudge engine now reads the view and
  activity from the signals, and they default to Welding's.
- **Progress:** English Mastery's Game Performance card (`EMUI.perfCardHTML()`).
- **One switch:** `wmHub()` in `index.html` returns WMUI on Welding, EMUI on General English, or
  null. The Home cards for games call it, so neither hub ever draws the other's text.

## Files

| File | What it is |
|---|---|
| `english-mastery.js` | The screens. **Built** by `scripts/english-mastery/assemble.py` — do not edit it by hand. |
| `scripts/english-mastery/ui-*.js` | The English Mastery parts the assembler joins. |
| `welding-mastery-engine.js` | `build(P)`. `WMEngine` = `build()` is Welding, unchanged. `EMEngine` = `build(EM)` is General English. |
| `tracks/general/mastery.json` | The content. **Built** by `scripts/english-mastery/build.mjs`. |
| `scripts/english-mastery/{everyday,phrase-examples,expression-examples,missions}.json` | The new writing. |
| `tracks/general/mastery-art3d.json`, `english-mastery-logo.svg` | The art, built by `build-art.py`. |
| `english-mastery.css` | The colours, plus the pieces only this hub has. All layout comes from `welding-mastery.css`. |
| `backend/wm-game.js` | The server route, shared, with `prog: "general-english"`. |
| `~/Developer/be-private/em-advanced-v1.json` | The Premium pack. **Never in the repository** (it is public). It lives in KV `WM_PACK`, key `ge-advanced-v1`. |

Why a separate screens file? Welding must stay exactly as it is. The assembler copies the hub's
shared middle (render, Home, Journey, Collection, History, Rewards, Performance, trends, sheets,
the daily layer, the server client and the round machinery) out of `welding-mastery.js`. It
applies about 40 General English edits, each asserted to match exactly once. If the Welding file
changes in a way the edits no longer fit, the build stops instead of producing a different hub.
After changing `welding-mastery.js`, re-run `assemble.py` and the English Mastery suite.

## The content (385 items, 48 grammar questions, 40 missions, 13 stages)

All of it is read from the curriculum files except the new writing:

| Source | What |
|---|---|
| Foundations (`foundations.json`) | 45 First-steps sentences, each with its 15 written translations. |
| `phrases.json` | 116 phrases and 36 idioms (meaning and example from the file). The phrases have new examples. |
| `missions.json` (competencies) | 38 expressions that are not already phrases (definition from the file, new example). Also the situations of the 24 competency missions, word for word, with three new replies each. |
| `vocabulary.json` | The 48 grammar exercises, as they are. |
| New (`everyday.json`) | 150 everyday words, A1–B1: social, travel, shopping, health, home. Plus 16 everyday missions. |

The 13 stages are: First steps, the five everyday topics, the six two-week blocks of the plan,
and the business idioms.

**Curriculum order:** new items come first from the learner's current week (`currentPos()`, ±1
week), then everyday English, then First steps. A learner placed in Foundations (`fndGated()`)
gets First steps first. Due and difficult items still come before new ones (the engine's spaced
repetition).

## The eight games

| Game | Engine mode | Skill | What it does |
|---|---|---|---|
| Word Quest | `cards` | recall | Card with meaning, when to use it, example, sound and translation. Rated Again, Hard, Good or Easy. **Free** (review). |
| Quick Quiz | `quiz` | recognition, context | Meaning, fill the gap, or which phrase to use when; plus two grammar questions. |
| Sentence Builder | `sentence` | grammar (active when no hint) | Put the words of the item's sentence in order; one "find the correct sentence" question. |
| Listen & Win | `listen` | listening | Hear it, then choose it or type it. The speech gets faster through the round (0.85×–1.1×). |
| Speak Up | `speak` | speaking (active) | Record yourself, the app transcribes it, and each word is marked. At least 80% of the words is Good, at least 50% is Hard. |
| Phrase Match | `match` | recognition | Phrase ↔ meaning, ↔ example or ↔ when to use it. |
| Word Puzzle | `puzzle` | spelling | Spell the word from its meaning (letter tiles or typing). |
| Real-Life Missions | `missions` | context | Choose the natural reply, say it out loud, or write your own and ask the AI coach. |

The Daily English Mission is a quiz of eight items, one from each of eight stages (not First
steps), the same for everyone that UTC day. It is free and pays a +30 bonus once a day.

**Speak Up's honesty rules:**
- Being heard is free: transcription uses the existing `fbTranscribe`.
- A take that could not be heard is never counted.
- Skip costs nothing.
- Only the first take that is heard is graded. Later takes are practice.
- The per-word pronunciation score is optional. It is an AI verdict, so it is metered
  (`fbAssess`, `aiOff("ai_analysis")`, Free 3 a day).

## Server: energy and XP (`backend/wm-game.js`, `prog: "general-english"`)

- **Shared rules:** the same rules as Welding. The request names the programme, but the server
  serves it only when the **account's** programme (partner Worker `/programme`, read from the
  account's own Firestore record) is that one.
- **Separate counters:** each programme has its own. General English buckets are prefixed `em…`;
  Welding keeps its original `wm…` names. So Free has 5 energy a day **in each programme**.
- **Tickets:** they carry the programme, so a ticket from one programme cannot finish a round in
  the other.
- **Charged games:** Quick Quiz, Sentence Builder, Listen & Win, Speak Up, Phrase Match,
  Word Puzzle, Real-Life Missions and advanced.
- **Free games:** Word Quest and the daily mission.
- **Answer bounds per round (`EM_MAX_ANSWERS`):** Speak Up 6, Sentence Builder 8, Real-Life
  Missions 6.
- **Day:** UTC midnight, the documented fallback (the account has no timezone field).

## Premium (the existing plan, no new product)

- No energy cap.
- 30/90-day trends (`advanced_progress`).
- 20 advanced situations, from the private pack (C1: negotiation, feedback, hostile questions,
  managing up…).
- AI coaching through the existing metered verdict allowance (Free 3 a day, Premium 120).

## AI, always labelled

- **The coach:** `chat` route, `purpose: "coach"`, metered. It says it is AI, not a person.
- **Translation into the learner's language:** `chat` route, `purpose: "practice"`, signed in,
  cached in `localStorage.be_em_gl` (800 at most). Labelled "Machine translation by AI".
  A Foundations sentence shows the course's own translation instead, with no AI call.
- **The pronunciation score:** labelled AI.

## The learning loop

- **Home:** a "Learn → Play → Listen → Speak → Feedback → Practise with a person" card links to
  Practice Partner (when `ppAvailable()`) and Shadow Studio.
- **End of a Missions round:** offers Practice Partner, and the competency's Shadow clip when it
  has one (`missions.json` `shadow`).
- **Cards:** phrases and expressions from a competency with a clip link to it.

## Tests

| Suite | Result |
|---|---|
| `tests/english-mastery.mjs` (browser, fake microphone, stand-in server) | 57 |
| `backend/test-wm-game.mjs` (G1–G18 for English Mastery) | 61 |
| `tests/welding-mastery-engine.test.mjs` (Welding engine unchanged) | 107 |
| `tests/welding-mastery.mjs` (Welding hub unchanged) | 140 |
| `tests/nudge-engine.test.mjs` | 52 |
| Live staging, `~/Developer/be-wm-live/live.mjs` (L12–L18 for English Mastery, real throwaway accounts) | 18 |

## Not done, or limited

- **UI wording:** English and French only. The other 14 app languages read the English hub. The
  content can be translated on demand, by machine translation.
- **New writing still to review:** the 150 everyday words, the examples, the mission replies and
  the 20 advanced situations should be checked by an English teacher. The French UI strings
  should be checked by a native speaker.
- **Device-side records:** mastery, badges and the weekly goal are worked out on the device, as in
  Welding. The trends lock is a display gate over local data.
- **Production cannot run it yet:** there is no production `be-entitlements`, so the route answers
  503 there. The flag is OFF.
- **No widget and no push nudge** for English Mastery (not asked for). Home's recommendations
  include it.
- **No analytics events:** be-events has none on its allow-list for this feature.
