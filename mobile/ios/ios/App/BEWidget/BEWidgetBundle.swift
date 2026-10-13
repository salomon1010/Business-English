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
        /* THE TWO-APP SPLIT (12 Oct 2026): each store app offers only its own
           programme's widgets. The condition is COMPILE-TIME, not runtime —
           WidgetBundleBuilder rejects a plain `if` ("if statements in a
           WidgetBundleBuilder can only be used with #available clauses") — so
           build.sh passes SWIFT_ACTIVE_COMPILATION_CONDITIONS=BE_WELDING or
           BE_GENERAL. The #else keeps a plain build (no condition set) showing
           everything, which is what the unsplit app did. */
        #if BE_WELDING
        BEWidgetWelding()
        BEWidgetMastery()
        #elseif BE_GENERAL
        BEWidgetGeneral()
        BEWidgetRecs()
        #else
        BEWidgetGeneral()
        BEWidgetWelding()
        BEWidgetRecs()
        BEWidgetMastery()
        #endif
        if #available(iOS 16.2, *) {
            BEStreakLiveActivity()   // the game streak countdown (BEStreakActivity.swift)
        }
    }
}
