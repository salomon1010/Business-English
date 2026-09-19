# Practice Partner + Shadow Studio V2 — test plan (as built, 2026-09-18)

Four automated layers plus a manual real-device checklist. Everything
automated runs locally with zero production access.

## 1. Pure engine — `tests/shadow-sync.test.mjs` (27 checks)
`node shadow-sync.test.mjs` from `tests/`. No browser, no server.
`normalizeCaptions` (word level, sentence level, per-segment fallback, clip
marks), `normalizeText` (pasted transcript → untimed sentences), `locate`
(binary search, boundaries, grace window, stateless seek backwards),
`neighbour`, plus two real bundled caption files (`captions/*.json`): the
Stanford talk (cues only → sentence level) and a YouTube json3 file (word
level, every segment has words). Malformed input: unsorted / NaN / string /
empty cues, NaN words, words outside every cue, cues that are not an array,
rapid seeks across all of it.

## 2. Worker integration — `backend/partner/test/run.mjs` (106 checks)
Expects `npx wrangler dev --env dev --port 8787` in `backend/partner/` (local
D1 + R2 emulation, `DEV_AUTH=1`, `PARTNER_ENABLED=1`, `IP_PER_MIN=100000` from
`[env.dev]`). Dev users via `X-Dev-User`, movable clock via `X-Dev-Now`,
`POST /__reset` between runs, `POST /__cron` for maintenance.

| Area | Cases |
|---|---|
| Auth / consent | 401 without token · `/interest` before consent → 403 `consent` · consent without 18+ → 403 `age` · consent with 18+ and preferences · broken JSON body → 4xx, never a 500 with internals |
| **Track boundary** | `welding` → 403 `track` · unknown track → 403 `track` |
| Queue / candidates | first in queue → waiting, no candidates · second learner sees the first as a candidate with reasons and **no uid** · `/match` re-mints offers · `/match` while not waiting → 409 · band two steps away excluded |
| Scoring | `score()` unit: perfect match high with reasons, weak match low |
| Offers / pairing | an offer cannot be used by someone else (404) · invite → trial pair, round 1 of 4, connection `trial` · consumed offer → 404 · **race** for one candidate: exactly one wins |
| Turns | round 1 → 201 · twice in a row → 409 `not_your_turn` · partner sees round 2, unread 1 · audio: non-member 403, no auth 401, member 200 · contact details → 422 `moderation` · four turns → complete; fifth → 409 `complete` |
| Decide / connections | neither decided · one continues, pair stays open · non-member 403 · both continue → closed `completed`, mutual (1 session) · `/next` starts a regular session · `/next` while active → 409 · second completed session → `regular` · continue before complete → 409 `not_complete` · rematch closes for both, reason `rematch`, nothing exposed · **cooldown**: not offered again |
| Silence / fallback | 25 h silent → `fallback`, `canRepair` · rematch after timeout allowed |
| Reliability | expired pairs: only the side whose turn it was **and** who had a full `PARTNER_TIMEOUT_H` to reply is marked abandoned; one turn each then silence (a tie — either could have spoken) blames nobody |
| Safety | two distinct reporters → suspended 30 d, pair closed, cannot rejoin · block → pair closed, blocked side 403 on pair and audio |
| Health | `/health` reports `dev` and `enabled` |
| **Partner management (7)** | opaque `cid`, no uid · leave keeps the partnership · someone else's cid 404, malformed 400, no auth 401 · end with an open session → connection ended for both, session closed `left`, no block, cooldown · ending twice harmless · ended partner not offered again · not a block: partner still reads normally, report via the connection recorded |
| **AI cap (4)** | wrong track 403 before counting · new 201 / repeat 200 no count · 13th in a day 429, repeat still 200 · malformed 400, no auth 401 |
| **Live (18)** | needs a connection (404) · invite → `invited`, opaque id, first name only · idempotent invite · guest sees it in `/me` · non-member 403 on read/accept/signal, no auth 401 · host cannot accept, signalling before acceptance 409 · accept → `accepted` + ICE, twice harmless · offer → `connecting`, guest receives only the host's signals · answer + ice reach the host, `?after=` cursor, no echo · first `connected` → `active` + `startedAt` · reconnecting ⇄ active · bad kinds / oversized payloads 400 · end → `ended/completed`, twice harmless, signalling after 409 · host cancel / guest decline · unanswered invitation expires at 10 min · block during a call ends it for both, 403 afterwards, no live in `/me` · no new session against a blocked partner |
| ID token | generated RSA pair: accepts valid; rejects aud / iss / exp / kid / signature; JWKS fetched once and cached; unknown kid → one rate-limited refetch finds a rotated key; malformed, HS256 and non-RSA keys rejected before any fetch |

## 3. Browser end-to-end — `tests/partner.mjs` (122 checks)
Playwright, headless Chromium, 390×844, fake microphone
(`--use-fake-device-for-media-stream`). Starts its own static server and
expects the local Worker on 8787 (skips with a notice otherwise). Three
browser contexts: Alice and Carla (General English), Bob (a second General
English learner and, separately, a **Welding** learner) with flags on via
`localStorage.be_flags`.

- **Boundary**: GE Practice tab shows the card · Welding: no card, `#partner`
  shows the GE-only notice with no fetch and no consent, the Worker refuses
  the track when called directly, Home shows no card, **Shadow Studio V2
  panel hidden and no asset built with every flag on**.
- **Consent / profile**: first visit asks · sheet lists what is shared, server
  upload, 18+, goals, availability · goal pre-selected from the learner
  profile · **the sheet scrolls inside at 375×812 and the Agree button is
  reachable** (found in the phase-5 viewport audit: `.lang-modal` clips at
  88vh) · without 18+ nothing is sent · agreeing registers preferences and
  shows Match me / Practise now.
- **Matching**: no candidates → honest message, AI coach offered (labelled),
  stays in line · waiting card shows the AI fallback labelled AI · Match me →
  1–3 cards with first name, band, goal, plain reason, no score, no uid · Try
  a practice → trial session, round 1 of 4, your turn · round-1 task equals
  the curriculum speaking task · the unchosen learner is still waiting.
- **Recording**: live timer · stop → take with player · re-record replaces ·
  Send enabled after the coach, score labelled AI · send stores one turn
  (double tap ignored), status → waiting, day marked practised · speaking
  twice refused by the Worker · audio 403 / 401.
- **AI coach session (8, Polish Worker intercepted)**: opens on the partner page labelled AI/not a person · round-1 task equals the learner's curriculum task · starting again returns the same session · one AI reply per learner turn, double tap sends nothing twice · human thread untouched · AI failure keeps the take as a pending turn with Retry · retry sends it once and the fourth turn completes with an AI-tagged tip · Back returns to the waiting card.
- **Live practice (12, two browser contexts, real WebRTC, fake microphones)**: connection card offers Practise live · host waiting room labelled human with Cancel · guest Home card · guest invitation card (Join / Not now) · both sides reach "Connected — you can talk" (local track + remote audio attached, `connectionState` connected) · server active with `startedAt` · shared round counter · mute toggles the track · phrase help = three AI-tagged phrases, text only · host leaves → both released and told, server ended/left · connection card back.
- **Partner management (8)**: session menu says Leave today's practice / Report / Block · leave confirmation says the partnership stays · leaving keeps the connection card with kind, Start, Practise live and the options gear · a connected learner reaches the waiting state and the AI COACH — NOT YOUR PARTNER card without ending the partnership · Partner options = Find someone else / End partnership / Report / Block, no photo · End partnership asks for confirmation and says it is not a block or report · after ending: no card, Match me, other side not suspended, no reason exposed · a foreign cid → `no_connection`.
- **Role-play naming (2)**: the Best-tool shortcut and the Life Simulations card carry the same name and open `roleplay`; on Welding both keep `simulation`.
- **Rounds / notifications**: reply accepted (round 2) · reply → Home card,
  Practice badge, **one** toast · same reply does not toast twice · round-3
  prompt · fourth turn completes.
- **Decide / connections**: decision card with one AI-labelled tip and two
  choices · recorder gone · choice recorded, nothing shown to the partner ·
  both continue → mutual card with session count and Start · Start → regular
  session · Find someone else → closed, neutral toast, other side only sees
  "ended" · cooldown honoured.
- **Shadow Studio V2**: library clip → word-level asset, four modes,
  sentences rendered · playback lights the current sentence and word ·
  Challenge hides text until revealed · Apply It shows the expression with AI
  and Partner options · Use with a partner → Practice Partner with the phrase
  queued · Practise now pairs at once and round 1 uses the phrase.
- **Resilience**: Worker unreachable → offline card with retry, no crash ·
  reconnect restores · **flags off → nothing visible (production default)** ·
  signed out → sign-in card, no data · no uncaught JS errors in any browser.

## 4. Existing suite — `tests/smoke.mjs` (27 checks)
Unchanged; must stay green with the flags off (the default). `cd tests &&
npm test` runs smoke → shadow-sync → partner.

## 5. Static checks
- JS parse check of every inline script (CLAUDE.md one-liner) and
  `node --check` on `shadow-sync.js` and the Worker.
- i18n key parity: `I18N_EN` (1,750 keys) vs the 15 files; `{{placeholders}}`
  of the new keys checked against English.
- `npx wrangler deploy --dry-run --env dev` (builds, uploads nothing).

## Results (2026-09-19, live availability UX + no-gate matching, branch `feature/practice-partner`)

| Suite | Result |
|---|---|
| `tests/shadow-sync.test.mjs` | **27/27** |
| `backend/partner/test/run.mjs` (local Worker, D1/R2 emulated) | **106/106** — adds DELETE /me (audio object gone, partner's session closed, 404 on the erased turn, idempotent, 401 unauth) — adds presence counts, stale-queue exclusion and cron purge, no-gate offers (two bands away still offered, ranked after), live inside a trial, live proposals (`live:true` → room opens on accept), blocked never counted |
| `tests/partner.mjs` (browser contexts, fake microphones, real WebRTC) | **122/122** — adds ppEraseMe() with flags off — adds presence strip (GE / Welding), waiting-card copy and green state, auto-discovery once per rise, newcomer toast dedup, `#ppFab` visible/hidden rules + 375×812 no-overlap + one-tap discovery, live-first connection card with `.pp-attn`, candidate card live/recorded buttons, Practise live from a card → host walks into the room on accept, More options live inside a trial, partner-left dialog Close / Find another partner clearing the screen, How-it-works sheet |
| `tests/smoke.mjs` (existing app suite, flags off) | **27/27** |
| JS parse check | 0 errors |
| i18n parity | 1,870 keys in EN and in each of 15 files; no missing, no orphans |
| Direct-access audit (script, local Worker) | unauth 401 · garbage Bearer 401 · member 200 · non-member 403 · member of another pair 403 · blocked side 403 · unknown turn 404 · R2 key as URL 404 · `/members` 404 · non-member turn inject 409 `no_pair` · non-member decide 403 · > 1.5 MB 413 · > 75 s 400 · Welding `/interest` 403 `track` · partner object exposes `name, band, lang` only |
| Server kill switch (second local Worker, `PARTNER_ENABLED=0`) | `/health` `enabled:false`; `/me` and audio 503 `disabled`; client renders the "temporarily unavailable" card |

**Not tested, and not claimed:** a real microphone on a physical phone;
iOS Safari MediaRecorder behaviour; the Firebase ID-token path against
Google's live JWKS (the verifier is unit-tested with a generated RSA key pair
and rejects wrong aud / iss / exp / kid / signature); any production
Cloudflare resource. See the manual checklist below.

## Viewport audit (phase 5, headless Chromium)
375×812, 390×844, 412×915 × en / fr / ar (RTL): consent sheet, partner page,
Shadow V2 panel, Apply tab — `scrollWidth === clientWidth` everywhere, no
element past the right edge, no page errors. Two defects found and fixed:
the sticky back button rendered underneath the sticky eyebrow, and the
consent sheet was clipped (Agree unreachable on a phone).

## Manual QA checklist (real devices, before any production flag is turned on)
**The owner-facing, per-device version is `DEVICE_CHECKLIST.md` (37 rows ×
iPhone Safari / Android Chrome, with staging set-up in PILOT.md).** The short
form below is kept for reference.

Run against the `staging` Worker environment (`wrangler deploy --env staging`,
`PARTNER_ENABLED="1"`, real Firebase tokens) with the branch served over HTTPS
and `be_flags` set — exact set-up in PILOT.md § Staging. Tick each on **iPhone Safari** and
**Android Chrome**; note OS and browser versions.

| # | Check | iOS | Android |
|---|---|---|---|
| 1 | Microphone permission prompt appears once; denial shows the app's own explanation, not a blank | | |
| 2 | `MediaRecorder` produces audio (iOS: `audio/mp4`; Android: `audio/webm`) and the Worker accepts both | | |
| 3 | Live timer runs; stop at 60 s is enforced | | |
| 4 | Playback of your own take works with the phone on silent / ringer switch | | |
| 5 | Re-record replaces the take; Send stays disabled until the coach returns | | |
| 6 | Upload on a slow network (throttle to 3G): progress state, no double send, clear error on failure | | |
| 7 | Partner's turn plays back; scrubbing works; transcript matches | | |
| 8 | Shadow V2: word highlight keeps time with the YouTube player after a seek and after speed 0.75 | | |
| 9 | Shadow V2: auto-scroll stops while the learner scrolls and resumes 3 s later | | |
| 10 | Background → foreground: the thread refreshes; a turn that arrived meanwhile raises exactly one toast | | |
| 11 | Lock the phone during a recording: recording stops cleanly, no orphan take | | |
| 12 | Audio failure (permission revoked mid-session): clear error, Send disabled, no crash | | |
| 13 | Notification (when `practice_partner_notifications_enabled`): shown once, tapping opens `#partner` | | |
| 14 | Welding learner on the same device: no Practice card, no Home card, `#partner` shows the GE-only notice | | |
| 15 | Installed PWA / TWA relaunch lands back on `#partner` | | |
| 16 | Dark theme: every new card readable; RTL (Arabic, Urdu) layouts do not overflow | | |
