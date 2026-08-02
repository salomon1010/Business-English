# IMPLEMENTATION_ROADMAP

> Status: authored 2026-08-02. One screen at a time. **Never start the next
> screen without approval.**

## Per-screen loop

Audit (measured) → name problems and why they matter → propose → check against
`DESIGN_SYSTEM.md` → implement → self-review as if reviewing someone else's PR
→ fix what's still inconsistent → report → **stop and wait**.

Report format: Summary · Files changed · Components changed · Accessibility ·
Performance · Regression risks · Next recommended screen. Nothing else.

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
| 2 | Session | `go('session')` → `#v-journey` | next |
| 3 | Shadowing Studio | `rShadow` / `shOpenWork` | pending |
| 4 | Speaking Feedback | in session / shadow | pending |
| 5 | Executive Polish | in `rPhrases` | pending |
| 6 | Vocabulary | `rPractice` | pending |
| 7 | Practice Hub | `rPractice` | pending |
| 8 | Calendar | `rProfile` → `.pcal-*` | pending |
| 9 | Profile | `rProfile` | pending |
| 10 | Settings | `rData` | pending |
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

## Screen 2 — Session (next)

Where the 25 minutes actually happen — the screen the Dashboard's primary
action leads to, so it carries the activation cliff.

Carried forward from the Dashboard pass:
- **`.glow-cta` ×1** — deprecated. Replace with `.btn-primary`.
- Renders into `#v-journey`, not its own container. Assert this when measuring.
- The 25-minute template checklist was deliberately moved to the bottom so
  practice comes first. Do not move it back.

Open questions for the audit: does the timer earn its screen space? Is the
recorder the primary action once the session has started, or is the timer?
What is the completion moment, and does it currently celebrate anything?

---

## Cross-screen work

Each needs a decision, not a per-screen patch. Recommend scheduling 1 and 2
before the passes that would otherwise re-patch them.

| | Item | Recommendation |
|---|---|---|
| 1 | `.help-fab` overlaps interactive content at rest on multiple screens | **Delete it** — Profile → Help already exists, one tap from the bottom nav |
| 2 | `.glow-cta` deprecated but live on Session ×1, Shadow ×1; `.ex-micbtn` shares the infinite conic animation | Remove with each screen's pass; delete the keyframes when the last use goes |
| 3 | Radius sprawl — raw 12/10/9/8/7/22px beside `--r-md`/`--r-lg` | Migrate opportunistically, per pass |
| 4 | Header streak pill shows a gold flame **0** on day one | Hide below 1 — one line, but shared chrome, so needs its own commit |
| 5 | Progress Calendar labels hardcoded English, no i18n keys | Fix in the Calendar pass (screen 8) |
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
