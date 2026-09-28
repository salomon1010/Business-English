# App Review demo accounts — preparation checklist (version 1.1.0)

**Nothing here has been created.** The accounts are made on **production**
(`be-mastery`) only when the owner decides, just before submission. Credentials
go into App Store Connect → App Review Information → *Sign-in required* and
nowhere else (never the repository, never a chat).

## The accounts
| | Account A | Account B | Account C (optional) |
|---|---|---|---|
| Purpose | the reviewer's main account | the second learner for human practice | shows that Welding has no Practice Partner |
| E-mail | an address Lomonec LLC controls (e.g. `review1@lomonec.com`) | e.g. `review2@lomonec.com` | e.g. `review3@lomonec.com` |
| First name | a neutral first name (e.g. "Alex") — it is what a partner sees | e.g. "Sam" | e.g. "Chris" |
| Programme | General English | General English | Welding English |
| Placement check | passed (answer yes to the three sentences) | passed | passed |
| Practice Partner consent | given (18+ confirmed) | given | — (not offered on Welding) |
| Synced | yes — signed in once and *Backup & sync* shows the last save reached the account | yes | yes |
| Ready to use | lands on Home; Practice Partner opens at *Match me →* | same | lands on the Welding Career Dashboard |

**Why "synced" matters:** Practice Partner checks the account's programme in its
synced copy on the server and refuses an account that has none yet
(`403 track_unverified`). An account that has never saved to the cloud cannot
use Practice Partner.

## Set-up steps (owner, on production, when authorised)
1. Create A and B in the app or at https://app.lomonec.com: onboarding → General English → the placement check → Profile → *Backup & sync* → create account → wait for "last save reached your account".
2. On each, open Practice → Practice Partner once and give the consent (18+).
3. Optional: create C the same way but choose Welding English.
4. Do not practise between A and B beforehand unless you want them to start as connected partners (see the risk below).
5. Enter A and B (and C) in App Store Connect with their passwords; write in the review notes that human practice needs both signed in at once (two devices, or one device plus the website).

## The exposure risk — owner decision required
Practice Partner matching offers **anyone in line** to anyone on General
English. While a demo account is in line (or was seen in the last few minutes)
it can be offered to **real learners**, and a real learner can be offered to the
reviewer. There is no mechanism that limits the two demo accounts to each other:
- the *Hidden* switch (Practice Partner → the Practise / History row) hides an account from matching, but a hidden account also **cannot practise with anyone**, including an existing partner (`403 opted_out` / `409 hidden`) — so it only leaves the AI coach to review;
- there is no reviewer-only pool.
Options for the owner:
- **accept the exposure** for the review window (a real learner may meet "Alex"; the reviewer may meet a real learner — both are covered by the same consent, screening, report and block);
- **keep A and B hidden** and tell Apple that human practice needs a second real learner, reviewing only the AI coach — Apple may still ask to test it;
- **build a reviewer-only pool** (future engineering, not available now).
Do not make the demo accounts visible to real learners without this decision.

## Reviewer instructions (paste-ready summary)
1. Sign in with account A: Profile → Backup & sync → Log in.
2. Home shows the next step; start the daily session, record, read the report.
3. Shadow tab → a clip → Watch / Shadow / Challenge.
4. Practice → Practice Partner → *Practise with the AI coach →* (always available, labelled AI).
5. Human practice: sign in with account B on a second device (or at https://app.lomonec.com) and open Practice Partner there → on A, *Match me →* → *Try a practice →* → B accepts → four turns → each chooses alone.
6. Live practice: *Practise live* on the partner card → B accepts → an audio-only call in four rounds → hang up with the red button.
7. Report / block from the ⋯ menu.
8. Account C (optional): Profile → Programme shows Welding English; Practice Partner is not offered.
9. Delete account: Profile → Backup & sync → Delete account (use a throwaway account, not A or B, if Apple asks to see it done — deleting A or B ends the review set-up).
