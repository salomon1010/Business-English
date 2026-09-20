# BE Mastery — App Review guide

Two audiences. **§ Notes** is the text to paste into App Store Connect → App
Review Information → Notes (the reviewer reads it). Everything after it is
for the Lomonec LLC person who prepares the submission. The short paste-ready
variant from an earlier pass lives in `../mobile/ios/appstore/REVIEW_NOTES.md`;
this file is the maintained one.

## Notes (paste into App Store Connect)

BE Mastery is a spoken-English learning app for professionals: a 12-week
programme of 25-minute daily sessions built around recording your own voice,
with pronunciation feedback, a phrase bank, a shadowing studio and an optional
practice partner. Made by Lomonec LLC. No purchases, no ads, no third-party
login.

**Sign-in.** Optional for the programme; required for Practice Partner. Use the
two demo accounts in the sign-in fields (Profile tab → Account → Log in,
e-mail + password). Both are on General English with the placement check done.
Practice Partner needs two learners, hence two accounts — use two devices, or
one device and the web app at https://app.lomonec.com signed in as the second
account.

**Microphone.** Core to the product: recording your speech for feedback,
sending short voice turns to a practice partner. The permission prompt appears
on the first Record tap. **Camera** is used only by the optional Posture Coach
in the Shadowing Studio; frames are analysed on the phone in real time and
never stored or sent.

**Walk-through (10 minutes).**
1. Onboarding → Home. The daily session is the first card: record, hear it
   back, get a score (online) — that is the core loop.
2. **Shadowing Studio**: Practice tab → *Best tool for your step* →
   *Shadowing Studio* → pick a library clip. Watch / Shadow / Challenge tabs;
   the transcript follows the video word by word. Challenge: record the line
   from memory → AI feedback → retry.
3. **Practice Partner** (General English only): Practice tab → *Practice
   Partner* card (*How it works* explains it). First open asks for consent
   (18+, what is shared). *Match me* shows learners in line as cards — first
   name, level, a plain reason; no photo, no profile. *Try a practice* sends a
   proposal; the other account accepts; each side records up to 60 s per
   round, four rounds; then each chooses alone whether to keep practising
   together. When nobody is in line, the **AI COACH — NOT YOUR PARTNER** card
   offers the same four turns with an AI; every AI turn and tip is tagged
   **AI** and the AI is never shown as a person.
4. **Report / Block**: the ⋯ menu on a session, on a partner card and in the
   partner options. A block ends the session at once and removes the person
   from matching; a report is one tap with a reason; two reports suspend an
   account. Transcripts are screened automatically for phone numbers,
   e-mails, links and social handles before delivery; there is no text chat.
5. **Live practice** (voice call) is switched off on the server in this
   release; the app shows it as not available.
6. **Delete account**: Profile → Account → *Delete account* → confirm. Deletes
   the sign-in, the synced progress and every Practice Partner record (voice
   turns, sessions, connections) and clears the device. Also documented at
   https://app.lomonec.com/delete-account.html.

**Two programmes, kept apart.** The app also has a Welding English track.
Practice Partner, the AI coach and Shadow Studio's Watch/Shadow/Challenge
modes exist only on General English, on the client and on the server
(requests for any other track are refused). Switching the area (Profile) shows
that.

**Privacy.** Lesson recordings stay on the phone. A clip you send for feedback
(online) or as a voice turn to a partner goes over an encrypted connection to
our Cloudflare Workers; scoring uses OpenAI as a processor and does not train
on it. Partner turns are deleted 14 days after a session ends. Anonymous event
counts only; no device identifiers, no tracking, no ATT prompt. Policy:
https://app.lomonec.com/privacy.html (§ 4, 5, 8b).

Support: contact@lomonec.com.

## Demo accounts (create before submitting — never commit them)
Create two accounts **on production** (the app or https://app.lomonec.com):
- e-mails you control (e.g. `review1@lomonec.com`, `review2@lomonec.com`), strong passwords;
- run onboarding, choose General English, pass the placement check (answer
  yes to the three sentences), open Practice Partner once and accept the
  consent on both — so the reviewer starts at *Match me*;
- optionally put account 2 in line (*Match me*) just before submission so
  account 1 sees a candidate immediately; the queue entry expires, so the
  reviewer may need account 2 on the web at the same time — say so in Notes
  if you cannot keep it in line.
Enter them in App Store Connect's *Sign-in required* fields only.

## Where things are (for the person preparing the submission)
| Reviewer need | Path in the app |
|---|---|
| General English | default after onboarding; Profile → area switch shows Welding |
| Daily session | Home → first card; Road map tab → any day |
| Shadowing Studio | Practice tab → Best tool for your step → Shadowing Studio |
| Practice Partner | Practice tab → Practice Partner card; floating *Practise with real person* button on Home / Road map / Shadow / Phrase Lab |
| AI coach | Practice Partner page when nobody is in line (card *AI COACH — NOT YOUR PARTNER*) |
| Executive Polish | Phrase Lab tab → Executive Polish |
| Account, deletion | Profile tab → Account |
| Privacy policy | consent sheet link; Profile → Account → Privacy; https://app.lomonec.com/privacy.html |
| Help centre | Profile → Help & guide (16 languages) |

## How the AI features work (say this if asked)
- Speaking feedback: the recording goes to be-polish (Cloudflare Worker) →
  OpenAI transcription + scoring → score and per-word marks come back; the
  audio is not retained.
- AI coach (Practice Partner fallback) and Challenge feedback: text in, text
  out through the same Worker; spoken with a natural voice; always tagged AI.
- Executive Polish: the sentence you type or dictate → two rewrites.
- Nothing is sent without an action from the user; offline the app falls back
  to on-device behaviour or shows an "offline" message.

## Track separation (evidence)
- Client: `isGeneralEnglish()` gates `ppAvailable()` (Practice Partner) and
  `svOn()` (Shadow Studio V2); the Welding area renders none of it.
- Server: `backend/partner/partner-worker.js` `TRACKS = {"general-english"}` —
  any other track → 403 before anything is written.
- Analytics: event names are allow-listed in `backend/events/events-worker.js`;
  no device id.

## Known limitations to state, not hide
- Live practice (voice calls) is off (`LIVE_ENABLED="0"`).
- Reminders fire only while the app is open (no push in the shell).
- Offline speech recognition is not available in WKWebView; online scoring is
  the primary path and works.
- Shadow Studio video needs a connection (YouTube through the relay page).
- Google sign-in is hidden; e-mail/password only.

## Typical rejection reasons and the answer
See `APPLE_DEPLOYMENT.md` § I (4.2, 1.2, 5.1.1, 5.1.1(v), 2.3.10, 2.1, 3.1.1).
