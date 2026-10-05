import WidgetKit
import SwiftUI

/// The widget extension's entry point: the three gallery entries (BEWidget.swift).
@main
struct BEWidgetBundle: WidgetBundle {
    var body: some Widget {
        BEWidget()
        BEWidgetGeneral()
        BEWidgetWelding()
    }
}
