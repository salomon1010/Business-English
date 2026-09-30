# Premium launch — implementation report

Date: 30 September 2026
Branch: `feature/premium-launch-final`, cut from `origin/main` @ `1589ff0c`
(the live 1.2.0 web release, `sw.js` = `be12-v489`)

**Status: READY FOR REVIEW — NOT MERGED, NOT DEPLOYED.**
Nothing was pushed, no Worker was deployed, `sw.js` was not bumped.

The audit that preceded this is `PREMIUM_LAUNCH_AUDIT.md` in this folder.

---

## 1. What production does today, after this change

**Exactly what it did before.** `ENT_API` is still empty, `billing_enabled` is
still false, `ads_enabled` is still false, and the AI Worker's
`PREMIUM_ENFORCED` is `"0"`. So `planOn()` is false, `entGated()` is false,
`hasEntitlement()` returns true for every capability, and every learner keeps
every feature. Proved by `tests/premium-boundary.mjs` checks 4–9.

Premium switches on only when the owner deploys `be-entitlements` and sets the
flags, in the order in `backend/wrangler.toml`.

## 2. Changes made

### Entitlement architecture (Phase 6)
- `backend/entitlements/src/entitlement-core.js` — added `CAPABILITIES` and the
  five new booleans to both plans.
- index.html — `ENT_CAPS` (identical list), `hasEntitlement(cap)`,
  `entLocked(cap)`, `entGated()`. **This is the only Premium question in the
  app**; there is no second `if premium` rule. `entSanitize()` reads every
  capability as a strict boolean.

### The paywall (Phase 3)
- `premPlans()` / `premPlanHTML()` deleted; `premOffer()` / `premOfferHTML()`
  in their place. One annual offer: the trial line, the plan name, the store's
  price. No radio group, no "best value", no saving, no monthly price.
- The CTA is `Start 3-day free trial` when the store reports an eligible trial,
  otherwise `Continue with Premium`. Under it, the renewal terms:
  *"Then $24.99 / year. Cancel anytime in the App Store."*
- Benefit rows rewritten to the five capabilities. Ad-free stays conditional on
  `ads_enabled`, per commit `1589ff0c` — there are no ads to remove yet.
- **No price is written in this repository.** Every figure comes from
  `Billing.products`, i.e. from App Store Connect / Play (Apple 3.1.2).

### AI gating (Phase 7)
- `aiOff(cap)` / `aiOn(cap)` / `aiOffNote(cap)`. `aiOff` is the
  `!POLISH_API||!navigator.onLine` guard that all 22 analysis call sites already
  used, plus the plan — so a Free learner takes the app's **existing offline
  path**: the activity runs, the recording is kept, the local result is computed
  on the device. The Free experience is a tested code path, not a new one.
- 22 analysis sites converted (`fbAssess`, `fbWords`, `fbTranscribe`, `exAI`,
  `exTranscribe`, `mvPron`, `mvCoach`, `mvExReport`, `sessReport`, `wsReport`,
  `fbFixGrade`, `simEnrichAnalysis`, six Shadow Challenge graders,
  `rpRepEvidence`, `rpRepRun` ×2, `rpHistMountReports`).
- The AI coach (`ppAiStart`) and the live per-round tip (`ppLiveRoundTip`) gate
  on `ai_coach` / `ai_analysis`. The coach card still renders on every start
  screen (owner, 23 September 2026) — the tap reaches the offer, not an error.
- `premLockHTML(cap, from)` is the one gate card everywhere.

### Progress (Phase 9)
- `pgRecordLocked()` re-homed onto `entLocked("advanced_progress")`.
- New `pgWindow()` / `pgWindowsHTML()`: 30- and 90-day analytics built only from
  data the app already records (`areaDayLog()`, `areaFbHist()`), each window
  beside the one before it. A window with no scored recording says "No score
  yet" rather than drawing a zero, and the caption says how many scores the
  average is over, because `S.fbHist` keeps only the last 50.
- Locked, the real panel is drawn dimmed and inert inside `.prem-prev` under the
  offer — a preview, never an empty chart. Same for the trend charts.

### Home recommendations
- The recommendation is always shown — title, reason, artwork. What Premium buys
  is opening it.
- Gated: recommended Shadow videos, Challenges, external links
  (`HOME_PREM_KINDS`, `HOME_PREM_ITEMS`).
- Never gated: the curriculum, words due, trouble words, the phrase bank,
  Practice Partner, role-play. Free is a complete product.
- `homeRecOpen()` itself refuses a locked item, so no other caller can route
  around the card.

### Server-side enforcement (Phase 8)
- `backend/polish-worker.js`: `premiumGate()` on **all 10 routes**. The caller's
  Firebase token is forwarded to `be-entitlements`, which verifies it and answers
  with the view; the capability is read from it. Answers cached 60 s under a
  SHA-256 of the token — never the token, never a uid. Adds a per-account rate
  limit (an IP limit alone is useless behind carrier NAT).
- Off by default: needs `PREMIUM_ENFORCED="1"` **and** `ENTITLEMENTS_URL`. A
  half-configured deploy stays off rather than half-on.
- Failure behaviour: `401` for no/rejected token, `402 premium_required` for a
  Free account, `503` when the entitlement service is unreachable — **never** a
  silent downgrade to Free, and no paid work done on a guess.
- The client signs AI requests in **one** place: a `window.fetch` wrapper beside
  `POLISH_API` that touches only that URL. Every other request is untouched.

### Store configuration (Phase 4)
- `BEMastery.storekit`: annual $24.99 with the 3-day free trial; the trial
  removed from monthly.
- `mobile/ios/appstore/SUBSCRIPTIONS.md` rewritten for the one-offer model.

### i18n
- 29 new keys in `I18N_EN` and in all 15 language files. Translated for **fr, es,
  pt, ar**; English placeholders in the other 11, per the project's rule. Key
  parity verified: all 15 files carry exactly the 3,288 `I18N_EN` keys.

## 3. Premium entitlement matrix

| capability | Free | Premium | gated where |
|---|---|---|---|
| `ai_analysis` | practice runs, local result kept | full AI analysis, score, every report | client + **server** |
| `ai_verbal_feedback` | — | feedback spoken in the natural voice | client |
| `advanced_progress` | current totals, streak, phrases, clips | 30/90-day analytics, trends, the long record | client |
| `ai_coach` | card visible, tap opens the offer | AI coach sessions, per-round live feedback | client + **server** |
| `recommended_content` | recommendation visible with its artwork and reason | opens and plays | client |
| `ad_free` | ads when `ads_enabled` | no ads | client (`AdEligibility`) |

**Never gated for anyone:** the curriculum, sessions, the road map, Foundations,
Shadow practice itself, Executive Polish's rewrite, role-play, Practice Partner
(human), captions, TTS, the learner's own words, phrases and recordings.

**Welding: nothing is gated at all.** Premium is sold on General English only,
so `entGated()` refuses to apply a gate there. Verified by
`tests/premium-boundary.mjs` 22–26 and `tests/track-isolation.mjs` (23/23).

## 4. Tests actually executed

Every number below was produced by running the suite on this branch.

| suite | result |
|---|---|
| `backend/test-premium-gate.mjs` (**new**, the server boundary) | **29/29** |
| `tests/premium-boundary.mjs` (**new**, the app boundary) | **44/44** |
| `backend/entitlements/test/run.mjs` | 61/61 |
| `backend/entitlements/test/billing.mjs` | 100/100 |
| `tests/smoke.mjs` | 33/33 |
| `tests/entitlement-client.mjs` | 46/46 |
| `tests/billing-client.mjs` | 50/50 |
| `tests/premium-acquisition.mjs` | 40/40 |
| `tests/ios-storekit.mjs` | 26/26 |
| `tests/subscription.mjs` | 29/29 |
| `tests/ads.mjs` | 50/50 |
| `tests/monetization-qa.mjs` | 31/31 (210 renders) |
| `tests/track-isolation.mjs` | 23/23 |
| `tests/premium-value.mjs` | 78/81 — see below |
| `tests/shadow-coach.mjs` | 46/46 |
| `tests/shadow-sync.test.mjs` | 83/83 |
| `tests/shadow-helpers.mjs` | 32/32 |
| `tests/shadow-first-tap.mjs` | 86/86 |
| `tests/polish-report.mjs` | 25/25 |
| `tests/polish-track.mjs` | 14/14 |
| `tests/session-report.mjs` | 17/17 |
| `tests/welding-ai-report.mjs` | 20/20 |
| `tests/welding-interview-report.mjs` | 14/14 |
| `tests/workshop-voice.mjs` | 9/9 |
| `tests/report-ux.mjs` | 12/12 |
| `tests/report-integrity.mjs` | 40/40 |
| `tests/mission-speaking-report.mjs` | 37/37 |
| `tests/mission-coach-report.mjs` | 16/16 |
| `tests/live-ring.mjs` | 10/10 |
| `tests/zoom.mjs` | 7/7 |
| `tests/online-presence.mjs` | 20/20 |
| `tests/language-profile.mjs` → `language-polish.mjs` | 30/31 — pre-existing |
| `tests/mission-integration.mjs` | 73/74 — pre-existing |
| `tests/boot-recovery.mjs` | 3/7 — pre-existing |
| JS parse check (index.html, and the staged blob) | 4 scripts, 0 errors |
| JSON-LD block | parses |
| i18n key parity, 15 files | 3,288 keys, 0 missing, 0 orphan |
| `BEMastery.storekit` | valid JSON |
| `backend/wrangler.toml` | valid TOML |

Not run, and not claimed: `tests/partner.mjs`, `tests/live-rounds.mjs` and
`tests/hidden-switch.mjs` **skip** without a local partner Worker
(`cd backend/partner && npx wrangler dev --env dev --port 8787`), which was not
started. The client-side change they would cover — `ppAiStart` opening the offer
instead of a session — is covered by `premium-boundary` checks 37–39.

### Failed tests

Six checks fail. **Every one of them also fails on a clean `origin/main`
worktree**, which was created and run specifically to attribute them — they are
pre-existing and unrelated to this work:

| suite | check | on this branch | on clean `origin/main` |
|---|---|---|---|
| `premium-value` | A0 catalogue counts | fail | fail |
| `premium-value` | A3 library video loads | fail | fail |
| `premium-value` | C5 latest report re-opens | fail | fail |
| `language-polish` | 1 "Natural English" fold | fail | fail |
| `mission-integration` | missing-move report | fail | fail |
| `boot-recovery` | 4 of 7 | 3/7 | 3/7 (identical) |

A seventh, a genuine flake, **was fixed here**: `premium-value` D8/D20 read the
Premium sheet mid-redraw after `setLang`, which failed on the baseline as D8 and
on this branch as D20. It now waits for the benefit rows instead of a fixed
delay, and both pass.

### Tests that had to be updated, and why

`billing-client`, `premium-acquisition`, `premium-value`, `ios-storekit` drove
the two-plan chooser that no longer exists, and their store stubs carried the
old $19.99 / trial-on-monthly configuration. They were rewritten for the one
offer and the real configuration. One assertion in
`backend/entitlements/test/billing.mjs` (G3) matched the uid `ana` as a bare
substring, which also matched the new capability name `ai_analysis`; it now
matches on a word boundary.

### Not tested here

- The real App Store purchase sheet, real prices and real Apple transactions —
  needs a TestFlight build with a sandbox Apple ID. **No Xcode on this Mac.**
- The real Play Billing sheet — needs a Play Console internal-testing track.
- `be-entitlements` and `be-polish` running against each other for real —
  neither is deployed.
- Any device testing.

## 5. Store status

| item | status |
|---|---|
| Product IDs | `premium_annual` (offered), `premium_monthly` (honoured, not offered) |
| $24.99 annual | configured in `BEMastery.storekit` and documented; **not entered in App Store Connect** |
| 3-day trial | on `premium_annual` in the local config; **not entered in App Store Connect** |
| Restore Purchases | implemented and tested (`AppStore.sync()` → `currentEntitlements` → signed JWS → server verify). No `restoreButtonTapped → premium = true` anywhere |
| Server notifications V2 | URL documented, **not configured** |
| Paid-apps agreement, tax, banking | unknown from here; Account Holder only |

## 6. Production risks

| # | risk |
|---|---|
| R1 | **`chat` cannot be fully protected** — its system prompt comes from the client. The purpose label gates the app's own flows, not a determined caller. The fixed-work routes are properly protected. Closing this means moving the prompts into the Worker. |
| R2 | Gating AI on entitlement makes AI unavailable to **signed-out** learners once enforcement is on. That is the owner's decision (30 September 2026), not a defect, but it is a visible change for anyone who never signed in. |
| R3 | `FLAGS_IOS` turns Home V2 on for the App Store build only, so the Home gating must be verified with that flag on. |
| R4 | The order in `backend/wrangler.toml` matters. Turning on `PREMIUM_ENFORCED` before `be-entitlements` answers returns 503 for every AI call. |
| R5 | The Arabic, and to a lesser extent the fr/es/pt, copy is machine transcreation and should be reviewed by a native speaker before it is promoted. |
| R6 | `S.fbHist` keeps only the last 50 scores, so a 90-day average can be over fewer recordings than were actually made. The caption says so; it is a limit, not a bug. |

## 7. Exact remaining steps before App Store submission

1. **Owner:** App Store Connect — create the subscription group, `premium_annual`
   at US$24.99 with a 3-day introductory offer (new subscribers), localisations,
   review screenshot. `premium_monthly` only if it is to stay sellable.
2. **Owner:** paid-apps agreement, tax forms, banking active.
3. **Owner:** deploy `be-entitlements` (D1 create, migrations, `ADMIN_TOKEN`,
   `APP_ACCOUNT_SECRET`, `PLAY_TOKEN_KEY`), set the Apple vars, register the
   Server Notification V2 URL and send a test notification.
4. **Owner:** set `PREMIUM_ENFORCED` + `ENTITLEMENTS_URL` and deploy `be-polish`
   — only after step 3 answers.
5. Set `ENT_API` and `billing_enabled: true` in index.html; bump `sw.js`
   `be12-vNN`; ship the web bundle.
6. Build and run the iOS app on a device with a sandbox Apple ID: purchase,
   trial, restore, reinstall-restore, second-device restore, cancel, expire,
   refund. **Needs a Mac with Xcode and the Lomonec signing identity — not this
   machine.**
7. Write a Terms of Use page and set `PREM_TERMS_URL` (iOS falls back to Apple's
   standard EULA today, which satisfies 3.1.2, but there is no BE Mastery page).
8. Native-speaker review of the new fr / es / pt / ar copy.
9. Update `privacy.html` and the App Store privacy answers if Premium changes
   what is collected (it does not, as built).
