# BE Mastery — shared design system for General English and Welding

Status, 2026-09-24: **Phase 1 implemented** on branch `feature/ds-phase1` (shared shell + Signal and Forge token themes, both tracks). Phases 2–6 are specification only. The General English proof of concept that preceded it (`feature/ai-design-system`) is described in `DESIGN_SYSTEM_AI.md`. This document extends
`DESIGN_SYSTEM.md`, and every binding contract there still holds:
`--accent-fill`, `--accent-text`, `--mut2` is never used for text, and
theme-flipping tokens and contrast are measured by walking the DOM.

```
                    BE MASTERY
                        │
           SHARED FUTURISTIC SHELL (this document)
                        │
          ┌─────────────┴─────────────┐
   GENERAL ENGLISH                  WELDING
   theme: "Signal"                  theme: "Forge"
   V2 missions (GE speaking flow)   12-stage Professional Journey
   Shadow                           Technical Shadow (workplace lines)
   Practice Partner                 Workshop simulations + AI mentor
   Interviews / roleplay            Welding interview
   Universal Speaking Coach         Welding feedback (answer analysis)
          └─────────────┬─────────────┘
                 SHARED DESIGN SYSTEM
```

**V2 missions are the General English speaking experience** (Mission → Hear → Notice → Speak → Coach → Retry → Transfer → Evidence → Complete), shipped to production in be12-v455. Note for the owner: `main` since `bb5cec9` (2026-09-24 01:56, "hide the V2 missions") gates them behind `missionsOn()` (`localStorage.be_missions="1"`), and that gate is live in be12-v472. The design system neither changes nor depends on that gate.

---

## 1. Shared design-system specification

### 1.1 How it is built
- **One shell.** `index.html` keeps a single CSS system. The shell
  (structure, depth, type, shape, motion, states) is written **once**, only
  in tokens.
- **Track themes are token swaps, never forks.** `data-track` on `<html>`
  (already set by `applyTrackIdentity()`) selects a theme block that
  redefines colour tokens only. No component selector may mention a track
  unless it is a track-specific component (§5).
- **Theme contract.** Every theme must define the full token set below.
  Every theme must pass the `DESIGN_SYSTEM.md` contrast sweep in both light
  and dark before it ships.

### 1.2 Tokens every theme defines
| Group | Tokens |
|---|---|
| Page | `--bg`, `--bg2`, `--field-1/2/3` (the three static light fields) |
| Surfaces | `--card`, `--card2`, `--line`, `--line2`, `--hair` (top highlight) |
| Text | `--txt`, `--mut`, `--mut2` (never text) |
| Action | `--accent`, `--accent-fill`, `--accent-text`, `--on-accent`, `--cta-grad` (fill with a label, ≥4.5:1 at every stop) |
| Light | `--live` (listening / recording light), `--ai` (AI-working accent), `--grad-text` (headline accent only) |
| Semantic | `--green` (earned), `--gold` (caution / streak), `--red` (error / destructive) |
| Elevation | `--sh-1/2/3`, tinted to the surface |

### 1.3 The two themes
| Token | General English — "Signal" | Welding — "Forge" |
|---|---|---|
| `--bg` | `#080b16` deep indigo-black | `#090c14` steel-black |
| `--field-*` | indigo / cyan / violet | amber ember / steel blue / faint copper |
| `--accent` | `#6366f1` indigo | `#d49717` amber (existing) |
| `--cta-grad` | `#4f46e5 → #2563eb`, white label (6.29 / 5.17:1), both themes | dark: `#c98a0d → #e2af2f`, **dark** label `#1b1202` (6.28 / 9.18:1); light: `#7a4a00 → #9a6300` with Welding-light's existing **white** label (7.48 / 5.05:1) |
| `--live` | cyan `#22d3ee` | arc-blue `#7dd3fc`: the colour of a welding arc, and it stays distinct from the amber accent |
| `--ai` | violet `#a855f7` | amber-white `#f6c453` |
| `--grad-text` | indigo → cyan → violet | amber → white-gold |
| Character | intelligent, luminous, calm | industrial, precise, warm metal |

The Welding values reuse the existing Welding tokens wherever they exist. The
redesign deepens Welding's surfaces; it does not recolour them.

### 1.4 Shared foundations (identical in both themes)
- **Type:** Outfit 400–800. `h1.big` is 800 with −0.025em tracking. Eyebrows
  are 11–12px, 800, uppercase, 0.14em tracking. Body is 14–15.5px with
  1.55–1.65 line height. Timers and numbers use JetBrains Mono.
- **Shape:** radii of 12 (control), 18 (card), 24 (sheet) and pill. At most
  one level of card nesting; use a bordered block inside a card.
- **Surfaces:** a two-stop 162° card gradient, a 1px top highlight
  (`--hair`), and `--sh-1` at rest.
- **Buttons:**
  - primary: `--cta-grad`, label `--on-accent`, press scales to 0.98;
  - secondary: `btn-g`;
  - text link: `--accent-text`;
  - minimum target 40px, 44px for record and CTA controls;
  - **one primary per viewport.**
- **Navigation:** the top bar and the bottom nav keep their structure. No
  blur on touch devices (an existing performance rule). A sticky action dock,
  when a screen has one, sits above the bottom nav.
- **Icons:** the existing line-icon set (`ICON` / `ic()`: 24px grid, stroke
  1.8, `currentColor`). No emoji in chrome (`EMOJI_ICON` sweep). One icon
  family for both tracks; tracks differ by content, not glyph style.
- **Progress:** bars and strips use `transform: scaleX`, never `width`. A
  fill animates once when its state changes.
- **Audio and voice:** one shared behaviour. While recording, the mic turns
  "live". A ring follows the learner's real voice level (`--lvl`, from a
  read-only analyser on the take's stream) on top of the fallback pulse.
  A five-bar meter may sit beside the timer. Colour comes from `--live`.
- **AI states:**
  - working: orb, rotating conic edge in `--ai`, scan line, `role=status`;
  - coaching moment: sections enter in reading order, once per new result;
  - success: `--grad-text` on the state name plus one soft burst, only when
    the track's own engine reports a real achievement.
- **Loading:** skeletons for content, and the AI-working state for analysis.
  No spinner-only screens.
- **Error:** `--red` text or border with a plain sentence and a retry. Never
  animated.
- **Warning:** a `--gold` note block.
- **Success:** `--green` check with text. Colour is never the only signal.

## 2. General English visual application map
| Surface | Shell components applied | Stays GE-specific |
|---|---|---|
| Home | depth, cards, primary CTA, entrance on first paint | V2 mission card, Practice Partner card, programme card |
| Session (classic) | cards, live mic ring, AI-working state on the Polish wait | Executive Polish report content |
| V2 mission (GE speaking flow) | stage strip, action dock, speak state, AI working, coaching moment, success | mission stages, evidence chips, the recommend()-driven next step |
| Universal Speaking Coach (PP review, mission, roleplay) | coach cards, Hear / Slow / Say it controls, folds, entrance | the coaching hierarchy and its rubric content |
| Practice Partner | cards, live states for live calls, presence dot | matching, rounds, reviews, safety, history |
| Shadow Studio | live mic ring, AI working for the report, success on a passed rung | Watch / Shadow / Challenge modes, translation, IPA |
| Phrase Lab / Executive Polish | AI working, coaching moment | the five-station report |
| Interviews / roleplay | speak state, AI working, coach cards | scenarios, characters, talking points, points score |
| Progress / Profile | progress fills, cards | Speaking History, calendar, evidence panels |

## 3. Welding visual application map
| Surface | Shell components applied | Stays Welding-specific |
|---|---|---|
| Home | depth (Forge fields), cards, amber CTA with a dark label | trade-aware journey card, track chip naming the trade |
| Professional Journey (12 stages) | progress fills per stage, card surfaces, entrance | stage names and themes, the trade variants (welder, pipefitter, boilermaker), stage gating |
| Session (Welding day) | cards, live mic ring in `--live` arc-blue | tap-to-start / tap-to-finish turns (no quiet auto-stop), Welding templates |
| Technical Shadow | live mic ring, AI working, success on a line | workplace lines (`shWorkplaceLinesHTML`), technical vocabulary |
| Workshop simulation | stage surface (`.sim-stage` keeps its amber border), speak state, AI working while answers are analysed, coaching moment on the debrief | characters, briefing, questions, regulatory codes by trade and jurisdiction, "Assessed against …", disclaimers |
| AI mentor / spoken feedback | AI working, the audio visual for "Hear the feedback" (same meter language, `--ai` colour) | mentor voice and persona, per-question feedback |
| Welding interview | speak state, coaching moment, score hero with the shared progress fill | welding rubric, question-by-question analysis, next workshop |
| Career Centre / Skills Passport | cards, progress fills, success on a new badge | employer-facing content, passport evidence |

## 4. Shared components (one implementation, themed by tokens)
Application shell and nav · page depth · card and nested block · primary,
secondary and text buttons · action dock · stage and progress strip ·
progress bar and score hero fill · chips (state, evidence) · fold / details ·
mic button with live ring · voice meter · AI-working block · coaching-moment
entrance · success burst · toast (drops from the top when a dock is present) ·
sheet / dialog · skeleton · error, warning and success notes · Hear / Slow
audio controls · empty state.

## 5. Track-specific components (styled by the shell, owned by the track)
- **General English:** mission stage content and evidence chips; the
  Universal Speaking Coach report sections; Practice Partner cards (match,
  presence, rounds, review, history); Shadow Challenge ladder; Executive
  Polish stations; the V2 recommendation line.
- **Welding:** Professional Journey stage cards (trade-aware); workplace-line
  list; simulation stage, character and briefing; regulatory "Assessed
  against" block; per-question answer card with spoken mentor feedback; score
  hero with repeat and next-workshop logic; Career Centre and Passport
  panels.

## 6. Track-specific UX that must NOT be shared
Welding must never receive: V2 missions, Practice Partner (matching, rounds,
live calls, reviews), the General English Universal Speaking Coach behaviour
or hierarchy, General English partner matching, curriculum structure,
competency names or progression logic, or General English day routing
(`rSessionV2`).

General English must never receive: the Welding 12-stage journey, trade
variants, regulatory or code content, workshop simulations, Welding rubrics or
Welding evidence.

**Enforcement:** the existing gates stay the only gates: `isGeneralEnglish()`,
`isProfessionalJourney()`, `ppAvailable()`, `mvPack()`. The design system
adds no track logic. A shared component may only change colour through
tokens.

## 7. Animation and motion rules
1. Motion is information: state, progress, attention, cause and effect,
   completion. Never decoration.
2. **Curves:** entrances use `cubic-bezier(.16,.84,.44,1)`, state changes use
   `(.4,0,.2,1)`.
3. **Durations:** press .18s, state .35s, entrance .6s, stagger 70ms.
4. Entrances play once per state change, never on a redraw (`.mv-fresh`
   pattern: key the state, compare, add the class).
5. Continuous motion is allowed only while something is actually happening:
   recording, AI working, a live call. It stops the moment that ends.
6. Page light fields are static.
7. Animate only `transform` and `opacity`. A box-shadow halo may animate on
   one small element (the mic).
8. No particles, no looping glows, no bounce, no gamified confetti. The
   success moment is one burst, once.

## 8. Mobile rules
- Design at 375×812, 390×844 and 430×932 first; desktop scales up (max
  content width as today).
- The primary action is visible without scrolling at every step, in the
  dock above the bottom nav where a flow has one.
- Floating layers (sign-in nudge, road-map notice) never cover the dock.
  Toasts drop from the top when a dock is present.
- Touch targets are at least 40px (44px for record and CTA). No hover-only
  affordances.
- Nothing may cause a horizontal scroll. Test each screen at 375px.
- Recording screens: nothing moves near the mic except the voice ring and
  meter.

## 9. Accessibility and reduced motion
- WCAG AA per `DESIGN_SYSTEM.md`: 4.5:1 body, 3:1 large. Every theme is
  swept in light and dark. Welding keeps a dark label on amber.
- `prefers-reduced-motion`: all animation and transitions off. Rings and the
  meter freeze at their resting state; the text states ("Listening…",
  "Reading your answer…") remain.
- AI working blocks are `role=status` / `aria-live=polite`. Rings and meters
  are `aria-hidden`.
- Colour is never the only carrier of state, success or error.
- Focus rings use `--focus` in both themes. Gradient text is headline-only,
  and is checked from rendered pixels because the DOM sweep cannot see it.

## 10. Migration plan from the current UI
| Phase | Work | Tracks | Exit test |
|---|---|---|---|
| 0 | **Done:** GE proof of concept (`6197fb5`) | GE | owner review on the test link |
| 1 | **Done on `feature/ds-phase1`** — see §11 | both | see §11 |
| 1 | Refactor the proof into the shell/theme split: move every `:root:not([data-track="welding"])` rule into shell rules that read tokens; add the §1.2 tokens to `:root` (Signal) and `[data-track="welding"]` (Forge) | both | contrast sweep in both themes × both tracks; pixel diff shows Welding unchanged except depth |
| 2 | Shell components: cards, buttons, nav, dock, chips, folds, toast, notes | both | smoke + all suites; 375/390/430/desktop screenshots per track |
| 3 | Voice and AI states on every recorder and analysis wait: Session, Shadow, Polish, simulations, mentor feedback, PP live | both | live-level probe per track; Welding tap-to-finish behaviour unchanged |
| 4 | Track surfaces: GE coach, PP, Shadow; Welding journey, simulation, interview, passport | per track | the track's own suites (V2 and PP for GE; simulation, journey and competency for Welding) |
| 5 | Light theme depth, icon audit, legacy inline-style cleanup | both | contrast sweep; no inline colour literals left in touched screens |
| 6 | Help-centre screenshots, store art, flyer alignment | both | manual review |

Each phase is its own branch and its own deploy. No phase changes a learning
engine, rubric, gate, analytics event or data model.

**Risks to manage:**
- Welding currently inherits the base component styles. Phase 1 must prove,
  with a Welding pixel diff, that only the intended depth changes land.
- Other sessions deploy to `main` in parallel: rebase each phase onto current
  `main` and bump the version past whatever is live.
- While `bb5cec9`'s gate is on, reviewing the V2 mission needs
  `localStorage.be_missions="1"` (the test link's `ds-test.html` sets it).

## 11. Phase 1 — what exists now (`feature/ds-phase1`)
- **Shell** (one CSS block at the end of the main `<style>` in `index.html`, "BE MASTERY SHARED SHELL"): shell tokens (motion, radii, recording red); page depth from `--field-1/2/3`; the card surface with `--hair`; primary button on `--cta-grad` with the theme's `--on-accent` label and a press state; eyebrow and headline tracking; bottom-nav elevation; progress strip fill; voice (any `.rec-btn.recording`: a ring in `--live` following `--lvl`; the mission's speak card, rings and meter); AI working (`.ai-think`, `--orb`, `--ai-grad`, scan); coaching-moment entrance; success; reduced motion. Every component rule reads tokens only — no track selectors.
- **Themes**: `SIGNAL` = `:root:not([data-track="welding"])` (dark and light), `FORGE` = `:root[data-track="welding"]` (dark and light), selected by the `data-track` attribute `applyTrackIdentity()` already sets. Token-only blocks.
- **JS**: one change — `dsLevelStart()` now runs for every track (it was General-English-only in the proof of concept). It is read-only on the take's stream and writes only `--lvl`.
- **Contrast** (measured): Signal CTA white 6.29 / 5.17:1; Forge dark CTA label `#1b1202` 6.28 / 9.18:1; Forge light keeps its white label on `#7a4a00 → #9a6300` 7.48 / 5.05:1 (the bright amber would have been 2.02:1); arc-blue 11.72:1, amber-white 12.04:1 on the Forge background.
