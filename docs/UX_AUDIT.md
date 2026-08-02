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

## Screen 2 — Session ✅ complete

### Findings (before)

| # | Problem | Why it mattered |
|---|---|---|
| S1 | Opened on the **plan** tab. The tab row sat at y=883 — below the fold — so the entire practice half (recorder, transcript, notes, self-score, mark-done) was hidden behind a control the user had to scroll past the fold to discover. | The Dashboard's one primary action led to a checklist, not to practice. |
| S2 | Three competing calls to action above the fold: a `.glow-cta` jump link (infinite animation), a gradient `.btn-p` Start, and the plan. | No single answer to "what do I do now?". |
| S3 | Timer digits were gradient-clipped text measuring **1.81:1** in light — the largest type on the screen failing AA. | Unreadable clock on the screen whose job is the clock. |
| S4 | `.btn-p` mark-done is white on `--grad`; the gradient's cyan end gives ~1.9:1. Ten `.score-b` at 36px. Back link 18px. Start/Reset 38px. Tabs 40px. | Five distinct target/contrast failures. |
| S5 | Template step 5 read "use the recorder below" — the recorder was in the *other tab*. | The instruction was false. |
| S6 | `.step` bordered cards nested inside a bordered `.card`. | Banned by the design system. |

### Measured before → after (W1 Mon, 390×844)

| | before | after |
|---|---|---|
| Taps to reach the recorder | 1 (+ scroll past fold to find the tab) | **0** |
| Recorder position | hidden behind a tab | **y=1117, reachable by scroll** |
| Interactive controls hidden behind a tab | 19 | **0** |
| Visible targets <44px | 5 | **0** |
| Infinite animations | 1 | **0** |
| Contrast failures | 3 | **0** |
| `.btn-p` gradient buttons | 2 | **0** |
| Inline-styled elements | 42 | **18** |
| DOM nodes | 195 | **191** |
| Timer card height | 306px | **196px** |
| Document height | 1804px | 2291px |

Also verified: no horizontal overflow and 0 sub-44px targets at 320/390/430/
768/820/1280px; no clipped text in de, ru, ar or ja; `dir=rtl` applies.

Document height **grew 27%** and that is the intended trade: 19 controls that
were previously rendered `display:none` behind an undiscovered tab are now in
the flow. Total interactive elements fell 31 → 30.

### Decisions worth preserving

- One linear flow: prepare → run the clock → produce evidence → close out.
- The plan is a closed `.home-more` disclosure under the timer — which is what
  "the checklist goes last so practice comes first" always meant.
- The timer card is the hero surface; hint and Reset moved outside it so the
  card carries only the clock and the one action that starts it.
- Digits turn `--accent` while running, so "running" is a visible state.
- Verified across **all seven day types**: 1 `<h1>`, plan closed, recorder
  present, 0 small targets, 0 infinite animations.
- The two accent buttons (Start, Mark complete) are 1,395–1,550px apart and
  never co-visible — this forced the `DESIGN_SYSTEM` §8 wording change from
  "per screen" to "per viewport".

Commit: `479b094` + final-gate follow-up.

---

## Screen 3 — Shadowing Studio ✅ complete

Two surfaces: the picker (`#v-shadow`) and the fullscreen workspace
(`.sh-work`), which opens over it.

### Findings (before)

| # | Problem | Why it mattered |
|---|---|---|
| H1 | The picker rendered all **18** starter clips at once: **7,130px — 8.4 handset screens** of catalogue before anyone recorded anything. | The flagship screen's fastest path to a first recording was buried under a scroll. |
| H2 | All 18 thumbnails loaded immediately with **no `loading="lazy"` and no intrinsic dimensions**. | 18 blocking `i.ytimg.com` requests on entry, and every arrival shifted the layout. |
| H3 | **45 of 47** visible picker controls were under 44px — 4% touch-target coverage. Workspace: 8 of 19. | Unusable on a phone, which is the primary device. |
| H4 | **22 `.btn-p`** gradient buttons on the picker. White on `--grad`'s cyan end (#22d3ee) is ~1.9:1. `.seg-tab.on` has the same defect. | Unreadable labels on the most-tapped controls. |
| H5 | The fullscreen workspace had **no `role="dialog"`, no `aria-modal`, no accessible name and no heading**; Escape did nothing; focus tabbed out into the picker behind it; the picker kept scrolling underneath. | A modal that is not a modal — the core interaction of the flagship feature was unusable by keyboard and screen reader. |
| H6 | **No error state** for a removed / private / embedding-blocked clip. The user got YouTube's own grey box while every control stayed live against a dead player. | `INTERACTION_SPECIFICATION` §6 requires one. |
| H7 | The loop toggle was a filled `--grad` circle — the loudest element in the workspace, outranking every real step. | Hierarchy inverted: a toggle beat the actions. |
| H8 | `.rec-btn.recording` and `.sh-count.over` were the only infinite animations in the app with **no reduced-motion escape**. | Vestibular-safety gap. |

### Measured before → after (390×844)

| | before | after |
|---|---|---|
| Picker scroll | 7,130px (8.4 screens) | **2,379px (2.8)** — −67% |
| Thumbnails without `loading="lazy"` | 18 | **0** |
| Thumbnails without dimensions (CLS) | 18 | **0** |
| Picker targets <44px | 45 of 47 | **0** |
| Workspace targets <44px | 8 of 19 | **0** |
| Touch-target coverage (picker) | 4% | **100%** |
| `.btn-p` gradient buttons | 22 | **0** |
| `.glow-cta` (last in the app) | 1 | **0** |
| Contrast failures | 3 | **0** |
| Picker inline-styled elements | 167 | **59** |
| Dialog semantics | none | role, aria-modal, labelled, `<h2>` |
| Focus escapes in 26 tabs | 1 | **0** |
| Escape closes workspace | no | **yes** |
| Error state | none | `role="alert"`, controls hidden |

Verified: no horizontal overflow and 0 sub-44px targets at 320/390/430/768/
820/1280px; no clipped text in de, ru, ar or ja; `dir=rtl` applies; 0 animating
elements under reduced motion with `.recording` and `.sh-count.over` forced on.

### Decisions worth preserving

- Three starters plus a `.home-more` disclosure. The catalogue is a browse
  surface; the fast path is Resume (now the one `.btn-primary`) or a pasted link.
- Repeated list actions ("Shadow this", "Say it") are secondary by design — an
  accent button per row would be several primaries per viewport.
- The workspace's Listen → Shadow → Record → Compare order was already correct
  in the DOM; what was missing was dialog behaviour and hierarchy, not sequence.

Commit: `0863af7`.

---

## Screen 4 — Speaking Feedback ✅ complete

`fbShowResults()` — one panel rendered into `#fbOut`, shared by Session and the
Shadow workspace.

### Findings (before)

| # | Problem | Why it mattered |
|---|---|---|
| K1 | Everything at once: score, attempts, 3 stat tiles, 25 word chips, every problem word, grammar, vocabulary. **2,206px, 52 visible controls.** | A speech-analysis dashboard, not a coach. The brief asks for the 2–3 highest-impact fixes first. |
| K2 | **42 of 52 controls under 44px** — 19% touch coverage. | Unusable on a phone. |
| K3 | **Zero headings.** Every section title was a `<b>`. | A screen reader got a wall of text with no structure and no way to skip. |
| K4 | The problem words — the actionable part — sat *below* the stat tiles and the 25-chip diff, at y=2,843. | The least useful content outranked the most useful. |
| K5 | No whole-take retry anywhere. Only per-word "Say it". | "Encourage another attempt" had no affordance. |
| K6 | 2 `.btn-p` (white on `--grad`, ~1.9:1) and 1 emoji (📈/📉). | Contrast and iconography defects. |

### Measured before → after (390×844)

| | before | after |
|---|---|---|
| Panel height | 2,206px (2.61 screens) | **1,072px (1.27)** — −51% |
| Visible controls | 52 | **15** — −71% |
| Targets <44px | 42 | **0** |
| Touch coverage | 19% | **100%** |
| Headings | 0 | **1 `<h3>` + 4 `<summary>`** |
| Fixes shown | all | **top 3, worst-first** |
| `.btn-p` | 2 | **0** |
| Emoji | 1 | **0** |
| Inline-styled elements | 57 | **38** |
| Contrast failures | 1 (`.voc-goto` 3.82:1) | **0** |

Verified across four outcomes — perfect (100%, 697px), two problems, seven
problems (3 shown + "Show 4 more"), and nothing heard — at 320/390/430/768/
1280px, in de/ru/ar/ja, both themes, and under reduced motion.

### Decisions worth preserving

- Fixes are ranked worst-first: a word not caught at all outranks one merely
  misheard, and among misheard words the least similar comes first.
- The retry is an **outlined** accent, not a fill: on Session it lands 277px
  below "Mark session complete" and would otherwise put two accent fills in one
  viewport.
- `fbToggle()` cannot serve as the retry — it reads `#shNote` and writes
  `#fbBtn`, which exist only in the Shadow workspace. `fbAgain()` targets
  `#recBtn`, which both surfaces share.

Commit: `20e2477`.

---

## Screen 5 — Executive Polish ✅ complete

The card inside `rPhrases`: `exGo` / `exRenderVersions` / `exRenderOffline`,
backed by the Cloudflare Worker that holds the AI key.

### Findings (before)

| # | Problem | Why it mattered |
|---|---|---|
| E1 | Two versions shown as equals under "EXECUTIVE VERSIONS — **PICK ONE**". | A coach recommends a line; it does not hand over a menu. The brief asks for the recommended phrasing, not a comparison. |
| E2 | `v.learn` was a small unlabelled cyan line. | The one piece of teaching in the result had no weight and no label. |
| E3 | The three EXEC_FRAMES printed under **every** result, and the 4-step "How to build your full speech" list rendered always. | The same reference text repeated on every polish. |
| E4 | **9 of 10 controls under 44px** — including "Polish it" at **31px**, the feature's primary action. 10% touch coverage. | The main action was the smallest target on the card. |
| E5 | `.ex-micbtn` carried two infinite animations (a spinning conic gradient plus a glow) — the last in the app. | Perpetual decoration on an idle button. |
| E6 | "Polish it" was `.btn-p` — white on `--grad`, ~1.9:1 at the cyan end. | Contrast. |
| E7 | Zero headings; 22 inline-styled elements. | No structure for a screen reader. |

### Measured before → after (390×844)

| | before | after |
|---|---|---|
| Card height | 1,255px | **940px** — −25% |
| Result block | 693px | **551px** — −20% |
| Targets <44px | 9 of 10 | **0** |
| Touch coverage | 10% | **100%** |
| Primary action height | 31px | **48px** |
| Infinite animations | 1 (2 rules) | **0** |
| `.btn-p` | 1 | **0** |
| Headings | 0 | **1 + 3 summaries** |
| Inline-styled elements | 22 | **4** |
| Contrast failures | 0 | **0** (16 checks) |

Verified at 320/390/430/768/1280px, in de/ru/ar/ja, both themes, on the offline
fallback path, and under reduced motion with the mic live.

### Decisions worth preserving

- One phrasing is led with, headed **"Executive version"** — reusing the
  existing translated key. It is deliberately *not* called "Recommended":
  `backend/polish-worker.js` asks for "3 DIFFERENT" versions and returns
  `{text, learn}` with **no ranking signal**, so the first item is simply the
  first returned. The interface must not imply certainty the data lacks.
- The `learn` field is labelled **"Key phrase used"**, because that is what the
  Worker prompt asks for — *"the idiom or key phrase used, a few words"* — not
  an explanation of why the rewrite is stronger.
- Further versions sit behind "Another way to say it".
- **Copy leads** the action row — the point of a polished line is to use it in
  the real conversation, so reuse is the action, not an afterthought.
- `ex.more_hint` said "Pick one, or press Polish it again"; the English and all
  15 translations were rewritten, since the old copy contradicted the new design.
- **`.glow-cta` is now deleted.** This screen held its last consumer, so the
  rules and both keyframes went with it, as the roadmap scheduled.

Commit: `a1cd17f`.

---

## Screen 6 — Vocabulary ✅ complete

The My-words half of `#v-practice`: `vocRow` / `vocSave` / `vocBuckets`, plus
the same `vocRow` reused inside the Speaking Feedback panel.

### Findings (before)

| # | Problem | Why it mattered |
|---|---|---|
| V1 | **The brightest control on every row deleted the word.** A filled `--grad` "✓" that reads as confirmation calls `delete S.vocab[w]`. On "My words" *every* row is saved, so the loudest thing on the list was destructive, with `aria-label="Save"` — the opposite of what it does. | The single worst defect found in the project so far: a destructive action disguised as a confirmation, mislabelled for screen readers. |
| V2 | **27 of 42 controls under 44px** — 21 row buttons at 38px, subtabs at 30px, group tabs at 38px. 36% touch coverage. | Unusable on a phone. |
| V3 | **8 `.btn-p`** gradient buttons — white on `--grad`'s cyan end, ~1.9:1. | Contrast. |
| V4 | `vocSave` assigned `textContent = "🔖"` / `"✓"` on toggle, replacing the icon SVG with a raw emoji at runtime. | The one place emoji re-entered the UI after the icon sweep. |
| V5 | `.prac-total` (the collected-words number, 40px — the largest type on the card) was gradient-clipped text at **1.23:1** in dark. `.voc-chev` at 2.95/2.58. `.prac-subtab.on` white on `--grad`. | Three contrast failures. |

### Measured before → after (390×844)

| | before | after |
|---|---|---|
| Targets <44px | 27 of 42 | **0** |
| Touch coverage | 36% | **100%** |
| `.btn-p` gradient buttons | 8 | **0** |
| Contrast failures | 3 | **0** |
| Runtime emoji injection | yes | **none** |
| Row height | 58px | 64px |
| Page height | 1,633px | 1,695px |

Verified at 320/390/430/768/1280px, in de/ru/ar/ja, both themes, under reduced
motion, and through a save→remove→save round trip in **both** contexts the row
is used (My words, and the not-yet-saved rows in Speaking Feedback).

### Decisions worth preserving

- The toggle is a **state, not an action**: quiet green tint when saved, and its
  label says what a tap will do — "Saved — tap to remove" vs "Save to my words",
  with `aria-pressed`. The row is dual-purpose (saved in the list, unsaved in
  feedback), so the fix is to make the *current* meaning legible, not to pick one.
- Row height grew 6px and the page 62px. That is the cost of 44px targets and
  is the right trade on a phone-first product.
- Touch-target floors were raised on the **specific** rules
  (`#v-practice .prac-subtabs .prac-subtab`, `.prac-subgroup .seg-tab`) — a
  generic scoped rule lost to them on specificity and silently did nothing.

Commit: `3fa343e`.

---

## Screens 7–12 — not yet audited

Listed in working order. No findings recorded because none have been measured.

| # | Screen | Renderer | Notes carried forward |
|---|---|---|---|
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
2. **`.glow-cta` is fully deleted** — rules and keyframes. Infinite animations
   remaining, all on unpassed screens and none with a reduced-motion guard:
   `obMicPulse` and `obRings` (Onboarding), `rpGlow` ×2 and `rpBar` (role-play),
   and `pulse` ×4. `htGlow`/`htPulse` (header timer) already have one.
2b. **`.btn-p` and `.seg-tab.on` are white on `--grad`** — ~1.9:1 at the cyan
   end. Fixed on Dashboard, Session and Shadow by scoping; **43 `.btn-p` uses
   and the shared `.seg-tab.on` rule remain** on Practice, Phrases, Profile and
   others. This is the single largest contrast debt in the app.
3. **Radius sprawl.** Raw `12px` (34×), `10px` (15×), `9px`, `8px`, `7px`,
   `22px` alongside the `--r-md`/`--r-lg` tokens. Migrate per pass.
4. **Header streak pill shows a gold flame "0"** on day one — a celebratory
   badge for an achievement not yet earned. One-line fix, but it is shared
   chrome across all 12 screens.
5. **Progress Calendar has no i18n keys.** Fifteen languages see English.
6. **Disclosure chevrons (`▶` in `.hm-chev`) are not mirrored in RTL** either,
   on all four screens that now use `.home-more`.
7. **"Go" arrows are not mirrored in RTL.** `→` (U+2192) is not bidi-mirrored,
   so it points away from the direction of travel in Arabic and Urdu. Fixed for
   `.sess-jump-go`; still wrong on `.home-due-go`, `.home-step-go`,
   `.rp-entry-go`, `.rp-hero-go`, `.rp-ht-go`. One shared rule would fix all
   six, but it would change screens not yet passed.
