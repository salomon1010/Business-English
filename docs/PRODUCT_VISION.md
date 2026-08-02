# PRODUCT_VISION

> Status: authored 2026-08-02 from the shipped product, `CLAUDE.md`, and the
> Dashboard design pass. This is the top document; where any other document
> conflicts with it, this one wins.

## What BE Mastery is

**An Executive Communication Coach.** A working professional opens it for
25 minutes a day and comes out able to hold a room in English — a standup, a
salary conversation, pushing back on a deadline, a board update.

## What BE Mastery is not

Not a generic English-learning app. Not a vocabulary game. Not an AI toy.

This distinction is not marketing positioning — it is a design constraint that
decides real questions:

| Generic language app | BE Mastery |
|---|---|
| Points, gems, leaderboards, mascots | Evidence of speaking improvement |
| "Lessons completed" | Sessions delivered, phrases owned, pronunciation scored |
| Streak as a slot machine | Streak as a professional's training log |
| Cartoon celebration | Restrained acknowledgement, then back to work |
| Learner | Practitioner |

The user is a competent adult who is already good at their job. Nothing in the
interface may talk down to them.

## The tie-breaker rule

When two solutions are equally good on usability, pick the one that better
serves — in this order:

1. **Executive communication.** Does it make them better in a real meeting?
2. **Daily habit formation.** Does it make tomorrow more likely?
3. **Premium coaching feel.** Would a senior professional pay for this?

Learn from Apple, Linear, Superhuman, Headspace, Apple Fitness, Duolingo.
Copy none of them. Duolingo's streak mechanic is instructive; Duolingo's tone
is not ours.

## The feeling to produce

> "I am becoming a better communicator."

Never:

> "I am using another AI app."

## What the product actually does today

A 12-week programme (84 sessions, 7 days × 12 weeks), delivered offline-first
as a PWA and wrapped as a TWA on Google Play (`com.bemastery.app`).

- **Daily session** — 25-minute timer, record, transcript, notes, self-score
- **Shadowing Studio** — mark a clip, shadow it, get word-by-word feedback
- **Phrase Lab + Executive Polish** — say it casually, get two boardroom rewrites
- **Practice** — spaced repetition over words the user saved from their own speech
- **Progress** — streak, calendar heat-map, year graph, phase completion
- **AI conversation practice** — a colleague who replies in character and scores

Hidden by design: pronunciation practice and role-play exist in code but are
not exposed — browser speech tech was not good enough. Do not re-expose without
being asked.

## Constraints that are not negotiable

- **Owner credit is always Lomonec LLC**, never the owner's personal name, in
  any public-facing surface.
- **Recordings never leave the device.** Cloud sync carries progress JSON only.
- **The OpenAI key lives only in the Cloudflare Worker**, never in the repo.
- **Analytics are anonymous counts with no device ID** — trends are sound,
  absolute user numbers are not. Use Play Console for real install figures.
- **Never invent statistics, quotes or testimonials.** There are no real
  testimonials yet; do not manufacture any.

## How success is measured

In priority order: activation (first session completed) → next-day return →
weekly consistency (the 6-day goal) → 12-week completion → premium perception.

A change that does not plausibly move one of these is decoration, and
decoration is the thing this product does not ship.
