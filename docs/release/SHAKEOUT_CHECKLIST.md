# BE Mastery — full application shakeout checklist

**Prepared 1 October 2026** on `feature/product-boundary-implementation`
(`0a25c419` + the J1 work). **The shakeout itself has NOT been run** — this is
the plan for it.

## How to read this

- **Automated** names a suite that already exists (97 in `tests/`, 5 server-side
  in `backend/`). "**none**" means no suite covers it and one is needed, or the
  check is inherently manual. Nothing here proposes a new framework: the
  existing Playwright + Node harness is the framework.
- **Severity** is release-blocking judgement: **P0** stops a release, **P1**
  stops a *paid* release, **P2** ships with a known-issue note, **P3** cosmetic.
- **GE / W** = applies to General English / Welding.
- Run every browser suite on a **verified free port** and confirm the served
  `index.html` matches disk (C3 in `SHAKEOUT_2026-10-01.md`: a suite on a taken
  port certifies another worktree's code).
- Three states must be exercised for every AI row: **signed out**, **signed in
  Free**, **signed in Premium**. Most defects this quarter lived in exactly one
  of them.

## The state matrix, once

| | Signed out | Free (authenticated) | Premium |
|---|---|---|---|
| Curriculum, road map, Foundations, phrases, vocabulary, calendar | full | full | full |
| Recording + replay, day credit | full | full | full |
| Transcription, translation, IPA, character replies, TTS | **refused, and said so before the activity (GE)** | full | full |
| `ytai` (pasted-video transcription) | **401 in every configuration (J1)** | full, within caps | full, same caps |
| Basic Challenge feedback (coverage / words / rhythm / completion) | local only | full | full |
| AI verdicts: reports, `assess`, `analyse`, retell meaning, coach | no | **402 premium_required** | full |
| 30/90-day analytics, personalised rows, ad-free | no | no | full |

---

| # | Item | User action | Expected | Free | Premium | Signed out | GE/W | Network / offline | Security | Automated | Manual on staging | Sev |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Authentication | Open Profile → Backup & sync | Sheet opens over everything, Log in / Create account reachable | same | same | this is the entry | both | sheet needs no network until submit | Firebase ID token only; no password stored | `auth-sheet` | open from a cold launch and from a deep link | P0 |
| 2 | Account creation | Create account with a new address | Account made, welcome mail, device copy adopted | same | same | n/a | both | fails honestly offline | password never logged; `be-mail` confirms the account is minutes old | `mail-welcome`, `auth-sheet` | real address, read the mail | P0 |
| 3 | Sign in | Log in with an existing address | Signs in, progress merges, no data crossing | same | plan appears within 5 min | n/a | both | queued, honest error offline | `FB_OWNER_KEY` drops another uid's device copy | `auth-sheet` | two accounts on one device | P0 |
| 4 | Sign out | Profile → Sign out, confirm | Signs out, device wiped: state, recordings, entitlement cache, push id | same | plan cache cleared | n/a | both | works offline | nothing of that account remains for the next person | **none** | verify IndexedDB `recs` is empty after | P0 |
| 5 | Password recovery | Forgot password | Branded mail via `be-mail`; on staging, Firebase's own (MAIL_API empty) | same | same | n/a | both | honest failure | **staging must never reset a production password** | `auth-reset-env` | throwaway test-project account only | P1 |
| 6 | Profile | Set name, role, goal, avatar | Saved, shared across both areas | same | same | local only | both | local | deliberately not area-split | `smoke` | — | P2 |
| 7 | GE curriculum | Open a week, a day, a session | 12 weeks, lessons, phrases, templates; never metered by plan | full | full | full | GE | fully offline | no gate of any kind | `smoke`, `ge-loop`, `roadmap-card` | walk week 1 end to end | P0 |
| 8 | Speaking | Start a spoken activity | **F7: the account requirement is stated BEFORE the activity** | proceeds | proceeds | notice + Create a free account | GE (notice); W honest runtime only | recording works offline | no doomed request fired | `free-premium-contract` §9 | all five GE surfaces | P0 |
| 9 | Recording | Tap the mic, speak, tap again | Take saved, day credited, replayable — **always**, whatever plan or network | yes | yes | **yes** | both | fully offline | audio never leaves the device except to transcribe | `shadow-challenge`, `session-report` | real iPhone mic | P0 |
| 10 | Transcription | Finish a spoken turn | Words come back; a refusal names its reason, never "nothing came through" | **free** | free | 401, said plainly | both | honest offline message | account-attributed; `STT_PER_MIN` 20 / `_PER_DAY` 600 | `free-premium-contract`, `ai-account-gate`, `mic-and-lang` | real audio on staging | P0 |
| 11 | Translation | Shadow → Translate | The line becomes the chosen language | **free** | free | stops before the request, says sign in | both | cached per line | `chat practice`, no capability | `free-premium-contract`, `shadow-helpers` | French and Arabic | P0 |
| 12 | Shadow Studio | Open a clip, Watch, Shadow | Library, synchronised transcript, word timing, record, replay | full | full | content yes, AI no | GE + W studio | captions cached | `ytai` needs an account (J1) | `shadow-sync.test`, `shadow-transcript`, `shadow-all-videos`, `shadow-layout` | paste a link signed out → the J1 message | P0 |
| 13 | Shadow Challenge | Record a rung | Graded: coverage, words, rhythm, verdict. Pronunciation score named as Premium | **free, whole loop** | + per-word score | notice first, mic still there | GE | local maths offline | one gate, in `fbAssess` | `free-premium-contract` §3–5, `shadow-challenge` | all six rungs as Free | P0 |
| 14 | Executive Polish | Dictate, Polish | Two rewrites; history capped by plan | free (1 kept) | 50 kept | notice first | both | local fallback rewrite | `RATE_PER_MIN` 15 | `polish-report`, `language-polish` | — | P1 |
| 15 | Practice Partner | Practice → Real people | Discovery, presence, Match me, invites | free | free | **sign-in card before anything** | GE only | honest offline | `TRACKS` refuses W `403` server-side | `partner`, `online-presence` | needs the dev Worker + local migrations | P1 |
| 16 | Partner matching | Match me | ≤3 candidates, plain reasons, opaque offer ids | free | free | n/a | GE | — | no uid, no score leaked | `partner` | two real contexts | P1 |
| 17 | Partner consent | First entry | 18+ consent before any exposure | required | required | n/a | GE | — | server records consent; no queue entry without it | `partner` | — | P0 |
| 18 | Block / report | Partner options → Block, Report | Block hides permanently; report limited 5/day, block 20/day | same | same | n/a | GE | — | the only day-boundary limits in the product | `partner` | — | P0 |
| 19 | AI fallback | "Or practise with the AI coach" | Card always present; starting it is Premium | **402, offered** | full session | sign-in card | GE | — | `chat` purpose `coach` → `ai_coach` | `free-premium-contract`, `premium-boundary` | — | P1 |
| 20 | Welding curriculum | Switch to Welding | Its own weeks, road map, professions; lands on Home + strip | full | full | full | W | offline | area-split evidence | `welding-practice-career`, `professions`, `track-isolation` | switch both ways | P0 |
| 21 | Welding simulations | Practice → simulations | Catalogue, characters, turn-taking | full | full | content yes | W | — | — | `welding-studio` | — | P1 |
| 22 | Welding interview | Run an interview | Scripted beats, named interviewers, score + per-interviewer feedback | full loop | + AI enrichment | 401 on the turn, reported honestly | W | — | — | `welding-interview-report` | real audio | P0 |
| 23 | Welding audio | Speak a turn | Heard and transcribed | **free** | free | 401, honest | W | recording kept | same STT caps | `workshop-voice` | real iPhone | P0 |
| 24 | Welding AI feedback | Finish a workshop | Interviewers' report, not the GE speaking report | local score | + AI report | refused honestly | W | — | `ai_analysis` | `welding-ai-report` | — | P1 |
| 25 | Progress | Open Progress | Calendar, streak, consistency, year graph | full | + 30/90-day | local only | both, per area | offline | per-area maps; no cross-area leak | `track-isolation`, `premium-boundary` | — | P1 |
| 26 | Road map | Open the Road map tab | Card + S-curve, beacon, one `now`, one `next` | full | full | full | both | offline | — | `roadmap-card` | phone width | P1 |
| 27 | Career Centre | Open it, view the certificate | Destination, standards, certificate PDF | full | full | full | both | offline | — | `professions` | — | P2 |
| 28 | Premium | Open the plans sheet | Hero, **four** benefit rows (GE), one offer, one CTA | sees the offer | sees Active | sign-in first | both | honest when the store is away | **no claim that is not enforced** | `premium-acquisition`, `premium-value`, `billing-client` | — | P0 |
| 29 | Subscription | Check status | Plan, state, renewal, manage | Free | Active + expiry | Free | both | cached view, labelled | a failed refresh must not show a stale plan as certain (C2) | `subscription`, `entitlement-client` | real grant needed | P1 |
| 30 | Restore purchase | Tap Restore | Re-reads the entitlement | no-op | restores | sign-in first | both | honest failure | server decides, never the client | `ios-storekit`, `billing-client` | real sandbox purchase | P0 |
| 31 | Ads | — | `ads_enabled` false: nothing anywhere | none | none | none | both | — | `ad_free` via the plan's `ads` | `ads` | confirm nothing renders | P2 |
| 32 | Offline | Aeroplane mode, practise | Curriculum, recording, replay, local feedback all work; AI says "offline", not "broken" | full | full | full | both | **the core promise** | nothing queued that leaks later | `boot-recovery`, `smoke` | real device, aeroplane mode | P0 |
| 33 | Network failure | Kill the Worker mid-call | Named reason, retry that can work, recording kept | yes | yes | yes | both | — | no partial state written | `free-premium-contract` §7, `ai-account-gate` | throttle to 0 in DevTools | P0 |
| 34 | Service worker | Deploy, reopen | New `be12-vNN` picked up; no drop to Home on refresh; `be-rem` cache survives | — | — | — | both | network-first | the activate sweep must not wipe `be-rem` | `boot-recovery` | installed PWA, force-quit | P1 |
| 35 | Mobile responsive | 390×844 and 320 wide | No horizontal scroll, 44px targets, two-line titles | — | — | — | both | — | — | `mobile-density`, `contrast-sweep`, `visual-identity` | — | P1 |
| 36 | iPhone Safari | Load on a real iPhone | Audio session, `MediaRecorder` MIME, playback does not steal the mic | — | — | — | both | — | — | **none — cannot be done headless** | **mandatory before submission** | P0 |
| 37 | iOS native app | Launch the Capacitor shell | `capacitor://localhost` reaches all four Workers; no Play links (`IS_IOS_APP`) | — | — | — | both | — | origin must be in every allow-list | `ios-storekit`, `ios-yt-relay` | needs Xcode, which this Mac lacks | P0 |
| 38 | Auth inside iOS | Create and sign in from the shell | Email/password works from `capacitor://localhost` | — | — | — | both | — | no OAuth redirect can work there | **none** | device test | P0 |
| 39 | Track isolation | Practise in both areas | Neither area shows the other's evidence | — | — | — | both | — | `tk`-stamped records; `TRACKS` 403 | `track-isolation`, `polish-track`, `welding-premium` | — | P0 |
| 40 | Security | Probe the Workers | CORS allow-list, 403 on a foreign origin, 401 without a token where required | — | — | — | — | — | **the `chat` system prompt still comes from the client — known, open** | `test-premium-gate` (P1–P5) | — | P1 |
| 41 | Rate limiting | Burst a route | Limits hold **across isolates**; 429 + `Retry-After`; refusals cost nothing | same | same | n/a | — | — | Durable Object, not a `Map` | `test-rate-limit` (59) | validated live on staging 1 Oct | P0 |
| 42 | Error handling | Force each failure | Every refusal names its real cause; "connection" never stands for Premium or account | — | — | — | both | — | — | `free-premium-contract` §7 | — | P0 |
| 43 | Data persistence | Practise, force-quit, relaunch | State, recordings, streak all survive; the view is restored | — | — | — | both | local-first | recordings never synced | `boot-recovery`, `smoke` | installed PWA | P0 |
| 44 | Account deletion | Profile → Delete account | Partner data, entitlement, Firestore doc, Firebase user, device — in that order | same | warns about the store subscription | n/a | both | fails closed | Apple 5.1.1(v) / Play | **none** | throwaway account only | P0 |
| 45 | Regression | Run the whole suite | Known-good counts, pre-existing failures named | — | — | — | both | — | — | all 97 + 5 | re-run on verified free ports | P0 |

## Known-failing before the shakeout starts

Baseline so nothing is mistaken for new damage:

| Suite | State | Nature |
|---|---|---|
| `boot-recovery` | 3/7 | pre-existing (curriculum recovery after a 404, FAB placement) |
| `shadow-challenge` | 120/121 | pre-existing (transcript chip on a learner-added video) |
| `language-polish` | 30/31 | pre-existing ("Natural English" fold) |
| `shadow-helpers` | 31/32 **intermittently** | flaky: the popover measures exactly 232×264 against a ≤232×264 limit |
| `partner`, `live-rounds`, `hidden-switch` | SKIP → exit 0 | **read as a pass while testing nothing** — needs `wrangler dev` on 127.0.0.1:8787 and `wrangler d1 migrations apply be-partner --local --env dev` |

## Three things to settle before the shakeout, not during it

1. **The J1 client/server order.** `ytai` now answers 401 without an account in
   every configuration. The client half is in the same commit, but a learner on
   a **cached** older `index.html` would fire the request and read "no
   transcript". Ship the bundle before, or with, the Worker.
2. **Welding's pre-activity notice** (`WELDING_ACCOUNT_AUDIT.md`) — one term,
   owner's call. Decide before QA writes expectations for Welding.
3. **The Premium leg is unvalidated end to end**, because no `ADMIN_TOKEN` is
   available to grant a throwaway uid. Until it is, every Premium row above is
   expectation, not evidence.
