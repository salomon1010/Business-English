import Testing
import Foundation
import UserNotifications
@testable import App

/// Smart Coach session reminders (10 Oct 2026): what the shell will schedule
/// from the web layer's items, and what a tap hands back.
struct BEPushCoachTests {

    private func item(_ o: [String: Any] = [:]) -> [String: Any] {
        var base: [String: Any] = ["id": "be-coach-cp-abc-0", "year": 2026, "month": 10, "day": 26, "hour": 19, "minute": 0,
                                   "title": "Smart Coach", "body": "Session 1 of 4 is ready · about 8 minutes.", "coach": "cp-abc:0"]
        o.forEach { base[$0.key] = $0.value }
        return base
    }

    /// A valid item becomes a one-off CALENDAR trigger at that wall-clock
    /// time — the day the UK clocks go back keeps 19:00 local.
    @Test func aSessionIsAWallClockCalendarTrigger() throws {
        let r = try #require(BEPushPlugin.coachRequest(item()))
        #expect(r.identifier == "be-coach-cp-abc-0")
        let t = try #require(r.trigger as? UNCalendarNotificationTrigger)
        #expect(t.repeats == false)
        #expect(t.dateComponents.hour == 19 && t.dateComponents.minute == 0 && t.dateComponents.day == 26)
        let be = r.content.userInfo["be"] as? [String: String]
        #expect(be?["view"] == "coach" && be?["coach"] == "cp-abc:0")
    }

    /// Anything that is not a Smart Coach id, not a real date, or too long is refused.
    @Test(arguments: [
        ["id": "be-partner-call"], ["month": 13], ["day": 31, "month": 2], ["hour": 24],
        ["title": ""], ["body": String(repeating: "x", count: 200)], ["year": 1999],
    ] as [[String: Any]])
    func badItemsAreRefused(_ change: [String: Any]) {
        #expect(BEPushPlugin.coachRequest(item(change)) == nil)
    }

    /// The tap reaches the web layer with the session tag, and nothing else the payload did not name.
    @Test func aTapCarriesTheCoachTag() {
        let out = BEPushBox.shape(["be": ["view": "coach", "coach": "cp-abc:2", "evil": "x"]])
        #expect(out["coach"] as? String == "cp-abc:2")
        #expect(out["view"] as? String == "coach")
        #expect(out["evil"] == nil)
    }
}
