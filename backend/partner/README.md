# be-partner — the Practice Partner Worker

Owns all Practice Partner data (D1 + R2). Nothing lives in Firestore. Design
and the full data model: `marketing/product/practice-partner/`. **Not
deployed** — see `RELEASE_PLAN.md` there. **General English only**: `TRACKS`
holds one id and any other track is refused with `403 track`.

## Deploy (production)

```
cd backend/partner
npx wrangler d1 migrations apply be-partner --remote --env ""   # only when a migration was added
npx wrangler deploy --env ""                                     # production = the top-level environment
```

`--env ""` is deliberate: the config carries `[env.dev]` and `[env.staging]`
too, and wrangler warns ("Multiple environments are defined … no target
environment was specified") whenever the deploy names none. Naming the
top level with an empty string silences it and makes the target explicit.
Staging is `--env staging`. Check what is live with `curl …/health` and
`npx wrangler deployments list --env ""`; secrets with
`npx wrangler secret list --env ""`.

## Switches (wrangler.toml `[vars]`)
| Var | Production | Dev | Effect |
|---|---|---|---|
| `PARTNER_ENABLED` | `"0"` | `"1"` | not `"1"` → `503 disabled` on everything but `/health` |
| `MATCH_WEIGHTS` | `"{}"` | `"{}"` | JSON overrides of `WEIGHTS_DEFAULT` (level, goal, curriculum, mode, availability, timezone, topic, reliability, history) |
| `PAIR_DAYS` / `PARTNER_TIMEOUT_H` | 7 / 24 | 7 / 24 | session expiry · partner-silence threshold for the AI fallback and early rematch |
| `IP_PER_MIN` | unset (120) | 100000 | per-IP request limit; the suites hammer one IP |
| `DEV_AUTH` | **unset** | `"1"` | accept `X-Dev-User` / `X-Dev-Now`, enable `/__reset` and `/__cron` |
| `LIVE_ENABLED` | `"0"` | `"1"` | live practice (Level 3): `/live*` → 403 `live_off` otherwise; staging "1" |
| `OPENAI_KEY` | **secret, to set** (`npx wrangler secret put OPENAI_KEY`) | unset | the four-round review's model call (same provider key as Executive Polish); without it `POST /pairs/:id/review` → `503 review_off` |
| `REVIEW_STUB` | unset | `"1"` | build the review deterministically from the transcripts instead of calling the model — tests and local runs, never production |
| `TURN_KEY_ID` / `TURN_KEY_TOKEN` | secrets, unset | unset | Cloudflare Calls TURN key → short-lived TURN creds in `GET /live/:id`; STUN only without |

## Routes (all need `Authorization: Bearer <Firebase ID token>`)
| Method | Path | Does |
|---|---|---|
| GET | `/health` | `{ok, dev, enabled}` (no auth) |
| GET | `/presence` | `{online, waiting}` — counts only, no auth, cached 30 s; the floating button's badge before sign-in |
| DELETE | `/me` | **account deletion** — erases everything held about the caller (member row, prefs, queue entry, offers, every turn they sent + its R2 audio, their four-round reviews, their pairs and turns, connections, cooldowns, live sessions/signals, counters, reports and blocks *they* filed). Sits above the `PARTNER_ENABLED` kill switch so a pilot learner can erase after roll-back. Kept: reports/blocks *about* them (other people's safety choices) and audit rows (90 d). Called by the app's Delete account before the Firebase user is deleted; idempotent |
| GET | `/me` | consent, `adult`, prefs, waiting state, `invite` (a proposal for me) / `pairInvite` (my open proposal), active pair with partner `{name, band, lang}`, `rounds` view, turns, unread, `fallback`/`canRepair`, decisions, `lastClosed {reason, byOther, name}`, the best `connection` |
| POST | `/consent` | `{name, lang, adult: true, gender?, sameGender?, goals?, mode?, avail?, tz?}` — refuses without `adult` (`403 age`) |
| POST | `/prefs` | update goals / mode / avail / tz / same-gender / opt-out |
| POST | `/interest` | `{track, band, lang, promptWeek, fndDay, mode: now\|later, topic?, goals?, phrase?}` — join the queue; `now` pairs with the best candidate at once, `later` returns up to 3 candidate cards |
| DELETE | `/interest` | leave the queue |
| POST | `/match` | fresh candidate cards (opaque `offer` ids, 30-min TTL, reasons, never uids) |
| POST | `/invite` | `{offer, live?, phrase?}` — **propose** a trial: a pair in state `invited` (10 min); both learners stay in the queue until the guest answers. `live:true` (0007 `pairs.live_wanted`) asks for a call: the guest's **accept** also opens a `live_sessions` row (host = proposer, state `invited`), so the host's poll walks into the room and the guest's join is one more tap |
| POST | `/pairs/:id/accept` · `/decline` (guest) · `/cancel` (host) | the guest's answer; accept is the atomic step that takes both out of the queue and activates the pair (closes any other open proposals for either); idempotent |
| POST | `/next` | `{promptWeek, fndDay, band, phrase?}` — a connected (mutual/regular) partner starts the next session |
| GET | `/pairs/:id` | the pair, members only |
| POST | `/pairs/:id/seen` · `/leave` · `/report {reason}` · `/block` · `/decide {choice: continue\|rematch\|later}` | as named. **Decisions:** `continue` is recorded per side; a connection is created only when BOTH sides have said `continue`, in one guarded `UPDATE` (the pair flips to `closed/completed` exactly once, so a repeat or two simultaneous calls cannot count a session twice); `rematch` closes the pair with a 14-day cooldown; `later` (Not now) closes it as `completed` with no connection and no cooldown — the trial stays on record and both are free. A block on either side makes `continue` 403 |
| POST | `/turns` | multipart `audio, transcript, score, duration_ms, turn_id` — turn-order enforced, screened, stored; idempotent on `turn_id`; the 4th turn completes the session |
| GET | `/turns/:id/audio` | streams audio to pair members only |
| POST | `/connection/end` · `/connection/report {reason}` · `/connection/block` | `{cid}` — partner management from the connection card; `cid` is an opaque hash resolved only against the caller's own connections (anyone else's → 404). End = state `ended` + 14-day cooldown + any open session/call with that partner closed as `left`; idempotent; not a block, not a report; 10/day |
| POST | `/ai/session` | `{id, track, reason?}` — records an AI coach session per learner (never per IP). **No daily ration**; idempotent on `id`, `403 track` for any other track |
| POST | `/pairs/:id/review` | **four-round review** (migration 0009). `{context?, learned?}` — once the session is complete (409 `not_complete` before), the caller's OWN rounds become one private, topic-aware lesson: what went well / to improve with round evidence, task mastery per component of the day's task, pronunciation targets (evidence-labelled: `audio` when an audio-in model scored the turn's words, `asr` when only a recogniser heard them, `none`), recurring sentence patterns (kind `error|awkward|unnatural|self_correction|hesitation`), natural English, topic vocabulary (`used_well / misused / must / upgrade / next / patterns`), a coach script, a polished answer with the learner's facts, five indicators (`pron grammar vocab fluency task`) with per-round evidence, the next practice plan, reuse of `learned`, the previous plan judged. `context` = the day's curriculum the app sends (week, day, topic, objective, task, phrase bank — clamped by `reviewContext`); `learned` ≤ 20 strings. Member only; `403 track` if the pair is not on an allowed track; idempotent per (pair, uid): repeat → 200 the stored row, concurrent → 202 `{pending:true}`; 20/day. The partner's turns reach the model only as the questions that were answered and are not stored in the review. Every field is clamped by `reviewShape` before storage |
| GET | `/reviews` | the caller's own reviews, newest first (≤ 40): `{id, pairId, round (session number), evidence, at, review}`. Nobody else's — there is no route to another learner's review |
| POST | `/live` | `{band, promptWeek, fndDay, phrase?}` — invite whoever you practise with: the **open session's partner first** (a trial with a stranger included — "if it does not click, leave"), else the connected partner; 404 `no_connection` when neither (idempotent per open session; 20/day) |
| GET | `/live/:id` | session view + `iceServers` (members only) |
| POST | `/live/:id/accept` · `/decline` (guest) · `/cancel` (host) | as named, idempotent |
| POST | `/live/:id/signal` | `{kind: offer\|answer\|ice\|state\|round\|bye, payload ≤ 8 KB}`; drives `connecting` / `active` / `reconnecting` |
| GET | `/live/:id/signals?after=N` | the other member's signals after N, plus state |
| POST | `/live/:id/end` `{reason: left\|completed\|failed}` · `/report {reason}` · `/block` | end (idempotent); report/block end the call for both |
Dev only (`DEV_AUTH=1`): `X-Dev-User`, `X-Dev-Now`, `POST /__reset`, `POST /__cron`, `POST /__uncap {uid}` (clears one learner's report/block counters and burst rows; there is no practice quota to clear).

`/me` also carries `liveEnabled` (the Worker's `LIVE_ENABLED`, which the client's `ppLiveOn()` follows so every device shows the same live buttons — the per-device flag is only a fallback before the first `/me`) and `presence: {online, waiting}` — counts only (members seen in the last 5 min, and queue rows younger than 7 days), never ids or names, excluding the caller and anyone either side has blocked. **No compatibility gate (owner, 2026-09-19):** `candidates()` offers anyone in line on the track; band, goals, lesson, availability and time zone only *order* the cards (`MIN_MATCH_SCORE` is no longer a filter). What still excludes: suspension, opt-out, the same-gender preference, blocks, and "already in a session"; a cooldown or an `ended`/`disconnected` connection only sorts that learner last. `presence.waiting` and `waiting.available` are the same number from the same filter (`candidates()` scores against a neutral row when the caller is not in line). A card with no other true fact carries the reason `in_line`. Queue rows older than 7 days are neither offered nor counted; the daily cron deletes them. **Online counts too (owner, 2026-09-19):** a consented member on this track (`members.track`, migration 0008, set by `/consent {track}` and `/interest`) who was seen in the last 5 minutes and is not in a session is offered even without a queue row (card `inLine:false`, reason `online_now`, `band:null`, ranked after everyone in line) and can be invited; a member with no track is never offered. The per-candidate lookups are batched into five set queries per call.

## Environments
`[vars]` = production (`PARTNER_ENABLED="0"`, placeholder D1 id). `[env.dev]` =
local only (`DEV_AUTH`, `IP_PER_MIN`, emulated D1/R2). `[env.staging]` = a
separate Worker `be-partner-staging` with its own D1/R2, `PARTNER_ENABLED="1"`,
real token verification, no `DEV_AUTH` — for real-device testing from the
branch (see `marketing/product/practice-partner/PILOT.md` § Staging). Not
deployed.

## Local development (nothing leaves the machine)
```
npx wrangler d1 migrations apply be-partner --local --env dev   # 0001 … 0009
npx wrangler dev --env dev --port 8787
node test/run.mjs            # 146 integration checks against the local Worker (REVIEW_STUB=1 in [env.dev])
```
In the app (served locally), set `localStorage.be_partner_api = "http://127.0.0.1:8787"`,
`localStorage.be_partner_dev_user = "alice"` and
`localStorage.be_flags = '{"practice_partner_enabled":true,"practice_partner_matching_enabled":true,"practice_partner_voice_enabled":true,"practice_partner_notifications_enabled":true}'`.
The client sends `X-Dev-User` instead of a Firebase token only for localhost/127.0.0.1 hosts.

## Errors the client handles
`auth` 401 · `disabled` 503 · `review_off` 503 · `review_unavailable` 502 · `not_complete` 409 · `consent` / `age` / `suspended` / `opted_out` / `forbidden` / `track` 403 ·
`paired` / `not_waiting` / `gone` / `busy` / `closed` / `complete` / `not_your_turn` / `not_complete` / `no_pair` 409 ·
`offer` / `no_connection` / `not_found` 404 · `too_large` 413 · `moderation` 422 · `rate` / `ip_limit` 429 (busy — try again shortly) · `limit` 429 (**report and block only**, a daily safety cap) · `live_off` 403 · `closed` 409 (live).

## Safety rules implemented here
Transcript screen (phones, e-mails, links, handles, messenger names, "call
me / add me" EN+FR); audio only via membership-checked route; block = pair
closed + never re-paired; rematch = 14-day cooldown (sorts that learner last — it no longer hides them); two distinct reporters =
30-day suspension; **daily** caps on the two safety actions only (report 5,
block 20 — `SAFETY_LIMITS`). **There is no daily practice quota**: the queue,
matching, invites, sessions, reviews, decisions, rematches, live and the AI
coach are unrationed, and abuse of them is held per minute by `BURST_PER_MIN`
(per learner, a D1 counter keyed by the minute, so exact across isolates) and
`IP_PER_MIN` (per IP, in memory), which answer `rate` / `ip_limit`, never
"today's limit". Turns alternate, four per session, audio ≤ 1.5 MB /
≤ 75 s; `audit` table (90 days); audio of closed pairs purged
14 days after close by the daily cron, which also stamps abandoned sessions
on the side whose turn it was (only if they had a full `PARTNER_TIMEOUT_H`
to reply) and sweeps offers, cooldowns, counters. Error bodies carry a
`detail` only under `DEV_AUTH`; production 500s are logged, not echoed.

## Invitation wake-ups (2026-09-26)

When a learner is invited (trial or live), `wake()` asks be-push to wake the
invitee's phone: `POST <PUSH_API>/wake` with `PUSH_SECRET`. The phone's push
id arrives on `/me?push=<id>` and is kept in `members.push_id` (migration
0010). Deploy order: migration → this Worker → be-push → site. Dev: `GET
/__wakes` lists the wakes since `/__reset`; `tests/push-invite.mjs` runs the
whole chain locally.
