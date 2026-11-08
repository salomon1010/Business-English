# BE Mastery 2.0 — Onboarding V2 (General English): as implemented

Status: **IMPLEMENTED behind the flag `onboarding_v2_enabled`, which is OFF in production. General English only. Nothing is committed, merged, pushed, deployed or uploaded.** Branch `release/ge-baseline-recovery`.

The catalogs are in **[ONBOARDING_V2_CATALOG.md](ONBOARDING_V2_CATALOG.md)**, generated from the shipped data. This file is the architecture, the decisions and what is and is not operational.

## 0. What was built
| Piece | File | What it is |
|---|---|---|
| Learner profile store | `learner-profile.js` | nine atomic groups (role, goal, situations, confidence, priorities, vocab, methods, native, schedule), each a last-writer-wins register with a hybrid clock and tombstones |
| Cloud sync | `index.html` (`lpSet`/`lpClear`/`lpApplyCloud`/`lpFlush`) | the groups travel in their OWN Firestore field `lp`, written by a transaction; they are stripped from the `json` payload |
| Catalogs | `scripts/onboarding/build-catalog.py` → `onboarding-catalog.js` | the data, the search, the legacy mapping and `resolve()` (lp first, legacy fallback) |
| Flow and UI | `onboarding-v2.js` | the initial flow, the reusable selection panel, "Tune your practice", the Profile editor |
| Lesson integration | `daily-learning-plan.js`, `index.html` (`dlpProfile`, `dlpPool`, `dlpDeclaredNote`) | scenario, expression count, keyword ranking, declared pronunciation priorities |
| Welding pruning | `mobile/ios/scripts/sync-web.mjs` | the three General English files and their script tags are removed from the Welding bundle |

## 1. Repository state (preserved)
Branch `release/ge-baseline-recovery`. Uncommitted: `index.html` (situations step, typed Other, `roleLabel`), 15 `i18n/*.json`, `tests/profile-selflevel.mjs`; untracked `tests/onboarding-situations.mjs` and this file. Stashes untouched (3: two on `feature/ge-today-redesign`, one on `feature/revenue-levers`). Nothing committed, pushed, merged, deployed or uploaded.

## 2. Audit of the current onboarding (unchanged findings)
| # | Step | Stored as | Read by today |
|---|---|---|---|
| 0 | Name | `profile.name` | greetings |
| 1 | Native language (15 + skip) | `profile.lang` | dictionary, Shadow translation default |
| 2 | Programme (skipped in store builds) | `S.professionalTracks.activeId` | everything via `areaId()` |
| 3 | Role: Engineering / Data, Product / PM, Finance / Business, Sales / Marketing, Student, Other (+ new `roleOther`) | `profile.role` | DailyPlan role hints; Home pill; Profile subtitle |
| 3W | Trade (Welding only) | `Trades.setActive` | Welding only |
| 4 | Goal (4 emoji strings) | `profile.goal` | `ppGoalFromProfile()` regex; pills |
| 5 | Situations (uncommitted): meetings, presentations, interviews, everyday, skills | `profile.situations[]` | DailyPlan scenario + video keywords |
| 6 | Self-level (5 strings) | `profile.selfLevel` | DailyPlan `difficultyFor` only; `proficiencyRange` deliberately ignores it without a baseline |
| 7 | First win | `profile.baseline` | `proficiencyRange` |

Collected but unused: `slot` (display pill only). DailyPlan consumption is real but narrow: Week 1 Monday, behind `daily_learning_plan_pilot_enabled`. Grep-verified: Home, Shadow "For you", roleplay scenarios, Phrase Lab, AI Coach prompts, the Today card and the road map read none of these fields. Account settings edits name, role, goal, slot and selfLevel; there is no situations control.

Structural risks: steps are index-numbered in three places; each chip toggle re-renders the card and replays its fade-in; the profile sync overwrites whole objects (§7).

## 3. The flow, as implemented
**Initial (before the first lesson).** Name → native language → [programme, only in the unsplit web build] → profession → main goal → daily situations (with main focus) → speaking confidence → review → first lesson. Seven steps in a store build, eight on the web.
- Every answer is kept in a local draft, so closing the app and returning resumes at the same step with the same answers.
- The review lists each answer and a tap edits it; it states plainly that this is self-reported.
- "Looks right — start" writes the profile and the welcome button opens Week 1 Monday.
- In the unsplit web build, choosing Welding hands over to the released onboarding and nothing of V2 or the learner profile is created.

**Tune your practice (after the first completed lesson).** Priorities (ranked, max 3) → vocabulary goals (max 3) → practice methods (max 3) → minutes → days → time of day.
- Offered on **Home**, only once a lesson is complete, never on a lesson page, over a dialog or during a recording.
- "Not now" snoozes it three days; at most three asks, then it lives only in Profile.
- Skippable and resumable: what is left is DERIVED from the profile (an unset group = not done), so closing part-way and reopening resumes at the first unfinished question with no extra state.

**Profile → Learning profile.** All twelve fields with their current values; a tap edits any of them, using the same panels. Account settings no longer edits role, goal or confidence (they live here) and links to it instead.

## 4. Option catalogs
The complete lists (labels, stable ids, categories, selection limits, origin, current consumer, review flags) are in **[ONBOARDING_V2_CATALOG.md](ONBOARDING_V2_CATALOG.md)**. Summary:

| Catalog | Entries | Select | Limit |
|---|---|---|---|
| Profession | 181 in 17 categories + Other (2 legacy-only rows hidden); six professions added by owner decision | single | 1; Other text ≤60 chars |
| Main goal | 14 | single | 1 |
| Daily situations | 16 | multi, ordered | 0–4; first = main situation |
| Speaking confidence | 5 | single, self-reported | 1 |
| Improvement priorities | 14 | multi, ordered | 0–3 |
| Practice methods | 10 | multi | 0–4 |
| Daily minutes / days per week / time of day | 9 / 5 / 5 | single each | 1 each |

Owner decision: **no trims**. Every row stays; overlaps are handled with search aliases and grouping (catalog §9.0a). The two goals are renamed as specified (`phone_video_calls`, `academic_settings`); legacy goal values are untouched. The first situation picked is the initial *main* situation, with an explicit control to change it (`primarySituation`).

## 5. Persistence: one authority per field
The nine groups live in `S.lp` and sync through the Firestore field `lp`. **Nothing new is written into `S.profile`.** The legacy fields `role`, `goal` and `selfLevel` are kept as **one-way mirrors** (written by `OnboardingV2.mirror()` whenever a group changes) so every older reader — including DailyLearningPlan's own role hints and anything on a device that has not been updated — keeps working. Reading goes through `OnboardingCatalog.resolve(S.profile, LearnerProfile.view(S))`: the learner profile wins, the legacy field is the fallback, and the result records which it came from. A test asserts no new field is ever authoritative in both places.

| Group | Fields |
|---|---|
| role | roleCat, roleId, roleOther (only with `other.other`), role (legacy mirror) |
| goal | goalId, goal (legacy mirror) |
| situations | situations[] (ordered, max 4), primarySituation |
| confidence | selfLevel (the English string, as before) |
| priorities | priorities[] (ranked, max 3) |
| vocab | vocabGoals[] (max 3) |
| methods | methods[] (max 3) |
| native | nativeLang |
| schedule | dailyMinutes, practiceDays, timeOfDay |

Declared vs assessed: none of these touches `baseline`, the CEFR range, `competency`, `trouble` or `fbHist`. `proficiencyRange()` is unchanged and still narrows only on real evidence. The UI labels the profile self-reported, and the IMPROVE step says in words that the correction comes from the learner's own recording, not from their chosen priorities.

Sensitive data: no age, gender, location, employer or contact details. The only free text is the Other profession (≤60 characters), which stays in the profile, never goes to analytics, and is never put in an AI prompt (ids only).

## 6. Existing learners
- **No re-onboarding and no forced restart.** V2 only runs when there is no profile at all.
- **Nothing is written by reading.** `resolve()` is pure; an untouched legacy profile leaves no `lp` in the cloud at all (verified against real staging Firestore).
- Old role, goal and confidence values map to the catalogs (role to a category only, since the old answer cannot identify a specific job); unset new fields read as empty, never as invented answers.
- Everything is editable in Profile → Learning profile, and "Tune your practice" is offered once after their next completed lesson.
- An absent field never erases anything: the merge only ever replaces a group whose stamp is older.

## 7. Synchronisation (validated against real staging Firestore, 7 Nov 2026)

### 7.1 Facts established (code read, deployed rules read, behaviour run)
- **Deployed Firestore rules** (read-only API, project `be-mastery`, release of 20 Jul 2026): `match /users/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }` and nothing else. No field validation, no version or monotonic checks, **no server-side concurrency protection**, and no subcollection rule (a subcollection would be denied by default and would need a rules deploy).
- **Every client write** to `users/{uid}` is `set({json, savedAt, email, updatedAt}, {merge:true})` (push, pull write-back, first sign-in, test-sync, auth-profile write). The partner Worker only *reads* the document (a GET masked to `savedAt`). Nothing replaces the whole document except deleting the account.
- **Older and Welding clients** replace the cloud `profile` object wholesale on every pull (`Object.assign({}, cloud, local)`), and push blindly after a save.
- **Proof, using the real `fbMerge` and a real older client:** a cloud profile carrying `roleOther`, `situations`, `priorities` and stamps, merged by an older client, returns a profile with **none of them** (integration test 1 reproduces it end to end: after one normal sync the cloud profile has lost the fields).

### 7.2 Conclusion on O3 + O2
**O3 + O2 as designed does NOT protect General English profile data.** Both halves are client-side merge rules; a stale or Welding client that does not contain the new rule (every client shipped today) erases the fields no matter what a new client does. The unresolved scenario was: *older client or Welding app syncs → General English fields inside `profile` disappear from the cloud.* It cannot be fixed by client code, and it cannot be fixed by rules (rules cannot parse the `json` string).

### 7.3 Decision: O6 — a separate document field, not part of `json` (replaces O3 + O2)
- General English learner-profile **groups live in `S.lp`**, are **stripped from the `json` payload**, and sync through their own top-level field `lp` on `users/{uid}`. Because every existing writer uses `set(..., {merge:true})` on `{json, savedAt, email, updatedAt}`, **none of them can touch `lp`**. Older clients, the Welding app, stale blind pushes and flag-off builds all leave it byte-identical (integration tests 2–6).
- **Per-group last-writer-wins** (atomic groups: role, goal, situations incl. `primarySituation`, confidence, priorities, methods, schedule). Stamps `{v, t, s}`: hybrid clock `t = max(now, maxSeen+1)`, incoming `t` clamped to now + 1 day, tombstone `v:null` for deletion, tie broken by signature so every device picks the same winner.
- **Writes are a Firestore transaction** that compares stamps and uses `update()` on the dotted path `lp.g.<group>`, which *replaces* the group. (`set`+`merge` would deep-merge nested maps and keep a removed field alive: test 12.) Firestore's own optimistic concurrency retries a collision; a stale new client reads the newer stamp inside the transaction and keeps it.
- **No rules change, no server, no migration, no new infrastructure** are needed; older clients ignore the field. The existing `fbMerge`/push path is **unchanged** for every other key, so Welding and legacy behaviour is byte for byte what it was, apart from the one-line payload strip (`delete out.lp`).
- **Rollback:** flag `onboarding_v2_enabled` OFF (the default) makes every `lp` function a no-op and nothing reads the field; the field is harmless if left in the document; account deletion removes it with the document.

### 7.4 Phase 0 results
- Code: `learner-profile.js` (pure engine), glue in `index.html` (`lpOn`, `lpSet`, `lpClear`, `lpApplyCloud`, `lpFlush`, hooks in `fbSyncPull` and `fbFirstSync`, payload strip), flag `onboarding_v2_enabled` (OFF), `sw.js` shell entry. No UI, no curriculum, no Shadow change.
- Tests: `tests/learner-profile.test.mjs` (31, engine: validation, conflicts, offline, deletion, skew, malformed data, legacy, 300 random three-device histories) and `tests/learner-profile-sync.mjs` (21, real client code against a Firestore model: older client from `git HEAD`, Welding-pinned build, stale blind push, flag off, offline edits, simultaneous writes, deletion vs stale device, sign-in adoption, sign-out).
- **Limit of the evidence:** the Firestore in the integration test is a model of documented behaviour (merge, dotted-path update, optimistic transactions). It has not been exercised against real Firestore. A staging check (`be-mastery-test`) is a required step before approval and needs your go-ahead because it writes to a real project.

### 7.5 Residual risks (reported, not hidden)
1. **Not yet verified on real Firestore** (above).
2. **The uncommitted onboarding code still writes `situations` and `roleOther` into `S.profile`.** That is exactly the exposure this design removes. It is unreleased, but it must move to `lp` (Phase 3/4) before any build ships; until then the existing onboarding step must not be released.
3. **Legacy mirrors:** `role`/`goal`/`selfLevel` remain in `profile` for older clients. An older client editing them can diverge from `lp`; new clients treat `lp` as authoritative once a group exists and refresh the legacy string from it. An older client's edit to a legacy field after a General English edit is ignored by new clients: a documented trade-off, not data loss.
4. **Same-group simultaneous edits** from two new devices keep the later stamp; the other edit is lost by design.
5. **Store builds compile the flag in**, so a disabled flag after release needs a new build; the code ships dark and is enabled only with the UI.
6. **Document `updateTime` changes on each `lp` write**, so be-partner's track cache revalidates once per write (a masked GET); negligible.
7. **Device-local edits are lost if app data is cleared before they are sent** (same as all local data).

### 7.6 Real staging validation (`tests/learner-profile-staging.mjs`, 27/27)
Run against the real **be-mastery-test** project (never production: the harness refuses to start unless the bundle's Firebase project is be-mastery-test), with the real Firebase SDK 10.12.5, real transactions, real security rules and disposable users on reserved `.invalid` addresses. Devices: this tree, the committed HEAD as an older client, and a Welding-pinned build with the flag forced on.

Confirmed on real infrastructure: groups are written as separate map entries by transactions; the `json` payload carries none of it; an **older client** and the **Welding app** sign in, pull, edit and push without changing `lp` by a byte; a stale blind push leaves it alone; a second device receives the groups; simultaneous writes to one group converge on one winner; an offline edit (real network cut) survives and merges with the other device's newer edit; a tombstone is not resurrected; a changed group is replaced, not deep-merged; sign-in adoption keeps a local edit; sign-out wipes the device but not the cloud; a blocked write stays dirty and the next flush recovers it; another signed-in user gets 403 on read and write, an anonymous caller 403; a maximum-size profile is ~2 KB against Firestore's 1 MiB limit. The two disposable users and their documents were deleted, and a follow-up query shows none left.

**Isolation of the environment** was checked, not assumed: production is project `be-mastery` (number 847739483036) and staging is `be-mastery-test` (724002405539) — different projects, different API keys, different rule releases. Production rules were read read-only and not modified.

## 8. Mobile interaction design (Soft Futuristic)
- **Tokens only:** `--bg --card --line2 --acc --accent --txt --mut --grad`, existing `.ob-chip` radius and spacing. Selected = accent border, ~14% accent fill and a check glyph (colour never the only cue). No new glows, no neon, no flashing. Motion is limited to a 150–200 ms step fade and sheet slide; none on toggles; `prefers-reduced-motion` removes it.
- **Picker by list length:** ≤16 options: inline list or chips, no search. 17–60: bottom sheet (~85% height), filter field, sticky Confirm. 100+: full-screen picker with persistent search, category chips that jump, "Suggested for you" first, and a "Use Other: <text>" row when nothing matches.
- **Mechanics:** keyboard-aware height via `visualViewport` (fallback `dvh`); sticky footer inside `env(safe-area-inset-bottom)`; `overscroll-behavior:contain` and body scroll lock; back button/swipe closes without losing selections; inputs ≥16 px with `enterkeyhint="search"`; targets ≥48 px; `rem` sizing for dynamic type; primary action and search within one-hand reach; no `innerHTML` re-render per toggle (classes update in place).
- **Accessibility:** `role=listbox`, `aria-multiselectable`, `aria-selected`; live regions for result and selection counts; focus moves into the sheet and back to its trigger; rank badges announced "selected, priority 1"; RTL for ar/ur.

### 8.1 Mockup 1 — Profession (full-screen, 175 options)
```
┌────────────────────────────────┐
│ ‹              What do you do?  │
│ ╭────────────────────────────╮ │
│ │ ⌕  Search professions       │ │
│ ╰────────────────────────────╯ │
│  Tech · Eng · Energy · Health ›│  jump chips
│ SUGGESTED                       │
│ ○ Welder                        │
│ ○ Product manager               │
│ SKILLED TRADES                  │
│ ● Welder                     ✓  │
│ ○ Pipefitter                    │
│ ○ Boilermaker                   │
│ ○ Electrician                   │
│ …                               │
│ OTHER                           │
│ ○ Not listed — type it          │
│ ╭────────────────────────────╮ │
│ │         Continue            │ │  safe-area padded
│ ╰────────────────────────────╯ │
└────────────────────────────────┘
```
### 8.2 Mockup 2 — Daily situations (16, multi, max 4)
```
  Where do you need English most?
  Pick as many as you like.
  ╭ Meetings ✓ ╮ ╭ Presentations ╮
  ╭ Interviews ✓╮ ╭ Phone & video ╮
  ╭ Team updates╮ ╭ Clients       ╮
  ╭ Negotiation ╮ ╭ Networking    ╮
  ╭ Everyday    ╮ ╭ Travel        ╮
  ╭ Safety      ╮ ╭ Customers     ╮
  ╭ Small talk  ╮ ╭ Doctors & svc ╮
  ╭ Social      ╮ ╭ Learning      ╮
  2 selected              [ Continue ]
```
### 8.3 Mockup 3 — Priorities ("Tune your practice" sheet, ordered, max 3)
```
  Tune your practice · 1 of 3
  What would you like to improve most? Pick up to 3, in order.
  ⌕ Search
  ① Pronunciation        ○ Word stress & rhythm
  ② Fluency              ○ Intonation
  ○ Vocabulary           ○ Idioms & phrases …
  Your order: 1 Pronunciation · 2 Fluency
  [ Not now ]                    [ Continue ]
```
### 8.4 Mockup 4 — Completed summary (end of Phase A)
```
  Your learning profile              (self-reported)
  Profession   Welder                    ›
  Goal         Speak in meetings         ›
  Situations   Meetings · Interviews     ›
  Confidence   Can get by                ›
  Practice     add priorities, methods,
               and time later            ›
  Your first recording gives us real evidence.
               [ Looks right — start ]
```

## 9. Curriculum integration — what is operational
The 12-week curriculum is untouched: the objective, the assessment criteria and the pack are identical for every learner, and `validateAgainstCurriculum` still enforces it.

**Operational now** (Week 1 Monday, with `daily_learning_plan_pilot_enabled`; each proved by a test in `tests/onboarding-v2.mjs` §8):
| Profile field | Effect |
|---|---|
| main situation | chooses the lesson's scenario frame from a closed table of 16, and the scenario is shown to the learner in the TRY step |
| profession (group + legacy role) | ranks the SAME curriculum phrase pool, and picks the supporting video's keywords |
| vocabulary goals | add keywords to that ranking |
| minutes a day | sets how many expressions the lesson teaches: 3 (5-10 min), 4 (15-20), 5 otherwise — the "3 to 5 per lesson" principle |
| confidence | sizes the speaking task (as before) |
| priorities (pronunciation ones) | carried into the plan as `pronunciationFocus.declared` and shown in IMPROVE as the learner's own choice |
| all of them | recorded in `learnerContext`, separately from the proficiency estimate |

**Planned, not claimed** (no consumer reads the profile yet): Today/Home ordering, Shadow Studio "For you", Life Simulations ordering, Phrase Lab ranking, the AI coach context line, Practice Partner goal mapping, spaced retrieval across lessons, weekly real-world challenges, and difficulty that adapts from demonstrated performance. Shadow Studio and Practice Partner were deliberately left out of this phase.

## 10. General English / Welding separation
1. **Build:** `sync-web.mjs --track welding` deletes `learner-profile.js`, `onboarding-catalog.js` and `onboarding-v2.js` from the bundle AND removes their `<script>` tags, failing the build if either is left behind. The Welding bundle carries no V2 code at all.
2. **Flag:** `onboarding_v2_enabled` (default OFF) only has effect where the build is General English or `isGeneralEnglish()`.
3. **Data:** `lpOn()` is false on Welding, so `lpSet`/`lpClear` refuse and no `S.lp` is ever created there — verified with the flag FORCED ON in a Welding-pinned build.
4. **Sync:** the Welding app preserves the `lp` field untouched (it is in a field no existing writer touches) — verified against real staging Firestore.
5. **Programme:** Welder, Pipefitter, Boilermaker and Millwright are ordinary General English professions. A catalog row has no programme, track or route field, and choosing Welder leaves `areaId()`, `S.professionalTracks.activeId` and `S.profile.weldProf` unchanged.
6. **Server:** no Worker reads any of these fields, so no server change was needed or made.

## 11. Development-only simulator hook
Purpose: put either simulator on a given onboarding step with a seeded profile, identically on both platforms, because `simctl` cannot tap.
- **Not in release by construction.** The hook is a separate file `sim-hook.js`, copied only when `sync-web.mjs --sim-hook <scenario>` is passed; that flag writes `sim:{…}` into `be-build.js` and the scenario into a bundled `sim-scenario.json`. `index.html` loads the hook only if `BE_BUILD.sim` exists. Normal web, store and `--archive`/`--device` builds never contain the file.
- **Guards that fail the build:** `ios/scripts/build.sh` rejects `--sim-hook` with `--archive`, `--device` and `--staging`; `check-release.mjs` and the Gradle `verify<Variant>WebBundleProgramme` task fail any bundle containing `sim-hook.js` or `sim:` (release variants always); a test greps the production `_site` and every bundle output.
- **Cannot bypass authentication:** it never calls sign-in, never reads or sets `FBUser`, entitlements or Premium, and refuses to run if a Firebase user or `FB_OWNER_KEY` exists.
- **Cannot alter production profiles:** it seeds only an empty profile, marks `S.simSeed=true`, which disables `fbPush`/`fbSyncPull` and the entitlement refresh; `fbFirstSync` discards a seeded local copy on any later sign-in. It never writes to a signed-in account's document.
- **Scenarios** (data file): `ob:profession`, `ob:situations`, `ob:summary`, `later:priorities`, `profile:learning`, each with language/theme options. Switching scenario = `npx cap copy` + reinstall (~20 s) on both platforms. Full tap-through flows on iPhone can additionally use the existing `BEMasteryUITests` target.
- Android taps use `adb input`; iOS uses the baked scenario (and XCUITest for flows).

## 12. Android / iOS implementation and verification plan
Shared web code is written once. After every phase:
1. Run the phase's automated tests plus `app-split`, `track-isolation`, `smoke`.
2. Build both with the verified scripts: `bash mobile/ios/scripts/build.sh general` and `bash mobile/android/scripts/build.sh general` (+ `--sim-hook <scenario>` only for simulator inspection).
3. Install and launch on the iPhone simulator and a clean Android emulator (a Google-APIs AVD without Play apps, so first-run apps like Gmail cannot steal focus), existing app data preserved by installing over (and, separately, from fresh).
4. Perform the same flow on both; capture screenshots from both; record every difference.
5. Confirm Welding is unaffected (build and open `welding` once per phase).
Nothing is claimed as verified unless it was run. Known platform differences to watch: Android `adjustResize` vs iOS scroll-into-view, iOS keyboard accessory bar, safe areas and the Android gesture bar, WebView versions.

**Android ghosting.** Cause still undetermined. Evidence so far: the layout is correct in Chromium including after a simulated keyboard cycle (5 chips, no overlap, no leftover scaling), while the emulator showed an ANR in a system app, a renderer mismatch warning and Gmail taking the foreground on a fresh boot; app-side compositing triggers (per-toggle re-render replaying the fade, `obFit` scaling, keyboard resize) are not excluded. Phase 0 runs the A/B on a clean AVD with WebView remote debugging, animations on/off and keyboard on/off, and the redesign removes the suspected triggers regardless.

## 13. Tests actually run
| Suite | Result |
|---|---|
| `tests/learner-profile.test.mjs` (engine: conflicts, offline, deletion, clock skew, malformed data, 300 random 3-device histories) | 32/32 |
| `tests/onboarding-catalog.test.mjs` (ids, legacy ids frozen, limits, search, resolve) | 26/26 |
| `tests/onboarding-v2.mjs` (the real flow in a browser: 71 checks) | 71/71 |
| `tests/learner-profile-staging.mjs` (**real staging Firestore**, disposable users) | 27/27 |
| `tests/learner-profile-sync.mjs` (Firestore model: older client, Welding, offline, concurrency) | 21/21 |
| `tests/ge-no-welding-text.mjs` | 9/9 |
| `daily-learning-plan.test`, `daily-learning-plan-lesson`, `profile-selflevel`, `track-isolation`, `app-split`, `help-centre`, `offline-shell`, `auth-entry-points`, `keep-progress`, `boot-recovery`, `smoke` | all pass |

## 14. i18n plan
Catalog = data file with ids, category ids, aliases and legacy mappings. Labels in `I18N_EN` under `prof.<id>`, `profcat.<id>`, `goal2.<id>`, `sit.<id>`, `prio.<id>`, `meth.<id>`, `time.<id>` plus ~60 UI strings, roughly 330 keys. All 15 `i18n/*.json` receive every key (parity test). A 175-item profession list in English fallback would be poor, so I propose machine transcreation for all 15, flagged for native review as the repo's standing note requires, plus per-language search aliases for common roles. Stored values are ids; search is case- and diacritic-insensitive.

## 15. Known limitations and production risks
1. **The flag is OFF and must stay off until you approve the release.** In store builds it is compiled in, so disabling it after a release needs a new build; on the web it is immediate.
2. **i18n:** the 60 new UI strings are translated into French, Spanish, Portuguese and Arabic and carry English in the other 11 languages. **The catalog labels themselves (284 professions, goals, situations, priorities, vocabulary goals, methods) are English in every language** — they fall back to the English source text. Translating them is a large, separate piece of work and needs native review.
3. **Android ghosting:** the panels update rows in place and never re-render on a tap, which removes the suspected trigger, and the tests assert no overlap and no overflow. I saw similar ghosting on an unrelated Profile page on the emulator, so the underlying cause is still undetermined; it wants a real Android device.
4. **Lesson integration is Week 1 Monday only**, behind its own pilot flag. Everything else in §9 is Planned.
5. **Simultaneous edits** to one group from two devices keep the later one; the other is lost by design.
6. The **vocabulary-goal and method choices** are stored and (for vocabulary) used in ranking, but no feature changes because a method was chosen.
7. `tests/learner-profile-staging.mjs` writes to the real staging project; it is deliberately NOT in `npm test` and needs `STAGING_LP_TEST=1`.

