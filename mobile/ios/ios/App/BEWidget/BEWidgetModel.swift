import Foundation
import WidgetKit

/// BE Mastery — what the home-screen widget knows, and how it reads the clock.
///
/// The app is a web app: every fact about the learner lives in the web layer's
/// storage, which no other process can read. So the app publishes a compact,
/// already-translated snapshot into the App Group (`BEWidgetPlugin.swift`), and
/// this is the widget's whole world. Nothing here computes progress; it draws
/// what the app said and only works out ONE thing itself — what time it is —
/// so that a widget drawn at 22:00 knows the day is nearly over and one drawn
/// after midnight knows a new day has begun, without the app being opened.
///
/// Day keys are UTC dates (`yyyy-MM-dd`), exactly as index.html keeps them
/// (`new Date().toISOString().slice(0,10)`), so "practised today" agrees with
/// the app's own streak.
enum BEWidgetShared {
    static let group = "group.com.lomonec.bemastery"
    static let key = "be_widget_snapshot"
    static let scheme = "bemastery"
    static let kind = "BEWidget"
}

/// Every field is optional: an older app, or a newer one with fields this
/// build has never heard of, must still draw. Unknown keys are ignored.
struct BEWidgetSnapshot: Decodable {
    struct Week: Decodable { var n: Int?; var total: Int?; var done: Int?; var per: Int?; var title: String? }
    struct Overall: Decodable { var done: Int?; var total: Int?; var pct: Int? }
    struct Goal: Decodable { var n: Int?; var goal: Int? }
    struct Today: Decodable {
        var kind: String?        // "week" | "foundations" | "placement" | "finished"
        var kicker: String?      // "Week 3 · Tuesday"
        var title: String?       // the day's focus
        var cta: String?         // "Continue Week 3"
        var view: String?; var w: Int?; var d: String?; var act: String?
    }
    struct Phase: Decodable { var label: String?; var pct: Int?; var state: String? }

    var v: Int?
    var at: Double?
    var lang: String?
    var dir: String?
    var theme: String?           // "light" | "dark"
    var area: String?            // "ge" | "pro"
    var programme: String?
    var streak: Int?
    var best: Int?
    var lastDay: String?         // the last UTC day with practice in this programme
    var week: Week?
    var overall: Overall?
    var weekGoal: Goal?
    var words: Int?
    var today: Today?
    var steps: [String]?         // one of done | now | next | locked per unit, Stage 0 first when it exists
    var phases: [Phase]?
    var line: String?
    var labels: [String: String]?

    static func parse(_ json: String) -> BEWidgetSnapshot? {
        guard let data = json.data(using: .utf8), data.count <= 16_384 else { return nil }
        guard let s = try? JSONDecoder().decode(BEWidgetSnapshot.self, from: data), s.v == 1 else { return nil }
        return s
    }

    /// A translated label the app sent, or the English the widget was built with.
    func label(_ key: String, _ fallback: String) -> String {
        if let v = labels?[key], !v.trimmingCharacters(in: .whitespaces).isEmpty { return v }
        return fallback
    }

    var isRTL: Bool { dir == "rtl" }
    var isPro: Bool { area == "pro" }
    var isLight: Bool { theme == "light" }
    var weekProgress: Double {
        guard let g = weekGoal, let goal = g.goal, goal > 0 else { return 0 }
        return min(1, max(0, Double(g.n ?? 0) / Double(goal)))
    }
    var overallProgress: Double {
        guard let o = overall, let t = o.total, t > 0 else { return 0 }
        return min(1, max(0, Double(o.done ?? 0) / Double(t)))
    }
}

enum BEWidgetStore {
    static func load() -> BEWidgetSnapshot? {
        guard let d = UserDefaults(suiteName: BEWidgetShared.group),
              let json = d.string(forKey: BEWidgetShared.key) else { return nil }
        return BEWidgetSnapshot.parse(json)
    }
}

/// UTC day keys, the app's own convention.
enum BEWidgetDay {
    private static let fmt: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    static func key(_ date: Date) -> String { fmt.string(from: date) }
    static func key(_ date: Date, daysAgo n: Int) -> String { key(date.addingTimeInterval(-86_400 * Double(n))) }
    /// The next UTC midnight after `date`, plus a moment so the day has really turned.
    static func nextMidnight(after date: Date) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let start = cal.startOfDay(for: date)
        return (cal.date(byAdding: .day, value: 1, to: start) ?? date.addingTimeInterval(86_400)).addingTimeInterval(2)
    }
}

/// How the day stands at the moment the widget is drawn — the one thing the
/// snapshot cannot say, because it was written earlier.
enum BEWidgetMood {
    case done       // practised today
    case pending    // not yet, and the day is young
    case atRisk     // evening, not yet, and there is a streak to lose
    case cold       // no streak alive; today would start one
    case empty      // no snapshot at all

    static func of(_ snap: BEWidgetSnapshot?, at date: Date) -> BEWidgetMood {
        guard let s = snap else { return .empty }
        let today = BEWidgetDay.key(date), yesterday = BEWidgetDay.key(date, daysAgo: 1)
        if s.lastDay == today { return .done }
        let alive = s.lastDay == yesterday && (s.streak ?? 0) > 0
        if !alive { return .cold }
        let hour = Calendar.current.component(.hour, from: date)
        return hour >= 18 ? .atRisk : .pending
    }
}

struct BEWidgetEntry: TimelineEntry {
    let date: Date
    let snap: BEWidgetSnapshot?
    let mood: BEWidgetMood

    /// The streak as the app itself would count it at this moment: alive if the
    /// last practice was today or yesterday, otherwise back to zero.
    var streak: Int {
        guard let s = snap else { return 0 }
        switch mood {
        case .done, .pending, .atRisk: return s.streak ?? 0
        default: return 0
        }
    }

    static func make(_ snap: BEWidgetSnapshot?, at date: Date) -> BEWidgetEntry {
        BEWidgetEntry(date: date, snap: snap, mood: BEWidgetMood.of(snap, at: date))
    }
}

/// When the widget must be redrawn without the app's help: now, the evening
/// turn (18:00 local, when a pending day becomes "at risk"), and the next two
/// UTC midnights (when "done" becomes "pending" again and a streak may lapse).
enum BEWidgetClock {
    static func dates(from now: Date) -> [Date] {
        var out: [Date] = [now]
        if let evening = Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: now), evening > now {
            out.append(evening)
        }
        let m1 = BEWidgetDay.nextMidnight(after: now)
        out.append(m1)
        out.append(BEWidgetDay.nextMidnight(after: m1))
        return out.sorted()
    }
}

/// The deep links the widget offers. The app's `BEWidgetBox.route` accepts
/// exactly these shapes and nothing else.
enum BEWidgetLink {
    static func url(view: String, w: Int? = nil, d: String? = nil, act: String? = nil) -> URL {
        var c = URLComponents()
        c.scheme = BEWidgetShared.scheme
        c.host = "open"
        var q = [URLQueryItem(name: "view", value: view)]
        if let w = w { q.append(URLQueryItem(name: "w", value: String(w))) }
        if let d = d { q.append(URLQueryItem(name: "d", value: d)) }
        if let a = act { q.append(URLQueryItem(name: "act", value: a)) }
        c.queryItems = q
        return c.url ?? URL(string: "bemastery://open?view=journey")!
    }

    static func today(_ s: BEWidgetSnapshot?) -> URL {
        guard let t = s?.today, let view = t.view else { return url(view: "journey") }
        return url(view: view, w: t.w, d: t.d, act: t.act)
    }
    static let roadmap = url(view: "journey")
    static let words = url(view: "practice", act: "words")
    static let progress = url(view: "review")
}
