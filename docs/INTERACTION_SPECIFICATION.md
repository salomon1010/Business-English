# INTERACTION_SPECIFICATION

> Status: authored 2026-08-02. Behavioural contract for every interactive
> element. Where a rule was derived from a defect actually found, the defect is
> named so it is not reintroduced.

## 1. Touch and pointer

- **Minimum target 44×44px.** Not the icon — the hit area. **Both dimensions.**
  The floor lives on the shared component (`.btn`, `.theme-opt`, `.pv-x`), never
  on a per-screen descendant rule — scoped floors are why modals, overlays and
  `#v-data` shipped with 42px controls while the audit reported zero.
- **Documented exemptions**, and the only ones: a target whose presentation is
  essential (the `.cw-cell` crossword grid — ten 44px columns overflow a 390px
  screen), a link inline in a sentence (`.auth-terms`, the manual body), and a
  small control wrapped in a ≥44px `<label>` (the reminder checkbox). All three
  are WCAG 2.5.8 exceptions. Anything else meets the floor.
- Press feedback within 100ms: `scale(.985)` or `translateY(-1px)`.
- Never rely on hover to reveal an affordance. This is a phone-first product.
- `cursor:pointer` on anything that navigates.

## 2. Keyboard

Everything actionable is reachable and operable by keyboard.

- Native `<button>` / `<a>` / `<summary>` wherever possible.
- A non-native control needs **all four**: `role="button"`, `tabindex="0"`, an
  Enter/Space handler with `preventDefault()`, and a visible focus ring.
  `.stat` is the reference implementation.
- Tab order follows visual order. Verified by walking `document.activeElement`.
- Focus ring: `2px solid var(--focus)`. `outline-offset:3px` outside a surface,
  `-2px` inside a panel so it isn't clipped.
- `:focus-visible`, not `:focus` — no ring on mouse click.

## 3. Screen readers

- **One `<h1>` per view.** Where a screen has both an aspirational hero and a
  content hero, exactly one is the `h1` (see `rHome`'s `started` branch).
- Decorative graphics `aria-hidden="true"`; the meaning goes in text or an
  `aria-label` on the group. `.home-week` dots are hidden; the group's label
  reads `6/6 days this week · 6 day streak`.
- **State is never colour-alone.** A green dot must be accompanied by a count,
  a label, or a shape difference.
- Icon-only controls carry `aria-label`.
- `aria-label` content goes through `t()` — never a hardcoded English string.

## 4. Contrast

WCAG AA floor: 4.5:1 body, 3:1 for ≥18.66px bold or ≥24px.

Two traps, both found in production code:

- **White on raw `--acc` is 4.47:1 in dark** — under AA. Primary buttons use
  `color-mix(in srgb, var(--accent) 90%, #000)`.
- **A `<button>` inherits the UA's black text.** Any card-shaped button must set
  `color:var(--txt)`. `.home-due` shipped at 1.09:1 in dark because of this.

Measure computed values in both themes. Do not eyeball.

## 5. Motion

- Motion **confirms, guides, or celebrates**. Never decorates.
- **No infinite animation in product UI.**
- Every animated rule needs a `@media (prefers-reduced-motion:reduce)`
  counterpart, and the target under reduce is **0 animating elements**.
- Duration `.12–.2s`; easing `cubic-bezier(.2,.8,.3,1)`.
- Never animate a property that triggers layout. Transform and opacity only.

## 6. State machine

Every asynchronous surface specifies four states, not one.

| State | Contract |
|---|---|
| **Loading** | Skeleton matching the final shape. Not a spinner. Reserve the final height so nothing shifts. |
| **Empty** | Says what goes here and offers the one action that fills it. This is where the aspirational voice belongs. |
| **Error** | Plain, specific, non-blaming, with a retry. Inline for forms, toast only for transient. |
| **Success** | Confirm, then get out of the way. |

Offline is a first-class state, not an error — this is an offline-first PWA.
Executive Polish falls back to local rule-based clean-up with no network.

## 7. Navigation

- `go(v, a1, a2)` is the only way to change view. Views are `#v-<name>`.
- Current view persists in `location.hash` **and**
  `sessionStorage["be_view"]` — an installed PWA relaunches to `start_url:"./"`
  which drops the hash.
- Inactive views are emptied on navigation so duplicate element ids never shadow
  the active one. Anything cached across a view change must live in a module
  variable, not the DOM.
- `window.scrollTo({top:0})` on every view change.
- Destructive actions confirm. Navigation does not.

## 8. Progressive disclosure

- **One primary action per screen.** If there appear to be two, one is secondary
  or it is two screens.
- Reference material goes behind `<details class="home-more">`, closed by
  default — not behind a tab. A tab forces a daily choice; a disclosure does not.
- Advanced settings stay hidden until asked for. The GitHub-sync tool is behind
  a 5-tap dev toggle and stays there.
- Content one tap away is not "hidden" — it is ranked.

## 9. Copy in the interface

- Buttons are verbs. Labels are nouns. Errors say what to do next.
- A primary CTA is 1–4 words plus optional `→`, and must not wrap at 360px.
- Never a number without a noun. `6/6` alone is ambiguous next to seven dots;
  `6/6 days this week` is not.
- Every visible string behind an i18n key. **1112 keys, 15 files, no exceptions.**

## 10. Verification

Run before declaring any screen complete.

**JS parse** (the `ld+json` exclusion matters — the head carries JSON-LD data
that `new Function` chokes on):
```
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g;let n=0,bad=0,m;while((m=re.exec(h))){n++;try{new Function(m[1])}catch(e){bad++;console.log(e.message)}}console.log("scripts:",n,"errors:",bad)'
```

**JSON-LD**, separately: `JSON.parse` the `ld+json` block.

**i18n parity** — 1112 keys in `I18N_EN` and every `i18n/*.json`, no missing,
no orphans. Match keys with `/"([A-Za-z0-9_.\-]+)"\s*:/g`; a line-anchored
regex undercounts by 36 because some entries share a line.

**Measure document-wide, never inside `#v-<name>`.** Every audit up to RC1
scoped its queries to the active view container and tested `height` only. That
single mistake hid, for the entire screen programme:

- the app footer links (16px, present on *every* screen)
- the bottom nav, including the active label's 4.08:1 contrast
- every modal and overlay — sign-in, language, the practice viewers
- the same Settings markup when it renders into `#v-data` instead of `#v-setup`
- any control narrow but tall enough (`.auth-x` was 20×**11**)

Query `document`, filter by real visibility, and test **both** dimensions. When
the fixed gate was first run it found violations on **11 of 11** screens that
the scoped gate had passed as clean.

**Compositing:** a gradient contributes one candidate backdrop *per stop*.
Blending all stops together invents failures — it reported `.prac-ex-card small`
at 4.33:1 when the true worst stop gives 5.10:1. Take the worst single stop.
Skip elements with `background-clip:text`; their computed `color` is
`transparent` and the ratio is meaningless.

**Rendered checks**, both themes, both user states (committed and first-run):
element positions vs the fold · document height · `<h1>` count · interactive
elements under 44px · elements with infinite animation · computed contrast per
text role · tab order · `reducedMotion:"reduce"` → 0 animating elements.

Playwright MCP locks its browser between sessions. Fall back to
`playwright-core` + system Chrome (`/Applications/Google Chrome.app/...`),
installed ad hoc — it is not a project dependency. Always assert the intended
view rendered before measuring; routing is easy to get subtly wrong (a day
session renders into `#v-journey`, not a container of its own).

## 11. Definition of done

- [ ] Audited, problems named, before/after measured
- [ ] Consistent with `DESIGN_SYSTEM.md` — tokens only
- [ ] Reused existing components; no near-duplicates added
- [ ] Contrast passes both themes
- [ ] Keyboard-complete, sensible tab order, visible focus
- [ ] 0 targets under 44px, 0 infinite animations, 0 animating under reduce
- [ ] One `<h1>`, one primary action
- [ ] Every string keyed; parity holds at 1112
- [ ] JS parses; JSON-LD parses
- [ ] Self-reviewed as if someone else opened the PR
- [ ] Regression risks written down
