# Practice Partner — data model

Storage: Cloudflare **D1** (SQLite) for records, **R2** for audio. Both bound to
the new Worker `be-partner` (`backend/partner/`). Nothing is stored in
Firestore; the existing `users/{uid}` document is not touched.

Identity: the Firebase Auth `uid` (verified from the ID token). No email, phone
or display name from Firebase is stored — the first name comes from the app
profile the learner already typed, and is truncated to 24 characters.

## Tables (`backend/partner/migrations/0001_init.sql`)

### `members` — one row per learner who consented
| column | type | notes |
|---|---|---|
| uid | TEXT PK | Firebase uid |
| name | TEXT | first name only, ≤24 chars |
| lang | TEXT | interface language code |
| gender | TEXT NULL | `f` / `m` / `x` / NULL — optional, used only for same-gender matching |
| same_gender | INTEGER | 1 = only pair me with my own gender |
| consent_at | INTEGER | ms epoch; required for everything else |
| strikes | INTEGER | distinct reporters, see SAFETY.md |
| suspended_until | INTEGER NULL | ms epoch; no pairing, no sending while set |
| created_at, last_seen | INTEGER | ms epoch |

### `interest` — the waiting queue (one row per uid)
| column | notes |
|---|---|
| uid PK | |
| track | `general-english` / `welding` |
| band | `fnd-1-7` / `fnd-8-15` / `w1-4` / `w5-8` / `w9-12` |
| lang | interface language |
| prompt_week | 1–12 or 0 for Foundations |
| fnd_day | Foundations day at time of joining (1–15) or 0 |
| created_at | oldest first is served first |

### `pairs`
| column | notes |
|---|---|
| id PK | random 16-hex |
| uid_a, uid_b | members |
| track, band | copied from the match |
| prompt_week, fnd_day | the curriculum position both follow for the week (the lower of the two) |
| week_start | ms epoch, midnight UTC of pairing day |
| status | `active` / `closed` |
| closed_reason | `left` / `blocked` / `expired` / `suspended` |
| seen_a, seen_b | ms epoch — last time each member opened the thread (drives "unread") |
| created_at, closed_at | |

### `turns`
| column | notes |
|---|---|
| id PK | random 16-hex |
| pair_id | FK pairs |
| from_uid | |
| day | 0–6, day index in the pair week |
| seq | 1–3 per (pair, uid, day) |
| audio_key | R2 key `pairs/{pair_id}/{id}.webm` |
| mime, bytes, duration_ms | |
| transcript | screened text; may be empty if transcription failed |
| score | INTEGER NULL, the coach's overall % |
| created_at | |

### `reports`
| column | notes |
|---|---|
| id PK | |
| pair_id, by_uid, about_uid | |
| reason | enum: `harassment` / `contact_info` / `not_english` / `abuse` / `other` |
| created_at | |
Unique on (by_uid, about_uid): one report per reporter per person counts once.

### `blocks`
| column | notes |
|---|---|
| by_uid, about_uid | composite PK |
| created_at | |

### `counters` — daily rate limits
| column | notes |
|---|---|
| key | `${uid}:${route}:${yyyymmdd}` |
| n | count |

## Derived, not stored

- **Duo streak**: consecutive pair-days (ending today or yesterday) on which
  both members sent ≥1 turn.
- **My partner streak**: consecutive days I sent ≥1 turn.
- **Unread**: partner turns with `created_at > seen_me`.
- **Silent**: no partner turn since my last turn (or since pairing) for
  ≥ `PARTNER_TIMEOUT_H` (24 h) → AI fallback shown; ≥ 48 h → "Find a new
  partner" allowed.
- **Prompt**: computed by the client from the curriculum for `(track,
  prompt_week | fnd_day, day)`; the Worker stores only the position.

## R2 objects

`pairs/{pair_id}/{turn_id}.webm` (or `.mp4`/`.ogg` by recorder MIME). Read only
through `GET /turns/:id/audio` after membership and block checks. Deleted when
a pair is closed for 14 days (`DELETE` in the daily cron) — a lifecycle rule
on the bucket is documented as belt-and-braces in RELEASE_PLAN.md.

## Client-side mirror (`S.pp`, localStorage)

`{ consent: true, seenIntro: true, lastMe: <GET /me response>, lastFetch: ms,
notified: <turn id> }`. It is a cache for offline display and the Home card;
the Worker is the source of truth. It is included in the cloud-sync blob like
the rest of `S` but is harmless if stale.
