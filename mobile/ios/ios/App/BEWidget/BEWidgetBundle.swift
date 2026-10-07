import WidgetKit
import SwiftUI

/// The widget extension's entry point: the three road-map widgets
/// (BEWidget.swift) and the Recommendations widget (BEWidgetRecs.swift).
@main
struct BEWidgetBundle: WidgetBundle {
    var body: some Widget {
        BEWidget()
        BEWidgetGeneral()
        BEWidgetWelding()
        BEWidgetRecs()
    }
}
