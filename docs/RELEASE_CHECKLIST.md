# RELEASE_CHECKLIST

> Updated after every completed screen. Every number here is measured, not
> estimated — see `UX_AUDIT.md` for the per-screen evidence.
> Last updated: RC1 stabilisation task 2 — shared contrast.

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
| 10 | **Settings** | ✅ frozen | `ab98253` |
| 11 | **Help** | ✅ frozen | `126c495` |
| 12 | **Onboarding** | ✅ frozen | `8984845` |

**12 of 12 complete. 12 frozen. The screen programme is done.**

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
| Help | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Onboarding | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Phrase Lab | 1 | 0 | 0 | 0 | 0 | 0 | 0 |

**The gate passes on every surface.** Also verified 0 sub-44px controls on
Review and Journey, which were never individually audited.

## Accessibility

- **Touch targets:** 100% ≥44px on **all ten rendered surfaces** (the 12
  screens plus Review and Journey), at 320×568 through 1280×900.
- **Contrast:** **0 AA failures on every rendered text node** across all ten
  surfaces in both themes — measured by walking the DOM and compositing the
  real painted backdrop, not by sampling chosen elements.
- **Forms:** every control on Settings has a real `<label for>` or `aria-label`.
- **Keyboard:** tab order verified on Dashboard, Session, Shadow, Feedback,
  Settings. Shadow's workspace has a focus trap, Escape and focus restore.
- **Reduced motion:** 0 animating elements on every completed screen.
- **Semantics:** exactly one `<h1>` per view; disclosures are `<details>`.
- ⬜ Not yet done: a real screen-reader pass (VoiceOver/TalkBack) on a device.

## Localisation

- **1,147 keys**, parity verified across `I18N_EN` and all 15 files.
- Onboarding verified in de/ar/ja with no clipping or overflow.
- Calendar dates, month names and weekday initials follow the app language.
- RTL verified on Dashboard, Session, Shadow, Feedback, Polish, Vocabulary,
  Practice, Calendar, Profile, Settings.
- ⚠️ **Native review outstanding.** Emotional/"dream voice" copy is machine
  transcreation — notably the four Calendar insight lines and the Session and
  Shadow narrative strings. Recommended before any promotion push.

## Shared technical debt

| Item | Scope | Severity |
|---|---|---|
| `→` arrows unmirrored in RTL | 5 arrows | low |
| `.lang-ic` relies on an inset scrim, not a checked palette | 1 rule | low |
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
- Help: the floating `?` button **covered Session's Reset and a Practice
  vocabulary row at rest** — it blocked input on two frozen screens.
- Session: the entire practice half was hidden behind an off-screen tab.

## Release readiness

**≈85%.** All twelve screens are production quality and measured. The remaining
15% is RC1 stabilisation: real-device testing, the shared debt below, one
native-language review, and the deploy-side items.

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

**0%** of the screen programme — all twelve are complete. What remains is RC1
stabilisation, listed below.

## Next milestone — RC1 Stabilisation

The screen programme is finished. Stabilisation, in the order I would run it:

| | Item | Status |
|---|---|---|
| 1 | Touch-target floors — every surface ≥44px | ✅ `8bcec70` |
| 2 | Remaining shared contrast | ✅ `9b7fa11` |
| 3 | RTL: 5 unmirrored `→` arrows | ⬜ next |
| 4 | Duplicated CSS/JS (`.fb-again`→`.btn-outline`) | ⬜ |
| 5 | Dead code and obsolete tokens (radius sprawl) | ⬜ |
| 6 | Performance profiling | ⬜ |
| 7 | Memory review | ⬜ |
| 8 | Mobile behaviour, microphone permission flows | ⬜ device |
| 9 | Offline behaviour and PWA install | ⬜ device |
| 10 | VoiceOver / TalkBack | ⬜ device |
| 11 | Native-language review | ⬜ |
| 12 | Deploy the events Worker; bump `sw.js`; Play prep | ⬜ on approval |
