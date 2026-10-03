import Foundation
import Capacitor
#if canImport(UIKit)
import UIKit
#endif
#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif
#if canImport(UserMessagingPlatform)
import UserMessagingPlatform
#endif

/// BE Mastery — the Google Mobile Ads bridge behind `window.BENativeAds` (index.html).
///
/// This plugin is a PROVIDER, not a policy. It never decides whether an ad is
/// appropriate: `AdEligibility.decide()` in the web layer does that (flag →
/// `adsTrackAllows()` → the SERVER's plan → format → context → protected
/// learning state → `AD_POLICY` caps), and `AdManager` is the only thing that
/// asks for one. Everything here either hands back an ad or says it cannot.
///
/// Rules this file keeps:
/// - **Two formats only:** interstitial and native advanced. `supports()`
///   answers false for `rewarded` and `sponsored`, which ship disabled.
/// - **Fail closed, never crash.** Missing SDK, missing AdMob identifiers,
///   consent not resolved, no fill, no scene — every one of those is an
///   ordinary "unavailable" answer. No `try!`, no force unwrap, no exception
///   path that reaches the learner.
/// - **Consent before the first request.** `configure()` runs the Google UMP
///   flow and resolves only once `canRequestAds` is known. Nothing requests an
///   ad before that, because `available()` is false until it has run.
/// - **Non-personalised ads only (this release).** Every request carries
///   `npa=1`, so no IDFA and no App Tracking Transparency prompt. There is
///   deliberately no `ATTrackingManager` call anywhere in this file.
/// - **Real ad unit ids come from Info.plist** (`BEAdsAppId`,
///   `BEAdsInterstitialUnitId`, `BEAdsNativeUnitId`). Until the owner fills
///   them in with AdMob's own values, a Release build reports unavailable
///   rather than showing Google's test creatives to real learners. A STAGING
///   build may use Google's test units, so the ad path can be certified on a
///   device before an AdMob account exists — but only when BOTH
///   `BEAdsAllowTestUnits` is true in Info.plist AND the bundle carries a
///   Sandbox receipt (TestFlight / a development build). A production App Store
///   build has a production receipt, so leaving that key switched on by mistake
///   still cannot put a test creative in front of a paying audience.
@objc(BEAdsPlugin)
public class BEAdsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BEAdsPlugin"
    public let jsName = "BEAds"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isReady", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismiss", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showNative", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "moveNative", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideNative", returnType: CAPPluginReturnPromise),
    ]

    /// the only two formats this app serves; rewarded and sponsored stay off
    static let formats = ["interstitial", "native"]

    // MARK: - identifiers (Info.plist, never hard-coded)

    /// AdMob app id, e.g. "ca-app-pub-0000000000000000~0000000000". A value
    /// that is absent or still a placeholder means the app is not registered
    /// in AdMob yet, and the SDK is never started.
    static func plistString(_ key: String) -> String? {
        guard let v = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return nil }
        let s = v.trimmingCharacters(in: .whitespacesAndNewlines)
        return s.isEmpty ? nil : s
    }

    static func validAppId(_ s: String?) -> Bool {
        guard let s = s else { return false }
        return s.range(of: "^ca-app-pub-[0-9]{16}~[0-9]{10}$", options: .regularExpression) != nil
    }

    static func validUnitId(_ s: String?) -> Bool {
        guard let s = s else { return false }
        return s.range(of: "^ca-app-pub-[0-9]{16}/[0-9]{10}$", options: .regularExpression) != nil
    }

    /// Google's own always-fills test units. Used in a debug build, and in a
    /// staging build that asks for them AND is not a production App Store
    /// build; a production build without real ids reports unavailable instead.
    static let testInterstitial = "ca-app-pub-3940256099942544/4411468910"
    static let testNative = "ca-app-pub-3940256099942544/3986624511"
    /// Google's own test APP id, the companion to the units above.
    static let testAppId = "ca-app-pub-3940256099942544~1458002511"

    /// A TestFlight or development build: StoreKit gives it a "sandboxReceipt".
    /// A build sold through the App Store has a "receipt" instead. This is the
    /// second lock on the test units, and it cannot be switched off from a plist.
    static var sandboxBuild: Bool {
        guard let url = Bundle.main.appStoreReceiptURL else { return true }   // no receipt at all = not sold by the App Store
        return url.lastPathComponent != "receipt"
    }

    /// Test creatives are allowed in a debug build, or in a staging build that
    /// asks for them and is not a production App Store build.
    static var testUnitsAllowed: Bool {
        #if DEBUG
        return true
        #else
        let asked = (Bundle.main.object(forInfoDictionaryKey: "BEAdsAllowTestUnits") as? Bool) ?? false
        return asked && sandboxBuild
        #endif
    }

    private var interstitialUnit: String?
    private var nativeUnit: String?

    // MARK: - state

    private var started = false          // MobileAds.start finished
    private var consentResolved = false  // the UMP flow finished (either way)
    private var canRequestAds = false    // UMP's answer
    private var configuring = false

    #if canImport(GoogleMobileAds)
    private var interstitial: InterstitialAd?
    private var loader: AdLoader?
    private var loaderDelegate: NativeLoaderDelegate?
    private var interstitialDelegate: InterstitialDelegate?
    private var nativeAds: [String: NativeAd] = [:]
    #endif
    private var nativeViews: [String: UIView] = [:]
    private var interstitialDone: ((Bool) -> Void)?

    // MARK: - configure: SDK + consent, before anything asks for an ad

    /// Resolves with what this device can actually do. The web layer builds
    /// `window.BENativeAds` only when `available` is true, so an unconfigured
    /// or unconsented device simply has no native provider and the app falls
    /// back to `AdProviders.none`.
    @objc func configure(_ call: CAPPluginCall) {
        #if canImport(GoogleMobileAds)
        // 1. identifiers. Without a registered AdMob app there is nothing to start.
        let appId = BEAdsPlugin.plistString("BEAdsAppId") ?? BEAdsPlugin.plistString("GADApplicationIdentifier")
        var inter = BEAdsPlugin.plistString("BEAdsInterstitialUnitId")
        var nativeU = BEAdsPlugin.plistString("BEAdsNativeUnitId")
        var effectiveAppId = appId
        if BEAdsPlugin.testUnitsAllowed {
            if !BEAdsPlugin.validUnitId(inter) { inter = BEAdsPlugin.testInterstitial }
            if !BEAdsPlugin.validUnitId(nativeU) { nativeU = BEAdsPlugin.testNative }
            if !BEAdsPlugin.validAppId(effectiveAppId) { effectiveAppId = BEAdsPlugin.testAppId }
        }
        guard BEAdsPlugin.validAppId(effectiveAppId), BEAdsPlugin.validUnitId(inter), BEAdsPlugin.validUnitId(nativeU) else {
            call.resolve(BEAdsPlugin.unavailable("not_configured")); return
        }
        interstitialUnit = inter
        nativeUnit = nativeU

        if started && consentResolved {
            call.resolve(self.state()); return
        }
        if configuring { call.resolve(BEAdsPlugin.unavailable("configuring")); return }
        configuring = true

        // 2. consent FIRST: Google requires the UMP state before an ad request.
        resolveConsent { [weak self] in
            guard let self = self else { return }
            guard self.canRequestAds else {
                self.configuring = false
                call.resolve(BEAdsPlugin.unavailable("consent"))
                return
            }
            // 3. then, and only then, start the SDK.
            MobileAds.shared.start { [weak self] _ in
                guard let self = self else { return }
                self.started = true
                self.configuring = false
                call.resolve(self.state())
            }
        }
        #else
        // The SDK is not linked in this build: an honest "no provider here".
        call.resolve(BEAdsPlugin.unavailable("no_sdk"))
        #endif
    }

    private static func unavailable(_ reason: String) -> [String: Any] {
        ["available": false, "reason": reason, "formats": [String](), "npa": true, "consent": reason]
    }

    private func state() -> [String: Any] {
        ["available": started && consentResolved && canRequestAds,
         "formats": BEAdsPlugin.formats,
         "npa": true,
         "consent": consentResolved ? (canRequestAds ? "can_request" : "cannot_request") : "unresolved"]
    }

    // MARK: - UMP consent

    /// Runs Google's User Messaging Platform: ask for the current state, show
    /// the form when the region requires one, then read `canRequestAds`.
    /// Every failure path still calls `done()` — an unresolved consent simply
    /// leaves `canRequestAds` false, which means no ads, not a stuck app.
    private func resolveConsent(_ done: @escaping () -> Void) {
        #if canImport(UserMessagingPlatform)
        let params = RequestParameters()
        params.isTaggedForUnderAgeOfConsent = false
        ConsentInformation.shared.requestConsentInfoUpdate(with: params) { [weak self] error in
            guard let self = self else { done(); return }
            if error != nil {
                // The form could not be reached. Serve nothing rather than
                // guess at a lawful basis.
                self.consentResolved = true
                self.canRequestAds = false
                done(); return
            }
            DispatchQueue.main.async {
                guard let vc = self.topViewController() else {
                    self.consentResolved = true
                    self.canRequestAds = ConsentInformation.shared.canRequestAds
                    done(); return
                }
                ConsentForm.loadAndPresentIfRequired(from: vc) { _ in
                    // Whether the form showed, was not required, or failed to
                    // load, UMP's own answer decides. self is already the
                    // strong reference this block is running on.
                    self.consentResolved = true
                    self.canRequestAds = ConsentInformation.shared.canRequestAds
                    done()
                }
            }
        }
        #else
        // No UMP in this build: no consent state, so no ads.
        consentResolved = true
        canRequestAds = false
        done()
        #endif
    }

    // MARK: - requests

    #if canImport(GoogleMobileAds)
    /// Every request in this app is non-personalised: `npa=1`, no IDFA.
    private func request() -> Request {
        let r = Request()
        let extras = Extras()
        extras.additionalParameters = ["npa": "1"]
        r.register(extras)
        return r
    }
    #endif

    @objc func load(_ call: CAPPluginCall) {
        let format = call.getString("format") ?? ""
        #if canImport(GoogleMobileAds)
        guard started, consentResolved, canRequestAds, BEAdsPlugin.formats.contains(format) else {
            call.resolve(["ready": false]); return
        }
        switch format {
        case "interstitial":
            guard let unit = interstitialUnit else { call.resolve(["ready": false]); return }
            InterstitialAd.load(with: unit, request: request()) { [weak self] ad, error in
                guard let self = self else { call.resolve(["ready": false]); return }
                if let ad = ad, error == nil {
                    let d = InterstitialDelegate(owner: self)
                    ad.fullScreenContentDelegate = d
                    self.interstitialDelegate = d
                    self.interstitial = ad
                    call.resolve(["ready": true])
                } else {
                    self.interstitial = nil
                    call.resolve(["ready": false])     // no fill is not an error
                }
            }
        case "native":
            // A native ad is loaded for the placement it will fill, by showNative.
            call.resolve(["ready": true])
        default:
            call.resolve(["ready": false])
        }
        #else
        _ = format
        call.resolve(["ready": false])
        #endif
    }

    @objc func isReady(_ call: CAPPluginCall) {
        let format = call.getString("format") ?? ""
        #if canImport(GoogleMobileAds)
        if format == "interstitial" { call.resolve(["ready": interstitial != nil]); return }
        if format == "native" { call.resolve(["ready": started && canRequestAds]); return }
        #endif
        call.resolve(["ready": false])
    }

    // MARK: - interstitial

    /// Presents the loaded interstitial. Resolves `{shown:false}` for every
    /// reason an ad cannot appear; resolves once the learner has dismissed it.
    @objc func show(_ call: CAPPluginCall) {
        guard (call.getString("format") ?? "") == "interstitial" else {
            call.resolve(["shown": false]); return
        }
        #if canImport(GoogleMobileAds)
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let ad = self.interstitial, let vc = self.topViewController() else {
                call.resolve(["shown": false]); return
            }
            self.interstitial = nil          // one impression per load
            self.interstitialDone = { closed in call.resolve(["shown": true, "closable": true, "completed": closed]) }
            // GMA presents its own full-screen view controller and its own
            // close control, so the ad can never be a dead end.
            ad.present(from: vc)
        }
        #else
        call.resolve(["shown": false])
        #endif
    }

    @objc func dismiss(_ call: CAPPluginCall) {
        #if canImport(GoogleMobileAds)
        DispatchQueue.main.async { [weak self] in
            self?.interstitial = nil
            self?.finishInterstitial()
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }

    fileprivate func finishInterstitial() {
        let done = interstitialDone
        interstitialDone = nil
        done?(true)
    }

    // MARK: - native advanced

    /// Puts a native ad over the rectangle the web layer measured for its
    /// labelled slot. The HTML keeps the label and the "Remove ads with
    /// Premium" link; this view is the creative only.
    @objc func showNative(_ call: CAPPluginCall) {
        let placement = call.getString("placement") ?? ""
        let rect = BEAdsPlugin.rect(call)
        #if canImport(GoogleMobileAds)
        guard started, consentResolved, canRequestAds, let unit = nativeUnit,
              !placement.isEmpty, rect.width > 40, rect.height > 40 else {
            call.resolve(["shown": false]); return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let host = self.hostView() else { call.resolve(["shown": false]); return }
            let d = NativeLoaderDelegate(owner: self, placement: placement, rect: rect, host: host) { ok in
                call.resolve(["shown": ok])
            }
            self.loaderDelegate = d
            let loader = AdLoader(adUnitID: unit, rootViewController: self.topViewController(),
                                  adTypes: [.native], options: nil)
            loader.delegate = d
            self.loader = loader
            loader.load(self.request())
        }
        #else
        _ = placement
        call.resolve(["shown": false])
        #endif
    }

    /// The page scrolled or re-laid out: follow the slot. No new request, no
    /// new impression.
    @objc func moveNative(_ call: CAPPluginCall) {
        let placement = call.getString("placement") ?? ""
        let rect = BEAdsPlugin.rect(call)
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let v = self.nativeViews[placement] else { call.resolve(); return }
            // Off-screen or collapsed: hide rather than draw a sliver over the app.
            v.isHidden = rect.height < 20 || rect.width < 40
            v.frame = rect
            call.resolve()
        }
    }

    @objc func hideNative(_ call: CAPPluginCall) {
        let placement = call.getString("placement") ?? ""
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.resolve(); return }
            if placement.isEmpty {
                self.nativeViews.values.forEach { $0.removeFromSuperview() }
                self.nativeViews.removeAll()
                #if canImport(GoogleMobileAds)
                self.nativeAds.removeAll()
                #endif
            } else {
                self.nativeViews[placement]?.removeFromSuperview()
                self.nativeViews[placement] = nil
                #if canImport(GoogleMobileAds)
                self.nativeAds[placement] = nil
                #endif
            }
            call.resolve()
        }
    }

    fileprivate func keepNative(_ placement: String, view: UIView) {
        nativeViews[placement]?.removeFromSuperview()
        nativeViews[placement] = view
    }

    #if canImport(GoogleMobileAds)
    fileprivate func keepNativeAd(_ placement: String, ad: NativeAd) { nativeAds[placement] = ad }
    #endif

    private static func rect(_ call: CAPPluginCall) -> CGRect {
        let scale = UIScreen.main.scale
        _ = scale   // the web layer sends CSS points, which are UIKit points
        let x = call.getDouble("x") ?? 0, y = call.getDouble("y") ?? 0
        let w = call.getDouble("w") ?? 0, h = call.getDouble("h") ?? 0
        return CGRect(x: x, y: y, width: w, height: h)
    }

    // MARK: - UIKit helpers

    /// The view a native ad is layered into: the bridge's own view, so the ad
    /// sits above the web view and scrolls with whatever the web layer reports.
    private func hostView() -> UIView? {
        if let v = bridge?.viewController?.view { return v }
        return topViewController()?.view
    }

    private func topViewController() -> UIViewController? {
        if let vc = bridge?.viewController { return vc }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
        var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }
}

// MARK: - GMA delegates

#if canImport(GoogleMobileAds)
/// Full-screen callbacks. The only thing the web layer needs to know is when
/// the learner is back in the app.
final class InterstitialDelegate: NSObject, FullScreenContentDelegate {
    private weak var owner: BEAdsPlugin?
    init(owner: BEAdsPlugin) { self.owner = owner }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        owner?.finishInterstitial()
    }
    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        owner?.finishInterstitial()
    }
}

/// Loads one native ad and builds its view. The layout is deliberately plain:
/// an "Ad" badge Google requires, the headline, the body, the advertiser and
/// the call-to-action. Nothing here imitates a BE Mastery card.
final class NativeLoaderDelegate: NSObject, NativeAdLoaderDelegate {
    private weak var owner: BEAdsPlugin?
    private let placement: String
    private let rect: CGRect
    private weak var host: UIView?
    private var done: ((Bool) -> Void)?

    init(owner: BEAdsPlugin, placement: String, rect: CGRect, host: UIView, done: @escaping (Bool) -> Void) {
        self.owner = owner; self.placement = placement; self.rect = rect; self.host = host; self.done = done
    }

    private func finish(_ ok: Bool) { let d = done; done = nil; d?(ok) }

    func adLoader(_ adLoader: AdLoader, didFailToReceiveAdWithError error: Error) {
        finish(false)      // no fill: an ordinary answer, not an error
    }

    func adLoader(_ adLoader: AdLoader, didReceive nativeAd: NativeAd) {
        guard let owner = owner, let host = host else { finish(false); return }
        let view = NativeAdView(frame: rect)
        view.clipsToBounds = true
        view.backgroundColor = .clear

        let badge = UILabel()
        badge.text = "Ad"
        badge.font = .systemFont(ofSize: 10, weight: .semibold)
        badge.textColor = .white
        badge.backgroundColor = UIColor(red: 0.85, green: 0.55, blue: 0.10, alpha: 1)
        badge.textAlignment = .center
        badge.layer.cornerRadius = 3
        badge.clipsToBounds = true

        let headline = UILabel()
        headline.font = .systemFont(ofSize: 15, weight: .semibold)
        headline.numberOfLines = 2

        let body = UILabel()
        body.font = .systemFont(ofSize: 13)
        body.numberOfLines = 2
        body.textColor = .secondaryLabel

        let cta = UIButton(type: .system)
        cta.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        cta.isUserInteractionEnabled = false   // GMA handles the tap on the ad view

        for v in [badge, headline, body, cta] as [UIView] {
            v.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(v)
        }
        NSLayoutConstraint.activate([
            badge.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            badge.topAnchor.constraint(equalTo: view.topAnchor),
            badge.widthAnchor.constraint(equalToConstant: 22),
            badge.heightAnchor.constraint(equalToConstant: 14),
            headline.leadingAnchor.constraint(equalTo: badge.trailingAnchor, constant: 6),
            headline.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headline.topAnchor.constraint(equalTo: view.topAnchor),
            body.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            body.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            body.topAnchor.constraint(equalTo: headline.bottomAnchor, constant: 4),
            cta.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cta.topAnchor.constraint(greaterThanOrEqualTo: body.bottomAnchor, constant: 4),
            cta.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor),
        ])

        headline.text = nativeAd.headline
        body.text = nativeAd.body
        cta.setTitle(nativeAd.callToAction, for: .normal)

        // Google's required wiring: the asset views must be registered, and
        // nativeAd set last, or the impression is not counted.
        view.headlineView = headline
        view.bodyView = body
        view.callToActionView = cta
        view.nativeAd = nativeAd

        host.addSubview(view)
        owner.keepNative(placement, view: view)
        owner.keepNativeAd(placement, ad: nativeAd)
        finish(true)
    }
}
#endif
