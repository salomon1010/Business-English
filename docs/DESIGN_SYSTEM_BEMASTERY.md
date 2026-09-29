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
| 2 | **Done on `feature/ds-phase2-components`** — see §12 | both | see §12 |
| 3 | **Done on `feature/ds-phase3-voice-ai`** — see §13 | both | see §13 |
| 4 | **Done on `feature/ds-phase4-track-surfaces`** — see §14 | per track | see §14 |
| 5 | **Done on `feature/ds-phase5-polish`** — see §15 | both | see §15 |
| 6 | **Done on `feature/ds-phase6-assets`** — see §17 | both | see §17 |
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
- **Physical-device verification (2026-09-24): PASSED**, performed by the owner on a real iPhone through the Phase 1 test link, on General English and Welding: recording state, voice ring responding to speech, stop and playback intact, no microphone errors, no audio corruption or unexpected delay, no overlap with the bottom navigation or action bar, keyboard open/close.
- **Automated gate:** `tests/ds-phase1.mjs` (themes and track isolation, 375/390/430/1280 layout, reduced motion, live level and recording/playback on both tracks, emulated keyboard, V2 hidden by default) and `tests/contrast-sweep.mjs` (run it against `main` too: Phase 1 must introduce no failure; the remaining ones are the documented baseline — mostly `--mut2` used as text).

## 12. Phase 2 — shared production components (`feature/ds-phase2-components`)
One implementation per component, themed only by tokens. The existing class names ARE the components, so both tracks inherit them with markup and behaviour unchanged; the new state components are rendered only through `DS` (script, beside the Phase 1 hooks).

| Component | Implementation | General English proof | Welding proof |
|---|---|---|---|
| App shell / header / back | `nav`, `h1.big`, `.back` (accent-text pill, 36px) | every screen | every screen |
| Navigation | `.bnav-item.on .ic` accent pill | bottom bar | bottom bar |
| Buttons | `.btn-primary` (CTA gradient, theme label) · `.btn-g` · `.btn-outline` · `.btn-sm` · disabled | Home, Session, mission dock | Home, Session, Journey |
| Cards / rows | `.card`, `.card[onclick]`, `button.card`, `.pf-row` press + hover | Home, Practice, Profile | Home, Practice, Profile |
| Progress | `DS.progress()` → `.ds-progress` (role=progressbar, `--p`, scaleX) · stage strip (Phase 1) | gallery; mission strip | gallery |
| Expandable | `details.mv-fold / .home-more / .fb-sec` — 44px summary, focus ring | session plan, report folds | session plan |
| Sheet / modal | `askConfirm` → `.cf-ov` / `.cf-card`: bottom sheet ≤560px, centred above | every confirm | every confirm |
| Empty · loading · error · warning · success | `DS.state(kind,{title,body,action})` → `.ds-state` (alert / status roles); `DS.skel(n)` → `.ds-skel`; `.pg-empty` restyled | Speaking History empty state | gallery (same component) |
| Audio controls | `.pp-rv-hear`, `.sim-fb-play`, `.ds-audio` — one pill | coach Hear / Slow | simulation "Hear the feedback" |
| Recording control | `.rec-btn` idle (CTA gradient) · recording (Phase 1 ring) · disabled | Session, mission, Shadow | Session, Shadow |
| Voice visualisation | `DS.meter()` → `.ds-meter`, shown beside ANY recorder while it records, driven by `--lvl` | Session + Shadow recorders, mission | Session + Shadow recorders |
| AI working | `DS.ai(title,sub)` (mission coach uses it via `mvThinkHTML`) · Polish wait | mission coach, Phrase Lab | Phrase Lab / session report wait |
| Coaching entry | `DS.entry({title,sub,icon,onclick})` → `.ds-entry`; `.mv-prevlink` shares it | Previous attempts link | gallery (same component) |
| Toast | `.toast` surface | everywhere | everywhere |
| Focus | one `:focus-visible` ring in `--focus` | keyboard Tab | keyboard Tab |

Gate: `tests/ds-phase2.mjs` (both tracks × dark/light × 375/390/430/1280; theme take-up, roles, sheet geometry, keyboard focus, live meter, reduced motion, track switch = theme only).
- **Physical-device verification (2026-09-24): PASSED**, by the owner, on a real iPhone, against a preview of implementation commit `b5575be` — General English / Signal and Welding / Forge, dark and light: Home, Session, recording control, voice meter, buttons, cards, bottom navigation, the confirm dialog as a bottom sheet reaching the bottom edge, expandable sections; no content hidden behind the sheet, recording controls reachable, no horizontal overflow, keyboard not hiding controls, Signal and Forge visibly distinct within one coherent design system.

## 13. Phase 3 — voice and AI states on every recorder and analysis wait (`feature/ds-phase3-voice-ai`)
- **One voice interface, every recorder.** A thin wrapper around `getUserMedia` hands every audio stream to `DS.voice`: one read-only analyser per stream on ONE shared `AudioContext`, the loudest live level written to `--lvl`, the stream dropped the moment its audio tracks end and the context closed when none are left. The stream is returned untouched, so all 13 microphone entry points — the shared Session/Shadow/mission recorder (`recToggle`), simulation, Executive Polish, drills and Foundations (`phRecInto`), Shadow Challenge, Say it, the conversation booster, the Practice Partner recorder and live call, roleplay / professional conversation, onboarding — feed the same level with no recorder, grader, quiet-window or Welding tap-to-finish code changed. Phase 1's `dsLevelStart()` is now an idempotent alias.
- **The voice ring on every recording state:** `.rec-btn.recording`, `.rec-btn.on`, `.pp-rv-rec.rec`, `.pp-recbtn.pp-stop`, `.shv3-rec.on`, `.rp-mic.sim-listening`, `.rp-mic.listening`, `.ex-mic.is-live`, `.ob-mic.listening` — in the theme's listening colour (Signal cyan, Forge arc-blue).
- **One AI state for the waits.** `DS.aiInline(text)` (orb + text, `role=status`) replaces the grading and analysis waits in Shadow Challenge (6), drills, Say it and the Practice Partner recorders (4), the pronunciation check and the conversation evaluation; `DS.ai()` replaces the Practice Partner AI-coach wait. In the Welding workshop simulation and the professional conversation, the mic in its existing `sim-active` state (colleague preparing or speaking) breathes in the theme's AI light (Forge amber-white, Signal violet) — CSS only, no simulation code touched.
- **Reduced motion** stops the AI dot, the breathing and the ring transition.
- **Gate:** `tests/ds-phase3.mjs` (11 checks, both tracks). Scope proof: the only lines removed from main are wait-message markup; no recorder or gate function changed.
- **Physical-device verification (2026-09-24): PASSED**, by the owner, on a real iPhone, against a preview of commit `313b5e7` — the voice ring on the Session recorder and on the Phrase Lab recorder (its own microphone code) following speech in both tracks, playback intact, the AI states (full block, inline status, the simulation mic's colleague-preparing breathing) in Signal and Forge, dark and light.

## 14. Phase 4 — every track surface speaks its own theme (`feature/ds-phase4-track-surfaces`)
Phases 1–3 made the SHARED components theme-driven; Phase 4 removes the colours that pre-dated the themes from the TRACK surfaces, so a Welding screen can no longer show Signal indigo/cyan (and a General English screen no Forge amber).
- **CSS (22 rules):** hard-coded Signal colours replaced by tokens — indigo → `--accent`, light indigo text → a light mix of `--accent`, cyan → `--live` / `--live-rgb`, violet → `--ai`. Signal's tokens carry those exact values, so General English is unchanged in dark; on Welding the same rules resolve to amber / arc-blue / amber-white. Includes the phase chips (dark and light), the Skills Passport score badge, the simulation live panel, the road-map notice, the header timer, the calendar, onboarding / roleplay glows, the sync nudge and Executive Polish cards.
- **Script templates:** the Session waveform (canvas) and its legend chips, the Progress page card, area charts and trend canvas, the Profile record card, the sign-in and dev cards. Canvas and SVG presentation attributes cannot read CSS variables, so `dsTok(name)` / `dsRgba()` / `dsHexA()` read the current theme's token at render time.
- **Left as they are, on purpose:** the logo; the other track's selection card (it IS that track's identity); the shared Help centre (`.manual-doc`, documented contrast history); brand artwork (certificate, share image, onboarding confetti); the categorical language palette; a colour inside one translated string; the no-JS footer; `homePanelDashboard()` (defined but never called).
- **Gate:** `tests/ds-phase4.mjs` — 23 surfaces × dark/light scanned for the other theme's brand colours in text, background, gradient, border, shadow, outline, fill and stroke (0 found), plus the Progress chart drawn in each track's own accent.
- **Contrast (tests/contrast-sweep.mjs, against main `2acb992`):** 0 failures introduced, 17 fixed; the rest is the pre-existing baseline.
- **Physical-device verification (2026-09-24): PASSED**, reported by the owner after testing on a real iPhone against a preview of commit `5cd6eaa`. The checklist sent with the preview covered General English / Signal and Welding / Forge, in dark and light: road-map phase chips; the Session waveform and its legend chips after a recording; the Progress card and charts; the Skills Passport score badge; the simulation live panel; and the Profile record card. On Welding: no Signal indigo or cyan; General English as before.

## 15. Phase 5 — light-theme depth, icon audit, inline-colour clean-up (`feature/ds-phase5-polish`)
- **Tokens.** Tertiary text (`--mut2`) is text, so it now meets AA 4.5:1 on `--card` and `--card2` in all four themes. It was 2.3–3.6:1 before: Signal dark `#6f7596 → #848aa8`, Forge dark `#5c6580 → #848ca4`, both light themes `#98a1b8 → #606880`. It stays a step below `--mut`. Forge light now sets the white label its own comment always promised (`--on-accent:#fff`). It had inherited Forge dark's `#1b1202`, so every Welding-light button on the brand fill or CTA read 2.5–3.1:1. Its `--grad` joins the CTA's deep amber, so white icons on it (the record button, the simulation mic) hold 5:1. The recording gradient's orange end is deepened (`#f97316 → #ea580c`), and the three pre-design-system copies of that gradient (session recorder, roleplay mic, pronunciation mic) now read `--ds-rec`.
- **Light-theme depth.** Several things were drawn white-on-dark and disappeared on a light page. Each now reads a token:
  - the Session waveform (its canvas was always `#0a0e1a`; it is now `--card2`, with a midline from `--txt`) and its legend chips;
  - the Progress grid lines, the empty bars and the pace gauge;
  - the trend-canvas grid.
- **Inline colours.** Every colour literal left in a screen template is now a token:
  - the Home progress ring, which was Signal indigo → cyan on Welding too. A `<stop>` has no box, so the Phase 4 scan could not see it;
  - the rating card icon, the grammar-fix highlight and the finished-programme card;
  - the simulation score ring (`TONE` → `--green / --gold / --red`);
  - the sync and account cards, and the delete-account link (`#fca5a5` → `--red`);
  - the road-map beacon's highlight stop;
  - the "previous take" colour inside `wave.insight_prev`, in English and all 15 translation files;
  - the Welding-only pale-yellow text (`#fcd34d`) in the conversation talking points and the trade vocabulary group, now `--accent-text`.
- **Also fixed:**
  - accent used as text now reads `--accent-text`: the heading emphasis, the mission state and "Say it better";
  - the selected Shadow chip sits on `--accent-fill`;
  - the Shadow hero tag uses a card-tinted pill, and was unreadable in light;
  - the other track's "Select →" is mixed toward `--txt`;
  - the light phase chip is deepened 20%;
  - the phase-tab count is at .9 opacity.
- **Icon audit.** All 70 icon names used exist in `ICON`. The one missing name, `ic("refresh")` on the mission "try the coach again" button, silently drew the help "?" icon; it is now `repeat`. No OS emoji appears in visible text on any reachable screen in either track. The typographic check mark `✓` stays as a text glyph that takes the theme colour.
- **Left as they are, on purpose:**
  - brand artwork: the certificate, share image and reminder-map canvases, and the onboarding confetti;
  - the language badges, a categorical palette;
  - the posture coach overlay, drawn over the camera;
  - the ring light, which is white by definition;
  - the YouTube frame backdrop, the browser `theme-color` and the no-JS footer;
  - the Help centre (`.manual-doc`);
  - locked and future items drawn dimmed on purpose (locked week cards and their day dots, future calendar days, legend chips for phases not yet reached, inactive mission moves). WCAG exempts inactive UI from contrast.
- **Sweep fix.** `color-mix()` computes to `color(srgb r g b / a)`. `tests/contrast-sweep.mjs` read that as "no colour", so every color-mix fill looked transparent. It now parses it, and main was re-measured with the same parser.
- **Contrast against main `2acb992`, same sweep:** 696 → 216 failures, with 481 fixed. One new flag: the white recording dot on Welding light (3.56:1). It is an icon glyph, not text, and meets the 3:1 non-text threshold.
- **Gate:** `tests/ds-phase5.mjs`. It checks:
  - the icon audit (static);
  - `--mut2` on card and `--on-accent` on `--accent-fill` at AA in all four themes;
  - 24 screens × dark and light for inline or SVG colour literals, OS emoji, and gradient stops in the other theme's brand colour.
- **Physical-device verification (2026-09-24): PASSED**, reported by the owner after testing on a real iPhone. The preview served commit `979f545` unchanged, with V2 missions hidden. The checklist the owner set covered the light themes of General English and Welding: Home, the road map, Session, Progress, the recording control and voice meter, cards, charts and waveforms, buttons, and the bottom navigation, plus the Welding simulation controls. It paid particular attention to grey secondary text, the white labels on Welding-light buttons, waveform and chart readability, the progress-ring colours, recording controls, overall contrast, and consistency between the tracks. Dark mode was checked for regressions.

## 16. Product rule — dark by default (owner, 2026-09-24)
BE Mastery is dark by default everywhere. This covers both tracks (Signal and Forge are dark-first themes), every screen, dialogs and sheets, AI and recording states, and future native iOS and Android versions.
- **Where dark applies.** Fresh installs, new devices and a cleared theme preference all start dark. The app never follows the device's light or dark appearance, the time of day or the platform.
- **Light is opt-in.** Light stays available as an intentional choice in Settings → Theme. Once chosen, it is kept (`localStorage.be_theme`).
- **Dark is the canonical identity.** The premium language is designed around it: depth, dark surfaces, luminous accents, controlled gradients, AI and voice states, and subtle motion. Avoid excessive glow, particles or decorative animation. Light is an alternative presentation, not a competing identity.
- **Light-mode identity.** A light surface, a refined dark-blue border, clean typography and a restrained accent. Borders come from tokens: Signal uses its navy family, and Forge uses a darker steel blue that suits it.
- **Verified 2026-09-24** in a browser with the device appearance set to Light, Dark and no preference:
  - a fresh install is dark in all three;
  - an explicit Light choice survives a relaunch, and switching back to Dark sticks;
  - a cleared or unknown preference is dark;
  - the About page with no theme passed is dark.
- **In the code:**
  - start-up uses `be_theme || "dark"`;
  - there is no `prefers-color-scheme` or `matchMedia` theme logic;
  - `flyer.html` defaults to dark;
  - the manifest and the Capacitor background are dark.
- **Phase 5 review.** The owner reviewed the Phase 5 preview (`c71cade`, dark first; Light reached through Settings) on an iPhone and moved on to Phase 6.

## 17. Phase 6 — help-centre screenshots, store art, flyer alignment (`feature/ds-phase6-assets`)
Everything is captured from the current design, dark first (§16), with the neutral demo learner "Alex". It is the app's own render path, with nothing drawn by hand.
- **Light-mode border system (first commit, `e577043`).** The owner's rule: light surface plus a refined dark-blue border. The two light theme blocks set `--line` / `--line2` to Signal navy `rgba(30,45,120,.20/.34)` and Forge steel blue `rgba(24,54,88,.20/.34)`. Every bordered component already reads those two tokens. Dark is unchanged; contrast is identical to Phase 5.
- **Help centre.** A new rig, `scripts/store-art/shoot-manual.mjs`, regenerates the 18 referenced figures (`manual/screenshots/m00…m20`):
  - It reads the General English seed from `shoot.js` and the Welding seed from `shoot-career.js`, so the rigs cannot drift. The career seed predates the area split, so the rig stamps its records as Welding and marks Welding's placement check passed.
  - Phone figures are 390 CSS px at 2×; the desktop navigation and dashboard figures are 1280 at 2×.
  - Single cards (interview coaches, Passport evidence, an interview answer, the speaking report) are element shots.
  - The figures are written as WebP (`cwebp -q 82`). The Help centre loads every figure at once and most learners read it on mobile data. The 18 figures fall from 8.0 MB as PNG to 1.5 MB. A 256-colour PNG was tried and rejected: it bands the dark gradients.
  - All references were moved to `.webp?v=6`: 272 across the 15 manuals, `manual/index.html` and the flyer.
  - `m14`, `m18` and `m19` are referenced nowhere and were left alone.
- **Captions.** Twelve captions described screens that no longer exist: the streak pill, the progress ring on Home, the week cards under the map, the phrase bank under Polish, the share cards on Profile, "5 steps". They were rewritten in English and machine-transcreated into all 15 languages, using each language's own app labels (native review recommended, as for the other transcreated copy). The other four captions (`m09`, `m15`, `m16`, `m20`) still match their images and are unchanged. The body text of the manuals was not revised in this phase and still names some older UI.
- **Share image.** `og.png` is rebuilt by `scripts/make_og.py` from the new phone Home. The script now reads `m09-mobile.webp`.
- **Store art.**
  - `playstore/store-art-2026-09/` holds `phone` (1080×2400), `tablet` (1440×2560) and `iphone-6.9` (1320×2868), seven shots each, from `shoot.js`.
  - Its Progress shots now read the Progress tab, where the week's story, numbers and charts live since v418. Before, they scrolled Profile, which is Settings now.
  - The 2026-08 set stays: it is what the Play listing currently shows. Uploading is manual, in Play Console and App Store Connect.
  - `manifest.json`'s install-prompt screenshots point at the new phone set.
  - `site/img/phone-*.webp` (lomonec.com) were rebuilt from it, as `site/README.md` asks.
- **Flyer / About.**
  - Tokens are aligned with Signal: the same surfaces, the same text greys (AA `--mut2`), and the app's CTA (indigo → blue, white label). It was dark text on the indigo end of the old gradient, under AA.
  - Light mode uses the same dark-blue borders as the app.
  - The hero device frame now shows the phone capture (`m09`) instead of a desktop image.
  - Gallery crops start below the repeated app header.
  - It stays dark by default; its stale "else the OS preference" comment is corrected.
- **Left for the owner:**
  - Every Shadow library figure (`m04`, and the flyer's `m12`) shows YouTube thumbnails, including real presenters' faces. The previous images did the same (Steve Jobs). The repo's rule already keeps these out of store art; whether the public flyer should keep one is the owner's call.
  - The store Home (`01`) and Phrase Lab (`03`) shots are accurate but sparse, because Home is now the programme card only and Phrase Lab shows its empty input before a recording.
  - `marketing/render-flyer.js` (print flyers) still reads the 2026-08 set.

## 18. Mobile Typography & Density (`feature/bemastery-complete-ux-redesign`, 29 Sep 2026)
The measurements and screenshots behind this section are in
`docs/MOBILE_TYPOGRAPHY_DENSITY_AUDIT.md`. The rules apply at ≤820px, the
width where the bottom bar appears. Both tracks share them: the tracks
differ by colour and content, never by type.

### Starting point
Before any change, the text on screen was measured and compared with the
reference app.
- **The type was not oversized.** Most text already matched the reference, and
  much of it was *below* the brief's starting targets. The one real mismatch
  was the bottom bar: its labels were 9.5px against the brief's 12–13px, and
  12px does not fit French or Arabic in a 61px slot.
- **What felt loose was elsewhere:**
  - weight 800 on every secondary heading;
  - 19–26px section headings with 26px above them;
  - bottom-bar icons that dwarfed their labels and grew when selected;
  - a 125px sign-in bar;
  - tall stat tiles.
- **So the scale records the sizes the app already uses correctly.** The
  changes are about weight, spacing and components.

### Type scale (tokens on `:root`)
| Token | Value | Use |
|---|---|---|
| `--fs-display` | clamp(26px, 7vw, 30px) | the one display line / hero figure |
| `--fs-title` | clamp(22px, 5.8vw, 24px) | a screen's `h1.big` |
| `--fs-section` | 17px | a section inside a screen (Practice, Life Simulations, Settings) |
| `--fs-card` | 15.5px | card and row titles |
| `--fs-body` | 15px | primary reading text |
| `--fs-body-2` | 13.5px | secondary text |
| `--fs-meta` | 12px | metadata, stat labels |
| `--fs-label` | 11px | eyebrows, chips |
| `--fs-nav` | 10px | bottom-bar labels (iOS's own tab-bar size; the largest that fits en/fr/ar/de/pt at 375px) |
| `--fs-tab` | 14.5px | segmented controls |
| `--fs-btn` | 15px | buttons (primary 700, outline 14px) |

Home V2 keeps its own sizes, set by the owner on 27–28 Sep. The density
block does not touch them, and `tests/mobile-density.mjs` check 10c guards
this.

### Weights
- **`--fw-strong` 700:** numbers, the selected nav label.
- **`--fw-head` 700:** section and group headings. They were 800.
- **`--fw-mid` 600:** labels.
- **`--fw-body` 400:** reading text.

`h1.big` keeps 800, the brand's display weight. Weight carries rank, so a
smaller heading does not need to be bold to read as a heading.

### Line height
- Reading text keeps 1.45–1.6.
- Labels and metadata use 1.2–1.4.
- Nav labels use 1.2, on one line.

### Spacing
- **Scale:** `--sp-1…6` = 4 / 8 / 12 / 16 / 20 / 24px.
- **Between sections:** `--gap-section` is 20px (was 26px).
- **Card padding:**
  - `.card` stays at 12–14px;
  - calendar cards `.pcal` go from 18/16 to 16/14px;
  - stat tiles go from 13/14px to 8/10px, with a minimum height of 62px
    (was 78px).
- **Screen gutter:** 16–20px, unchanged.

### Components
- **Bottom bar:**
  - icons 22px (were 25px);
  - labels 10px;
  - item minimum height 48px (was 52px);
  - bar height 59px + safe area (was 67px).
  - The selected item is marked by colour, a 700 label and its icon pill. It
    no longer grows (the `scale(1.12)` is removed).
- **Tabs:** 14.5px/700. The selected state is its fill, not its size.
- **Buttons:**
  - primary 15px/700, height at least 44px;
  - outline 14px with 10/16px padding.
  - Touch targets are never below 44px, except the sign-in bar's secondary
    button at 40px, the design system's floor for non-primary controls.
- **Stat tiles:** the number is 20–24px/800, the label 12px in `--mut`. The
  number is what the eye lands on.
- **Sign-in bar:** 10/12px padding, a 12.5px two-line message, a 40px button
  sized to its label. It went from 125px to 73px at 375px in English. French
  wraps to 107px, which is its text, not its chrome.
- **Practice › best tool:** on phones (≤480px) the "Recommended" chip sits
  under the row's text instead of taking a third of its width.
- **Icons:**
  - an icon beside text is at most the text's visual weight;
  - stat icons are 18px, nav icons 22px;
  - a row icon's tile stays 34px.

### Accessibility
- Contrast is unchanged. Only size, weight and spacing moved, and the colour
  tokens did not.
- Nothing is below 10px except the ≤340px bottom-bar fallback (9px), which
  was already there.
- Text still follows the system text size. There is no `maximum-scale` lock,
  and no fixed heights on anything that holds text.
- Arabic and Urdu mirror, and the year grid opens on the current month in
  right-to-left languages too (`calScrollYearRight`).

## 19. Visual identity v2 (`feature/visual-identity-phase2`, 29 Sep 2026)

The brief asked for the whole visual language to be evaluated as one system.
The owner's TubeShed screenshots were the benchmark for polish and density,
not a template to copy. §18 already handled size and density. This pass covers
the brand, Premium, icons, colour roles and the shared components. It is one
CSS layer at the end of the sheet ("VISUAL IDENTITY v2"), plus four assets.
Nothing is forked per screen or per track.

### 19.1 Audit: what was wrong
| Area | Finding |
|---|---|
| Logo | The mark (bubble + three bars) was sound. The asset was not: `logo.svg` drew the tile inside a navy square, so the 46px header image showed a ~38px tile. A glowing ring appeared on Home. The gold corner spark is 2px of noise below 32px. |
| Wordmark | "Mastery" used `--grad`, whose cyan end is the weakest part on dark. |
| Header | 62px tall with a 46px mark and a two-line lockup. That is heavier than the page content under it. |
| Premium | The owner's raster crown hexagon (192px PNG). It is detailed and glossy, turns in 3D every 8s, and does not belong to the line-icon family. It is not BE Mastery-specific: any app can have a crown. |
| Nav icons | Six icons in one stroke weight, but not one language. Shadow was a target, which reads as "goals". Practice was a cog with a tick, which reads as "settings". Road map was a folded paper map. |
| Colour | The hues were fine; their jobs were not. Cyan (`--acc2`) was eyebrow, link, figure and "listening" all at once. Gold was the hero label, streak, caution and the logo spark. |
| Surfaces | Practice › best tool put floating cards inside a card. |
| Controls | On/off settings were bare checkboxes. Fields had 10px corners, buttons 11–12px, cards 18px: three radii where two would do. |
| Avatars | The profile initial was a rounded square, the same shape as feature tiles; channels on Shadow were circles. |

### 19.2 Brand
- **Mark:** the same speech bubble with three rising bars ("your voice, getting
  stronger"), redrawn on a 64-unit grid.
  - The tile is full-bleed with a 23% radius and the brand gradient
    (`#6366f1 → #3b82f6 → #22d3ee`).
  - The bubble is white; the bars are deep indigo.
  - The gold spark moved to the Premium mark. Gold now means Premium, and
    the mark stays legible at 16px.
- **Files:** `logo.svg` (mark), `icon-192.png` / `icon-512.png` (mark on
  transparency), `icon-maskable-512.png` and `apple-touch-icon.png` (full-bleed,
  from `brand/app-icon-full-bleed.svg`, glyph inside the maskable safe circle).
  The old `apple-touch-icon` was the navy-framed PNG, so iOS showed a navy ring.
- **Lockup:** a 34px mark, then "BE Mastery" at 17px/700 (`letter-spacing
  -.25px`). "Mastery" is set in `--grad-text` (indigo→cyan on Signal,
  amber on Forge), so the wordmark follows the track. The "Home" caption stays
  because the lockup is the Home control (1ddb157a); it lights as a pill, and
  the logo ring is gone.
- **Header:** 56px on phones (was 62).
- **Not changed:** the native Android (TWA) and iOS shells keep their launcher
  icons until their next build. The web app, installed PWAs and the About page
  (`flyer.html`) now use the new mark.

### 19.3 Premium
- **Mark (`premium-mark.svg`, `premMark()` inline):** a sapphire gem.
  - A rounded hexagon, which keeps the owner's blue-hexagon choice.
  - The brand's three bars are cut into it in white.
  - The gold spark sits on its upper facet.
  - Read it as: the same voice, with more behind it.
  - It works from 46px down to 14px.
- **Line variant (`ic("premium")`):** a hexagon with three strokes, for list
  rows (Profile › Premium).
- **Tokens:** `--prem-grad`, `--prem`, `--prem-line`, `--prem-bg` and
  `--prem-spark`. They are the same in both tracks, so Premium reads the same
  on Forge's amber as on Signal's indigo.
- **Uses:**
  - the header button (32px, a glint every 8s, no 3D turn);
  - the plans sheet's "Premium" tag;
  - the "Your record" lock chip (`.chip.prem`);
  - the Profile row.
- **Billing is untouched:** `billing_enabled` stays off, and the badge still
  shows only where `hdrPremSync()` allows.

### 19.4 Icon system
- **Grid and stroke:** a 24px grid with a 1.8 stroke, round caps and joins,
  and no fills except a play triangle's outline.
- **Sizes:** 22px in the bottom bar, 18px in desktop tabs, 20px in a 36px
  row tile.
- **Navigation set:** one metaphor per destination.

| Tab | Icon (`ICON` key) | Why |
|---|---|---|
| Road map | `route`: two pins and a winding road | The Road map *is* a serpentine road |
| Shadow | `shadowing`: a play circle and its offset shadow | Watch, then follow |
| Phrase Lab | `phrase`: the brand's bubble with two lines | Words you will say |
| Practice | `speak`: a microphone | The tab is where you speak |
| Progress | `progress`: three rising bars | The same bars as the mark |
| Profile | `person` | |

- **Selected state:** a 52×30px tinted pill behind the icon
  (`--nav-on-bg`), the accent colour and a 700 label. The icon never grows.
- **Feature rows:** Practice › best tool uses the same icons as the tabs they
  open (`shadowing`, `phrase`).

### 19.5 Colour roles
The palettes in §1 stay; what changes is that each colour has one job. The
role tokens are `--text-1/2/3`, `--surface-0/1/2`, `--success`, `--warning`,
`--danger`, `--rec`, `--nav-on` and `--nav-on-bg`.
| Colour | Job |
|---|---|
| Accent (indigo / amber) | Action, "you are here", selected state, eyebrows |
| `--live` (cyan / arc blue) | Listening and recording only |
| `--ai` (violet / amber-white) | AI at work |
| Gold | Premium's spark, a streak, a caution |
| Green | Earned, done, recommended |
| Red → orange (`--rec`) | Recording, the same in both tracks |
- **Eyebrows:** these move from `--acc2` (cyan) to `--accent-text` (11px/700,
  `.09em` tracking). The Home hero's gold eyebrow stays by owner decision
  (27 Sep).
- **Other uses of `--acc2`:** the 70-odd links and figures that use it keep
  it for now. They are the next colour pass, not this one.

### 19.6 Type
- **Family:** Outfit stays. It is geometric, distinctive and already the brand.
- **Weights:** 700 for headings, 600 for labels. The §18 sizes are unchanged.
- **Tracking:** `-.01em` on headings.
- **Numbers:** stats, the calendar title and the timer use tabular figures.

### 19.7 Shape, surfaces, controls
- **Radius:** 8 / 10 / 12 / 16 / 20px (`--vi-r-*`).
  - Cards are 16px.
  - Fields, buttons and grouped lists are 12px.
  - Row tiles are 10px.
  - Sheets are 20px.
  - Chips are pills.
- **Cards:** a card holds rows, never more floating cards. `.card .card`
  loses its shadow. Practice › best tool is now one grouped list with dividers;
  the recommended row has a 3px accent edge, mirrored in right-to-left.
- **Shape rule:** circles are people (avatars, channels, partners); rounded
  squares are the brand and features. The profile avatar is now a circle.
- **Primary button:** a top highlight plus a soft shadow tinted by the theme,
  no black drop.
- **Outline button:** a 1px accent border and a 6% accent wash.
- **Fields:** 12px corners and a 3px accent focus ring. The ring has zero
  specificity, so composed fields (the Shadow search, Executive Polish) keep
  their own styling.
- **Switches:** on/off settings (daily reminder, online alerts, nudges) are
  44×26px switches with `role="switch"`. Consent boxes stay checkboxes,
  because you tick a statement; you don't flip it.

### 19.8 The 40 items in the brief
- **Changed in this pass:**
  - 1–4: logo, app icon, Premium mark, header;
  - 5–11: nav icons (Home is the mark);
  - 13–14: chips, including the Premium chip;
  - 16–18: buttons and cards;
  - 19: grouped rows;
  - 20–22: inputs, the search focus ring and toggles;
  - 23–24: navigation and avatars;
  - 33: Premium surfaces;
  - 34–39: type, colour roles, borders, shadows and radius;
  - 40: motion, where the badge glint replaces the turn.
- **Covered by tokens, not redrawn:**
  - 12: the rest of the `ICON` set, already one family (1.8 stroke, round
    joins);
  - 15: status indicators;
  - 25: illustrations;
  - 26: thumbnails, which already have rounded corners and a tabular duration
    tag;
  - 27–28: AI and recording visuals (Phases 3–4);
  - 29: progress visuals;
  - 30–32: empty, loading and error states (`DS.state` / `DS.skel`,
    Phase 2).
  - These already read the theme tokens, so the new roles reach them.
- **Left for the owner:**
  - the native shells' launcher icons (the next TWA and iOS builds);
  - store art and `og.png`, which still show the old mark and header;
  - the remaining `--acc2` links and figures;
  - whether the Welding header's "International Welder" chip should shrink
    to match the new lockup.

### 19.9 Gate
`tests/visual-identity.mjs`: brand assets, icon set, Premium mark, header and
nav geometry, grouped list, switches and the field focus ring, in dark and
light, English and Arabic.
