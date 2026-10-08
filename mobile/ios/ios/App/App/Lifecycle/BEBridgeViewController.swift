import UIKit
import Capacitor

/// The app's bridge view controller: Capacitor's own, plus the plugins that
/// live in this app rather than in an npm package (Capacitor 6+ registers
/// app-local plugins here). `BridgeView` hosts it inside the SwiftUI scene.
class BEBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BEStoreKitPlugin())
        bridge?.registerPluginInstance(BEAuthPlugin())
        bridge?.registerPluginInstance(BEAdsPlugin())
        bridge?.registerPluginInstance(BEPushPlugin())
        bridge?.registerPluginInstance(BEWidgetPlugin())
    }
}
