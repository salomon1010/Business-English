import ActivityKit
import WidgetKit
import SwiftUI

/// The game streak countdown — a Live Activity (owner, 10 Oct 2026: "this kind of
/// notification for the game, on both sides, with the stopwatch").
///
/// The APP starts it (BEWidgetPlugin `liveStart`) when the learner leaves it in the
/// last three hours of the game day with today's daily mission or challenge not
/// done, in English Mastery or Welding Mastery; it ends it the moment the daily is
/// finished (`liveEnd`). The countdown runs to the end of the game day (UTC midnight,
/// the same day the hubs and the server count), drawn by the system from the
/// deadline — nothing here ticks, and nothing is fetched.
///
/// BEStreakActivityAttributes is declared twice, here and in the app's
/// BEWidgetPlugin.swift, with the same name and the same Codable shape: ActivityKit
/// matches the two by that, and each target compiles its own copy.
struct BEStreakActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var line: String        // "Last chance! Finish today's daily challenge."
        var streak: Int         // the hub's current streak, in days
        var deadline: Date      // the end of the game day
        var done: Bool          // finished: the card says so for its last seconds on screen
    }
    var title: String           // "English Mastery" · "Welding Mastery"
    var prog: String            // "general-english" · "welding"
    var doneLine: String        // "Daily done — streak safe."
}

@available(iOS 16.2, *)
struct BEStreakLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BEStreakActivityAttributes.self) { context in
            BEStreakLockView(attributes: context.attributes, state: context.state, stale: context.isStale)
                .activityBackgroundTint(Color(hex: 0x2A0E14))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "bemastery://open?view=" + (context.attributes.prog == "welding" ? "mastery" : "english") + "&act=daily"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BEStreakFlame(streak: context.state.streak, small: true).padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    BEStreakTimer(deadline: context.state.deadline, done: context.state.done || context.isStale)
                        .font(.system(size: 26, weight: .heavy, design: .rounded)).foregroundColor(.white).padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.done ? context.attributes.doneLine : context.state.line)
                        .font(.system(size: 14, weight: .semibold)).foregroundColor(Color(hex: 0xFECACA)).lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "flame.fill").foregroundColor(Color(hex: 0xFB923C))
            } compactTrailing: {
                BEStreakTimer(deadline: context.state.deadline, done: context.state.done || context.isStale)
                    .font(.system(size: 14, weight: .bold, design: .rounded)).foregroundColor(.white).frame(maxWidth: 64)
            } minimal: {
                Image(systemName: "flame.fill").foregroundColor(Color(hex: 0xFB923C))
            }
            .widgetURL(URL(string: "bemastery://open?view=" + (context.attributes.prog == "welding" ? "mastery" : "english") + "&act=daily"))
        }
    }
}

/// the running countdown, drawn by the system (no timeline needed)
@available(iOS 16.2, *)
struct BEStreakTimer: View {
    let deadline: Date, done: Bool
    var leading = false
    var body: some View {
        if done || deadline <= Date() {
            Image(systemName: "checkmark.circle.fill")
        } else {
            /* a timer Text takes the full width it is offered: align it where it belongs */
            Text(timerInterval: Date()...deadline, countsDown: true).monospacedDigit()
                .multilineTextAlignment(leading ? .leading : .trailing)
                .frame(maxWidth: .infinity, alignment: leading ? .leading : .trailing)
        }
    }
}

struct BEStreakFlame: View {
    let streak: Int, small: Bool
    var alert = true            // the red "!" while the streak is at risk; none once it is safe
    var body: some View {
        HStack(spacing: 6) {
            ZStack(alignment: .bottomTrailing) {
                Image(systemName: "flame.fill").font(.system(size: small ? 18 : 22, weight: .bold)).foregroundColor(Color(hex: 0xFDBA74).opacity(0.9))
                if alert {
                    Image(systemName: "exclamationmark.circle.fill").font(.system(size: small ? 9 : 11, weight: .bold))
                        .foregroundStyle(.white, Color(hex: 0xEF4444)).offset(x: 4, y: 3)
                }
            }
            if streak > 0 { Text("\(streak)").font(.system(size: small ? 18 : 22, weight: .heavy, design: .rounded)).foregroundColor(Color(hex: 0xFECACA)) }
        }
    }
}

/// the lock-screen card, after the owner's reference: the flame and the streak,
/// the big countdown, one line, and a glowing flame on the right
@available(iOS 16.2, *)
struct BEStreakLockView: View {
    let attributes: BEStreakActivityAttributes
    let state: BEStreakActivityAttributes.ContentState
    let stale: Bool
    var safe: Bool { state.done }
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    BEStreakFlame(streak: state.streak, small: false, alert: !safe)
                    Text(attributes.title).font(.system(size: 12, weight: .semibold)).foregroundColor(Color(hex: safe ? 0x86EFAC : 0xFCA5A5)).lineLimit(1)
                }
                if safe {
                    Text(attributes.doneLine).font(.system(size: 24, weight: .heavy, design: .rounded)).foregroundColor(.white)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                } else {
                    BEStreakTimer(deadline: state.deadline, done: stale, leading: true)
                        .font(.system(size: 40, weight: .heavy, design: .rounded)).foregroundColor(.white)
                    Text(state.line)
                        .font(.system(size: 15, weight: .semibold)).foregroundColor(.white.opacity(0.92))
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            ZStack {
                Circle().fill(RadialGradient(colors: [Color(hex: safe ? 0x22C55E : 0xEF4444).opacity(0.55), .clear], center: .center, startRadius: 4, endRadius: 52)).frame(width: 104, height: 104)
                Image(systemName: safe ? "checkmark.seal.fill" : "flame.fill")
                    .font(.system(size: 54, weight: .bold))
                    .foregroundStyle(LinearGradient(colors: safe ? [Color(hex: 0xBBF7D0), Color(hex: 0x22C55E)] : [Color(hex: 0xFDBA74), Color(hex: 0xEF4444)], startPoint: .top, endPoint: .bottom))
                    .shadow(color: Color(hex: safe ? 0x22C55E : 0xEF4444).opacity(0.7), radius: 10)
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 16)
        .background(LinearGradient(colors: safe ? [Color(hex: 0x14532D), Color(hex: 0x052E16)] : [Color(hex: 0x5B1A22), Color(hex: 0x2A0E14)], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
}

#if DEBUG
@available(iOS 17.0, *)
#Preview("Streak countdown", as: .content, using: BEStreakActivityAttributes(title: "English Mastery", prog: "general-english", doneLine: "Done — your streak is safe.")) {
    BEStreakLiveActivity()
} contentStates: {
    BEStreakActivityAttributes.ContentState(line: "Last chance! Keep your 4\u{2011}day streak.", streak: 4, deadline: Date().addingTimeInterval(4194), done: false)
    BEStreakActivityAttributes.ContentState(line: "", streak: 5, deadline: Date().addingTimeInterval(4194), done: true)
}
#endif
