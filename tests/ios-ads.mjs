/* iOS (App Store shell) — the AdMob bridge, the consent gate and the StoreKit
   price fixture. Run: cd tests && node ios-ads.mjs

   What is real: index.html (beNativeAdsInit, adsSystemLive, AdProviders.native,
   AdEligibility, AdManager), the StoreKit fixture, BEAdsPlugin.swift, the Xcode
   project, Info.plist and PrivacyInfo.xcprivacy — read off disk.
   What is played: the Capacitor bridge and the Swift plugin — a fake `BEAds`
   plugin with the same method names and answers as BEAdsPlugin.swift, so the
   whole JS side of the contract runs.
   What this cannot prove: that Google's SDK on a device fills, that the UMP
   form appears in an EEA region, or that a platform view lands exactly over
   the slot. That needs a device, a real AdMob account and TestFlight — see
   docs/ADS-IOS-RELEASE.md. Ads ship OFF: this suite turns them on itself. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8103), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

const IOS = "mobile/ios/ios/App/App/";   /* Swift sources sit in Lifecycle/ and Plugins/; plists and the fixture at the top */
const SWIFT = read(IOS + "Plugins/BEAdsPlugin.swift");
/* the file explains its own rules in prose, so the "nothing like this anywhere"
   checks read the CODE with comments stripped */
const CODE = SWIFT.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const BRIDGEVC = read(IOS + "Lifecycle/BEBridgeViewController.swift");
const PBX = read("mobile/ios/ios/App/App.xcodeproj/project.pbxproj");
/* the per-configuration app id: Debug may serve test creatives, Release may not.
   Each XCBuildConfiguration block ends with its own `name = Debug|Release;`, so
   the value has to be read inside one block, never across them. */
const cfgAppId = want => {
  for (const b of PBX.split("isa = XCBuildConfiguration;")) {
    const id = /BE_ADS_APP_ID = "([^"]+)"/.exec(b), nm = /\n\t\t\tname = (Debug|Release);/.exec(b);
    if (id && nm && nm[1] === want && /PRODUCT_BUNDLE_IDENTIFIER/.test(b)) return id[1];
  }
  return null;
};
const PLIST = read(IOS + "Info.plist");
const PRIV = read(IOS + "PrivacyInfo.xcprivacy");
const INDEX = read("index.html");

/* ============================================================ 1. the StoreKit price fixture */
console.log("\n# the StoreKit fixture (Xcode's local store for testing)");
{
  const fx = JSON.parse(read(IOS + "BEMastery.storekit"));
  const subs = fx.subscriptionGroups[0].subscriptions;
  const byId = Object.fromEntries(subs.map(s => [s.productID, s]));
  /* App Store Connect's ids (owner, 6 Oct 2026) — Google Play keeps premium_* */
  const M = byId.BEMastery_Premium, A = byId.BEMastery_Annual;
  ok("S1 · one subscription group with exactly the two App Store products the app sells",
    fx.subscriptionGroups.length === 1 && subs.length === 2 && !!M && !!A, JSON.stringify(subs.map(s => s.productID)));
  /* the tier spec (docs/TIERS.md, 5 Oct 2026): US$19.99 a year, US$2.99 a month —
     Xcode's local store only; the app always draws the store's own displayPrice */
  ok("S2 · BEMastery_Annual is $19.99 a year (the tier spec, 5 Oct 2026)",
    A.displayPrice === "19.99" && A.recurringSubscriptionPeriod === "P1Y", A.displayPrice + " " + A.recurringSubscriptionPeriod);
  ok("S3 · BEMastery_Premium is $2.99 a month, and is offered again beside the annual plan",
    M.displayPrice === "2.99" && M.recurringSubscriptionPeriod === "P1M", M.displayPrice + " " + M.recurringSubscriptionPeriod);
  /* The 3-day free trial sits on the ANNUAL product, not the monthly one. That
     moved with the Premium line (184f3a0e onwards): annual is the only offer the
     sheet draws, so the trial has to be on the plan a learner can actually pick.
     mobile/ios/appstore/SUBSCRIPTIONS.md is the table this must agree with. */
  /* owner, 6 Oct 2026: the 3-day free trial is on BOTH plans (Apple grants it
     once per subscription group, whichever plan is picked). Play mirrors it
     with a trial3d offer on both base plans. */
  const io = x => x.introductoryOffer && x.introductoryOffer.paymentMode === "free" && x.introductoryOffer.subscriptionPeriod === "P3D";
  ok("S3b · the 3-day free trial is on BOTH products (owner, 6 Oct 2026)", io(A) && io(M),
    JSON.stringify({ annual: A.introductoryOffer, monthly: M.introductoryOffer || null }));
  /* the fixture is for Xcode only — the app must never read a price from it */
  const hard = /(?:displayPrice|price)\s*[:=]\s*["']?\$?(?:24\.99|19\.99|4\.99)/.test(INDEX);
  ok("S4 · the app shows the STORE's own price: no 24.99 / 19.99 / 4.99 is written into index.html", !hard,
    (INDEX.match(/.{0,40}(?:24\.99|19\.99).{0,40}/) || [""])[0]);
  ok("S5 · the price the app draws comes from the product the store returned (displayPrice)",
    /displayPrice/.test(INDEX) && /BILLING_PRODUCTS=Object\.freeze\(\["premium_monthly","premium_annual"\]\)/.test(INDEX));
  /* one list in three places: the Swift allow-list, the web layer's App Store
     list and this fixture. A mismatch is an empty Premium sheet on the iPhone. */
  const SK = read(IOS + "Plugins/BEStoreKitPlugin.swift");
  const swiftIds = ((SK.match(/static let allowed: Set<String> = \[([^\]]*)\]/) || [])[1] || "").match(/"[^"]+"/g) || [];
  const webIds = ((INDEX.match(/APP_STORE_PRODUCTS=Object\.freeze\(\[([^\]]*)\]\)/) || [])[1] || "").match(/"[^"]+"/g) || [];
  const fxIds = subs.map(s => JSON.stringify(s.productID));
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  ok("S6 · BEStoreKitPlugin.allowed, APP_STORE_PRODUCTS and the StoreKit fixture name the same two App Store ids",
    swiftIds.length === 2 && same(swiftIds, webIds) && same(swiftIds, fxIds) && same(swiftIds, ['"BEMastery_Premium"', '"BEMastery_Annual"']),
    JSON.stringify({ swiftIds, webIds, fxIds }));
  ok("S7 · the StoreKit provider asks for the App Store ids, not Google Play's",
    /getProducts\(APP_STORE_PRODUCTS\.slice\(\)\)/.test(INDEX) && !/BENativeBilling\.getProducts\(BILLING_PRODUCTS/.test(INDEX));
}

/* ============================================================ 2. the Swift plugin, as written */
console.log("\n# BEAdsPlugin.swift — two formats, fail closed, no tracking");
{
  ok("X1 · it is a Capacitor bridged plugin called BEAds", /class BEAdsPlugin: CAPPlugin, CAPBridgedPlugin/.test(SWIFT) && /jsName = "BEAds"/.test(SWIFT));
  const methods = [...SWIFT.matchAll(/CAPPluginMethod\(name: "(\w+)"/g)].map(m => m[1]);
  ok("X2 · it exposes exactly the bridge's methods, and no more",
    methods.join(",") === "configure,load,isReady,show,dismiss,showNative,moveNative,hideNative", methods.join(","));
  ok("X3 · INTERSTITIAL and NATIVE only — rewarded and sponsored are not implemented",
    /static let formats = \["interstitial", "native"\]/.test(CODE) && !/[Rr]ewarded/.test(CODE) && !/[Ss]ponsored/.test(CODE), (CODE.match(/.{0,40}[Rr]ewarded.{0,30}/) || [""])[0]);
  ok("X4 · every ad request is NON-PERSONALISED (npa=1) and no other request builder exists",
    /additionalParameters = \["npa": "1"\]/.test(SWIFT) && (SWIFT.match(/= Request\(\)/g) || []).length === 1);
  ok("X5 · no App Tracking Transparency, no advertising identifier",
    !/ATTrackingManager|AppTrackingTransparency|advertisingIdentifier|ASIdentifier/.test(CODE), (CODE.match(/.{0,40}(?:ATTracking|advertisingIdentifier).{0,30}/) || [""])[0]);
  ok("X6 · consent is resolved BEFORE the SDK is started, and an unresolved answer means no ads",
    SWIFT.indexOf("resolveConsent {") < SWIFT.indexOf("MobileAds.shared.start")
    && /guard self\.canRequestAds else \{[\s\S]{0,120}unavailable\("consent"\)/.test(SWIFT));
  ok("X7 · every consent outcome still answers: update failure, no view controller, form failure",
    (SWIFT.match(/done\(\)/g) || []).length >= 5 && /canRequestAds = false/.test(SWIFT));
  ok("X8 · nothing can crash the app: no force unwrap of an optional, no try!, no fatalError",
    !/\btry!/.test(CODE) && !/fatalError/.test(CODE) && !/\bas!\s/.test(CODE) && !/[a-zA-Z0-9_)\]]!\./.test(CODE), (CODE.match(/.{0,40}(?:try!|fatalError|as! ).{0,30}/) || [""])[0]);
  ok("X9 · the SDK may be absent: every GMA/UMP use is behind canImport, with an honest 'no_sdk'",
    /#if canImport\(GoogleMobileAds\)/.test(SWIFT) && /#if canImport\(UserMessagingPlatform\)/.test(SWIFT) && /unavailable\("no_sdk"\)/.test(SWIFT));
  ok("XA · the ids are shape-checked and a build with none reports 'not_configured'",
    /unavailable\("not_configured"\)/.test(CODE)
    && /\^ca-app-pub-\[0-9\]\{16\}~\[0-9\]\{10\}\$/.test(CODE) && /\^ca-app-pub-\[0-9\]\{16\}\/\[0-9\]\{10\}\$/.test(CODE));
  ok("XAa · Google's TEST units are allowed in a debug build, or in a staging build that asks — never otherwise",
    /#if DEBUG\s*\n\s*return true/.test(CODE) && /BEAdsAllowTestUnits/.test(CODE) && /return asked && sandboxBuild/.test(CODE));
  /* the APP id may never be substituted: MobileAds.start reads Info.plist
     itself, and starting it on an invalid id throws where Swift cannot catch */
  ok("XAd · only the ad UNIT ids fall back to Google's test units — the APP id must be valid in Info.plist",
    /validAppId\(appId\)/.test(CODE) && !/effectiveAppId/.test(CODE)
    && /if BEAdsPlugin\.testUnitsAllowed \{[\s\S]{0,260}?testInterstitial[\s\S]{0,160}?testNative[\s\S]{0,40}?\}/.test(CODE)
    && !/validAppId\([\s\S]{0,40}testAppId/.test(CODE));
  ok("XAb · the second lock cannot be undone from a plist: a production App Store receipt refuses test creatives",
    /url\.lastPathComponent != "receipt"/.test(CODE) && /Bundle\.main\.appStoreReceiptURL/.test(CODE));
  /* The switch is ON for staging device QA (owner, 2 Oct 2026). What keeps a
     production build safe is no longer this value but the pair below it. */
  ok("XAc · the staging switch is on, and the Sandbox-receipt lock is what holds production",
    /<key>BEAdsAllowTestUnits<\/key>\s*<true\/>/.test(PLIST) && /return asked && sandboxBuild/.test(CODE));
  ok("XAe · the AdMob app id is set per BUILD CONFIGURATION, not hard-coded in the plist",
    /<key>GADApplicationIdentifier<\/key>\s*<string>\$\(BE_ADS_APP_ID\)<\/string>/.test(PLIST));
  ok("XAf · Debug gets Google's public TEST app id; RELEASE keeps the placeholder, so a production build cannot serve an ad",
    cfgAppId("Debug") === "ca-app-pub-3940256099942544~1458002511" && cfgAppId("Release") === "ca-app-pub-REPLACE~REPLACE",
    JSON.stringify({ Debug: cfgAppId("Debug"), Release: cfgAppId("Release") }));
  ok("XB · no fill, no scene and a failed present are ordinary answers, not errors",
    /no fill is not an error/.test(SWIFT) && /didFailToPresentFullScreenContentWithError/.test(SWIFT) && /didFailToReceiveAdWithError/.test(SWIFT));
  ok("XC · a native creative is labelled 'Ad', as Google requires",
    /badge\.text = "Ad"/.test(SWIFT) && /view\.nativeAd = nativeAd/.test(SWIFT));
}

/* ============================================================ 3. registration and project wiring */
console.log("\n# plugin registration and the Xcode project");
{
  ok("R1 · BEBridgeViewController registers BEAdsPlugin beside StoreKit and Auth",
    /registerPluginInstance\(BEAdsPlugin\(\)\)/.test(BRIDGEVC) && /registerPluginInstance\(BEStoreKitPlugin\(\)\)/.test(BRIDGEVC) && /registerPluginInstance\(BEAuthPlugin\(\)\)/.test(BRIDGEVC));
  ok("R2 · the source file is in the project and in the Sources build phase",
    /BEAdsPlugin\.swift \*\/ = \{isa = PBXFileReference/.test(PBX) && /BEAdsPlugin\.swift in Sources \*\/,/.test(PBX));
  ok("R3 · Google Mobile Ads is a remote Swift package, pinned to a major version",
    /repositoryURL = "https:\/\/github\.com\/googleads\/swift-package-manager-google-mobile-ads\.git"/.test(PBX)
    && /kind = upToNextMajorVersion;[\s\S]{0,40}minimumVersion = 12\.0\.0;/.test(PBX));
  ok("R4 · both products are linked: GoogleMobileAds and GoogleUserMessagingPlatform (UMP ships WITH the ads package)",
    /productName = GoogleMobileAds;/.test(PBX) && /productName = GoogleUserMessagingPlatform;/.test(PBX)
    && /GoogleMobileAds in Frameworks \*\/,/.test(PBX) && /GoogleUserMessagingPlatform in Frameworks \*\/,/.test(PBX)
    && !/user-messaging-platform\.git/.test(PBX));
  ok("R5 · Capacitor's own Package.swift is untouched (the CLI owns it)",
    !/GoogleMobileAds/.test(read("mobile/ios/ios/App/CapApp-SPM/Package.swift")));
}

/* ============================================================ 4. Info.plist and the privacy manifest */
console.log("\n# Info.plist and PrivacyInfo.xcprivacy");
{
  ok("P1 · the AdMob app id and both ad units are declared", /<key>GADApplicationIdentifier<\/key>/.test(PLIST) && /<key>BEAdsInterstitialUnitId<\/key>/.test(PLIST) && /<key>BEAdsNativeUnitId<\/key>/.test(PLIST));
  ok("P2 · the ad UNITS are still PLACEHOLDERS, so no real ad unit can be requested by accident", (PLIST.match(/ca-app-pub-REPLACE\/REPLACE/g) || []).length === 2);
  ok("P2b · and no real AdMob account id appears anywhere in the plist", !/ca-app-pub-(?!3940256099942544)[0-9]{16}/.test(PLIST), (PLIST.match(/ca-app-pub-[0-9]{16}[~/][0-9]{10}/g) || []).join(","));
  ok("P3 · no App Tracking Transparency prompt is declared (this release is non-personalised)", !/<key>NSUserTrackingUsageDescription<\/key>/.test(PLIST));
  ok("P4 · no SKAdNetwork attribution list (nothing is attributed without tracking)", !/<key>SKAdNetworkItems<\/key>/.test(PLIST));
  ok("P5 · the existing purpose strings are untouched", /NSMicrophoneUsageDescription/.test(PLIST) && /NSSpeechRecognitionUsageDescription/.test(PLIST) && /NSCameraUsageDescription/.test(PLIST));
  ok("P6 · the privacy manifest still says: no tracking, no tracking domains", /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(PRIV) && /<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/.test(PRIV));
  ok("P7 · Advertising Data is declared, not linked to the learner and not used for tracking",
    /NSPrivacyCollectedDataTypeAdvertisingData/.test(PRIV)
    && /NSPrivacyCollectedDataTypeAdvertisingData<\/string>\s*<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<false\/>\s*<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<false\/>/.test(PRIV)
    && /NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising/.test(PRIV));
}

/* ============================================================ 5. privacy.html says what will happen */
console.log("\n# privacy.html");
{
  const PRIVACY = read("privacy.html");
  /* the only "shows no ads" left is the true one — Welding's — and the old
     app-wide "no advertising or social-media trackers" claim is gone */
  ok("H1 · no claim that the APP shows no ads survives anywhere in it — the one 'shows no ads' is the Welding sentence",
    (PRIVACY.match(/shows no ads/g) || []).length === (PRIVACY.match(/Welding shows no ads on any plan/g) || []).length && (PRIVACY.match(/shows no ads/g) || []).length >= 1 && !/no advertising or social-media trackers/.test(PRIVACY));
  ok("H2 · section 7b says ads are not switched on yet, and says so first", /Ads are not switched on/.test(PRIVACY));
  ok("H3 · it states the product rule as it now is (the tier spec, 5 Oct 2026): the free plan, General English only; Welding shows no ads on any plan; Premium removes them completely",
    /On the free plan, in <b>General English only<\/b>/.test(PRIVACY) && /Welding shows no ads on any plan/.test(PRIVACY) && /Premium removes ads completely/.test(PRIVACY) && !/both programmes/.test(PRIVACY) && !/ad-free for everyone/.test(PRIVACY));
  ok("H4 · it states non-personalised, no IDFA, no tracking prompt", /non-personalised/.test(PRIVACY) && /IDFA/.test(PRIVACY) && /do not ask for permission to track you/.test(PRIVACY));
  ok("H5 · it names the network and what it receives, and does not claim personalised tracking",
    /Google AdMob/.test(PRIVACY) && /coarse location/.test(PRIVACY) && !/personalised advertising profile of you/.test(PRIVACY));
  ok("H6 · it states the consent rule: refuse, or no form, means no ad is requested", /no ad is requested at all/.test(PRIVACY));
  ok("H7 · it states that nothing interrupts practice and that there is no banner", /never shown while you are practising|never interrupt/i.test(PRIVACY) && /no banner pinned to the screen/.test(PRIVACY));
}

/* ============================================================ 6. the bridge in a browser */
const b = await chromium.launch();
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

/* the fake BEAds plugin — the same method names and answers as BEAdsPlugin.swift */
const PLUGIN = ([cfg]) => {
  const ad = window.__ad = { calls: [], cfg, fill: true, shown: 0, natives: {}, throwOn: "" };
  const log = (n, a) => ad.calls.push(n + (a && a.format ? ":" + a.format : "") + (a && a.placement ? ":" + a.placement : ""));
  const P = {
    configure: async () => { log("configure"); if (ad.throwOn === "configure") throw new Error("boom"); return ad.cfg; },
    load: async a => { log("load", a); if (ad.throwOn === "load") throw new Error("boom"); return { ready: !!ad.fill }; },
    isReady: async a => ({ ready: !!ad.fill }),
    show: async a => { log("show", a); if (ad.throwOn === "show") throw new Error("boom"); if (!ad.fill) return { shown: false }; ad.shown++; return { shown: true, completed: true, closable: true }; },
    dismiss: async () => { log("dismiss"); },
    showNative: async a => { log("showNative", a); if (ad.throwOn === "showNative") throw new Error("boom"); if (!ad.fill) return { shown: false }; ad.natives[a.placement] = { x: a.x, y: a.y, w: a.w, h: a.h }; return { shown: true }; },
    moveNative: async a => { ad.moved = (ad.moved || 0) + 1; if (ad.natives[a.placement]) ad.natives[a.placement] = { x: a.x, y: a.y, w: a.w, h: a.h }; },
    hideNative: async a => { log("hideNative", a); delete ad.natives[a.placement]; },
  };
  /* THE REAL iOS BRIDGE SHAPE. Capacitor's native-bridge.js injects
     `Capacitor.Plugins.<jsName>` (JSExport.exportJS) and its twenty methods do
     NOT include registerPlugin — that is an @capacitor/core API this unbundled
     shell never loads. The old stub invented registerPlugin, which is exactly
     why 80 checks passed against a bridge that could not work on a device, so
     registerPlugin is deliberately ABSENT here. */
  window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true,
    Plugins: { BEAds: P }, PluginHeaders: [{ name: "BEAds" }] };
};
/* Capacitor is there and exposes Plugins, but BEAds is not among them */
const NOPLUGIN = () => { window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, Plugins: {}, PluginHeaders: [] }; };
/* the shell as it really is, with the plugin present, used for the latch checks */
const PLUGIN_SLOW = ([cfg]) => {
  const ad = window.__ad = { calls: [], cfg, fill: true, shown: 0, natives: {}, throwOn: "", answer: null };
  const P = { configure: async () => { ad.calls.push("configure"); if (ad.throwOn === "configure") throw new Error("boom"); return ad.answer || ad.cfg; },
    load: async () => ({ ready: true }), isReady: async () => ({ ready: true }), show: async () => ({ shown: true, completed: true }),
    dismiss: async () => {}, showNative: async () => ({ shown: true }), moveNative: async () => {}, hideNative: async () => {} };
  window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, Plugins: { BEAds: P }, PluginHeaders: [{ name: "BEAds" }] };
};
/* not the App Store shell */
const NOCAP = () => { delete window.Capacitor; };

async function open({ track = "general-english", ios = PLUGIN, cfg = { available: true, formats: ["interstitial", "native"], npa: true, consent: "can_request" }, billing = true, ent = true, ads = true, premium = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: "light" });
  await ctx.addInitScript(([s, f, e]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", JSON.stringify(f)); if (e) window.BE_BUILD = { env: "staging" }; }, [seed(track), { ads_enabled: ads, billing_enabled: billing }, ent]);
  await ctx.addInitScript(ios, [cfg]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  /* the entitlement service, answering the plan this case is about */
  await ctx.route(/be-entitlements-staging/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(premium ? { plan: "premium", paid: true, state: "active", ads: false, capabilities: { ad_free: true } } : { plan: "free", paid: false, state: "none", ads: true, capabilities: { ad_free: false } }) }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    window.__ev = []; track = (n, pr) => { window.__ev.push([n, pr || {}]); }; AD_BOOT = Date.now() - 10 * 60e3; });
  if (premium || ent) await p.evaluate(async () => { FBUser = { uid: "u1", getIdToken: async () => "t" }; await entRefresh(); });
  await p.evaluate(() => { try { beNativeAdsInit(); } catch (e) {} });
  await sleep(500);
  return { ctx, p, errs };
}
const bridge = p => p.evaluate(() => ({
  live: adsSystemLive(), ios: IS_IOS_APP, flag: flag("ads_enabled"), track: adsTrackAllows(),
  built: typeof window.BENativeAds, provider: adProvider().id,
  calls: (window.__ad || {}).calls || [],
  supports: window.BENativeAds ? ["interstitial", "native", "rewarded", "sponsored"].filter(f => window.BENativeAds.supports(f)) : null,
}));

console.log("\n# the activation guard: a real network only where the plan system is live (Part 6)");
{
  const { ctx, p } = await open({ billing: false });
  const s = await bridge(p);
  ok("G1 · billing off → adsSystemLive() is false and no bridge is built, even with ads_enabled on",
    s.flag === true && s.live === false && s.built === "undefined" && s.provider === "none" && s.calls.length === 0, JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, p } = await open({ ent: false });
  const s = await bridge(p);
  ok("G2 · no entitlement service → adsSystemLive() is false; a learner who has paid cannot be told apart, so nobody sees an ad",
    s.live === false && s.built === "undefined" && s.calls.length === 0, JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, p } = await open({ ads: false });
  const s = await bridge(p);
  ok("G3 · ads_enabled off → the SDK is never even asked to configure", s.flag === false && s.built === "undefined" && s.calls.length === 0, JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, p } = await open({ track: "welding" });
  const s = await bridge(p);
  const ev = await p.evaluate(() => window.__ev.filter(([n]) => /^ad_|^rewarded_ad_/.test(n)).map(([n]) => n));
  /* the tier spec (docs/TIERS.md, 5 Oct 2026): ads are General English only and
     Welding shows none on any plan — so the SDK is never even built there */
  ok("G4 · WELDING never reaches the ad SDK: the programme refuses (adsTrackAllows false), no bridge is built, the provider stays 'none', no call and no ad event",
    s.track === false && s.built === "undefined" && s.provider === "none" && s.calls.length === 0 && ev.length === 0, JSON.stringify({ s, ev }));
  await ctx.close();
}
{
  const { ctx, p } = await open({ ios: NOCAP });
  const s = await bridge(p);
  /* the invariant is the NATIVE bridge, not the absence of any provider: on a
     staging web page the labelled test card stands in (5 Oct 2026), which is
     how the owner sees the placements without a device build */
  ok("G5 · outside the App Store shell no native bridge is built and Google's SDK is never reached", s.ios === false && s.built === "undefined" && s.provider !== "native" && s.calls.length === 0, JSON.stringify(s));
  await ctx.close();
}

console.log("\n# the plugin, and the SDK, may not be there");
{
  const { ctx, p, errs } = await open({ ios: NOPLUGIN });
  const s = await bridge(p);
  ok("U1 · BEAds absent from Capacitor.Plugins: no bridge, no provider, no error reaches the page",
    s.built === "undefined" && s.provider === "none" && errs.length === 0, JSON.stringify({ s, errs }));
  await ctx.close();
}
{
  const { ctx, p, errs } = await open({ cfg: { available: false, reason: "no_sdk", formats: [] } });
  const s = await bridge(p);
  /* Updated 2 Oct 2026 with the latch fix: an unavailable answer is no longer
     remembered, so a later navigation ASKS AGAIN. The invariant that matters is
     that nothing is ever built and nothing is latched, however often it asks. */
  ok("U2 · the SDK is not linked ('no_sdk'): nothing is built, nothing latched, and asking again is allowed",
    s.calls.length >= 1 && s.calls.every(c => c === "configure") && s.built === "undefined" && s.provider === "none"
    && (await p.evaluate(() => _adsBridge)) === false && errs.length === 0, JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, p } = await open({ cfg: { available: false, reason: "not_configured", formats: [] } });
  const s = await bridge(p);
  ok("U3 · AdMob ids are still placeholders ('not_configured'): no provider", s.built === "undefined" && s.provider === "none", JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, p } = await open({ cfg: { available: false, reason: "consent", consent: "cannot_request", formats: [] } });
  const s = await bridge(p);
  ok("U4 · consent refused or unobtainable: no provider, so no ad is ever requested", s.built === "undefined" && s.provider === "none", JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, p, errs } = await open({ cfg: { available: true, formats: [] } });
  const s = await bridge(p);
  ok("U5 · 'available' with no formats is not taken at its word", s.built === "undefined" && s.provider === "none" && errs.length === 0, JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, p, errs } = await open({ ios: PLUGIN, cfg: { available: true, formats: ["interstitial", "native"] } });
  await p.evaluate(() => { window.__ad.throwOn = "configure"; _adsBridge = false; delete window.BENativeAds; beNativeAdsInit(); });
  await sleep(400);
  const s = await bridge(p);
  ok("U6 · configure() throwing is survived: no bridge, no page error", s.built === "undefined" && errs.length === 0, JSON.stringify({ s, errs }));
  await ctx.close();
}

console.log("\n# the REAL bridge shape — Capacitor.Plugins, with registerPlugin absent (regression, 2 Oct 2026)");
{
  /* On a real iPhone the bridge never offers registerPlugin. The whole ad system
     was dead there while every stubbed check passed, because the stub invented it.
     These checks pin the shape the shell actually provides. */
  const { ctx, p, errs } = await open();
  const shape = await p.evaluate(() => ({
    hasRegisterPlugin: typeof window.Capacitor.registerPlugin,
    hasPlugins: typeof window.Capacitor.Plugins,
    beAds: typeof (window.Capacitor.Plugins || {}).BEAds,
    bridge: typeof window.BENativeAds, provider: adProvider().id,
    /* failure detail: everything needed to say WHY, without a second run */
    stub: typeof window.__ad, calls: (window.__ad || {}).calls || null,
    latch: _adsBridge, busy: _adsBridgeBusy, capPlugin: typeof capPlugin("BEAds"),
    gates: { ios: IS_IOS_APP, ads: flag("ads_enabled"), track: adsTrackAllows(), live: adsSystemLive(), ent: entApiBase() },
  }));
  ok("K1 · the shell exposes Capacitor.Plugins.BEAds and NO registerPlugin — the real shape",
    shape.hasRegisterPlugin === "undefined" && shape.hasPlugins === "object" && shape.beAds === "object", JSON.stringify(shape));
  ok("K2 · and the app still builds the bridge from it: provider is native",
    shape.bridge === "object" && shape.provider === "native", JSON.stringify(shape));
  ok("K3 · the app reads it through the repository's one helper, capPlugin",
    await p.evaluate(() => typeof capPlugin === "function" && typeof capPlugin("BEAds") === "object"));
  ok("K4 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  /* the latch: a miss must never be remembered, or one early failure means
     "no ads for the rest of the session" — the bug this fix removes */
  const { ctx, p, errs } = await open({ ios: NOPLUGIN });
  const first = await p.evaluate(() => ({ bridge: typeof window.BENativeAds, latch: _adsBridge }));
  ok("K5 · BEAds missing → no bridge AND the latch is NOT set", first.bridge === "undefined" && first.latch === false, JSON.stringify(first));
  /* the plugin appears later (registration raced the first navigation): the next
     go() must pick it up, which the old pre-set latch made impossible */
  const after = await p.evaluate(async () => {
    const ad = window.__late = { calls: [] };
    window.Capacitor.Plugins.BEAds = { configure: async () => { ad.calls.push("configure"); return { available: true, formats: ["interstitial", "native"] }; },
      load: async () => ({ ready: true }), isReady: async () => ({ ready: true }), show: async () => ({ shown: true, completed: true }),
      dismiss: async () => {}, showNative: async () => ({ shown: true }), moveNative: async () => {}, hideNative: async () => {} };
    go("journey"); await new Promise(r => setTimeout(r, 900));
    return { bridge: typeof window.BENativeAds, provider: adProvider().id, latch: _adsBridge, calls: ad.calls.length };
  });
  ok("K6 · a later navigation RETRIES and succeeds; only then is the latch set",
    after.bridge === "object" && after.provider === "native" && after.latch === true && after.calls === 1, JSON.stringify(after));
  ok("K7 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  /* configure() rejecting must not latch either */
  const { ctx, p, errs } = await open({ ios: PLUGIN_SLOW, cfg: { available: true, formats: ["interstitial", "native"] } });
  const r = await p.evaluate(async () => {
    window.__ad.throwOn = "configure"; _adsBridge = false; _adsBridgeBusy = false; delete window.BENativeAds;
    beNativeAdsInit(); await new Promise(x => setTimeout(x, 500));
    const bad = { bridge: typeof window.BENativeAds, latch: _adsBridge, busy: _adsBridgeBusy };
    window.__ad.throwOn = ""; go("home"); await new Promise(x => setTimeout(x, 1200));
    return { bad, good: { bridge: typeof window.BENativeAds, latch: _adsBridge, provider: adProvider().id } };
  });
  ok("K8 · configure() rejecting leaves the latch clear and nothing busy", r.bad.bridge === "undefined" && r.bad.latch === false && r.bad.busy === false, JSON.stringify(r.bad));
  ok("K9 · …and the next navigation recovers", r.good.bridge === "object" && r.good.latch === true && r.good.provider === "native", JSON.stringify(r.good));
  await ctx.close();
}
{
  /* configure() answering unavailable must not latch */
  const { ctx, p } = await open({ cfg: { available: false, reason: "consent", formats: [] } });
  const r = await p.evaluate(() => ({ bridge: typeof window.BENativeAds, latch: _adsBridge }));
  ok("KA · configure() answering unavailable does not latch, so a later attempt is still possible", r.bridge === "undefined" && r.latch === false, JSON.stringify(r));
  await ctx.close();
}
{
  /* after a confirmed success there must be no duplicate initialisation */
  const { ctx, p } = await open();
  const r = await p.evaluate(async () => {
    const before = window.__ad.calls.filter(c => c === "configure").length;
    beNativeAdsInit(); beNativeAdsInit(); go("home"); await new Promise(x => setTimeout(x, 900));
    return { before, after: window.__ad.calls.filter(c => c === "configure").length, latch: _adsBridge };
  });
  ok("KB · after success the latch holds: no second configure() however often it is asked", r.latch === true && r.after === r.before && r.before === 1, JSON.stringify(r));
  await ctx.close();
}

console.log("\n# the bridge, configured: two formats and no others");
{
  const { ctx, p, errs } = await open();
  const s = await bridge(p);
  ok("B1 · configured once → the native provider is chosen", s.live === true && s.built === "object" && s.provider === "native"
    && s.calls.filter(c => c === "configure").length === 1, JSON.stringify(s));
  ok("B2 · it supports interstitial and native ONLY — rewarded and sponsored are refused", s.supports.join(",") === "interstitial,native", JSON.stringify(s.supports));
  ok("B3 · it answers the whole provider contract",
    await p.evaluate(() => ["supports", "preload", "load", "isReady", "show", "dismiss", "renderNative"].every(k => typeof window.BENativeAds[k] === "function")));
  ok("B4 · it is built once per visit, however often it is asked",
    await p.evaluate(() => { const n = window.__ad.calls.filter(c => c === "configure").length; beNativeAdsInit(); beNativeAdsInit(); return window.__ad.calls.filter(c => c === "configure").length === n; }));
  ok("B5 · a rewarded ad is still refused by the manager, with the provider in place",
    (await p.evaluate(() => AdManager.rewarded("extra_ai", "extra_ai", { userInitiated: true }))).rewarded === false);
  ok("B6 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# the interstitial: Google's own full-screen ad, and no second dead screen");
{
  const { ctx, p, errs } = await open();
  await p.evaluate(() => { AdManager.markBreak("session_complete"); go("journey"); });
  await sleep(2500);
  const st = await p.evaluate(() => ({ calls: window.__ad.calls, shown: window.__ad.shown, ov: !!document.getElementById("adOv"),
    ev: window.__ev.filter(([n]) => /^ad_/.test(n)).map(([n, pr]) => n + ":" + (pr.provider || "")) }));
  ok("B7 · a finished session, then a navigation → the SDK is asked to load and then to show",
    st.calls.includes("load:interstitial") && st.calls.includes("show:interstitial") && st.shown === 1, JSON.stringify(st.calls));
  ok("B8 · the SDK's own ad has its own close control, so the app's labelled frame is taken away when it is dismissed — never a second screen to get past",
    st.ov === false, JSON.stringify(st));
  ok("B9 · the impression is reported once, against the 'native' provider",
    st.ev.filter(x => /^ad_displayed/.test(x)).length === 1 && st.ev.some(x => x === "ad_displayed:native"), JSON.stringify(st.ev));
  ok("BA · it counts against the frequency cap", (await p.evaluate(() => AdEligibility.decide("interstitial", "session_complete"))).reason === "cap:gap");
  ok("BB · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  /* the provider fails: no fill */
  const { ctx, p, errs } = await open();
  await p.evaluate(() => { window.__ad.fill = false; AdManager.markBreak("session_complete"); go("journey"); });
  await sleep(2500);
  const st = await p.evaluate(() => ({ ov: !!document.getElementById("adOv"), shown: window.__ad.shown,
    ev: window.__ev.filter(([n]) => /^ad_/.test(n)).map(([n, pr]) => n + ":" + (pr.reason || "")) }));
  ok("BC · no fill: nothing is shown, the frame never opens, and it is reported as no_fill",
    st.ov === false && st.shown === 0 && st.ev.some(x => x === "ad_suppressed:no_fill"), JSON.stringify(st));
  ok("BD · no impression was recorded for an ad that never appeared", (await p.evaluate(() => AdEligibility.decide("interstitial", "session_complete"))).show === true);
  ok("BE · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  /* the provider throws */
  const { ctx, p, errs } = await open();
  await p.evaluate(() => { window.__ad.throwOn = "show"; AdManager.markBreak("session_complete"); go("journey"); });
  await sleep(2800);
  const st = await p.evaluate(() => ({ ov: !!document.getElementById("adOv"), stuck: !!document.querySelector(".ad-ov") }));
  ok("BF · show() throwing never traps the learner: the frame closes itself", st.ov === false && st.stuck === false, JSON.stringify(st));
  ok("BG · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# the native advanced slot: the page reserves the space, the shell draws over it");
{
  const { ctx, p, errs } = await open();
  /* start from nothing on screen, so this is the slot THIS check placed */
  await p.evaluate(() => { AdManager.withdraw(); localStorage.removeItem(AD_LOG_KEY); AdEligibility._resetSession();
    window.__ad.calls = []; window.__ad.natives = {}; delete window.__ad.moved; go("home"); });
  await sleep(1400);
  const st = await p.evaluate(() => { const s = document.querySelector("[data-ad-slot]"); const body = s && s.querySelector(".ad-native-body");
    return { slot: !!s, place: s && s.dataset.placement, label: s && !!s.querySelector(".ad-label"), minH: body && body.style.minHeight,
      asked: window.__ad.calls.filter(c => /^showNative/.test(c)), rect: window.__ad.natives.home_feed || null }; });
  ok("B10 · Home's slot is filled through showNative, with the rectangle the page measured",
    st.slot === true && st.place === "home_feed" && st.asked.includes("showNative:home_feed") && st.rect && st.rect.w > 100 && st.rect.h >= 132, JSON.stringify(st));
  ok("B11 · the page reserves the height itself, so the creative does not cover the app's own content", st.minH === "132px", String(st.minH));
  ok("B12 · the slot keeps the app's label and the 'Remove ads with Premium' link", st.label === true && await p.evaluate(() => !!document.querySelector("[data-ad-slot] .ad-remove, [data-ad-slot] .prem-remove-ads, [data-ad-slot] a,[data-ad-slot] button")));
  /* the page scrolls: the platform view has to follow, with no new request */
  const moved = await p.evaluate(async () => { const before = window.__ad.calls.filter(c => /^showNative/.test(c)).length;
    window.scrollTo(0, 400); document.querySelector("[data-ad-slot]").style.marginTop = "60px";
    await new Promise(r => setTimeout(r, 900));
    return { moves: window.__ad.moved || 0, requests: window.__ad.calls.filter(c => /^showNative/.test(c)).length - before }; });
  ok("B13 · the slot moving is followed, with no second request and no second impression", moved.moves > 0 && moved.requests === 0, JSON.stringify(moved));
  /* the plan changes, or the page re-renders: the platform view must go */
  const gone = await p.evaluate(async () => { AdManager.withdraw(); await new Promise(r => setTimeout(r, 900));
    return { hidden: window.__ad.calls.filter(c => /^hideNative/.test(c)), left: Object.keys(window.__ad.natives), slots: document.querySelectorAll("[data-ad-slot]").length }; });
  ok("B14 · when the page drops the slot (a plan change, a re-render) the creative is taken off the screen too",
    gone.hidden.length > 0 && gone.left.length === 0 && gone.slots === 0, JSON.stringify(gone));
  ok("B15 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  /* no fill for the native slot */
  const { ctx, p } = await open();
  await p.evaluate(() => { AdManager.withdraw(); localStorage.removeItem(AD_LOG_KEY); AdEligibility._resetSession(); window.__ad.fill = false; go("home"); });
  await sleep(1400);
  ok("B16 · no native fill: the slot is removed again, leaving no empty labelled box",
    await p.evaluate(() => document.querySelectorAll("[data-ad-slot]").length === 0),
    await p.evaluate(() => document.querySelector("[data-ad-slot]") ? document.querySelector("[data-ad-slot]").outerHTML.slice(0, 200) : ""));
  await ctx.close();
}

console.log("\n# Premium, and the track, still decide before the provider is asked");
{
  const { ctx, p } = await open({ premium: true });
  await p.evaluate(() => { window.__ad.calls = []; AdManager.markBreak("session_complete"); go("journey"); });
  await sleep(2000);
  await p.evaluate(() => go("home")); await sleep(1000);
  const st = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), plan: AdEligibility.planAllowsAds(),
    d: AdEligibility.decide("interstitial", "session_complete"), calls: window.__ad.calls.filter(c => c !== "configure"),
    slots: document.querySelectorAll("[data-ad-slot]").length, ov: !!document.getElementById("adOv") }));
  ok("B17 · Premium: the decision is 'premium' and, from the moment the server says so, the SDK is asked for nothing",
    st.prem === true && st.plan === false && st.d.reason === "premium" && st.calls.length === 0 && st.slots === 0 && st.ov === false, JSON.stringify(st));
  await ctx.close();
}
{
  /* a learner switches from General English to Welding mid-visit */
  const { ctx, p } = await open();
  await p.evaluate(() => go("home")); await sleep(1100);
  const before = await p.evaluate(() => document.querySelectorAll("[data-ad-slot]").length);
  const st = await p.evaluate(async () => { window.__ad.calls = []; S.professionalTracks.activeId = "welding"; save();
    AdManager.markBreak("session_complete"); go("journey"); await new Promise(r => setTimeout(r, 1500));
    AdManager.placeNative("home");
    return { track: adsTrackAllows(), ov: !!document.getElementById("adOv"), slots: document.querySelectorAll("[data-ad-slot]").length,
      calls: window.__ad.calls.filter(c => /show/.test(c)) }; });
  /* the tier spec (5 Oct 2026): the moment the open programme is Welding, the
     ad system stops — no break fires, no new slot is placed, the SDK is not
     asked to show anything. The slot Home already carried is not torn down (it
     is behind the page the learner left), so the count must not GROW. */
  ok("B18 · switching to Welding mid-visit stops the ad system: the programme refuses, no overlay, no new slot, no show call",
    before === 1 && st.track === false && st.ov === false && st.slots <= before && st.calls.length === 0, JSON.stringify({ before, st }));
  await ctx.close();
}

await b.close(); srv.kill();
const fail = res.filter(x => !x).length;
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
