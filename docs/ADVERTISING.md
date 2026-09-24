# Free-tier advertising (Phase 8)

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
