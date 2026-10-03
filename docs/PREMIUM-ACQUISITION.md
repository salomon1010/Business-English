# Premium acquisition: audit and implementation (2026-09-25)

Branch `feature/premium-acquisition`, from `e2a928e`. **Nothing is deployed**, and
`billing_enabled` is still OFF. While it is off, no new entry point appears, so
production looks exactly as before. Billing infrastructure, RTDN, entitlement
verification and product ids are unchanged.

## Google Play configuration (read from the Play API, read-only)

| Product | Base plan | Period | Prices (sample) | Grace | Offers |
|---|---|---|---|---|---|
| `premium_monthly` | `monthly`, ACTIVE, auto-renewing | P1M | US $4.99 · FR €5.49 · DE €4.99 · CI/SN XOF 3,400 · CM XAF 3,400 · NG ₦7,130 · MA 57.99 MAD | 3 days | `trial3d`, ACTIVE: 3-day free trial, new subscribers only |
| `premium_annual` | `annual`, ACTIVE, auto-renewing | P1Y | **US $24.99 (confirmed 2 Oct 2026)** · regional prices below are the 2026-09-25 sample for the OLD $19.99 tier | 14 days | none |

Both are sold in 173 regions. The Play listings have titles only, with no
description or benefits.

> **Annual price changed to $24.99/year (owner, 2 Oct 2026).** The regional
> figures read on 2026-09-25 — FR/DE €20.99, CI/SN XOF 13,600, CM XAF 13,700,
> NG ₦28,500 — belong to the old $19.99 tier and are **not** valid for $24.99.
> They cannot be derived here: Play and App Store Connect each generate their
> own regional tables from the base price, with their own rounding and tax
> rules. **Re-read both consoles after the change and replace this table with
> what they actually show.** Do not calculate them by hand.

## Audit: the app against Play

| # | Finding | Status |
|---|---|---|
| 1 | The product ids match `BILLING_PRODUCTS` / `PRODUCTS`. There is one base plan per product, which the purchase flow (product id only) relies on. | OK, unchanged |
| 2 | The client kept only `title` and `price` from the store, so it could not show "/month" or "/year", the annual saving, or the **live 3-day trial**. | **Fixed**: the Play provider also keeps `subscriptionPeriod`, `freeTrialPeriod`, and the numeric price and currency |
| 3 | The Premium card promised **"More AI coaching and practice each day"**. The entitlement's `ai_allowance` / `practice_allowance` are read by no feature, so this is a paid benefit that does not exist. | **Fixed**: removed. The card now says "Ad-free learning" and "Everything you use today stays included" |
| 4 | Premium was only reachable in App Setup → a collapsed "Free plan" section. | **Fixed**: a sheet opened from Profile, the App Setup card and beside ads |
| 5 | Premium's only real benefit is "no ads", and ads are not switched on. | **Owner decision**: see "Open" below |

## What was built

- **`premiumOpen(from)`**: a bottom sheet on the existing `lang-modal` / `pp-sheet`
  pattern. It is a view over `Billing` and the server's entitlement view, and
  adds no purchase path of its own.
  - Benefits: only what Premium delivers — no ads, everything included,
    cancel in the store.
  - Plans come from the **store**: Annual first and selected, with the store's
    price "/ year", the per-month figure and "Save N%" computed from the store's
    own two prices (same currency only). Monthly shows its price "/ month" and
    the trial **only when the store reports `freeTrialPeriod`**.
  - One **Continue** calls the existing `Billing.buy(selected)`. It also has the
    store's renewal terms, the Privacy link (plus the EULA on iOS) and Restore.
  - States:
    - signed out → sign in;
    - no store on this device → "can't be bought here yet";
    - loading, purchasing / restoring, and failure notes (from `Billing.note`);
    - Premium → "Active until …", "Continue learning", and Manage if this store
      sold the plan.
  - It redraws from `Billing._draw` and `entApply`. Escape, the backdrop and ✕
    close it. Focus moves into the dialog.
- **Entry points**, shown only when `premOffered()` (billing live, or the account
  already Premium):
  - a Profile row "BE Mastery Premium · No ads, ever";
  - "See Premium plans" on the App Setup card;
  - "Remove ads with Premium" beside the native ad slot, and on the
    interstitial once Continue appears.
  - Home is untouched, because Home is the programme card only (owner rule).
- 20 `prem.*` strings, translated in fr/es/pt/ar and in English in the other 11
  files (native review recommended).

## Open (owner)

- **Value.** Premium currently removes ads that are not shown, because
  `ads_enabled` is off. Either launch Premium together with ads, or give it a
  real benefit. The entitlement already carries `ai_allowance` /
  `practice_allowance: "enhanced"`, but no feature reads them.
- **Trial on a real device.** The app shows the trial only when the store
  reports one. The purchase call names the product only, so a real
  internal-testing purchase must confirm that Play applies `trial3d` (the Play
  sheet shows "Free trial").
- **Play listings.** Add a description and benefits to both subscriptions in Play
  Console (optional; the in-app sheet does not depend on them).
