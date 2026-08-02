# RETENTION_STRATEGY

> Status: authored 2026-08-02. Mechanics described here are **built**; where
> something is designed-but-not-deployed it says so.

## The test applied to every change

> Will this increase the likelihood that the user returns tomorrow?

If not, it is decoration. Ship it anyway only if it costs nothing.

## The funnel

```
install → onboarding → FIRST SESSION → next-day return
        → weekly rhythm (6/week) → 12-week completion → certificate
```

The two cliffs are **first session** and **next-day return**. Everything below
is aimed at one of them.

## Principle: encourage, never manipulate

A working professional will not be coerced by a cartoon. Banned outright:

- Loss-framing that guilts ("Don't disappoint your streak!")
- Fake urgency, fake scarcity, countdowns that mean nothing
- Interstitials between the user and the work
- Dark patterns in the rating or sign-in asks
- Manufactured social proof — **there are no real testimonials; invent none**

Allowed and encouraged: state the fact, make the next step obvious, get out of
the way. "6/6 days this week" is a fact. "You're on fire!!!" is not our voice.

## Mechanic 1 — Visible momentum, above the fold

The strongest retention lever on the Dashboard. A returning user sees
`.home-week` — seven day dots plus `N/6 days this week` — **before** the fold,
where 298px of marketing used to sit.

Sourced from `calWeekProgress()`, shared with the Progress Calendar so the two
can never disagree. The weekly goal is **6, not 7**: a rest day is designed in,
so a missed Sunday is not a failure.

## Mechanic 2 — One primary action, unmissable

The day's session moved from y=472 to **y=344**. A user who opens the app and
hesitates has already lost the habit; the CTA is now solid `--accent`, 52px,
and the only accent-filled thing on the screen.

## Mechanic 3 — Streak

`streak()` counts consecutive days in `S.dates`; `markPracticed()` lights a day
and is called by every practice action. Shown as a gold flame pill in the
header — **once**, not twice (the Dashboard strip deliberately omits it).

*(defect)* Shows `0` on day one — a celebratory badge for nothing earned. Hide
below 1. Tracked in `UX_AUDIT.md` cross-screen §4.

## Mechanic 4 — Expiring work

`.home-due` surfaces spaced-repetition words due **now**, from words the user
saved from their own speech. Ranked above evergreen promos because review
expires. Hidden entirely at zero — an always-present "0 words due" is noise.

Also drives the Practice nav badge via `navBadgeCount()`.

## Mechanic 5 — Evidence, not nagging

Nine metrics, earned first, unearned dimmed, **one** next-step line beneath the
panel. Previously six tiles each carried advice, so a committed user met a wall
of instructions. The advice still exists (`home.next_*`) — it is stated once.

Dimming only applies when something is earned; on day one nothing is dimmed,
because a wholly grey panel reads as broken rather than as "not yet".

## Mechanic 6 — Daily reminder

**Built.** `remSchedule` / `remFire` / `remToggle`, Settings toggle + time,
plus Google Calendar / `.ics` export.

**Web Push added but the Worker is NOT deployed** — `backend/push/` (`be-push`,
KV `SUBS`, cron) has no KV id and no VAPID pair, so `/key` fails and
`pushSync()` silently no-ops. The old `setTimeout` path still works. Read
`backend/push/README.md` before touching it.

Two constraints that look like bugs and are not:
- Push carries **no payload**; `sw.js` reads wording from the `be-rem` cache,
  which is deliberately excluded from the activate sweep. Do not "tidy" that
  filter.
- `pushDone()` from `markPracticed()` is not an optimisation — `userVisibleOnly`
  forces every delivered push to raise a notification, so the only way to stay
  quiet for someone who already practised is for the cron not to send.

## Mechanic 7 — Progress made physical

Progress Calendar: month heat-map, year contribution graph, streak / best
streak / consistency. The GitHub-graph effect — a visible record you don't want
to break.

Programme ring: 84 sessions across 3 phases. *(open question)* At 7% the ring
reads as "barely started" for someone doing well. Consider leading with the
phase the user is actually in.

## Mechanic 8 — Celebration, restrained

Celebrate first session, daily completion, weekly completion, milestones,
certificate progress. **Acknowledge, then return to work.** No confetti, no
mascot, no modal that must be dismissed. The tone is a coach saying "good —
same time tomorrow", not a slot machine.

## Mechanic 9 — Rating ask

`rateHTML()` / `rateGo()` / `rateLater()` — a card on Home after **7** sessions.
"Not now" snoozes 30 days (`S.rateSnoozed`). Asked once the product has earned
it, never on first run.

## Mechanic 10 — Never lose progress

Firebase email/password sign-in + Firestore merge, verified live 2026-08-01.
Syncs progress JSON, **not audio**. Google sign-in is deliberately hidden —
`signInWithRedirect` cannot complete across `app.lomonec.com` and
`be-mastery.firebaseapp.com` under partitioned storage.

## What we can and cannot measure

`track(name, props)` → our own Cloudflare Worker (`backend/events/`,
Analytics Engine). Eleven allow-listed events: `app_open`,
`onboarding_complete`, `practice_day`, `session_complete`, `reminder_on`,
`share`, `invite`, `rate_click`, `rate_later`, `play_click`, `install`.

- Adding a `track()` call without adding the name to `EVENTS` silently does
  nothing — the Worker drops it with 204.
- **The events Worker is not deployed yet.** `sendBeacon` reports no errors, so
  until `npx wrangler deploy` runs, every event is quietly lost.
- **No device ID by design** → these are event counts, not people. Trends and
  ratios are sound; absolute user numbers are not. Use Play Console for real
  install and retention figures.
- Never send recordings, transcripts, phrase text, or profile fields.

## Not built

Email capture, testimonials, referral loop, monetisation (freemium via Play
Billing needs a backend and a budget cap). Each needs something the repo cannot
supply on its own.
