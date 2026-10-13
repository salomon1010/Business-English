# App Store Connect — BE Mastery Welding, version 1.0.0 (paste by hand)

Written 12 October 2026, for the **second** App Store app created by the two-app
split (`docs/APP_SPLIT.md`). Nothing here is uploaded by code.

This app has **never been submitted** and has **no App Store Connect record
yet** — that is the one blocker for this listing.

Its three Apple identifiers ARE registered, which an earlier version of this
note denied. Verified read-only against the App Store Connect API on 13 October
2026: `com.lomonec.bemastery.welding`, `.welding.BEWidget` and
`.welding.BEPushService` all exist, the app id carries App Groups, Push
Notifications, Sign in with Apple and In-App Purchase, and all four App Store
provisioning profiles are ACTIVE to 2027-09-29. A Distribution-signed IPA has
been built and verified from them. So the build is **not** blocked; only the
store record is. The remaining Apple steps are
`docs/APP_SPLIT_SUBMISSION.md` § A5–A8.

The copy below is the Google Play Welding listing
(`playstore/welding/listing-*.txt`), re-cut to Apple's fields and limits. Keep
the two in step: they describe one product.

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

```
You already know the work. This is where you learn to say it.

English for welders, pipefitters, boilermakers and the eight other refinery
trades — built around the words you actually use on the floor, in the toolbox
talk and in the interview. Speaking practice, not a trade qualification.

START WHERE YOU ARE
A one-minute check places you. Not ready for full-speed English yet?
Foundations gives you three sentences a day with your own language underneath —
hear it, say it, record it — for fifteen days. Then the full programme opens.

THE TRADE YOU ALREADY KNOW
Pick your profession and the whole app changes with you: the scenarios, the
vocabulary, the model answers and the codes. Ten refinery trades, each with its
own twelve-week road map.

SHADOW REAL WORKSHOP ENGLISH
Watch a real trade video, then say the line back. The app listens, scores the
words you hit and the ones you missed, and gives you the one sound to fix next.

REHEARSE THE CONVERSATIONS THAT COUNT
The workshop simulation puts you in a real exchange — a supervisor, a safety
briefing, a handover — and scores how clearly you got the point across.

YOUR WORDS, KEPT
Every phrase you practise goes to a phrase bank you own, with spaced repetition
so the ones you nearly know come back until you do.

OFFLINE FIRST
The curriculum, your recordings and your progress live on your phone. Sign in
only if you want your progress on a second device.

Lomonec LLC
```

## Keywords (100)

```
welding,welder,pipefitter,trade english,technical english,esl,speaking,toolbox
talk,refinery,boilermaker
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
