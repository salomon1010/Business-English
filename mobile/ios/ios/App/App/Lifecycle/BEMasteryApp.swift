import SwiftUI
import Capacitor

/// The app's entry point: one window, one scene, and the Capacitor bridge as
/// its only content. The web app in `public/` is the product; nothing here
/// draws a screen of its own.
///
/// URL opens: the home-screen widget opens `bemastery://open?view=…`, which
/// `BEWidgetBox` routes to the web layer (5 Oct 2026). Any other URL, and a
/// universal link, is forwarded to Capacitor's `ApplicationDelegateProxy`,
/// which posts the notifications the bridge and its plugins listen for.
@main
struct BEMasteryApp: App {
    /* Notifications are the one thing a SwiftUI scene cannot receive: Apple
       delivers the APNs device token, and a notification tap, to the
       application delegate. BEAppDelegate exists for that and nothing else. */
    @UIApplicationDelegateAdaptor(BEAppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    if BEWidgetBox.shared.deliver(url: url) { return }
                    _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
                }
        }
    }
}
