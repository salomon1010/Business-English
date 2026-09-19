# Practice Partner — product specification

Status: built on `feature/practice-partner` (phase 2, 2026-09-18). **Not
merged, not deployed, every production flag off.** This document describes
what the code on the branch does, not what was planned.

## The problem

Under every English-learning video on TikTok, hundreds of comments say the same
thing: "I need someone to practise with." The existing answers (HelloTalk,
Tandem, Speaky, Free4Talk) all offer open, live matching and all fail the same
ways: nobody online at your level and time zone, ghosting, blank conversations,
spam, and harassment — women ask for a female partner because the apps turn
into dating apps. What works, where it exists, is structure: a supplied topic,
a time limit, a host who pairs people, a same-gender option.

## The promise

**BE Mastery teaches you what to say. Shadow Studio helps you say it. Practice
Partner finds you someone to say it to.**

Two learners on the same General English lesson try one short practice
together: four voice turns, two each, on a task the programme already sets.
You record, hear yourself, see the coach's score, re-record if you like, then
send. Your partner replies when they can. After the fourth turn each of you
decides alone whether to practise together again. Nothing is live, nothing is
typed, nobody is browsed.

## Scope — General English only

Practice Partner is part of the **General English** programme
(`"general-english"`). It is gated at every layer:

| Layer | Gate |
|---|---|
| UI | `ppAvailable()` = `PARTNER_API` set **and** `flag("practice_partner_enabled")` **and** `isGeneralEnglish()`. Welding shows no Practice card, no Home card, no badge. |
| Route | `#partner` on Welding renders a one-card notice ("Practice Partner is part of General English") with a switch button; nothing is fetched. |
| Worker | `TRACKS = new Set(["general-english"])`; `POST /interest` with any other track → `403 track` before anything is written. |
| Data | `interest.track` and `pairs.track` are written from the validated value; candidates are only ever read from `interest`, so cross-track pairing is impossible. |
| Analytics | `partner_*` events fire only from code paths behind `ppAvailable()`. |

Welding keeps exactly the app it has today.

## What is in

Consent (18+) → minimal matching profile (goals, mode, availability) →
**Match me** (up to 3 candidates, each with a plain reason) or **Practise
now** (first compatible learner taken at once) → try-before-connect: a
4-round asynchronous voice session on the curriculum task → coach score on
every turn → each decides alone: **practise together again** or **find
someone else** → mutual connection (regular after two sessions) → next
session started directly from the connection card → rematch cooldown →
reliability signals (internal) → AI coach fallback, always labelled AI →
in-app notifications with de-duplication → report / block / leave → rate
limits → audit log → feature flags, default off in production → analytics
funnel.

## What is out (not on this branch)

Live calls; push notifications with payload; payments / Premium; group rooms;
any social feed; public profiles; free-text chat; photos; human moderation
queue; matching by gender beyond the existing optional same-gender flag.

## User stories (as built)

1. On General English, I find Practice Partner on the Practice tab and
   understand in one line that it is practice with another learner.
2. Before anything is shared I read the consent sheet: what a partner sees
   (first name, level band, interface language), that each sent turn and
   its transcript go to our server and to that one partner, 14-day
   retention, screening, report/block, the AI fallback — and I confirm I am
   18 or over. Without the 18+ box the Worker refuses consent.
3. I pick up to three goals (casual, workplace, interview, pronunciation,
   daily life, fluency), a mode (voice messages / voice plus live when
   available) and when I am usually free (morning, afternoon, evening,
   weekends). This is the whole profile.
4. **Match me** shows me up to three first names, each with one or two plain
   reasons ("same level", "same lesson", "same goal: interview", "available
   now", "you have practised together before"). No scores, no photos, no
   list to scroll. **Try a practice** starts a session with that person.
5. **Practise now** pairs me with the first compatible learner without
   showing cards. If nobody fits I am kept in the queue and offered the AI
   coach — labelled AI, never presented as a person.
6. A session is four turns, alternating. I see "Turn n of 4 — your turn" or
   "waiting for {name}". My prompt for turn 1 is the lesson task; turns 2–4
   are reply prompts ("Respond to what your partner said about … then ask
   one follow-up question"). If I arrived from Shadow Studio's Apply It, the
   turn-1 and turn-2 prompts carry my phrase and my partner gets the same.
7. I record up to 60 seconds, play it back, re-record, see the transcript
   and the coach's per-word score, then send. Sending out of turn is refused
   (`not_your_turn`).
8. When the fourth turn lands the session is complete. Each of us sees
   "Practise together again" / "Find someone else" and a one-line AI tip
   (tagged AI) from our last score. Neither answer is shown to the other.
9. Both "again" → we are practice partners (mutual; regular after the second
   session). Either "someone else" → the session closes, a 14-day cooldown
   stops us being offered to each other, nobody has to explain.
10. A connection card on the Partner page and Home lets me start today's
    session with my partner directly (`POST /next`), unless they are already
    in another session.
11. If my partner is silent for 24 h I am told plainly, offered the AI coach
    (labelled), and may choose "find someone else" before the session ends.
12. When a turn arrives I see a Home card, a badge on Practice and a toast /
    notification — once per turn, never twice.
13. I can report or block at any time. Two distinct reporters suspend an
    account for 30 days; a block is permanent both ways and silent.

## Entry points

- Practice tab (General English only): the Practice Partner `.rp-entry` card.
- Home (General English only): `ppHomeCardHTML()` — only when there is
  something to do (your turn, a session to decide, a partner waiting).
- Shadow Studio V2 → Apply It → "Use with a partner" (when both flags are on).
- Route `#partner`; the Practice tab stays lit.

## Eligibility

Signed in with the free account, past the placement check (the band is
unknown before it), on General English, 18 or over (declared).

## Matching (deterministic, weights configurable)

`score(me, member, candidate, W, history)` in `partner-worker.js`. Signals:
level band (same 1 / adjacent 0.5), shared goal, curriculum position (same
week 1 / ±1 week 0.6), mode compatibility, shared availability, time-zone
distance, topic, reliability (completed vs abandoned sessions; 0.6 when
unknown), history (practised before). Weights `WEIGHTS_DEFAULT` are overridden
by the Worker var `MATCH_WEIGHTS` (JSON). Candidates below `MIN_MATCH_SCORE`
(0.35) are not offered. Hard filters first: same track, consented (which requires 18+), band within
one step, not suspended, not opted out, not in an active pair, not blocked
either way, not in cooldown, not previously disconnected, same-gender
honoured when either side set it. A candidate already offered to others in
the last 24 h loses up to 0.15 so nobody is shown to everyone. The learner
sees reasons, never the score.

## Not in the product, by design

No text messages. No photos or avatars. No browsing or searching people. No
contact details in transcripts (screened server-side). No "likes". No
visibility of who else is waiting beyond the candidates offered to you.
