# Practice Partner — architecture (as built, 2026-09-18)

## Discovery (what exists, reused how)

| Area | What exists | Reused how |
|---|---|---|
| App | One file `index.html`, `go(view)` router, `#v-<name>` divs, `valid[]` in `boot()`, bottom-bar map | View `partner`; Practice tab stays lit |
| Track boundary | `areaId()`, `AREA_GEN = "general-english"` | `isGeneralEnglish()` — every GE-only feature checks it |
| Feature flags | none before this branch | `FLAGS_DEFAULT` + `flag(name)`; `localStorage.be_flags` (JSON) overrides for local/test/internal preview |
| Auth | Firebase Auth (compat SDK, lazy `fbLoad()`), `FBUser` | Required; the ID token authenticates every Worker call |
| User data | `users/{uid}` Firestore blob (`S`) | **Not touched.** Partner data lives in D1/R2 |
| Recording | `MediaRecorder` in `phRecInto` / `rpListen` | Own small recorder (`ppRecord`); take stays in memory until sent |
| Transcription / assessment | `fbTranscribe(blob)`, `fbAssess(blob, target)` → `be-polish` | Reused unchanged |
| AI coach | `rRoleplay` (General English), `be-polish` `chat` | The labelled fallback: "Practise with AI" opens it |
| Curriculum | `trackWeeks()[w-1].days[d].task`, `fndPack().days[n-1].items[].en` | `ppPrompt(pair)` computes the round prompts client-side; both members compute the same from the pair's `prompt_week` / `fnd_day` (+ `prompt_json.phrase`) |
| Progress | `markPracticed()` | Sending a turn calls it |
| Notifications | `be-push` (payload-less), in-app cards | **In-app only**: Home card, Practice badge, toast / `Notification` via `ppNotify()` (dedup by turn id + 60 s) |
| Workers | `be-polish`, `be-push`, `be-events` | Fourth Worker `be-partner` (D1 + R2 + cron) |
| Analytics | `track(name, props)` → `be-events` allow-list | `partner_*` funnel and `shadow_v2_*` names added to the allow-list on this branch (Worker not deployed) |
| Shadow Studio | `.sh-work` workspace, YouTube player, `shSeek`/`shCurT`, transcript box | Shadow Studio V2 panel `#shV2` + `shadow-sync.js`; Apply It hands a phrase to Practice Partner (`ppState().applyPhrase`) |

## Components

```
index.html (client, General English only)      backend/partner/ (Worker: be-partner)
┌───────────────────────────────────────┐      ┌────────────────────────────────────┐
│ FLAGS: practice_partner_enabled …     │      │ PARTNER_ENABLED != "1" → 503 on all │
│ ppAvailable() = API && flag && GE     │      │   but /health                       │
│ Practice card · Home card · badge     │      │ auth: Firebase ID token (RS256,     │
│ #partner (rPartner)                   │      │   Google JWKS) or X-Dev-User when   │
│  consent (18+) · goals/mode/avail     │ fetch│   DEV_AUTH="1" (local only)         │
│  Match me → candidate cards (offers)  │ ───▶ │ /me /consent /prefs /interest       │
│  Practise now → paired or AI (label)  │      │ /match /invite /next                │
│  thread: rounds 1–4, prompt, record   │      │ /pairs/:id (GET) /pairs/:id/seen    │
│   → fbTranscribe → fbAssess → send    │      │   /leave /report /block /decide     │
│  decide: again / someone else         │      │ /turns (POST) /turns/:id/audio      │
│  connection card → POST /next         │      │ D1: members interest pairs turns    │
│  AI tip (tagged AI) · AI fallback     │      │   reports blocks counters           │
│ Shadow V2 Apply It → applyPhrase      │      │   connections cooldowns offers audit│
│ ppNotify(): dedup by turn id          │      │ R2: pairs/{pair}/{turn}.{ext}       │
└───────────────────────────────────────┘      │ cron daily: expire, reliability,    │
                                               │   purge audio 14 d after close,     │
                                               │   sweep offers/cooldowns/audit      │
                                               └────────────────────────────────────┘
```

## The three levels
| Level | What | Where it runs |
|---|---|---|
| 1 Recording / async human | the four-turn voice thread below | client + Worker + R2 |
| 2 AI coach practice | the same four turns with the AI coach when nobody is waiting, a partner is silent, or the learner chooses it (`ppAiStart`, state `S.pp.ai`, one open session at a time, pending-turn idempotency, Retry never resends) — replies from the Polish Worker `chat` route spoken with the natural voice; every card, turn and score carries the AI tag; the human thread is never touched | client + Polish Worker |
| 3 Live human practice | a real-time WebRTC voice call between two **connected** partners; the Worker owns the state machine and relays signalling as `live_signals` rows the peers poll (1.2 s while connecting, 4 s while talking); audio is peer to peer and never stored; AI only as text "phrase help" on the side | client + Worker (D1) |

### Live state machine (server-authoritative)
`invited` → `accepted` (guest) → `connecting` (first offer/answer) → `active`
(first "connected" report; `started_at`) ⇄ `reconnecting` → `ended`
(`left` / `completed` / `blocked` / `suspended`) — or `declined` / `cancelled`
/ `expired` (10 min invitation, 45 min from the last transition) / `failed`.
Every transition is a conditional `UPDATE … WHERE state=?`, so repeats are
harmless. Client: `ppLiveInvite / ppLiveAccept / ppLiveConnect / ppLivePoll /
ppLiveEnd`, bounded ICE restarts by the host, 45 s connect and 60 s
reconnect ceilings, `pagehide` → `/end` with keepalive. ICE: STUN always;
TURN minted from Cloudflare Calls per request when `TURN_KEY_ID` /
`TURN_KEY_TOKEN` secrets exist (without them, phones behind carrier NAT may
not connect — a documented limitation).

## Session model (try-before-connect)

- A **pair** is one session: `kind` `trial` (first time) or `regular`
  (started from a connection), `rounds = 4`, curriculum position = the lower of the two members'
  (`prompt_week` / `fnd_day`), `prompt_json = {phrase}` when started from
  Shadow Studio's Apply It.
- `roundsView(pair, turns, uid)`: turns alternate; you may lead by at most
  one; `per = 2` each; `complete` when `turns >= rounds` (or `completed_at`
  set). `POST /turns` refuses `complete` (409) and `not_your_turn` (409).
- On the fourth turn the Worker stamps `completed_at`, increments
  `sessions_completed` for both and audits `session_completed`.
- `POST /pairs/:id/decide {choice: continue|rematch}` — allowed when
  complete, or `rematch` after `PARTNER_TIMEOUT_H` (24 h) of partner silence.
  Both `continue` → `connections` row `mutual` (sessions 1) or `regular`
  (sessions ≥ 2), pair closed `completed`. Any `rematch` → `cooldowns` row
  for 14 days (ranking only, since 2026-09-19), connection `disconnected`, pair closed `rematch`.
- `POST /next` — a member of a `mutual`/`regular` connection starts the next
  session directly (409 `busy` if the partner is in a pair, 409 `paired` if
  you are).

## Matching

- **No compatibility gate (owner decision, 2026-09-19).** Anyone in line on
  the track can be asked; band, goals, lesson, availability and time zone
  only order the cards. The learner, not a score, decides — and "if it does
  not click, either of you can leave" is the rule on every card and in the
  How-it-works sheet. What still excludes a candidate is safety and state:
  suspension, opt-out, the same-gender preference, blocks, and "already in a
  session". A learner you ended with or rematched away from is **still
  offered while online, sorted last** — the `cooldowns` row and the
  `ended`/`disconnected` state only rank, they never hide (the strip counts
  from the same filter, so it can never say "1 waiting" over "no one is
  available"). While anyone is in line the AI coach is not offered; it
  returns when the count is back at zero.
- **Live is for whoever you practise with.** `POST /live` targets the open
  session's partner first (a trial with a stranger included), else the
  connected partner. A candidate card offers **Practise live** (a proposal
  with `live:true`: the guest's accept opens the room for the host at once —
  client `ppLiveWant` walks the host in on the next `/me`; the guest's
  accept goes straight to `ppLiveAccept()`) and **Try a practice** (recorded)
  side by side. Inside any open session, More options carries Practise live.
- **Presence and discovery.** `/me.presence {online, waiting}` feeds the
  strip on top of the partner page (`ppPresenceHTML`, green beacon when
  someone is there, tap → discovery). While a learner waits on the page,
  a rise in `waiting.available` opens the candidate cards without a tap,
  once per rise (`ppAutoAvail`), and mutes the availability banner for the
  same arrival. A floating **Find a practice partner** button (`#ppFab`)
  sits on every page except the partner page, live rooms, under a call banner,
  Welding, signed-out and unconsented (it steps above the session pill, `.lift`); tapping it lands on discovery for an idle or waiting
  learner. The newcomer toast dedupes by who is on the cards (offer ids are
  minted per call). The **live beacon** (`#ppLiveDot`, pill dot, call-banner
  dot, presence dot) reuses the road map's `rmRing` + `rmSpin` animations.
- **Hang up.** The call card carries a red phone button (`ppLiveHangup`):
  cancel while the host waits, decline for an invited guest, leave in a call —
  one tap, no confirmation, as on a phone. The Home card shows the green
  presence counts when idle and someone is online.
- **Partner left.** One dialog (`pp.gone_*`) — **Close** / **Find another
  partner** — and either answer clears that partner from the screen at once
  (`dismissedClosed`, take and cards dropped, re-render; the poll also
  re-renders when the pair id vanishes even mid-take).
- `POST /interest {track, band, lang, promptWeek, fndDay, mode: now|later,
  topic?, goals?, phrase?}` — upserts the queue row (`403 track` unless
  `general-english`). Then `candidates()` scores every other queued learner
  on the same track (rows younger than 7 days; the cron purges older ones). `mode:"now"` with a candidate → pair created at once;
  otherwise up to 3 **offers** are minted (opaque 16-hex ids, 30-minute TTL)
  and returned as cards `{offer, name, band, goals(≤2), topic,
  availability, reasons, waitingMin}`. No uid ever leaves the Worker.
- `POST /match` — re-mint up to 3 offers for a learner already waiting.
- `POST /invite {offer}` — try a practice with that candidate. Pairing is one
  D1 `batch` (delete both interest rows, insert the pair) so two simultaneous
  invites cannot both succeed; the loser gets 409 `gone` or 404 `offer`.
- Scoring: `score()` — exported and unit-tested — with `WEIGHTS_DEFAULT`
  overridable through the `MATCH_WEIGHTS` Worker var. Reasons are the
  strongest true facts, max two, as enum strings the client translates
  (`same_level`, `same_lesson`, `same_stage`, `goal:<g>`, `available_now`,
  `same_time:<a>`, `practised_before`, `in_line`).

## Request flow: sending a turn

1. Client records (`MediaRecorder`, ≤ 60 s timer), keeps the blob in memory,
   plays it back; re-record replaces it.
2. `fbTranscribe(blob)` → transcript; `fbAssess(blob, transcript)` → per-word
   score. Offline → the turn cannot be sent and the UI says so.
3. `POST /turns` multipart `audio, transcript, score, duration_ms, turn_id`.
   Worker: token → consented, not suspended → active pair → not blocked →
   not duplicate (`turn_id` idempotent) → not complete → my turn → size
   (≥ 1.2 KB, ≤ 1.5 MB) and length (≤ 75 s) → **transcript screen** → R2 put
   → D1 insert (R2 object deleted if the insert fails) → response-latency
   counters → completion check.
4. The partner's next `GET /me` (boot, tab focus, opening the view, or the
   poll while the thread is open) carries the new turn; `ppNotify()` raises
   the card / badge / toast once per turn id.

## Auth

`Authorization: Bearer <Firebase ID token>`. The Worker fetches Google's
securetoken JWKS (cached 1 h; an unknown `kid` triggers one refetch per
minute so key rotation does not lock users out), verifies RS256 with
WebCrypto, rejects non-RSA / non-RS256 keys, checks `aud`, `iss`, `exp`,
`iat`, `sub`. **Development:** `DEV_AUTH="1"` (only in
`[env.dev]`) accepts `X-Dev-User` and `X-Dev-Now` (movable clock); the client
sends them only when `ppApiBase()` is `localhost`/`127.0.0.1` and
`localStorage.be_partner_dev_user` is set.

## Feature flags (client, `FLAGS_DEFAULT`)

| Flag | Production default | Gates |
|---|---|---|
| `practice_partner_enabled` | off | the whole feature (`ppAvailable()`), the Apply-It partner button |
| `practice_partner_matching_enabled` | off | Match me / Practise now buttons (consent and profile still reachable) |
| `practice_partner_voice_enabled` | off | the recorder in the thread (`pp.voice_off` otherwise) |
| `practice_partner_ai_fallback_enabled` | on | the labelled AI coach offer when no human / partner silent |
| `practice_partner_notifications_enabled` | off | `ppNotify()` toast / `Notification` (Home card and badge stay) |
| `practice_partner_live_enabled` | off | Practise-live button, invitation cards, the room (`ppLiveOn()`); the Worker's own `LIVE_ENABLED` var is the server boundary |
| `shadow_studio_v2_enabled` | off | the `#shV2` panel |
| `shadow_word_timing_enabled` | on | word-level karaoke when the caption file has word times |
| `shadow_apply_phrase_enabled` | off | the Apply tab in Shadow Studio V2 |

Server side, `PARTNER_ENABLED="0"` in production `wrangler.toml` returns 503
`disabled` on everything but `/health` even if a client has flags on.

## What changes where

- `index.html`: flags block; `PARTNER_API`, `ppApi()`, `rPartner`, `ppHomeCardHTML()`,
  `ppUnread()`, `ppNotify()`, `ppPrompt()`, `ppMatch/ppNow/ppInvite/ppNext/ppDecide`;
  Shadow V2 block (`shV2Load`, `svRender`, `svTick`, `svApply*`); i18n `pp.*`, `sv.*`.
- `shadow-sync.js` (new), `captions/*.json` (word times where available), `sw.js`
  precache entry for `shadow-sync.js`.
- `backend/partner/`: `partner-worker.js`, `wrangler.toml`, `migrations/0001`, `0002`,
  `README.md`, `test/run.mjs`.
- `backend/events/events-worker.js`: new event names and prop keys (not deployed).
- `i18n/*.json`: `pp.*` and `sv.*` keys in 15 languages.
- `tests/partner.mjs`, `tests/shadow-sync.test.mjs`, `tests/package.json`.
- `privacy.html`: Practice Partner section (18+).
- `sw.js`: cache name **not** bumped on this branch (bump at release).

## What does NOT change

Firestore documents or rules; `be-polish` and `be-push` code; the Welding
programme; every existing view when the flags are off.
