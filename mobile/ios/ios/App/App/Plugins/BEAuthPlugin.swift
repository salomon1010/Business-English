import Foundation
import AuthenticationServices
import CryptoKit
import Capacitor

/// BE Mastery — the native sign-in bridge behind `window.BEAuth` (index.html).
///
/// The web app owns the session: Firebase Authentication is the only identity
/// store, exactly as it already is for email/password. This plugin does ONE
/// thing — it obtains a provider ID token on the device and hands it to the web
/// layer, which calls `signInWithCredential`. Nothing here keeps a session,
/// writes to disk, or decides who is signed in.
///
/// Why native rather than the web SDK's popup/redirect: the shell is served from
/// `capacitor://localhost`, which cannot be a Firebase authorized domain, so
/// `signInWithPopup`/`signInWithRedirect` can never complete inside the app
/// (verified on a real device; see docs/auth/SOCIAL_SIGNIN.md).
///
/// - Apple: `ASAuthorizationAppleIDProvider`, the system sheet. The request
///   carries SHA-256(rawNonce) and the raw nonce goes back to the web layer, so
///   Firebase can bind the credential to this request.
/// - Google: `ASWebAuthenticationSession` + PKCE against Google's own endpoints
///   with the project's **iOS OAuth client** (public client, no secret, nothing
///   to keep out of the repo). No GoogleSignIn SDK, no `CFBundleURLTypes`:
///   ASWebAuthenticationSession claims the callback scheme itself.
/// - The client id is read from `Info.plist` → `BEGoogleIosClientID`. Empty (as
///   committed) means Google is simply not offered; Apple is unaffected.
///
/// Nothing is logged: not a token, not a code, not a verifier.
@objc(BEAuthPlugin)
public class BEAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BEAuthPlugin"
    public let jsName = "BEAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appleSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "googleSignIn", returnType: CAPPluginReturnPromise),
    ]

    /// `cancelled` is its own code so the web layer can stay silent on a
    /// deliberate dismissal instead of showing an error.
    private static let cancelled = "cancelled"

    private var appleDelegate: AppleFlow?
    private var webSession: ASWebAuthenticationSession?
    private var anchor: PresentationAnchor?

    private var googleClientID: String {
        let v = Bundle.main.object(forInfoDictionaryKey: "BEGoogleIosClientID") as? String
        return (v ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// What this device can actually offer. The web layer draws its buttons from
    /// this and nothing else, so a half-configured build shows fewer buttons
    /// rather than one that fails.
    @objc func available(_ call: CAPPluginCall) {
        /* Apple needs no configuration in the app: the capability is in the
           entitlements file and the deployment target (15.0) is above the 13.0
           that introduced it, so it is always offerable here. */
        call.resolve(["apple": true, "google": !googleClientID.isEmpty])
    }

    // MARK: - Apple

    @objc func appleSignIn(_ call: CAPPluginCall) {
        let raw = Self.randomNonce()
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256(raw)
            let flow = AppleFlow(rawNonce: raw, call: call) { [weak self] in
                self?.appleDelegate = nil
                self?.anchor = nil
            }
            let anchor = PresentationAnchor(view: self.bridge?.viewController?.view)
            self.appleDelegate = flow
            self.anchor = anchor
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = flow
            controller.presentationContextProvider = anchor
            controller.performRequests()
        }
    }

    // MARK: - Google (PKCE, public client)

    @objc func googleSignIn(_ call: CAPPluginCall) {
        let clientID = googleClientID
        if clientID.isEmpty { call.reject("Google sign-in is not configured in this build.", "unconfigured"); return }
        /* an iOS OAuth client's redirect is its own id reversed, which is why no
           client secret and no URL type are involved */
        let scheme = clientID.split(separator: ".").reversed().joined(separator: ".")
        let redirect = scheme + ":/oauth2redirect"
        let verifier = Self.randomNonce(64)
        let challenge = Self.sha256Base64URL(verifier)
        let state = Self.randomNonce(32)
        let nonce = Self.randomNonce()

        var url = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        url.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "nonce", value: nonce),
            URLQueryItem(name: "prompt", value: "select_account"),
        ]
        guard let start = url.url else { call.reject("Could not start Google sign-in.", "provider"); return }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let session = ASWebAuthenticationSession(url: start, callbackURLScheme: scheme) { [weak self] callback, error in
                self?.webSession = nil
                self?.anchor = nil
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("Sign-in cancelled.", Self.cancelled); return
                }
                if error != nil { call.reject("Google sign-in could not finish.", "provider"); return }
                guard let callback = callback,
                      let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems else {
                    call.reject("Google sign-in returned nothing.", "provider"); return
                }
                let value = { (n: String) in items.first(where: { $0.name == n })?.value }
                if value("error") == "access_denied" { call.reject("Sign-in cancelled.", Self.cancelled); return }
                /* the state we generated must come back untouched, or this is not our flow */
                guard value("state") == state, let code = value("code") else {
                    call.reject("Google sign-in could not be verified.", "provider"); return
                }
                self?.exchange(code: code, verifier: verifier, clientID: clientID, redirect: redirect, nonce: nonce, call: call)
            }
            let anchor = PresentationAnchor(view: self.bridge?.viewController?.view)
            session.presentationContextProvider = anchor
            session.prefersEphemeralWebBrowserSession = false   // let the learner pick an account they are already in
            self.anchor = anchor
            self.webSession = session
            if !session.start() { call.reject("Google sign-in could not open.", "provider") }
        }
    }

    private func exchange(code: String, verifier: String, clientID: String, redirect: String, nonce: String, call: CAPPluginCall) {
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var form = URLComponents()
        form.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "code_verifier", value: verifier),
            URLQueryItem(name: "grant_type", value: "authorization_code"),
            URLQueryItem(name: "redirect_uri", value: redirect),
        ]
        req.httpBody = (form.percentEncodedQuery ?? "").data(using: .utf8)
        URLSession.shared.dataTask(with: req) { data, _, error in
            if error != nil { call.reject("No connection to Google.", "network"); return }
            guard let data = data,
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let idToken = obj["id_token"] as? String else {
                call.reject("Google did not return an identity token.", "provider"); return
            }
            /* the access token is deliberately dropped: BE Mastery never calls a
               Google API, so there is nothing for it to be used for and nothing
               to keep */
            call.resolve(["idToken": idToken, "rawNonce": nonce, "provider": "google.com"])
        }.resume()
    }

    // MARK: - nonce helpers

    private static func randomNonce(_ length: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        if SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) != errSecSuccess {
            bytes = (0..<length).map { _ in UInt8.random(in: 0...255) }
        }
        let alphabet = Array("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-._")
        return String(bytes.map { alphabet[Int($0) % alphabet.count] })
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func sha256Base64URL(_ input: String) -> String {
        Data(SHA256.hash(data: Data(input.utf8))).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

/// Apple's delegate pair, kept in its own object so the plugin can hold exactly
/// one in-flight request and let it go the moment it answers.
private class AppleFlow: NSObject, ASAuthorizationControllerDelegate {
    private let rawNonce: String
    private let call: CAPPluginCall
    private let done: () -> Void

    init(rawNonce: String, call: CAPPluginCall, done: @escaping () -> Void) {
        self.rawNonce = rawNonce; self.call = call; self.done = done
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        defer { done() }
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken, let idToken = String(data: tokenData, encoding: .utf8) else {
            call.reject("Apple did not return an identity token.", "provider"); return
        }
        var out: [String: Any] = ["idToken": idToken, "rawNonce": rawNonce, "provider": "apple.com"]
        /* Apple sends the name and the e-mail ONCE, on the very first
           authorisation, and the e-mail may be a private relay address. Both are
           passed through for the profile; nothing here assumes either exists. */
        if let email = cred.email { out["email"] = email }
        if let given = cred.fullName?.givenName { out["givenName"] = given }
        if let family = cred.fullName?.familyName { out["familyName"] = family }
        if let code = cred.authorizationCode, let s = String(data: code, encoding: .utf8) { out["authorizationCode"] = s }
        call.resolve(out)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        defer { done() }
        let code = (error as? ASAuthorizationError)?.code
        if code == .canceled { call.reject("Sign-in cancelled.", "cancelled"); return }
        if code == .notInteractive || code == .failed { call.reject("Apple sign-in could not finish.", "provider"); return }
        call.reject("Apple sign-in could not finish.", "provider")
    }
}

/// The window the system sheet is anchored to. Capacitor's own view controller
/// owns the only window the app has.
private class PresentationAnchor: NSObject, ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    private weak var view: UIView?
    init(view: UIView?) { self.view = view }
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { window() }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { window() }
    private func window() -> ASPresentationAnchor {
        if let w = view?.window { return w }
        return UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.windows.first { $0.isKeyWindow } }
            .first ?? ASPresentationAnchor()
    }
}
