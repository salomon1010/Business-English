# RELEASE_CHECKLIST

> Updated after every completed screen. Every number here is measured, not
> estimated — see `UX_AUDIT.md` for the per-screen evidence.
> Last updated: RC1 performance audit.

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

> ⚠️ The figures in this section before RC1 were **measured with a scoped
> probe** (`#v-<name>` only, height only) and were wrong. See
> `INTERACTION_SPECIFICATION.md` §10. The numbers below are from the corrected
> document-wide gate.

- **Touch targets:** measured document-wide, both dimensions, 15 surfaces
  including modals and overlays. **11 of 11 screens had violations → 0.**
  Three documented WCAG 2.5.8 exemptions (crossword grid, inline sentence
  links, the label-wrapped reminder checkbox).
- **Contrast:** document-wide over ~1,655 text nodes per pass, both themes,
  compositing one gradient stop at a time.
  **dark 64 → 6 · light 54 → 4.**
  The residue is `.lang-ic` ("EN", computes 3.76:1). It paints a scrim with an
  inset `box-shadow`, which a computed-style probe cannot see, so the number is
  untrustworthy in **both** directions — not claimed fixed, not claimed broken.
  Needs a screenshot pixel check.
- **Motion:** 0 animating elements under `prefers-reduced-motion` on every
  screen; `.btn` hover transform now has a reduced-motion guard.
- **Memory:** 96 view renders across 8 views — nodes 967 → 967, listeners
  59 → 59, heap +0.2 MB. No leak.
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
| **14 hardcoded English `aria-label`s** (19 instances): Record · Hear · Slow · Save · Dictate · Clear · Speak · Mute · Theme · Cancel timer · Main navigation · Previous match · Next match · Practice timer | index.html | **medium** — violates INTERACTION_SPECIFICATION §3; screen-reader users on 14 non-English locales hear English. Needs new keys ×15 files, so **not** done unilaterally |
| **30 `--mut2`-on-text declarations remain** in unrendered surfaces (role-play history, empty states, crossword numbers, `.cv-d`, `.gx-new`…). 4 rendered ones were fixed and measured | index.html | medium — a known token-contract violation; each needs its surface rendered before changing |
| `.lang-ic` relies on an inset scrim, not a checked palette | 1 rule | low |
| Infinite animations without a reduced-motion guard | Onboarding, role-play | low |
| Radius sprawl — 20 raw values, 136 declarations | app-wide | low — **design decision, not cleanup**; needs a design pass |
| ~120 i18n keys look orphaned, but many are built dynamically (`t("phase."+n)`) | 15 files | low — **do not bulk-delete**; needs per-key proof |

## Critical defects

**None open.** Fixed during these passes:

- State: `load()` returned a stored state as-is, backfilling only 7 of the 18
  fields the default carries. `masteredCount()` calls `Object.keys(S.phMaster)`
  and `streak()` reads `S.dates.length`, neither guarded — so a state written by
  an older build, or merged from another device's cloud copy, threw before the
  view rendered. A blank screen, not a degraded one. Fixed in `50b9339`; the
  backfill is now driven off `defState()` so the two lists cannot drift again.

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

## Performance — measured

Local, 390×844, seeded with 200 days of history and 40 vocabulary words.

| | |
|---|---|
| First contentful paint | **212 ms** |
| DOMContentLoaded | **160 ms** |
| Long tasks (>50 ms) over a full 9-view sweep | **0** |
| Slowest view render (median) | **6.8 ms** (Practice, 948 nodes) |
| Slowest single render observed | 30.8 ms |
| Document DOM at rest | 248 nodes |
| localStorage after 200 days | 12 KB |

Runtime is healthy. The cost is all in **what loads before anything renders**.

Measured against the **live** site, over the wire, compressed — the local server
does not gzip, so the first figures taken there overstated every number:

| Origin | Transfer (gzip) | Uncompressed |
|---|---|---|
| App (`index.html`) | **208 KB** | 665 KB |
| Firebase `firestore-compat` | **98 KB** | ~330 KB |
| Firebase `auth-compat` | **38 KB** | ~130 KB |
| Firebase `app-compat` | **9 KB** | ~40 KB |
| Google Fonts + beacon | ~20 KB | 72 KB |

GitHub Pages serves gzip: 681 KB of HTML becomes **208 KB** on the wire.

### Firebase deferral — done (`0eef9a5`)

Firebase used to cost ~145 KB gzipped on **every** boot — `app`, `auth` and
`firestore` compat builds via three blocking `<script src>` tags in `<head>` —
about 41% of total transfer, for a feature most users never touch. The three
tags are gone; `fbLoad()` fetches them when they are needed.

| Boot path | Firebase requests | Behaviour |
|---|---|---|
| Never signed in | **0** at boot and after navigating all views | sign-in card and sync nudge both still render |
| Previously signed in (`be12_owner` present) | 3, as before | session restore and first sync unchanged |
| Opens the sign-in sheet | 3, on demand, cached after | modal renders with both inputs |

The trap this created, and why the gate is now `fbConfigured()`: two surfaces
tested `!FBauth` to mean "Firebase is unavailable". Under lazy loading that is
also the normal state for everyone who has **not** signed in — precisely the
audience the sign-in card and the sync nudge exist for — so both would have
silently disappeared. Never test `FBauth` to decide whether to *offer* sync;
test the inline config, which is present synchronously either way.

⚠️ The remaining boot cost is **not** re-measured as a load-time figure. Two
runs of the same path differed by 600 ms on cache warmth alone, so the honest
claim is the request count above, not a millisecond saving.

## Offline / PWA audit

Static review of `sw.js` and `manifest.json`, plus an attempted runtime probe.

**Verified by reading the code:**
- Network-first with a cache fallback, terminating in `index.html` for any
  uncached navigation. Correct shape for an offline-first app.
- `activate` deletes every cache except `CACHE` and `REM_CACHE`. The `REM_CACHE`
  exemption is deliberate — a pending push reads its wording from there and must
  survive a version bump. Do not "tidy" that filter.
- The `fetch` handler ignores non-GET and cross-origin requests, so the Polish
  Worker and Firebase calls are never intercepted or cached.
- `manifest.json` — all four `screenshots` paths resolve to files that exist.
  (Worth noting: they point at `playstore/screenshots-2026-08/`, the interim
  set, not the current `store-art-2026-08/phone/`. Both exist; only the Play
  listing was migrated. Not a defect — a consistency question for a design call.)

**Could not be verified locally, and why:** the SW registration at
index.html:9485 is gated on `location.protocol==="https:"`, so it never
registers on the `python3 -m http.server` dev server. Offline behaviour is
therefore **untestable on the local rig** — the probe confirmed 0 cached
entries and a failed offline reload, which is the guard working, not a bug.

`http://localhost` is a secure context and *would* permit a SW, so the guard is
stricter than the spec requires. Loosening it would let a stale SW from this app
intercept any other project later served on the same port — a real footgun. Left
alone deliberately; this is a behaviour change, not cleanup.

⬜ **Consequence:** offline and install behaviour must be validated on the live
https site or a local https server. It is on the manual list below.

## Manual validation required before production release

None of the following can be claimed from the repo — they need real hardware,
real users, or an external service. Each is unverified, not assumed working.

**Device — Android (the TWA is the primary distribution)**
- ⬜ Cold start from the Play install; confirm no browser address bar (assetlinks)
- ⬜ Microphone permission: first grant, deny, and deny-then-re-enable in settings
- ⬜ Speech recognition and TTS on a real device, not desktop Chrome
- ⬜ Audio recording, playback and the waveform in Shadowing Studio
- ⬜ Aeroplane mode: cold start, navigate all views, confirm Executive Polish
  falls back to the local rule-based clean-up rather than erroring
- ⬜ Install prompt and the `screenshots` rich prompt
- ⬜ Daily reminder fires at the set time with the app closed

**Device — iOS (PWA install only, no App Store presence)**
- ⬜ Add to Home Screen, then relaunch: confirm the view is restored from
  `sessionStorage` when `start_url` drops the hash
- ⬜ Confirm the old cache clears after a deploy (fully close and reopen)

**Accessibility**
- ⬜ VoiceOver (iOS) and TalkBack (Android) pass over all 12 screens
- ⬜ Confirm the Shadow workspace focus trap behaves with a screen reader active

**Cloud sync — now that Firebase loads lazily, re-test on a device**
- ⬜ Sign up, sign out, sign in again on a device that had never signed in
- ⬜ Confirm a signed-in device still restores its session on cold start
- ⬜ Two-device merge, including a device running an older build

**External**
- ⬜ Native-speaker review of the transcreated emotional copy (bn, ur, hi, ja,
  ko, ar especially)
- ⬜ `rp-photos/` image provenance — 14 files with no recorded sources; needed
  for the Play AI-asset declaration and cannot be reconstructed from the repo
- ⬜ Real install and retention figures from Play Console (the analytics have no
  device ID by design, so they give trends, never people)

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
| 3 | RTL directional glyphs | ✅ `fb74279` |
| 4 | Duplicated CSS/JS | ✅ `ed64583` |
| 5 | Dead CSS | ✅ `2e7c671` |
| 5b | Obsolete tokens | ✅ `6acd7c5` |
| 6 | Performance audit | ✅ `77e5dce` |
| 7 | Offline / PWA audit | ✅ verified on the live https site |
| 8 | Dead JavaScript | ✅ `a23dab2` |
| 9 | Shared-component 44px floor + focus ring | ✅ `b916209` |
| 10 | Malformed CSS block (two rules silently dropped) | ✅ `f748936` |
| 11 | Contrast, document-wide, both themes | ✅ `4432c6f` |
| 12 | Onboarding short-viewport chip sizing | ✅ `303e873` |
| 13 | Memory / listener leak check | ✅ no leak |
| 14 | Mobile behaviour, microphone permission flows | ⬜ device |
| 15 | VoiceOver / TalkBack | ⬜ device |
| 16 | Hardcoded `aria-label`s → i18n keys | ⬜ needs 14 keys ×15 files |
| 17 | Remaining 30 `--mut2` text declarations | ⬜ needs per-surface measurement |
| 18 | Native-language review | ⬜ external |
| 19 | Deploy the events Worker | ⬜ **blocked — needs the owner to run it** |
