import Foundation
import StoreKit
import Capacitor
#if canImport(UIKit)
import UIKit
#endif

/// BE Mastery — the StoreKit 2 bridge behind `window.BENativeBilling` (index.html).
///
/// The web app owns the purchase flow and the SERVER owns the entitlement: this
/// plugin only talks to the App Store and hands Apple's signed JWS strings to the
/// web layer, which posts them to be-entitlements (`/v1/purchases/verify`,
/// `/v1/purchases/restore`). Nothing here decides whether a learner is Premium.
///
/// - Products: only `BEMastery_Premium` (monthly) and `BEMastery_Annual`
///   (yearly) are ever loaded — App Store Connect's ids, not Google Play's.
/// - Purchases carry the account's `appAccountToken` (from the server), so a
///   transaction can only be claimed by the BE Mastery account that bought it.
/// - A transaction is finished only when the web layer says the server has
///   answered (`finish`). Until then StoreKit keeps it in `Transaction.unfinished`
///   and it is offered again at the next launch (`pendingTransactions`).
/// - `Transaction.updates` (renewals, Ask to Buy approvals, refunds, purchases on
///   another device) is forwarded as a `transaction` event, retained until the
///   web layer listens.
/// - Only VERIFIED transactions are forwarded; the server verifies them again.
@objc(BEStoreKitPlugin)
public class BEStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BEStoreKitPlugin"
    public let jsName = "BEStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingTransactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
    ]

    /// The only products this app sells, as App Store Connect names them:
    /// `BEMastery_Premium` = 1 month, `BEMastery_Annual` = 1 year. Google Play
    /// sells the same plans as `premium_monthly` / `premium_annual`; the server
    /// maps all four to Premium. Keep in step with `APP_STORE_PRODUCTS` in
    /// index.html and `PRODUCTS` in backend/entitlements/src/entitlement-core.js.
    static let allowed: Set<String> = ["BEMastery_Premium", "BEMastery_Annual"]

    private var updates: Task<Void, Never>?

    override public func load() {
        // Start listening at once: StoreKit delivers renewals, refunds and
        // approvals here, and anything missed would wait for the next launch.
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self = self else { return }
                if case .verified(let tx) = result, BEStoreKitPlugin.allowed.contains(tx.productID) {
                    let data = await self.payload(result, tx)
                    // the web view is the main thread's: hand the event over there
                    await MainActor.run { self.notifyListeners("transaction", data: data, retainUntilConsumed: true) }
                }
            }
        }
    }

    deinit { updates?.cancel() }

    // MARK: - products

    @objc func getProducts(_ call: CAPPluginCall) {
        let asked = call.getArray("ids", String.self) ?? Array(BEStoreKitPlugin.allowed)
        let ids = asked.filter { BEStoreKitPlugin.allowed.contains($0) }
        Task {
            do {
                let list = try await Product.products(for: ids)
                var out: [[String: Any]] = []
                for p in list {
                    var o: [String: Any] = [
                        "id": p.id,
                        "title": p.displayName,
                        "description": p.description,
                        "displayPrice": p.displayPrice,
                        "price": NSDecimalNumber(decimal: p.price).doubleValue,
                        "currencyCode": p.priceFormatStyle.currencyCode,
                    ]
                    if let sub = p.subscription {
                        o["period"] = BEStoreKitPlugin.iso(sub.subscriptionPeriod)
                        // The trial is shown ONLY when Apple says this account can have it.
                        if let intro = sub.introductoryOffer, intro.paymentMode == .freeTrial {
                            let eligible = await sub.isEligibleForIntroOffer
                            o["trialEligible"] = eligible
                            if eligible { o["trial"] = BEStoreKitPlugin.iso(intro.period) }
                        }
                    }
                    out.append(o)
                }
                call.resolve(["products": out])
            } catch {
                call.reject("products_failed", nil, error)
            }
        }
    }

    /// Product.SubscriptionPeriod → ISO 8601 duration ("P1M", "P1Y", "P3D"),
    /// the shape the Play provider already hands the web layer.
    static func iso(_ p: Product.SubscriptionPeriod) -> String {
        switch p.unit {
        case .day: return "P\(p.value)D"
        case .week: return "P\(p.value)W"
        case .month: return "P\(p.value)M"
        case .year: return "P\(p.value)Y"
        @unknown default: return ""
        }
    }

    // MARK: - purchase

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), BEStoreKitPlugin.allowed.contains(id) else {
            call.reject("unknown_product"); return
        }
        guard let raw = call.getString("appAccountToken"), let token = UUID(uuidString: raw) else {
            call.reject("account_token"); return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("unknown_product"); return
                }
                let result = try await product.purchase(options: [.appAccountToken(token)])
                switch result {
                case .success(let verification):
                    guard case .verified(let tx) = verification else {
                        call.reject("unverified"); return
                    }
                    // NOT finished here: the web layer calls finish() once the server answered.
                    call.resolve(await self.payload(verification, tx))
                case .userCancelled:
                    call.resolve(["cancelled": true])
                case .pending:
                    // Ask to Buy / a payment that needs approval: it arrives later
                    // through Transaction.updates.
                    call.resolve(["pending": true])
                @unknown default:
                    call.resolve(["cancelled": true])
                }
            } catch {
                call.reject("purchase_failed", nil, error)
            }
        }
    }

    // MARK: - what this Apple ID owns

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        Task { call.resolve(["items": await self.entitlements()]) }
    }

    /// "Restore purchases": AppStore.sync can ask for the Apple ID password, so
    /// it only ever runs on the learner's tap.
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do { try await AppStore.sync() } catch {
                call.reject("restore_failed", nil, error); return
            }
            call.resolve(["items": await self.entitlements()])
        }
    }

    @objc func pendingTransactions(_ call: CAPPluginCall) {
        Task {
            var out: [[String: Any]] = []
            for await result in Transaction.unfinished {
                if case .verified(let tx) = result, BEStoreKitPlugin.allowed.contains(tx.productID) {
                    out.append(await self.payload(result, tx))
                }
            }
            call.resolve(["items": out])
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        guard let raw = call.getString("transactionId"), let id = UInt64(raw) else {
            call.reject("transaction_id"); return
        }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let tx) = result, tx.id == id { await tx.finish() }
            }
            call.resolve()
        }
    }

    private func entitlements() async -> [[String: Any]] {
        var out: [[String: Any]] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, BEStoreKitPlugin.allowed.contains(tx.productID), tx.productType == .autoRenewable {
                out.append(await payload(result, tx))
            }
        }
        return out
    }

    // MARK: - subscription management (Apple's own sheet)

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        #if os(iOS)
        Task { @MainActor in
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else {
                call.reject("no_scene"); return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject("manage_failed", nil, error)
            }
        }
        #else
        call.unavailable("manageSubscriptions is iOS only")
        #endif
    }

    // MARK: - the JWS strings the server verifies

    /// Apple's signed transaction, plus the signed renewal info of the same
    /// subscription when StoreKit has it. Ids are strings: JavaScript numbers
    /// cannot hold every UInt64.
    private func payload(_ result: VerificationResult<Transaction>, _ tx: Transaction) async -> [String: Any] {
        var o: [String: Any] = [
            "signedTransaction": result.jwsRepresentation,
            "transactionId": String(tx.id),
            "originalTransactionId": String(tx.originalID),
            "productId": tx.productID,
        ]
        if let renewal = await renewalJWS(for: tx) { o["signedRenewalInfo"] = renewal }
        return o
    }

    private func renewalJWS(for tx: Transaction) async -> String? {
        guard let product = try? await Product.products(for: [tx.productID]).first,
              let sub = product.subscription,
              let statuses = try? await sub.status else { return nil }
        for s in statuses {
            if case .verified(let t) = s.transaction, t.originalID == tx.originalID {
                return s.renewalInfo.jwsRepresentation
            }
        }
        return nil
    }
}
