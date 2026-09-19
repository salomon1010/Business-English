# App Privacy answers (App Store Connect "App Privacy" section)

Source of truth: `privacy.html` and `docs/release/FINAL_RELEASE_AUDIT.md` §15.
The same facts are in `ios/App/App/PrivacyInfo.xcprivacy`. Answer exactly this.

**Do you collect data from this app?** Yes.
**Tracking (ATT)?** No — no advertising, no data brokers, no cross-app tracking. Do not add the ATT prompt.

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info → Email address | Yes (only when the user creates an account) | Yes | No | App functionality (sign-in, sync) |
| Contact info → Name | Yes (first name / display name the user types) | Yes | No | App functionality (shown to a practice partner as first name only) |
| User content → Audio data | Yes — voice turns the user chooses to send to a partner; audio sent for scoring | Yes | No | App functionality |
| User content → Other user content | Yes — transcripts of those turns, notes, phrases the user keeps (synced when signed in) | Yes | No | App functionality |
| Usage data → Product interaction | Yes — anonymous event counts (opens, sessions completed, feature use); no device id | **No** | No | Analytics |
| Identifiers | No device ID, no advertising ID | — | — | — |
| Location, contacts, health, financial, browsing history, purchases, diagnostics (crash logs) | Not collected | — | — | — |

Notes for the form
- Live practice audio is peer-to-peer and never stored — it is not "collected".
- Lesson recordings (not partner turns) stay on the device — not collected.
- Firebase (Google) processes e-mail/password authentication and the synced progress; Cloudflare processes partner audio/transcripts (R2/D1), analytics counts and the API; OpenAI processes audio for transcription/scoring and text for the AI coach and does not train on it. All are "service providers", not "third parties you share data with" in Apple's sense — answer **not shared**.
- Retention/deletion: partner turns 14 days after a session ends; everything deletable in-app via *Delete account* (also removes the Practice Partner records) — say so in the privacy policy link, which already does.
