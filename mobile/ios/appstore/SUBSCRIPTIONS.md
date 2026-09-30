# App Store Connect — BE Mastery Premium subscriptions

> **ONE OFFER (owner, 30 September 2026).** The app sells a single annual
> subscription at **US$24.99** with a **3-day free trial**. The monthly product
> stays defined so that anyone who ever bought one keeps Premium and can manage
> it, but it is **not offered anywhere in the app** — `premOffer()` returns the
> annual plan only.
>
> Premium was excluded from version 1.1.0. For the release that turns it on,
> everything below must be entered in App Store Connect first.

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
| Product ID | Reference name | Duration | Price (USA) | Introductory offer | Level | Offered in app |
|---|---|---|---|---|---|---|
| `premium_annual` | Premium annual | 1 year | **US$24.99** | **Free trial, 3 days, new subscribers only** | 1 | **yes — the only offer** |
| `premium_monthly` | Premium monthly | 1 month | US$4.99 | none | 1 | no (kept so an existing subscriber is honoured) |

**The price is never written in the app.** `premOfferHTML()` prints whatever
StoreKit returns for `premium_annual`, and the renewal line under the CTA
(`prem.then`) prints the same figure. If App Store Connect says something other
than $24.99, the app will say that instead — which is the required behaviour
(Apple 3.1.2), not a bug. Setting the price here is the only way to change it.

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
| premium_annual | Annual Premium | AI speaking analysis, AI verbal feedback, advanced progress, 30- and 90-day analytics and the AI Coach. Billed once a year. |
| premium_monthly | Premium (monthly) | The same Premium, billed monthly. |

The descriptions promise only the capabilities Premium actually grants —
`CAPABILITIES` in `backend/entitlements/src/entitlement-core.js`, which is the
same list the app's `ENT_CAPS` and the paywall's benefit rows read. Ad-free is
deliberately absent while `ads_enabled` is off: there are no ads to remove yet.
Keep this table in step with that list.

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
