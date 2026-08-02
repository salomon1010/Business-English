# DESIGN_SYSTEM

> Status: authored 2026-08-02. Token values below are **read out of
> `index.html`**, not proposed. Anything marked *(target)* is not yet true
> everywhere and is tracked in `IMPLEMENTATION_ROADMAP.md`.

The system lives in the `:root` blocks of `index.html`. There is no build step,
no framework, no CSS file. A token is only real if it is in `:root`.

## 1. Colour

Two themes, switched by `data-theme` on `<html>`, stored in
`localStorage["be_theme"]`. Every colour is a token; **no raw hex in component
CSS** except where a value must be legible against a fixed accent.

### Dark (default)

```
--bg #0a0e1a   --bg2 #0f1526   --card #141b30   --card2 #1a2340
--txt #e8ecf8  --mut #8b94ad   --mut2 #5c6580
--line rgba(255,255,255,.08)   --line2 rgba(255,255,255,.14)
--acc #6366f1  --acc2 #22d3ee  --gold #fbbf24  --green #34d399
--red #f87171  --pink #f472b6
```

### Light

```
--bg #f5f7fc   --bg2 #ffffff   --card #ffffff   --card2 #eef2fb
--txt #0f172a  --mut #586179   --mut2 #98a1b8
--line rgba(15,23,42,.10)      --line2 rgba(15,23,42,.16)
--acc #4f46e5  --acc2 #0e7490  --gold #b45309  --green #047857
--red #dc2626  --pink #be185d
```

### Role aliases

```
--accent      = --acc                              the one accent
--accent-fill = color-mix(--acc 90%, #000)         a brand fill that carries text
--focus       = --acc2                             focus rings only
--on-accent   = #fff                               text on --accent / --accent-fill
```

### Token contracts — binding

These three are the ones that have caused real defects. Each rule below exists
because breaking it shipped a measured failure.

#### `--accent`

**Use for:** the one primary action per viewport; accent *text* on a plain
surface (`--card`, `--bg`); borders and 1.5px outlines; small tinted washes
via `color-mix`.

**Never use for:** a background that has text on it — use `--accent-fill`.
Raw `--acc` behind white measures **4.47:1** in dark, just under AA. And never
as accent text on an already-accent-tinted surface without measuring: as *text*
on `--card` in dark it is only **4.31:1**, which is why `.btn-outline` lifts its
label toward white.

#### `--accent-fill`

**Use for:** any filled brand surface with a label or glyph on it — primary
buttons, the profile avatar, active tabs and pills, day dots, the desktop nav
tab, chat bubbles.

**Never use for:** text, borders, or a fill with nothing on it (a progress bar,
a decorative rule) — those may keep `--grad`.

**Why it exists:** `--grad` runs indigo → cyan, and `#22d3ee` is a *light*
colour. White on the gradient's cyan end is **~1.8:1**. Every gradient fill
carrying text failed AA, on every screen, in both themes. `--accent-fill` is a
single deepened accent that clears AA at **5.32:1 dark / 7.31:1 light**, and it
replaced six hand-copied `color-mix()` declarations.

**`--grad` is now decoration only.** If you are about to put text on it, you
want `--accent-fill`.

#### `--mut2`

**Use for:** hairlines, dividers, disabled states, decorative glyphs — anything
that is not read.

**Never use for:** text of any size. It measures **2.3–3.1:1** on `--card` and
`--bg2` in *both* themes. It fails AA everywhere it has ever been used for copy.
Use `--mut` for secondary text; `--mut` is maintained at ≥4.5:1 on every
surface the app paints, including tinted cards.

This was the most repeated defect in the project — found and fixed on Session,
Shadow, Speaking Feedback, Vocabulary, Calendar, Practice, Profile, Settings,
Review and Journey before the sweep cleared the last of it.

### What each colour means — one meaning each

| Token | Means | Never means |
|---|---|---|
| `--accent` | the primary action | decoration, "this is important" |
| `--green` | earned / achieved | active state, hints, navigation |
| `--gold` | streak, rating, the non-negotiable rules | success |
| `--red` | destructive or failing | emphasis |
| `--acc2` | focus ring, eyebrow labels | a second accent |

If a colour starts carrying two meanings on one screen, one of them is wrong.
The Dashboard pass removed a case where green meant active-tab *and* achievement
*and* next-step-hint simultaneously.

### Contrast

WCAG AA is the floor: **4.5:1** body, **3:1** for ≥18.66px bold or ≥24px.

See the token contracts above for `--accent`, `--accent-fill` and `--mut2`.

**Semantic colours are tuned for their own tinted backgrounds.** A gold chip on
a gold wash, a red button on a red wash: the tint lightens the backdrop and
costs 0.1–0.4 of ratio. The light-theme values of `--acc2`, `--gold`,
`--green`, `--red` and `--pink` were deepened for exactly this, and dark
`--mut` was lifted because it measured 4.36:1 on the green booster card. Do not
lighten them back without re-running the sweep.

**A colour that flips meaning between themes needs a per-theme label.**
`--green` is a light mint in dark and a deep green in light, so `.pcal-wd.on`
carries a near-black label in dark and white in light. Setting one value broke
the other.

Two traps already found and fixed — do not reintroduce:

- White on raw `--acc` in dark measures **4.47:1**, just under AA. Use
  `--accent-fill`.
- A `<button>` inherits the UA's **black** text unless told otherwise. Any
  card-shaped button must set `color:var(--txt)`. `.home-due` shipped at
  1.09:1 in dark for this reason.

**Verify by walking the DOM, not by sampling.** The per-screen probes used
during the redesign checked chosen elements and missed 29 real failures,
including six on frozen screens. The RC1 sweep visits *every* rendered text
node, composites the actual painted backdrop (translucent layers and gradient
stops, stopping at the first opaque one) and reports what fails. Two known
blind spots: gradient-clipped text reports a transparent fill, and an inset
`box-shadow` scrim is invisible to a computed-style walk — check those from
rendered pixels. Never eyeball contrast.

## 2. Elevation

Tinted to the surface, never a coloured glow.

```
--sh-1  resting cards, panels, quiet surfaces
--sh-2  the one hero surface per screen, and primary buttons
--sh-3  hover on an already-elevated element only
```

Elevation replaced borders during the Dashboard pass. **Prefer elevation and
whitespace over a hairline; prefer a hairline over a border; never nest a
bordered card inside a bordered card.**

## 3. Radius

```
--r     16px   legacy base (.card)
--r-md  14px   buttons, tiles, inline controls
--r-lg  16px   panels and grouped surfaces
99px           pills and chips only
```

*(target)* The codebase currently also contains raw `12px` (34×), `10px` (15×),
`9px`, `8px`, `7px`, `22px`. These are pre-existing debt. Each screen pass
migrates the radii it touches onto the three tokens. Do not add new raw radii.

## 4. Type

System stack, weights 400/600/700/800. Fluid sizes via `clamp()` so a 360px
handset and an 820px tablet both read correctly.

| Role | Spec |
|---|---|
| Page H1 (`h1.big`) | `clamp(23px,5.4vw,40px)` / 800 / `-.4px` / 1.15 |
| Card hero title | `clamp(20px,5.2vw,25px)` / 800 / `-.3px` / 1.22 |
| Section H3 | 16–20px / 800 |
| Body | 14.5px / 400 / 1.6 |
| Secondary body | 12.5–13.5px / 400 / 1.5 / `--mut` |
| Eyebrow | `clamp(10.5px,2.9vw,12px)` / 700 / uppercase / `--acc2` |
| Metric number | `clamp(21px,5.4vw,28px)` / 800 |
| Metric label | `clamp(11.5px,3vw,12.5px)` / `--mut` |

**One `<h1>` per view**, always. Where a screen has both an aspirational hero
and a content hero, only one of them is the `h1` — see `rHome`.

## 5. Spacing

Base unit **2px**; the working steps are 4 / 6 / 8 / 10 / 12 / 14 / 16 / 22px.
Grid gap is `12px` (`.grid`). Section rhythm is `22px` between major blocks,
`14–16px` between siblings.

## 6. Motion

One rule: **motion confirms, guides, or celebrates. It never decorates.**

- Press feedback: `scale(.985)` over `.12s`
- Transitions: `.12–.2s`, easing `cubic-bezier(.2,.8,.3,1)`
- View change: existing `fade .35s`

**Infinite animation is banned in product UI.** `.glow-cta` — a spinning conic
gradient plus a pulsing glow — is fully deleted as of the Executive Polish pass,
rules and keyframes. *(target)* `obMicPulse`, `obRings`, `rpGlow`, `rpBar` and
`pulse` survive on screens not yet passed, none with a reduced-motion guard.

A live-state indicator (recording, listening) is the one motivated exception,
and it still needs its guard: the state must stay legible without the motion.

**Reduced motion is handled once, globally.** The sheet ends with a universal
`@media (prefers-reduced-motion:reduce)` rule that forces every animation and
transition to `.01ms !important`. A per-component `animation:none` block adds
nothing and is duplication — eleven were removed in RC1. Write a component-level
rule **only** when it does more than stop motion: suppressing an `:active`
transform, or hiding a decorative element outright.

Verified: with every live-state class forced on across all ten surfaces,
**0** elements have a non-trivial animation or transition under reduce.

### Direction in RTL

Unicode does **not** bidi-mirror `→ ▸ › ⟶ ⇒`. In Arabic and Urdu they point
away from the direction of travel unless mirrored.

- **Glyphs drawn in markup** are mirrored by one shared rule in the
  `html[dir="rtl"]` block. Add new affordances to that selector list; do not
  write a per-component rule.
- **Glyphs inside translated strings** are the translator's job, and the `ar`
  and `ur` files already ship `←` where English ships `→`. Do not also
  CSS-mirror those — it double-flips them.
- **Media-playback glyphs (`▶`) never mirror.** Playback direction is not
  reading direction.

## 7. Iconography

Line icons only, 24×24, `stroke=currentColor`, via `ICON` / `ic(name)`.
`tIc()` strips a leading emoji from a label. `EMOJI_ICON` + `manIconize`
sweep emoji out of strings.

**Emoji are not a UI element.** They survive only inside translated strings
pending an icon mapping. There is no arrow icon in `ICON` — the `→` glyph is the
established affordance for "this row navigates" (`.home-due-go`,
`.rp-entry-go`, `.home-step-go`).

## 8. Surfaces and hierarchy

Per screen: **exactly one `--sh-2` hero surface.** Everything else is `--sh-1`
or flat.

**One `--accent` button per viewport, not per document.** The rule exists to
stop two calls-to-action competing for the same glance; it is about what the
user can see at once, not about a count over the whole scroll.

A long working screen may legitimately carry a second accent button for a
*later phase of the same task*, provided the two can never be on screen
together. Session is the case that forced this wording: "Start the block" and
"Mark session complete" are separated by **1,395–1,550px** across all seven day
types, against an 844px viewport, so they are never co-visible — and demoting
either would leave a phase of the session with no call to action. Verify the
gap by measurement before relying on this; if two accent buttons can appear
together, one of them is wrong.

## 9. Density

Group related numbers into one panel rather than giving each its own bordered
box. Nine metrics became one `.home-dash` panel with uniform `grid-auto-rows:1fr`
rows. Unearned values recede (`opacity:.55`) rather than argue — but only when
some values *are* earned, since a wholly dimmed panel reads as broken.

## 10. Voice

**Never claim more than the data supports.** A label is a claim: "Recommended"
asserts a ranking, "Why this is stronger" asserts an explanation. If the source
does not produce a ranking or an explanation, the label is false however good
it reads. Executive Polish is the worked example — `backend/polish-worker.js`
returns three *different* versions with no score, so the UI says "Executive
version", and its `learn` field says "Key phrase used" because that is exactly
what the prompt asks the model for. Check the producer before naming the thing.


British English, concrete, short sentences, active voice, no hype. Functional
labels, buttons and errors stay plain.

**The one exception** is the "dream" narrative voice — aspirational, second
person, vivid — permitted in onboarding, empty states, feature descriptions,
feedback verdicts and marketing. It belongs to the *empty* state: once a user
has history, show evidence instead of promise. `rHome` implements exactly this
split.

Emotional copy in the 15 translations is machine transcreation and still wants
native review (especially bn, ur, hi, ja, ko, ar).

## 11. i18n contract

`I18N_EN` in `index.html` is the master. `t(key, vars)` →
`DICT[key] ?? I18N_EN[key] ?? key`. RTL for `ar`, `ur`.

**Parity is 1112 keys across `I18N_EN` and all 15 `i18n/*.json`.** Verified
2026-08-02. Adding a visible English string without a key is a defect.

When adding a key: append it to `I18N_EN`, then insert into all 15 files
**as a text edit before the closing brace** — never by re-serialising the JSON,
which reformats 2,200 lines per file and makes the change unreviewable.

Changing the *English text* behind an existing key leaves 15 stale translations.
Say so when you do it.
