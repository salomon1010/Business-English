# App Review notes — short form (version 1.1.0)

> The maintained text is `docs/APPLE_APP_REVIEW.md` § Notes; when the two differ,
> that one wins. Credentials go in App Store Connect only, never here.

BE Mastery is a Business English speaking app: a 12-week programme built around
recording your own voice, with pronunciation feedback, a phrase bank, a
shadowing studio and an optional practice partner. **This version sells
nothing** — no subscriptions, no in-app purchases, no ads. E-mail/password
sign-in only.

Demo accounts: two e-mail/password accounts in the *Sign-in required* fields.
Both are on General English, placement done, Practice Partner consent given.
Human practice needs both signed in at once (two devices, or one device plus
https://app.lomonec.com).

Permissions: **Microphone** (recording for feedback, partner voice turns, live
practice calls — prompt on the first Record tap); **Speech Recognition** (iOS
turns short answers into text; the app receives only the text); **Camera**
(optional Posture Coach only; analysed on the phone, never stored or sent).

Walk-through
1. Sign in: Profile → Backup & sync → Log in.
2. Home shows the next step; the daily session records, plays back and returns an AI speaking report.
3. Shadow tab → a clip → Watch / Shadow / Challenge.
4. Practice tab → Practice Partner → consent (18+) → *Match me →* → *Try a practice →*; four recorded turns; each side then chooses alone.
5. *Practise with the AI coach →* is always available; every AI turn is tagged AI.
6. Live practice is on: *Practise live* → the other account accepts → an audio-only WebRTC call in four rounds. The partner's voice is never recorded; each learner's own side of a round is transcribed for an AI tip and a private report.
7. Report / block: the ⋯ menu on a session, a partner card and the live call. Two reports from different learners suspend an account from Practice Partner for 30 days.
8. Delete account: Profile → Backup & sync → Delete account → confirm (removes the account, synced progress and every Practice Partner record).

Notes for the reviewer
- Welding English is a second programme; Practice Partner, the AI coach and Shadow Studio's Challenge exist only on General English, enforced on the server against the account's programme.
- Transcripts, first names and shared phrases are screened automatically for phone numbers, e-mail addresses, links and social handles; there is no text chat. Audio is not screened automatically; reports are reviewed by Lomonec LLC.
- Reminders appear inside the app only.
- **Developer tools (disclosed, Apple 2.3.1).** Tapping *Program start date* in
  Profile → Settings five times toggles a "GitHub sync" row. It is the maker's own
  backup tool — it writes a copy of the learner's own progress JSON to a GitHub
  repository the learner supplies a token for. It is off until deliberately
  revealed, stores nothing remotely on its own, collects nothing about the
  learner, and is not needed to review any feature above. Disclosed here because
  it is reachable in the shipped build.
- Support: contact@lomonec.com — account deletion page: https://app.lomonec.com/delete-account.html
