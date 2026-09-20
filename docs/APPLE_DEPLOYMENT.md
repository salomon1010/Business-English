# BE Mastery — Apple App Store deployment

Written for the person who builds, uploads and releases the iOS app (Lomonec
LLC). Everything here was verified against the repository on 20 Sep 2026
unless marked otherwise. Companion documents: `APPLE_RELEASE_CHECKLIST.md`
(tick list), `APPLE_APP_REVIEW.md` (what to paste for the reviewer),
`../mobile/ios/README.md` (the shell itself), `../mobile/ios/appstore/`
(listing text, privacy answers, screenshots).

## What the iOS app is
The web app in the repository root (`index.html` + data), copied unchanged
into a Capacitor 8.5.2 shell (`mobile/ios/`, Swift Package Manager, no
CocoaPods) and run by WKWebView from the bundle at `capacitor://localhost`.
No native plugins. Bundle id `com.bemastery.app`, display name **BE Mastery**,
iPhone only, portrait, iOS 15.0+. Version **1.1.0**, build **1** (see F).

Because the bundle is frozen at build time, the app does not pick up web
pushes to `app.lomonec.com`; a new App Store build carries them. Feature
flags (`FLAGS_DEFAULT`) are baked in; the runtime switches are the Workers'
`PARTNER_ENABLED` / `LIVE_ENABLED` (see L).

Two things the shell does that the web app does not (both in `index.html`,
behind `IS_IOS_APP`): Google Play references are removed (Apple 2.3.10), and
YouTube plays through `yt-embed.html` on `app.lomonec.com` (see "YouTube relay").

## A. Prerequisites
- A Mac with **Xcode 26 or later** (App Store uploads have required the iOS 26
  SDK since 28 Apr 2026). This repository's Mac has Command Line Tools only —
  no archive was built here.
- Apple Developer Program membership for **Lomonec LLC** and an App Store
  Connect user with *App Manager* or *Admin* on the app.
- Node 20+, `git`, and the repository at the commit you are shipping.
- Network access from Xcode to GitHub (SPM fetches `capacitor-swift-pm 8.5.2`
  on first open).

## B. Xcode setup (once per Mac)
```
sudo xcode-select -s /Applications/Xcode.app
sudo xcodebuild -license accept
xcodebuild -version            # 26.x
cd mobile/ios && npm ci        # pinned by package-lock.json
npm run sync                   # repo root → www/ → ios/App/App/public
npx cap open ios               # resolves the Swift package; wait for "indexing" to finish
```
Never run `pod install`; the project has no Podfile by design.

## C. Apple Developer setup (once per app)
1. Certificates, Identifiers & Profiles → Identifiers → **App ID**
   `com.bemastery.app`, explicit, description "BE Mastery". Capabilities:
   none (no push, no Sign in with Apple, no associated domains).
2. App Store Connect → My Apps → **+ New App**: platform iOS, name
   *BE Mastery — Business English*, primary language English (U.K.), bundle id
   `com.bemastery.app`, SKU `be-mastery-ios`, full access.
3. Users and Access → Integrations → **App Store Connect API** (optional, for
   command-line uploads): create a key with *Developer* role, download the
   `.p8` **once**, keep it outside the repository (`~/.appstoreconnect/private_keys/`).
   Nothing in git may ever contain it (`mobile/ios/.gitignore` blocks
   `AuthKey_*`, `*.p8`, `*.p12`, `*.mobileprovision`, `ExportOptions*.plist`).

## D. Signing
The project uses **automatic signing** and has **no team selected** (checked:
`DEVELOPMENT_TEAM` absent from `project.pbxproj`). Once, in Xcode: target
**App** → *Signing & Capabilities* → tick *Automatically manage signing* →
Team **Lomonec LLC**. Xcode creates the Apple Distribution certificate and the
App Store profile itself. Commit the resulting one-line change to
`mobile/ios/ios/App/App.xcodeproj/project.pbxproj` and nothing else.
Do not import certificates by hand; do not commit any signing file.

## E. Build (every release)
From the repository root, on the exact commit you ship:
```
cd mobile/ios
node scripts/check-release.mjs --live      # must end with PASS; read every WARN
node scripts/bump-build.mjs                # build + 1 (or --version X.Y.Z --build 1)
npm run sync                               # refresh the web bundle after ANY web change
node scripts/check-release.mjs             # bundle freshness now PASS
git add ios/App/App.xcodeproj/project.pbxproj package.json && git commit -m "ios: build N"
```
`check-release.mjs` proves the web app parses, translations are complete, the
project identity/permissions are right, nothing secret is tracked, and (with
`--live`) that be-polish, be-events and be-partner answer
`capacitor://localhost`. It cannot prove the app builds — that is F.

## F. Archive
Xcode: scheme **App**, destination *Any iOS Device (arm64)*, **Product →
Archive**. Or headless (the shared scheme is committed):
```
cd mobile/ios/ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/App.xcarchive archive
cp ../../appstore/ExportOptions.example.plist ExportOptions.plist   # git-ignored; set teamID
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist
```
Version and build come from `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`
(both configurations, kept equal by `bump-build.mjs`). App Store Connect
refuses a build number it has already seen for that version.

Why 1.1.0 (1): Google Play is at 1.0.1 (versionCode 8). The iOS app ships
Practice Partner and Shadow Studio V2, which Play's 1.0.1 listing predates, so
the first iOS build is 1.1.0; the build number restarts at 1 because Apple
counts per platform. Keep the two stores' *marketing* versions aligned from
here on (next Play upload: 1.1.0).

## G. TestFlight
1. Upload: Xcode Organizer → *Distribute App* → *App Store Connect* → Upload;
   or `xcrun altool --upload-app -f build/export/App.ipa -t ios --apiKey KEY_ID --apiIssuer ISSUER`;
   or the Transporter app.
2. Export compliance is answered by `ITSAppUsesNonExemptEncryption = NO` in
   Info.plist (HTTPS only) — no questionnaire per build.
3. TestFlight → the build → *Test Information*: what to test = the list in
   `APPLE_RELEASE_CHECKLIST.md` § Device; add internal testers (Lomonec
   team). External testers need a Beta App Review — same notes as I.
4. **The device checks in the checklist are done on this build.** No physical
   device was available while this document was written: nothing below is
   "tested" until a tester marks it in the checklist.

## H. App Store Connect
Paste, never upload by script:
- Listing: `mobile/ios/appstore/METADATA.md` (name, subtitle, description,
  keywords, promotional text, URLs, copyright, What's New).
- Screenshots: `mobile/ios/appstore/screenshots/iphone-6.9/` (1320×2868). The
  plan and the two deliberate omissions are in `SCREENSHOTS.md` next to them.
- App Privacy: `mobile/ios/appstore/PRIVACY_ANSWERS.md`, row by row.
- Age rating: METADATA.md § Age rating (user interaction: yes; 18+ gate in-app).
- App Review Information: `APPLE_APP_REVIEW.md` § Notes (paste), plus the two
  demo accounts in the sign-in fields (create them on production first, see
  APPLE_APP_REVIEW.md § Demo accounts). Contact: contact@lomonec.com.
- Version release: **Manually release this version** (so the backend switches
  can be checked one last time before users see it).

## I. App Review
Submit from the version page. Expect one round. Guidelines this app touches
and the prepared answer:
| Guideline | Risk | Answer / evidence |
|---|---|---|
| 4.2 Minimum functionality (web wrapper) | medium | Offline 12-week programme from the bundle, native mic/camera use, no browser chrome; the app is the product, not a site in a frame. |
| 1.2 User-generated content | medium | Practice Partner: 18+ consent, first names only, no text chat, automatic contact-detail screening, one-tap report and block, two reports suspend; AI always labelled. |
| 5.1.1 Data collection | low | Consent sheet before any partner data; privacy policy in-app and at the URL; PrivacyInfo.xcprivacy matches the App Privacy answers. |
| 5.1.1(v) Account deletion | low | Profile → Account → Delete account, in-app, deletes Firebase + partner records. |
| 2.3.10 Other platforms | low | No Google Play links/badges under `IS_IOS_APP` (About page gets `?ios=1`). |
| 2.1 Performance | medium | Shadow Studio video needs `https://app.lomonec.com/yt-embed.html` live (see YouTube relay). Live calls are off (`LIVE_ENABLED="0"`) so the reviewer never sees a dead call button. |
| 3.1.1 Payments | none | No purchases, no subscriptions. |
If rejected, reply in Resolution Center with the matching row; do not resubmit
a new build unless the rejection names a bug.

## J. Release
After approval: Pricing (free), availability (all territories), then
**Release this version**. Optionally phased release. Announce nothing until
the App Store page resolves (up to 24 h). Then update `CLAUDE.md` ("No iOS App
Store presence" is stale from that moment), `flyer.html`'s badges and
`manifest.json`'s `related_applications` if an App Store badge is wanted.

## K. Rollback
- **A binary cannot be rolled back** on the App Store. Options: *Remove from
  sale* (Pricing and Availability) or ship a fixed build with a higher build
  number and request an expedited review.
- **Practice Partner** off at runtime: `backend/partner/wrangler.toml` →
  `PARTNER_ENABLED = "0"` → `npx wrangler deploy` (the app shows "unavailable"
  within one poll). **Live**: `LIVE_ENABLED = "0"` the same way.
- **YouTube relay**: served by `main` on GitHub Pages; revert the commit on
  `main` to change it. A missing relay page surfaces in the app as the
  video-error state after 20 s, not as a crash.
- Web-only fixes do not reach the iOS app until the next build (E–G).

## L. Backend deployment (state on 20 Sep 2026, verified with probes)
| Worker | Version | Switches | Accepts `capacitor://localhost` |
|---|---|---|---|
| be-polish | `81e89f20` (19 Sep 2026) | — | yes |
| be-events | `04a95396` (20 Sep 2026) | — | yes |
| be-partner | `9a9af35b` (20 Sep 2026) | `PARTNER_ENABLED="1"`, `LIVE_ENABLED="0"` | yes |

Nothing needs deploying for the iOS app. For any later backend change, in
this order, one at a time, verifying between steps:
1. `be-events` (`cd backend/events && npx wrangler deploy`) — event names first.
2. `be-partner` with the switch **closed** if the change is risky
   (`PARTNER_ENABLED="0"`), migrations `npx wrangler d1 migrations apply be-partner --remote`.
3. `curl https://be-partner.nore-ngou.workers.dev/health`, then an authenticated
   `/me` from the app, then D1 counts (`wrangler d1 execute be-partner --remote`).
4. TURN: set `TURN_KEY_ID` / `TURN_KEY_TOKEN` secrets and test a Wi‑Fi/cellular
   call on **production** (DEVICE_CHECKLIST I-42) **before** `LIVE_ENABLED="1"`.
   Never enable live without that test.
5. Open the switch: `PARTNER_ENABLED="1"` → deploy → `/health` shows `enabled:true`.
6. `be-polish` only when its allow-list or model routing changes.
Rollback for each step is the previous version (`npx wrangler rollback`) or the
switch.

## M. Production verification (after any deploy, and before submitting)
```
cd mobile/ios && node scripts/check-release.mjs --live
cd ../../tests && BASE=https://app.lomonec.com node smoke.mjs      # 27/27 on the live site
curl -s -o /dev/null -w '%{http_code}\n' "https://app.lomonec.com/yt-embed.html?v=MZAjfsyJa1U&o=capacitor%3A%2F%2Flocalhost"   # 200
curl -s https://be-partner.nore-ngou.workers.dev/health              # {"ok":true,"enabled":true}
```
Then on a phone with the TestFlight build: `APPLE_RELEASE_CHECKLIST.md` § Device.

## N. Releasing a future version
1. Land the web change on `main` first; wait for app.lomonec.com to flip
   (`sw.js` cache name) and run the live smoke.
2. `node scripts/bump-build.mjs --version X.Y.Z --build 1` for a new marketing
   version, or `bump-build.mjs` alone for a re-upload of the same version.
3. E → F → G → device checks → H (What's New) → I → J.
4. Keep Play's next `appVersionName` equal to the iOS marketing version.

## YouTube relay (why `yt-embed.html` exists)
Inside the shell the app's origin is `capacitor://localhost`. WKWebView sends
no `Referer` from a custom scheme, and since 2025 YouTube's embedded player
refuses to play without an embedder identity (**error 153**) — confirmed in
Capacitor issue #8205, cordova-plugin-ionic-webview #701 and Apple's forums.
So under `IS_IOS_APP` the Shadowing Studio does not embed YouTube directly:
it frames `https://app.lomonec.com/yt-embed.html?v=ID&start=N&o=capacitor://localhost`
(an https page, which carries a Referer). That page hosts the real IFrame
player and relays it over `postMessage`; `RemoteYT` in `index.html` stands in
for `YT.Player` with the same methods the studio uses. Origins are checked in
both directions; nothing about the learner crosses the bridge.

Consequences:
- `yt-embed.html` must be **live on app.lomonec.com** (merged to `main`,
  Pages deployed) before anyone tests Shadow Studio in a TestFlight build.
- Shadow Studio needs a connection in the app, as it does on the web.
- `tests/ios-yt-relay.mjs` proves the bridge with a stub relay (deterministic:
  ready, clock, seek, rate, pause, origin check, destroy, timeout → error
  state) and then runs the real `yt-embed.html` against YouTube from a second
  origin in headless Chromium — on 20 Sep 2026 that passed too (player ready,
  title and duration through the relay, seek reflected). What remains a
  device check is WKWebView itself: the `capacitor://` parent and iOS
  autoplay/inline rules.

## Known limitations of the shell (state them, do not hide them)
- No `SpeechRecognition` in WKWebView: the offline transcription fallback the
  web app has on Chrome is absent; every recognition feature already checks
  `SR` and shows its "unavailable" message, and the primary path (online
  scoring through be-polish) is unaffected.
- No service worker and no Web Push: daily reminders fire only while the app
  is open (the in-app path); the `Notification` API is absent and every use is
  guarded.
- Google sign-in stays hidden (as on the web); e-mail/password only.
- The About page's "Private by design" card and the help centre's privacy
  answers were corrected in this release (recordings do leave the device when
  you send them). The 15 translated help centres received only those two
  corrections; their dictionaries had drifted before this work (a full
  rebuild would drop ~48 lines per language back to English) — a separate,
  pre-existing task.
- `acc.data_sub` ("Everything stays on this device…") in App Setup → Data
  describes the local store and backup; with an account, progress syncs. Not
  changed here; worth a wording pass.
