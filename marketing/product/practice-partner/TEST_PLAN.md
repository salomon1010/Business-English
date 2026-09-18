# Practice Partner — test plan

Three layers, all runnable locally with zero production access.

## 1. Worker integration tests — `backend/partner/test/run.mjs`
Starts nothing itself; expects `npx wrangler dev --local --port 8787` running
in `backend/partner/` (local D1 + R2 emulation, `DEV_AUTH=1` from
`wrangler.toml [env.dev]`). Uses two dev users `alice`, `bob` (and `mallory`,
`carol` for negative cases) via `X-Dev-User`.

| # | case | expectation |
|---|---|---|
| 1 | unauthenticated `GET /me` | 401 |
| 2 | `/interest` before consent | 403 `consent` |
| 3 | consent for alice/bob | 200, member rows |
| 4 | alice joins (general, w1-4, fr) → waiting | `status:"waiting"`, `waitingCount:1` |
| 5 | carol joins (welding) → still waiting (constraint) | not paired with alice |
| 6 | bob joins (general, w1-4, fr) → paired with alice | both `/me` show pair, partner name only |
| 7 | prompt position | pair `prompt_week` = min(alice, bob) |
| 8 | alice sends turn (multipart audio) | 201, seq 1 |
| 9 | bob `/me` → unread 1; `GET /turns/:id/audio` as bob | 200 audio bytes |
| 10 | mallory `GET /turns/:id/audio` | 403 (audio access security) |
| 11 | mallory `GET /pairs/:id` | 403 (unauthorized access) |
| 12 | alice sends 3 more turns same day | 4th → 429 `limit` |
| 13 | transcript with a phone number / "whatsapp" / email | 422 `moderation`, no R2 object |
| 14 | duplicate `turn_id` | second call returns the same turn, no new row |
| 15 | audio > 1.5 MB | 413 |
| 16 | bob replies; alice `/me` unread 1; `/seen` clears it | |
| 17 | duo streak after both sent today | `duoStreak:1` |
| 18 | silence: alice's last turn backdated 25 h (test hook `X-Dev-Now`) | `/me` → `partnerSilentH >= 24`, `fallback:true` |
| 19 | report ×1 from alice, ×1 from carol on bob | `strikes:2`, bob `suspended_until` set, pair closed `suspended` |
| 20 | block: alice blocks dave after pairing | pair closed `blocked`; dave gets 403 on pair & audio; re-queue never pairs them |
| 21 | leave | pair closed `left`; both can re-queue |
| 22 | same-gender: eve(f, same_gender) never paired with frank(m) | |
| 23 | rate limits: 11th `/interest` join in a day → 429 | |
| 24 | cron `/__cron` (dev-only trigger): expired pair closed, closed-14d audio deleted | |
| 25 | token path: forged RS256 token with a local key vs a fake certs endpoint | verifier rejects wrong aud / iss / expired / bad signature; accepts good |

## 2. Browser end-to-end — `tests/smoke.mjs` (Playwright, 390×844 mobile)
Runs when `PARTNER_API=http://127.0.0.1:8787` is reachable; skips with a
notice otherwise (so the suite still passes on machines without wrangler).
Two browser contexts (alice, bob) with `be_partner_dev_user` set.

- new user: Practice tab shows the Practice Partner card; opening it shows the
  consent sheet; refusing keeps everything unshared.
- existing user without a match: "Get a partner" → waiting state with count;
  refresh keeps waiting state; withdraw works.
- match: bob joins → both see the partner (first name, band) and today's
  prompt from the curriculum (assert text equals the curriculum task).
- record/playback/re-record: mock `getUserMedia` (Playwright `--use-fake-device-for-media-stream`);
  Send disabled until a take exists; playback control appears; re-record
  replaces; a second Send tap during flight does nothing (duplicate).
- send: turn appears in alice's thread; bob's Home shows the card and Practice
  badge after `GET /me`; bob plays the audio (request returns 200).
- partner response: bob sends; alice notified.
- AI fallback: with `X-Dev-Now` advanced 25 h, alice sees the explicit
  "hasn't responded" card and the AI-coach button opens `#roleplay`.
- block and report from the thread menu; the pair ends on both sides.
- logout/login: signing out hides the thread (401 → sign-in card); refresh on
  `#partner` restores the thread.
- network failure: Worker unreachable → offline card, no crash, retry works.
- no JavaScript errors across the run.

## 3. Static checks
- JS parse check of every inline script (CLAUDE.md one-liner).
- i18n key parity: `I18N_EN` vs the 15 files.
- `node --check` on the Worker; `wrangler deploy --dry-run` (no upload).
- Existing smoke checks (27) must still pass.

## Manual (recorded in the PR)
- Real microphone on a phone via the local server; audio plays back on the
  partner's phone.

## Results (2026-09-18, branch `feature/practice-partner`)

| Suite | Result |
|---|---|
| `backend/partner/test/run.mjs` (local Worker, D1/R2 emulated) | **28/28** |
| `tests/smoke.mjs` (existing app suite) | **27/27** |
| `tests/partner.mjs` (two browsers, 390×844, fake microphone) | **35/35** |
| JS parse check (4 inline scripts) | 0 errors |
| i18n parity (`I18N_EN` 1,636 keys vs 15 files) | no missing, no orphans |
| `wrangler deploy --dry-run --env dev` | builds, 22.7 KiB; nothing uploaded |

Manual, in the Playwright MCP browser (dark theme, 390 px): consent → get a
partner → waiting → paired → curriculum prompt → synthetic take → send →
moderation refusal → partner reply → Home card / badge / toast → play audio →
day roll-over → AI fallback → report → block (partner gets 403). Screenshot of
the thread reviewed for design consistency.

Observed once, not reproduced: two smoke checks (welcome card) failed in a run
where the local Worker process had just died; three subsequent runs were green.

Not tested: a real microphone on a physical phone (no device in this
session); Firebase ID-token path against Google's live JWKS (verifier is
unit-tested with a generated RSA key pair and rejects wrong aud/iss/exp/kid/
signature).
