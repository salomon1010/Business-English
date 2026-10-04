import SwiftUI
import Capacitor

/// The app's entry point: one window, one scene, and the Capacitor bridge as
/// its only content. The web app in `public/` is the product; nothing here
/// draws a screen of its own.
///
/// URL opens and universal links are forwarded to Capacitor's
/// `ApplicationDelegateProxy`, which posts the notifications the bridge and
/// its plugins listen for. The app declares no URL types and no associated
/// domains today, so neither fires yet; the forwarding is kept so a future
/// deep link reaches the web layer the way Capacitor expects.
@main
struct BEMasteryApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
                }
        }
    }
}
