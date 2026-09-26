# Release integration: main + Premium/monetization + Apple (2026-09-26)

Branch **`release/premium-integration`**, created from **`origin/main` @
`c63f7be`**, not from the stale local `main` (`e64d382`). **Not merged, not
pushed, not deployed to production.**

## Commits
| Commit | What |
|---|---|
| `87b7361` | Merge of `feature/premium-shadow-videos` @ `39a030a`: design system Phases 1–6, monetization Phases 7–12, Premium value + acquisition + Subscription card |
| `bfde318` | Apple server: upgrades, environments, out-of-order notifications; staging pins Apple Root CA - G3 |
| next | Apple client: StoreKit 2 bridge (Swift plugin and web bridge), account-deletion subscription note, App Store documents, this record |

## Conflicts (17), each resolved as the union of both sides
| File | Resolution |
|---|---|
| `index.html` (1 hunk) | kept main's `shYtFindURL()` ("Find on YouTube") **and** the branch's async `shLinkGo` (Premium limits before any load) |
| `backend/events/events-worker.js` (2 hunks) | allow-list: main's `cert_*` plus the branch's `ad_*`, `rewarded_ad_*`, `purchase_*` and `entitlement_*`. Blob map: the branch's `ad_` and `purchase_` rows plus main's `shadow_` and `cert_` rows. |
| `i18n/*.json` (15) | every key from both sides. No key lost from main; the 3 changed values per file are the branch's deliberate changes; no value clashes. |

Checks after resolving:
- JavaScript parse (4 scripts) and JSON-LD;
- i18n parity (2,984 keys at the merge; 2,985 with the account-deletion note);
- no new duplicate definitions against either parent;
- events Worker 103/103.

**Auto-merged, each inspected:** `CLAUDE.md`, `privacy.html`,
`backend/events/README.md`. `sw.js` keeps main's `be12-v485`, so the next
deploy is v486.

## Preserved from main
- **Practice Partner:** Visible/Hidden switch, live calls in four timed
  rounds, ringing invitations, push invitations that reach a closed app.
- **Other:** certificate redesign, Shadow "Find on YouTube", and everything
  earlier.
- **Unchanged by the merge:** the partner and push Workers and their tests
  are byte-identical to main.

## Test results (on the merge commit `87b7361` unless noted)
| Suite | Result | Note |
|---|---|---|
| entitlement Worker (run.mjs) | 61/61 | |
| entitlement Worker, stores (billing.mjs) | 95/95 | after `bfde318` (A20–A28 new) |
| events Worker | 103/103 | |
| partner Worker | 153/153 | main baseline 153/153 |
| partner.mjs | **crash** (`TimeoutError` at partner.mjs:52, the "How it works" check) | **identical crash on main `c63f7be`**: pre-existing |
| live-rounds | 22/22 | |
| hidden-switch | 15/15 | |
| live-ring | 10/10 | |
| push-invite | 19/19 | run on shifted ports (another session holds 8798) |
| push-presence | 11/13 | **main baseline: 13/13 once, then 11/13 twice.** Time-dependent on main. Inputs byte-identical to main, so it is not caused by the merge. |
| online-presence | 16/16 | |
| premium-value | 81/81 | 81/81 again after the Apple client patch |
| subscription | 29/29 | again after the patch |
| billing-client | 49/49 | again after the patch |
| entitlement-client | 46/46 | again after the patch |
| ads | 50/50 | again after the patch |
| monetization-qa | 31/31 | again after the patch |
| smoke | 33/33 | again after the patch |
| ios-storekit (new) | 22/22 | the StoreKit path end to end, with an openssl-signed Apple chain |
| shadow-challenge | crash (`innerHTML` of null) | pre-existing, recorded before this work |
| shadow-coach / helpers / first-tap / sync | 51/51, 32/32, 86/86, 82/82 | |
| polish-report / polish-track | 25/25, 14/14 | |
| language-polish | 30/31 (#1) | pre-existing |
| report-ux / report-integrity / session-report | 12/12, 40/40, 16/16 | |
| roleplay-auto-report / roleplay-speaking-report | exit 0 (all checks pass) | count not captured by the runner |
| mission-mobile-ux | 30/30 | |
| ds-phase1 / 2 / 3 | 27/27, 45/45, 11/11 | |
| ds-phase5 | exit 0 | prints no count |
| contrast-sweep | 200 text nodes below AA | Branch baseline 204. All on the road map, journey, progress and state screens; none on the new Premium screens. Does not visit Practice Partner. |
| zoom | 7/7 | |
| ios-yt-relay | 16/16 | |
| mobile/ios check-release | PASS, 0 failures, 6 warnings | warnings: no `www/` sync, no Xcode, no signing identity |

**Not run:**
- ds-phase4 and boot-recovery: other sessions hold their fixed ports
  (8066, 8768). boot-recovery was already recorded as pre-existing 3/7.
- The mission-week suites, because missions are hidden app-wide.

## Known baseline failures carried over (pre-existing on main)
- the `partner.mjs` crash at the "How it works" check;
- the `shadow-challenge` crash;
- `language-polish` #1;
- `push-presence` being time-dependent;
- the contrast debt.

## Later commits
- `d4cc447`: staging TestFlight builds reach the staging Workers
  (`npm run sync -- --staging` writes `be-build.js` into the copy only), and
  the App Store shell ignores the dev `be_ent_api` override. ios-storekit is
  23/23 after it; entitlement-client 46/46 and smoke 33/33.
- **billing-client dropped to 46/49 after `d4cc447`** (C6, C7, C9). Its
  simulated iPhone cases reached the test server through the `be_ent_api`
  override, which the iPhone app now deliberately ignores. The test now
  declares a staging iOS build (`BE_BUILD`) and serves the staging
  entitlement address from the same local Worker: 49/49 again. No app code
  changed. ios-yt-relay 16/16 after it.

## Staging (2026-09-26): staging only, production untouched
| What | State |
|---|---|
| https://staging.lomonec.com | serves **exactly `d4cc447`** (md5-checked locally and through the tunnel) |
| be-entitlements-staging | deployed from `d4cc447`: version **9778d46a**. Apple provider active (`APPLE_ROOT_SHA256`, Sandbox), `capacitor://localhost` allowed, DEV_AUTH off |
| be-events-staging | deployed from `d4cc447`: version **e533840e**, merged allow-list (cert + purchase + ad). The Worker answers 204 by design; that rows land is **not** verified (it needs an Analytics token) |
| be-partner-staging | Worker **not** redeployed (another session deployed it at 02:15Z). Its D1 lacked migrations **0009_reviews** and **0010_push_id**, which production already had; both applied (additive) |

Checks against live staging:
- smoke 33/33, monetization-qa 31/31;
- a visual sweep of 34 screens (General English + Welding × dark + light,
  390 px: Home, Road map, Shadow, Phrase Lab, Practice, Practice Partner,
  Progress, Profile, App Setup, and the Premium sheet): **0 JavaScript
  errors, 0 horizontal overflow**.

## Not done here (needs a person, a device or Apple access)
- **Physical devices:** the Android internal-test app loads staging, so it
  now runs this build. The iPhone needs an Xcode build.
- **Xcode:** the build, archive and TestFlight upload.
- **App Store Connect:** products, agreements and the Notifications V2 URLs.
- **Sandbox purchases.**
