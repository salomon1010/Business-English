import WidgetKit
import SwiftUI

/// A widget the learner cannot use yet (owner, 6 Oct 2026): they still SEE it —
/// the real layout, drawn in grey and faded — with a lock and one short line
/// saying what opens it. Signed out: "Sign in to use this widget". Signed in
/// without the plan: "Go Premium to unlock this widget". The whole widget is
/// the button: it opens the sign-in sheet or the Premium offer in the app.
struct BELockedView<Content: View>: View {
    let lock: BEWidgetLock
    let s: BEWidgetSnapshot?
    let pal: BEPalette
    var compact = false
    @ViewBuilder let content: () -> Content

    var message: String {
        lock == .premium ? (s?.label("lprem", "Go Premium to unlock this widget") ?? "Go Premium to unlock this widget")
                         : (s?.label("lsign", "Sign in to use this widget") ?? "Sign in to use this widget")
    }

    var body: some View {
        ZStack {
            content()
                .environment(\.beLinksOff, true)
                .grayscale(1)
                .opacity(0.28)
                .blur(radius: 1.2)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            VStack(spacing: compact ? 5 : 8) {
                ZStack {
                    Circle().fill(pal.text.opacity(0.10))
                    Circle().stroke(pal.text.opacity(0.22), lineWidth: 1)
                    Image(systemName: lock == .premium ? "crown.fill" : "lock.fill")
                        .font(.system(size: compact ? 13 : 17, weight: .bold))
                        .foregroundColor(lock == .premium ? pal.gold : pal.text)
                }
                .frame(width: compact ? 30 : 40, height: compact ? 30 : 40)
                Text(message)
                    .font(.system(size: compact ? 11 : 13, weight: .bold, design: .rounded))
                    .foregroundColor(pal.text)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .minimumScaleFactor(0.8)
                    .padding(.horizontal, compact ? 4 : 18)
                if !compact {
                    HStack(spacing: 4) {
                        Image(systemName: lock == .premium ? "sparkles" : "person.crop.circle")
                            .font(.system(size: 10, weight: .bold))
                        Text("BE Mastery").font(.system(size: 11, weight: .semibold, design: .rounded))
                    }
                    .foregroundColor(pal.muted)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(BEWidgetLink.unlock(lock))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(message))
    }
}

/// Lock-screen widgets are tiny and monochrome: a lock and one word.
@available(iOS 16.0, *)
struct BEAccessoryLockedView: View {
    let s: BEWidgetSnapshot?
    @Environment(\.widgetFamily) private var family

    var body: some View {
        let msg = s?.label("lsign", "Sign in to use this widget") ?? "Sign in to use this widget"
        Group {
            switch family {
            case .accessoryCircular:
                ZStack { AccessoryWidgetBackground(); Image(systemName: "lock.fill").font(.system(size: 18, weight: .bold)) }
            case .accessoryInline:
                Label(msg, systemImage: "lock.fill")
            default:
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill").font(.system(size: 14, weight: .bold))
                    Text(msg).font(.system(size: 12, weight: .semibold, design: .rounded)).lineLimit(2)
                }
            }
        }
        .widgetURL(BEWidgetLink.unlock(.signIn))
    }
}

// MARK: - links that go quiet under a lock

private struct BELinksOffKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    /// True inside a locked widget: its own links must not compete with the
    /// lock's single tap (WidgetKit's behaviour with several is undefined).
    var beLinksOff: Bool {
        get { self[BELinksOffKey.self] }
        set { self[BELinksOffKey.self] = newValue }
    }
}

/// `Link`, unless the widget is locked — then just the content.
struct BELink<Label: View>: View {
    let destination: URL
    @ViewBuilder let label: () -> Label
    @Environment(\.beLinksOff) private var off
    init(_ destination: URL, @ViewBuilder label: @escaping () -> Label) { self.destination = destination; self.label = label }
    var body: some View {
        if off { label() } else { Link(destination: destination, label: label) }
    }
}

private struct BEWidgetURL: ViewModifier {
    let url: URL
    @Environment(\.beLinksOff) private var off
    func body(content: Content) -> some View {
        if off { content } else { content.widgetURL(url) }
    }
}
extension View {
    /// `widgetURL`, unless the widget is locked.
    func beWidgetURL(_ url: URL) -> some View { modifier(BEWidgetURL(url: url)) }
}
