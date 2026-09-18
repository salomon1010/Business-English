# Practice Partner — product specification (MVP)

Status: designed and built on `feature/practice-partner`, 2026-09-18. Not merged, not deployed.

## The problem

Under every English-learning video on TikTok, hundreds of comments say the same
thing: "I need someone to practise with." The existing answers (HelloTalk,
Tandem, Speaky, Free4Talk) all offer open, live matching and all fail the same
ways: nobody online at your level and time zone, ghosting, blank conversations,
spam, and harassment — women ask for a female partner because the apps turn
into dating apps. What works, where it exists, is structure: a supplied topic,
a time limit, a host who pairs people (Speaking Club), listen-first rooms
(Talk4Now), a same-gender option (SewaYou).

## The promise

**Practise English with another learner — a partner you never have to schedule.**

Two BE Mastery learners on the same programme and level are paired for a week.
Each day both get the same task the programme already sets. You record a short
spoken turn, hear it back, see the coach's word-by-word score, re-record if you
like, then send. Your partner listens and replies when they can. Nothing is
live; nothing is typed; nobody is browsed.

## Scope of this MVP

In: interest → consent → matching → weekly pair → daily curriculum prompt →
record / listen / re-record → AI speaking feedback → send → partner listens and
replies → in-app notification → duo streak → explicit AI-coach fallback when a
partner is silent → report, block, leave → rate limits and transcript screening.

Out (future phases, documented in RELEASE_PLAN.md): live calls, push
notifications with payload, payments/Premium gating, group rooms, any social
feed, public profiles, free-text chat, photos.

## User stories

1. As a learner I can find Practice Partner on the Practice tab and understand
   in one line that it is practice with another learner, not a chat app.
2. I read what will be shared (first name, level band, language, my voice
   turns and their transcript) and consent before anything is shared.
3. I tap "Get a partner". If someone compatible is waiting I am paired at once;
   otherwise I wait and see how many people in my band are waiting (a count,
   never a list). I can withdraw.
4. I see my partner's first name, band and interface language — nothing else.
5. Every day of the pair I get the day's prompt from my programme.
6. I record up to 60 seconds, play it back, re-record, see the coach's
   per-word score and transcript, then send. Three turns a day.
7. My partner's turns appear in the thread with their transcript and I can play
   them. When my partner replies I see a card on Home and a badge on Practice.
8. If my partner has not replied for 24 hours I am told so, plainly, and offered
   the AI coach with the same prompt. AI turns are never shown as my partner's.
   After 48 hours of silence I may leave and be re-paired.
9. Both of us sending on the same day extends our duo streak.
10. I can report or block my partner at any time; blocking ends the pair and we
    are never paired again.

## Entry points

- Practice tab: a `.rp-entry` card "Practice Partner — Practise English with
  another learner", first in the "Life Simulations" group.
- Home: a card only when there is something to do (partner replied, waiting
  matched, prompt unanswered today). No card otherwise.
- Route `#partner`; the Practice tab stays lit in the bottom bar.

## Eligibility

Signed in with the free account (identity is required to pair two people), and
past the placement check (the band is unknown before it).

## Matching signals (in priority order)

track (general-english | welding) → band (fnd-1-7, fnd-8-15, w1-4, w5-8,
w9-12) → interface language → same-gender preference (honoured strictly when
set by either side; gender is optional and only used for this) → oldest waiter
first. Both sides must have consented, must not be suspended, must not be in an
active pair, and must not have blocked each other.

## Not in the product, by design

No text messages. No photos or avatars. No browsing or searching people. No
contact details in transcripts (screened server-side). No "likes". No
visibility of who else is waiting beyond a count.
