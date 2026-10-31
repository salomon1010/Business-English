# Free-tier advertising (Phase 8)

> **Who sees ads (owner's tier spec, 5 Oct 2026 — `docs/TIERS.md`).** The
> **free plan on General English only** — anonymous learners and Free
> accounts alike. **Welding shows no ad on any plan.** **Premium shows none
> anywhere.** `adsTrackAllows()` returns `isGeneralEnglish()` again; it is
> the single line that decides which programme carries ads. (An earlier note
> the same day had put every programme in the ad system; the tier spec
> reversed it.) privacy.html §7b says the same.

Branch `feature/phase8-ads`, built on Phase 7 (`docs/ENTITLEMENTS.md`).
**Nothing is live:**
- `ads_enabled` is off everywhere and the production provider is `none`;
- no ad-unit ids exist anywhere in the repo;
- no reward kind is enabled on the server;
- nothing is deployed.

## 1. The chain

```
a learning activity FINISHES (its result on screen)
      │  AdManager.markBreak(context)            session_complete · lesson_complete · shadow_complete · practice_complete
      ▼
the learner moves on — go() → AdManager.afterNav(v)
      │  a protected destination (a lesson, the Shadow workspace…) → the break waits for the next safe page
      ▼
AdEligibility.decide("interstitial", context)
      flag → plan (the SERVER's view) → format → context → protected learning state → AD_POLICY caps
      ▼
adProvider()  native bridge (store shells) › mock (localhost / staging only) › none
      ▼
the frame: the app dimmed behind, one large card labelled "Advertisement",
the provider's creative inside, close + "Continue to BE Mastery" after 5 s
      ▼
back on the page the learner chose
```

Nothing else in the app shows an ad. There is no `if(!premium) showAd()`
anywhere.

## 2. Formats

| format | where | status |
|---|---|---|
| **Interstitial** | natural breaks only: a finished session, Foundations day, Shadow take (report filed), workshop, conversation, or Polish report. Shown over the next browsing page the learner opens. | built, off |
| **Native / banner** | one labelled, dashed slot at the foot of Home (`home_feed`), Progress (`progress_foot`), the Shadow library (`library`) and the phrase bank (`library`). Never on a session, recorder, conversation, partner or Polish screen. | built, off |
| **Native, in content** | `library_top` — the Shadow library, between the featured video and the list of videos (owner, 4 Oct 2026). Its own host `#shLibAdHost`, because the feed below it is rebuilt by search, the chips and "show more". Hidden while searching. `settings_foot` — App Setup's foot; the policy declared it from the start and nothing filled it until 4 Oct 2026. Both are the same labelled, dashed card, and both obey the same decide() chain. |
| **Rewarded** | `AdManager.rewarded(kind, context, {userInitiated:true})`, only from a learner's own tap. The reward is server-verified (§5). **No screen offers one:** no metered Free allowance exists yet for a reward to extend. | built, no entry point |
| **Sponsored learning content** | the format and its policy exist (`AD_POLICY.sponsored`); `AdManager.sponsored()` returns nothing because no provider supplies it. | designed |

## 3. Frequency (`AD_POLICY`, one place to tune)

Interstitials are **moderate**:
- at most one per natural break;
- never two within **8 minutes**;
- at most **3 per rolling hour** and **4 per visit**;
- none in the **first 2 minutes** of a visit;
- the close control appears after **5 s** whatever the provider does.

Native slots:
- at most one per page;
- 60 s between fills, 12 per hour, 20 per visit.

The counters are per device (`localStorage.be_ad_log` plus the visit). That
is enough for UX; it is not billing.

## 4. Protected learning states — an ad is refused while any is true

- **Voice:** any live microphone stream (`DS.voice` sees every recorder:
  session, Shadow, Polish, roleplay, simulation, partner), `rec` recording,
  or speech synthesis speaking.
- **Live partner:** a human partner session (`ppLive`).
- **AI:**
  - an AI voice turn (`rpRec`);
  - waiting for an AI reply (`rpConv.busy`);
  - a simulation listening;
  - Executive Polish recording or assessing.
- **Page state:**
  - an open dialog, or a hidden page;
  - the screens where learning is interactive: session, Shadow **workspace**
    (not the library), partner, roleplay, simulation, Foundations, mission and
    pronunciation.
- **Explicit holds** set by a flow (`AdEligibility.protect(key)`).

A break is never spent on a protected page: it waits for the next safe one.
A break older than 10 minutes is dropped.

### 4b. A native ad is a PLATFORM view — the page must say what covers it

(12 Oct 2026, from four photos of the owner's Android phone: an ad halfway
down the Shadow transcript, an ad over the speaking report, and two ads on
screen at once.)

In the store shells a "native advanced" ad is **not** a node in the page. The
page keeps the label, the reserved space and the Premium link; the shell draws
the creative in a view of its own, **above the WebView**. So nothing the page
does can cover, scroll away or hide it — only the shell can, and only if the
page tells it to.

The follower (`watch` / `syncNow` in `beNativeAdsInit`) used to ask two
questions: is the slot still in the document, and where is it. Both can be
true of a slot the learner cannot see. The Shadow **workspace** is a
full-screen overlay inside `#v-shadow`, so opening a clip left the library's
two slots (`library`, `library_top`) in the document behind it, still
followed, and still painted on top of the lesson. None of the stray "ads" in
those photos was the workspace's own slot.

It now recomputes, on every sync, whether the learner can actually see the
slot — the app's existing rules, not a new one:

- the slot is in the document and has a real box;
- programme and plan still allow it (as before);
- `AdEligibility.protectedReason(place)` is null **now**, which is what
  refuses every placement but `shadow_video` while the workspace is open;
- nothing is full screen (`document.fullscreenElement`);
- and its rectangle lies wholly inside the viewport.

The answer rides on `showNative` / `moveNative` as `visible`; both plugins
(`BEAdsPlugin.java`, `BEAdsPlugin.swift`) hide the view rather than remove it,
so the creative and its impression survive and the ad comes back when the
overlay goes — no new request, no second impression.

Two more things changed with it:

- the follower syncs on **scroll** (capture, passive) into one
  `requestAnimationFrame`, with a 400 ms tick for the policy re-check. The old
  250 ms poll left the view a quarter of a second behind the slot during a
  scroll, which is what "the ad floats" looked like;
- `svPlace` pins `#shAdHost` to the transcript's own previous sibling, so the
  order is **video → ad → transcript** in Watch, Shadow and Challenge alike.
  Watch lifts the transcript above the clip tools and used to leave the host
  behind it — where `shLowerShow`'s sibling walk then set it to
  `display:none`, i.e. 0×0, i.e. one wasted attempt per clip.

Suite: `tests/shadow-ad-slot.mjs` (52).

## 5. Rewarded: how a reward is earned

1. `POST /v1/rewards/start {kind}` (signed-in; the kind must be enabled
   server-side; refused for Premium; daily cap per kind) → a single-use
   `nonce`.
2. The ad network confirms **server to server** that the ad bound to that
   nonce was watched: `POST /v1/rewards/verify/:provider`. `mock` exists only
   with `MOCK_REWARDS="1"` (dev/test); `admob` returns 501 until Phase 9
   (AdMob server-side verification, signed with Google's keys).
   `provider_txn` is UNIQUE, so one watched ad verifies one session.
3. `POST /v1/rewards/claim {nonce}` credits the kind once. It is one
   conditional UPDATE, so racing claims cannot both win, and a replay returns
   `credited:false`.

The client never reports its own completion, and a body field such as
`completed:true` is ignored.

## 6. Providers (`AdProviders` in index.html)

| id | when | what |
|---|---|---|
| `none` | production default | never shows anything |
| `mock` | flag `ads_mock_provider`, on localhost / staging only | a labelled TEST creative; rewarded calls the dev Worker's mock verifier |
| `native` | when the iOS / Android shell provides `window.BENativeAds` | adapter for the store SDKs: AdMob via Capacitor, Play / StoreKit-side mediation. **Not provided today**, so never available. |

The contract a provider implements is documented at the top of the
ADVERTISING block in index.html: `available`, `supports`, `preload`, `load`,
`isReady`, `show`, `dismiss` and `renderNative`. A web network (for example
Google Ad Manager / AdSense) is a Phase 9 decision. It must not run inside the
App Store build.

## 7. Analytics (`be-events`; README "Advertising events")

The events are `ad_eligibility_checked`, `ad_suppressed`, `ad_requested`,
`ad_loaded`, `ad_displayed`, `ad_dismissed`, `rewarded_ad_started` and
`rewarded_ad_completed`.

Their props are `format`, `context`, `reason`, `provider` and `result`: fixed
enums only. There is no creative, advertiser, network id, nonce or learner
data. The Worker must be redeployed before these rows land.

## 8. Premium

Premium is decided centrally: `AdEligibility.planAllowsAds()` reads the
server's view (Phase 7). A Premium learner gets:
- no interstitial, native, rewarded or sponsored ad;
- no reward can be started for them (the server refuses);
- slots already on screen are withdrawn the moment the server says Premium.

## 9. Before real ads (owner decisions, not done)

1. **A network per surface:**
   - native SDKs (AdMob) in the Android TWA and the iOS Capacitor shell,
     through a `BENativeAds` bridge;
   - a web network, if any, for app.lomonec.com only.
2. **Unit ids and keys** stay outside source control: the shells' build
   config and Worker secrets.
3. **Consent and privacy:**
   - EU/UK consent (a certified CMP for AdMob / Google);
   - iOS App Tracking Transparency;
   - Play Data Safety, and Apple privacy labels plus the privacy manifest;
   - privacy.html §ads;
   - COPPA/age signals: the app is 18+ for partner features, but ads apply
     to all learners.
4. **SSV** for rewarded (Phase 9), then enable a reward kind server-side,
   and only once a metered allowance exists for it to extend.
5. Deploy `be-events` with the new allow-list, and `be-entitlements`.
6. Turn `ads_enabled` on, watch `ad_suppressed` reasons and retention for a
   week, then tune `AD_POLICY`.

### 9b. The AdMob account (created by the owner, 8 Oct 2026)

Publisher `pub-2222980379604934` (Lomonec). AdMob ids are public by design
(they ship inside every app binary); what must never happen is a developer
or tester requesting a REAL ad, so every debug / staging build swaps the
units for Google's test units (`BEAdsPlugin.testUnitsAllowed`).

| App | App ID | Interstitial | Native advanced | Wired in |
|---|---|---|---|---|
| iOS | `ca-app-pub-2222980379604934~5854778049` | `ca-app-pub-2222980379604934/2444172761` | `ca-app-pub-2222980379604934/2737570820` | `mobile/ios/ios/App/App/Info.plist` |
| Android | `ca-app-pub-2222980379604934~8875603763` | `ca-app-pub-2222980379604934/7191910447` | `ca-app-pub-2222980379604934/1935625045` | `mobile/android/android/app/src/main/res/values/ads.xml` (the Capacitor shell's `BEAdsPlugin.java`; the Play app is no longer a TWA) |

**ON IN PRODUCTION (owner, 31 Oct 2026, be12-v700).** `ads_enabled` is true in
`FLAGS_DEFAULT`. The web has no provider, so app.lomonec.com shows no ad; the
store apps show them from the build that carries this bundle (Android General
English 1.2.7 (26) / Welding 1.0.7 (11); iPhone 1.1.2 (7) / Welding 1.0.1 (4)).
Before any of those reaches production the owner must: declare **Contains ads:
Yes** and update **Data safety** in Play Console (both apps — Welding shows ads in
the game hubs), update the App Store **privacy answers** (advertising data), and
finish the AdMob **payment profile**. Rollback = `ads_enabled:false` + a store build.

`app-ads.txt` on lomonec.com authorises the publisher. Still open on the
owner's side: the AdMob payment profile, and linking the App Store listing
once it is published (the Android app is already linked to its Play listing).

## 10. Verification
- **Physical-device check (2026-09-24): PASSED**, reported by the owner after
  testing on a real iPhone. The preview served commit `931b805` unchanged, and
  the app opened in its production state: ads off, provider `none`. A preview-only
  "Ads test mode" set `ads_enabled` and `ads_mock_provider` for that device
  and, inside the preview frame, lifted the mock's localhost/staging hostname
  guard and the 2-minute quiet start. "Simulate Premium" set the display view
  only, because no entitlement server is deployed. Covered:
  - the interstitial after a finished session, Shadow take or practice,
    over the page the learner chose;
  - the close / Continue controls after 5 s;
  - the frequency gap;
  - held breaks during learning;
  - native slots at the foot of Home, Progress and the Shadow library, and
    none on learning screens;
  - Premium suppression;
  - Light mode borders;
  - General English only; Welding shows no ad on any plan (owner's tier
    spec, 5 Oct 2026 — this reverses a note earlier the same day that had
    included Welding).
- **Automated tests:**
  - `tests/ads.mjs` 48/48;
  - `backend/entitlements/test/run.mjs` 61/61 (reward single-use and
    transaction replay mutation-checked);
  - `backend/events/test/run.mjs` 94/94;
  - `tests/entitlement-client.mjs` 46/46 (Phase 7 client, adapted to the
    moderate policy);
  - the partner Worker 153/153 (local `wrangler dev`);
  - smoke 33/33, and the design Phases 1–5 gates;
  - Shadow, Polish, session, report and mission suites.
- **Failures also present on main:**
  - language-polish test 1;
  - shadow-challenge's line-398 crash (after 85 passes);
  - the partner end-to-end `.pp-how-link` timeout.

## Game hubs on both programmes (owner, 10 Oct 2026)

The owner reversed "Welding shows no ad" **for the game hubs only**:
- `adsTrackAllows(ctx)` is true on General English, and on Welding only for the
  game-hub contexts (`GAME_AD_CONTEXTS`: `game_hub`, `game_hub_mid`, `game_end`,
  `game_complete`) while Welding Mastery is open (`WMUI.on()`). Every call without
  a context — and every other Welding page — stays ad-free.
- Native: `game_hub` at the foot of every hub tab, `game_hub_mid` mid-page on the
  long tabs (Games grid, Journey list, Collection list, History, Rewards, Stats),
  `game_end` under the buttons of a round's results screen. Hosts are drawn by
  `adsPlace()` / `finish()` in welding-mastery.js (and, assembled, english-mastery.js).
- Interstitial: `game_complete`, armed by a finished round and offered when the
  learner closes it (`gameClose` → `AdManager.afterNav`). Its own caps
  (`AD_POLICY.interstitial.byContext`): 4 min apart, 6 an hour, 8 a visit; every
  other break keeps 8 min / 3 / 4.
- Never during a round: `protectedReason` answers `game` while a round overlay is
  open, except `game_end` on the results screen.
- Premium removes all of them (`planAllowsAds`). Tests: `tests/game-ads.mjs` (18).
