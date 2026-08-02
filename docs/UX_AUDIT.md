# UX_AUDIT

> Status: authored 2026-08-02. **Only the Dashboard has been audited in depth.**
> The other eleven screens are listed as pending, not assessed. Nothing in this
> file is estimated — every number was measured.

## Method

Audits are measured, not eyeballed. The rig lives outside the repo (scratchpad)
and is rebuilt per pass; it is ~120 lines of `playwright-core` driving the
system Chrome against `python3 -m http.server`.

1. Seed `localStorage["be12_v1"]` with a **committed user** (6-day streak,
   6 sessions, words due) *and* a **first-run user** (empty). Most defects only
   appear in one of the two.
2. Render at **390×844** (iPhone 14 CSS px), both themes.
3. Assert the intended view actually rendered before measuring.
4. Record: y-position and height of every key element, document height, `<h1>`
   count, interactive elements under 44px, elements with
   `animation-iteration-count: infinite`.
5. Probe computed foreground/background and WCAG ratio for every text role.
6. Re-run under `reducedMotion: "reduce"`; walk the tab order.

The fold on a 390×844 handset is **~772 usable px** after the bottom nav.

---

## Screen 1 — Dashboard ✅ complete

### Findings (before)

| # | Problem | Why it mattered |
|---|---|---|
| P1 | 298px of preamble — sticky marketing banner, marketing headline, tagline, three pills echoing the user's own onboarding answers — before the day's task. Streak was a 24px header pill. | Day 40 looked identical to day 0. The habit loop had no visible reward. |
| P2 | `.glow-cta` rendered near-white on near-white in light mode; the boldest object on screen was the green "Dashboard" **tab**. Two infinite animations. | Hierarchy inverted — the primary action read as disabled. |
| P3 | 825px metric panel; **7 of 9 tiles read 0** for a user with a 6-day streak, 6 carrying a green paragraph of advice. Row heights 125/143/158/161/176px. | The largest region of the screen was a to-do list of failures. |
| P4 | The `?` help FAB sat **on top of** the "Execution rules" tab label at rest, both themes. | Broken. |
| P5 | Green meant active-tab, achievement, and next-step-hint at once. | Colour stopped communicating. |
| P6 | Two eyebrows, one a sticky marketing slogan. Every other view uses `.pg-eyebrow` as a page label. | Home was the only view advertising. |
| P7 | `seg-tab` 40px (under 44). Phase chip collided with its count (`Executive Communication0/28`). | — |

### Measured before → after

| | before | after |
|---|---|---|
| Primary CTA y-position | 472 | **344** |
| Document height | 2257px (2.67 screens) | **1856px (2.20)** |
| Metric panel | 825px, ragged | **487px, uniform 85px rows** |
| Interactive targets <44px | 2 | **0** |
| Infinite animations | 2 | **0** |
| Contrast failures | 2 | **0** |
| `<h1>` per view | 1 | **1** (both states) |

### Contrast defects found

- `.home-due-t b` — **1.09:1** in dark. `<button>` inherits the UA's black text;
  `.home-due` never set `color`. Pre-existing, shipped.
- `.btn-primary` on raw `--acc` — **4.47:1** in dark, against a 4.5 requirement.

Both fixed. Full probe passes in both themes.

### Decisions worth preserving

- The aspirational hero is the **empty state**, not the default. Users with
  history get evidence (`.home-week`); day-0 users get the promise.
- Execution rules moved from a 50%-width tab to a closed `<details>`. Reference
  material is not a daily decision.
- Words-due sits above the role-play promo: review expires, promos do not.
- Nine metrics kept, all tappable and keyboard-operable — this was a
  **re-ranking and de-noising, not a removal**.

Commit: `9450bed`.

---

## Screens 2–12 — not yet audited

Listed in working order. No findings recorded because none have been measured.

| # | Screen | Renderer | Notes carried forward |
|---|---|---|---|
| 2 | Session | `rHome`→`go('session')`, renders into `#v-journey` | Uses deprecated `.glow-cta` ×1 |
| 3 | Shadowing Studio | `rShadow` / `shOpenWork` | Uses `.glow-cta` ×1; embeds third-party YouTube artwork |
| 4 | Speaking Feedback | within session / shadow | No per-word timing available — be honest about it |
| 5 | Executive Polish | within `rPhrases` | `.ex-micbtn` carries the same infinite conic animation |
| 6 | Vocabulary | `rPractice` | — |
| 7 | Practice Hub | `rPractice` | — |
| 8 | Calendar | `rProfile` → `.pcal-*` | **Labels hardcoded English, no i18n keys** |
| 9 | Profile | `rProfile` | Dev toggle: tap "Program start date" 5× |
| 10 | Settings | `rData` | — |
| 11 | Help | `rManual` | — |
| 12 | Onboarding | `rSetup` | Where the "dream" voice legitimately lives |

---

## Cross-screen defects

Found during the Dashboard pass; each needs its own decision, not a per-screen
patch.

1. **`.help-fab` overlaps content at rest.** `position:fixed`,
   `bottom:84px; right:16px`, on every screen. Recommendation: **delete it** —
   Profile → Help already exists and the bottom nav reaches Profile in one tap.
2. **`.glow-cta` is deprecated but still live** on Session (×1) and Shadow (×1),
   plus `.ex-micbtn` in Executive Polish (also an infinite conic gradient). Two infinite animations each.
3. **Radius sprawl.** Raw `12px` (34×), `10px` (15×), `9px`, `8px`, `7px`,
   `22px` alongside the `--r-md`/`--r-lg` tokens. Migrate per pass.
4. **Header streak pill shows a gold flame "0"** on day one — a celebratory
   badge for an achievement not yet earned. One-line fix, but it is shared
   chrome across all 12 screens.
5. **Progress Calendar has no i18n keys.** Fifteen languages see English.
