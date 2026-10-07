# iPhone app ↔ Play app — parity (6 Oct 2026)

Owner: "make sure everything that works in the Apple version works on Android."
The Play app is a Trusted Web Activity: Chrome showing app.lomonec.com. It runs the
same index.html as the iPhone shell, without the iPhone's native plugins, so every
difference sits behind `IS_IOS_APP` (iPhone) or `isPlayApp()` (Play app, added today:
Android + Chrome's `android-app://com.bemastery.app` referrer or the app's `?wid=`).

## Closed today (staging, be12-v646)

| Gap | Fix |
|---|---|
| Home V2 was iPhone-only (`FLAGS_IOS`) | The Play app gets the same store-app defaults (`flag()` → `isPlayApp()`). |
| Billing: Play users were told to "get it from Google Play"; no store retry; failures reported as provider `none`; diagnostics always `no_store` | Same "close and reopen" message as iPhone, the same retry, `google_play`, `play_no_products` / `no_digital_goods`. |
| Blocked microphone said "allow it in your browser" | `mic.blocked_play`: touch and hold the icon → Site settings → Microphone → Allow (the TWA's `enableSiteSettingsShortcut`). 15 languages, machine translation. |
| Widgets: no plan locks, no Recommendations widget | Built earlier today on both platforms (docs/ANDROID_WIDGET.md). |
| **Google / Apple sign-in in the installed Play app** | Code ready, needs three owner steps — below. |

## Google and Apple sign-in in the Play app — what is left (owner)

Why it is missing: Firebase's helper page is on `be-mastery.firebaseapp.com`; the
installed app has no popup opener, and a redirect cannot come back because Chrome
partitions storage by site. The fix is Firebase's own "proxy" option:
`backend/auth-proxy` (Worker `be-auth`) serves `/__/auth/*` from **auth.lomonec.com**,
the same site as the app. The client switches with the flag `auth_proxy_enabled`
(OFF everywhere until these are done):

1. Deploy the Worker (creates the DNS record). **Staging DONE 6 Oct 2026** — `be-auth-staging`
   on auth-staging.lomonec.com (version 59a6dd3d): handler / iframe / handler.js answer 200,
   Apple's POST is forwarded, any other path 404. Production: not yet.
   `cd backend/auth-proxy && npx wrangler deploy --env staging` (auth-staging.lomonec.com,
   validation project) and later `--env ""` (auth.lomonec.com).
2. Google Cloud console → APIs & Services → Credentials → the Firebase **Web client**
   (auto-created) → Authorised redirect URIs → add
   `https://auth.lomonec.com/__/auth/handler` (and `https://auth-staging.lomonec.com/__/auth/handler`
   on the validation project's client).
3. Apple Developer → Identifiers → the **Services ID** used by Firebase's Apple provider →
   Return URLs → add the same URL(s).
**Staging DONE 7 Oct 2026:** Google client redirect URI + JS origins added (be-mastery-test), Apple Services ID `com.lomonec.bemastery.signin` Website URLs set (auth-staging / auth / both firebaseapp.com hosts, comma-separated), Apple enabled in the test project; both providers' own sign-in pages open through auth-staging.lomonec.com; `auth_proxy_enabled:true` in FLAGS_STAGING (be12-v647). **Owner confirmed on an Android phone, 7 Oct 2026 (be12-v648):** sign-in from the welcome screen lands in the app; a new account finishes onboarding with the provider's first name.
Production still needs: deploy `--env ""` (auth.lomonec.com), the production Google web client (`847739483036-…`) redirect URI `https://auth.lomonec.com/__/auth/handler`, `auth.lomonec.com` in the production project's Authorized domains, then `auth_proxy_enabled:true` and `social_signin_web_enabled:true` in FLAGS_DEFAULT.
`social_signin_web_enabled` must also be on (it is on staging, off in production).

## Still different, by platform (not fixable in the web layer)

- **Ads**: the iPhone app uses AdMob natively; a TWA cannot host AdMob. Ads are off in production anyway.
- **Lock-screen widgets**: iOS only — Android has no lock-screen widget surface for apps.
- **Rating**: the Play app opens the listing (Play's in-app review needs native code a TWA lacks).
- **Deleting an account that has Apple linked**: needs Apple's one-time code, which only the
  native Apple sheet gives; the Play app asks the learner to delete it on an iPhone (rare: until
  step 1–3 above, Apple sign-in does not exist on Android).
- **Widget taps while the app is already open** arrive by relaunching the launch URL (TWA), not a
  live channel; the places reached are the same.

## Android is ahead of iPhone

Notifications (web push through Chrome: images, repeated invites, swipe-to-rest), vibration,
and the rating card. The iPhone's push still waits for the APNs key (docs/IOS_NOTIFICATIONS.md).

## Still to ship on Android

- **The new AAB** (versionCode 10, versionName 1.1.1 — set in playstore/twa-manifest.json on
  6 Oct 2026; the staging manifest keeps 9, the internal-test build): the widgets live in the native shell (docs/ANDROID_WIDGET.md §3).
- **be-widget in production**: create the D1, deploy, set `WIDGET_API` — until then the
  production page publishes nothing to the Android widget.

Tests: `tests/play-parity.mjs` (8, served as app.lomonec.com on an Android user agent),
`backend/auth-proxy/test/run.mjs` (6).
