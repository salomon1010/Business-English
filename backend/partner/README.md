# be-partner — the Practice Partner Worker

Owns all Practice Partner data (D1 + R2). Nothing lives in Firestore. Design
and the full data model: `marketing/product/practice-partner/`. **Not
deployed** — see `RELEASE_PLAN.md` there. **General English only**: `TRACKS`
holds one id and any other track is refused with `403 track`.

## Switches (wrangler.toml `[vars]`)
| Var | Production | Dev | Effect |
|---|---|---|---|
| `PARTNER_ENABLED` | `"0"` | `"1"` | not `"1"` → `503 disabled` on everything but `/health` |
| `MATCH_WEIGHTS` | `"{}"` | `"{}"` | JSON overrides of `WEIGHTS_DEFAULT` (level, goal, curriculum, mode, availability, timezone, topic, reliability, history) |
| `PAIR_DAYS` / `PARTNER_TIMEOUT_H` | 7 / 24 | 7 / 24 | session expiry · partner-silence threshold for the AI fallback and early rematch |
| `IP_PER_MIN` | unset (120) | 100000 | per-IP request limit; the suites hammer one IP |
| `DEV_AUTH` | **unset** | `"1"` | accept `X-Dev-User` / `X-Dev-Now`, enable `/__reset` and `/__cron` |
| `LIVE_ENABLED` | `"0"` | `"1"` | live practice (Level 3): `/live*` → 403 `live_off` otherwise; staging "1" |
| `TURN_KEY_ID` / `TURN_KEY_TOKEN` | secrets, unset | unset | Cloudflare Calls TURN key → short-lived TURN creds in `GET /live/:id`; STUN only without |

## Routes (all need `Authorization: Bearer <Firebase ID token>`)
| Method | Path | Does |
|---|---|---|
| GET | `/health` | `{ok, dev, enabled}` (no auth) |
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
| POST | `/pairs/:id/seen` · `/leave` · `/report {reason}` · `/block` · `/decide {choice: continue\|rematch}` | as named |
| POST | `/turns` | multipart `audio, transcript, score, duration_ms, turn_id` — turn-order enforced, screened, stored; idempotent on `turn_id`; the 4th turn completes the session |
| GET | `/turns/:id/audio` | streams audio to pair members only |
| POST | `/connection/end` · `/connection/report {reason}` · `/connection/block` | `{cid}` — partner management from the connection card; `cid` is an opaque hash resolved only against the caller's own connections (anyone else's → 404). End = state `ended` + 14-day cooldown + any open session/call with that partner closed as `left`; idempotent; not a block, not a report; 10/day |
| POST | `/ai/session` | `{id, track, reason?}` — opens an AI coach session for the count: 12 new per learner per day, idempotent on `id`, `403 track` for any other track |
| POST | `/live` | `{band, promptWeek, fndDay, phrase?}` — invite whoever you practise with: the **open session's partner first** (a trial with a stranger included — "if it does not click, leave"), else the connected partner; 404 `no_connection` when neither (idempotent per open session; 20/day) |
| GET | `/live/:id` | session view + `iceServers` (members only) |
| POST | `/live/:id/accept` · `/decline` (guest) · `/cancel` (host) | as named, idempotent |
| POST | `/live/:id/signal` | `{kind: offer\|answer\|ice\|state\|round\|bye, payload ≤ 8 KB}`; drives `connecting` / `active` / `reconnecting` |
| GET | `/live/:id/signals?after=N` | the other member's signals after N, plus state |
| POST | `/live/:id/end` `{reason: left\|completed\|failed}` · `/report {reason}` · `/block` | end (idempotent); report/block end the call for both |
Dev only (`DEV_AUTH=1`): `X-Dev-User`, `X-Dev-Now`, `POST /__reset`, `POST /__cron`, `POST /__uncap {uid}` (clears one learner's daily counters so the long browser run keeps its production-default caps).

`/me` also carries `liveEnabled` (the Worker's `LIVE_ENABLED`, which the client's `ppLiveOn()` follows so every device shows the same live buttons — the per-device flag is only a fallback before the first `/me`) and `presence: {online, waiting}` — counts only (members seen in the last 5 min, and queue rows younger than 7 days), never ids or names, excluding the caller and anyone either side has blocked. **No compatibility gate (owner, 2026-09-19):** `candidates()` offers anyone in line on the track; band, goals, lesson, availability and time zone only *order* the cards (`MIN_MATCH_SCORE` is no longer a filter). What still excludes: suspension, opt-out, the same-gender preference, blocks, and "already in a session"; a cooldown or an `ended`/`disconnected` connection only sorts that learner last. `presence.waiting` and `waiting.available` are the same number from the same filter (`candidates()` scores against a neutral row when the caller is not in line). A card with no other true fact carries the reason `in_line`. Queue rows older than 7 days are neither offered nor counted; the daily cron deletes them.

## Environments
`[vars]` = production (`PARTNER_ENABLED="0"`, placeholder D1 id). `[env.dev]` =
local only (`DEV_AUTH`, `IP_PER_MIN`, emulated D1/R2). `[env.staging]` = a
separate Worker `be-partner-staging` with its own D1/R2, `PARTNER_ENABLED="1"`,
real token verification, no `DEV_AUTH` — for real-device testing from the
branch (see `marketing/product/practice-partner/PILOT.md` § Staging). Not
deployed.

## Local development (nothing leaves the machine)
```
npx wrangler d1 migrations apply be-partner --local --env dev   # 0001 … 0007
npx wrangler dev --env dev --port 8787
node test/run.mjs            # 98 integration checks against the local Worker
```
In the app (served locally), set `localStorage.be_partner_api = "http://127.0.0.1:8787"`,
`localStorage.be_partner_dev_user = "alice"` and
`localStorage.be_flags = '{"practice_partner_enabled":true,"practice_partner_matching_enabled":true,"practice_partner_voice_enabled":true,"practice_partner_notifications_enabled":true}'`.
The client sends `X-Dev-User` instead of a Firebase token only for localhost/127.0.0.1 hosts.

## Errors the client handles
`auth` 401 · `disabled` 503 · `consent` / `age` / `suspended` / `opted_out` / `forbidden` / `track` 403 ·
`paired` / `not_waiting` / `gone` / `busy` / `closed` / `complete` / `not_your_turn` / `not_complete` / `no_pair` 409 ·
`offer` / `no_connection` / `not_found` 404 · `too_large` 413 · `moderation` 422 · `limit` / `ip_limit` 429 · `live_off` 403 · `closed` 409 (live).

## Safety rules implemented here
Transcript screen (phones, e-mails, links, handles, messenger names, "call
me / add me" EN+FR); audio only via membership-checked route; block = pair
closed + never re-paired; rematch = 14-day cooldown (sorts that learner last — it no longer hides them); two distinct reporters =
30-day suspension; daily limits (interest 10, match 30, invite 10, report 5,
block 20, decide 40, live 20, AI sessions 12, end partnership 10); turns alternate, four per session, audio ≤ 1.5 MB /
≤ 75 s; per-IP limit; `audit` table (90 days); audio of closed pairs purged
14 days after close by the daily cron, which also stamps abandoned sessions
on the side whose turn it was (only if they had a full `PARTNER_TIMEOUT_H`
to reply) and sweeps offers, cooldowns, counters. Error bodies carry a
`detail` only under `DEV_AUTH`; production 500s are logged, not echoed.
