import UIKit
import Capacitor

/// The app's bridge view controller: Capacitor's own, plus the plugins that
/// live in this app rather than in an npm package (Capacitor 6+ registers
/// app-local plugins here). SceneDelegate and Main.storyboard both use it.
class BEBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BEStoreKitPlugin())
        bridge?.registerPluginInstance(BEAuthPlugin())
    }
}
