import ActivityKit
import WidgetKit
import SwiftUI

/// The game streak countdown — a Live Activity (owner, 10 Oct 2026: "this kind of
/// notification for the game, on both sides, with the stopwatch"; then "a little
/// different from the competition, more futuristic").
///
/// The APP starts it (BEWidgetPlugin `liveStart`) when the learner leaves it in the
/// last three hours of the game day with today's daily mission or challenge not
/// done, in English Mastery or Welding Mastery; it ends it the moment the daily is
/// finished (`liveEnd`). The countdown runs to the end of the game day (UTC midnight,
/// the same day the hubs and the server count), drawn by the system from the
/// deadline — nothing here ticks, and nothing is fetched.
///
/// The look is our own, not a mascot on a red card: a dark "mission console" with a
/// faint grid, a draining ring (the three-hour window, drawn by the system), a
/// glowing digital clock, and the programme's colour — cyan for English Mastery,
/// amber for Welding Mastery — turning green once the streak is safe.
///
/// BEStreakActivityAttributes is declared twice, here and in the app's
/// BEWidgetPlugin.swift, with the same name and the same Codable shape: ActivityKit
/// matches the two by that, and each target compiles its own copy.
struct BEStreakActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var line: String        // "Last chance! Keep your 4-day streak."
        var streak: Int         // the hub's current streak, in days
        var deadline: Date      // the end of the game day
        var done: Bool          // finished: the card says so for its last seconds on screen
    }
    var title: String           // "English Mastery" · "Welding Mastery"
    var prog: String            // "general-english" · "welding"
    var doneLine: String        // "Done — your streak is safe."
}

/// The window the ring drains over: the last three hours, as the app's LIVE_WINDOW_MS.
private let BEStreakWindow: TimeInterval = 3 * 3600

/// One programme's colours, and green for a safe streak.
struct BEStreakTheme {
    let accent: Color, accent2: Color, icon: String
    static func of(_ prog: String, safe: Bool) -> BEStreakTheme {
        if safe { return BEStreakTheme(accent: Color(hex: 0x34D399), accent2: Color(hex: 0xA7F3D0), icon: "checkmark.shield.fill") }
        return prog == "welding"
            ? BEStreakTheme(accent: Color(hex: 0xF59E0B), accent2: Color(hex: 0xFDE68A), icon: "bolt.fill")
            : BEStreakTheme(accent: Color(hex: 0x22D3EE), accent2: Color(hex: 0xA5F3FC), icon: "waveform")
    }
    static let bgA = Color(hex: 0x070A1A), bgB = Color(hex: 0x0E1336)
}

@available(iOS 16.2, *)
struct BEStreakLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BEStreakActivityAttributes.self) { context in
            BEStreakLockView(attributes: context.attributes, state: context.state, stale: context.isStale)
                .activityBackgroundTint(BEStreakTheme.bgA)
                .activitySystemActionForegroundColor(.white)
                .widgetURL(BEStreakLink.url(context.attributes.prog))
        } dynamicIsland: { context in
            let th = BEStreakTheme.of(context.attributes.prog, safe: context.state.done)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BEStreakDial(deadline: context.state.deadline, done: context.state.done || context.isStale, theme: th, size: 44, line: 4)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    BEStreakTimer(deadline: context.state.deadline, done: context.state.done || context.isStale)
                        .font(.system(size: 28, weight: .bold, design: .monospaced)).foregroundColor(th.accent2)
                        .shadow(color: th.accent.opacity(0.8), radius: 6).padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.done ? context.attributes.doneLine : context.state.line)
                        .font(.system(size: 13, weight: .semibold)).foregroundColor(.white.opacity(0.85)).lineLimit(1)
                }
            } compactLeading: {
                BEStreakDial(deadline: context.state.deadline, done: context.state.done || context.isStale, theme: th, size: 20, line: 2.5, iconSize: 9)
            } compactTrailing: {
                BEStreakTimer(deadline: context.state.deadline, done: context.state.done || context.isStale)
                    .font(.system(size: 14, weight: .semibold, design: .monospaced)).foregroundColor(th.accent2).frame(maxWidth: 70)
            } minimal: {
                BEStreakDial(deadline: context.state.deadline, done: context.state.done || context.isStale, theme: th, size: 20, line: 2.5, iconSize: 9)
            }
            .widgetURL(BEStreakLink.url(context.attributes.prog))
        }
    }
}

enum BEStreakLink {
    static func url(_ prog: String) -> URL? { URL(string: "bemastery://open?view=" + (prog == "welding" ? "mastery" : "english") + "&act=daily") }
}

/// the running countdown, drawn by the system (no timeline needed)
@available(iOS 16.2, *)
struct BEStreakTimer: View {
    let deadline: Date, done: Bool
    var leading = false
    var body: some View {
        if done || deadline <= Date() {
            Image(systemName: "checkmark")
        } else {
            /* a timer Text takes the full width it is offered: align it where it belongs */
            Text(timerInterval: Date()...deadline, countsDown: true).monospacedDigit()
                .multilineTextAlignment(leading ? .leading : .trailing)
                .frame(maxWidth: .infinity, alignment: leading ? .leading : .trailing)
        }
    }
}

/// the draining ring: the system animates a timer-driven ProgressView on its own
@available(iOS 16.2, *)
struct BEStreakDial: View {
    let deadline: Date, done: Bool, theme: BEStreakTheme
    var size: CGFloat = 64, line: CGFloat = 5, iconSize: CGFloat? = nil
    var body: some View {
        ZStack {
            if done || deadline <= Date() {
                Circle().stroke(theme.accent, lineWidth: line)
            } else {
                ProgressView(timerInterval: deadline.addingTimeInterval(-BEStreakWindow)...deadline, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                    .progressViewStyle(.circular).tint(theme.accent)
                    .frame(width: size, height: size)
            }
            Image(systemName: theme.icon).font(.system(size: iconSize ?? size * 0.34, weight: .bold)).foregroundColor(theme.accent2)
        }
        .frame(width: size, height: size)
        .shadow(color: theme.accent.opacity(0.55), radius: size / 8)
    }
}

/// the lock-screen card: a dark console, the ring, the programme and streak, the clock, one line
@available(iOS 16.2, *)
struct BEStreakLockView: View {
    let attributes: BEStreakActivityAttributes
    let state: BEStreakActivityAttributes.ContentState
    let stale: Bool
    var safe: Bool { state.done }
    var body: some View {
        let th = BEStreakTheme.of(attributes.prog, safe: safe)
        HStack(alignment: .center, spacing: 16) {
            BEStreakDial(deadline: state.deadline, done: safe || stale, theme: th, size: 66, line: 6)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(attributes.title.uppercased()).font(.system(size: 11, weight: .bold, design: .monospaced)).tracking(1.2)
                    if state.streak > 0 {
                        Text("//").font(.system(size: 11, weight: .bold, design: .monospaced)).opacity(0.5)
                        Image(systemName: "flame.fill").font(.system(size: 10, weight: .bold))
                        Text("\(state.streak)").font(.system(size: 11, weight: .bold, design: .monospaced))
                    }
                }
                .foregroundColor(th.accent2).lineLimit(1)
                if safe {
                    Text(attributes.doneLine).font(.system(size: 22, weight: .bold, design: .rounded)).foregroundColor(.white)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                } else {
                    BEStreakTimer(deadline: state.deadline, done: stale, leading: true)
                        .font(.system(size: 38, weight: .bold, design: .monospaced)).foregroundColor(.white)
                        .shadow(color: th.accent.opacity(0.9), radius: 8)
                    Text(state.line).font(.system(size: 14, weight: .semibold)).foregroundColor(.white.opacity(0.82))
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18).padding(.vertical, 16)
        .background(
            ZStack {
                LinearGradient(colors: [BEStreakTheme.bgA, BEStreakTheme.bgB], startPoint: .topLeading, endPoint: .bottomTrailing)
                BEStreakGrid().stroke(th.accent.opacity(0.08), lineWidth: 0.6)
                RadialGradient(colors: [th.accent.opacity(0.28), .clear], center: .leading, startRadius: 6, endRadius: 170)
            }
        )
        .overlay(alignment: .top) { Rectangle().fill(LinearGradient(colors: [.clear, th.accent.opacity(0.9), .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 1.5) }
    }
}

/// a faint console grid behind the card
struct BEStreakGrid: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path(); let step: CGFloat = 18
        var x = r.minX; while x <= r.maxX { p.move(to: CGPoint(x: x, y: r.minY)); p.addLine(to: CGPoint(x: x, y: r.maxY)); x += step }
        var y = r.minY; while y <= r.maxY { p.move(to: CGPoint(x: r.minX, y: y)); p.addLine(to: CGPoint(x: r.maxX, y: y)); y += step }
        return p
    }
}

#if DEBUG
@available(iOS 17.0, *)
#Preview("Streak countdown — English Mastery", as: .content, using: BEStreakActivityAttributes(title: "English Mastery", prog: "general-english", doneLine: "Done — your streak is safe.")) {
    BEStreakLiveActivity()
} contentStates: {
    BEStreakActivityAttributes.ContentState(line: "Last chance! Keep your 4\u{2011}day streak.", streak: 4, deadline: Date().addingTimeInterval(4194), done: false)
    BEStreakActivityAttributes.ContentState(line: "", streak: 5, deadline: Date().addingTimeInterval(4194), done: true)
}

@available(iOS 17.0, *)
#Preview("Streak countdown — Welding Mastery", as: .content, using: BEStreakActivityAttributes(title: "Welding Mastery", prog: "welding", doneLine: "Done — your streak is safe.")) {
    BEStreakLiveActivity()
} contentStates: {
    BEStreakActivityAttributes.ContentState(line: "Last chance! Keep your 12\u{2011}day streak.", streak: 12, deadline: Date().addingTimeInterval(2400), done: false)
}

@available(iOS 17.0, *)
#Preview("Streak countdown — done", as: .content, using: BEStreakActivityAttributes(title: "Welding Mastery", prog: "welding", doneLine: "Done — your streak is safe.")) {
    BEStreakLiveActivity()
} contentStates: {
    BEStreakActivityAttributes.ContentState(line: "", streak: 13, deadline: Date().addingTimeInterval(2400), done: true)
}
#endif
