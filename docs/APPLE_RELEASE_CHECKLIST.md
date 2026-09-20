# BE Mastery — Apple release checklist

Tick in order. A box nobody ticked is not done. Details for every step:
`APPLE_DEPLOYMENT.md` (same letters). State on 20 Sep 2026 is pre-filled.

## Repository
- [x] iOS release branch created from `main` (`release/ios-appstore`, base `0777f2b`)
- [x] `node mobile/ios/scripts/check-release.mjs --live` → PASS (0 failures)
- [x] Web tests on the release tree: smoke 31/31, zoom 7/7, shadow-sync 57/57,
      boot 7/7, presence 16/16, shadow-challenge 62/62, partner e2e 134/136
      (the two Shadow rows fail identically on `main` — pre-existing), Worker 133/133,
      iOS relay 16/16 (stub protocol + the real relay page against YouTube in
      headless Chromium; WKWebView itself is a device check)
- [x] Privacy wording corrected (About card, help centre ×16) — no "never leaves the device" left about recordings
- [x] `NSCameraUsageDescription` present (Posture Coach), `NSMicrophoneUsageDescription` present
- [x] `ITSAppUsesNonExemptEncryption = NO`
- [x] `PrivacyInfo.xcprivacy` matches `appstore/PRIVACY_ANSWERS.md`
- [x] No Google Play link/badge/rating card in the shell (`IS_IOS_APP`)
- [x] No "Add to Home Screen" sheet in the shell
- [x] Same-origin legal links open in the in-app sheet in the shell
- [x] YouTube relay (`yt-embed.html` + `RemoteYT`) on the branch, tests green
- [x] Shared scheme `App.xcscheme` committed
- [x] No signing material / keys / export plist / generated bundles tracked
- [ ] Branch reviewed and **merged to `main`** by the owner (this document does not merge)
- [ ] app.lomonec.com flipped to the merged commit (`sw.js` cache name) and
      `https://app.lomonec.com/yt-embed.html` answers 200
- [ ] `BASE=https://app.lomonec.com node smoke.mjs` → 27/27 after the flip

## A–D. Machine, accounts, signing
- [ ] Mac with Xcode 26+ (`xcodebuild -version`)
- [ ] Apple Developer Program: Lomonec LLC, App ID `com.bemastery.app` registered
- [ ] App Store Connect app record created (name, SKU `be-mastery-ios`, bundle id)
- [ ] Xcode → App target → Signing & Capabilities → team Lomonec LLC, automatic signing
- [ ] `DEVELOPMENT_TEAM` line committed (`project.pbxproj`), nothing else signing-related in git
- [ ] (optional) App Store Connect API key created and stored outside the repository

## E–F. Build and archive
- [ ] `cd mobile/ios && npm ci && npm run sync`
- [ ] `node scripts/check-release.mjs --live` → PASS, bundle freshness PASS
- [ ] `node scripts/bump-build.mjs` (build number unique for 1.1.0) and committed
- [ ] Archive succeeds (Xcode or `xcodebuild … archive`) — **not performed on this Mac: Xcode absent**
- [ ] Archive validated (Organizer → Validate App, or `altool --validate-app`)

## G. TestFlight
- [ ] Uploaded; processing finished; no ITMS warnings about missing usage strings or privacy manifest
- [ ] Internal testers added; test notes pasted (this § Device list)

## Device (physical iPhone, TestFlight build) — REAL DEVICE TEST NOT PERFORMED during preparation
Record model / iOS version / network for each run.
- [ ] Install, cold launch: launch screen → app within 3 s, no white flash, safe areas correct (notch, home indicator)
- [ ] Onboarding → Home; rotate: stays portrait
- [ ] Sign in (e-mail/password) · sign out · sign in again — progress restored
- [ ] General English is the open area; Welding switch shows no Practice Partner / Shadow V2
- [ ] Microphone permission prompt appears on first Record; deny → app's own message; re-allow in Settings → works
- [ ] Record → play back → re-record in a daily session; online: coach score appears (be-polish)
- [ ] Shadowing Studio: library clip plays (**relay**), transcript follows the video, seek/repeat work; Watch / Shadow / Challenge tabs; Challenge: record → AI feedback → retry → complete
- [ ] Posture Coach: camera permission prompt with the app's wording; toggle off releases the camera
- [ ] Practice Partner: consent → Match me (second account in line) → Try a practice → 4 turns → decision → "You're practice partners"
- [ ] Practice Partner: AI coach card when nobody is in line; every AI turn tagged **AI**
- [ ] Report and Block from a session; blocked side gets nothing more
- [ ] Practise live button absent / shows "not available" (`LIVE_ENABLED="0"`)
- [ ] Executive Polish returns two rewrites (be-polish from `capacitor://localhost`)
- [ ] Airplane mode: daily programme still opens; Shadow/Partner/Polish show their offline messages, no blank screens
- [ ] Background 60 s → foreground: state intact; kill → relaunch: last page restored
- [ ] Incoming phone call during a recording: recording stops cleanly
- [ ] Wi‑Fi and cellular: sign-in, scoring, a partner turn each way
- [ ] Profile → Account → Delete account → confirm: signed out, local data cleared, `/me` 404 afterwards (owner checks D1)
- [ ] About page: no Google Play badges; privacy policy link opens in-app and closes
- [ ] Arabic UI: RTL layout, nothing clipped
- [ ] No console errors in Safari Web Inspector during the run (Debug build only)

## H. App Store Connect
- [ ] Listing pasted from `appstore/METADATA.md` (name, subtitle, description, keywords, promo text, URLs, copyright, What's New)
- [ ] Screenshots uploaded (6.9"; set per `appstore/SCREENSHOTS.md`)
- [ ] App Privacy answered per `appstore/PRIVACY_ANSWERS.md`; *not* tracking
- [ ] Age rating questionnaire answered (user interaction: yes)
- [ ] Two demo accounts created on production (General English, past placement) and entered in the sign-in fields
- [ ] Review notes pasted from `APPLE_APP_REVIEW.md`; contact e-mail + phone filled
- [ ] Release option: manual

## I–J. Review and release
- [ ] Submitted for review (owner action)
- [ ] Any rejection answered from `APPLE_DEPLOYMENT.md` § I table
- [ ] Approved → released manually → App Store page live
- [ ] `CLAUDE.md` "No iOS App Store presence" line updated; Play version aligned at the next Play upload

## K. Rollback rehearsal (once, before release)
- [ ] `PARTNER_ENABLED="0"` deploy → app shows "unavailable" → back to `"1"`
- [ ] Know the path to *Remove from sale* in App Store Connect
