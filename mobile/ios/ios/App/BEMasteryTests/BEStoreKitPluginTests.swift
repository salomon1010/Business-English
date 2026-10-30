import Testing
import StoreKit
@testable import App

/// The pure half of `BEStoreKitPlugin`: which products it will ever touch and
/// how it describes a subscription period to the web layer. Purchases,
/// entitlements and the transaction listener need StoreKit itself and are
/// exercised through the `.storekit` configuration in Xcode and
/// `tests/ios-storekit.mjs`.
struct BEStoreKitPluginTests {

    @Test func eachAppRecordHasItsOwnTwoProducts() {
        // Apple would not let the second app reuse the first's ids, so the
        // Welding app record carries welding_premium_* (20 Oct 2026). Asking
        // StoreKit for ids an app record does not hold returns NOTHING, which
        // is why 1.0.0 (2) had a paywall with no plans on it.
        #expect(BEStoreKitPlugin.products(for: "com.lomonec.bemastery")
            == ["premium_monthly", "premium_annual"])
        #expect(BEStoreKitPlugin.products(for: "com.lomonec.bemastery.welding")
            == ["welding_premium_monthly", "welding_premium_annual"])
    }

    @Test func neitherAppCanOfferTheOthersProducts() {
        let ge = BEStoreKitPlugin.products(for: "com.lomonec.bemastery")
        let welding = BEStoreKitPlugin.products(for: "com.lomonec.bemastery.welding")
        #expect(ge.isDisjoint(with: welding))
        #expect(!welding.contains("premium_annual") && !welding.contains("premium_monthly"))
        #expect(!ge.contains("welding_premium_annual") && !ge.contains("welding_premium_monthly"))
    }

    @Test func anythingElseKeepsTheIdsItAlwaysHad() {
        // The project's own settings are the General English app, so an unknown
        // or missing bundle id behaves exactly as before this change.
        #expect(BEStoreKitPlugin.products(for: nil) == ["premium_monthly", "premium_annual"])
        #expect(BEStoreKitPlugin.products(for: "com.someone.else") == ["premium_monthly", "premium_annual"])
    }

    @Test func allowedFollowsTheBundleThisBuildIs() {
        // The test bundle is hosted by the app, so Bundle.main is the app under
        // test — whichever of the two it was built as.
        #expect(BEStoreKitPlugin.allowed == BEStoreKitPlugin.products(for: Bundle.main.bundleIdentifier))
        #expect(BEStoreKitPlugin.allowed.count == 2)
    }

    @Test func subscriptionPeriodsBecomeISO8601Durations() {
        // The same shape the Google Play provider hands the web layer.
        #expect(BEStoreKitPlugin.iso(.monthly) == "P1M")
        #expect(BEStoreKitPlugin.iso(.yearly) == "P1Y")
        #expect(BEStoreKitPlugin.iso(.weekly) == "P1W")
        #expect(BEStoreKitPlugin.iso(.everyThreeDays) == "P3D")
        #expect(BEStoreKitPlugin.iso(.everyTwoMonths) == "P2M")
    }
}
