# IMPLEMENTATION_ROADMAP

> Status: authored 2026-08-02. One screen at a time. **Never start the next
> screen without approval.**

## Per-screen loop

Audit (measured) → name problems and why they matter → propose → check against
`DESIGN_SYSTEM.md` → implement → self-review as if reviewing someone else's PR
→ fix what's still inconsistent → report → **stop and wait**.

Report format: Summary · Files changed · Components changed · Accessibility ·
Performance · Regression risks · Next recommended screen. Nothing else.

## Frozen screens

Dashboard, Session, Shadowing Studio, Speaking Feedback, Executive Polish and
Vocabulary are **frozen**. Do not revisit them unless one of these is true:

1. a **shared component** changes (then update every consumer and re-measure),
2. a **regression** is introduced,
3. a **critical defect** is discovered,
4. the owner **explicitly requests** another pass.

State which of the four applies before touching a frozen screen.

**Overlap warnings.** Vocabulary (frozen) and Practice Hub share `rPractice`.
Frozen there: `vocRow`, `vocSave`, `.voc-*`, the `#v-practice` touch-target
floors and the `.prac-subtab.on` contrast fix. The Practice Hub pass owns the
surrounding structure — Knowledge Boosters, the group tabs, the layout.
Calendar (frozen) lives inside `rProfile`: `calHTML`, `calDayDetailHTML`,
`calLocale`, `calDowInitials` and every `.pcal-*`/`.cal-*` rule are frozen; the
Profile pass owns the header, the menu rows and the account block.

## Ship discipline

**Local-first. Do not `git push` until the user says "deploy".** They test
locally first (`python3 -m http.server 8000`). Local commits are fine; pushing
to `origin/main` is what auto-deploys.

On an approved deploy: JS-parse + i18n validate → bump `sw.js`
`be12-vNN` → commit → push → poll live in a **background** job until the new
version appears (`curl` + grep, 30–60s typical, occasionally 10 min).

A TWA loads the live site, so **web changes ship by push alone** — no Play
upload unless the native shell changes.

Commit trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## Sequence

| # | Screen | Renderer | Status |
|---|---|---|---|
| 1 | **Dashboard** | `rHome` | ✅ `9450bed` |
| 2 | **Session** | `rSession` → `#v-journey` | ✅ `479b094`, `77685e9` |
| 3 | **Shadowing Studio** | `rShadow` / `shOpenWork` | ✅ |
| 4 | **Speaking Feedback** | `fbShowResults` → `#fbOut` | ✅ |
| 5 | **Executive Polish** | `ex*` in `rPhrases` | ✅ `a1cd17f`, truthful-labels follow-up |
| 6 | **Vocabulary** | `vocRow` in `rPractice` | ✅ |
| 7 | **Practice Hub** | `rPractice` shell | ✅ |
| 8 | **Calendar** | `calHTML` in `rProfile` | ✅ |
| 9 | **Profile** | `rProfile` shell | ✅ |
| 10 | Settings | `rData` / `rSetup` | next |
| 11 | Help | `rManual` | pending |
| 12 | Onboarding | `rSetup` | pending |

---

## Screen 1 — Dashboard ✅

CTA 472→**344**px · page 2257→**1856**px · metric panel 825→**487**px ·
sub-44px targets 2→**0** · infinite animations 2→**0** · contrast failures
2→**0**. Full findings in `UX_AUDIT.md`.

Added `.btn-primary`, `.home-week`, `.home-more`, `.home-step`, `.stat-empty`.
Removed `.home-tabs`, `.stat-next`, `.stat-todo`, `homeTab()`.
One new i18n key (`home.week_days`), translated ×15, parity 1112.

---

## Screen 2 — Session ✅

Taps to the recorder 1→**0** · controls hidden behind a tab 19→**0** · visible
targets <44px 5→**0** · infinite animations 1→**0** · contrast failures 3→**0**
· inline styles 42→**18** · DOM 195→**191** · timer card 306→**196**px.
Document height grew 1804→2291px, the intended cost of un-hiding the practice
half. Full findings in `UX_AUDIT.md`.

Removed the plan/do tab entirely (`sessTab`, `_sessTab`, `#sessPlan`,
`#sessDo`). Added `.sess-body`, `.sess-jump`, `.sess-plan`, `.sess-aloud`,
`.sess-heard`, `.sess-reset`, `.sess-act`, `.sess-timer-foot`. No new i18n keys.

`sess.tabs_label` and `sess.tab_practise` are retained but unused.

---

## Screen 3 — Shadowing Studio (next)

Carried forward:
- **`.glow-cta` ×1** — the last one outside Executive Polish.
- The posture button is a byte-identical copy of the 38px `.btn-sm` block fixed
  in Session (~line 4581); fix it here rather than reaching across screens.
- Every dense screen renders third-party YouTube artwork — relevant to store
  art, not to this pass.

---

## Cross-screen work

Each needs a decision, not a per-screen patch. Recommend scheduling 1 and 2
before the passes that would otherwise re-patch them.

| | Item | Recommendation |
|---|---|---|
| 1 | `.help-fab` overlaps interactive content at rest on multiple screens | **Delete it** — Profile → Help already exists, one tap from the bottom nav |
| 2 | `.glow-cta` now live only on Shadow ×1; `.ex-micbtn` shares the infinite conic animation | Remove in the Shadow and Executive Polish passes; delete the keyframes when the last use goes |
| 3 | Radius sprawl — raw 12/10/9/8/7/22px beside `--r-md`/`--r-lg` | Migrate opportunistically, per pass |
| 4 | Header streak pill shows a gold flame **0** on day one | Hide below 1 — one line, but shared chrome, so needs its own commit |
| 5 | Progress Calendar labels hardcoded English, no i18n keys | Fix in the Calendar pass (screen 8) |
| 7 | Five `→` "go" arrows still unmirrored in RTL (Session's is fixed) | One shared `html[dir="rtl"]` rule, once the owning screens are passed |
| 6 | `.btn-p` gradient buttons app-wide | Fold into `.btn-primary` as screens are touched |

## Infrastructure not blocking design

- **Events Worker not deployed** — `npx wrangler deploy` in `backend/events/`,
  or every `track()` call is silently lost.
- **Push Worker not deployed** — no KV id, no VAPID pair. Harmless; the old
  `setTimeout` reminder path is untouched.
- Native-speaker review of the emotional translations still recommended.
- `rp-photos/` has no recorded image sources — needed for the Play AI-asset
  declaration and cannot be reconstructed from the repo.

## Definition of done

See `INTERACTION_SPECIFICATION.md` §11. A screen is not done because it looks
better. It is done when it is measured, keyed, keyboard-complete, contrast-clean
in both themes, and self-reviewed.
