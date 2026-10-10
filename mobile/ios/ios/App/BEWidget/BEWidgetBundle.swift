import WidgetKit
import SwiftUI

/// The widget extension's entry point: the three road-map widgets
/// (BEWidget.swift), the Recommendations widget (BEWidgetRecs.swift) and the
/// Welding Mastery game widget (BEWidgetMastery.swift), and the game streak
/// countdown Live Activity (BEStreakActivity.swift, iOS 16.2+).
@main
struct BEWidgetBundle: WidgetBundle {
    var body: some Widget {
        BEWidget()
        BEWidgetGeneral()
        BEWidgetWelding()
        BEWidgetRecs()
        BEWidgetMastery()
        if #available(iOS 16.2, *) {
            BEStreakLiveActivity()   // the game streak countdown (BEStreakActivity.swift)
        }
    }
}
