# Premium acquisition — the visual redesign (2026-09-26)

Branch `feature/premium-acquisition-ui`, on `feature/premium-shadow-videos`
(`0101883`) plus the Subscription card (`31514e4`). Not merged, not deployed
to production. Staging only.

## What changed

**One screen, one hierarchy: hero → benefits → plans → CTA.** The sheet
(`premSheetHTML`) is a phone-first paywall: a bottom sheet on phones (full
width, rounded top, safe-area foot), a centred 440 px card from 600 px. The
body scrolls (`.prem-scroll`); the CTA sits in a pinned foot (`.prem-foot`)
outside the scroll box, so it never covers content.

- **Hero:** `BE Mastery ✦ PREMIUM` eyebrow, the headline *Speak with
  confidence. Practice without limits.* (second sentence in the theme's
  gradient text), the supporting line. A faint glow field from the theme's
  `--field-*` tokens; no hard-coded colour anywhere.
- **Benefits (`premBenHTML`):** only what Premium enforces where the sheet
  is drawn — the three General English storage limits from `PLAN_LIMITS`
  (saved Shadow videos, YouTube imports, Polish reports), plus *No ads* only
  while `ads_enabled` is on. Nothing else is promised (no AI, Partner or
  simulation claims).
- **Plans (`premPlanHTML`):** the store's two products — **two plans again
  under the owner's tier spec of 5 Oct 2026** (`docs/TIERS.md`): Annual first
  and selected, `BEST VALUE` tag, per-month figure and the saving computed
  from the store's own prices; Monthly with an `N DAYS FREE` badge and the
  trial line **only when the store reports a trial**. No Weekly (no such
  product). The store prices are US$19.99 / year and US$2.99 / month; the
  sheet prints whatever the store returns.
- **CTA (`premFootHTML`):** one primary button — *Start N-day free trial*
  when the selected plan has a trial, else *Continue with Premium* — with
  *Cancel anytime in Google Play* under it.
- **Legal (`premLegalHTML`):** the renewal terms sentence, then a small row:
  Privacy policy · Restore purchases (44 px tap targets). Terms of use is
  linked on iOS (Apple's EULA); on Android/web it appears once
  `PREM_TERMS_URL` holds a page — BE Mastery has no Terms page yet.
- **Comparison:** folded behind *See what's included* (`premMoreHTML`), the
  compact table plus "everything you use today stays included".
- **Billing unavailable:** exactly one message (`premUnavailHTML`). No
  products → *Purchases are not available right now.* + a hint + *Try again*
  (`premRetry` → `Billing.init()`); no store (web) → the existing "get it
  from Google Play" line. The benefits stay, no price is invented, no second
  Close button — the X leaves. The duplicate text came from rendering both
  the unavailable line and `Billing.note` (the same string).
- **Close behaviour unchanged:** the launch offer hides the X for
  `PREM_LAUNCH_WAIT` (5 s), then reveals it; Escape and the backdrop honour
  the same wait. New safety net `premWaiting()`: the wait also ends by the
  clock (`data-t0`), so a lost timer can never trap the learner.
- **General English boundary (as built on this branch, 26 Sep 2026):**
  `premOffered()` was `(planOn() && isGeneralEnglish()) || Premium`, so a
  Free Welding learner saw no Premium row, card, launch offer or "Remove ads"
  link. **Superseded by the owner's tier spec of 5 Oct 2026** (`docs/TIERS.md`):
  one subscription with the same capabilities on both programmes, so Premium
  is offered on Welding too. Welding shows no ads on any plan, so a "Remove
  ads" link never appears there.
- **Settings → Subscription:** the card from `31514e4` is unchanged (Free:
  plan + *See Premium plans* + Restore; Premium: plan name, store price and
  period, renewal date, Billed by, Manage in the store, Restore).

## What stayed unchanged

`Billing` (buy / restore / reconcile / manage), `BillingProviders`, the
entitlement Worker and its D1, `entView` / `entSanitize`, `PLAN_LIMITS` and
every limit, RTDN, purchase verification, Google Play products and prices,
the App Setup Premium card (`entPlanCardHTML`) apart from the Welding gate,
the launch-offer rules (`premLaunchReady` / `premLaunchBusy`).

## i18n

New keys `prem.headline`, `prem.on_h`, `prem.best`, `prem.trial_badge`,
`prem.cancel_note`, `prem.legal_terms`, `prem.included`, `prem.retry`,
`prem.unavail_hint`; changed `prem.lede`, `prem.b_noads`, `prem.cta`,
`prem.row_sub`; removed `prem.b_cancel`. Translated in fr / es / pt / ar,
English in the other 11 (owner rule). Key parity: 2,955 keys in all 15
files.

## Tests

`tests/premium-acquisition.mjs` (37): hero, benefits, plans, CTA per
selection, trial / no-trial store, one unavailable state + retry, no
provider, signed out, Premium state, launch X hidden → shown → closes,
safety net, 320 px dark/light, 412 px, Arabic RTL, fr/de at 320, reduced
motion, AA contrast inside the sheet, Welding boundary, Subscription card,
ads-on row. Updated: `billing-client` PR2/PR5 (copy), `premium-value`
D8/D17 (CTA label) and D19 (opens the fold before measuring the table).
