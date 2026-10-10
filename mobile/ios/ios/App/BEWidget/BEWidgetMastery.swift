import WidgetKit
import SwiftUI

/// The Welding Mastery widget (owner, 9 Oct 2026: "a widget especially for
/// this game"). Welding English only: it reads the Welding snapshot ("pro"),
/// and the app puts the game's block (`wm`) in that snapshot only while the
/// game exists for this learner. Words mastered of 250, level and XP, the
/// streak in the game, and today's shift with its progress. One tap opens the
/// hub — on today's shift when it is still open.
///
/// Like the other widgets it draws what the app sent and computes nothing.
/// Signed out it is locked ("Sign in"); the game is not Premium, so no plan
/// lock.
struct BEMasteryProvider: TimelineProvider {
    func placeholder(in context: Context) -> BEWidgetEntry {
        BEWidgetEntry.make(BEMasterySample.snapshot, at: Date(), area: "pro")
    }
    func getSnapshot(in context: Context, completion: @escaping (BEWidgetEntry) -> Void) {
        let snap = context.isPreview ? (BEWidgetStore.load(area: "pro") ?? BEMasterySample.snapshot) : BEWidgetStore.load(area: "pro")
        completion(BEWidgetEntry.make(snap, at: Date(), area: "pro"))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<BEWidgetEntry>) -> Void) {
        let snap = BEWidgetStore.load(area: "pro")
        /* the shift is a UTC day: redraw at the next two midnights */
        let now = Date(), m1 = BEWidgetDay.nextMidnight(after: now), m2 = BEWidgetDay.nextMidnight(after: m1)
        completion(Timeline(entries: [now, m1, m2].map { BEWidgetEntry.make(snap, at: $0, area: "pro") }, policy: .atEnd))
    }
}

/// The game's own colours: navy, electric blue, amber for XP, green for mastery.
struct BEMasteryPalette {
    let bgA = Color(hex: 0x0D1630), bgB = Color(hex: 0x070B16)
    let text = Color(hex: 0xDBE3F4), muted = Color(hex: 0x9AA8C4)
    let blue = Color(hex: 0x3B82F6), blue2 = Color(hex: 0x60A5FA)
    let gold = Color(hex: 0xF5B52E), gold2 = Color(hex: 0xFFD36B), green = Color(hex: 0x34D399)
    var bg: LinearGradient { LinearGradient(colors: [bgA, bgB], startPoint: .topLeading, endPoint: .bottomTrailing) }
}

extension BEWidgetSnapshot.Mastery {
    func label(_ key: String, _ fallback: String) -> String {
        if let v = labels?[key], !v.trimmingCharacters(in: .whitespaces).isEmpty { return v }
        return fallback
    }
    var masteredProgress: Double {
        guard let t = total, t > 0 else { return 0 }
        return min(1, max(0, Double(m ?? 0) / Double(t)))
    }
    var shiftProgress: Double {
        guard let s = shift, let n = s.n, n > 0 else { return 0 }
        return min(1, max(0, Double(s.p ?? 0) / Double(n)))
    }
    var shiftOpen: Bool { shift?.done != true }
    /// today's shift while it is open, else the hub
    var link: URL { shiftOpen ? BEWidgetLink.url(view: "mastery", act: "shift") : BEWidgetLink.url(view: "mastery") }
}

/// The helmet-and-book mark, drawn with shapes (no image asset needed).
struct BEMasteryMark: View {
    let size: CGFloat
    private let pal = BEMasteryPalette()
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.24).fill(Color(hex: 0x0B1224))
            RoundedRectangle(cornerRadius: size * 0.24)
                .stroke(LinearGradient(colors: [pal.gold2, Color(hex: 0xE08A12)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: max(1.5, size * 0.04))
            Image(systemName: "book.fill")
                .font(.system(size: size * 0.34, weight: .bold))
                .foregroundColor(Color(hex: 0xF4E6C4))
                .offset(y: size * 0.12)
            Capsule().fill(LinearGradient(colors: [pal.blue2, Color(hex: 0x2563EB)], startPoint: .top, endPoint: .bottom))
                .frame(width: size * 0.34, height: size * 0.11)
                .offset(y: -size * 0.16)
            Image(systemName: "sparkle")
                .font(.system(size: size * 0.16, weight: .bold))
                .foregroundColor(pal.gold2)
                .offset(x: size * 0.25, y: -size * 0.27)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Words mastered of 250, as a ring.
struct BEMasteryRing: View {
    let w: BEWidgetSnapshot.Mastery
    let size: CGFloat
    private let pal = BEMasteryPalette()
    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.09), lineWidth: size * 0.1)
            Circle().trim(from: 0, to: max(0.005, w.masteredProgress))
                .stroke(pal.green, style: StrokeStyle(lineWidth: size * 0.1, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(w.m ?? 0)").font(.system(size: size * 0.3, weight: .heavy, design: .rounded)).foregroundColor(pal.text)
                Text("/\(w.total ?? 250)").font(.system(size: size * 0.14, weight: .semibold, design: .rounded)).foregroundColor(pal.muted)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("\(w.m ?? 0) / \(w.total ?? 250) \(w.label("mastered", "words mastered"))"))
    }
}

struct BEMasteryBar: View {
    let value: Double
    let color: Color
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.09))
                Capsule().fill(color).frame(width: max(4, g.size.width * value))
            }
        }
        .frame(height: 6)
        .accessibilityHidden(true)
    }
}

struct BEMasterySmallView: View {
    let w: BEWidgetSnapshot.Mastery
    private let pal = BEMasteryPalette()
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                BEMasteryMark(size: 22)
                Text(w.label("title", "Welding Mastery")).font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundColor(pal.gold2).lineLimit(1).minimumScaleFactor(0.8)
            }
            HStack(spacing: 8) {
                BEMasteryRing(w: w, size: 54)
                VStack(alignment: .leading, spacing: 3) {
                    Text(w.label("level", "Level \(w.lvl ?? 1)")).font(.system(size: 12, weight: .bold, design: .rounded)).foregroundColor(pal.text)
                    Label("\(w.xp ?? 0) \(w.label("xp", "XP"))", systemImage: "hexagon.fill").font(.system(size: 10, weight: .semibold, design: .rounded)).foregroundColor(pal.gold)
                    Label("\(w.streak ?? 0)", systemImage: "flame.fill").font(.system(size: 10, weight: .semibold, design: .rounded)).foregroundColor(Color(hex: 0xFB923C))
                }
            }
            Spacer(minLength: 0)
            Text(w.shiftOpen ? (w.shift?.t ?? w.label("shift", "Today's Shift")) : w.label("done", "Shift complete"))
                .font(.system(size: 10, weight: .semibold, design: .rounded)).foregroundColor(w.shiftOpen ? pal.text : pal.green).lineLimit(1).minimumScaleFactor(0.8)
            BEMasteryBar(value: w.shiftOpen ? w.shiftProgress : 1, color: w.shiftOpen ? pal.blue : pal.green)
        }
        .beWidgetURL(w.link)
    }
}

struct BEMasteryMediumView: View {
    let w: BEWidgetSnapshot.Mastery
    private let pal = BEMasteryPalette()
    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 6) {
                BEMasteryRing(w: w, size: 78)
                Text(w.label("mastered", "words mastered")).font(.system(size: 10, weight: .semibold, design: .rounded)).foregroundColor(pal.muted).lineLimit(1).minimumScaleFactor(0.7)
            }
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    BEMasteryMark(size: 20)
                    Text(w.label("title", "Welding Mastery")).font(.system(size: 13, weight: .heavy, design: .rounded)).foregroundColor(pal.gold2).lineLimit(1)
                }
                HStack(spacing: 10) {
                    Text(w.label("level", "Level \(w.lvl ?? 1)")).font(.system(size: 12, weight: .bold, design: .rounded)).foregroundColor(pal.text)
                    Label("\(w.xp ?? 0) \(w.label("xp", "XP"))", systemImage: "hexagon.fill").font(.system(size: 11, weight: .semibold, design: .rounded)).foregroundColor(pal.gold)
                    Label("\(w.streak ?? 0)", systemImage: "flame.fill").font(.system(size: 11, weight: .semibold, design: .rounded)).foregroundColor(Color(hex: 0xFB923C))
                }
                BEMasteryBar(value: Double(w.pct ?? 0) / 100, color: pal.gold)
                Spacer(minLength: 0)
                Text(w.label("shift", "Today's Shift").uppercased()).font(.system(size: 9, weight: .bold, design: .rounded)).foregroundColor(pal.gold2)
                Text(w.shiftOpen ? (w.shift?.t ?? "") : w.label("done", "Shift complete"))
                    .font(.system(size: 13, weight: .bold, design: .rounded)).foregroundColor(w.shiftOpen ? pal.text : pal.green).lineLimit(1).minimumScaleFactor(0.8)
                HStack(spacing: 8) {
                    BEMasteryBar(value: w.shiftOpen ? w.shiftProgress : 1, color: w.shiftOpen ? pal.blue : pal.green)
                    Text("\(w.shift?.p ?? 0)/\(w.shift?.n ?? 5)").font(.system(size: 10, weight: .semibold, design: .rounded)).foregroundColor(pal.muted)
                    Text(w.label("open", "Play")).font(.system(size: 11, weight: .bold, design: .rounded)).foregroundColor(.white)
                        .padding(.horizontal, 10).padding(.vertical, 4).background(Capsule().fill(pal.blue))
                }
            }
        }
        .beWidgetURL(w.link)
    }
}

struct BEMasteryEmptyView: View {
    private let pal = BEMasteryPalette()
    var compact: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            BEMasteryMark(size: compact ? 30 : 36)
            Spacer(minLength: 0)
            Text("Welding Mastery").font(.system(size: 14, weight: .heavy, design: .rounded)).foregroundColor(pal.gold2)
            Text("Open Welding Mastery in BE Mastery to start.").font(.system(size: 11, weight: .medium, design: .rounded)).foregroundColor(pal.muted).lineLimit(3)
        }
        .beWidgetURL(BEWidgetLink.url(view: "mastery"))
    }
}

struct BEMasteryEntryView: View {
    var entry: BEWidgetEntry
    @Environment(\.widgetFamily) private var family
    private let pal = BEMasteryPalette()

    var body: some View {
        let lock = BEWidgetLock.of(entry.snap, tier: "small")
        let w = entry.snap?.wm
        Group {
            if lock != .none {
                BELockedView(lock: lock, s: entry.snap, pal: BEPalette.make(entry.snap, area: "pro"), compact: family == .systemSmall) {
                    content(BEMasterySample.snapshot?.wm)
                }
            } else {
                content(w)
            }
        }
        .beWidgetBackground(pal.bg)
    }

    @ViewBuilder private func content(_ w: BEWidgetSnapshot.Mastery?) -> some View {
        if let w = w {
            if family == .systemSmall { BEMasterySmallView(w: w) } else { BEMasteryMediumView(w: w) }
        } else {
            BEMasteryEmptyView(compact: family == .systemSmall)
        }
    }
}

struct BEWidgetMastery: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BEWidgetMastery", provider: BEMasteryProvider()) { entry in
            BEMasteryEntryView(entry: entry)
        }
        .configurationDisplayName("Welding Mastery")
        .description("Words mastered, your level, XP and today's shift in the welding vocabulary game.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - sample data (placeholders, previews and the locked state only — never shown as real)

enum BEMasterySample {
    static let snapshot: BEWidgetSnapshot? = BEWidgetSnapshot.parse("""
    {"v":1,"at":0,"lang":"en","dir":"ltr","theme":"dark","area":"pro","programme":"Welding English",
     "wm":{"m":38,"total":250,"lvl":4,"xp":720,"need":280,"pct":40,"streak":5,
           "shift":{"t":"Identify five tools correctly","p":2,"n":5,"done":false},"next":"Visual recognition",
           "labels":{"title":"Welding Mastery","mastered":"words mastered","level":"Level 4","xp":"XP","streak":"day streak","shift":"Today's Shift","done":"Shift complete","open":"Play"}}}
    """)
}

struct BEWidgetMastery_Previews: PreviewProvider {
    static var previews: some View {
        let now = Date()
        Group {
            BEMasteryEntryView(entry: BEWidgetEntry.make(BEMasterySample.snapshot, at: now, area: "pro"))
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            BEMasteryEntryView(entry: BEWidgetEntry.make(BEMasterySample.snapshot, at: now, area: "pro"))
                .previewContext(WidgetPreviewContext(family: .systemMedium))
        }
    }
}
