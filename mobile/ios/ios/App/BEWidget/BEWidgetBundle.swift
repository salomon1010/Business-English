import WidgetKit
import SwiftUI

/// The widget extension's entry point: the three road-map widgets
/// (BEWidget.swift), the Recommendations widget (BEWidgetRecs.swift) and the
/// Welding Mastery game widget (BEWidgetMastery.swift).
@main
struct BEWidgetBundle: WidgetBundle {
    var body: some Widget {
        BEWidget()
        BEWidgetGeneral()
        BEWidgetWelding()
        BEWidgetRecs()
        BEWidgetMastery()
    }
}
