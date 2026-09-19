# BE Mastery — Final release-gate audit: `feature/practice-partner`

Date: 2026-09-19 · Auditor: Claude (Opus 5) working from the repository, the
local Worker, the staging Workers and the official Apple / Google policy
pages fetched during the audit. Nothing was merged, pushed or deployed to
production. Statuses used: **PASS / FAIL / BLOCKED / MANUAL VERIFICATION
REQUIRED / NOT APPLICABLE**. Every PASS names its evidence.

## 1. Executive summary

The branch is a General-English-only Practice Partner (recorded turns, AI
coach fallback, live WebRTC calls) plus Shadow Studio V2, behind client flags
that are **off** in production and a Worker that is **not deployed** to
production (`be-partner` → 404). Merging changes nothing a learner can see.

Findings: **one P1** was found and **fixed in this session** — the in-app
"Delete account" did not erase Practice Partner data (D1 + R2), which Apple
5.1.1(v) and Google Play's account-deletion policy require. `DELETE /me` was
added to the Worker (above the kill switch), the app calls it before deleting
the Firebase user, and the deletion page / privacy policy now say what is
erased and what is kept. **No P0.** One **store-packaging P1** remains outside
the code: the Android TWA project targets **API 35**, and Google Play requires
API 36 for new apps and updates from **31 August 2026** (fetched from the
official page); that is a `bubblewrap` regeneration at release time, not a
branch change. Several P2/P3 items are documented, none of which block the
code merge.

**Decision: READY FOR MERGE AFTER FIXES — P0/P1 FIXES COMPLETED AND
RE-TESTED.** Store packaging is a separate phase: the Android wrapper exists
locally (gitignored) and needs a target-API bump; there is **no iOS project**.

## 2. Current branch / commit

| | |
|---|---|
| Branch | `feature/practice-partner` |
| HEAD at audit start | `1677fd8` (45 commits ahead of `main`) |
| `main` = `origin/main` | `35e2da2` |
| Merge base | `e848b7a` |
| Commits named in the brief | `fd5f3c3`, `0eccf5d`, `a42e2c2` are all ancestors of HEAD (inspected; the brief's list was stale by ~10 commits) |

## 3. Git status (audit start)

Uncommitted, **another session's work, preserved untouched**: `CLAUDE.md`
(one hunk), `backend/polish-worker.js` (staging origin line), `docs/PRODUCT_VISION.md`,
`marketing/*` (captions, banner, PDFs, roadmap shots), `tests/stress.mjs`;
untracked `marketing/video-factory/`, `tests/package-lock.json`, `.wrangler/`.
`stash@{0}: OTHER SESSION - streaming feature + docs + marketing` — present,
not popped, not dropped. This session's edits were staged by explicit path
only (`CLAUDE.md` via a HEAD-based blob, as the project rule requires).

## 4. Files changed relative to main

51 files, +11,282 / −84: `index.html` (+1,994), `backend/partner/*` (Worker,
7 migrations, 106-check suite, README, wrangler.toml with dev/staging envs),
`backend/events/*` (allow-list + staging env), `backend/polish-worker.js`
(AI chat route hardening), `shadow-sync.js`, 15 `i18n/*.json`, `privacy.html`
(§8b), `sw.js` (v348 + `shadow-sync.js` precache), `tests/partner.mjs`,
`tests/shadow-sync.test.mjs`, `tests/smoke.mjs`, 9 product docs,
`rp-photos/partner.jpg` (AI-generated, per `SOURCES.md`).

## 5. Security audit — repository and configuration (Part 1)

| Check | Status | Evidence |
|---|---|---|
| Secrets in tracked files (OpenAI `sk-`, AWS, private keys, JWTs, TURN key/token literals, Supabase, Slack, GitHub, Cloudflare tokens) | PASS | `git grep -E …` over HEAD: no hits outside prose |
| `.env`, `.pem`, `.key`, service-account JSON tracked | PASS | `git ls-files` → none; `.gitignore` blocks them |
| Android keystore / AAB / APK tracked | PASS | `playstore/.gitignore` excludes `android.keystore`, `*.aab`, `*.apk`, `*.idsig`; `git ls-files` confirms none tracked |
| TURN secrets | PASS | Only `env.TURN_KEY_ID` / `env.TURN_KEY_TOKEN` Worker secrets (`wrangler secret list --env staging` → both set); never in `wrangler.toml`, never returned to the client (see §11) |
| Firebase `apiKey` in `index.html` | NOT A FINDING | Public by design (Firebase web config); auth is enforced by Firebase rules + server-side token verification |
| `DEV_AUTH` / `X-Dev-User` / `X-Dev-Now` | PASS | Only under `[env.dev.vars]`; production `[vars]` and `[env.staging.vars]` have none; the client sends dev headers only when `PARTNER_API` is `localhost`/`127.0.0.1` (`ppDevUser`) |
| `/__reset`, `/__cron`, `/__uncap` | PASS | Each guarded by `env.DEV_AUTH === "1"`; live probe on staging `POST /__uncap` → 401 (unreachable) |
| Production kill switches | PASS | `PARTNER_ENABLED="0"`, `LIVE_ENABLED="0"` in `[vars]`; `FLAGS_DEFAULT` has all partner/Shadow-V2 flags `false` |
| Staging origins leaking into production | PASS | `ALLOWED_ORIGINS` prod = `app.lomonec.com`, `salomon1010.github.io`; staging origin only in `[env.staging]` and `be-events` `EXTRA_ORIGINS` (staging env only) |
| Production Worker | PASS (untouched) | `https://be-partner.nore-ngou.workers.dev/health` → 404 (does not exist); live `sw.js` still `be12-v347` |
| Local `.wrangler/` state untracked | FIXED (P3) | Added `.wrangler/` to `.gitignore` |

## 6. Authentication (Part 3)

`verifyIdToken` (`partner-worker.js:123`): RS256 only, `kid` required, JWKS
fetched from Google's `securetoken@system` endpoint with 1-h cache and one
forced refetch on unknown `kid`; signature verified with WebCrypto;
`aud === FIREBASE_PROJECT_ID`, `iss === https://securetoken.google.com/<project>`,
`exp > now`, `sub` present and ≤ 128 chars. Every route after `/health` and
the dev routes runs `authUid` → 401 (`partner-worker.js:470-471`). Live
probes: no token → 401; garbage Bearer → 401. The verifier is unit-tested
with a generated RSA pair in `run.mjs` (wrong aud/iss/exp/kid/signature all
rejected). **PASS.** The Firebase-live JWKS path is MANUAL VERIFICATION
REQUIRED (owner-reported: real accounts on staging work).

## 7. Authorization / IDOR (Part 4)

| Object | Ownership check | Status |
|---|---|---|
| pair routes `/pairs/:id/*` | `isMember(pair, uid)` else 403 | PASS (run.mjs: non-member 403) |
| accept / decline / cancel | guest-only / host-only checks | PASS (stranger accept → 403 in e2e) |
| `/turns/:id/audio` | member of the turn's pair **and** not blocked either way | PASS (run.mjs + e2e: non-member 403, unauth 401, blocked 403) |
| `/connection/end\|report\|block {cid}` | `cid` = SHA-256(uidA\|uidB)[0..8], resolved only against the caller's own connections; foreign cid → 404 | PASS |
| `/live/:id/*` incl. signals | `s.host === uid \|\| s.guest === uid` else 403; blocked pairs 403 | PASS (run.mjs live block) |
| `/ai/session` | keyed by caller uid; 12/day; idempotent on id | PASS |
| `/me`, `/interest`, `/match`, `/invite` | identity only from the token; offers minted `for_uid = uid` and validated against it | PASS |
| `DELETE /me` (new) | erases only the caller's uid | PASS (run.mjs) |

No route trusts a client-supplied identity outside `DEV_AUTH`.

## 8. Practice Partner matching security (Part 5)

- Track: `TRACKS = {"general-english"}`; `/interest` and `/ai/session` → 403
  `track` for anything else; `candidates()` skips other tracks. Live probes
  with a fresh dev user: `welding` → 403 / 403. **PASS.**
- Eligibility filters (owner rule 2026-09-19: no compatibility gate): still
  excluded — suspended, opted out, same-gender preference, blocked either
  way, already in a session; cooldown / ended connection only **rank last**.
  **PASS** (documented; run.mjs asserts).
- Enumeration: cards carry `offer` (random 16-hex, 30-min TTL, bound to
  `for_uid`), first name, band, ≤2 goals, topic, availability, reasons,
  `waitingMin`. No uid, no e-mail, no IP, no internal ids. `connId` is a
  truncated hash, not reversible to identities without both uids. **PASS.**
- Races: `acceptPair` is one D1 `batch` guarded by `changes` count; second
  accept → 409 `gone`; `/invite` idempotent on an open proposal;
  `/turns` idempotent on `turn_id`; `/live` idempotent per open session. **PASS.**

## 9. Presence / waiting list (Part 6)

- Opt-in: presence counts only members with `consent`; `waiting` only rows in
  `interest` (explicit Match me / Practise now). Opening the app alone never
  lists anyone — the presence strip needs `consented`. **PASS.**
- TTL: `last_seen` 5-min window for "online"; interest rows > 7 days are
  neither offered nor counted and are deleted by the cron; invites expire in
  10 min; offers in 30 min. **PASS.**
- Counts only, never ids/names; `presence.waiting === waiting.available`
  (one filter). **PASS.**
- **N+1 (P2, not fixed):** `candidates()` runs up to 5 queries per queued
  learner (block, active pair, connection, cooldown, exposure) for up to 200
  rows, and `/me` calls it once per poll (8 s on the partner page, 10 s
  banner loop elsewhere). Fine for the pilot (≤ 12 learners); at ~100
  concurrent waiters each `/me` is ~500 D1 reads. Recommendation: one
  joined query (LEFT JOIN blocks/cooldowns/connections/pairs) and a bounded
  scan for the count. See §20.

## 10. Consent and stranger communication (Part 7)

18+ checkbox required before `/consent` (`403 age` server-side, e2e: "Without
the 18+ confirmation nothing is sent"); consent persists in `members`
(`consent_at`, `adult`) and can be withdrawn by `DELETE /me`. A trial starts
only when the guest **accepts** a proposal; a live call only when the guest
**accepts** the live invitation (a live proposal from a card is a single
explicit accept of "wants to practise live"); a regular partnership only when
**both** choose `continue`. No phone/e-mail/handle exchange exists, and
transcripts are screened for them. Partner sees first name, band, language.
**PASS.**

## 11. Audio security (Part 9)

R2 keys are random, only reachable through `GET /turns/:id/audio` (member +
not blocked; `cache-control: private`); no bucket listing, no public URL;
uploads capped at 1.5 MB / 75 s; audio purged 14 days after a pair closes
(cron), and now immediately on account deletion. Live audio is peer-to-peer
(SRTP); the Worker only relays SDP/ICE. **PASS.** Transcripts are stored with
the turn and returned only to pair members. **PASS.**

## 12. WebRTC / TURN (Part 10)

- TURN: the Worker calls Cloudflare Calls `…/credentials/generate` with the
  key token as a Bearer **server-side** and forwards only the returned
  short-lived credential (`ttl: 3600`). The key id/token never leave the
  Worker, are not logged (`console.error` prints only a 200-char message),
  not in analytics, not in error bodies. **PASS.**
- State machine server-authoritative (`invited → accepted → connecting →
  active → reconnecting → ended/declined/cancelled/expired/failed`); invite
  10 min, session 45 min; `LIVE_MAX_SIGNALS = 400` per session, payload ≤ 8 KB;
  block ends the call for both (403 thereafter); suspension closes open pair
  and live; expired sessions cannot be revived (`open` check on every act).
  **PASS** (run.mjs live block; e2e host-leave/guest-sees-left).
- Signals are scoped to `session_id` and members only → cannot target another
  user's connection. **PASS.**

## 13. AI security (Part 12)

AI is labelled "AI · not a person" in the session header, on every AI turn,
on the tip, and in the Home/More-options copy; the system prompt states "You
are an AI, not a person, and you never claim otherwise" and treats transcripts
as speech, not instructions; user content is wrapped by
`ConversationOrchestrator.fence`; replies are JSON-constrained; 12 new AI
sessions/day per learner (`/ai/session`, 429 on the 13th, run.mjs). **PASS.**
**P2:** the Polish Worker's `chat` route accepts a **client-supplied system
prompt** and is protected only by origin allow-list + per-IP limits (20/min,
500/day); a non-browser client spoofing `Origin` can use it as a general
LLM proxy within those limits. Pre-existing (the role-play used it before this
branch). Recommendation: server-side prompt templates selected by id, and a
Firebase-token check on the chat route. Not a branch regression.

## 14. Abuse / moderation (Part 8, 11)

Report and block from the session header menu, the connection card options,
the live call menu (`run.mjs`, e2e). Reports are per-context (`pair_id` /
`conn:cid` / live id), `INSERT OR IGNORE`, 5/day; blocks 20/day; two
**distinct** reporters → 30-day suspension, queue removal, open pair/live
closed (`doReport`). Blocked users are excluded from candidates, presence,
audio, live, invites. **PASS** for presence of controls.
**P2 (abuse):** two colluding accounts that each pair once with a target can
suspend them for 30 days with no human review. Not weakened; recommended
minimum improvement: count a report toward the threshold only when the
reported learner had sent ≥ 1 turn or joined a live call in that context
(evidence of contact), and surface suspensions in the `audit` query so the
owner can lift a false one. Rate limits (per learner per day): interest 10,
match 30, invite 10, report 5, block 20, decide 40, live 20, AI 12, end 10;
per-IP 300/min; signals 400/session; audio 1.5 MB. **PASS.**

## 15. Privacy / data flow (Part 13)

| Data | Where | Vendor | Retention | Linked to identity | Policy match |
|---|---|---|---|---|---|
| First name, language, gender (optional), goals, mode, availability, tz | D1 `members` | Cloudflare | until deletion | yes (Firebase uid) | §8b ✓ |
| Voice turns + transcript + score | R2 + D1 `turns` | Cloudflare (transcription/score via Polish Worker → OpenAI) | 14 d after close; deletion immediate | yes | §8b ✓ (now also deletion) |
| Live call audio | peer-to-peer | none | not stored | — | §8b ✓ |
| Live session state (who/when/how long) | D1 | Cloudflare | 30 d after end | yes | §8b ✓ |
| AI coach transcript | sent to OpenAI via Polish Worker; not stored server-side | OpenAI | not kept | no uid sent | §8b ✓ |
| Reports / blocks / suspension | D1 | Cloudflare | reports/blocks about a user kept; audit 90 d | yes | §8b + deletion page ✓ (updated) |
| Presence (`last_seen`) | D1 | Cloudflare | rolling | yes | implied by "availability"; **P3:** add one sentence to §8b |
| Analytics events | Analytics Engine | Cloudflare | per dataset | **no** device id | policy §7 ✓ |
| IP | Worker rate-limit map (in memory), Cloudflare logs | Cloudflare | transient | — | ✓ |
| Account (e-mail, uid) | Firebase Auth / Firestore | Google | until deletion | yes | §5 ✓ |

Mismatch found and fixed: privacy §8b said "e-mail us to delete Practice
Partner data" while the in-app deletion left that data in place. Now the
in-app path erases it and the text says so.

## 16. Apple audit (Parts 14–17, 25)

| Item | Status | Evidence / note |
|---|---|---|
| Account deletion in-app (5.1.1(v), fetched) | PASS after fix | `fbDeleteAccount` → `ppEraseMe()` → `DELETE /me` → Firestore doc → `FBUser.delete()` → device wipe |
| UGC (1.2, fetched): filter, report, block, contact | PASS | transcript screening; report/block in three places; contact@lomonec.com published |
| Privacy policy URL | PASS | `privacy.html` (linked from app + flyer) |
| Privacy nutrition labels | MANUAL VERIFICATION REQUIRED | fill from §15 at submission |
| `PrivacyInfo.xcprivacy`, required-reason APIs, SDK signatures, `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, background audio, ATS, associated domains | BLOCKED — NATIVE PROJECT NOT PRESENT | no Xcode project in the repo |
| Login services (4.8, fetched) | NOT APPLICABLE today | only e-mail/password is exposed; Google/Apple sign-in code exists but is hidden — if Google sign-in is re-exposed on iOS, Sign in with Apple becomes required |
| Minimum functionality (4.2, fetched) | **RISK — MANUAL** | today's iOS presence is a PWA. A WKWebView wrapper of the same site would be a "repackaged website". Mitigation: native audio session / mic handling, push, and a native shell with real deep links — or stay PWA-only on iOS |
| Payments | NOT APPLICABLE — NO DIGITAL PURCHASE FLOW | |

## 17. Google Play audit (Parts 18–24)

| Item | Status | Evidence / note |
|---|---|---|
| Target API (fetched: API 36 required for new apps/updates from 31 Aug 2026) | **FAIL — SUBMISSION BLOCKER (packaging, P1)** | `playstore/app/build.gradle`: `compileSdkVersion 36`, **`targetSdkVersion 35`**, minSdk 21, AGP 8.9.1, Gradle 8.11.1, androidbrowserhelper 2.6.2. Fix at packaging time: regenerate with a bubblewrap that emits target 36 (or edit the generated gradle), bump `appVersionCode` (8 → 9), rebuild and re-sign |
| Account deletion in-app + web link (fetched) | PASS after fix | in-app path (above) + `delete-account.html` (updated to describe partner data) |
| Data Safety inventory | see §15 — MANUAL to enter | voice/audio (collected, not shared, encrypted, deletable), name, e-mail (auth), app activity, diagnostics none, device ids none, location none |
| Permissions | PASS (TWA) | TWA manifest requests no dangerous permissions; mic is a Chrome runtime prompt; `enableNotifications: false` |
| UGC policy (report/block accessible) | PASS | as §14 |
| AI policy (disclosure, handling) | PASS | AI labelled everywhere; OpenAI processing disclosed in privacy §4/§8b |
| Age / audience | PASS with note | Practice Partner 18+ gate; app listing must not declare a child audience; content rating questionnaire should mention user interaction |
| Listing assets | PASS (existing) | icon, feature graphic, 6+6 screenshots, 4,000-char description (needs a Practice Partner line at release) |

## 18. iOS native audit (Part 37)

**Updated 2026-09-19 (later the same day):** the iOS project now exists —
`mobile/ios/` (Capacitor 8, SPM, local web bundle, `capacitor://localhost`
origin), with `Info.plist` (`NSMicrophoneUsageDescription`,
`ITSAppUsesNonExemptEncryption=NO`, iPhone-only portrait, 1.1.0 (1)),
`PrivacyInfo.xcprivacy` (no tracking; e-mail, name, audio, user content
linked; product interaction not linked; UserDefaults CA92.1), 1024 icon,
brand launch screen, listing / review notes / privacy answers and 6.9"
screenshots under `mobile/ios/appstore/`. Apple's current requirement
(fetched): uploads must be built with Xcode 26 / iOS 26 SDK. **Still BLOCKED
on this machine:** no Xcode, no signing identity, no App Store Connect key —
archive, validation and upload happen on a Mac with Xcode 26 and the Lomonec
team (steps in `mobile/ios/README.md`). Before the app's networked features
work inside the shell, the three Workers must be redeployed with the
`capacitor://localhost` origin now in their allow-lists (a production deploy,
not done).

## 19. Android native audit (Part 38)

Present locally (`playstore/`, bubblewrap TWA, gitignored generated project):
applicationId `com.bemastery.app`, versionCode 8 / 1.0.1, signing keystore
local only, assetlinks live for both fingerprints. **Target API 35 → must be
36** before the next upload. Release AAB reproducible via `bubblewrap update`
+ `build.expect` (per CLAUDE.md). Web changes need no upload.

## 20. Accessibility (Part 27)

Hang-up, live dot, menu and presence strip carry `aria-label` / `aria-live`;
buttons ≥ 44 px (FAB 64 px); live state is text ("Connected — you can talk",
"Still connecting…") not colour alone; `prefers-reduced-motion` disables the
beacon, glow and FAB animations; RTL checked for ar/ur in the device
checklist. MANUAL VERIFICATION REQUIRED on VoiceOver/TalkBack for the live
room (focus order after Accept) — added to the physical list.

## 21. Performance (Part 29)

Polling: partner page 8 s (waiting/invited/connected) else 30 s; banner loop
10 s only when there is partner state; live signalling 1.2 s / 4 s bounded by
400 signals. D1: N+1 in `candidates()` (§9, P2). At 100 users fine; at 1,000
concurrent waiters the `/me` cost (~5 × queue size reads) becomes the first
bottleneck; at 10,000+ the per-Worker in-memory IP limiter and the JWKS cache
are fine, but D1 reads and the cron's per-pair loops need batching. No
scaling work done in this audit.

## 22. Database (Part 30)

Migrations 0001–0007 all additive (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE
ADD COLUMN`), applied from clean on the local dev D1 for every test run;
0007 (`pairs.live_wanted`) applied to staging (`migrations list` → none
pending). Indexes on pairs/turns/live tables (0003, 0004). Uniqueness:
`blocks` PK, `reports` `INSERT OR IGNORE`, offers keyed. Production D1 does
not exist. **PASS.**

## 23. Cron (Part 31)

`maintenance()` (daily trigger, `/__cron` dev-only): expires pairs, marks
abandoned, closes expired invites, purges audio 14 d after close, expires
live sessions, drops signals of closed sessions and old session rows, purges
stale interest (> 7 d), sweeps offers/cooldowns/counters/audit (90 d).
Idempotent (state-guarded updates), bounded by `SELECT … WHERE` sets. **PASS.**

## 24. Logging (Part 32)

Only `console.error("partner", message.slice(0,200))`; 500 bodies carry the
message only when `DEV_AUTH === "1"`; no tokens, audio, transcripts or TURN
material logged. **PASS.**

## 25. Testing (Part 35) — run in this session

| Suite | Result |
|---|---|
| `backend/partner/test/run.mjs` | **106/106** (100/100 before the deletion tests; one cold-start D1 "internal error" on first run is the documented local flake — clean rerun) |
| `tests/partner.mjs` | **122/122** (121 before) |
| `tests/smoke.mjs` | **27/27** |
| `tests/shadow-sync.test.mjs` | **27/27** |
| JS parse (`index.html` 4 scripts, `flyer.html` 2, `sw.js`, both Workers) | 0 errors |
| JSON (`i18n/*.json`, `manifest.json`, `twa-manifest.json`, JSON-LD) | valid |
| i18n parity | 1,874 keys in EN and in each of 15 files |
| `npm audit` (`tests/`, only Playwright 1.56.1) | 0 vulnerabilities; Workers have no npm dependencies |
| Staging | `be-partner-staging` healthy, TURN secrets set, migrations current; `be-events-staging` CORS ok |
| Lint / types | NOT APPLICABLE (no tooling in repo) |

## 26. Physical device validation (Part 36)

OWNER-REPORTED: live practice connected on Wi-Fi↔Wi-Fi, Wi-Fi↔cellular,
cellular↔Wi-Fi, cellular↔cellular after TURN was configured on staging. Not
performed by the auditor. Still required before store submission: mic
denied/restored, notifications denied, background/lock/resume during a call,
incoming phone call, audio route change (Bluetooth/AirPods/speaker), mute,
leave, partner leaves, block, report, **account deletion end-to-end on a
phone**, logout/login, stale session, poor network, app update, fresh
install, VoiceOver/TalkBack through the live room.

## 27. Store metadata readiness (Parts 39–40)

Present: name, description (4,000 chars, Play), icon, feature graphic,
screenshots, privacy URL, support e-mail, deletion page. Missing / to write:
Apple subtitle, keywords, review notes (test accounts A+B on General English,
how to reach Practice Partner, that the other party is a learner, how to
report/block/delete), age rating answers (user interaction: yes; unrestricted
web: no), Data Safety form entries (§15), a Practice Partner line in both
descriptions, UGC/AI disclosure text.

## 28. Threat model (Part 43)

| # | Actor / attack | Existing defence | Residual | Sev | Action |
|---|---|---|---|---|---|
| 1 | Malicious learner (harassment via turns) | screening, report, block, 2-report suspension, audio only, first names | voice content itself is not screened | P2 | human review queue post-launch |
| 2 | Compromised account | Firebase token; short-lived; deletion path | same as any account | P3 | — |
| 3 | Blocked learner re-contact | blockedEither on candidates, audio, live, invites | none found | — | — |
| 4 | Suspended learner | 403 on interest/invite/live; open sessions closed | — | — | — |
| 5 | Spammer (invites/queue) | per-day caps, per-IP/min | modest | P3 | — |
| 6 | Abusive voice in live | leave/hang-up, report, block end the call | no recording → no evidence | P3 | documented in SAFETY |
| 7 | Malicious client / modified requests | all authz server-side; ids validated by regex | — | — | — |
| 8 | Replay | idempotent turn ids, offer TTL, invite expiry | — | — | — |
| 9 | IDOR | §7 | none found | — | — |
| 10 | Token theft | Firebase revocation; short exp | standard | P3 | — |
| 11 | TURN credential theft | short-lived creds only; key in Worker secret | 1-h creds could be reused for relay bandwidth | P3 | shorten ttl to 600 s if abused |
| 12 | Prompt injection | fence + JSON output + AI never claims human | model may still deviate | P3 | — |
| 13 | D1/R2 abuse | caps, 1.5 MB, 400 signals | N+1 cost (§9) | P2 | batch query |
| 14 | Report abuse (collusion) | distinct reporters, per-context | two accounts can suspend | P2 | evidence-of-contact rule + owner lift |
| 15 | DoS | per-IP 300/min in-memory (per isolate) | isolate-local | P3 | Cloudflare rate-limit rule at release |
| 16 | Privacy attacker | counts only, no uids, no listing | first name + band visible to partners | P3 | — |
| 17 | AI cost abuse via Polish chat | origin + IP caps | spoofable origin | P2 | template ids + token check |
| 18 | Data exfiltration | R2 private, audio via member route only | — | — | — |

## 29. Findings (classified)

| ID | Sev | Area | Finding | Status |
|---|---|---|---|---|
| F-1 | **P1** | Account deletion | In-app delete left Practice Partner data in D1/R2; policy told users to e-mail | **FIXED** (`DELETE /me`, client hook, page + policy text, 6 Worker tests + 1 e2e) |
| F-2 | **P1 (packaging)** | Google Play | TWA `targetSdkVersion 35` < 36 required from 31 Aug 2026 | OPEN — fix at packaging (regenerate, versionCode 9) |
| F-3 | P2 | Abuse | 2-distinct-report auto-suspension has no evidence-of-contact requirement | OPEN — recommendation in §14 |
| F-4 | P2 | Performance | `candidates()` N+1; `/me` polls it | OPEN — recommendation in §9 |
| F-5 | P2 | AI | Polish `chat` accepts client system prompts (pre-existing) | OPEN — recommendation in §13 |
| F-6 | P3 | Privacy text | §8b should mention the 5-min "online" presence signal | OPEN |
| F-7 | P3 | Repo hygiene | root `.wrangler/` untracked local state | FIXED (`.gitignore`) |
| F-8 | P3 | iOS | no native project; 4.2 risk for a thin wrapper | OPEN — separate phase |
| F-9 | P3 | Release | `sw.js` must be bumped again at the merge deploy (branch has v348, live v347) | note for the deploy step |

## 30. Fixes made in this session

- `backend/partner/partner-worker.js`: `eraseMember()` + `DELETE /me` above the kill switch.
- `index.html`: `ppEraseMe()` (flag-independent, 404-tolerant), called first in `fbDeleteAccount`; new string `auth.delete_partner_fail`; `auth.delete_confirm` now names partner data.
- `delete-account.html`, `privacy.html`: what is erased / what is kept.
- `backend/partner/test/run.mjs` (+6), `tests/partner.mjs` (+1), README, TEST_PLAN, `.gitignore`.
- Staging Worker redeployed with the new route (validation only).

## 31. Remaining blockers

For **code merge**: none.
For **Google Play update**: F-2 (target API 36) — packaging step.
For **Apple**: native project absent (§18); PWA remains the iOS path today.

## 32. Merge recommendation

**READY FOR MERGE AFTER FIXES — P0/P1 FIXES COMPLETED AND RE-TESTED.** Merge
changes nothing visible (flags off, Worker undeployed). Deploy per CLAUDE.md:
bump `sw.js`, push, poll, `BASE=https://app.lomonec.com npm test`; then
`be-events` deploy before any flag goes on; then `be-partner` production
creation per RELEASE_PLAN (with TURN secrets and `DELETE /me` available even
while `PARTNER_ENABLED="0"`).

## 33. Post-merge Apple release plan

1. Decide PWA-only vs native shell. 2. If native: Xcode project, mic/audio
session, privacy manifest, usage strings, associated domains, push; prove 4.2
value. 3. Nutrition labels from §15. 4. Review notes + two test accounts.
5. Age rating with user interaction. 6. Submit.

## 34. Post-merge Android release plan

1. Regenerate the TWA with target API 36, versionCode 9. 2. Data Safety form
from §15 (voice/audio now collected). 3. Add Practice Partner + AI + UGC lines
to the listing; deletion URL = `delete-account.html`. 4. Content rating
questionnaire (user interaction). 5. Upload AAB; assetlinks unchanged.

## Status table

| Area | Status | Severity | Evidence | Action |
|---|---|---|---|---|
| Secrets / config | PASS | — | §5 | — |
| Track isolation | PASS | — | §8, live probes, run.mjs/e2e | — |
| Authentication | PASS | — | §6 | — |
| Authorization / IDOR | PASS | — | §7 | — |
| Matching security | PASS | — | §8 | — |
| Presence / waiting | PASS (perf P2) | P2 | §9 | batch query |
| Consent | PASS | — | §10 | — |
| Moderation | PASS (abuse P2) | P2 | §14 | evidence rule |
| Audio security | PASS | — | §11 | — |
| WebRTC / TURN | PASS | — | §12 | — |
| Rate limits | PASS | — | §14 | — |
| AI | PASS (P2 pre-existing) | P2 | §13 | templates + token |
| Privacy policy match | PASS after fix | — | §15 | F-6 sentence |
| Account deletion (Apple/Google) | PASS after fix | was P1 | §16/§17, tests | — |
| Apple native | BLOCKED | — | §18 | separate phase |
| Android native | FAIL (target API) | P1 packaging | §19 | regenerate |
| Accessibility | PASS + MANUAL | — | §20 | VoiceOver pass |
| Performance | PASS at pilot scale | P2 | §21 | — |
| Database / migrations | PASS | — | §22 | — |
| Cron | PASS | — | §23 | — |
| Logging | PASS | — | §24 | — |
| Dependencies | PASS | — | §25 | — |
| Tests | PASS | — | §25 | — |
| Physical devices | MANUAL VERIFICATION REQUIRED | — | §26 | list |
| Store metadata | MANUAL | — | §27 | write |
