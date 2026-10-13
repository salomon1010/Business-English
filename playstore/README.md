# BE Mastery — Google Play Store Packaging Kit

Everything needed to ship the PWA to the Play Store as a Trusted Web Activity (TWA).

---

## 1. One-time setup (on your Mac)

```bash
# Node 18+ required (check: node -v)
npm install -g @bubblewrap/cli

# First run will offer to download the JDK and Android SDK for you — say yes.
```

## 2. Build the Android app

```bash
cd playstore
bubblewrap init --manifest https://app.lomonec.com/manifest.json
# When prompted, accept the values from twa-manifest.json in this folder
# (package id: com.bemastery.app, name: BE Mastery, colors #0a0e1a).
# It will create a signing keystore — SAVE THE PASSWORDS somewhere safe.

bubblewrap build
# Produces: app-release-signed.apk (for testing) and app-release-bundle.aab (for Play)
```

Test on your phone: `adb install app-release-signed.apk` or just copy the APK over.

## 3. Digital Asset Links (removes the browser bar) — IMPORTANT

TWA verifies you own the website via a file at the **domain root**:
`https://app.lomonec.com/.well-known/assetlinks.json`

Because the app now runs on its own domain (`app.lomonec.com`) served from THIS
repo's root, the file already lives here at [`.well-known/assetlinks.json`](../.well-known/assetlinks.json)
— no separate repo needed (the old GitHub project-site workaround is gone). It
already contains the upload-key fingerprint:

```
3D:E6:6D:FE:51:6D:73:6A:59:16:A9:6A:DF:34:3A:DC:39:C8:36:1C:B2:EF:3F:5F:46:0D:8B:A3:D1:3A:07:52
```

Note: after uploading to Play, ALSO add the **Play App Signing** SHA256
(Play Console → Setup → App integrity) into the `sha256_cert_fingerprints` array
in that file, or the URL bar will show. Verify it's live after DNS/Pages are set:
`curl https://app.lomonec.com/.well-known/assetlinks.json`

## 4. Play Console (one-time $25 developer fee)

1. https://play.google.com/console → Create app → **BE Mastery — Business English**
2. Upload `app-release-bundle.aab` (internal testing first, then production)
3. Fill the store listing with the texts below
4. Privacy policy URL: `https://app.lomonec.com/privacy.html`
5. Data safety form: see section below
6. Content rating questionnaire: Education / no user-generated public content → usually "Everyone"

---

## 5. Store listing texts (copy-paste)

**App name (30 chars max):**
```
BE Mastery — Business English
```

**Short description (80 chars max):**
```
Speak Business English with confidence: shadowing, AI-style feedback, 25 min/day
```

**Full description:**
```
Speak like you belong in the room.

BE Mastery is a complete 12-week Business English speaking program — built for
professionals who understand English but want to SPEAK it with confidence:
meetings, standups, interviews, presentations.

🎯 SHADOWING STUDIO
Cut a 20–30 second clip from any YouTube video and it loops while you shadow the
speaker. Curated native-speaker channels, speed control, and smart counters help
you copy real American rhythm and stress.

🗣️ INSTANT SPEAKING FEEDBACK
Record yourself and get a word-by-word pronunciation score, grammar corrections
("I am agree" → "I agree"), your speaking pace vs the native 140–160 wpm zone,
and a filler-word count. Every missed word comes with example audio, slow-motion
playback, and a say-it-again drill.

📈 SEE YOUR VOICE CHANGE — LITERALLY
Your new take's waveform is layered over your previous one: watch pauses shrink
and pacing tighten day by day. Attempt tracking shows your score climbing:
80% → 95% → 100%.

🗓️ 84 GUIDED SESSIONS, 25 MINUTES A DAY
Every day has one prepared session with a minute-by-minute template: Monday
pronunciation, Tuesday speaking drills, Thursday meeting simulations, Sunday
review. No planning, no guesswork — open the app and press start.

💼 EXECUTIVE POLISH
Say it casually, get it back boardroom-ready: fillers cut, hedging removed,
vocabulary upgraded. Plus 152 curated business phrases and idioms.

📚 VOCABULARY FROM YOUR OWN SPEECH
Key words are extracted from what you actually say — with CEFR levels, real
dictionary audio, a personal trouble-words gym, and a say-the-word quiz.

🧍 POSTURE COACH
A glowing avatar mirrors your posture while you practice — green when you sit
like an executive, orange when you slouch. Zero-capture: no video is ever
stored. In the dark, your screen becomes a ring light.

🔒 PRIVATE BY DESIGN
No account. No ads. No tracking. Your recordings and progress stay on your
device. Works offline.

25 minutes a day. 12 weeks. Walk into your next meeting ready.

© 2026 Lomonec LLC — BE Mastery. All rights reserved.
```

**Support email (required by Play):** contact@lomonec.com — also shown in-app
(Account → About) and on every page footer.

**Category:** Education
**Tags:** English, Business English, pronunciation, speaking, shadowing

## 6. Data safety form answers

**These answers were corrected on 11 Oct 2026.** The previous version said
"Data collected: None / Data shared: None", which stopped being true once the app
gained optional accounts, AI features and push reminders. A Data safety
declaration that understates what leaves the device is a policy violation, so
check this list against `privacy.html` §4 (what leaves the device), §5b
(purchases), §7 (analytics), §7b (ads) and §8 (push) before every upload — those
sections are the maintained source, this is the console mapping.

Practice data (progress, notes, saved phrases, recordings) is stored on the
device. What follows is everything that leaves it.

**Data is encrypted in transit; the learner can delete everything in-app
(Settings → Data), and deleting the account erases the server-side rows
(`DELETE /v1/me` on be-entitlements, `DELETE /me` on be-partner).**

| Play category | Collected | Shared | Optional? | Purpose | Notes |
|---|---|---|---|---|---|
| Personal info → Name | Yes | No | Optional (profile) | App functionality | the first name shown in the app; travels only inside AI practice text (below) |
| Personal info → Email address | Yes | No | Optional (sign-in) | App functionality, Account management | only if the learner creates an account (Firebase Auth) |
| Personal info → Other info | Yes | No | Optional | App functionality | the optional gender used for same-gender Practice Partner matching |
| App activity → App interactions | Yes | No | No | Analytics | anonymous event counts, no device id (privacy.html §7) |
| App activity → Other user-generated content | Yes | No | No | App functionality | text typed into Executive Polish / the Résumé coach and practice-conversation turns, sent to our Worker and on to OpenAI; may contain name and work history |
| Audio → Voice or sound recordings | Yes | No | No | App functionality | the recording is sent to our Worker and on to OpenAI to be transcribed and scored; on Chrome/Android the browser's own speech recognition (Google) also receives the audio of a turn |
| Files and docs | No | No | — | — | recordings stay on the device apart from the transcription request above |
| Photos / videos | No | No | — | — | the camera (Posture Coach) never leaves the device |
| Location | No | No | — | — | analytics stores only the country Cloudflare derives from the connection; no IP, nothing finer |
| Device or other IDs | Yes | No | Optional (reminders) | App functionality | a random per-device push id + the push address, only if reminders are switched on (privacy.html §8). **Not an advertising id** |
| Financial info → Purchase history | Yes | No | Optional (Premium) | App functionality, Account management | the store's own purchase/subscription state, verified server-side and tied to the account (privacy.html §5b). Card details never reach us — Google Play takes the payment |

**Advertising id: NOT collected.** The Android build removes the `AD_ID`
permission and the Privacy Sandbox ad permissions the Ads SDK adds, ads are
non-personalised (`npa=1`), and there is no tracking prompt. Keep this answer and
that build step in step — Play refused a release once already when the SDK
re-added `AD_ID` (commit `8d7715d9`).

**Data used for tracking across apps/sites: No.** **Data sold: No.**

- Camera: used only for on-device posture analysis, no capture, no upload.
- Microphone: recordings are kept on the device; see the Audio row for the one
  case where audio is sent to be transcribed.

## 7. Screenshots for the listing

Ready to upload: `screenshots/` contains eight 1080×2400 phone captures of the
live app (dashboard, Shadow Studio, Progress Studio, score charts, a daily
session, phrases, the 12-week journey, onboarding), numbered in upload order.
They show a demo profile 3½ weeks into the program so charts and streaks look
representative.
