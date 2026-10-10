import Foundation
import UIKit
import UserNotifications
import Capacitor

/// BE Mastery — the native notification bridge behind `window.BEPush` (index.html).
///
/// WKWebView has neither `Notification` nor Web Push, so inside the App Store
/// shell the whole web-push half of the reminder is simply absent: `pushSync()`
/// returns at its guard and the learner gets in-app reminders only. This plugin
/// is the missing route. It does ONE thing — it obtains an APNs device token for
/// this install and hands it to the web layer, which registers it with be-push
/// exactly as a browser registers a push subscription.
///
/// What this plugin does NOT do: decide when to notify, or what the notification
/// says. The reminder time, the quiet hours, the one-a-day rule and the wording
/// all stay where they already are (be-push and the web app). A notification's
/// text travels in the APNs payload because there is no service worker here to
/// read it from a cache — see the APNs section of backend/push/push-worker.js.
///
/// - The token arrives on the app delegate, not here (`BEAppDelegate`), and may
///   arrive before the web layer has asked for it. `BEPushBox` holds it, so a
///   token is never lost to a race.
/// - A tap is delivered as the `tap` event while the app runs, and kept as
///   `pendingTap()` when the tap is what launched the app — a cold launch has no
///   web layer listening yet.
/// - The environment (Apple's two push hosts) is read from this build's own
///   provisioning profile rather than from `#if DEBUG`, so a TestFlight build
///   reports what it actually is.
///
/// Nothing is logged: not a token, not a payload.
@objc(BEPushPlugin)
public class BEPushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BEPushPlugin"
    public let jsName = "BEPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "permission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingTap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "coachSchedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "coachPending", returnType: CAPPluginReturnPromise),
    ]

    /// How long a registration may wait for Apple. A phone with no network gets
    /// a clear answer instead of a promise that never settles.
    private static let tokenTimeout: TimeInterval = 20

    public override func load() {
        BEPushBox.shared.plugin = self
    }

    /// What this build can offer, asked of the system rather than assumed. The
    /// web layer draws its switch from this and nothing else.
    @objc func available(_ call: CAPPluginCall) {
        BEPushBox.shared.settings { status in
            call.resolve([
                "available": true,
                "permission": status,
                "registered": UIApplication.shared.isRegisteredForRemoteNotifications,
                "env": BEPushPlugin.apnsEnvironment(),
            ])
        }
    }

    /// The current permission, without ever prompting.
    @objc func permission(_ call: CAPPluginCall) {
        BEPushBox.shared.settings { status in
            call.resolve(["permission": status, "registered": UIApplication.shared.isRegisteredForRemoteNotifications])
        }
    }

    /// Ask for permission if it has not been asked, then register with Apple and
    /// resolve with the device token. `denied` is its own code so the web layer
    /// can show the "notifications are off" note instead of an error.
    @objc func register(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .denied:
                call.reject("notifications are turned off for this app", "denied")
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                    if granted { self.startRegistration(call) }
                    else { call.reject("permission was not granted", "denied") }
                }
            default:
                self.startRegistration(call)
            }
        }
    }

    private func startRegistration(_ call: CAPPluginCall) {
        BEPushBox.shared.awaitToken(timeout: BEPushPlugin.tokenTimeout) { token, failure in
            if let token = token {
                call.resolve(["token": token, "env": BEPushPlugin.apnsEnvironment(), "permission": "granted"])
            } else {
                call.reject("could not register with Apple Push Notification service", failure ?? "network")
            }
        }
        DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
    }

    /// The notification that launched the app, if that is how it was launched.
    /// Served once: a cold launch has nothing listening for the `tap` event.
    @objc func pendingTap(_ call: CAPPluginCall) {
        BEPushBox.shared.takePendingTap { tap in
            call.resolve(tap == nil ? ["tap": NSNull()] : ["tap": tap!])
        }
    }

    /// Clear what is on the lock screen and the badge — the learner has opened
    /// the app, so the notification has done its job.
    @objc func clear(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.removeAllDeliveredNotifications()
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) { center.setBadgeCount(0, withCompletionHandler: nil) }
            else { UIApplication.shared.applicationIconBadgeNumber = 0 }
            call.resolve()
        }
    }

    // MARK: - Smart Coach session reminders (local notifications, 10 Oct 2026)

    /// Replace EVERY pending Smart Coach reminder with `items` — never add to
    /// them, so a retry, a reschedule or a second sync cannot duplicate one.
    /// Each item is a wall-clock date and time; the trigger is a calendar
    /// trigger in the device's current calendar, so a clock change (DST) keeps
    /// the session at the time the learner chose. `ask: true` (sent only when
    /// the learner approves a plan) may show the system prompt once; otherwise
    /// permission is never requested. An empty list clears them (pause, cancel,
    /// plan finished). Delivery is the system's decision: nothing here promises it.
    @objc func coachSchedule(_ call: CAPPluginCall) {
        let raw = call.getArray("items", JSObject.self) ?? []
        let requests = raw.compactMap { BEPushPlugin.coachRequest($0 as [String: Any]) }
        let ask = call.getBool("ask") ?? false
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            let schedule: (String) -> Void = { permission in
                center.getPendingNotificationRequests { pending in
                    let old = pending.map(\.identifier).filter { $0.hasPrefix(BEPushPlugin.coachPrefix) }
                    center.removePendingNotificationRequests(withIdentifiers: old)
                    guard permission == "granted" else { call.resolve(["scheduled": 0, "permission": permission]); return }
                    let group = DispatchGroup()
                    var added = 0
                    let lock = NSLock()
                    for r in requests {
                        group.enter()
                        center.add(r) { error in
                            if error == nil { lock.lock(); added += 1; lock.unlock() }
                            group.leave()
                        }
                    }
                    group.notify(queue: .main) { call.resolve(["scheduled": added, "permission": "granted"]) }
                }
            }
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral: schedule("granted")
            case .denied: schedule("denied")
            default:
                guard ask else { schedule("default"); return }
                center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in schedule(granted ? "granted" : "denied") }
            }
        }
    }

    /// The Smart Coach reminders still pending, and those already presented —
    /// "presented" is the most the system can tell; it is not "seen".
    @objc func coachPending(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            center.getDeliveredNotifications { delivered in
                call.resolve([
                    "pending": pending.map(\.identifier).filter { $0.hasPrefix(BEPushPlugin.coachPrefix) },
                    "delivered": delivered.map(\.request.identifier).filter { $0.hasPrefix(BEPushPlugin.coachPrefix) },
                ])
            }
        }
    }

    static let coachPrefix = "be-coach-"

    /// One reminder from the web layer's item, or nil when anything is off:
    /// the id must carry the Smart Coach prefix, the date must be real, the
    /// text short. The tap payload is `be.coach` (routed by `shape`) and
    /// `be.view = "coach"`; the text is the session's number only — no score,
    /// no skill, nothing about the learner's performance on the lock screen.
    static func coachRequest(_ item: [String: Any]) -> UNNotificationRequest? {
        guard let id = item["id"] as? String, id.hasPrefix(coachPrefix), id.count <= 80,
              let title = item["title"] as? String, let body = item["body"] as? String,
              !title.isEmpty, !body.isEmpty, title.count <= 60, body.count <= 160 else { return nil }
        let num: (String) -> Int? = { k in (item[k] as? NSNumber)?.intValue ?? (item[k] as? Int) }
        guard let y = num("year"), let mo = num("month"), let d = num("day"), let h = num("hour"), let mi = num("minute"),
              (2024...2100).contains(y), (1...12).contains(mo), (1...31).contains(d), (0...23).contains(h), (0...59).contains(mi) else { return nil }
        var parts = DateComponents()
        parts.calendar = Calendar.current
        parts.year = y; parts.month = mo; parts.day = d; parts.hour = h; parts.minute = mi
        guard parts.isValidDate else { return nil }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.threadIdentifier = "be-coach"
        let coach = (item["coach"] as? String).map { String($0.prefix(64)) } ?? ""
        content.userInfo = ["be": ["view": "coach", "tag": "be-coach", "coach": coach]]
        let trigger = UNCalendarNotificationTrigger(dateMatching: DateComponents(year: y, month: mo, day: d, hour: h, minute: mi), repeats: false)
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }

    /// Which of Apple's two push hosts this install's tokens belong to, read from
    /// the embedded provisioning profile's `aps-environment`. A build with no
    /// profile (and anything unreadable) is treated as production, which is what
    /// an App Store build is.
    static func apnsEnvironment() -> String {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let text = String(data: data, encoding: .isoLatin1),
              let key = text.range(of: "<key>aps-environment</key>") else { return "production" }
        let tail = text[key.upperBound...]
        guard let open = tail.range(of: "<string>"), let close = tail.range(of: "</string>"),
              open.upperBound <= close.lowerBound else { return "production" }
        let value = tail[open.upperBound..<close.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
        return value == "development" ? "sandbox" : "production"
    }
}

/// The state the app delegate and the plugin share. It exists because the two
/// halves cannot be ordered: Apple may hand over a device token, or the learner
/// may tap a notification, before the web view has finished loading — and a
/// token or a tap that arrived early must still reach the web layer.
///
/// Everything here is touched on the main queue only, which is where every
/// delegate callback already arrives.
final class BEPushBox {
    static let shared = BEPushBox()
    private init() {}

    weak var plugin: CAPPlugin?

    private var token: String?
    private var failure: String?
    private var tap: [String: Any]?
    /* Keyed, so a timeout answers the ONE registration it was scheduled for.
       Clearing the whole list would have rejected a second, still-waiting
       register() the moment the first one timed out. */
    private var waiters: [Int: (String?, String?) -> Void] = [:]
    private var nextWaiter = 0

    // MARK: - from the app delegate

    func deliver(token raw: Data) {
        let hex = raw.map { String(format: "%02x", $0) }.joined()
        onMain {
            self.token = hex
            self.failure = nil
            self.flush()
        }
    }

    func deliver(failure code: String) {
        onMain {
            self.failure = code
            self.flush()
        }
    }

    /// A tap, from any state. While the app runs the web layer hears the `tap`
    /// event; otherwise the tap waits for `pendingTap()` at the next boot.
    func deliver(tap info: [AnyHashable: Any]) {
        let payload = BEPushBox.shape(info)
        onMain {
            if let plugin = self.plugin {
                plugin.notifyListeners("tap", data: payload, retainUntilConsumed: true)
            } else {
                self.tap = payload
            }
        }
    }

    /// A notification that arrived while the app was in the foreground: the web
    /// layer is told, exactly as the service worker tells an open page.
    func deliver(foreground info: [AnyHashable: Any]) {
        let payload = BEPushBox.shape(info)
        onMain { self.plugin?.notifyListeners("arrived", data: payload, retainUntilConsumed: false) }
    }

    // MARK: - from the plugin

    func awaitToken(timeout: TimeInterval, _ done: @escaping (String?, String?) -> Void) {
        onMain {
            if let token = self.token { done(token, nil); return }
            let key = self.nextWaiter
            self.nextWaiter += 1
            self.waiters[key] = done
            /* a strong capture: the box is a singleton and never goes away */
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) {
                guard let waiter = self.waiters.removeValue(forKey: key) else { return }
                waiter(nil, self.failure ?? "timeout")
            }
        }
    }

    func takePendingTap(_ done: @escaping ([String: Any]?) -> Void) {
        onMain {
            let tap = self.tap
            self.tap = nil
            done(tap)
        }
    }

    func settings(_ done: @escaping (String) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            switch s.authorizationStatus {
            case .authorized, .provisional, .ephemeral: done("granted")
            case .denied: done("denied")
            default: done("default")
            }
        }
    }

    // MARK: - plumbing

    private func flush() {
        guard !waiters.isEmpty else { return }
        let pending = waiters.values
        waiters = [:]
        let token = self.token, failure = self.failure
        pending.forEach { $0(token, token == nil ? (failure ?? "network") : nil) }
    }

    /// Only the fields the web layer routes on, and only as strings, so nothing
    /// the server did not put in `be` can reach `nudgeArrive` or `go()`.
    static func shape(_ info: [AnyHashable: Any]) -> [String: Any] {
        let be = info["be"] as? [AnyHashable: Any] ?? [:]
        var out: [String: Any] = [:]
        for key in ["view", "tag", "rid", "nkind", "call", "coach"] {
            if let v = be[key] as? String, !v.isEmpty { out[key] = String(v.prefix(64)) }
        }
        return out
    }

    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread { work() } else { DispatchQueue.main.async(execute: work) }
    }
}
