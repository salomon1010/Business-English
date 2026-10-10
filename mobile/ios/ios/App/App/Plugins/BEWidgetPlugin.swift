import Foundation
import Capacitor
import WidgetKit
import UIKit
import CryptoKit
import ActivityKit

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
        CAPPluginMethod(name: "liveStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveEnd", returnType: CAPPluginReturnPromise),
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
        /* the Recommendations widget's pictures: fetched here, in the app, because a
           widget cannot reach the network while it draws; redraw once they are in */
        BEWidgetThumbCache.refresh(for: clean)
    }

    /// The game streak countdown (Live Activity, BEStreakActivity.swift in the
    /// widget extension). The web layer decides WHEN (the last three hours of the
    /// game day, today's daily not done, the app being left) and WHAT it says;
    /// this starts one — replacing any earlier one, so there is never two — or
    /// ends them. iOS 16.2+ and Live Activities allowed; anything else answers
    /// `started: false` and the app carries on.
    @objc func liveStart(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(["started": false, "why": "ios"]); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["started": false, "why": "disabled"]); return }
        let ms = call.getDouble("deadline") ?? 0
        let deadline = Date(timeIntervalSince1970: ms / 1000)
        guard deadline > Date(), deadline.timeIntervalSinceNow < 12 * 3600 else { call.reject("deadline out of range", "bad_deadline"); return }
        let clip = { (v: String?, n: Int) -> String in String((v ?? "").prefix(n)) }
        let prog = call.getString("prog") == "welding" ? "welding" : "general-english"
        let attrs = BEStreakActivityAttributes(title: clip(call.getString("title"), 40), prog: prog, doneLine: clip(call.getString("doneLine"), 80))
        let state = BEStreakActivityAttributes.ContentState(line: clip(call.getString("line"), 90), streak: max(0, min(9999, call.getInt("streak") ?? 0)), deadline: deadline, done: false)
        Task {
            for a in Activity<BEStreakActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            do {
                _ = try Activity.request(attributes: attrs, content: ActivityContent(state: state, staleDate: deadline), pushType: nil)
                call.resolve(["started": true])
            } catch { call.resolve(["started": false, "why": "request"]) }
        }
    }
    /// The daily is done (or the learner signed out): end every countdown. With
    /// `done`, the card says so for a few seconds before it leaves.
    @objc func liveEnd(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(["ended": 0]); return }
        let done = call.getBool("done") ?? false
        Task {
            let list = Activity<BEStreakActivityAttributes>.activities
            for a in list {
                var st = a.content.state; st.done = done
                await a.end(ActivityContent(state: st, staleDate: nil), dismissalPolicy: done ? .after(Date().addingTimeInterval(8)) : .immediate)
            }
            call.resolve(["ended": list.count])
        }
    }

    /// Sign-out, account deletion: every widget must forget this learner.
    @objc func clear(_ call: CAPPluginCall) {
        if let d = UserDefaults(suiteName: BEWidgetPlugin.group) {
            d.removeObject(forKey: BEWidgetPlugin.key)
            for a in BEWidgetPlugin.areas { d.removeObject(forKey: BEWidgetPlugin.key + "_" + a) }
            d.removeObject(forKey: "be_widget_rec_page")
        }
        BEWidgetThumbCache.removeAll()
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

    static let views: Set<String> = ["session", "journey", "practice", "shadow", "review", "home", "foundations", "lines", "phrases", "mastery", "english"]
    static let days: Set<String> = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    /// `signin` / `premium`: a tap on a locked widget (owner, 6 Oct 2026).
    /// `daily`: the game streak countdown (Live Activity) opens today's daily.
    static let acts: Set<String> = ["words", "today", "roadmap", "signin", "premium", "shift", "daily"]
    /// A recommendation's destination: the places a Home card can open, and the
    /// actions those places take (index.html `nudgeGo`).
    static let recViews: Set<String> = ["session", "practice", "shadow", "partner", "phrases", "phrasebank", "roleplay", "mastery"]
    /// "mastery": today's shift or one of the Welding Mastery games.
    static let recActs: Set<String> = ["clip", "trouble", "study-due", "ai", "shift", "cards", "quiz", "crossword", "visual", "listen", "builder", "match", "workshop"]

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
        /* a recommendation: view + action + up to three plain arguments
           (a clip id, a week, a scenario id), nothing else */
        if value("rec") == "1" {
            guard let view = value("view"), recViews.contains(view) else { return nil }
            var rec: [String: Any] = ["view": view]
            if let a = value("act"), recActs.contains(a) { rec["act"] = a }
            let args = (0..<3).compactMap { i -> String? in
                guard let v = value("a\(i)"), v.range(of: "^[A-Za-z0-9_.:-]{1,40}$", options: .regularExpression) != nil else { return nil }
                return v
            }
            rec["a"] = args
            rec["ch"] = value("ch") == "1"
            return ["rec": rec, "src": "widget"]
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

/// The Recommendations widget's pictures (owner, 6 Oct 2026). A widget cannot
/// fetch from the network while it draws, so the app saves each recommendation's
/// picture into the App Group, small (240 px wide, JPEG), under a name the
/// widget computes the same way (`BEWidgetThumbs.name` — SHA-256 of the
/// address, first 12 bytes). Sources are an allow-list: YouTube's own thumbnail
/// host over https, or one of the app's bundled pictures (home-shots/,
/// rp-photos/). Anything else is skipped. Files no recommendation uses are
/// deleted, so the folder never grows.
enum BEWidgetThumbCache {
    static let folder = "BEWidgetThumbs"
    static let hosts: Set<String> = ["i.ytimg.com", "img.youtube.com"]
    static let width: CGFloat = 240

    static func dir() -> URL? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: BEWidgetPlugin.group) else { return nil }
        let d = base.appendingPathComponent(folder, isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }
    static func name(for img: String) -> String {
        SHA256.hash(data: Data(img.utf8)).prefix(12).map { String(format: "%02x", $0) }.joined() + ".jpg"
    }

    static func refresh(for json: String) {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let d = dir() else { return }
        let imgs = ((obj["recs"] as? [[String: Any]]) ?? []).compactMap { $0["img"] as? String }.filter { !$0.isEmpty }
        let keep = Set(imgs.map(name(for:)))
        /* forget pictures nothing shows any more */
        for f in (try? FileManager.default.contentsOfDirectory(atPath: d.path)) ?? [] where !keep.contains(f) {
            try? FileManager.default.removeItem(at: d.appendingPathComponent(f))
        }
        let missing = imgs.filter { !FileManager.default.fileExists(atPath: d.appendingPathComponent(name(for: $0)).path) }
        guard !missing.isEmpty else { return }
        let group = DispatchGroup()
        for img in missing {
            group.enter()
            load(img) { raw in
                if let raw = raw, let jpg = shrink(raw) { try? jpg.write(to: d.appendingPathComponent(name(for: img)), options: .atomic) }
                group.leave()
            }
        }
        group.notify(queue: .main) { WidgetCenter.shared.reloadTimelines(ofKind: "BEWidgetRecs") }
    }

    static func removeAll() {
        guard let d = dir() else { return }
        try? FileManager.default.removeItem(at: d)
    }

    private static func load(_ img: String, _ done: @escaping (Data?) -> Void) {
        if img.hasPrefix("https://") {
            guard let u = URL(string: img), let h = u.host?.lowercased(), hosts.contains(h) else { return done(nil) }
            var r = URLRequest(url: u); r.timeoutInterval = 10
            URLSession.shared.dataTask(with: r) { data, resp, _ in
                let ok = (resp as? HTTPURLResponse)?.statusCode == 200
                done(ok ? data : nil)
            }.resume()
            return
        }
        /* a bundled picture: the web app's own files, copied into public/ */
        guard img.range(of: "^(home-shots|rp-photos)/[A-Za-z0-9_-]{1,60}\\.jpg$", options: .regularExpression) != nil,
              let base = Bundle.main.resourceURL?.appendingPathComponent("public", isDirectory: true) else { return done(nil) }
        done(try? Data(contentsOf: base.appendingPathComponent(img)))
    }

    private static func shrink(_ data: Data) -> Data? {
        guard let im = UIImage(data: data), im.size.width > 0 else { return nil }
        let w = min(width, im.size.width), h = (im.size.height / im.size.width * w).rounded()
        let fmt = UIGraphicsImageRendererFormat.default(); fmt.scale = 2
        let out = UIGraphicsImageRenderer(size: CGSize(width: w / 2, height: h / 2), format: fmt).image { _ in
            im.draw(in: CGRect(x: 0, y: 0, width: w / 2, height: h / 2))
        }
        return out.jpegData(compressionQuality: 0.72)
    }
}

/// The game streak countdown's attributes — the SAME name and Codable shape as in
/// the widget extension (BEWidget/BEStreakActivity.swift); ActivityKit matches the two.
struct BEStreakActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var line: String
        var streak: Int
        var deadline: Date
        var done: Bool
    }
    var title: String
    var prog: String
    var doneLine: String
}
