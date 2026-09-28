# App Privacy answers (App Store Connect → App Privacy), version 1.1.0

Checked against the code on 29 Sep 2026 (release branch `fix/ios-release-hardening`).
Premium is **not active** in this release, so nothing about purchases is collected.
The same facts are in `ios/App/App/PrivacyInfo.xcprivacy` and `privacy.html`; keep the
three in step. Rows marked **REQUIRES APP STORE CONNECT OWNER REVIEW** are ones the
repository cannot settle — the owner decides and, if declared, adds them to the
privacy manifest too.

**Do you or your third-party partners collect data from this app?** Yes.
**Is data used to track users (ATT)?** No — no advertising, no ad SDK, no data brokers, no advertising identifier. Do not add the ATT prompt.

| Apple data type | Collected? | Linked to the user | Tracking | Purpose | What it is, in the code |
|---|---|---|---|---|---|
| Contact Info → Email Address | Yes (only if the user creates an account) | Yes | No | App Functionality | Firebase sign-in; password-reset and welcome emails sent through Brevo |
| Contact Info → Name | Yes | Yes | No | App Functionality | the first name the user types; shown to a practice partner |
| Identifiers → **User ID** | Yes (signed-in users) | Yes | No | App Functionality | the Firebase account ID: keys the synced progress (Firestore `users/{uid}`) and the Practice Partner records |
| User Content → Audio Data | Yes | Yes | No | App Functionality | audio recorded for speaking feedback (sent to our Worker and OpenAI to be transcribed and scored, not kept by our Worker); voice turns sent to a partner (stored in Cloudflare R2, deleted 14 days after the session ends); **the learner's own side of each live-call round** (sent to be transcribed for the AI tip and the private report; the audio is not stored). The partner's live voice is never recorded |
| User Content → Other User Content | Yes | Yes | No | App Functionality | transcripts of partner turns; the learner's own live-round transcripts and private report; synced progress (notes, saved phrases, scores) |
| Usage Data → Product Interaction | Yes | **No** | No | Analytics | anonymous app-action counts (`be-events` allow-list); no device ID, no account link |
| Location → Coarse Location | **REQUIRES APP STORE CONNECT OWNER REVIEW** | No | No | Analytics | each anonymous event stores the **country** Cloudflare derives from the connection (`req.cf.country`); no IP, no finer location |
| Other Data | **REQUIRES APP STORE CONNECT OWNER REVIEW** | Yes | No | App Functionality | the optional gender a learner gives for same-gender Practice Partner matching; used only for matching, never shown |
| Identifiers → Device ID | **REQUIRES APP STORE CONNECT OWNER REVIEW** (recommended: not declared) | — | — | — | the iOS build never creates the random push device ID (verified: no Push API or notifications in the web view); a learner who also used the website can carry that web-created ID into the iOS app through the synced progress, and Practice Partner stores it with the partner profile |
| Purchases | **No** (Premium is not active in 1.1.0) | — | — | — | — |
| Diagnostics (crash, performance) | No | — | — | — | the app has no crash or error reporting |
| Location (precise), Contacts, Health, Financial, Browsing History, Search History, Sensitive Info | No | — | — | — | — |

Notes for the form
- **Microphone and speech recognition.** On iPhone, speech recognition is done by iOS; the app receives only text. Apple's own processing is not collection by us.
- **Live practice** is on in this release: audio-only WebRTC between two learners. The partner's voice is never recorded; the learner's own side of each round is sent for transcription (see Audio Data). A direct connection lets each device learn the other's IP address (privacy policy §8b).
- **Camera** (Posture Coach): frames are analysed on the phone and never leave it — not collected.
- **Service providers acting for Lomonec LLC:** Google Firebase (authentication, synced progress), Cloudflare (Workers, R2, D1, analytics counts), OpenAI (transcription, scoring, AI coach), Google Gemini (transcripts of YouTube videos a learner adds — only the video address is sent), Brevo (account emails).
- **Retention and deletion:** partner turns 14 days after a session ends; the safety log 90 days; everything tied to the account is deleted in the app (Delete account), which also removes the Practice Partner records. Reports other learners made about an account are kept so they keep protecting people (privacy policy §8b).
