# Mobile typography & density audit

*29 September 2026 · branch `feature/bemastery-complete-ux-redesign` (on `c5f410ef`) · READY FOR REVIEW — DO NOT MERGE OR DEPLOY*

The brief was to make BE Mastery as compact, readable and information-dense as
the supplied reference app. The reference is five TubeShed screenshots; the
goal was to borrow its discipline, not its brand. The scale is written up in
`docs/DESIGN_SYSTEM_BEMASTERY.md` §18.

**Documented in the existing design system file.** The brief names
`docs/BE_MASTERY_DESIGN_SYSTEM.md`. The design system already lives in
`docs/DESIGN_SYSTEM_BEMASTERY.md`, and a second file would be the "second
competing system" the brief rules out.

During the work the owner added two requests:
- bring "Your record" back onto the Progress page;
- treat that report as a Premium feature (§6b).

## 1. Before state

### The reference, measured
Screenshots 1 and 5 are native iPhone captures: 1284 × 2778, a 428 pt screen
at 3×. Text size was estimated from capital-letter height:
- cap height ÷ 0.70 ≈ font size;
- the scale was calibrated on the status-bar clock, which measured 12.7 pt,
  the expected size.

Screenshots 2–4 are previews at an unknown scale and were used for
proportions only.

| Reference element | ≈ size |
|---|---|
| Settings row ("Native Language") | 12 pt |
| Section heading ("General") | 12.5 pt bold |
| Progress heading ("Overview", "Weekly Progress") | 15 pt bold |
| Metric label ("Total Sessions") | 11.5 pt |
| Metric value ("1", "1 days") | 23 pt bold |
| Segmented tab ("Speaking") | 14.5 pt |
| Chart axis / caption / "Best: 1 days" | 10 pt |
| Bottom-bar label | 9 pt |
| Settings row pitch | 60 pt |
| Metric card height / gap | 102 pt / 13 pt |
| Screen gutter | 16 pt |

### BE Mastery, measured in the browser
Computed sizes were measured in WebKit on an iPhone 13 profile.

| BE Mastery element | before |
|---|---|
| Profile row title / subtitle | 15 / 12 px (row 60 px) |
| Group heading ("General") | 15 px / **800** |
| Practice section ("Life Simulations") | **19–26 px / 800**, 26 px above |
| Life Simulations group, Settings "Data & privacy" | **18.72 px** (the browser's unstyled `h3` default) |
| Stat number / label (Progress) | 21–23 px / 11.5–12.5 px, tile **78–90 px** |
| Tabs | 14.5 px / 700 |
| Primary button | 15–16.5 px / 700 |
| Bottom bar | icons **25 px**, labels **9.5 px** (≤400 px) / 10.5 px, selected icon **scaled 1.12**, bar 67 px |
| Sign-in bar ("Save your progress") | **125 px** at 375 px, the message on 5 lines |

## 2. Problems identified
1. **The type was not oversized.** Most text already sat at the reference's
   sizes, and much of it below the brief's starting targets. Shrinking body
   text further would have made the app tiny, not compact. Applying the
   brief's numbers literally (body 15–16, section 18–21, nav 12–13) would have
   made several things **larger**. The brief calls those numbers starting
   targets, so the reference and the measurements decided.
2. **Weight:** every secondary heading was 800, so headings shouted.
3. **Oversized headings:**
   - Practice sections were 19–26 px with 26 px above them.
   - Two screens' headings had no style of their own and fell to the
     browser's 18.72 px default.
4. **Bottom bar:** the icon was about 2.6× the label's height, and the selected
   icon grew. The labels could not follow the brief's 12–13 px. The widest
   labels at 375 px ("الملف الشخصي", "Bibliothèque") need 10 px or less to fit
   a 61 px slot.
5. **The sign-in bar:** a 140 px minimum-width button squeezed its message
   into a narrow column: 125 px of floating chrome over the content.
6. **Stat tiles** were taller than their content needed.
7. **Practice › best tool:** the "Recommended" chip took a third of the row, so
   the title wrapped to 2 lines and the description to 4.

## 3. Typography changes
- **Tokens:** `--fs-*`, `--fw-*`, `--sp-*` and `--gap-section` on `:root`
  (design system §18).
- **Headings:**
  - `h1.big` uses `--fs-title` (22–24 px);
  - `.prac-sec` and the two unstyled `h3` groups are 17 px / 700;
  - group, card and settings headings drop from 800 to 700.
- **Buttons:** primary 15 px; outline 14 px.
- **Stats:** number 20–24 px, label 12 px.
- **Nav labels:** 10 px (were 9.5 px on ≤400 px, 10.5 px above); selected label
  700.

## 4. Spacing changes
- **Section gap:** 26 → 20 px (`--gap-section`).
- **Group heading margins:** 18/8 → 16/8 px.
- **Stat tiles:** padding 13/14 → 8/10 px; minimum height 78 → 62 px.
- **Calendar cards:** 18/16 → 16/14 px padding; week box 12/16 → 10/14 px.
- **Bottom bar:**
  - padding 7 → 5 px;
  - item minimum height 52 → 48 px, still ≥ 44 px;
  - icon-to-label gap 3 → 2 px.
- **Sign-in bar:** padding 14/16 → 10/12 px; button minimum width 140 → auto
  (sized to its label).

## 5. Component changes
| Component | Before → after (375 px unless stated) |
|---|---|
| Bottom bar | 67 → **59 px**; icon 25 → **22 px**; label 9.5 → **10 px**; selected item no longer grows |
| Sign-in bar | 125 → **73 px** (English); 87 → **62 px** at 430 px; French **107 px** |
| Progress stat tiles | 78–85 → **62–73 px**; the four-number card 333 → **297 px** |
| Practice › best-tool card | 415 → **396 px**; chip under the text on ≤480 px |
| Practice section headings | 19 px/800 → **17 px/700** |
| Profile group headings | 800 → **700** |
| Life Simulations groups | 18.72 → **17 px** |

Page heights at 375 px before → after the density work:

| Page | Before | After |
|---|---|---|
| Progress | 1258 | 1215, before "Your record" came back (§6b) |
| Practice | 1747 | 1710 |
| Settings | 2420 | 2369 |
| Life Simulations | 2377 | 2365 |
| Profile | 1470 | 1462 |

## 6. Screens changed
Every screen with a bottom bar is affected: the bar and the sign-in bar.

Most visible on:
- Progress
- Practice
- Profile
- Settings (App Setup)
- Life Simulations

**Unchanged on purpose:**
- **Home V2.** Its hero and row sizes were set by the owner on 27–28 Sep. An
  early draft of the heading rule enlarged Home's row headings to 17 px. That
  was caught by measuring before and after, and the rule was narrowed to the
  two screens that needed it. `tests/mobile-density.mjs` check 10c now guards
  it.
- **The session page** (owner's 0.87 text scale).
- **Shadow Studio's workspace and Challenge,** whose sizes are
  layout-critical and owner-set.
- **The header,** because the Premium badge must equal the logo tile (owner,
  28 Sep).

### 6b. "Your record" is back on Progress, as a Premium report
The owner asked, mid-task, to bring this block back and said it is part of
Premium. Since 28 Sep it had been hidden inside "See all details". It holds:
- phrases & idioms mastered;
- Shadowing clips saved;
- best streak;
- days practised;
- consistency;
- the year grid.

**What changed:**
- **Placement.** `pfRecordHTML()` was split in two:
  - `pfRecordCoreHTML()` (the two counts and the year card) now sits on the
    page, under the certificate, headed "Your record";
  - `pfRecordMoreHTML()` holds the rest (performance overview, share card,
    Welding-only panels) behind "See all details".
  - The two counts sit in two columns, so no label is squeezed into a third.
    A count still at zero recedes, using the existing `.stat-empty`.
- **A pre-existing right-to-left bug, fixed because it became visible.**
  `calScrollYearRight()` set `scrollLeft = scrollWidth`. In a right-to-left
  layout WebKit counts `scrollLeft` from 0 down to a negative end, so the
  value clamped to 0 and Arabic and Urdu opened the year grid on last
  October. It now scrolls to the negative end in right-to-left layouts.
- **Premium gate: `pgRecordLocked()`.** It locks only when all three hold:
  - Premium can actually be bought (`planOn()`: billing on plus an
    entitlement service);
  - the open area is General English, where Premium is offered
    (`premOffered`);
  - the learner is not Premium (`entIsPremiumForDisplay()`).

  With billing off, as in production today, every learner still sees the
  report.
- **What a free learner sees when locked.** A card headed "Your full record is
  part of Premium", which:
  - names the six parts;
  - says the practice "is still counted and kept";
  - says "Free keeps this week, your streak, your sessions and your
    certificate";
  - has one "See Premium plans" button (`premiumOpen('progress_record')`).

  It has no countdown, no blurred numbers held back and no loss wording, per
  `docs/ETHICAL_UX_PSYCHOLOGY_AUDIT.md` (I5 there). Nothing is deleted:
  unlocking shows the same record.
- **Welding** keeps the report, because Premium is not offered there.
- **Strings.** Three keys (`pg.rec_prem_h`, `pg.rec_prem_note`, `pg.rec_free`)
  were added to all 15 files, translated in fr / es / pt / ar with English
  elsewhere.
- **Open for the owner.** The first message about these metrics carried an
  image that did not arrive, so the exact list it meant is unconfirmed. This
  pass gates the "Your record" block from the owner's second screenshot, and
  nothing else on Progress.

## 7. Accessibility checks
- **Touch targets:** bottom-bar items ≥ 48 px, primary buttons ≥ 44 px, the
  sign-in bar's button 40 px (the design-system floor for secondary
  controls). Checked on every screen in the sweep (§9).
- **Contrast:** colour tokens were not touched, so it is unchanged. The new
  Premium card uses `--txt`, `--mut` and the existing CTA.
- **Size:** nothing new is under 10 px.
- **Scaling:** text still scales with the system setting. No new fixed
  heights on text.
- **Colour is never the only signal:** the selected nav item is marked by
  colour, a 700 label and its pill; the Premium card carries a written
  "Premium" chip.

## 8. Localisation checks
- **Bottom-bar label widths at 375 px (61 px slot):**

  | Language | 10 px | 11 px | 12 px |
  |---|---|---|---|
  | English | 50 | 55 | 60 |
  | French | 55 | **61** | 67 |
  | Arabic | 60 | 66 | 73 |
  | German | 53 | 58 | 64 |
  | Portuguese | 49 | 54 | 59 |

  10 px is the largest size where every language fits, so it was chosen.
- **The sweep** (§9) ran English, French and Arabic, dark and light, at 375,
  390 and 430 px. The results:
  - no horizontal scroll;
  - every bottom-bar label on one line;
  - nothing off the edge except Shadow's two deliberately scrolling rails.
- **Arabic right-to-left:** the record, the year grid (now opening on the
  current month) and the Premium card mirror correctly. Screenshots were
  checked by eye.

## 9. Test results
Local WebKit (Playwright), iPhone 13 profile at 375, 390 and 430 px.

| Suite | Result |
|---|---|
| `tests/mobile-density.mjs` (new) | 34/34 |
| Density sweep (scratch, 12 screens × 3 widths × en/fr/ar × dark/light) | 1100/1118. The 18 failures are Shadow's channel rail (`.shl-chans`, `overflow-x:auto`), identical on the unchanged commit. The same sweep on `c5f410ef` scored 948/1118, mostly the 125 px sign-in bar. |
| `ux-psychology.mjs` | 16/16 |
| `home-v2.mjs` | 41/41 |
| `smoke.mjs` | 33/33 |
| `premium-acquisition.mjs` | 37/37 |
| `premium-value.mjs` | 78/81: A0, A3, C5 fail identically on the base |
| `home-highlights.mjs` | 28/29: check 20 fails identically on the base |
| Inline-script parse check | 4 scripts, 0 errors |
| i18n key parity | 15/15 files |

## 10. Screenshots / visual evidence
In the session scratchpad (`dens/`):
- **Before and after per screen and width:**
  - `before-*` / `after-*`
  - `qa-before/` / `qa/` (158 each: size / language / theme / area / screen)
- **"Your record":**
  - `record-en-dark.png`, `record-ar-light.png`
  - `record-premium-en.png`, `-fr`, `-ar` (the Premium card)
- **The reference:** measured crops in `ref-row.png`.

## 11. Known limitations
- **No real device and no iOS Simulator for this pass.** Everything here is
  WebKit in Playwright with iPhone-sized viewports. The earlier Simulator
  pass covered `c5f410ef` only.
- **French sign-in bar:** 107 px, because its text is long. The button stays
  beside the text, since moving it under would make the bar taller.
- **Bottom-bar labels** are 10 px, not the brief's 12–13 px, which do not fit
  French or Arabic in six slots at 375 px. Larger labels would need five tabs
  or icon-only tabs: a product decision.
- **Home V2, the session page, Shadow's workspace and the header** keep their
  owner-set sizes (§6).
- **Header subtitle.** It read "Home" on other pages in these runs, but the
  pages were opened by calling `go()` directly, so this was not investigated
  and may not happen on a real tap.
- **The rest of Progress is not gated.** Whether other Progress figures should
  also be Premium, and what Free keeps, is the owner's call. The reference's
  pattern is "30 & 90-day views" as the paid layer.
