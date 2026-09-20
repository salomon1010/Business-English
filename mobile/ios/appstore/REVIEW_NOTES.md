# App Review notes (paste into "Notes" in App Store Connect; fill the credentials there, never here)

> Superseded on 2026-09-20 by `docs/APPLE_APP_REVIEW.md` § Notes, which is the
> maintained text (live calls off, camera wording, relay). Keep this file only
> as the short form; when the two differ, the docs/ version wins.

BE Mastery is a Business English learning app: a 12-week spoken-English
programme with recording, pronunciation feedback and a phrase bank. Everything
below can be reviewed with the two demo accounts entered in the *Sign-in
required* fields (Practice Partner needs two learners, so two accounts).

Demo accounts: TWO e-mail/password accounts — enter them in App Store
Connect's sign-in fields. Both are already past onboarding, on General
English, with the placement check done. (Keep the passwords in App Store
Connect only; they are not in the source repository.)

Microphone: needed for the core product — recording your speech for
feedback, sending short voice turns to a practice partner, and a live
practice call. The permission prompt appears on the first Record tap.

## Walk-through
1. Sign in — Profile tab → Account → *Log in* (e-mail/password). Sign-out, password reset and **Delete account** are on the same Account card.
2. General English is the default programme after the placement check; Practice Partner exists only there.
3. Practice tab → *Practice Partner* card (a *How it works* button explains the three steps). First open asks for consent (18+, what is shared).
4. Match: *Match me* or the floating *Talk to a real person* button → candidate cards (first name, level, plain reason; no photo, no profile). *Try a practice* sends a proposal; the other account sees a banner and accepts.
5. Four-round trial: each side records up to 60 s on the day's task, hears it back, sees the coach's score (labelled AI), then sends. Playback of the partner's turn is in the thread.
6. After round 4 both accounts choose independently: *Keep practising together →*, *Find someone else* or *Not now*. A connection is created only when both choose to keep practising — the screen then reads "You're practice partners".
7. *Practise together →* starts the next structured session with that partner.
8. Live Practice: *Practise live* on a candidate card, on the partner card, or in a session's *More options*. The other account gets a call-style banner → *Accept & talk*. Audio is peer-to-peer (WebRTC) and not recorded. Mute, *Phrase help* (three AI-labelled phrases as text) and the red hang-up button are on the call card.
9. Report / block: the ⋯ menu on the session header, the partner card's options and the live call menu. A block ends the session/call at once and removes the person from matching; a report is one-tap with a reason.
10. AI coach: when nobody is available (waiting list empty), the card *AI COACH — NOT YOUR PARTNER* offers the same four-turn practice with the AI; every AI turn and tip is tagged **AI**. It is never shown next to a real learner's card.
11. Delete account: Profile → Account → *Delete account* → confirm. This deletes the Firebase account, the synced progress and every Practice Partner record (voice turns, sessions, connections, live-call records), and clears the device.

## Notes for the reviewer
- No purchases, no subscriptions, no ads, no third-party login (e-mail/password only).
- No text chat and no contact exchange exist; transcripts are automatically screened for phone numbers, e-mail addresses, links and social handles before delivery.
- Practice Partner is only for learners aged 18 or over (in-app confirmation).
- Works offline for the daily programme; Practice Partner, scoring and Executive Polish need a connection.
- Support: contact@lomonec.com — data deletion page: https://app.lomonec.com/delete-account.html
