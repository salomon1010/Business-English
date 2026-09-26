# Free-tier ad architecture: audit of what is built (2026-09-26)

This records the ad system **as implemented** on `release/premium-integration`
(from the Phase 8 work). It is not a redesign; nothing here was changed. The
new banner and interstitial behaviour from the latest product discussion is
**not** implemented.

## On or off
| Setting | Production (`FLAGS_DEFAULT`) | Staging (`FLAGS_STAGING`) |
|---|---|---|
| `ads_enabled` | **false** | **false** |
| `ads_mock_provider` | false | false |

- **With `ads_enabled` off,** `AdEligibility.decide()` answers `flag_off`
  first, whatever the plan. No ad is ever requested.
- **Turning it on for testing:** a tester opens `?flags=ads_enabled,ads_mock_provider`
  on localhost or staging. The mock provider (a labelled TEST creative) refuses
  to run on any other host.
- **Real ads:** they need the native bridge `window.BENativeAds` (an ad SDK in
  the Android and iOS shells). **Neither shell has it.** So even with the flag
  on, production has no provider (`AdProviders.none`) and shows nothing.

## Formats and where they may appear (`AD_POLICY`)
| Format | Allowed contexts | Where they come from |
|---|---|---|
| **Interstitial** (full screen, labelled, close control after 5 s) | `lesson_complete`, `session_complete`, `shadow_complete`, `practice_complete` (+ `flow_return`, `between_activities`, defined but not called anywhere) | `AdManager.markBreak()` at a finished activity: the daily session, Foundations days, the Shadow session end, the Polish report and the simulation debrief. The ad waits for the learner's **next navigation** (within 10 minutes), so it never covers the feedback itself. |
| **Native card** (labelled, in a feed) | `home_feed`, `library`, `progress_foot`, `settings_foot` | `AD_NATIVE_PLACES`: Home → `home_feed`, Progress → `progress_foot`, the Shadow library and the Phrase bank → `library`. `settings_foot` is defined but has no page. |
| **Rewarded** | `extra_practice`, `extra_ai` | Only when the learner asks (`userInitiated`). The reward is verified by the server (`/v1/rewards/*`, AdMob SSV). Every reward kind ships **disabled**. |
| **Sponsored card** | `tip_card` | Defined; no page places it. |

**Banners:** there is **no banner format**. Nothing is pinned to the screen.

## Protected learning states (`AdEligibility.protectedReason`)
No interstitial or native ad while any of these is true:
- **Audio in use:**
  - a live microphone track;
  - the session recorder is recording;
  - text-to-speech is speaking;
  - a live partner call is on;
  - the AI conversation's recorder is on;
  - a simulation is listening;
  - Polish is recording or analysing;
  - an AI answer is on its way.
- **Something else holds the screen:**
  - a flow holds ads off (`AdEligibility.protect(key)`);
  - a dialog, the sign-in sheet or any `lang-modal` sheet is open;
  - the page is hidden.
- **Learning views:** the Shadow **workspace** (the library is browsing, so it
  is allowed), plus `session`, `partner`, `roleplay`, `simulation`,
  `foundations`, `mission` and `pron`.

## Frequency caps (per format; the log is on the device, `be_ad_log`)
| Format | Minimum gap | Rolling window | Per window | Per visit | Quiet start |
|---|---|---|---|---|---|
| Interstitial | 8 min | 60 min | 3 | 4 | first 2 min |
| Native | 1 min | 60 min | 12 | 20 | — |
| Rewarded | — | 24 h | 5 | 5 | — |
| Sponsored | 30 min | 24 h | 3 | 2 | — |

## Premium
- **Premium means no ads:** `planAllowsAds()` is false when the server's view
  has `ads:false` or the plan is Premium. Then `decide()` answers `premium`.
- **A plan change withdraws ads at once:** `entApply()` calls
  `AdManager.withdraw()`, removing any visible ad.
- **The server's word counts:** the plan comes from the entitlement Worker.
  A learner who edits the cache only changes their own screen.

## Analytics
`ad_eligibility_checked`, `ad_suppressed` (with the reason), `ad_requested`,
`ad_loaded`, `ad_displayed`, `ad_dismissed`, `rewarded_ad_*`. They carry fixed
enums only (format, context, reason, provider, result) and are on the events
Worker's allow-list.

## Tests
- `tests/ads.mjs`: 50 checks.
- `tests/monetization-qa.mjs`: 31 checks, including Premium suppression and
  the protected states.
