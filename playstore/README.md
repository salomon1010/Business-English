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

**Support email (required by Play):** nore.ngou@gmail.com — also shown in-app
(Account → About) and on every page footer.

**Category:** Education
**Tags:** English, Business English, pronunciation, speaking, shadowing

## 6. Data safety form answers

- Data collected: **None** (all data stays on-device)
- Data shared: **None**
- Security practices: data is not transmitted; users can delete all data in-app
- Camera: used only for on-device posture analysis, no capture/storage
- Microphone: used for on-device recordings; transcription via the device browser engine

## 7. Screenshots for the listing

Ready to upload: `screenshots/` contains eight 1080×2400 phone captures of the
live app (dashboard, Shadow Studio, Progress Studio, score charts, a daily
session, phrases, the 12-week journey, onboarding), numbered in upload order.
They show a demo profile 3½ weeks into the program so charts and streaks look
representative.
