import UIKit
import UserNotifications
import Capacitor

/// The app delegate exists for ONE reason: Apple hands a device token, and a
/// notification tap, to the application delegate and nowhere else. A SwiftUI
/// app has none until it asks for one, which is why `BEMasteryApp` installs
/// this through `@UIApplicationDelegateAdaptor`.
///
/// It holds no state and makes no decisions. Every callback goes straight to
/// `BEPushBox`, which the `BEPush` plugin reads, and is also posted as the
/// Capacitor notification a packaged push plugin would expect — so adding one
/// later does not mean rewriting this file.
///
/// Nothing is logged: a device token identifies an install, and a payload is
/// the learner's own notification.
final class BEAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        /* Taps arrive here, including the one that launched the app. Set before
           anything else can deliver one. */
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // MARK: - registration

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        BEPushBox.shared.deliver(token: deviceToken)
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        /* The one failure worth telling apart: a build whose App ID has no push
           capability can never register, however good the network is. */
        let code = (error as NSError).domain == NSURLErrorDomain ? "network" : "provider"
        BEPushBox.shared.deliver(failure: code)
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // MARK: - arrival and taps

    /// In the foreground the web app is already on screen. A call rings in-app,
    /// so no banner is drawn over it — the same rule sw.js follows for an open
    /// page. Everything else still shows, because a reminder the learner can see
    /// is the point of a reminder.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let info = notification.request.content.userInfo
        BEPushBox.shared.deliver(foreground: info)
        let be = info["be"] as? [AnyHashable: Any]
        let isCall = (be?["tag"] as? String) == "be-partner-call"
        completionHandler(isCall ? [] : [.banner, .list, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        BEPushBox.shared.deliver(tap: response.notification.request.content.userInfo)
        completionHandler()
    }
}
