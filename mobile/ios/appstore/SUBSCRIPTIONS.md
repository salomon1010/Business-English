# App Store Connect — BE Mastery Premium subscriptions

> **TWO PLANS (owner, 5 October 2026 — supersedes the 30 September "one
> offer" note).** The app offers **both** subscriptions: **US$19.99 / year**
> and **US$2.99 / month**, annual first and tagged "Best value" (44% off the
> monthly run-rate). One subscription; the same capabilities on General
> English and Welding. A free trial is shown **only if the store reports
> one** — the app never assumes. The tier contract (daily allowances, storage
> limits, ads) is `docs/TIERS.md`.
>
> Premium was excluded from version 1.1.0. For the release that turns it on,
> everything below must be entered in App Store Connect first.

Prepared 2026-09-26. **Entered in App Store Connect on 6 October 2026**
through the App Store Connect API (team key A88M365B2K, App Manager): group
`BE Mastery Premium` (22444441) with an en-US display name; `premium_monthly`
(6819570240) and `premium_annual` (6819570241), both level 1, en-US name and
description, available in all 175 territories with Apple's equalised price for
US$2.99 / US$19.99, a free 3-day introductory offer in every territory, and the
Premium sheet as the review screenshot. Both read **Ready to Submit**; they are
reviewed with the first app version that carries them.

**One set of ids on both stores (owner, 6 October 2026).** App Store Connect
must use exactly the Google Play ids, `premium_monthly` and `premium_annual`.
Play ids may contain only lowercase letters, digits, underscores and full
stops, and no store lets an id be renamed or reused once created, so these
two are the only ids both stores can share. The app, the plugin and the
server accept these two and nothing else.

## Subscription group
| Field | Value |
|---|---|
| Reference name | BE Mastery Premium |
| Group display name (en) | BE Mastery Premium |

One group, two subscriptions. **Both at level 1**: the two plans give the same
content for different durations. Apple ranks those as one level, so a switch
between them is a *crossgrade* and takes effect at the next renewal. Neither
plan is a higher tier.

## Products (IDs must match exactly: the app and the server accept only these)
Subscription group reference name in App Store Connect: `BE Mastery Premium`.
| Product ID | Reference name | Duration | Price (USA) | Introductory offer | Level | Offered in app |
|---|---|---|---|---|---|---|
| `premium_annual` | Premium annual | 1 year | **US$19.99** | **Free trial, 3 days**, new subscribers, all territories (owner, 6 Oct 2026) | 1 | **yes — first, "Best value"** |
| `premium_monthly` | Premium monthly | 1 month | **US$2.99** | **Free trial, 3 days**, new subscribers, all territories | 1 | **yes — second** |

**The free trial (owner, 6 Oct 2026): 3 days, on both plans, on both stores.**
The owner asked for 5 days; Apple's free-trial durations are fixed (3 days,
1 week, 2 weeks, 1 month, …) and Google Play allows any length from 3 days, so
3 days is the shortest length both stores can share. Apple grants one
introductory offer per subscription group per Apple ID, so a learner gets the
trial once whichever plan they pick. The app shows "3 days free" and "Start
3-day free trial" only when the store reports the trial for that account; the
number is never written in the app.

### Google Play — the same set-up (Play Console → Monetise → Subscriptions)
| Product ID | Base plan | Period | Price (USA) | Offer |
|---|---|---|---|---|
| `premium_annual` | `annual`, auto-renewing | P1Y | **US$19.99** | **`trial3d`** — one phase, Free trial, 3 days, new customers (to be ADDED: today only the monthly plan has it) |
| `premium_monthly` | `monthly`, auto-renewing | P1M | **US$2.99** | `trial3d` — Free trial, 3 days, new customers (exists) |

The ids, prices, periods and trial are identical to the App Store. Activate both offers; the app reads `freeTrialPeriod` from the
Digital Goods API and shows the badge only when Play reports it.

**The price is never written in the app.** The Premium sheet prints whatever
StoreKit returns for each product, and the renewal line under the CTA
(`prem.then`) prints the same figure. If App Store Connect says something other
than $19.99 / $2.99, the app will say that instead — which is the required
behaviour (Apple 3.1.2), not a bug. Setting the price here is the only way to
change it. The "Save N%" tag is computed from the store's own two prices, so
it follows them too.

- **Other countries:** let App Store Connect derive the prices from the US
  price, then review them. The Play prices are set separately and need not
  match; the regional figures recorded earlier belong to the old tiers and
  must be re-set by the owner.
- **Trial eligibility:** Apple grants an introductory offer once per
  subscription group per Apple ID. The app shows the trial only when StoreKit
  says the Apple ID is eligible (`isEligibleForIntroOffer`); it never assumes.
  Whether a trial exists at all is the store's configuration, not the app's.
- **No other products, and no offer codes or promotional offers.**

## Localisations (English shown; add French first for the audience)
| Product | Display name | Description |
|---|---|---|
| premium_annual | Annual Premium | 120 AI verdicts a day, 240 minutes of your own videos, 30- and 90-day analytics, personalised recommendations and no ads. Billed once a year. |
| premium_monthly | Premium (monthly) | The same Premium, billed monthly. |

What Premium adds (the full contract is `docs/TIERS.md`): **120 AI verdicts a
day** and **240 minutes a day** of your own pasted YouTube video transcribed —
fair-use ceilings, **never described as "unlimited"**; the 30- and 90-day
analytics and long-term record; personalised recommendations; the AI coach
(within the 120); larger storage (100 saved Shadow videos, 20 YouTube imports,
50 Polish reports, 30 saved clips); and no ads anywhere. The descriptions
promise only what Premium actually grants — `CAPABILITIES` in
`backend/entitlements/src/entitlement-core.js`, the same list the app's
`ENT_CAPS` and the paywall's benefit rows read. Keep this table in step with
that list.

## Review information per product
- **Screenshot:** the Premium sheet on an iPhone (Profile → *BE Mastery
  Premium*, or App Setup → Subscription → *See Premium plans*). Take it on the
  TestFlight build with the sandbox store, so the real products and prices show.
- **Review notes:** see `docs/APPLE_APP_REVIEW.md` § Notes (Subscriptions).

## App Store Server Notifications (Version 2)
| Environment | URL | Worker |
|---|---|---|
| Sandbox | `https://entitlements-staging.lomonec.com/v1/billing/app_store` | be-entitlements-staging (`APPLE_ENVIRONMENTS = "Sandbox"`) |
| Production | `https://entitlements.lomonec.com/v1/billing/app_store` (**not deployed yet**) | be-entitlements (`APPLE_ENVIRONMENTS = "Production"`) |

- Choose **Version 2**. The server rejects V1 payloads, which have no
  `signedPayload`.
- Sandbox and production point at different Workers with different
  databases, so they never mix.
- After saving each URL, press **Request a Test Notification**. The Worker
  answers 200 and records nothing.

## What the server needs (no Apple secret is involved)
The Worker verifies Apple's signed JWS on its own, by pinning Apple Root CA -
G3. It never calls Apple, so no App Store Connect API key, `.p8` file or
shared secret is needed.

| Setting | Where | Value |
|---|---|---|
| `APPLE_BUNDLE_ID` | var | `com.lomonec.bemastery` |
| `APPLE_ENVIRONMENTS` | var | `Sandbox` (staging) / **`Production,Sandbox`** (production: App Review buys with Sandbox accounts **against the production build**, so a production Worker that refuses Sandbox fails review) |
| `APPLE_ROOT_SHA256` | var (public) | `63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179` (SHA-256 of AppleRootCA-G3.cer, downloaded from apple.com on 2026-09-26; re-check it yourself) |
| `APP_ACCOUNT_SECRET` | **secret** | 32+ random characters. It must be different per environment, and **must never change** once purchases exist: the appAccountToken of every purchase is derived from it. |

## Agreements, tax and banking
The paid-apps agreement, tax forms and bank account must be active in App Store
Connect before any subscription can be tested in TestFlight or sold. Only the
Account Holder can do this.
