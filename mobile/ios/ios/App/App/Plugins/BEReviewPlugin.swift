import Capacitor
import StoreKit
import UIKit

/// BE Mastery — the bridge behind `BEReview` (`capPlugin("BEReview")`) in the App Store
/// shell (31 Oct 2026). The iPhone twin of the Android shell's BEReviewPlugin.java: one
/// method, `request`, which asks iOS to show Apple's own rating sheet over the app.
///
/// Apple 5.6.1: a review prompt must be the system's own, never a custom one, so the page
/// calls this straight after a finished session and draws no dialog of its own. iOS decides
/// whether the sheet actually appears (at most three times in 365 days per learner) and
/// never says whether it did, so the call always resolves `{done:true}` and the page must
/// not treat it as "rated".
///
/// Nothing is logged.
@objc(BEReviewPlugin)
public class BEReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BEReviewPlugin"
    public let jsName = "BEReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
    ]

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func request(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("no_scene")
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve(["done": true])
        }
    }
}
