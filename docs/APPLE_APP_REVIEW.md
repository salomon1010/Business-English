# BE Mastery — App Review guide (version 1.1.0)

Two audiences. **§ Notes** is the text to paste into App Store Connect → App
Review Information → Notes (the reviewer reads it). Everything after it is for
the Lomonec LLC person who prepares the submission. The short paste-ready
variant is `../mobile/ios/appstore/REVIEW_NOTES.md`; this file is the
maintained one. Last checked against the code: 29 Sep 2026
(`fix/ios-release-hardening`).

Release decisions reflected here (owner, 29 Sep 2026): **no purchases** in
1.1.0 (Premium not active); **live practice on**; **Home V2** is the iPhone
app's Home for General English.

## Notes (paste into App Store Connect)

BE Mastery is a spoken-English learning app for professionals: a 12-week
programme of 25-minute daily sessions built around recording your own voice,
with pronunciation feedback, a phrase bank, a shadowing studio and an optional
practice partner. Made by Lomonec LLC. **This version sells nothing: no
subscriptions, no in-app purchases, no ads.** Sign-in is e-mail and password
only (no third-party login).

**What the app does on iPhone.** A native iOS app (Capacitor) whose lessons,
audio, transcripts and pictures ship inside the app, so the programme works
offline. It uses the microphone to record and play back the learner's speech,
iOS speech recognition for word and pronunciation checks, and the camera only
for the optional Posture Coach (analysed on the phone). Online features:
AI speaking feedback and reports, the Shadowing Studio's YouTube videos with
synchronised transcripts and the Challenge, Executive Polish, Practice Partner
(recorded voice turns and live audio calls over WebRTC) and account sync.
Accounts can be created, backed up and deleted in the app. The app contains
StoreKit code for a future release; it is switched off in this version and no
product is offered.

**Sign-in.** Optional for the programme; required for Practice Partner. Use the
demo accounts in the sign-in fields: Profile → *Backup & sync* → *Log in*
(e-mail + password). Both are on General English with the placement check
done and the Practice Partner consent given. Practice Partner between two
people needs both accounts signed in at the same time — two devices, or one
device and https://app.lomonec.com signed in as the second account.

**Permissions.** *Microphone* — recording your speech for feedback, voice
turns to a practice partner and live practice calls; the prompt appears on the
first Record tap. *Speech Recognition* — iOS turns short answers into text for
word and pronunciation checks; the app receives only the text. *Camera* — only
the optional Posture Coach in the Shadowing Studio; frames are analysed on the
phone and never stored or sent.

**Walk-through (10 minutes).**
1. **Home** shows the learner's next step (the daily session, a word review,
   a Shadow clip…) and more practice picked from what they have done.
2. **Daily session**: record, hear it back, read the AI speaking report
   (online) — the core loop.
3. **Shadow** tab → pick a clip. *Watch* / *Shadow* / *Challenge*; the
   transcript follows the video line by line. Videos play in YouTube's own
   embedded player. Challenge: say the line from memory → AI feedback → retry.
4. **Practice Partner** (General English only): Practice tab → *Practice
   Partner*. First open asks for consent (18+, what is shared). *Match me →*
   shows learners in line as cards — first name, level, a plain reason; no
   photo, no profile. *Try a practice →* sends a proposal; the other account
   accepts; each side records up to 60 s per turn, four turns in all; then each
   chooses alone: *Keep practising together →* or *Find someone else*.
   **AI coach:** *Practise with the AI coach →* is always offered, including
   next to a real learner; every AI turn and tip is tagged AI and the AI is
   never shown as a person.
5. **Live practice** (on in this version): *Practise live* on a candidate or
   partner card, or in a session's *More options*. The other account sees
   "… wants to practise live with you" and accepts. Audio only, over WebRTC —
   directly between the two devices where the networks allow it, otherwise
   through a relay (TURN). The call runs in four timed rounds. The partner's
   voice is never recorded; each learner's own side of a round is recorded on
   their device and sent to be transcribed for an AI tip and a private report.
   Mute, *Phrase help* and a red hang-up button are on the call card.
6. **Report / Block**: the ⋯ menu on a session, on a partner card and in the
   live call. A block ends the session or call at once and removes the person
   from matching; a report is one tap with a reason; reports from two
   different learners suspend an account from Practice Partner for 30 days,
   and reports are reviewed by Lomonec LLC. Transcripts, first names and
   shared phrases are screened automatically for phone numbers, e-mail
   addresses, links and social handles; there is no text chat. Audio itself
   is not screened automatically.
7. **Delete account**: Profile → *Backup & sync* → *Delete account* (signed
   in) → confirm. Deletes the sign-in, the synced progress and every Practice
   Partner record (voice turns, sessions, connections, live-call records) and
   clears the device. Also at https://app.lomonec.com/delete-account.html.

**Two programmes, kept apart.** The app also has a Welding English track.
Practice Partner, the AI coach and Shadow Studio's Watch/Shadow/Challenge
modes exist only on General English — checked in the app and, on the server,
against the signed-in account's own programme. Switching the programme
(Profile → *Programme*) shows that.

**Privacy.** Recordings are kept on the phone. Audio sent for feedback, a voice
turn sent to a partner and the learner's own side of a live call travel over an
encrypted connection to our Cloudflare Workers; transcription and scoring use
OpenAI as a processor. Partner turns are deleted 14 days after a session ends.
Reminders appear inside the app only. Anonymous event counts; no advertising,
no tracking, no ATT prompt. Policy: https://app.lomonec.com/privacy.html
(§ 2, 4, 5, 8, 8b).

Support: contact@lomonec.com.

## Demo accounts (create before submitting — never commit them)
Full checklist, and the risk that Practice Partner shows demo accounts to real
learners: `docs/release/REVIEWER_ACCOUNTS.md`. Enter the credentials only in
App Store Connect's *Sign-in required* fields.

## Where things are (for the person preparing the submission)
| Reviewer need | Path in the app |
|---|---|
| Sign in / create account | Profile → Backup & sync |
| General English / Welding | Profile → Programme (switch lands on that programme's Home) |
| Daily session | Home → first card; Road map tab → any day |
| Shadowing Studio | Shadow tab |
| Practice Partner | Practice tab → Practice Partner; Home → Explore; floating button on other pages |
| AI coach | Practice Partner page → *Practise with the AI coach →* |
| Live practice | *Practise live* on a candidate or partner card |
| Executive Polish | Phrase Lab tab |
| Delete account | Profile → Backup & sync → Delete account (signed in) |
| Privacy policy | consent sheet link; Profile → Privacy policy |
| Help centre | Profile → Help & guide (16 languages) |

## How the AI features work (say this if asked)
- Speaking feedback and reports: the recording goes to be-polish (Cloudflare
  Worker) → OpenAI transcription and scoring → the report comes back; the
  Worker keeps no audio.
- Live practice: each learner's own round is transcribed the same way; the AI
  tip and the private report are built from that learner's own words only.
- AI coach and Challenge feedback: text in, text out through the same Worker;
  spoken with a natural voice; always tagged AI.
- Executive Polish: the sentence you type or dictate → two rewrites.
- Transcripts of YouTube videos a learner adds may come from Google's Gemini
  API; only the video address is sent.
- Nothing is sent without an action from the user; offline, the app says so.

## Track separation (evidence)
- Client: `isGeneralEnglish()` gates `ppAvailable()` (Practice Partner),
  `svOn()` (Shadow Studio V2) and `homeV2On()` (Home V2).
- Server: `backend/partner/partner-worker.js` `accountTrack()` reads the
  signed-in account's own programme from Firestore with that user's token and
  fails closed; any programme but General English → 403 on every Practice
  Partner route (tests: `backend/partner/test/track-auth.mjs`). **The production
  Worker must be redeployed with this code before submission**
  (`docs/release/RELEASE_RUNBOOK.md`).
- Analytics: event names are allow-listed in `backend/events/events-worker.js`;
  no device ID.

## Known limitations to state, not hide
- No purchases in this version (StoreKit code present but switched off).
- Reminders appear inside the app only (no push notifications in the iPhone app).
- Shadow Studio video needs a connection (YouTube through the relay page).
- Google sign-in is hidden; e-mail/password only.
- Audio is not screened automatically; reports are reviewed by hand
  (`docs/release/UGC_OPERATIONS.md`).

## Typical rejection reasons and the answer
See `APPLE_DEPLOYMENT.md` § I (4.2, 1.2, 5.1.1, 5.1.1(v), 2.3.10, 2.1, 3.1.1).
