import Testing
import UIKit
import WebKit
import Capacitor
@testable import App

/// The shell itself: the bridge view controller that `BridgeView` hosts must
/// come up with the three app-local plugins registered, or the web layer has
/// no `BEStoreKit`, `BEAuth` or `BEAds` to talk to.
@MainActor
struct BEMasteryTests {

    @Test func bridgeRegistersTheThreeAppLocalPlugins() throws {
        let vc = BEBridgeViewController()
        vc.loadViewIfNeeded()
        let bridge = try #require(vc.bridge)
        #expect(bridge.plugin(withName: "BEStoreKit") is BEStoreKitPlugin)
        #expect(bridge.plugin(withName: "BEAuth") is BEAuthPlugin)
        #expect(bridge.plugin(withName: "BEAds") is BEAdsPlugin)
    }

    @Test func bridgeViewIsTheWebView() throws {
        let vc = BEBridgeViewController()
        vc.loadViewIfNeeded()
        let webView = try #require(vc.webView)
        #expect(vc.view === webView)
    }
}
