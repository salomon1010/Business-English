import Foundation
import WidgetKit
import SwiftUI

/// The widget extension's entry point: the three road-map widgets
/// (BEWidget.swift), the Recommendations widget (BEWidgetRecs.swift) and the
/// Welding Mastery game widget (BEWidgetMastery.swift), and the game streak
/// countdown Live Activity (BEStreakActivity.swift, iOS 16.2+).
/// THE TWO-APP SPLIT (12 Oct 2026). The two per-programme road-map widgets
/// (General English / Welding English) exist only because one app used to carry
/// both programmes. Each app now offers its own and nothing else: in the
/// Welding app a "General English" widget would never have a snapshot to draw,
/// and in the General English app neither would "Welding English" or the
/// Welding Mastery game widget, whose tap opens a page that app refuses.
/// `BEWidget` ("Your road map") follows whichever programme is open, which in a
/// split app is the only one, so both apps keep it.
///
/// A WidgetBundle is built at COMPILE time — WidgetBundleBuilder rejects a plain
/// `if` — so the choice is made by BE_GENERAL / BE_WELDING, which
/// mobile/ios/scripts/build.sh passes as SWIFT_ACTIVE_COMPILATION_CONDITIONS.
/// With neither (a plain build straight from Xcode) the gallery is exactly what
/// it was before the split, so nothing silently changes under a GUI build.
@main
struct BEWidgetBundle: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        BEWidget()
#if BE_WELDING
        BEWidgetRecs()
        BEWidgetMastery()        // the Welding Mastery game (it reads the "pro" snapshot)
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
