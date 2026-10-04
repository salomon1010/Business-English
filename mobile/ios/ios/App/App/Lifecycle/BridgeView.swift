import SwiftUI
import Capacitor

/// Hosts `BEBridgeViewController` in SwiftUI. The controller is created once
/// and never updated from SwiftUI: Capacitor owns the web view, its
/// configuration and the plugins for the life of the process.
struct BridgeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> BEBridgeViewController {
        BEBridgeViewController()
    }

    func updateUIViewController(_ uiViewController: BEBridgeViewController, context: Context) {
        // Nothing to update: the bridge is not driven by SwiftUI state.
    }
}
