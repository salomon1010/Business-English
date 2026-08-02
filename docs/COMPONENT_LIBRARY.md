# COMPONENT_LIBRARY

> Status: authored 2026-08-02. Every component below **exists in `index.html`**
> today. Line references drift; find by class name.

Rule: **reuse before you add.** A new class that duplicates one of these is a
review failure. If an existing component is nearly right, extend it with a
modifier rather than forking it.

---

## Actions

### `.btn-primary` — the one primary action
```
solid color-mix(--accent 90% / #000) · --on-accent text · min-height 52px
--r-md · --sh-2 · full width · :active scale(.985) · --focus ring offset 3px
```
One per **viewport** (see `DESIGN_SYSTEM` §8). Passes AA in both themes at
**5.32:1 dark / 7.31:1 light** — the 90% mix is required, raw `--acc` is 4.47:1.
No animation.
**Used by:** Dashboard, Session ×2, Shadow ×2, Executive Polish.

### `.fb-again` — emphasised secondary
Outlined accent, full width, 48px. For a next step that must read as actionable
where an accent *fill* would collide with a nearby primary. In dark the label is
lifted toward white (raw `--accent` as text is 4.31:1 on `--card`).

### `.btn` + `.btn-p` / `.btn-g` — legacy buttons
`.btn-p` is a gradient fill, `.btn-g` a bordered ghost. Still used widely.
*(target)* `.btn-p` folds into `.btn-primary`; `.btn-g` becomes the secondary.

### `.glow-cta` — **deleted**
Removed entirely in the Executive Polish pass, rules and both keyframes. It
carried two infinite animations and rendered near-white on near-white in light
mode, reading as disabled. Recorded here so it is not reintroduced.

### `.home-step` — the single next step
A full-width row: text + `→`, `--sh-1`, min-height 48px. States one next action
beneath a panel instead of repeating advice inside every tile.

---

## Surfaces

### `.card` — base surface
`--card` background, `--line` hairline, `--r`, `15px 16px` padding.

### `.today-card` — the hero surface
`.card` + `--sh-2`, no wash. The most elevated thing on its screen; contains
the `.btn-primary`. Its `h1`/`h2` is `clamp(20px,5.2vw,25px)`/800.

### `.home-dash` — grouped metric panel
One panel holding N borderless `.stat` tiles. `grid-auto-rows:1fr` keeps rows
uniform. Replaces per-metric bordered boxes.

### `.ex-best` / `.ex-copy` — the led rewrite and its reuse action
Green-tinted surface holding the rewrite the panel leads with, a labelled
"Key phrase used" block, and an action row where **Copy leads**. Never label
such a block with a claim the producer does not support — see `DESIGN_SYSTEM` §10.

### `.home-more` — progressive disclosure
`<details>` with a 52px `summary`, chevron rotating on `[open]`. For reference
material that must stay reachable but is not a daily decision.
**Prefer this over a tab row** when one branch is used far less than the other.

---

## Data display

### `.stat` — a metric tile
Icon + number + optional suffix + label. `role="button"`, `tabindex="0"`,
Enter/Space handler, `--focus` ring at `outline-offset:-2px`. Min-height 78px.
Tapping goes to the screen that changes the number.

**`.stat-empty`** — `opacity:.55` for a metric still at zero, restored on hover.
Only apply when *some* sibling is non-zero; a fully dimmed panel reads as broken.

Two distinct questions, two flags: `dim` = is the displayed number nothing?
`zero` = is the underlying activity untouched (which is what makes advice
truthful)? They diverge — 0 of 5 saved words mastered is dim, but "save some
words" would be wrong advice.

### `.home-week` — momentum strip
Seven day dots + `N/6` + `home.week_days`. **Reuses `.pcal-wd`** dot styles and
`calWeekProgress()` from the Progress Calendar, so Home and the calendar cannot
disagree. Dots are `aria-hidden`; the group's `aria-label` carries the counts as
text, so state is never colour-alone.

### `.ring` / `.home-ring` — programme completion
150px SVG ring + phase bars. Phase label row needs `gap:10px` and `flex:none`
on the count, or the chip collides with `N/28`.

### `.pcal-*` — Progress Calendar
Week strip, month heat-map (`data-lvl` 0–4), year graph, stats, insight line.
All strings are keyed and all dates follow `calLocale()` (the app language,
not the browser). Weekday initials come from `Intl`, not a literal array.

---

## Navigation and entry points

### `.home-due` — expiring work
Green card-button for spaced-repetition words due now. Hidden entirely at zero.
**Must set `color:var(--txt)`** — it is a `<button>` and inherits black otherwise.

### `.rp-entry` — secondary destination
Thumbnail + title + 2-line clamped body + `→`. `-webkit-line-clamp:2` keeps the
full translated sentence in markup while showing a glance.

### `.pg-eyebrow` — sticky page label
Used by every view **except Home**, where the header's own "Home" sub-label
already says it and a sticky bar would cost 43px to repeat it.

### `.seg-tabs` / `.seg-tab` — segmented control
*(constraint)* Must be ≥44px tall. The Home instance shipped at 40px and sat
underneath the help FAB; it was removed rather than resized.

---

## Chrome

`.hdr` brand + streak pill · `.bnav` six-item bottom nav with `navBadgeCount`
badges · `.fab-col` / `.help-fab` floating help.

**Known defect:** `.help-fab` is `position:fixed` at `bottom:84px; right:16px`
and overlaps interactive content at rest on more than one screen. Cross-screen;
recommendation is to delete it, since Profile → Help already exists.

---

## Adding a component — checklist

1. Does one of the above already do this? Extend it.
2. Tokens only — no raw hex, no new raw radius.
3. Contrast measured in **both** themes, not eyeballed.
4. ≥44px if interactive; visible `--focus` ring.
5. Keyboard-operable, and reachable in a sensible tab order.
6. `prefers-reduced-motion` counterpart if it animates.
7. Every visible string behind an i18n key.
8. Comment *why* it exists, not what it does.
