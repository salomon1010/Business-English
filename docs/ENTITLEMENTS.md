# Premium, entitlements and ad eligibility (Phase 7)

Branch `feature/phase7-entitlements`. Monetization foundation only: **no
payment provider, no price, no purchase, no ad is rendered, nothing deployed.**
The next phases build on it: Phase 8 renders ads, Phase 9 wires the stores.

## 1. What existed before this phase (verified 2026-09-24)

- **Base** (main `2acb992` plus design Phases 1–6):
  - no entitlement, billing, checkout, paywall or ad code;
  - Settings had a static "🎁 Free plan · Active" card and a greyed-out
    "⭐ Premium · Coming soon" card, with two old promises (team/HR
    dashboards, per-sound scoring).
- **An earlier attempt**, `feature/monetization-ads-premium` (`ad2cbf1`,
  another session, never merged):
  - about 4,500 lines, with client-side entitlement (`S.sub` written by
    client adapters), pricing, a paywall and house ads;
  - **not revived**: its entitlement is client-trusted, which this phase
    forbids;
  - its ad-safety thinking (never during recording or a live call, a quiet
    start, conservative caps) informed `AD_POLICY` here, but no code was
    copied.
- **Identity:** Firebase Auth on the client. `be-partner` already verifies
  Firebase ID tokens server-side (JWKS, RS256), so the pattern exists.

## 2. Architecture

```
Store / provider ─► billing adapter ─► D1 entitlements ─► entitlement-core ─► GET /v1/entitlement
   (Phase 9)        backend/entitlements/src/adapters.js     resolve()           (uid from verified token)
                                                                                        │
              app (web today; iOS / Android later — same JSON, CORS allows capacitor://localhost)
                                                                                        │
                        entView()  ── display only ──►  Settings plan card
                              │
                              └──► AdEligibility.decide(format, context) ──► Phase 8 renderer
```

- **Server** (`backend/entitlements/`, a Worker plus D1, not deployed): see
  its README. The plan is decided there and nowhere else.
- **Client** (`index.html`, "ENTITLEMENTS + AD ELIGIBILITY"):
  - `entRefresh()` runs on every auth change and fetches the VIEW with the
    Firebase token;
  - `entView()` / `entIsPremiumForDisplay()` are for drawing;
  - `entEraseMe()` runs on account deletion;
  - `entWipe()` runs on sign-out and on a device wipe.
- **Ad policy** (`AdEligibility`, `AD_POLICY`, `AD_PROTECTED_VIEWS`): one
  place, one order of questions.

## 3. Premium

Premium is `resolve(record, serverNow)`:
- `plan === "premium"`;
- status `active`, `trialing` or `grace`;
- started, and `now < expires_at` when an end is set.

Everything else is Free: a missing, invalid, expired, revoked or pending
record. The client displays the server's last answer, bound to the uid, for at
most 12 hours and never past its own expiry. With no deployment (`ENT_API = ""`)
everyone is Free and no request is made.

**Metered, not locked (owner's tier spec, 5 Oct 2026 — `docs/TIERS.md`).**
The capabilities `ai_analysis` and `ai_coach` are no longer a yes/no gate.
be-polish's `premiumGate` meters the routes behind them per UTC day: **3 AI
verdicts a day on Free, 120 on Premium**; past the ceiling the route answers
`429 allowance`, not 402. Pasted-video transcription (`ytai`) is metered in
seconds of video per UTC day (1,800 Free / 14,400 Premium). The headers
`X-BE-Allowance` and `X-BE-Video-Allowance` carry `{used, limit, resetAt,
plan}`. Premium's ceilings are fair use and are never described as
"unlimited". `advanced_progress` and `recommended_content` stay hard-locked
on Free. The same plan applies on General English and Welding. Signed-out
learners reach no AI route except Shadow translation and IPA.

The Premium card in App Setup, as built in this phase:
- listed ad-free learning, more AI coaching and practice each day, and new
  Premium features as they arrive;
- showed "Coming soon" for Free and "Active until …" for Premium;
- had no price and no purchase button.

(The card and the paywall were rebuilt later — `docs/PREMIUM-ACQUISITION.md`,
`docs/PREMIUM-ACQUISITION-UI.md`; the current promises are those in
`docs/TIERS.md`.)

## 4. Advertising readiness

`AdEligibility.decide(format, context, opts)` → `{ show, reason }`, asking in
this order:

1. `flag("ads_enabled")`: **off** in production and on staging this phase.
1b. The programme (`adsTrackAllows()` = `isGeneralEnglish()`, owner's tier
   spec, 5 Oct 2026): ads are **General English only**, on the free plan
   (anonymous or Free account). **Welding shows no ad on any plan.**
2. The plan, from the server view: Premium means no ads of any format,
   anywhere.
3. The format is known: `interstitial`, `native`, `rewarded`, `sponsored`.
4. The context is allowed for that format. Interstitials only at natural
   breaks: `lesson_complete`, `shadow_complete`, `practice_complete`,
   `flow_return`, `between_activities`.
5. `rewarded` only when the learner asked (`userInitiated`).
6. No protected learning state. Refused while any of these hold:
   - any microphone stream is live (`DS.voice`, which sees every recorder:
     speaking, Shadow, AI voice, a partner call);
   - `rec` is recording;
   - speech synthesis is talking;
   - a live partner session is open;
   - a roleplay turn is listening;
   - a simulation is listening;
   - Executive Polish is recording or assessing;
   - an explicit `AdEligibility.protect(key)` hold is set;
   - a dialog is open;
   - the page is hidden;
   - the screen is session, shadow, partner, roleplay, simulation,
     foundations, mission or pron.
7. Frequency (`AD_POLICY`, conservative, tune later). Interstitial:
   - 3 minutes of quiet at the start of a visit;
   - 15 minutes between interstitials;
   - at most 2 per rolling hour and 3 per session.

   Native, rewarded and sponsored have their own limits.

`AdEligibility.record(format)` is called once an ad was actually shown.

The planned full-screen interstitial (the owner's reference: the app dimmed
behind, a large clearly labelled ad, one tap back to BE Mastery) is a Phase 8
renderer that asks `decide("interstitial", <natural break>)` first.

## 5. Security

- A client cannot choose its plan. The server reads the uid from a verified
  token, reads no plan from any request, and has no client write route.
  Tokens are checked for signature, project, issuer and expiry.
- A client cannot read another account's plan: the uid is the token's `sub`.
- Billing identifiers stay server-side (`external_ref` is never returned).
- The client cache is **not** a security boundary. Editing it can hide or
  show the plan on one screen, the same power an ad blocker has. It cannot
  grant anything a server enforces. **Rule for later phases:** every paid
  capability (AI allowances) is enforced in the Worker that spends it, against
  this service, never by a client flag.

## 6. Tests

- `node backend/entitlements/test/run.mjs` (41 checks): the Worker, a real
  SQLite database built from the migration, and RS256-signed tokens.
- `cd tests && node entitlement-client.mjs`: the client cache, the ad policy,
  protected states, track isolation, and the mobile layout.

## 7. Known limitations and production risks

- **Not deployed:**
  - no D1 database exists (`database_id` is a placeholder);
  - `ADMIN_TOKEN` is unset;
  - `ENT_API` is empty.
- **No store adapters.** `POST /v1/billing/*` answers 501. Phase 9 needs:
  - Google Play Developer API verification plus Real-time Developer
    Notifications;
  - the App Store Server API plus signed notifications v2;
  - restore purchases;
  - reconciliation.
- **Signed-out learners are always Free.** A purchase will need an account,
  or a store-receipt restore path (Phase 9).
- **Frequency caps are per device** (`localStorage.be_ad_log`). That is
  enough for UX; it is not billing.
- **Ad display is client-rendered**, so it can be suppressed by a modified
  client like any web ad. The plan itself cannot be forged.
- **Store policy:**
  - web ads (AdSense) are not allowed inside the App Store build;
  - the TWA and the iOS shell need native ad SDKs or house ads (Phase 8 and 9
    decision);
  - Apple requires in-app purchase for digital Premium on iOS.
- **Privacy:**
  - a third-party ad network needs a privacy.html update, consent (EU/UK),
    ATT on iOS, and a Data Safety / privacy nutrition label update;
  - house ads need none.
- **Account deletion:** erasing the row does not cancel a store subscription.
  The store owns that, and the UI must say so once purchases exist.
- **Machine translation:** fr/es/pt/ar and the other 11 languages carry
  machine translations of the five new strings. Native review is recommended.
