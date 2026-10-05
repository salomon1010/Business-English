import Testing
import UIKit
import WebKit
import Capacitor
@testable import App

/// The shell itself: the bridge view controller that `BridgeView` hosts must
/// come up with the four app-local plugins registered, or the web layer has
/// no `BEStoreKit`, `BEAuth`, `BEAds` or `BEPush` to talk to.
@MainActor
struct BEMasteryTests {

    @Test func bridgeRegistersTheFourAppLocalPlugins() throws {
        let vc = BEBridgeViewController()
        vc.loadViewIfNeeded()
        let bridge = try #require(vc.bridge)
        #expect(bridge.plugin(withName: "BEStoreKit") is BEStoreKitPlugin)
        #expect(bridge.plugin(withName: "BEAuth") is BEAuthPlugin)
        #expect(bridge.plugin(withName: "BEAds") is BEAdsPlugin)
        #expect(bridge.plugin(withName: "BEPush") is BEPushPlugin)
    }

    /// The APNs environment decides which of Apple's two push hosts a token
    /// belongs to. Read from this build's own provisioning profile, it must
    /// always be one of the two words be-push understands — never empty.
    @Test func apnsEnvironmentIsOneOfApplesTwo() {
        let env = BEPushPlugin.apnsEnvironment()
        #expect(env == "production" || env == "sandbox")
    }

    /// A device token arriving before the web layer asks for it must not be
    /// lost: the box holds it, which is the whole reason the box exists.
    @Test func aTokenThatArrivesEarlyIsStillHandedOver() async {
        BEPushBox.shared.deliver(token: Data([0xBE, 0x01, 0xFF]))
        let token: String? = await withCheckedContinuation { cont in
            BEPushBox.shared.awaitToken(timeout: 2) { token, _ in cont.resume(returning: token) }
        }
        #expect(token == "be01ff")
    }

    @Test func bridgeViewIsTheWebView() throws {
        let vc = BEBridgeViewController()
        vc.loadViewIfNeeded()
        let webView = try #require(vc.webView)
        #expect(vc.view === webView)
    }
}
