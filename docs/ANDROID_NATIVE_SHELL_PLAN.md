# Android native shell — plan (8 Oct 2026)

**Status (10 Oct 2026): phases 1–6 BUILT on `staging`, NOT released.** The Play
listing still serves the TWA. Built: the shell (1), the web layer's platform check
(2), the Workers' allow-lists, deployed (3), AdMob (4), Play Billing (5), signed
release bundles, and notifications (6 — `BEPushPlugin.java` + `BEMessagingService.java`,
be-push's FCM sender, `tests/android-push.mjs`, `backend/push/test/fcm.mjs`). The
§6 data risk has its step too: today's Play app asks a signed-out learner with
progress to sign in (`keepNudge`, flag `play_keep_progress_enabled`,
`tests/keep-progress.mjs`) — it reaches learners with the next merge to `main`,
so ship it well before the switch.

**Notifications set-up (done 10 Oct 2026):** Android app `com.bemastery.app` registered in
`be-mastery` (1:847739483036:android:e341d8aa18ae00d44ece59) and `be-mastery-test`
(1:724002405539:android:c0740eda3b9de789fd5316); their `google-services.json` files live in
`~/.config/be-mastery/firebase/` and `scripts/build.sh` / `release.sh` copy the matching one
in (never committed). FCM API enabled; service account `fcm-sender@<project>` with
`roles/firebasecloudmessaging.admin` only, one key each, stored only as `FCM_SA_JSON` on
`be-push-staging` and `be-push`. be-push-staging DEPLOYED (b4601bbc) and proven against
Google (a made-up token was refused and its row dropped — no auth error). **Production be-push DEPLOYED in full (owner, 10 Oct 2026): version 0fc0eb02**, from the
repo (it had run 29 Sep code): FCM, APNs (still off — `APNS_KEY_ID` is empty and there is no
`APNS_KEY_P8`), nudge pictures, the `https://localhost` origin, KV marks. Crons unchanged
(`* * * * *`, `*/10 * * * *`). Verified: `/key`, CORS for the web / Android / iOS origins, a
made-up FCM token refused by Google and dropped, cron runs without exceptions. Rollback:
`npx wrangler rollback 2b335aa2-1d8d-4bb0-a8ee-9c7b4465f6f8 --name be-push` (the old code
with the FCM secret).
**Google sign-in (phase 7, 10 Oct 2026, vc 14 on internal testing):** `BEAuthPlugin.java`
(Credential Manager, the iOS `BEAuth` contract; Apple answers `apple:false`). The four
signing fingerprints (Play signing SHA-1 `cd:32:bf…`, upload SHA-1 `75:a1:fa…`, both
SHA-256s) are on the Firebase Android app in **be-mastery** — Google allows one Android
OAuth client per package + certificate across ALL projects, so be-mastery-test cannot hold
them. The server client id is be-mastery's web client (`be_google_web_client_id`). A
STAGING build therefore needs be-mastery-test → Authentication → Google → "Safelist client
IDs from external projects" = that client id (console only; no API found). Apple on
Android: not built (decision D2).

**Still to build:** native Google sign-in (7), the widget port (7), device tests and
the staged release (8).

Original plan (8 Oct 2026) follows. Owner decision 8 Oct 2026: replace
the Play app's Trusted Web Activity (TWA) with a native Capacitor Android shell,
like the iOS app, so Android can show AdMob ads (option A; option B — web ads in
the page — was rejected as the less reliable route). This reverses ADR-9.1 in
`docs/PHASE9-ARCHITECTURE-DECISION.md`, which kept the TWA and named this shell as
the future alternative.

## 1. What stays the same

- **The Play listing and package: `com.bemastery.app`.** The new app is an
  UPDATE to the existing listing, not a new app. Existing installs upgrade in
  place; ratings, reviews and installs are kept.
- **The signing chain.** Play App Signing re-signs every upload; the new AAB must
  be signed with the same **upload key** as today (`3D:E6:6D…`,
  `playstore/README.md:42`). `android.keystore` is not in the repo — the owner
  keeps it; it is needed for every release.
- **The server side of Play Billing.** `backend/entitlements` verifies
  `{provider:"google_play", productId, purchaseToken}` (`billing.js:33-49`,
  `google-play.js`) — exactly what the native Play Billing Library returns. No
  server change, except a comment.
- **Product ids** `premium_monthly` / `premium_annual`, the 3-day trial, and the
  rule that Premium removes ads.
- **The ad rules.** Ads only on General English, only after Premium is live
  (`adsSystemLive`), consent (UMP) before the first request, non-personalised
  ads, and **test units in every debug / internal build** (the iOS rule from
  a7df3908).

## 2. What changes

| Today (TWA) | Native shell |
|---|---|
| Chrome draws app.lomonec.com | A WebView draws the web code **bundled in the app** (like iOS) — see decision D1 |
| A website push updates Android at once | Web changes reach Android with the next app release (unless D1 = remote) |
| Play Billing through Chrome's Digital Goods API | Native Play Billing Library 8 → new `BEBilling` plugin |
| Web push (VAPID) through Chrome | Firebase Cloud Messaging → new `BEPush` plugin + an FCM route in be-push |
| Widget fed by be-widget over `?wid=` | Widget fed directly by the app (as on iOS); be-widget can retire |
| Google sign-in through auth.lomonec.com popup rules | Native Google sign-in (Credential Manager) → `BEAuth` plugin |
| No ads possible | AdMob + UMP → `BEAds` plugin |
| Detected by referrer `android-app://` / `?wid=` (`isPlayApp`, `index.html:24241`) | Detected by `Capacitor.getPlatform()==="android"` |

## 3. Owner decisions needed before work starts

- **D1 — bundled or remote web code.** *Bundled* (iOS model, recommended): the
  app works offline from first launch and behaves the same as iOS, but every web
  change needs a Play release to reach Android. *Remote* (`server.url` =
  app.lomonec.com): keeps "push the website, Android updates", but Capacitor
  does not recommend it for production and the native bridge on a remote page
  needs extra care. This is the biggest product trade-off in the plan.
- **D2 — Apple sign-in on Android.** Keep it (through a browser tab, as the web
  does) or offer Google + email only on Android.
- **D3 — when to cut over.** The plan assumes the switch ships just before the
  Premium launch, because ads go live with Premium anyway.

## 4. Work, in order

Each phase ends testable on its own; nothing reaches production before phase 8.

1. **Project.** Add `@capacitor/android` to `mobile/` (beside iOS, same
   `sync-web.mjs`, which already has a `--staging` mode); `npx cap add android`;
   package `com.bemastery.app`, minSdk 23, targetSdk 36 (as `twa-manifest.json`).
   App icon, splash, name, deep links (`bemastery://`), microphone and camera
   permissions (WebView `onPermissionRequest` → `RECORD_AUDIO` / `CAMERA`).
2. **Web layer: one platform check.** Add `IS_ANDROID_APP`; make `isPlayApp()`
   true for it; turn the iOS-only guards that are really "store app" guards into
   "native app" guards (`beNativeAdsInit`, `beNativeBilling`, `beNativePush`,
   `beNativeWidget`, `beNativeAuth`, the store-app flags `FLAGS_IOS`). Keep the
   Apple-specific ones (StoreKit, App Store links) iOS-only. The TWA paths stay,
   so the current Play app keeps working until it is replaced.
3. **Allow-lists.** Add the Android shell's origin (`https://localhost` by
   default in Capacitor) to every Worker's CORS list beside `capacitor://localhost`:
   be-polish, be-entitlements, be-partner, be-events, be-push, be-mail,
   be-widget. Then **redeploy those Workers** (production deploys — owner go-ahead).
4. **BEAds (Kotlin).** Mirror `BEAdsPlugin.swift`: same jsName and methods
   (`configure / load / isReady / show / dismiss / showNative / moveNative /
   hideNative`), Google Mobile Ads + UMP, ids from `AndroidManifest` / resources
   (app `~8875603763`, interstitial `/7191910447`, native `/1935625045`),
   **test units in debug and internal-testing builds**, `npa=1`.
5. **BEBilling (Kotlin).** Play Billing Library 8: products, purchase,
   owned purchases, acknowledge only after our server answered (as today),
   pending → `payment_pending`. Feeds the existing `Billing` code as a provider
   like `BillingProviders.play`, with the same evidence shape.
6. **BEPush + be-push FCM.** FCM token registration in the app; be-push gains an
   FCM sender beside VAPID and APNs (`sendOne` branches per row, as it does for
   APNs). Needs a Firebase Android app config (`google-services.json`, owner
   step in the Firebase console) and an FCM service-account secret on be-push.
7. **BEAuth + BEWidget.** Native Google sign-in into the same Firebase project;
   Apple per D2. Port `playstore/android-widget/` (Java, RemoteViews) into the
   shell and feed it locally, as iOS does.
8. **Release.** Build the AAB (versionCode above today's 10), Play
   **internal testing** → closed testing → production with a **staged rollout**
   (for example 10 %, then 50 %, then 100 %), watching crashes and ANRs in Play
   Console. Update the Data safety form (ads, FCM) and privacy.html before
   production.

## 5. What gets tested

- Every existing web suite still passes (the TWA paths are kept).
- New: a platform-detection suite (Android shell vs TWA vs browser), and the
  Android equivalents of `ios-ads.mjs` (test units locked to debug/internal),
  `ios-storekit.mjs` (billing evidence), `ios-push.mjs` (FCM registration).
- Kotlin unit tests for the id checks and the test-unit lock.
- On a real phone (internal testing): install over the current TWA and keep the
  learner's progress; microphone in Shadow Studio and Executive Polish; a YouTube
  clip plays (the iOS app needed a relay — `yt-embed.html` — for a missing
  Referer; Android must be checked); a sandbox purchase and its acknowledge; a
  push with the app closed; the widget; sign-in; a test ad after consent.

## 6. Risks

- **No rollback by downgrade.** Play never installs a lower versionCode. If the
  shell misbehaves after release, the fix is a NEW build — the old TWA rebuilt
  with a higher versionCode — and the staged rollout is the safety net.
- **Learner data on upgrade.** The TWA keeps progress in Chrome's storage for
  app.lomonec.com; the shell's WebView starts empty. Signed-in learners get
  their progress back from the cloud; **signed-out learners would lose it** unless
  the cut-over prompts them to sign in (or back up) first. This needs its own
  step in phase 2 before any release.
- **Releases get slower** if D1 = bundled: web fixes wait for a Play review.
- **Microphone and YouTube inside a WebView** behave differently from Chrome
  and must be proven on a device before release.

## 7. Not in this plan

Rewarded ads (they stay disabled), welding-programme ads (General English only
by rule), and any change to the iOS app.
