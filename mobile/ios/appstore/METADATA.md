# App Store Connect — listing, version 1.1.0 (paste by hand; nothing here is uploaded by code)

Release decisions this listing reflects (owner, 30 Sep 2026, prices and plans
revised 5 Oct 2026): **Premium IS active** — one subscription offered as two
auto-renewable plans (annual and monthly), the same capabilities on both tracks
(see `SUBSCRIPTIONS.md`, which is the configuration to enter in App Store
Connect, and `docs/TIERS.md` for the tier contract);
**live practice is on** (server `LIVE_ENABLED="1"`); **Home V2** is the iPhone
app's Home (General English). French listing: `METADATA.fr.md`. Nothing may be
claimed here that the build does not do.

> **OWNER ACTION — this listing is not submittable until all four are true.**
> 1. `premium_annual` and `premium_monthly` (both offered, annual first) are
>    entered in App Store Connect exactly as `SUBSCRIPTIONS.md` sets them out.
> 2. `be-entitlements` is deployed in production — it is **not** today, so the
>    app cannot read a plan and `planOn()` stays false.
> 3. `billing_enabled` is on for the shipped build (`FLAGS_IOS` in index.html
>    carries only `home_v2_enabled` today, so Premium is **off** in the binary).
> 4. The version below is bumped — 1.1.0 was submitted as a free release, and a
>    build that adds in-app purchases is a new version. The number is yours; it
>    is deliberately not guessed here.

**Name** BE Mastery — Business English
**Subtitle** (30) Speak English with confidence
**Bundle ID** com.lomonec.bemastery · **SKU** be-mastery-ios · **Version** 1.1.0 (1)
**Primary category** Education · **Secondary** Business
**Privacy policy URL** https://app.lomonec.com/privacy.html — the wording of this release branch must be live there before submission.
**Support URL** https://app.lomonec.com/flyer.html — carries contact@lomonec.com. REQUIRES OWNER CHECK that the address is visible on that page; if not, point this at a page that shows it.
**Marketing URL** (optional) https://app.lomonec.com/flyer.html
**Account deletion** inside the app (Profile → Backup & sync → *Delete account*, when signed in); also https://app.lomonec.com/delete-account.html — say so in the review notes.
**Copyright** © 2026 Lomonec LLC
**Content rights** The app's own lessons, audio and pictures are Lomonec LLC's; the practice photos are AI-generated (`rp-photos/SOURCES.md`). The Shadowing Studio **plays YouTube videos through YouTube's own embedded player** (streamed, not copied into the app). REQUIRES OWNER REVIEW when answering App Store Connect's "third-party content" question — the answer is not "no".
**In-app purchases / subscriptions** One subscription, two auto-renewable
plans — `premium_annual`, **US$19.99/year** (shown first, "Best value"), and
`premium_monthly`, **US$2.99/month**, each with a 3-day free trial for new
subscribers. The trial is shown only when App Store Connect reports it. Prices and the trial are read from StoreKit at runtime and
are written nowhere in the app, so App Store Connect is the source of truth
(Apple 3.1.2). Full set-up: `SUBSCRIPTIONS.md`.

## Promotional text (170)
25 minutes a day of real spoken practice — with feedback on what you say and, when you want it, another learner to talk to.

## Description
BE Mastery is a 12-week programme for professionals who understand English but hesitate to speak it. Twenty-five minutes a day, built around your own voice.

WHAT YOU DO EACH DAY
• Home shows your next step, chosen from what you have already done.
• A structured session on one workplace task: introduce yourself, run a stand-up, push back on a deadline, present a result.
• Record yourself, hear it back, and get feedback on your pronunciation and on which words came through clearly.
• Shadow real business speech in the Shadowing Studio, line by line, then test yourself in the Challenge.
• Turn a casual sentence into a boardroom-ready one with Executive Polish.
• Keep the phrases and vocabulary you collect, and review them when they are due.
• Watch a road map of the twelve weeks fill in, one day at a time.

GENERAL ENGLISH AND PROFESSIONAL TRACKS
Start with General English, or choose the Welding English track. Placement takes three sentences; if you are not ready for the full programme, a Foundations stage brings you up to it.

PRACTICE PARTNER (General English, 18+)
When you want a real person to say it to, Practice Partner finds another learner on the same programme.
• Four short recorded voice turns on today's task — record when you can, no scheduling.
• Or talk live: an audio-only call in four short rounds. Your partner's voice is never recorded; your own side of each round is transcribed so the AI coach can give you a tip and a private report.
• First names only, no photos, no profiles, no text chat.
• Report or block anyone at any time; reports from two different learners suspend an account from Practice Partner.
• You choose whether to keep practising with someone; they choose too, on their own.

AI COACH — ALWAYS LABELLED
An AI coach is always available for the same four-turn practice. It is always marked as AI and never poses as a person.

PRIVACY
Your recordings are kept on your phone. Audio you record for feedback, a voice turn you send to a partner and your own side of a live call are sent over an encrypted connection to be transcribed and scored; partner turns are deleted 14 days after a session ends. Reminders appear inside the app. You can delete your account and everything attached to it inside the app.
Privacy policy: https://app.lomonec.com/privacy.html

BE MASTERY PREMIUM
The 12-week programme, the daily sessions, the Shadowing Studio library, recording, playback and your own self-evaluation are free, on both tracks. With a free account you also get cloud sync, Practice Partner in full and three AI verdicts a day.
Premium adds more of the AI on top of that practice: up to 120 AI verdicts a day (speaking reports, pronunciation assessments and AI coach replies) and up to 240 minutes a day of your own YouTube videos transcribed, within fair use; 30- and 90-day analytics and your long-term record; personalised recommendations; more room for the videos, clips and reports you keep; and no ads.
One subscription covers both General English and Welding English. US$19.99 per year or US$2.99 per month; it renews unless you cancel at least 24 hours before the period ends, and you can cancel any time in your App Store settings.
Terms of Use (Apple standard EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy policy: https://app.lomonec.com/privacy.html

Made by Lomonec LLC.

## Keywords (100)
business english,speaking,pronunciation,fluency,professional,meetings,interview,shadowing,ESL

## Age rating (answer the questionnaire honestly)
- Unrestricted web access: **No** — the app opens its own pages; a YouTube search opens in Safari, outside the app.
- User-generated content / user interaction: **Yes** — voice between two matched learners (recorded turns and live audio calls), moderated by report/block, automatic contact-detail screening of transcripts, and a documented manual review of reports (`docs/release/UGC_OPERATIONS.md`); 18+ confirmation in the app.
- Contests, gambling, medical, violence, sexual content, profanity: **None** in the app's own content.
- Advertising: **None**.
If the questionnaire rates stranger communication at 18+, accept it — Practice Partner requires 18+ anyway.
**Set 6 Oct 2026:** the questionnaire alone computed 4+; the owner raised it with the
age-rating override to **18+** (`ageRatingOverrideV2 = EIGHTEEN_PLUS`; the older
`appStoreAgeRating` field reads 17+), matching Practice Partner's own 18+ rule.

## App Privacy (nutrition labels) — `PRIVACY_ANSWERS.md`

## What's New
Not shown for a first App Store version. Keep for 1.1.1+.

## Screenshots
Replacement plan in `SCREENSHOTS.md`. The nine files in `screenshots/iphone-6.9/` (20 Sep 2026) are **stale** and must not be uploaded.
