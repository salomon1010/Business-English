# Practice Partner — architecture

## Discovery (what exists, read from the code on 2026-09-18)

| Area | What exists | Reused how |
|---|---|---|
| App | One file `index.html` (HTML+CSS+JS), `go(view)` router, `#v-<name>` divs, `valid[]` list in `boot()`, bottom-bar map | New view `partner` registered in all three places; Practice tab stays lit |
| Auth | Firebase Auth (compat SDK, lazy `fbLoad()`), `FBUser`, `fbOpenModal('up'|'in')` | Required for the feature; the ID token authenticates every Worker call |
| User data | `users/{uid}` Firestore doc = one JSON blob (`S`), rules published by hand | **Not touched.** Partner data lives in D1 |
| Recording | `MediaRecorder` in `phRecInto` / `rpListen`; IndexedDB `recs` store | Same pattern, own small recorder (`ppRecord`) so the take stays in memory until sent; not saved to `recs` |
| Transcription | `fbTranscribe(blob)` → `POLISH_API` (Whisper) | Reused as is |
| Speech assessment | `fbAssess(blob, target)` → `POLISH_API` (`assess`) | Reused: target = the transcript (the roleplay does the same) |
| AI colleague | `rRoleplay` (General) / `rSimulation` (Welding), polish Worker `chat` | The explicit fallback: "Keep practising with your AI coach" opens it |
| Curriculum | `trackWeeks()[w-1].days[d].{focus,task}`, `fndPack().days[n-1].items[].en` | Prompts are computed from these, both members compute the same |
| Progress / streak | `markPracticed()`, `S.dates`, `streak()` | Sending a turn calls `markPracticed()`; duo streak is computed by the Worker |
| Notifications | `be-push` (payload-less, device id not tied to uid); in-app cards | **In-app only** in this MVP: Home card + Practice badge + toast on `GET /me`. Push is Phase 2 |
| Storage | none for user media beyond IndexedDB | New: R2 via the Worker |
| Workers | `be-polish`, `be-push` (KV), `be-events` (Analytics Engine) | New fourth Worker `be-partner` (D1 + R2). Separate so partner load can never take Polish down |
| Analytics | `track(name, props)` → `be-events` allow-list | `partner_interest` (already live), plus `partner_pair`, `partner_turn`, `partner_report`, `partner_block` added to the allow-list on this branch |
| Deployment | GitHub Pages from `main`, `sw.js` cache bump; Workers via `wrangler deploy` | Nothing deployed from this branch |
| Privacy | `fbSyncPayload` strips spoken transcripts before cloud sync; privacy.html | Partner turns are the first voice that leaves the device to another person — consent sheet + privacy text added |

## Components

```
index.html (client)                      backend/partner/ (Worker: be-partner)
 ┌─────────────────────────┐             ┌──────────────────────────────┐
 │ Practice → rp-entry card│             │ auth: Firebase ID token       │
 │ #partner view (rPartner)│  fetch +    │   (RS256, Google x509 certs)  │
 │  consent sheet          │  Bearer ──▶ │   or X-Dev-User when DEV_AUTH │
 │  get a partner / waiting│             │ routes: /me /consent /interest│
 │  thread: prompt, turns  │             │   /turns /turns/:id/audio     │
 │  ppRecord → fbTranscribe│             │   /seen /leave /report /block │
 │          → fbAssess     │             │ D1: members interest pairs    │
 │  AI fallback → roleplay │             │     turns reports blocks      │
 │ Home card + Practice    │             │     counters                  │
 │   badge from GET /me    │             │ R2: pairs/{pair}/{turn}.webm  │
 └─────────────────────────┘             │ cron daily: expire pairs,     │
                                         │   delete audio of closed pairs│
                                         └──────────────────────────────┘
```

## Request flow: sending a turn

1. Client records (`MediaRecorder`, ≤60 s enforced by timer), keeps the blob in
   memory, plays it back on request; re-record replaces it.
2. `fbTranscribe(blob)` → transcript; `fbAssess(blob, transcript)` → per-word
   score. Both are the existing calls to `be-polish`. Offline → the turn cannot
   be sent (the feature needs a network anyway) and the UI says so.
3. `POST /turns` multipart: `audio` (blob), `day`, `transcript`, `score`,
   `duration_ms`. The Worker: verifies token → member consented and not
   suspended → active pair → not blocked → day within the pair week → seq ≤ 3 →
   bytes/duration within limits → **transcript screen** (contact details,
   handles, links) → stores R2 object → inserts row. Returns the turn.
4. The partner's next `GET /me` (boot, tab focus, opening the view, or the
   60-second poll while the thread is open) carries `unread > 0` → card, badge,
   toast.

## Auth

`Authorization: Bearer <Firebase ID token>`. The Worker fetches Google's
securetoken x509 certificates (cached 1 h), verifies RS256 with WebCrypto,
checks `aud == FIREBASE_PROJECT_ID` (`be-mastery`), `iss ==
https://securetoken.google.com/be-mastery`, `exp`, `sub`. The client gets the
token from `FBUser.getIdToken()`.

**Development mode:** with the Worker var `DEV_AUTH="1"` (set only in the
local `wrangler dev` environment, never in production config) the header
`X-Dev-User: <id>` is accepted in place of a token. The client sends it only
when `PARTNER_API` points at `localhost`/`127.0.0.1` and
`localStorage.be_partner_dev_user` is set. This is how the whole flow is
tested with two browser contexts without creating Firebase accounts.

## What changes where

- `index.html`: `PARTNER_API` const; `rPartner` view + CSS; Practice card;
  Home card; `ppApi()` fetch helper; `ppRecord`; i18n keys `pp.*`.
- `backend/partner/`: `partner-worker.js`, `wrangler.toml`, `migrations/`,
  `README.md`, `test/` (integration tests against `wrangler dev`).
- `backend/events/events-worker.js`: four new event names (not deployed).
- `i18n/*.json`: `pp.*` keys.
- `tests/smoke.mjs`: partner checks that run against a local `wrangler dev`.
- `privacy.html`: a section on partner voice sharing.
- `sw.js`: **not** bumped on this branch (bump happens at release).

## What does NOT change

Firestore documents or rules; `be-polish` and `be-push` code; existing views.
