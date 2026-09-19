# Practice Partner — data model (as built, 2026-09-18)

Storage: Cloudflare **D1** (SQLite) for records, **R2** for audio, both bound
to the Worker `be-partner` (`backend/partner/`). Nothing is stored in
Firestore; the existing `users/{uid}` document is not touched.

Identity: the Firebase Auth `uid` (verified from the ID token). No e-mail,
phone or display name from Firebase is stored — the first name comes from the
app profile the learner already typed, truncated to 24 characters. A uid is
never returned to another learner: candidates are addressed by **offer ids**,
sessions by **pair ids**.

Migrations: `0001_init.sql` (MVP tables), `0002_matching_connections.sql`
(additive: new columns and four new tables), `0003_indexes.sql` (indexes for
the cron and connection lookups). All additive; all must be applied. Rollback
of 0002/0003 is not needed for the code to run — unused columns and indexes
are harmless — so no down-migration is shipped.

## `members` — one row per learner who consented
| column | notes |
|---|---|
| uid PK | Firebase uid |
| name | first name only, ≤ 24 chars |
| lang | interface language |
| gender, same_gender | optional `f`/`m`/`x`; used only by matching |
| consent_at | required for everything else |
| **adult** | 1 = confirmed 18+; `POST /consent` refuses without it |
| **goals** | JSON list ≤ 3 of `casual workplace interview pronunciation daily fluency` |
| **mode** | `voice` / `live` / `either` |
| **avail** | JSON list of `morning afternoon evening weekends` |
| **tz** | UTC offset in hours |
| **opted_out** | 1 = never offered, cannot queue |
| **sessions_completed, sessions_abandoned** | reliability counters (internal) |
| **resp_ms_sum, resp_n** | reply latency after a partner's turn (capped at 7 d each) |
| strikes, suspended_until | see SAFETY.md |
| created_at, last_seen | |

## `interest` — the waiting queue (one row per uid)
| column | notes |
|---|---|
| uid PK | |
| track | always `general-english` (`TRACKS`); anything else is refused |
| band | `fnd-1-7` / `fnd-8-15` / `w1-4` / `w5-8` / `w9-12` |
| lang, prompt_week (0–12), fnd_day (0–15) | curriculum position |
| **mode** | `now` (Practise now) / `later` (Match me) |
| **topic** | ≤ 60 chars, optional |
| **goals** | copy of the member's goals at join time |
| created_at | oldest first breaks score ties |

## `offers` — opaque candidate handles
| column | notes |
|---|---|
| id PK | 16-hex, what the client sends to `/invite` |
| for_uid, cand_uid | who was offered whom |
| reasons | JSON list of reason enums |
| created_at, expires_at | 30-minute TTL; swept by the cron |

## `pairs` — one practice session
| column | notes |
|---|---|
| id PK | 16-hex |
| uid_a, uid_b | members |
| track, band, prompt_week, fnd_day | copied from the match (lower position of the two) |
| **kind** | `trial` (first session together) / `regular` (started from a connection) |
| **rounds** | 4 |
| **prompt_json** | `{phrase}` when the session was started from Shadow Studio's Apply It, else NULL; the curriculum position lives in `prompt_week` / `fnd_day` |
| status | `invited` (a proposal, 0005) / `active` / `closed` |
| **host** (0005) | who proposed / started it |
| **invite_expires** (0005) | 10 min after the proposal |
| **closed_by** (0006) | who closed it (NULL = system) — drives "{name} left today's practice" on the other side |
| **live_wanted** (0007) | 1 when the proposal asked for a live call ("Practise live" on a candidate card); the guest's accept then opens the `live_sessions` row for the host |
| closed_reason | `completed` / `rematch` / `left` / `blocked` / `expired` / `suspended` / `declined` / `cancelled` |
| **decision_a, decision_b** | `continue` / `rematch` / NULL |
| **completed_at** | set when the fourth turn lands |
| seen_a, seen_b | last time each opened the thread (drives unread) |
| week_start, created_at, closed_at | |

## `turns`
| column | notes |
|---|---|
| id PK | client-generated 16-hex `turn_id` (idempotent) |
| pair_id, from_uid | |
| day | 0 (unused in the rounds model, kept for the schema) |
| seq | 1–4, position in the session |
| audio_key | `pairs/{pair_id}/{id}.{webm|ogg|m4a|wav|mp3}` |
| mime, bytes, duration_ms | |
| transcript | screened, ≤ 2,000 chars, control chars and `<>` stripped |
| score | 0–100 or NULL |
| created_at | |

## `connections`
| column | notes |
|---|---|
| a, b PK | sorted uid pair |
| state | `trial` / `mutual` / `regular` / `disconnected` (after a rematch) / `ended` (learner ended the partnership) / `blocked` |
| *(derived)* `cid` | 16-hex SHA-256 of `a|b`, shown on the card; resolved server-side only against the caller's own rows |
| sessions | completed sessions together |
| created_at, updated_at, last_practice_at | |

## `cooldowns`
| column | notes |
|---|---|
| a, b PK | sorted uid pair |
| until | 14 days after a `rematch` decision |
| reason | `rematch` / `ended` |

## `live_sessions` (0004) — one live call
| column | notes |
|---|---|
| id PK | 16-hex, opaque |
| host, guest | members (a mutual/regular connection is required to create one) |
| state | `invited accepted connecting active reconnecting ended declined cancelled expired failed` |
| band, prompt_week, fnd_day, prompt_json | the task seed, as for pairs |
| created_at, updated_at, accepted_at, started_at, ended_at, end_reason | |
| expires_at | 10 min after the invitation, 45 min after each later transition; the cron expires the rest |
| host_seen, guest_seen | last poll from each side |

## `live_signals` (0004) — WebRTC signalling relay
| column | notes |
|---|---|
| id | autoincrement; `?after=` cursor |
| session_id, from_uid | |
| kind | `offer answer ice state round bye` |
| payload | ≤ 8 KB text (SDP / candidate JSON / a round number); ≤ 400 rows per side per session |
Deleted as soon as the session closes. **No audio is ever stored for live practice.**

## `reports`, `blocks`, `counters`
Unchanged from the MVP: one counted report per reporter per person (unique on
`by_uid, about_uid`), blocks are a composite-PK row both directions are
checked against, `counters.key = uid:route:yyyymmdd` for the daily limits
(`interest 10, match 30, invite 10, report 5, block 20, decide 40, live 20`).

## `audit`
| column | notes |
|---|---|
| id PK, ts | |
| actor | uid or `system` |
| action | `queue_joined pair_created turn_screened session_completed decided connection_mutual connection_regular left reported suspended blocked live_invited live_accepted live_declined live_cancelled live_started live_reconnecting live_left live_completed live_failed connection_ended ai_started` |
| target, pair_id | the other uid / the pair |
| meta | small JSON (`{mode}`, `{choice}`, `{reason, strikes}`, …) — never transcripts or audio |
Kept 90 days, then swept by the cron.

## Derived, not stored

- **roundsView**: `round`, `mine`, `theirs`, `complete`, `myTurn`, `waiting`
  from the turn count and `pair.rounds`.
- **Unread**: partner turns with `created_at > seen_me`.
- **Silent / fallback**: no partner turn since my last (or since pairing) for
  ≥ `PARTNER_TIMEOUT_H` (24 h) → `fallback: true`, `canRepair: true`.
- **Reliability** `= completed / (completed + abandoned)`, 0.6 when unknown.
- **Prompts**: computed by the client from `prompt_week` / `fnd_day` (+ `prompt_json.phrase`) and the curriculum;
  round 1 = lesson task (or the Apply-It phrase), rounds 2–4 = reply prompts.

## R2 objects

`pairs/{pair_id}/{turn_id}.{ext}`. Read only through `GET /turns/:id/audio`
after membership and block checks. Deleted 14 days after the pair closes by
the daily cron (`PURGE_AFTER_CLOSE_MS`).

## Client-side mirror (`S.pp`, localStorage)

`{ consent, seenIntro, lastMe: <GET /me>, lastFetch, notified: <turn id>,
notifiedAt: ms, notifiedLive: <session id>, applyPhrase?: {text, vid, ts},
ai?: {id, reason, seed, turns, history, pending, startedAt, completedAt, abandonedAt} }`. A cache for the Home card and offline
display; the Worker is the source of truth.
