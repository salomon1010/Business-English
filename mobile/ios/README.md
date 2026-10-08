# BE Mastery — iOS app (App Store build)

The App Store app is the web app in the repository root, bundled inside a
Capacitor shell. Nothing is rewritten: `scripts/sync-web.mjs` copies the web
files into `www/`, `npx cap sync ios` copies them into the Xcode project, and
WKWebView runs them from the bundle at the origin `capacitor://localhost`.

Why this shape: the app is a single `index.html` with its data files and no
build step. A local bundle (not a remote URL) keeps the app usable offline,
keeps the recordings/scoring/partner flows identical to the web, and is what
Apple expects of an app rather than a website in a frame (guideline 4.2).

## What is in git, what is not
| Committed | Generated / never committed |
|---|---|
| `package.json`, `capacitor.config.json`, `scripts/sync-web.mjs` | `node_modules/`, `www/` |
| `ios/App/App.xcodeproj`, `Info.plist`, `App.entitlements`, `PrivacyInfo.xcprivacy`, `InfoPlist.strings` (en fr es pt ar), `BEMastery.storekit`, `Assets.xcassets` (icon, launch), storyboards, the Swift sources in `Lifecycle/` and `Plugins/` (see below), `ios/debug.xcconfig` | `ios/App/App/public` (the web bundle), `ios/App/App/capacitor.config.json`, `config.xml` |
| `ios/App/CapApp-SPM/Package.swift` (Capacitor 8.5.2 via Swift Package Manager — no CocoaPods) | `build/`, `DerivedData/`, `*.xcarchive`, `*.ipa` |
| `appstore/` — metadata, review notes, privacy answers, 6.9" screenshots | **any** `.p12`, `.cer`, `.mobileprovision`, `.p8`, `AuthKey_*`, `ExportOptions*.plist` (see `.gitignore`) |

## Source layout (`ios/App/`)
A SwiftUI app shell around the Capacitor bridge, one Swift file per role, plus
a unit-test bundle and a UI-test bundle. The groups are real folders, so a
path in a test or a document is the path on disk.

| Folder / file | Role |
|---|---|
| `App/Lifecycle/BEMasteryApp.swift` | The `@main` SwiftUI `App`: one `WindowGroup` showing `ContentView`. Forwards `onOpenURL` / universal links to Capacitor's `ApplicationDelegateProxy` (nothing declares a URL type yet). There is no AppDelegate, SceneDelegate or Main.storyboard. |
| `App/Lifecycle/ContentView.swift` | The one screen the shell has: `BridgeView` edge to edge (`ignoresSafeArea`, the web layer lays itself out with `env(safe-area-inset-*)`). |
| `App/Lifecycle/BridgeView.swift` | `UIViewControllerRepresentable` hosting `BEBridgeViewController`; created once, never updated from SwiftUI. |
| `App/Lifecycle/BEBridgeViewController.swift` | Capacitor's bridge view controller plus the registration of the three app-local plugins. |
| `App/Plugins/BEStoreKitPlugin.swift` | `window.BENativeBilling` — StoreKit 2. Hands Apple's signed JWS strings to the web layer; the server decides the plan (`docs/APPLE_STOREKIT.md`). |
| `App/Plugins/BEAuthPlugin.swift` | `window.BEAuth` — Sign in with Apple and Google (PKCE, public client). Obtains a provider token; Firebase in the web layer owns the session (`docs/auth/SOCIAL_SIGNIN.md`). |
| `App/Plugins/BEAdsPlugin.swift` | `window.BENativeAds` — Google Mobile Ads + UMP consent, interstitial and native only, non-personalised. A provider, never a policy (`docs/ADS-IOS-RELEASE.md`). |
| `App/Info.plist`, `App.entitlements`, `PrivacyInfo.xcprivacy`, `InfoPlist.strings/` | Bundle configuration. Xcode rewrites the plist and the project file when it saves and drops any comment, so the reasons behind a setting live in the docs named above, not in the files. |
| `App/BEMastery.storekit` | Xcode's local StoreKit configuration for testing. The app never reads a price from it. |
| `App/Assets.xcassets`, `App/Base.lproj/LaunchScreen.storyboard` | Icon and launch screen. The launch screen is the only storyboard left. |
| `App/public/`, `App/capacitor.config.json`, `App/config.xml` | Written by `npx cap sync ios`; never edited by hand, never committed. |
| `BEMasteryTests/` | Swift Testing bundle, hosted in the app (`@testable import App`): the bridge registers the three plugins and its view is the web view (`BEMasteryTests.swift`); `BEAdsPlugin` id validation and the test-units locks (`BEAdsPluginTests.swift`); `BEStoreKitPlugin` product allow-list and ISO periods (`BEStoreKitPluginTests.swift`). |
| `BEMasteryUITests/` | XCUITest bundle: the app launches and the web view appears (`BEMasteryUITests.swift`); a launch screenshot for the report (`BEMasteryUITestsLaunchTests.swift`). The app is found by bundle id, so the bundle needs no target-application setting. |

Each plugin is one file: the Capacitor method table at the top, then the
methods in the order the web layer calls them, then the private delegate
classes it needs. A new native capability is a new file in `App/Plugins/` plus
one `registerPluginInstance` line in `BEBridgeViewController`.

Both test bundles are in the **App** scheme's test action, so **Product → Test**
(⌘U) runs them; the JavaScript side of the same contracts is
`tests/ios-ads.mjs`, `tests/ios-storekit.mjs` and `tests/auth-social.mjs`
(`cd tests && PORT=<free> node <file>`). Those three suites and
`scripts/check-release.mjs` read the Swift files off disk at the paths above.
Move a file and they must follow.

## Building (a Mac with Xcode 26 or later — App Store uploads require the iOS 26 SDK)
```
cd mobile/ios
npm install
npm run sync                      # web → www → ios/App/App/public, Package.swift refreshed
npx cap open ios                  # opens ios/App/App.xcodeproj
```
In Xcode, once: select the **App** target → *Signing & Capabilities* → tick
*Automatically manage signing* and pick the Lomonec LLC team. That writes
`DEVELOPMENT_TEAM` into the project; commit that change, nothing else.

Then **Product → Archive** → *Distribute App* → *App Store Connect* → Upload.
Or from the command line, after signing is set up:
```
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/App.xcarchive archive
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/export \
  -exportOptionsPlist ../../appstore/ExportOptions.example.plist   # copy it, set your teamID, keep the copy out of git
xcrun altool --validate-app -f build/export/App.ipa -t ios --apiKey <KEY_ID> --apiIssuer <ISSUER>   # or Transporter
```

## Settings already in the project
- Bundle id `com.lomonec.bemastery` (Google Play stays `com.bemastery.app` — Apple
  reported that identifier as unavailable to the Lomonec team), display name **BE Mastery**,
  team `8TKAAK2MG6` (LOMON EC LLC), automatic signing,
  version **1.1.0**, build **1**, iPhone only, portrait, iOS 15.0+.
- `NSMicrophoneUsageDescription` — recordings for feedback, voice turns to a
  practice partner, live practice calls; says what leaves the device.
- `ITSAppUsesNonExemptEncryption = NO` — only HTTPS / standard OS crypto.
- `PrivacyInfo.xcprivacy` — no tracking; collected: e-mail, name, audio, user
  content (linked, app functionality), product interaction (not linked,
  analytics); required-reason API: UserDefaults `CA92.1`.
- Launch screen: solid brand background (no logo flash before the web shell).
- Icon: 1024×1024 opaque, from `logo.svg`.

## What the web app does differently inside the shell
- `IS_IOS_APP` (index.html): true when `window.Capacitor.getPlatform()==="ios"`.
  It removes the Google Play link/button and the About page's Play badges
  (Apple 2.3.10). Nothing else changes.
- The service worker is not registered (WKWebView has none for a custom
  scheme); every registration in the app is already guarded. Offline works
  because the bundle is local. Updates ship as App Store releases.
- The Workers' origin allow-lists include `capacitor://localhost`
  (`backend/polish-worker.js`, `backend/events/events-worker.js`,
  `backend/partner/wrangler.toml`). All three production Workers answer that
  origin (verified 2026-09-20: `Access-Control-Allow-Origin: capacitor://localhost`
  from be-polish, be-events and be-partner) — `node scripts/check-release.mjs --live`
  re-checks it.
- The camera is used only by the Posture Coach (Shadowing Studio); frames are
  analysed in memory. `NSCameraUsageDescription` is in Info.plist — without it
  iOS terminates the app on the first camera access.
- The "Add to Home Screen" sheet and the Google Play rating card never show
  in the shell (`iosStandalone()` returns true under `IS_IOS_APP`; the rating
  card is Android-only by user agent).
- Same-origin `target="_blank"` links (the privacy policy from the consent
  sheet, the deletion page) open in the in-app document sheet in the shell,
  because WKWebView has no tab to open them in. External links go to Safari.
- Firebase e-mail/password sign-in works from `localhost` (authorized by
  default). Google/Apple sign-in stay hidden, as on the web.

## Checks before every upload
```
cd ../..                                   # repo root
node -e '…parse check from CLAUDE.md…'     # 0 errors
cd tests && npm test                       # smoke + shadow + partner e2e
cd ../backend/partner && node test/run.mjs # Worker suite (local wrangler dev)
cd ../../mobile/ios && npm run sync
```
