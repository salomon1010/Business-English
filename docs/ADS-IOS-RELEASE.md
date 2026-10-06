# iOS ads + production entitlements — what is built, and what only a console or a device can finish

2 October 2026. Written for whoever runs the release, not for a reader who
already knows the ad system: for that, read `docs/ADS-ARCHITECTURE-AUDIT.md`
first, which describes the policy layer this work plugs a provider into.

Nothing in here is switched on. Production is `billing_enabled=false`,
`ads_enabled=false`, `ENT_API=""`, and the AdMob identifiers in `Info.plist`
are placeholders that the plugin refuses in a production build. Switching any
of it on is the owner's decision and needs the console work in §3.

**Environment boundary (owner, 2 October 2026): this work is staging and
development only.** No production web deploy, no production Worker deploy, no
production secret, no production flag, no store monetisation activation. One
production resource was created earlier the same day under the previous brief,
before that boundary was set: the D1 database `be-entitlements`
(`ead9ecb9-…`), migrated 0001-0004 and **empty**. No Worker references it —
`be-entitlements` does not exist as a Worker on the account — so it cannot
serve a request. It is one command to remove (`npx wrangler d1 delete
be-entitlements`), which is itself a production change and so waits on the
owner. The `[vars]` block in `wrangler.toml` is a local, uncommitted,
undeployed file change.

## 1. What was built

| Piece | Where | State |
|---|---|---|
| Prices $19.99 / year, $2.99 / month (owner's tiers, 5 Oct 2026) | `mobile/ios/ios/App/App/BEMastery.storekit` | done (Xcode's local store only — the app always draws the store's own `displayPrice`) |
| Production entitlement D1 | `be-entitlements`, `ead9ecb9-7f95-45f7-a751-9d09c62febc4` | created and migrated 0001–0004 |
| Production entitlement config | `backend/entitlements/wrangler.toml` `[vars]` | written; four secrets and two RTDN values still missing (§3) |
| AdMob provider | `mobile/ios/ios/App/App/Plugins/BEAdsPlugin.swift` | written, builds clean (Debug + Release) against GMA 12.14.0 and UMP 3.1.0 |
| Plugin registration | `BEBridgeViewController.swift` | done |
| SPM dependency | `App.xcodeproj` → `swift-package-manager-google-mobile-ads` ≥ 12.0 | done; UMP is a *product of that package*, not a second package |
| The JS bridge | `index.html` → `beNativeAdsInit()`, `window.BENativeAds` | done |
| Activation guard | `index.html` → `adsSystemLive()` | done |
| Consent (UMP) | `BEAdsPlugin.resolveConsent()` | done, resolved before the SDK starts |
| Privacy | `Info.plist`, `PrivacyInfo.xcprivacy`, `privacy.html` §7b | done |
| Tests | `tests/ios-ads.mjs` (72 checks) | passing |

### Two formats, and only two

Interstitial and Native Advanced. `BEAdsPlugin.formats` is
`["interstitial", "native"]` and nothing else is implemented — **rewarded and
sponsored stay disabled**, as they were. The reward routes in
`backend/entitlements` are untouched and every reward kind still ships off.

### Why there are five gates before an ad SDK is ever touched

`beNativeAdsInit()` builds `window.BENativeAds` only when **all** of these
hold, and it is tried once per visit:

1. `IS_IOS_APP` — the App Store shell;
2. `flag("ads_enabled")` — off in production;
3. `adsTrackAllows()` — **General English only** (owner's tier spec, 5 Oct
   2026, `docs/TIERS.md`; it returns `isGeneralEnglish()`). Welding shows no
   ad on any plan, and Premium shows none anywhere. An earlier note the same
   day had put every programme in the ad system; that was reversed by the
   tier spec. This is the one line that decides which programme carries ads;
4. `adsSystemLive()` — see below;
5. the plugin's own `configure()` answered `available: true`, which means the
   AdMob ids are real *and* Google's consent state is resolved.

Until then `AdProviders.native.available()` is false and the provider is
`none`. There is no state in which the app has an SDK but no policy.

`adsSystemLive()` is the belt-and-braces guard asked for in this sprint:
`!!entApiBase() && flag("billing_enabled")`. A real network may only run where
the plan system that switches ads off for Premium is actually live. Without an
entitlement service every learner looks Free to the client, and with billing
off nobody could buy their way out of the ads they would then see. The `mock`
provider is deliberately unaffected — it is localhost/staging only and sells
nothing.

### Consent

`configure()` runs UMP **before** `MobileAds.shared.start()`:
`requestConsentInfoUpdate` → `ConsentForm.loadAndPresentIfRequired` → read
`ConsentInformation.shared.canRequestAds`. Four outcomes, all handled:

- **not yet answered** → the form is presented where the region requires it;
- **granted** → `canRequestAds` true, the SDK starts, ads may be requested;
- **denied** → `canRequestAds` false → `available:false, reason:"consent"` → no
  provider, so no request is ever made;
- **form unavailable or the update failed** → the same: no provider. We do not
  guess at a lawful basis.

**Non-personalised only.** Every `Request()` carries `npa=1`. There is no
`ATTrackingManager` call, no IDFA use and therefore **no App Tracking
Transparency prompt** — which is why `Info.plist` has no
`NSUserTrackingUsageDescription` and no `SKAdNetworkItems` list.

### Native Advanced, honestly described

A Google native ad is a platform view, so the shell draws it **over** the
rectangle the page measured. The page keeps the "Advertisement" label, the
"Remove ads with Premium" link and the reserved height (132 px); the creative
itself is `NativeAdView` with Google's required "Ad" badge. `moveNative`
follows the slot as the page scrolls or re-renders — it follows the
*placement*, not one DOM node, because `placeNative()` re-appends a kept slot
after a re-render. `hideNative` runs the moment the page has no slot for that
placement, so a plan change or `AdManager.withdraw()` takes the creative off
the screen too.

### Staging device QA without an AdMob account

A TestFlight build is a Release configuration, so the placeholder ids would
make the ad path untestable on a device — which would leave every row in §4
permanently unrunnable. `BEAdsAllowTestUnits` in `Info.plist` (**true on the
`staging` branch** since 2 October 2026, false on `main`) lets a staging build
use Google's own test units instead. It is
double-locked: `BEAdsPlugin.testUnitsAllowed` also requires a **Sandbox
receipt** (`Bundle.main.appStoreReceiptURL.lastPathComponent != "receipt"`), so
a build sold through the App Store refuses test creatives even if the key is
left switched on by mistake. Add the test device in AdMob → Settings → Test
devices as well, once an AdMob account exists, so nothing counts as live
traffic.

### Fail-closed identifiers

`GADApplicationIdentifier`, `BEAdsInterstitialUnitId` and `BEAdsNativeUnitId`
are placeholders. The plugin regex-validates their shape; in a **production**
build an invalid id means `available:false, reason:"not_configured"`, so
Google's test creatives can never reach a paying audience. The SDK is never
started while an id is invalid, so there is no launch-time exception either.

The **app id is set per build configuration**, not in the plist. The Google
Mobile Ads SDK reads `GADApplicationIdentifier` itself when it starts, so the
plugin's test-unit fallback cannot help it, and starting the SDK on an invalid
value raises an exception Swift cannot catch. `Info.plist` therefore carries
`$(BE_ADS_APP_ID)` and the Xcode target sets that build setting:

| Configuration | `BE_ADS_APP_ID` | Effect |
|---|---|---|
| Debug | `ca-app-pub-3940256099942544~1458002511` (Google's public test app id) | staging device QA can run |
| Release | `ca-app-pub-REPLACE~REPLACE` | the SDK never starts until the owner pastes the real AdMob app id into the Release configuration |

This note lives here, not in the plist or the project file: Xcode rewrites
both when it saves and discards any comment in them (it did so on 4 October
2026). `tests/ios-ads.mjs` checks XAe and XAf hold the rule.

## 2. What the automated tests do and do not prove

`cd tests && node ios-ads.mjs` — 75 checks, real Chromium, a fake `BEAds`
plugin with the same method names as the Swift. It proves the whole JavaScript
side: the five gates, every "unavailable" path (no Capacitor, no plugin, no
SDK, placeholder ids, consent refused, `configure()` throwing, `available`
with no formats), the interstitial round trip including no-fill and a throwing
provider, the native slot's rectangle, scroll-following and removal, Premium
suppression, and a mid-visit switch to Welding. It also reads the Swift, the
Xcode project, both plists and `privacy.html` off disk.

It cannot prove that Google's SDK fills, that the UMP form appears in an EEA
region, or that the platform view lands exactly over the slot on a real
screen. That is §4.

`tests/ads.mjs` (62) and `tests/monetization-qa.mjs` (31) still pass unchanged
— the policy layer was not rewritten.

## 3. Console work only the owner can do

### App Store Connect
- `premium_annual` — **$19.99 / year** (owner's tiers, 5 Oct 2026; check
  what the console holds and set it to this).
- `premium_monthly` — **$2.99 / month**. A free trial only if the owner
  configures one; the app shows a trial only when the store reports it.
- Both in one subscription group, both offered in the app (annual first,
  "Best value"). `mobile/ios/appstore/SUBSCRIPTIONS.md` places both at
  level 1 (a switch is a crossgrade at the next renewal).
- Paid Applications Agreement active, banking and tax complete — StoreKit
  returns no products until it is.
- Review notes: say that ads are off in this build and that Premium needs a
  Sandbox account; attach the reviewer account from
  `docs/release/REVIEWER_ACCOUNTS.md`.
- Screenshots do **not** need reshooting for ads: none appear while
  `ads_enabled` is false.

### Google Play
- `premium_annual` / base plan `annual` — **$19.99 / year** (the regional
  prices Play derives from it must be re-set by the owner for the new tiers).
- `premium_monthly` / base plan `monthly` — **$2.99 / month**; keep or drop
  the `trial3d` offer as the owner decides — the app shows a trial only when
  Play reports one.
- Both activated in the production track's subscription group; both are
  offered in the app, annual first.

### AdMob
- Register the app (iOS, bundle id `com.lomonec.bemastery`) → copy the **app
  id** into `Info.plist` `GADApplicationIdentifier`.
- Create an **interstitial** unit → `BEAdsInterstitialUnitId`.
- Create a **native advanced** unit → `BEAdsNativeUnitId`.
- Privacy & messaging → publish a **GDPR (EU consent)** message, and the
  **ATT** message may be left unpublished (this release never asks).
- Add the test device's advertising id under Settings → Test devices before
  any device test, so impressions are not counted as live traffic.
- Do **not** create rewarded or sponsored units: nothing requests them.

### be-entitlements (production)
The D1 database exists and is migrated. Before `npx wrangler deploy --env ""`:
```
npx wrangler secret put ADMIN_TOKEN          # >= 32 random chars, owner only
openssl rand -base64 32 | npx wrangler secret put PLAY_TOKEN_KEY
npx wrangler secret put APP_ACCOUNT_SECRET   # >= 32 chars, NOT the staging value
npx wrangler secret put GOOGLE_SA_JSON       # the Play service-account key
```
and two vars that need resources that do not exist yet: a production custom
domain in the `lomonec.com` zone for RTDN (`RTDN_AUDIENCE`) and the production
Pub/Sub push subscription's service account (`RTDN_SA_EMAIL`). Until
`GOOGLE_SA_JSON` is set, Play verification answers 501 and an RTDN push throws
`rtdn_not_configured` — which is the honest behaviour: no half-verified
purchase is ever accepted.

`ENT_API` in index.html stays empty until that Worker is deployed **and** its
`GET /v1/entitlement` has been exercised by a real signed-in account.

## 4. Real-device and store tests — none of these have run

Every row needs a device, a store account or a network no test harness can
stand in for. Nothing below may be reported as done on the strength of §2.

| # | Test | Needs |
|---|---|---|
| D1 | Premium **purchase** completes and the server grants the plan | TestFlight + Sandbox Apple ID + the deployed Worker |
| D2 | Premium **restore** on a second device returns the plan | two devices, same Apple ID |
| D3 | Premium **suppresses ads**: no interstitial, no native slot, anywhere | a Premium account with `ads_enabled` on |
| D4 | **GE Free sees one ad**: finish a session, move on, the interstitial appears over a non-protected page, closes cleanly | AdMob test device |
| D5 | **Welding shows no ad** on any plan and fires no ad event, on the same device, before and after switching tracks (correct again under the 5 Oct 2026 tier spec: `adsTrackAllows()` is `isGeneralEnglish()`) | the events dataset, queried after |
| D6 | **UMP consent** form appears in an EEA region, and the answer is remembered | a VPN or a real EEA device |
| D7 | **NPA**: the request carries `npa=1` (verify in the AdMob request log) | AdMob console |
| D8 | **Consent refused** → no ad request is made at all | repeat D6, refusing |
| D9 | **Offline / provider failure**: aeroplane mode at the break → no frame, no stall, practice continues | device |
| D10 | A native slot **scrolls with the page** and disappears with the slot | device, Home and Progress |
| D11 | An ad never appears over feedback, a recording, a live call or a simulation | device, the eight protected states |
| D12 | Cancellation and expiry return the account to Free, and ads come back | Sandbox, accelerated renewals |
| D13 | Account deletion erases the entitlement row (`DELETE /v1/me`) | the deployed Worker |

Record the results in `marketing/product/practice-partner/DEVICE_CHECKLIST.md`
style — one row per test, with the build, the date and what was observed. An
untested row is reported as untested.
