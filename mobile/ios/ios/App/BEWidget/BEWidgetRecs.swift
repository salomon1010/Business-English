import WidgetKit
import SwiftUI
import AppIntents

/// BE Mastery — the Recommendations widget (owner, 6 Oct 2026).
///
/// Everything Home recommends, in Home's own order: each row a picture (the
/// clip's thumbnail, or the app's screenshot of the page it opens), the title,
/// what it is, and why it was picked; a tap opens that exact recommendation.
/// Premium only (`recommended_content`); without it the widget is drawn in grey
/// with a lock and "Go Premium to unlock this widget".
///
/// Widgets cannot scroll — Apple's rule — so the list is paged: on iOS 17 two
/// arrows move through it inside the widget, without opening the app
/// (`BERecPageIntent`). Older systems show the first page; "More" opens Home.
struct BEWidgetRecsProvider: TimelineProvider {
    func placeholder(in context: Context) -> BEWidgetEntry { BEWidgetEntry.make(BEWidgetRecsSample.snapshot, at: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (BEWidgetEntry) -> Void) {
        let snap = context.isPreview ? (BEWidgetStore.load() ?? BEWidgetRecsSample.snapshot) : BEWidgetStore.load()
        completion(BEWidgetEntry.make(snap, at: Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<BEWidgetEntry>) -> Void) {
        /* the app reloads this widget whenever it publishes; nothing here depends on the clock */
        completion(Timeline(entries: [BEWidgetEntry.make(BEWidgetStore.load(), at: Date())], policy: .never))
    }
}

/// How many recommendations fit on one page of each size.
enum BERecLayout {
    static func perPage(_ f: WidgetFamily) -> Int {
        switch f {
        case .systemLarge: return 4
        case .systemExtraLarge: return 4
        default: return 2
        }
    }
}

/// One page of the list, on the page the arrows last chose.
struct BERecsView: View {
    let s: BEWidgetSnapshot
    let pal: BEPalette
    @Environment(\.widgetFamily) private var family

    var body: some View {
        let all = s.recs ?? []
        let per = BERecLayout.perPage(family)
        let pages = max(1, Int((Double(all.count) / Double(per)).rounded(.up)))
        let page = min(BEWidgetRecPage.get(), pages - 1)
        let items = Array(all.dropFirst(page * per).prefix(per))
        VStack(alignment: .leading, spacing: family == .systemLarge ? 9 : 7) {
            header(page: page, pages: pages)
            if items.isEmpty {
                Spacer(minLength: 0)
                Text(s.label("recnone", "Practise a little — your recommendations will appear here."))
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(pal.muted)
                    .lineLimit(3)
                Spacer(minLength: 0)
            } else {
                ForEach(Array(items.enumerated()), id: \.offset) { _, r in
                    BELink(BEWidgetLink.rec(r)) { BERecRow(r: r, pal: pal, big: family == .systemLarge) }
                }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .beWidgetURL(BEWidgetLink.url(view: "home"))
    }

    @ViewBuilder private func header(page: Int, pages: Int) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "sparkles").font(.system(size: 11, weight: .bold)).foregroundColor(pal.gold)
            Text(s.label("recs", "Recommended for you"))
                .font(.system(size: 13, weight: .heavy, design: .rounded))
                .foregroundColor(pal.text)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            if pages > 1 {
                if #available(iOS 17.0, *) {
                    BERecArrows(page: page, pages: pages, pal: pal)
                } else {
                    BELink(BEWidgetLink.url(view: "home")) {
                        Text(s.label("recmore", "More")).font(.system(size: 11, weight: .bold, design: .rounded)).foregroundColor(pal.acc2)
                    }
                }
            }
        }
    }
}

/// A recommendation: a 16:9 picture, then what it is, its title and why.
struct BERecRow: View {
    let r: BEWidgetSnapshot.Rec
    let pal: BEPalette
    var big = false

    var icon: String {
        switch r.k ?? "" {
        case "challenge": return "dumbbell.fill"
        case "video": return "play.fill"
        case "words": return "text.book.closed.fill"
        case "trouble": return "waveform"
        case "session": return "play.circle.fill"
        case "phrases": return "text.bubble.fill"
        case "partner": return "person.2.fill"
        case "roleplay", "ai": return "bubble.left.and.bubble.right.fill"
        default: return "sparkles"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            thumb
                .frame(width: big ? 92 : 78, height: big ? 52 : 44)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(Color.white.opacity(0.08), lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: icon).font(.system(size: 8, weight: .bold))
                    Text((r.s ?? "").uppercased()).lineLimit(1)
                    if let m = r.min, m > 0 { Text("· \(m) min") }
                }
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .foregroundColor(pal.acc2)
                Text(r.t ?? "")
                    .font(.system(size: big ? 13 : 12, weight: .bold, design: .rounded))
                    .foregroundColor(pal.text)
                    .lineLimit(big ? 2 : 1)
                    .minimumScaleFactor(0.85)
                if big, let w = r.why, !w.isEmpty {
                    Text(w).font(.system(size: 10, weight: .medium, design: .rounded)).foregroundColor(pal.muted).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold)).foregroundColor(pal.muted)
        }
        .padding(6)
        .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(pal.card))
    }

    @ViewBuilder private var thumb: some View {
        if let u = BEWidgetThumbs.url(for: r.img), let img = UIImage(contentsOfFile: u.path) {
            Image(uiImage: img).resizable().aspectRatio(contentMode: .fill)
        } else {
            ZStack {
                LinearGradient(colors: [pal.acc.opacity(0.55), pal.acc2.opacity(0.35)], startPoint: .topLeading, endPoint: .bottomTrailing)
                Image(systemName: icon).font(.system(size: 16, weight: .bold)).foregroundColor(.white.opacity(0.9))
            }
        }
    }
}

// MARK: - paging (iOS 17: buttons that run inside the widget)

@available(iOS 17.0, *)
struct BERecPageIntent: AppIntent {
    static var title: LocalizedStringResource = "Turn the recommendations page"
    static var isDiscoverable: Bool = false
    @Parameter(title: "Step") var step: Int
    init() { step = 1 }
    init(step: Int) { self.step = step }
    func perform() async throws -> some IntentResult {
        let snap = BEWidgetStore.load()
        let n = snap?.recs?.count ?? 0
        /* the medium widget shows 2 a page, the large 4: page on the medium count,
           so both sizes stay valid (the large one clamps) */
        let pages = max(1, Int((Double(n) / 2).rounded(.up)))
        var p = BEWidgetRecPage.get() + step
        if p < 0 { p = pages - 1 }
        if p >= pages { p = 0 }
        BEWidgetRecPage.set(p)
        return .result()
    }
}

@available(iOS 17.0, *)
struct BERecArrows: View {
    let page: Int, pages: Int
    let pal: BEPalette
    var body: some View {
        HStack(spacing: 4) {
            Text("\(page + 1)/\(pages)").font(.system(size: 10, weight: .bold, design: .rounded)).foregroundColor(pal.muted)
            Button(intent: BERecPageIntent(step: -1)) { arrow("chevron.up") }.buttonStyle(.plain)
            Button(intent: BERecPageIntent(step: 1)) { arrow("chevron.down") }.buttonStyle(.plain)
        }
    }
    func arrow(_ name: String) -> some View {
        Image(systemName: name)
            .font(.system(size: 11, weight: .heavy))
            .foregroundColor(pal.text)
            .frame(width: 24, height: 24)
            .background(Circle().fill(pal.text.opacity(0.10)))
    }
}

// MARK: - the widget

struct BEWidgetRecsEntryView: View {
    var entry: BEWidgetEntry
    @Environment(\.widgetFamily) private var family
    var body: some View {
        let pal = BEPalette.make(entry.snap, area: nil)
        let lock = BEWidgetLock.of(entry.snap, tier: "recs")
        Group {
            if lock != .none {
                BELockedView(lock: lock, s: entry.snap, pal: pal) {
                    BERecsView(s: BEWidgetRecsSample.snapshot ?? BEWidgetSnapshot.parse("{\"v\":1}")!, pal: pal)
                }
            } else if let s = entry.snap {
                BERecsView(s: s, pal: pal)
            }
        }
        .beWidgetBackground(pal.bg)
        .environment(\.layoutDirection, (entry.snap?.isRTL ?? false) ? .rightToLeft : .leftToRight)
    }
}

struct BEWidgetRecs: Widget {
    static let kind = "BEWidgetRecs"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: BEWidgetRecs.kind, provider: BEWidgetRecsProvider()) { entry in
            BEWidgetRecsEntryView(entry: entry)
        }
        .configurationDisplayName("Recommendations")
        .description("Everything BE Mastery recommends for you — videos, challenges and practice — one tap from your home screen. Premium.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

/// The sample learner's list, for the gallery and for what a locked widget shows
/// behind its lock — never the learner's own picks.
enum BEWidgetRecsSample {
    static let snapshot: BEWidgetSnapshot? = BEWidgetSnapshot.parse("""
    {"v":1,"at":0,"lang":"en","dir":"ltr","theme":"dark","area":"ge","programme":"General English",
     "gate":{"signedIn":true,"full":true,"recs":true},
     "recs":[
      {"t":"How to give a clear status update","s":"Watch and shadow","why":"Because you practised meetings","k":"video","min":6},
      {"t":"Challenge: the opening line","s":"Challenge","why":"Because you struggled with 'present'","k":"challenge","min":3},
      {"t":"Your 7 words due","s":"Review","why":"Words you saved","k":"words"},
      {"t":"Practise a salary talk","s":"Conversation","why":"Your next step","k":"roleplay"}],
     "labels":{"recs":"Recommended for you"}}
    """)
}

private let bePreviewLocked = BEWidgetSnapshot.parse("""
{"v":1,"at":0,"lang":"en","dir":"ltr","theme":"dark","area":"ge","gate":{"signedIn":true,"full":false,"recs":false},"recs":[],"labels":{}}
""")
struct BEWidgetRecs_Previews: PreviewProvider {
    static var previews: some View {
        BEWidgetRecsEntryView(entry: BEWidgetEntry.make(BEWidgetRecsSample.snapshot, at: Date()))
            .previewContext(WidgetPreviewContext(family: .systemLarge))
    }
}
struct BEWidgetRecsMedium_Previews: PreviewProvider {
    static var previews: some View {
        BEWidgetRecsEntryView(entry: BEWidgetEntry.make(BEWidgetRecsSample.snapshot, at: Date()))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
struct BEWidgetRecsLocked_Previews: PreviewProvider {
    static var previews: some View {
        BEWidgetRecsEntryView(entry: BEWidgetEntry.make(bePreviewLocked, at: Date()))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
struct BEWidgetLargeLocked_Previews: PreviewProvider {
    static var previews: some View {
        BEWidgetEntryView(entry: BEWidgetEntry.make(bePreviewLocked, at: Date()))
            .previewContext(WidgetPreviewContext(family: .systemLarge))
    }
}
struct BEWidgetSmallSignedOut_Previews: PreviewProvider {
    static var previews: some View {
        BEWidgetEntryView(entry: BEWidgetEntry.make(nil, at: Date()))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
}
/* Marketing renders (the website's widget pictures, 7 Oct 2026): the sample learner only. */
struct BEWidgetSiteSmall_Previews: PreviewProvider {
    static var previews: some View { BEWidgetEntryView(entry: BEWidgetEntry.make(BEWidgetSample.snapshot, at: Date())).previewContext(WidgetPreviewContext(family: .systemSmall)) }
}
struct BEWidgetSiteMedium_Previews: PreviewProvider {
    static var previews: some View { BEWidgetEntryView(entry: BEWidgetEntry.make(BEWidgetSample.snapshot, at: Date())).previewContext(WidgetPreviewContext(family: .systemMedium)) }
}
struct BEWidgetSiteLarge_Previews: PreviewProvider {
    static var previews: some View { BEWidgetEntryView(entry: BEWidgetEntry.make(BEWidgetSample.snapshot, at: Date())).previewContext(WidgetPreviewContext(family: .systemLarge)) }
}
struct BEWidgetSiteWelding_Previews: PreviewProvider {
    static var previews: some View { BEWidgetEntryView(entry: BEWidgetEntry.make(BEWidgetSample.snapshot(area: "pro"), at: Date(), area: "pro")).previewContext(WidgetPreviewContext(family: .systemMedium)) }
}
