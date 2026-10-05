import Foundation
import Capacitor
import WidgetKit

/// BE Mastery — the bridge behind `window.BEWidget` (index.html): how the web
/// app feeds the home-screen widget, and how a tap on the widget reaches the
/// web app.
///
/// The widget runs in its own process and cannot read the web view's storage,
/// so the app publishes a snapshot — small, already translated, nothing
/// personal beyond the learner's own progress numbers — into the App Group,
/// and asks WidgetKit to redraw. The web layer decides WHAT the snapshot says
/// (`widgetSnapshot()`); this plugin only checks that it is a snapshot, stores
/// it, and triggers the redraw. It never computes progress itself.
///
/// A tap on the widget opens `bemastery://open?view=…`. `BEWidgetBox.route`
/// accepts a short allow-list of views and arguments and nothing else, so a
/// URL from anywhere else can only ever land on a page that exists.
///
/// Nothing is logged.
@objc(BEWidgetPlugin)
public class BEWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BEWidgetPlugin"
    public let jsName = "BEWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingOpen", returnType: CAPPluginReturnPromise),
    ]

    /* These three must match BEWidgetShared in the widget extension; the
       release checks compare them. */
    static let group = "group.com.lomonec.bemastery"
    static let key = "be_widget_snapshot"
    static let maxBytes = 16_384

    public override func load() {
        BEWidgetBox.shared.plugin = self
    }

    /// Whether the App Group can be reached (it cannot when the build was
    /// signed without the capability — the web layer then simply does nothing).
    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": true, "group": UserDefaults(suiteName: BEWidgetPlugin.group) != nil])
    }

    /// Store the snapshot — as the latest, and as its programme's last — and
    /// redraw every placed widget. The "Your road map" widget reads the
    /// latest; the General English and Welding widgets read their own key,
    /// so each keeps the state of the last time that programme was open.
    @objc func update(_ call: CAPPluginCall) {
        guard let json = call.getString("snapshot"), let clean = BEWidgetPlugin.accept(json) else {
            call.reject("not a widget snapshot", "bad_snapshot"); return
        }
        guard let defaults = UserDefaults(suiteName: BEWidgetPlugin.group) else {
            call.reject("the app group is not available to this build", "no_group"); return
        }
        defaults.set(clean, forKey: BEWidgetPlugin.key)
        defaults.set(clean, forKey: BEWidgetPlugin.key + "_" + BEWidgetPlugin.area(of: clean))
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["stored": true])
    }

    /// Sign-out, account deletion: every widget must forget this learner.
    @objc func clear(_ call: CAPPluginCall) {
        if let d = UserDefaults(suiteName: BEWidgetPlugin.group) {
            d.removeObject(forKey: BEWidgetPlugin.key)
            for a in BEWidgetPlugin.areas { d.removeObject(forKey: BEWidgetPlugin.key + "_" + a) }
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    static let areas = ["ge", "pro"]

    /// The programme a snapshot belongs to: "pro" (Welding) or "ge" (General
    /// English, also for anything unexpected — the General English widget is
    /// the default one).
    static func area(of json: String) -> String {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return "ge" }
        return (obj["area"] as? String) == "pro" ? "pro" : "ge"
    }

    /// The widget tap that LAUNCHED the app, served once — a cold launch has no
    /// web layer listening for the `open` event yet.
    @objc func pendingOpen(_ call: CAPPluginCall) {
        BEWidgetBox.shared.takePending { open in
            call.resolve(open == nil ? ["open": NSNull()] : ["open": open!])
        }
    }

    /// A snapshot is a JSON object of version 1 under 16 KB. Anything else is
    /// refused rather than stored, so the widget can never be handed something
    /// it would fail to draw.
    static func accept(_ json: String) -> String? {
        guard let data = json.data(using: .utf8), data.count <= maxBytes,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              (obj["v"] as? Int) == 1 else { return nil }
        return json
    }
}

/// Shared between the SwiftUI scene (which receives the URL) and the plugin
/// (which the web layer listens to). Main queue only.
final class BEWidgetBox {
    static let shared = BEWidgetBox()
    private init() {}

    weak var plugin: CAPPlugin?
    private var pending: [String: Any]?

    static let views: Set<String> = ["session", "journey", "practice", "shadow", "review", "home", "foundations", "lines", "phrases"]
    static let days: Set<String> = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    static let acts: Set<String> = ["words", "today", "roadmap"]

    /// True when the URL was ours (and has been routed); false hands it on.
    @discardableResult
    func deliver(url: URL) -> Bool {
        guard let payload = BEWidgetBox.route(url) else { return false }
        onMain {
            if let plugin = self.plugin {
                plugin.notifyListeners("open", data: payload, retainUntilConsumed: true)
            } else {
                self.pending = payload
            }
        }
        return true
    }

    func takePending(_ done: @escaping ([String: Any]?) -> Void) {
        onMain {
            let p = self.pending
            self.pending = nil
            done(p)
        }
    }

    /// `bemastery://open?view=session&w=3&d=Tue` → `{view, w, d, src}`.
    /// Only known views, a week number, a weekday and a known action survive.
    static func route(_ url: URL) -> [String: Any]? {
        guard url.scheme?.lowercased() == "bemastery", (url.host ?? "").lowercased() == "open" else { return nil }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func value(_ name: String) -> String? {
            guard let v = items.first(where: { $0.name == name })?.value, !v.isEmpty else { return nil }
            return String(v.prefix(32))
        }
        guard let view = value("view"), views.contains(view) else { return nil }
        var out: [String: Any] = ["view": view, "src": "widget"]
        if let w = value("w"), let n = Int(w), (1...52).contains(n) { out["w"] = n }
        if let d = value("d"), days.contains(d) { out["d"] = d }
        if let a = value("act"), acts.contains(a) { out["act"] = a }
        return out
    }

    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread { work() } else { DispatchQueue.main.async(execute: work) }
    }
}
