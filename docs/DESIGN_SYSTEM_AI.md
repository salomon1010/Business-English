# BE Mastery design system — the AI-native layer (General English proof of concept)

> Superseded as the plan by [`DESIGN_SYSTEM_BEMASTERY.md`](DESIGN_SYSTEM_BEMASTERY.md): the design system is shared by General English **and** Welding (one shell, two token themes). This file documents what the proof of concept on `feature/ai-design-system` implements today; its `:root:not([data-track="welding"])` fences are temporary and are removed in migration phase 1.

An addendum to `DESIGN_SYSTEM.md`. Every binding contract there still holds (`--accent-fill`, `--accent-text`, `--mut2` never for text, theme-flipping tokens, contrast measured by walking the DOM). This layer adds depth, voice and AI states on top of them.

Status: first pass (2026-09-24, branch `feature/ai-design-system`). It is one
CSS block at the end of the main `<style>` in `index.html` ("BE MASTERY DESIGN
SYSTEM") plus four small JS hooks. Visual direction comes from the lomonec.com
site (`site/css/tokens.css`), so the app and the website read as one product.

**Scope:** General English, the default track. Every rule is fenced with
`:root:not([data-track="welding"])`. Welding keeps its amber industrial theme
and its behaviour unchanged.

## Principles
1. **Motion is information.** Something moves only to show state, progress,
   cause and effect, or completion. Nothing loops for decoration.
2. **Light, not paint.** Cyan and violet are used as light: glows, edges,
   gradients on text. Indigo→blue is the one fill for primary actions.
3. **One primary action per screen.** It is always the gradient button.
   Secondary actions are ghost buttons or text links.
4. **Nothing gets in the way of speaking.** The recording state removes
   distractions. It does not add them.
5. **Reduced motion keeps the meaning.** Under `prefers-reduced-motion` all
   animation stops. Colour, text and the static state remain.

## Colour
| Token | Dark (GE) | Use |
|---|---|---|
| `--bg` | `#080b16` | page |
| `--bg2` | `#0b1020` | raised page areas |
| `--card` / `--card2` | `#10162b` / `#151c35` | surfaces, nested surfaces |
| `--line` / `--line2` | white 7.5% / 13% | hairlines, control borders |
| `--txt` / `--mut` / `--mut2` | `#eef1fb` / `#a2a7c4` / `#6f7596` | text, secondary, tertiary |
| `--ds-indigo` `--ds-blue` | `#6366f1` `#3b82f6` | action |
| `--ds-cyan` | `#22d3ee` | listening, live, focus |
| `--ds-violet` | `#a855f7` | AI accent (sparingly) |
| `--green` / `--gold` / `--red` | existing | success / caution / error |

Light theme keeps its existing tokens and gains a faint two-field wash.
Contrast rules from before still hold (`--accent-fill`, `--accent-text`).

## Gradients
- `--ds-grad-cta` (103°, `#4f46e5 → #2563eb`): primary buttons only. White label ≥5.2:1 at both stops, so it honours the `--accent-fill` contract in `DESIGN_SYSTEM.md` (text never sits on a gradient that fails AA).
- `--ds-grad-text` (indigo → cyan → violet): one headline word, or a success
  moment. Never body text.
- `--ds-grad-ai` (conic): the edge of an AI-working surface.
- Page depth: three fixed radial fields (indigo top-left, cyan top-right,
  violet low). They are static because constant motion costs battery and
  attention.

## Typography
Outfit (already loaded). Page title `h1.big` 800, tracking −0.025em. Section
eyebrow 11–12px, 800, uppercase, tracking 0.14em. Body 14–15.5px, line-height
1.55–1.65. Numbers in live timers stay in the mono face (JetBrains Mono).

## Shape and surfaces
Radii: `--ds-r-sm` 12 (buttons, inner blocks), `--ds-r` 18 (cards),
`--ds-r-lg` 24 (sheets), `--ds-pill`. Cards use a 162° two-stop surface
gradient, a 1px top highlight (`--ds-hair`) and `--sh-1`. Avoid more than one
level of nested cards: inside a card, use a bordered block, not another card.

## Buttons
- **Primary:** gradient, white label, a neutral shadow with a faint indigo tint (elevation stays tinted to the surface, not a glow). On press it scales
  to 0.98; on hover (pointer devices only) it lifts 1px.
- **Secondary:** `btn-g`, which is card2 with a line2 border.
- **Text link:** accent-coloured, 700 weight, used inside the action dock.
- Minimum touch target is 40px (existing `.btn` rule).

## Navigation
Top bar and bottom nav keep their structure. The bottom nav sits on a deeper
panel with an upward shadow. Blur stays **off on touch devices**, an existing
performance rule. The mission's sticky action dock sits above the bottom nav.

## Progress
- The stage strip fills from the left when a stage becomes current, once per
  state change (`.mv-fresh`).
- Bars animate with `transform: scaleX`, never with `width` (existing rule).

## Audio and voice
- **Any mic, while recording (GE):** the button turns red→orange and gains a
  cyan ring whose width follows the learner's live voice level (`--lvl`,
  0–1). This sits on top of the existing pulse, so a device without level
  data still pulses.
- **Mission speak card:** the card edge lights cyan, and two rings around the
  mic breathe with the same level. A five-bar meter shows the voice beside the
  timer.
- **Level source:** `dsLevelStart()` creates a read-only analyser on the
  take's own stream. It runs one `requestAnimationFrame` loop, starts from
  `recToggle`, and closes when the take stops. It writes only `--lvl`. It
  never touches the recording or the recognizer.

## AI states
- **Working** (`mvThinkHTML()`, `.ai-think`): a breathing orb, a rotating
  conic edge and a scanning line, with `role="status"` and the existing
  "Reading your answer…" text. The Executive Polish wait uses the same
  palette: gradient bars and a gradient headline.
- **Coaching moment:** the report's sections enter in reading order (12px
  rise and fade, 70ms stagger). They play once per new answer. A redraw
  (for example, a late pronunciation score) never replays them.
- **Success** (`.mv-done.ds-win`): only when the engine's state is
  DEMONSTRATED or higher. The state name gets the gradient and a small scale
  settle, and one soft green burst expands from it. Never on a failed or
  pending attempt.

## Warning, error and loading
Existing semantics are unchanged. Error = `--red` text or border, never
animated. Caution = `--gold` note (`.mv-note`). Loading = the AI working
state above, or the existing skeletons. No spinner-only screens.

## Motion tokens
`--ds-ease-out` `cubic-bezier(.16,.84,.44,1)` for entrances;
`--ds-ease-soft` `(.4,0,.2,1)` for state changes. Durations: `--ds-fast`
.18s (press), `--ds-dur` .35s (state), `--ds-reveal` .6s (entrance).
Nothing loops longer than an AI wait or a live recording lasts.

## Accessibility
- All motion is disabled under `prefers-reduced-motion`.
- AI states are `role="status"` / `aria-live="polite"`.
- The meter and rings are `aria-hidden`; the timer and the "Listening…" text
  carry the state.
- Colour is never the only signal: states keep their text labels.
- Focus rings are unchanged (`--focus`).

## Not yet covered (next passes)
Home and Progress layouts, the Practice Partner and roleplay screens'
entrance motion, iconography refresh, light-theme depth, and a
component-by-component audit of legacy inline styles.
