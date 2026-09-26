# Premium value — first benefits and the launch offer (2026-09-25)

Branch `feature/premium-shadow-videos`, built on `feature/premium-acquisition`
(`6b2570f`). Not merged, not deployed to production.

## The switch: `planOn()`

The limits below apply **only** when `billing_enabled` is on and an entitlement
service exists — where Premium can actually be bought. That is the staging
environment with `?flags=billing_enabled`. With billing off (production today)
every learner keeps the app exactly as it was. The suite checks this: P1–P3.

## One table: `PLAN_LIMITS`

| Capability | Free | Premium | Enforced |
|---|---|---|---|
| `savedShadow`: videos saved from the BE Mastery library | 5 | 100 | yes, General English |
| `youtubeImports`: YouTube videos added by pasting a link | 2 | 20 | yes, General English |
| `polishHistory`: Polish reports you can revisit | 1 (latest) | 50 | yes, General English |
| `aiConversationDaily`, `aiSimulationDaily`, `partnerSessionMin`, `partnerSessionsDaily`, `reportHistory`, `progressHistoryDays` | null | null | **no**, named for later |

- **Plan:** `planKey()` returns `premium` only when the server's answer says so
  (`entView` ← `GET /v1/entitlement`) **and** an entitlement service exists. A
  hand-written cache is replaced by the next server answer, and counts for
  nothing without a service.
- **Reading a limit:** `planLimit(name[, plan])`. The table is frozen.
- **Welding** gets none of it. Every caller checks `isGeneralEnglish()`.

## Shadow: one list, two kinds

- **Storage:** `S.shOwnA[area]` is unchanged. General English entries gain
  `src: "lib" | "yt"`.
- **Old entries** are classified once from the catalogue by `shOwnClassify()`:
  a library video is `lib`, anything else `yt`. It only adds the field and
  removes nothing. Welding entries are never touched.
- **The catalogue** (301 videos) is never limited.
- **Saving a library video:** the bookmark on each library row, or "Save
  video" in the workspace ⋯ menu.
- **Pasted links:** a pasted link to a library video counts as a library save.
- **Imports past the allowance** are refused before anything loads, so no
  transcription is paid for, however often the link is pasted.
- **The Worker is asked to transcribe** (`shCapMayAsk`) only for a library
  video or a current import. A removed import is never transcribed again.
- **When a plan drops:** nothing is removed and everything stays visible. New
  saves of that kind wait until the learner is under the allowance.
- **Deleting an import** frees its slot.

## Polish history

- **Storage:** `exRepA` is unchanged.
  - Free still stores `EX_REP_MAX` (5), but shows the latest report in "Your
    Polish history". The older ones are listed as waiting for Premium and are
    not deleted.
  - Premium stores and shows up to 50.
- **When Premium ends:** the history is not cut. Past 5, the oldest gives way
  to the newest, one for one.
- **Comparison:** each report keeps the previous report's numbers (`pm`), so
  "vs last time" survives a short history.
- **Merges** cut at the technical ceiling, never at the plan.
- **Practice is never limited.**

## Launch offer

- **Who sees it:** a signed-in General English learner the server has called
  Free in **this** session, where Premium can be bought.
- **How often:** once per app session (`sessionStorage`).
- **When:** never over onboarding, the placement check, another sheet or a
  practice screen. It waits for the learner to be free, and gives up after
  about 30 seconds.
- **Behaviour:**
  - The X appears after 5 s. Before that, Escape and taps outside do nothing.
    After it, the offer closes like any sheet.
  - Reduced motion: the X appears with no animation.
- **Content:** the existing Premium sheet. Annual first and selected, the
  saving, Monthly with the trial only when Play reports it, "Start 3-day free
  trial" when a plan with a trial is chosen, renewal terms, Privacy, Restore.

## Subscription (App Setup)

`subCardHTML()` sits at the top of App Setup's plan area. It is shown wherever
Premium exists (`premOffered()`).

**Free (General English):**
- "Current plan: Free".
- "Unlock Premium", followed by the three real benefits.
- "See Premium plans", which opens the existing sheet.
- Restore purchases, when a store is present and the learner is signed in.
- No Manage button.

**Premium (either track, because it is account management):**
- The plan the store sold, e.g. "Premium · Annual". It comes from what THIS
  device owns (`Billing.ownedIds`, from Play's silent `listPurchases`, a
  restore or a completed purchase). The server's view carries no product, so a
  plan bought on another phone reads just "Premium".
- The store's own price and period.
- "Renews on", "Ends on" or "Premium stays on until", with the date from the
  server, plus the cancelled or payment-problem warning.
- "Billed by".
- **Manage subscription** uses the existing `Billing.manage()`:
  - Play: `play.google.com/store/account/subscriptions?package=…&sku=<owned>`.
    The sku is now passed; before this it was always missing.
  - iOS: the StoreKit sheet, contract unchanged.
  - A plan from the other store is named, not opened.
- Restore purchases.

**Other entry points:**
- Profile: for Premium the row reads "Subscription · Premium · Annual" and
  `subOpen()` lands on the card. For Free it is unchanged and opens the sheet.
- The Premium sheet in its Premium state links to "Subscription details".

**Hidden:**
- With billing off.
- For a Free learner on Welding.

Suite: `tests/subscription.mjs` (29 checks).

## Cloud copy

The size guard (`fbCloudJson`) now also protects the Free level for each kind:
- **Transcripts:** the newest 5 library saves, the newest 2 imports and
  Welding's 5 go first.
- **Near the limit:** Polish history is cut to 5 reports per area in the cloud
  copy only.
- **Still too large:** no write is made, and the account copy stays as it was.

## Tests

`tests/premium-value.mjs`: 81 checks, covering production default, library
saves, imports, migration, Polish, Welding, entitlement, sync and the launch
offer.
