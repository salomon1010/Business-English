# Practice Partner — safety

Human-to-human voice is the most sensitive thing BE Mastery has ever carried.
Every control below is implemented and tested on this branch unless marked
*(documented, not automated)*.

## Consent
- A consent sheet opens before anything is shared. It states exactly what the
  partner sees (first name, level band, interface language, each voice turn
  and its transcript), that audio is kept at most 14 days after a pair ends,
  that turns are screened, and how to report/block. Stored as
  `members.consent_at`; the Worker refuses `/interest` and `/turns` without it.
- Age: the sheet states 16+. *(Declared, not verified — same as the rest of
  the app.)*

## Minimal exposure
- Only `name` (first name, ≤24 chars), `band`, `lang` of the partner are
  returned by the API. No uid of the partner, no email, no photo, no country.
- No list of people, ever: while waiting the API returns a count only.

## No side channels
- No text input exists in the feature. The only text is the transcript the
  coach produced from the recording.
- Transcripts are screened server-side before a turn is stored: phone-number
  patterns (7+ digits with separators), e-mail, URLs, `@handles`, and the words
  whatsapp / telegram / instagram / snapchat / facebook / tiktok / discord /
  signal / imo / viber. A hit rejects the turn with `moderation`, the audio is
  not stored, and the client explains why. (Speech-to-text is imperfect; this
  catches the obvious cases and raises the cost of the rest. It is *screening*,
  not a guarantee — SAFETY copy says "screened", never "moderated by humans".)
- Audio is never publicly addressable: R2 objects are served only via
  `GET /turns/:id/audio` after membership and block checks.

## Report, block, leave
- **Report** (reasons: harassment, contact details, not English, abusive,
  other): one counted report per reporter per person. Two distinct reporters →
  `suspended_until = now + 30 days`: cannot pair, cannot send, active pair is
  closed with reason `suspended`. Reports are rate-limited (5/day) so they
  cannot be used as a weapon; a report never reveals itself to the reported
  person.
- **Block**: closes the pair, inserts a `blocks` row; matching excludes both
  directions forever; the blocked person receives 403 on the pair and its
  audio from that moment. Blocking is silent (the other side sees "This pair
  has ended").
- **Leave**: closes the pair with `left`, allowed any time; the leaver may
  re-queue at once, the other side is told the pair ended and may re-queue.

## Abuse prevention and rate limits (Worker, per uid per UTC day)
- `/interest`: 10 joins/day. `/turns`: 3 per pair-day; audio ≤ 1.5 MB and
  ≤ 75 s. `/report`: 5/day. `/block`: 20/day. All routes: 120 requests/min per
  IP in-memory (same pattern as `be-polish`).
- Duplicate submissions: the client disables Send while a request is in
  flight and sends a client-generated `turn_id`; the Worker treats a repeated
  id as the same turn (idempotent insert).

## Same-gender option
- Optional `gender` (`f`/`m`/`x`) and `same_gender` flag, collected on the
  consent sheet with a plain explanation. Used **only** by matching. Never
  displayed to the partner.

## Retention
- Turn audio and transcripts of a closed pair are deleted by the daily cron
  14 days after closure. Active pairs expire after 7 days (then the same
  clock starts). `reports` and `blocks` are kept (they protect people).

## Privacy copy
- `privacy.html` gains a "Practice Partner" section (on this branch) saying
  what is shared, with whom, for how long, and how to report.

## What is explicitly NOT built
- No human moderation queue *(documented; reports are visible only in D1)*.
- No automatic audio content analysis (only the transcript is screened).
- No under-16 verification.
