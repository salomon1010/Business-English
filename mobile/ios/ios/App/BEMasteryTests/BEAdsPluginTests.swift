import Testing
import Foundation
@testable import App

/// The pure half of `BEAdsPlugin`: identifier validation and the rules that
/// decide whether Google's test units may ever be used. Everything that needs
/// the Google Mobile Ads SDK or a device is covered by `tests/ios-ads.mjs`
/// (JavaScript side) and the device checklist in `docs/ADS-IOS-RELEASE.md`.
struct BEAdsPluginTests {

    @Test func onlyInterstitialAndNativeAreServed() {
        #expect(BEAdsPlugin.formats == ["interstitial", "native"])
    }

    @Test(arguments: [
        "ca-app-pub-3940256099942544~1458002511",
        "ca-app-pub-0000000000000000~0000000000",
    ])
    func wellFormedAppIdsAreAccepted(id: String) {
        #expect(BEAdsPlugin.validAppId(id))
    }

    @Test(arguments: [
        nil,
        "",
        "ca-app-pub-REPLACE~REPLACE",
        "ca-app-pub-3940256099942544/4411468910",     // a unit id, not an app id
        "ca-app-pub-394025609994254~1458002511",      // 15 digits
        " ca-app-pub-3940256099942544~1458002511",    // leading space
    ] as [String?])
    func malformedAppIdsAreRefused(id: String?) {
        #expect(!BEAdsPlugin.validAppId(id))
    }

    @Test(arguments: [
        "ca-app-pub-3940256099942544/4411468910",
        "ca-app-pub-3940256099942544/3986624511",
    ])
    func wellFormedUnitIdsAreAccepted(id: String) {
        #expect(BEAdsPlugin.validUnitId(id))
    }

    @Test(arguments: [
        nil,
        "ca-app-pub-REPLACE/REPLACE",
        "ca-app-pub-3940256099942544~1458002511",     // an app id, not a unit id
        "ca-app-pub-3940256099942544/441146891",      // 9 digits
    ] as [String?])
    func malformedUnitIdsAreRefused(id: String?) {
        #expect(!BEAdsPlugin.validUnitId(id))
    }

    @Test func googlesTestIdentifiersAreThemselvesWellFormed() {
        #expect(BEAdsPlugin.validAppId(BEAdsPlugin.testAppId))
        #expect(BEAdsPlugin.validUnitId(BEAdsPlugin.testInterstitial))
        #expect(BEAdsPlugin.validUnitId(BEAdsPlugin.testNative))
    }

    @Test func aDebugBuildMayUseTestUnits() {
        #if DEBUG
        #expect(BEAdsPlugin.testUnitsAllowed)
        #else
        // A Release test run is a sandbox build without an App Store receipt,
        // so the answer follows the Info.plist switch alone.
        let asked = (Bundle.main.object(forInfoDictionaryKey: "BEAdsAllowTestUnits") as? Bool) ?? false
        #expect(BEAdsPlugin.testUnitsAllowed == asked)
        #endif
    }

    @Test func theSandboxLockKeysOnTheReceiptFileName() {
        // TestFlight hands a build a "sandboxReceipt"; the App Store a
        // "receipt". A simulator run also reports "receipt" (the file does not
        // exist), so the Sandbox lock alone would refuse test units here — the
        // #if DEBUG branch is what lets a development run use them. Both halves
        // of that rule are stated so a change to either shows up.
        let last = Bundle.main.appStoreReceiptURL?.lastPathComponent
        #expect(BEAdsPlugin.sandboxBuild == (last != "receipt"))
        #if DEBUG
        #expect(BEAdsPlugin.testUnitsAllowed)
        #else
        if last == "receipt" { #expect(!BEAdsPlugin.testUnitsAllowed) }
        #endif
    }
}
