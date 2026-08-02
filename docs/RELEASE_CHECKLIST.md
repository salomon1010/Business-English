# RELEASE_CHECKLIST

> Updated after every completed screen. Every number here is measured, not
> estimated — see `UX_AUDIT.md` for the per-screen evidence.
> Last updated: Settings (screen 10).

## Screens

| # | Screen | Status | Commit |
|---|---|---|---|
| 1 | Dashboard | ✅ frozen | `9450bed` |
| 2 | Session | ✅ frozen | `479b094`, `77685e9` |
| 3 | Shadowing Studio | ✅ frozen | `0863af7` |
| 4 | Speaking Feedback | ✅ frozen | `20e2477` |
| 5 | Executive Polish | ✅ frozen | `a1cd17f`, `87f2649` |
| 6 | Vocabulary | ✅ frozen | `3fa343e` |
| 7 | Practice Hub | ✅ frozen | `a64a3d4` |
| 8 | Calendar | ✅ frozen | `cd87dfb` |
| 9 | Profile | ✅ frozen | `fb9bb36` |
| 10 | **Settings** | ✅ **this pass** | pending |
| 11 | Help | ⬜ not started | — |
| 12 | Onboarding | ⬜ not started | — |

**10 of 12 complete. 9 frozen.**

## Cross-screen gate

Run at 390×844, dark, on every completed screen. Target is 0 in every column
except `<h1>`, which must be exactly 1.

| Screen | `<h1>` | <44px | `.btn-p` | `.glow-cta` | infinite | `--mut2` text | emoji |
|---|---|---|---|---|---|---|---|
| Dashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Session | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Shadow | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Executive Polish | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Vocabulary / Practice | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Calendar / Profile | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Settings | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| *Phrase Lab (not passed)* | 1 | **48** | 0 | 0 | 0 | 0 | 0 |

## Accessibility

- **Touch targets:** 100% ≥44px on all 10 completed screens.
- **Contrast:** 0 AA failures across ~140 measured text roles, both themes.
- **Forms:** every control on Settings has a real `<label for>` or `aria-label`.
- **Keyboard:** tab order verified on Dashboard, Session, Shadow, Feedback,
  Settings. Shadow's workspace has a focus trap, Escape and focus restore.
- **Reduced motion:** 0 animating elements on every completed screen.
- **Semantics:** exactly one `<h1>` per view; disclosures are `<details>`.
- ⬜ Not yet done: a real screen-reader pass (VoiceOver/TalkBack) on a device.

## Localisation

- **1,146 keys**, parity verified across `I18N_EN` and all 15 files.
- Calendar dates, month names and weekday initials follow the app language.
- RTL verified on Dashboard, Session, Shadow, Feedback, Polish, Vocabulary,
  Practice, Calendar, Profile, Settings.
- ⚠️ **Native review outstanding.** Emotional/"dream voice" copy is machine
  transcreation — notably the four Calendar insight lines and the Session and
  Shadow narrative strings. Recommended before any promotion push.

## Shared technical debt

| Item | Scope | Severity |
|---|---|---|
| Phrase Lab: 48 controls <44px | screen 11's neighbour, unpassed | medium |
| `--mut2` used as text on unpassed screens | ~68 uses | medium |
| `.btn-p` gradient on unpassed screens | ~40 uses | medium |
| `.help-fab` overlaps content at rest | every screen | medium |
| `→` arrows and `▶` chevrons unmirrored in RTL | 5 arrows, 4 disclosures | low |
| Infinite animations without a reduced-motion guard | Onboarding, role-play | low |
| `.fb-again` duplicates `.btn-outline` | fold in later | low |
| Radius sprawl (raw 12/10/9/8/7/22px) | app-wide | low |

## Critical defects

**None open.** Fixed during these passes:

- Vocabulary: the brightest control on every row **deleted the word** while
  announcing itself as "Save".
- Calendar: the streak screen was untranslated for 14 of 15 languages.
- Shadow: the fullscreen workspace was not a dialog — no focus trap, no Escape.
- Settings: 6 of 7 form controls had no label association.
- Session: the entire practice half was hidden behind an off-screen tab.

## Release readiness

**≈70%.** Ten of twelve screens are production quality and measured. The
remaining 30% is: two screens unpassed (Help, Onboarding), the shared debt
above, one native-language review, and the deploy-side items below.

## Deploy-side (outside the screen work)

- ⬜ **Events Worker not deployed** — `npx wrangler deploy` in `backend/events/`,
  or every `track()` call is silently lost.
- ⬜ **Push Worker not deployed** — no KV id, no VAPID pair. Harmless; the
  `setTimeout` reminder path still works.
- ⬜ `sw.js` `be12-vNN` must be bumped on the deploy that carries this work.
- ⬜ `rp-photos/` has no recorded image sources — needed for the Play AI-asset
  declaration.
- ✅ Play listing, assetlinks, HTTPS enforcement, store art all live.

## Remaining estimated work

**≈25%** of the screen programme: Help and Onboarding (2 of 12 screens), plus
the shared-debt sweep, which is now mostly a mechanical find-and-replace since
each item is enumerated above.
