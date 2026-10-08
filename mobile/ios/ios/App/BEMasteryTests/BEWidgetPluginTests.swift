import Testing
import Foundation
@testable import App

/// The widget bridge (5 Oct 2026): what the app will store for the widget,
/// and which taps on the widget it will follow.
struct BEWidgetPluginTests {

    /// Only a version-1 JSON object under 16 KB is stored. The widget decodes
    /// with every field optional, so this is the one shape check that matters.
    @Test func onlyAVersionOneSnapshotIsAccepted() {
        #expect(BEWidgetPlugin.accept(#"{"v":1,"streak":3}"#) != nil)
        #expect(BEWidgetPlugin.accept(#"{"v":2,"streak":3}"#) == nil)
        #expect(BEWidgetPlugin.accept(#"{"streak":3}"#) == nil)
        #expect(BEWidgetPlugin.accept(#"[1,2,3]"#) == nil)
        #expect(BEWidgetPlugin.accept("not json") == nil)
        #expect(BEWidgetPlugin.accept("") == nil)
        let big = #"{"v":1,"line":""# + String(repeating: "a", count: 17_000) + #""}"#
        #expect(BEWidgetPlugin.accept(big) == nil)
    }

    /// A tap carries a view, and at most a week number, a weekday and an
    /// action — all from short allow-lists. Anything else is not routed.
    @Test(arguments: [
        ("bemastery://open?view=session&w=3&d=Tue", "session", 3, "Tue", nil),
        ("bemastery://open?view=practice&act=words", "practice", nil, nil, "words"),
        ("bemastery://open?view=journey", "journey", nil, nil, nil),
        ("BEMASTERY://OPEN?view=review", "review", nil, nil, nil),
    ] as [(String, String, Int?, String?, String?)])
    func aWidgetTapIsRoutedToAKnownView(url: String, view: String, w: Int?, d: String?, act: String?) throws {
        let link = try #require(URL(string: url))
        let out = try #require(BEWidgetBox.route(link))
        #expect(out["view"] as? String == view)
        #expect(out["w"] as? Int == w)
        #expect(out["d"] as? String == d)
        #expect(out["act"] as? String == act)
        #expect(out["src"] as? String == "widget")
    }

    @Test(arguments: [
        "bemastery://open?view=settings",                 // not a page the widget may open
        "bemastery://open",                               // no view
        "bemastery://close?view=session",                 // wrong host
        "https://app.lomonec.com/?view=session",          // not our scheme
        "bemastery://open?view=<script>",                 // rubbish
    ])
    func anythingElseIsNotRouted(url: String) throws {
        #expect(BEWidgetBox.route(try #require(URL(string: url))) == nil)
    }

    /// Out-of-range arguments are dropped, the view is kept — the learner
    /// still lands somewhere real.
    @Test func badArgumentsAreDroppedNotFatal() throws {
        let link = try #require(URL(string: "bemastery://open?view=session&w=99&d=Funday&act=hack"))
        let out = try #require(BEWidgetBox.route(link))
        #expect(out["view"] as? String == "session")
        #expect(out["w"] == nil)
        #expect(out["d"] == nil)
        #expect(out["act"] == nil)
    }

    /// A tap that arrives before the web layer listens is kept, and served once.
    @Test func anEarlyTapWaitsForTheWebLayer() async throws {
        /* another test may have brought a bridge up, which registers the plugin
           on the box; this is the cold-launch case, where there is none yet */
        let attached = BEWidgetBox.shared.plugin
        BEWidgetBox.shared.plugin = nil
        defer { BEWidgetBox.shared.plugin = attached }
        let url = try #require(URL(string: "bemastery://open?view=journey"))
        #expect(BEWidgetBox.shared.deliver(url: url) == true)
        let first: [String: Any]? = await withCheckedContinuation { c in BEWidgetBox.shared.takePending { c.resume(returning: $0) } }
        #expect(first?["view"] as? String == "journey")
        let second: [String: Any]? = await withCheckedContinuation { c in BEWidgetBox.shared.takePending { c.resume(returning: $0) } }
        #expect(second == nil)
    }

    /// A snapshot is filed under its programme as well as as the latest, so the
    /// Welding widget keeps Welding's state while General English is open.
    @Test func aSnapshotIsFiledUnderItsProgramme() {
        #expect(BEWidgetPlugin.area(of: #"{"v":1,"area":"pro"}"#) == "pro")
        #expect(BEWidgetPlugin.area(of: #"{"v":1,"area":"ge"}"#) == "ge")
        #expect(BEWidgetPlugin.area(of: #"{"v":1}"#) == "ge")
        #expect(BEWidgetPlugin.area(of: #"{"v":1,"area":"nonsense"}"#) == "ge")
        #expect(BEWidgetPlugin.areas == ["ge", "pro"])
    }

    /// The App Group and key the app writes must be the ones the widget reads.
    /// The widget's copy lives in the extension (BEWidgetModel.swift); the
    /// release checks compare the two source files. Here: the values the app
    /// side was built with.
    @Test func appGroupIdentifierIsTheProjectsOwn() {
        #expect(BEWidgetPlugin.group == "group.com.lomonec.bemastery")
        #expect(BEWidgetPlugin.key == "be_widget_snapshot")
    }

    /// A recommendation tap (owner, 6 Oct 2026): only a place a Home card opens,
    /// a known action and plain arguments survive.
    @Test func aRecommendationTapIsReducedToAKnownPlace() throws {
        let ok = try #require(URL(string: "bemastery://open?rec=1&view=shadow&act=clip&a0=MZAjfsyJa1U&a1=0&a2=12&ch=1"))
        let r = try #require(BEWidgetBox.route(ok))
        let rec = try #require(r["rec"] as? [String: Any])
        #expect(rec["view"] as? String == "shadow")
        #expect(rec["act"] as? String == "clip")
        #expect((rec["a"] as? [String]) == ["MZAjfsyJa1U", "0", "12"])
        #expect(rec["ch"] as? Bool == true)
        let bad = try #require(URL(string: "bemastery://open?rec=1&view=settings&act=wipe"))
        #expect(BEWidgetBox.route(bad) == nil)
        let odd = try #require(URL(string: "bemastery://open?rec=1&view=practice&act=wipe&a0=../x"))
        let r2 = try #require(BEWidgetBox.route(odd)?["rec"] as? [String: Any])
        #expect(r2["act"] == nil)
        #expect((r2["a"] as? [String]) == [])
    }

    /// A locked widget opens the sign-in sheet or the Premium offer.
    @Test func aLockedWidgetTapIsAllowed() throws {
        let su = try #require(URL(string: "bemastery://open?view=home&act=signin"))
        let s = try #require(BEWidgetBox.route(su))
        #expect(s["act"] as? String == "signin")
        let pu = try #require(URL(string: "bemastery://open?view=home&act=premium"))
        let p = try #require(BEWidgetBox.route(pu))
        #expect(p["act"] as? String == "premium")
    }

    /// The picture's file name must be the one the widget computes (BEWidgetThumbs.name).
    @Test func thumbnailNamesAreStable() {
        let n = BEWidgetThumbCache.name(for: "https://i.ytimg.com/vi/MZAjfsyJa1U/mqdefault.jpg")
        #expect(n.count == 28 && n.hasSuffix(".jpg"))
        #expect(n == BEWidgetThumbCache.name(for: "https://i.ytimg.com/vi/MZAjfsyJa1U/mqdefault.jpg"))
        #expect(n != BEWidgetThumbCache.name(for: "home-shots/vocab.jpg"))
    }
}
