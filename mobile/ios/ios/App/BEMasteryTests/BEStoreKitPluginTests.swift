import Testing
import StoreKit
@testable import App

/// The pure half of `BEStoreKitPlugin`: which products it will ever touch and
/// how it describes a subscription period to the web layer. Purchases,
/// entitlements and the transaction listener need StoreKit itself and are
/// exercised through the `.storekit` configuration in Xcode and
/// `tests/ios-storekit.mjs`.
struct BEStoreKitPluginTests {

    @Test func onlyTheTwoPremiumProductsAreAllowed() {
        // App Store Connect's ids (6 Oct 2026), not Google Play's premium_* ids.
        #expect(BEStoreKitPlugin.allowed == ["BEMastery_Premium", "BEMastery_Annual"])
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
