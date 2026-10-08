import SwiftUI

/// The one screen the shell has: the web app, edge to edge. Every
/// learner-facing screen lives in index.html, so this view holds the bridge
/// and nothing else. Safe areas are ignored on purpose: the web layer lays
/// itself out with `viewport-fit=cover` and `env(safe-area-inset-*)`, and the
/// web view manages its own keyboard inset.
struct ContentView: View {
    var body: some View {
        BridgeView()
            .ignoresSafeArea()
    }
}
