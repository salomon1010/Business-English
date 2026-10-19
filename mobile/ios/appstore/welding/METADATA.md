# App Store Connect — BE Mastery Welding, version 1.0.0 (paste by hand)

Written 12 October 2026 for the **second** App Store app created by the two-app
split (`docs/APP_SPLIT.md`); the copy below was re-cut from the Google Play
Welding listing on 14 October so the two describe the same product.

**State on 14 October 2026.** The App Store Connect record now EXISTS — app id
`6822527532`, version 1.0 in PREPARE_FOR_SUBMISSION — and the first build has
been UPLOADED (`1.0.0 (1)`, delivery 2813b466-29f6-4564-8a71-b144126ab3ff,
`altool --validate-app` clean beforehand). An earlier version of this note said
no record existed and called that the one blocker; both statements are now
history. What is still empty is the listing itself: description, keywords,
subtitle, support URL, privacy policy URL and screenshots are all unset in App
Store Connect, which is what this file is for.

Its three Apple identifiers are registered: `com.lomonec.bemastery.welding`,
`.welding.BEWidget` and `.welding.BEPushService`, each with an ACTIVE Store
provisioning profile expiring 2027-09-29. Those profiles are Xcode-managed and
do not appear in the portal's own profiles listing, so there is no point
looking for them there.

The Google Play release of the same build went to review on 14 October
(versionCode 4). Keep the two listings in step.

---

## App information

**Name** (30) `BE Mastery Welding`
**Subtitle** (30) `Trade English, spoken`
**Bundle ID** `com.lomonec.bemastery.welding` · **SKU** `bemastery-welding-ios`
**Version** 1.0.0 (1) — set in `mobile/ios/ios/App/Welding.xcconfig`, not in the
project; raise `CURRENT_PROJECT_VERSION` there for each upload.
**Primary category** Education · **Secondary** Business
**Privacy policy URL** https://app.lomonec.com/privacy.html
**Support URL** https://app.lomonec.com/flyer.html — REQUIRES OWNER CHECK that
contact@lomonec.com is visible on that page.
**Copyright** © 2026 Lomonec LLC

**Content rights.** The lessons, audio and drawings are Lomonec LLC's. The
Welding Shadowing Studio **plays YouTube videos through YouTube's own embedded
player** (streamed, never copied into the app) from
`catalogue/welding.json`. REQUIRES OWNER REVIEW when answering App Store
Connect's third-party-content question — the answer is not "no". The same
answer as the General English app; see `../THIRD_PARTY_CONTENT.md`.

**Account deletion** in the app (Profile → Backup & sync → Delete account) and
at https://app.lomonec.com/delete-account.html. Say so in the review notes
(Apple 5.1.1(v)).

---

## Promotional text (170)

```
Ten refinery trades, one app. Shadow real workshop video, rehearse the toolbox
talk, and walk into the interview able to say what you already know how to do.
```

## Description

The Google Play full description, re-cut for Apple: the section emoji are
dropped (they read as noise beside Apple's typography) and nothing is claimed
that the Play copy does not also claim. 3,563 characters of the 4,000 allowed.

```
You already know the work. This is where you learn to say it.

English for welders, pipefitters, boilermakers and the eight other refinery trades — built around the words you actually use on the floor, in the toolbox talk and in the interview. Speaking practice, not a trade qualification.

START WHERE YOU ARE
A one-minute check places you. Not ready for full-speed English yet? Foundations: three sentences a day with your own language underneath — hear it, say it, record it — for fifteen days. Then the full programme opens.

THE TRADE YOU ALREADY KNOW
Pick your profession and the whole app changes with you: the scenarios, the vocabulary, the model answers and the codes. Ten refinery professions, from welder and pipefitter to QA/QC and HSE officer.

SHADOWING STUDIO — REAL TRADE VIDEO
Over five hundred hand-checked clips from the trade, each with a synchronised transcript. Watch it, shadow one paragraph at a time, then take the Challenge: speak the line from memory and get it scored word by word. Speed control, looping and a translation under every line in your language.

INSTANT SPEAKING FEEDBACK
Record yourself and get a word-by-word pronunciation score, grammar corrections ("I am agree" → "I agree"), your pace against the native 140–160 wpm zone and a filler-word count. Every missed word comes with example audio and a say-it-again drill.

THE WORKPLACE LINES
The sentences the job actually needs — the pre-job brief, the hot-work permit, the hand-over, the near-miss report. Play them, shadow them, record them, use them tomorrow.

SIT THE INTERVIEW BEFORE IT COUNTS
Interview coaches, each on one part of your professional story. Workplace simulations with the whole crew — HR, your supervisor, the tool room, materials and QA — in one conversation, the way a real first day goes. You answer out loud, as often as you like.

A REPORT THAT NAMES THE GAP
You see what you said, which points a competent answer needed, which you covered, which you missed — and the sentence you could have said. Tap once and the person who asked reads it back.

WELDING MASTERY
250 trade terms, 52 original drawings and eight games — Word Quest, Quick Quiz, Sentence Builder, Listen & Win, Speak Up, Phrase Match, Word Puzzle and Real-Life Missions. A word counts as mastered when you have got it right on three different days and recalled it unprompted, not when you have seen it often enough.

25 MINUTES A DAY
One prepared session a day, minute by minute, from Stage 0 to the final review. Open the app and press start. A road map shows every stage, the one you are on and the one that is next.

SEE YOUR VOICE CHANGE
Your new take's waveform sits over your previous one: watch the pauses shrink and the pacing tighten. A calendar that fills in, a streak worth keeping, and a progress page that reports only on this programme.

YOUR LANGUAGE UNDERNEATH
Fifteen languages: French, Spanish, Portuguese, Italian, German, Russian, Arabic, Urdu, Hindi, Bengali, Indonesian, Vietnamese, Chinese, Japanese and Korean.

WORKS WHERE YOU WORK
Offline-first. The lessons, the recorder, the transcripts and the games run with no connection. Sign in to keep your progress across devices — or don't, and it stays on this phone.

PREMIUM
Free gives you the whole loop: the curriculum, the studio, the Challenge, your recordings, the games and the feedback your phone can compute. Premium adds the AI speaking reports in full, the per-word pronunciation score, 30- and 90-day analytics, the AI coach and the personalised recommendations.

Lomonec LLC · contact@lomonec.com
```

## Keywords (100)

Must be pasted as ONE line — a newline inside this block would join two
keywords ("toolbox talk" became "toolboxtalk" when it was wrapped here).
"welding" is deliberately absent: it is in the app name, which Apple already
indexes, so repeating it would waste 8 of the 100 characters.

```
welder,pipefitter,boilermaker,trade english,technical english,esl,speaking,toolbox talk,refinery
```

## Age rating

Answer the questionnaire honestly. Expect the same outcome as the General
English app (`../METADATA.md` § Age rating) — the content is occupational
English; there is no user-generated content, no chat with strangers, and
**Practice Partner is General English only and absent from this app**.

## What's new in this version

```
First release.
```

---

## Subscriptions

**Its own subscription group** — a group belongs to one app, which is the point
of the split. Reference name `BE Mastery Welding Premium`.

| product id | reference name | duration | price | level |
|---|---|---|---|---|
| `premium_annual` | Premium annual | 1 year | US$19.99 | 1 |
| `premium_monthly` | Premium monthly | 1 month | US$2.99 | 1 |

Reusing the ids is correct: App Store product ids are scoped to the app, so
these are new, separate products. A 3-day free introductory offer on each, new
subscribers, all territories. Figures and the trial match the General English
app and `docs/TIERS.md`.

**A purchase here does not unlock General English, by design** — the server
files each purchase against the app that sold it
(`backend/entitlements/src/entitlement-core.js`, `programmeOfStoreId`), and
`backend/entitlements/test/billing.mjs` § "Two apps, separate entitlements"
holds the rule. Selling Welding Premium additionally requires the backend step
in `docs/APP_SPLIT_SUBMISSION.md` § C — extending `APP_PROGRAMMES` and applying
migration 0005 — or the purchase is refused with `app_unmapped`.

## Screenshots

`screenshots/iphone-6.9/` — six, 1320×2868, the only size App Store Connect
requires today. Generated from the real app with the Welding build marker, so
every frame is this app and not General English:

```
cd mobile/ios && python3 -m http.server 8765        # serve the repo root
PROGRAMME=welding OUT_ROOT=welding-appstore \
  node scripts/store-art/shoot.js iphone
# then move playstore/welding-appstore/iphone-6.9/*.png here
```

01 road map · 02 the five practice tools · 03 workshop simulation ·
04 workplace lines · 05 progress · 06 phrase bank.

**Welding Mastery is deliberately absent**, for the reason given in
`scripts/store-art/shoot.js`: its headline numbers are account-bound, so
without a signed-in fixture the hub renders "Sign in to play" over 0 XP.

## Review notes

Reuse `../REVIEW_NOTES.md` and change: the programme is Welding, there is no
Practice Partner and no Life Simulations, and the demo account should be placed
in the Welding programme. State that the Shadowing Studio streams YouTube
through the embedded player.
