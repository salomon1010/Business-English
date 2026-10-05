import WidgetKit
import SwiftUI

/// The widget extension's entry point. One widget today; the bundle exists so
/// a second (a Live Activity for a running session, say) has a home.
@main
struct BEWidgetBundle: WidgetBundle {
    var body: some Widget {
        BEWidget()
    }
}
