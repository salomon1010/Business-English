import XCTest

/// The shell launches and shows the web app. There is nothing else to drive
/// natively: every screen is inside the web view, and the web app's own
/// behaviour is covered by the Playwright suites in `tests/`.
final class BEMasteryUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunchShowsTheWebApp() throws {
        let app = XCUIApplication.beMastery
        app.launch()

        // The bridge loads index.html from the bundle; give a cold simulator
        // time to bring the web view up.
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30),
                      "the web view never appeared — the Capacitor bridge did not load")
    }
}

extension XCUIApplication {
    /// The app under test, by bundle id. The App scheme installs it before the
    /// UI tests run, so the runner finds it without a target-application
    /// setting on this bundle.
    static var beMastery: XCUIApplication {
        XCUIApplication(bundleIdentifier: "com.lomonec.bemastery")
    }
}
