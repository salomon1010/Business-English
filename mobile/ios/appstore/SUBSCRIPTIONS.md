# App Store Connect — BE Mastery Premium subscriptions

> **NOT PART OF VERSION 1.1.0 (owner decision, 29 Sep 2026).** Premium is not active
> in this release: create no subscription group or products, attach no in-app
> purchase to the 1.1.0 submission, and do not mention Premium in the listing or
> the review notes. The StoreKit 2 code stays in the app, dormant
> (`billing_enabled` off, no production entitlement Worker). This file is kept as
> the set-up for a later release.

Prepared 2026-09-26. **Nothing here has been entered in App Store Connect yet**:
this repository has no App Store Connect access. It is the exact set-up to
enter, matching the Google Play products and what the app and the server
already expect.

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
| Product ID | Reference name | Duration | Price (USA) | Introductory offer | Level |
|---|---|---|---|---|---|
| `premium_monthly` | Premium monthly | 1 month | US$4.99 (tier chosen in App Store Connect to match) | **Free trial, 3 days, new subscribers only** | 1 |
| `premium_annual` | Premium annual | 1 year | US$19.99 | none | 1 |

- **Other countries:** let App Store Connect derive the prices from the US
  price, then review them. The Play prices (for example €5.49 / €20.99 in
  France) are set separately and need not match.
- **Trial eligibility:** Apple grants an introductory offer once per
  subscription group per Apple ID. The app shows the trial only when StoreKit
  says the Apple ID is eligible (`isEligibleForIntroOffer`); it never assumes.
- **No other products, and no offer codes or promotional offers.**

## Localisations (English shown; add French first for the audience)
| Product | Display name | Description |
|---|---|---|
| premium_monthly | Premium (monthly) | Save more Shadow and YouTube practice videos and keep your Polish speaking history. |
| premium_annual | Premium (annual) | The same Premium, billed once a year. |

The descriptions promise only what Premium delivers today: 100 saved Shadow
videos, 20 YouTube videos, the last 50 Polish reports, and no ads when ads are
on. Keep them in step with `PLAN_LIMITS` in index.html.

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
| `APPLE_BUNDLE_ID` | var | `com.bemastery.app` |
| `APPLE_ENVIRONMENTS` | var | `Sandbox` (staging) / **`Production,Sandbox`** (production: App Review buys with Sandbox accounts **against the production build**, so a production Worker that refuses Sandbox fails review) |
| `APPLE_ROOT_SHA256` | var (public) | `63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179` (SHA-256 of AppleRootCA-G3.cer, downloaded from apple.com on 2026-09-26; re-check it yourself) |
| `APP_ACCOUNT_SECRET` | **secret** | 32+ random characters. It must be different per environment, and **must never change** once purchases exist: the appAccountToken of every purchase is derived from it. |

## Agreements, tax and banking
The paid-apps agreement, tax forms and bank account must be active in App Store
Connect before any subscription can be tested in TestFlight or sold. Only the
Account Holder can do this.
