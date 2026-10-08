import WidgetKit
import SwiftUI

/// BE Mastery — the home-screen and lock-screen widget.
///
/// What it shows, and why (owner, 5 Oct 2026: "a widget that displays useful
/// information — road map, training progress — better than the competitors,
/// very beautiful"). The best-known language-app widget shows a streak number
/// and a mascot whose mood sours as the day goes by. This one keeps the two
/// ideas that work — the streak, and a face that changes with the clock — and
/// adds what that widget leaves out: the learner's actual place on the road
/// map, the next step by name, the week's goal, the words waiting for review,
/// and a tap that lands on the very lesson rather than on the app's front door.
///
/// Every word is in the learner's language because the app sends it so; the
/// widget holds only English fallbacks for a phone that has never opened the
/// app. Colours follow the programme (General English indigo→cyan, Welding
/// amber) and the app's theme, not the system's.
struct BEWidgetProvider: TimelineProvider {
    /// nil = follows the open programme; "ge" / "pro" = that programme only.
    var area: String? = nil

    func placeholder(in context: Context) -> BEWidgetEntry {
        BEWidgetEntry.make(BEWidgetSample.snapshot(area: area), at: Date(), area: area)
    }

    func getSnapshot(in context: Context, completion: @escaping (BEWidgetEntry) -> Void) {
        let snap = context.isPreview ? (BEWidgetStore.load(area: area) ?? BEWidgetSample.snapshot(area: area)) : BEWidgetStore.load(area: area)
        completion(BEWidgetEntry.make(snap, at: Date(), area: area))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BEWidgetEntry>) -> Void) {
        let snap = BEWidgetStore.load(area: area)
        let entries = BEWidgetClock.dates(from: Date()).map { BEWidgetEntry.make(snap, at: $0, area: area) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - palette

struct BEPalette {
    let bgA: Color, bgB: Color, card: Color, text: Color, muted: Color
    let acc: Color, acc2: Color, gold: Color, green: Color, red: Color

    static func make(_ s: BEWidgetSnapshot?, area: String? = nil) -> BEPalette {
        let light = s?.isLight ?? false, pro = s?.isPro ?? (area == "pro")
        if light {
            return BEPalette(bgA: Color(hex: 0xFFFFFF), bgB: Color(hex: 0xEEF1FB), card: Color(hex: 0x0F172A).opacity(0.05),
                             text: Color(hex: 0x0F172A), muted: Color(hex: 0x586179),
                             acc: pro ? Color(hex: 0x9B6200) : Color(hex: 0x4F46E5), acc2: pro ? Color(hex: 0xC98A0D) : Color(hex: 0x0891B2),
                             gold: Color(hex: 0xB45309), green: Color(hex: 0x046A4E), red: Color(hex: 0xC01C1C))
        }
        return BEPalette(bgA: Color(hex: 0x161D3B), bgB: Color(hex: 0x0A0E1A), card: Color.white.opacity(0.07),
                         text: Color(hex: 0xE6EAF4), muted: Color(hex: 0x98A1B7),
                         acc: pro ? Color(hex: 0xD49717) : Color(hex: 0x6366F1), acc2: pro ? Color(hex: 0xF6C453) : Color(hex: 0x22D3EE),
                         gold: Color(hex: 0xFBBF24), green: Color(hex: 0x34D399), red: Color(hex: 0xF87171))
    }

    var grad: LinearGradient { LinearGradient(colors: [acc, acc2], startPoint: .leading, endPoint: .trailing) }
    var bg: LinearGradient { LinearGradient(colors: [bgA, bgB], startPoint: .topLeading, endPoint: .bottomTrailing) }
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: 1)
    }
}

// MARK: - pieces

/// The streak: a ring for this week's goal, the number of days inside it, and
/// a flame whose colour is the day's mood — lit when today is done, amber when
/// the evening is running out, grey when there is no streak to keep.
struct BEStreakRing: View {
    let entry: BEWidgetEntry
    let pal: BEPalette
    var size: CGFloat = 76

    var flame: Color {
        switch entry.mood {
        case .done: return pal.gold
        case .atRisk: return pal.red
        case .pending: return pal.acc2
        default: return pal.muted
        }
    }

    var body: some View {
        ZStack {
            Circle().stroke(pal.muted.opacity(0.18), lineWidth: size * 0.09)
            Circle()
                .trim(from: 0, to: CGFloat(entry.snap?.weekProgress ?? 0))
                .stroke(pal.grad, style: StrokeStyle(lineWidth: size * 0.09, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: -2) {
                Image(systemName: "flame.fill")
                    .font(.system(size: size * 0.22, weight: .bold))
                    .foregroundColor(flame)
                Text("\(entry.streak)")
                    .font(.system(size: size * 0.36, weight: .heavy, design: .rounded))
                    .foregroundColor(pal.text)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
            }
        }
        .frame(width: size, height: size)
    }
}

/// The road map as a strip: one capsule per unit — lit where the learner has
/// been, a beacon where they are, dim where they are going.
struct BERoadStrip: View {
    let steps: [String]
    let pal: BEPalette
    var height: CGFloat = 7

    var body: some View {
        let list = steps.isEmpty ? Array(repeating: "locked", count: 12) : steps
        HStack(spacing: 3) {
            ForEach(Array(list.enumerated()), id: \.offset) { _, st in
                ZStack {
                    Capsule().fill(pal.muted.opacity(st == "next" ? 0.38 : 0.16))
                    if st == "done" { Capsule().fill(pal.grad) }
                    if st == "now" {
                        Capsule().fill(pal.acc)
                        Circle().fill(Color.white).frame(width: height * 0.6, height: height * 0.6)
                    }
                }
                .frame(height: height)
            }
        }
    }
}

struct BEChip: View {
    let icon: String
    let text: String
    let tint: Color
    let pal: BEPalette
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 10, weight: .bold))
            Text(text).font(.system(size: 11, weight: .semibold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .foregroundColor(tint)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(Capsule().fill(tint.opacity(0.14)))
    }
}

struct BECta: View {
    let text: String
    let pal: BEPalette
    var body: some View {
        HStack(spacing: 5) {
            Text(text).font(.system(size: 12, weight: .bold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
            Image(systemName: "arrow.right").font(.system(size: 10, weight: .heavy))
        }
        .foregroundColor(.white)
        .padding(.horizontal, 11).padding(.vertical, 6)
        .background(Capsule().fill(pal.grad))
    }
}

struct BEMark: View {
    let pal: BEPalette
    var size: CGFloat = 18
    var body: some View {
        Text("BE")
            .font(.system(size: size * 0.5, weight: .heavy, design: .rounded))
            .foregroundColor(.white)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).fill(pal.grad))
    }
}

// MARK: - copy that follows the mood

extension BEWidgetEntry {
    /// The one line under the title: what the day asks for right now.
    func moodLine(_ s: BEWidgetSnapshot) -> String {
        switch mood {
        case .done: return s.label("done", "Today's practice is done")
        case .atRisk: return s.label("risk", "Keep your streak alive tonight")
        case .cold: return s.label("start", "Start a new streak today")
        default: return s.line ?? s.label("line", "25 minutes today keeps the streak alive.")
        }
    }
    var moodIcon: String {
        switch mood {
        case .done: return "checkmark.circle.fill"
        case .atRisk: return "exclamationmark.circle.fill"
        default: return "play.circle.fill"
        }
    }
}

// MARK: - the three home-screen sizes

struct BESmallView: View {
    let entry: BEWidgetEntry
    let s: BEWidgetSnapshot
    let pal: BEPalette
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .top) {
                BEStreakRing(entry: entry, pal: pal, size: 56)
                Spacer(minLength: 0)
                BEMark(pal: pal, size: 18)
            }
            Text(s.label("streak", "day streak"))
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundColor(pal.muted)
            Spacer(minLength: 0)
            Text(s.today?.title ?? s.programme ?? "")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(pal.text)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)
            BERoadStrip(steps: s.steps ?? [], pal: pal, height: 6)
            Text(s.today?.kicker ?? "")
                .font(.system(size: 10, weight: .semibold, design: .rounded))
                .foregroundColor(pal.muted)
                .lineLimit(1)
        }
        .beWidgetURL(BEWidgetLink.today(s))
    }
}

struct BEMediumView: View {
    let entry: BEWidgetEntry
    let s: BEWidgetSnapshot
    let pal: BEPalette
    var body: some View {
        HStack(spacing: 14) {
            BELink(BEWidgetLink.progress) {
                VStack(spacing: 4) {
                    BEStreakRing(entry: entry, pal: pal, size: 74)
                    Text(s.label("streak", "day streak"))
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundColor(pal.muted)
                }
            }
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Image(systemName: entry.moodIcon).font(.system(size: 11, weight: .bold))
                        .foregroundColor(entry.mood == .done ? pal.green : (entry.mood == .atRisk ? pal.red : pal.acc2))
                    Text((s.label("today", "Today") + "  ·  " + (s.today?.kicker ?? "")).uppercased())
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundColor(pal.muted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                Text(s.today?.title ?? s.programme ?? "")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(pal.text)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                Text(entry.moodLine(s))
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(pal.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 2)
                HStack(spacing: 6) {
                    BELink(BEWidgetLink.today(s)) {
                        BECta(text: s.today?.cta ?? s.label("open", "Open"), pal: pal)
                    }
                    if let n = s.words, n > 0 {
                        BELink(BEWidgetLink.words) {
                            BEChip(icon: "text.book.closed.fill", text: "\(n)", tint: pal.acc2, pal: pal)
                        }
                    }
                }
                BELink(BEWidgetLink.roadmap) {
                    VStack(alignment: .leading, spacing: 3) {
                        BERoadStrip(steps: s.steps ?? [], pal: pal, height: 6)
                        HStack {
                            Text(weekLine).font(.system(size: 10, weight: .semibold, design: .rounded)).foregroundColor(pal.muted).lineLimit(1)
                            Spacer()
                            Text("\(s.overall?.pct ?? 0)%").font(.system(size: 10, weight: .bold, design: .rounded)).foregroundColor(pal.acc2)
                        }
                    }
                }
            }
        }
    }
    var weekLine: String {
        guard let w = s.week, let n = w.n, let t = w.total else { return s.label("roadmap", "Road map") }
        return s.label("unit", "Week") + " \(n) / \(t)"
    }
}

struct BELargeView: View {
    let entry: BEWidgetEntry
    let s: BEWidgetSnapshot
    let pal: BEPalette
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                BEMark(pal: pal, size: 22)
                Text(s.programme ?? "BE Mastery")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(pal.text)
                    .lineLimit(1)
                Spacer()
                BELink(BEWidgetLink.progress) {
                    BEChip(icon: "flame.fill", text: "\(entry.streak) " + s.label("streak", "day streak"),
                           tint: entry.mood == .done ? pal.gold : (entry.mood == .atRisk ? pal.red : pal.acc2), pal: pal)
                }
            }
            // today
            BELink(BEWidgetLink.today(s)) {
                HStack(spacing: 12) {
                    BEStreakRing(entry: entry, pal: pal, size: 64)
                    VStack(alignment: .leading, spacing: 4) {
                        Text((s.label("today", "Today") + "  ·  " + (s.today?.kicker ?? "")).uppercased())
                            .font(.system(size: 10, weight: .bold, design: .rounded)).foregroundColor(pal.muted).lineLimit(1).minimumScaleFactor(0.7)
                        Text(s.today?.title ?? "")
                            .font(.system(size: 16, weight: .bold, design: .rounded)).foregroundColor(pal.text).lineLimit(2).minimumScaleFactor(0.8)
                        Text(entry.moodLine(s))
                            .font(.system(size: 11, weight: .medium, design: .rounded)).foregroundColor(pal.muted).lineLimit(2)
                        BECta(text: s.today?.cta ?? s.label("open", "Open"), pal: pal)
                    }
                    Spacer(minLength: 0)
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(pal.card))
            }
            // road map
            BELink(BEWidgetLink.roadmap) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(s.label("roadmap", "Road map")).font(.system(size: 11, weight: .bold, design: .rounded)).foregroundColor(pal.text)
                        Spacer()
                        Text(sessionsLine).font(.system(size: 10, weight: .semibold, design: .rounded)).foregroundColor(pal.muted).lineLimit(1)
                    }
                    BERoadStrip(steps: s.steps ?? [], pal: pal, height: 8)
                    if let ph = s.phases, !ph.isEmpty {
                        HStack(spacing: 8) {
                            ForEach(Array(ph.prefix(4).enumerated()), id: \.offset) { _, p in
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(p.label ?? "").font(.system(size: 9, weight: .semibold, design: .rounded)).foregroundColor(pal.muted).lineLimit(1).minimumScaleFactor(0.7)
                                    GeometryReader { g in
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(pal.muted.opacity(0.16))
                                            Capsule().fill(p.state == "done" ? AnyShapeStyle(pal.green) : AnyShapeStyle(pal.grad))
                                                .frame(width: g.size.width * CGFloat(min(100, max(0, p.pct ?? 0))) / 100)
                                        }
                                    }.frame(height: 4)
                                }
                            }
                        }
                    }
                }
            }
            // three facts
            HStack(spacing: 8) {
                BELink(BEWidgetLink.progress) {
                    BEStat(value: "\(s.weekGoal?.n ?? 0)/\(s.weekGoal?.goal ?? 6)", label: s.label("goal", "this week"), icon: "calendar", tint: pal.acc, pal: pal)
                }
                BELink(BEWidgetLink.words) {
                    BEStat(value: "\(s.words ?? 0)", label: s.label("words", "words due"), icon: "text.book.closed.fill", tint: pal.acc2, pal: pal)
                }
                BELink(BEWidgetLink.progress) {
                    BEStat(value: "\(s.best ?? 0)", label: s.label("best", "best streak"), icon: "trophy.fill", tint: pal.gold, pal: pal)
                }
            }
            Spacer(minLength: 0)
            // the reminder's own line — the one sentence the whole app repeats
            HStack(spacing: 6) {
                Image(systemName: "quote.opening").font(.system(size: 9, weight: .bold)).foregroundColor(pal.acc2)
                Text(s.line ?? s.label("line", "25 minutes today keeps the streak alive."))
                    .font(.system(size: 11, weight: .medium, design: .rounded)).foregroundColor(pal.muted).lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
    var sessionsLine: String {
        guard let o = s.overall, let d = o.done, let t = o.total else { return "" }
        return "\(d) / \(t) · \(o.pct ?? 0)%"
    }
}

struct BEStat: View {
    let value: String, label: String, icon: String, tint: Color, pal: BEPalette
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 10, weight: .bold)).foregroundColor(tint)
                Text(value).font(.system(size: 15, weight: .heavy, design: .rounded)).foregroundColor(pal.text).lineLimit(1).minimumScaleFactor(0.7)
            }
            Text(label).font(.system(size: 9, weight: .semibold, design: .rounded)).foregroundColor(pal.muted).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(pal.card))
    }
}

/// A phone that has never opened the app — or, for a fixed-programme widget,
/// never opened that programme: an invitation, not an error.
struct BEEmptyView: View {
    let pal: BEPalette
    var area: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            BEMark(pal: pal, size: 26)
            Spacer(minLength: 0)
            Text(area == "pro" ? "Welding English" : area == "ge" ? "General English" : "Open BE Mastery")
                .font(.system(size: 14, weight: .bold, design: .rounded)).foregroundColor(pal.text)
            Text(area == nil ? "Your road map and streak will appear here." : "Open this programme in BE Mastery once; its road map and streak will appear here.")
                .font(.system(size: 11, weight: .medium, design: .rounded)).foregroundColor(pal.muted).lineLimit(3)
            BERoadStrip(steps: [], pal: pal, height: 6)
        }
        .beWidgetURL(BEWidgetLink.roadmap)
    }
}

// MARK: - lock screen (iOS 16+)

@available(iOS 16.0, *)
struct BEAccessoryView: View {
    let entry: BEWidgetEntry
    let s: BEWidgetSnapshot?
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: s?.weekProgress ?? 0) {
                Image(systemName: "flame.fill")
            } currentValueLabel: {
                Text("\(entry.streak)").font(.system(.title3, design: .rounded).weight(.heavy))
            }
            .gaugeStyle(.accessoryCircular)
            .beWidgetURL(BEWidgetLink.today(s))
        case .accessoryInline:
            HStack {
                Image(systemName: "flame.fill")
                Text("\(entry.streak) · \(s?.today?.kicker ?? "BE Mastery")")
            }
            .beWidgetURL(BEWidgetLink.today(s))
        default:
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: entry.moodIcon).font(.system(size: 11, weight: .bold))
                    Text(s?.today?.kicker ?? "BE Mastery").font(.system(size: 12, weight: .bold, design: .rounded)).lineLimit(1)
                    Spacer(minLength: 0)
                    Image(systemName: "flame.fill").font(.system(size: 10, weight: .bold))
                    Text("\(entry.streak)").font(.system(size: 12, weight: .heavy, design: .rounded))
                }
                Text(s?.today?.title ?? "Open BE Mastery").font(.system(size: 12, weight: .semibold, design: .rounded)).lineLimit(1)
                ProgressView(value: s?.overallProgress ?? 0).tint(.white)
            }
            .beWidgetURL(BEWidgetLink.today(s))
        }
    }
}

@available(iOS 16.0, *)
extension WidgetFamily {
    var isAccessory: Bool { self == .accessoryCircular || self == .accessoryRectangular || self == .accessoryInline }
}

// MARK: - the entry view and the widget

struct BEWidgetEntryView: View {
    var entry: BEWidgetEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        let pal = BEPalette.make(entry.snap, area: entry.area)
        /* small and lock-screen: signed in; medium and large: Premium (owner, 6 Oct 2026) */
        let tier = family == .systemSmall ? "small" : (family == .systemMedium || family == .systemLarge ? "full" : "small")
        let lock = BEWidgetLock.of(entry.snap, tier: tier)
        Group {
            if #available(iOS 16.0, *), family.isAccessory {
                if lock == .none { BEAccessoryView(entry: entry, s: entry.snap) } else { BEAccessoryLockedView(s: entry.snap) }
            } else if lock != .none {
                BELockedView(lock: lock, s: entry.snap, pal: pal, compact: family == .systemSmall) { home(pal, sample: true) }
                    .beWidgetBackground(pal.bg)
            } else {
                home(pal).beWidgetBackground(pal.bg)
            }
        }
        .environment(\.layoutDirection, (entry.snap?.isRTL ?? false) ? .rightToLeft : .leftToRight)
    }

    /// `sample`: under a lock the learner sees the widget's real shape — their own
    /// progress when the app has sent it, the sample learner when it has not
    /// (signed out, the app sends none).
    @ViewBuilder private func home(_ pal: BEPalette, sample: Bool = false) -> some View {
        let shown: BEWidgetSnapshot? = (sample && entry.snap?.week == nil) ? BEWidgetSample.snapshot(area: entry.area) : entry.snap
        if let s = shown {
            let e = sample && entry.snap?.week == nil ? BEWidgetEntry.make(s, at: entry.date, area: entry.area) : entry
            switch family {
            case .systemSmall: BESmallView(entry: e, s: s, pal: pal)
            case .systemMedium: BEMediumView(entry: e, s: s, pal: pal)
            default: BELargeView(entry: e, s: s, pal: pal)
            }
        } else {
            BEEmptyView(pal: pal, area: entry.area)
        }
    }
}

extension View {
    /// iOS 17 draws the widget's background itself (and needs to, for StandBy
    /// and the tinted home screen); earlier versions take a plain background.
    @ViewBuilder func beWidgetBackground(_ bg: LinearGradient) -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) { Rectangle().fill(bg) }
        } else {
            self.padding(14).frame(maxWidth: .infinity, maxHeight: .infinity).background(Rectangle().fill(bg))
        }
    }
}

/// Three gallery entries, one body. "Your road map" follows whichever
/// programme is open in the app; "General English" and "Welding English"
/// each show their own programme's last state, so a learner on both can keep
/// both on the home screen (owner, 5 Oct 2026).
func beWidgetConfiguration(kind: String, area: String?, name: String, description: String) -> some WidgetConfiguration {
    var families: [WidgetFamily] = [.systemSmall, .systemMedium, .systemLarge]
    if #available(iOS 16.0, *) { families += [.accessoryCircular, .accessoryRectangular, .accessoryInline] }
    return StaticConfiguration(kind: kind, provider: BEWidgetProvider(area: area)) { entry in
        BEWidgetEntryView(entry: entry)
    }
    .configurationDisplayName(name)
    .description(description)
    .supportedFamilies(families)
}

struct BEWidget: Widget {
    var body: some WidgetConfiguration {
        beWidgetConfiguration(kind: BEWidgetShared.kind, area: nil, name: "Your road map",
                              description: "Today's step, your streak and your place on the plan — for the programme you have open.")
    }
}

struct BEWidgetGeneral: Widget {
    var body: some WidgetConfiguration {
        beWidgetConfiguration(kind: "BEWidgetGE", area: "ge", name: "General English",
                              description: "Your General English streak, today's step and the 12-week road map.")
    }
}

struct BEWidgetWelding: Widget {
    var body: some WidgetConfiguration {
        beWidgetConfiguration(kind: "BEWidgetPro", area: "pro", name: "Welding English",
                              description: "Your Welding English streak, today's step and the road map of stages.")
    }
}

// MARK: - sample data (placeholders and previews only — never shown as real)

enum BEWidgetSample {
    static func snapshot(area: String?) -> BEWidgetSnapshot? {
        guard area == "pro" else { return snapshot }
        return BEWidgetSnapshot.parse("""
        {"v":1,"at":0,"lang":"en","dir":"ltr","theme":"dark","area":"pro","programme":"Welding English",
         "streak":5,"best":9,"lastDay":"\(BEWidgetDay.key(Date()))",
         "week":{"n":2,"total":12,"done":3,"per":7,"title":"Safety briefings"},
         "overall":{"done":10,"total":84,"pct":12},"weekGoal":{"n":2,"goal":6},"words":4,
         "today":{"kind":"week","kicker":"Stage 2 · Thursday","title":"Report a weld defect clearly","cta":"Continue Stage 2","view":"session","w":2,"d":"Thu"},
         "steps":["done","now","next","locked","locked","locked","locked","locked","locked","locked","locked","locked"],
         "phases":[{"label":"Foundations","pct":100,"state":"done"},{"label":"Workshop","pct":15,"state":"now"},{"label":"Site","pct":0,"state":"locked"}],
         "line":"25 minutes today keeps the streak alive.",
         "labels":{"streak":"day streak","today":"Today","words":"words due","goal":"this week","best":"best streak","roadmap":"Road map","unit":"Stage","open":"Open"}}
        """)
    }

    static let snapshot: BEWidgetSnapshot? = BEWidgetSnapshot.parse("""
    {"v":1,"at":0,"lang":"en","dir":"ltr","theme":"dark","area":"ge","programme":"General English",
     "streak":12,"best":21,"lastDay":"\(BEWidgetDay.key(Date()))",
     "week":{"n":3,"total":12,"done":2,"per":7,"title":"Clear updates"},
     "overall":{"done":16,"total":84,"pct":19},"weekGoal":{"n":3,"goal":6},"words":7,
     "today":{"kind":"week","kicker":"Week 3 · Tuesday","title":"Give a clear status update","cta":"Continue Week 3","view":"session","w":3,"d":"Tue"},
     "steps":["done","done","now","next","locked","locked","locked","locked","locked","locked","locked","locked"],
     "phases":[{"label":"Foundations","pct":100,"state":"done"},{"label":"Fluency","pct":30,"state":"now"},{"label":"Influence","pct":0,"state":"locked"}],
     "line":"25 minutes today keeps the streak alive.",
     "labels":{"streak":"day streak","today":"Today","words":"words due","goal":"this week","best":"best streak","roadmap":"Road map","unit":"Week","open":"Open"}}
    """)
}

struct BEWidget_Previews: PreviewProvider {
    static var previews: some View {
        let now = Date()
        Group {
            BEWidgetEntryView(entry: BEWidgetEntry.make(BEWidgetSample.snapshot, at: now))
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            BEWidgetEntryView(entry: BEWidgetEntry.make(BEWidgetSample.snapshot, at: now))
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            BEWidgetEntryView(entry: BEWidgetEntry.make(BEWidgetSample.snapshot, at: now))
                .previewContext(WidgetPreviewContext(family: .systemLarge))
            BEWidgetEntryView(entry: BEWidgetEntry.make(nil, at: now))
                .previewContext(WidgetPreviewContext(family: .systemMedium))
        }
    }
}

/// The Welding widget, and its empty state before Welding has been opened.
struct BEWidgetWelding_Previews: PreviewProvider {
    static var previews: some View {
        let now = Date()
        Group {
            BEWidgetEntryView(entry: BEWidgetEntry.make(BEWidgetSample.snapshot(area: "pro"), at: now, area: "pro"))
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            BEWidgetEntryView(entry: BEWidgetEntry.make(nil, at: now, area: "pro"))
                .previewContext(WidgetPreviewContext(family: .systemSmall))
        }
    }
}
