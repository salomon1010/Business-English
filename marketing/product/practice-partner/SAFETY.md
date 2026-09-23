# Practice Partner — safety (as built, 2026-09-18)

Human-to-human voice is the most sensitive thing BE Mastery has ever carried.
Every control below is implemented and covered by a test on this branch
unless marked *(documented, not automated)*.

## Scope boundary
- General English only. The Worker refuses any other track (`403 track`)
  before a row is written; the client hides the feature elsewhere. A Welding
  learner cannot be matched, offered, or notified.

## Consent and age
- A consent sheet opens before anything is shared: what the partner sees
  (first name, level band, interface language), that each sent turn and its
  transcript go to our server and to that one partner, 14-day retention,
  automatic screening, the labelled AI fallback, report/block.
- **18+**: the sheet has an "I confirm I am 18 or over" box. `POST /consent`
  without `adult: true` is refused (`403 age`); `members.adult` is stored.
  Declared, not verified — same as the rest of the app. `privacy.html` says
  18+.

## Minimal exposure
- A partner or candidate is shown as `name` (first name, ≤ 24 chars), `band`,
  up to two goals, an optional topic word and "available now / later". No
  uid, e-mail, photo, country, gender or score — ever.
- Candidates are addressed by **opaque offer ids** (30-minute TTL) and
  sessions by pair ids; there is nothing to enumerate.
- No list of everyone waiting. Match me shows at most three; Practise now
  shows nobody.

## No side channels
- No text input exists. The only text is the transcript the coach produced.
- Transcripts are **screened** server-side before a turn is stored: phone
  numbers, e-mail, URLs and bare domains, `@handles`, messenger names
  (WhatsApp, Telegram, Instagram, Snapchat, Facebook, TikTok, Discord,
  Signal, Viber, imo, WeChat, Messenger) and "my number / call me / add me"
  in English and French. A hit → `422 moderation`, audio not stored, an
  audit row `turn_screened`, and the client explains why. Screening, not
  moderation — copy never says "moderated by humans".
- Audio is never publicly addressable: R2 objects are served only through
  `GET /turns/:id/audio` after membership and block checks.

## AI is always AI
- The AI coach appears in three places: when Practise now finds nobody,
  when a partner is silent 24 h, and as the one-line tip after a session.
  Every one carries the `pp.ai_tag` badge ("AI") and copy that says so. An
  AI turn is never inserted into the thread as if the partner had spoken.

## Live practice (Level 3)
- Only two **connected** partners (mutual/regular) can start a call; one open
  live session per learner; opaque 16-hex ids; every route checks membership
  and blocks; `LIVE_ENABLED` is a server switch separate from the partner one.
- Audio is peer to peer and **never recorded or stored**; the Worker relays
  only signalling (≤ 8 KB, ≤ 400 rows per side) and deletes it when the
  session closes.
- Report and block work **during** a call from the room menu: block tears the
  call down on the learner's device before the request leaves, and the Worker
  ends the session for both sides and blocks both directions; the other side
  sees only "left".
- Invitations expire in 10 minutes, sessions 45 minutes after their last
  transition; the daily cron closes the rest. No daily limit on live sessions —
  only the per-minute burst control above.
- TURN credentials, when configured, are short-lived and minted per request;
  no permanent secret reaches the client.

## AI coach practice (Level 2)
- Labelled AI on the card, every turn, every score line and the resume card;
  the human thread is a separate object and is never merged. The transcript
  sent to the model is fenced as speech, not instructions.

## Partner management — five different actions
- **Leave today's practice** (`/pairs/:id/leave`): closes the session only; the partnership, if any, stays.
- **Find someone else** in a session (`decide rematch`): closes the session, 14-day cooldown (ranks that learner last in the cards; since 2026-09-19 it does not hide them — Block does), connection `disconnected`.
- **End partnership** (`/connection/end {cid}`): connection `ended`, 14-day cooldown, any open session/call with that partner closed as `left`; not a block, not a report; the other learner only sees the partnership is gone. Idempotent; the `cid` resolves only against the caller's own connections, so nobody can end someone else's.
- **Block** / **Report**: unchanged safety actions, now also available from the connection card (`/connection/block`, `/connection/report`) and during live calls.
- **Unblock** (`/connection/unblock {cid}`, 2026-09-20): only the person who placed a block can lift it — from **Change preferences → Blocked learners** or the History tab. A fresh start, not a restored partnership: the connection goes `blocked → ended`, no cooldown, the two can be offered to each other again like strangers. The other side is never told, in either direction; if they blocked too, their block stands.
- **History** (the second tab of the page): the learner's own device record of every session, turn, score, call, AI practice and safety action — the partner's words are never kept. **Clear my history** removes it on the device and in the account backup and deletes the learner's own recordings of closed sessions from the server at once (`DELETE /history`); reports and blocks stay, because they protect other people.

## Report, block, leave, decide
- **Report** (harassment, contact details, not English, abusive, other): one
  counted report per reporter per person; two distinct reporters →
  `suspended_until = now + 30 days`, removed from the queue, active pair
  closed `suspended`, audit `suspended`. 5 reports/day so it cannot be
  weaponised; a report is invisible to the reported person.
- **Block**: closes the pair, `blocks` row, `connections.state = blocked`;
  matching excludes both directions forever; the blocked person receives 403
  on the pair and its audio. Silent.
- **Leave**: closes the pair `left`, allowed any time.
- **Decide** "find someone else": closes the pair `rematch`, 14-day
  `cooldowns` row, connection `disconnected`. The partner sees "this session
  has ended", never the reason. Neither decision is shown to the other.

## Abuse prevention and rate limits (Worker)
**There is no daily practice quota.** Joining the queue, matching, inviting,
running a session, getting its review, deciding, rematching, live calls and AI
coach sessions are unrationed: a learner may go round the loop as often as they
like (owner, 2026-09-23 — an earlier build counted these per UTC day and told
the learner "You've reached today's limit", which was never a BE Mastery
product rule).

- **Per UTC day**, two safety actions only: `report 5 · block 20`
  (`SAFETY_LIMITS`). Firing dozens of these in a day is the abuse.
- **Per minute**, everything else: `BURST_PER_MIN` (60 per authenticated
  learner, a D1 counter keyed by the minute, exact across isolates) and
  `IP_PER_MIN` (300, per IP, in memory). They answer `429 rate` /
  `429 ip_limit` — "try again shortly", and nothing accumulates.
- Cost-bearing routes are bounded by structure, not by a ration: `/review`
  needs a COMPLETED four-turn session and is served from the stored row on
  every repeat, so it cannot be farmed.

Older, non-rate limits that stay:
turns: one per round, alternating, four per session; audio ≥ 1.2 KB, ≤ 1.5
MB, ≤ 75 s; all routes 120 requests/min per IP (`IP_PER_MIN` env; tests
raise it). Duplicate sends are idempotent on the client-generated `turn_id`.
Pairing is a D1 batch so a candidate cannot be paired twice.

## Reliability, not reputation
- `sessions_completed`, `sessions_abandoned` (the member whose turn it was
  when an incomplete pair expires — and only if they had a full
  `PARTNER_TIMEOUT_H` to reply, so a turn sent an hour before expiry does
  not penalise the other side) and reply latency feed the matching score
  at a small weight. They are **never shown** to anyone.

## Audit
- `audit` rows for queue joins, pairings, screened turns, completions,
  decisions, connections, leaves, reports, suspensions, blocks — actor, target
  uid, pair id, small meta. Never transcripts or audio. Kept 90 days.

## Kill switches
- Server: `PARTNER_ENABLED="0"` (production default) → 503 `disabled` on
  everything but `/health`.
- Client: `practice_partner_enabled` off by default; `PARTNER_API=""` also
  hides the feature.

## Retention
- Audio and transcripts of a closed pair are deleted by the daily cron 14 days
  after closure. Active pairs expire after `PAIR_DAYS` (7). Offers expire in
  30 min, cooldowns in 14 days, audit in 90 days. `reports` and `blocks` are
  kept.

## Privacy copy
- `privacy.html` section 8b: what is shared, with whom, for how long, how to
  report, 18+.

## What is explicitly NOT built
- No human moderation queue *(reports are visible only in D1 / audit)*.
- No automatic audio content analysis (only the transcript is screened).
- No age verification beyond the declaration.
- No matching by gender beyond the optional same-gender flag.
