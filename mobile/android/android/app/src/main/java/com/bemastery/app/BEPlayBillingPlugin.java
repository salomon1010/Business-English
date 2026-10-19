package com.bemastery.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * BE Mastery — Google Play Billing for the Android shell (9 Oct 2026). Replaces the
 * TWA's Digital Goods API + Payment Request. It hands index.html's
 * BillingProviders.play exactly what that API handed it, so the evidence sent to
 * be-entitlements is unchanged: {provider:"google_play", productId, purchaseToken}.
 *
 * The SERVER verifies and acknowledges (backend/entitlements google-play.js) — this
 * plugin never acknowledges, so a purchase our server never saw is refunded by Play
 * after three days rather than granted on the client's word. Prices, periods and
 * trials are Play's own (never in the code). Only the two shared product ids.
 */
@CapacitorPlugin(name = "BEPlayBilling")
public class BEPlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    static final Set<String> ALLOWED = new HashSet<>(Arrays.asList("premium_monthly", "premium_annual"));

    private BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private PluginCall buying;   // the purchase() call waiting for Play's answer

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    /** Runs `then` once the Play connection is up; answers `fail` otherwise. */
    private void ready(Runnable then, Runnable fail) {
        if (client.isReady()) { then.run(); return; }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) then.run(); else fail.run();
            }
            @Override public void onBillingServiceDisconnected() { /* auto-reconnection is on */ }
        });
    }

    @PluginMethod
    public void available(PluginCall call) {
        ready(() -> { JSObject o = new JSObject(); o.put("ok", true); call.resolve(o); },
              () -> { JSObject o = new JSObject(); o.put("ok", false); call.resolve(o); });
    }

    // ---------------------------------------------------------------- products

    @PluginMethod
    public void products(PluginCall call) {
        ready(() -> {
            List<QueryProductDetailsParams.Product> list = new ArrayList<>();
            for (String id : ALLOWED) list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.SUBS).build());
            client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, res) -> {
                JSArray out = new JSArray();
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && res != null) {
                    for (ProductDetails pd : res.getProductDetailsList()) {
                        details.put(pd.getProductId(), pd);
                        JSObject p = describe(pd);
                        if (p != null) out.put(p);
                    }
                }
                JSObject o = new JSObject(); o.put("products", out); call.resolve(o);
            });
        }, () -> { JSObject o = new JSObject(); o.put("products", new JSArray()); call.resolve(o); });
    }

    /** id, title, the recurring price (formatted by Play), amount, currency, ISO period, trial (ISO, only when Play offers one). */
    private static JSObject describe(ProductDetails pd) {
        List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        ProductDetails.PricingPhase recurring = null; String trial = "";
        for (ProductDetails.SubscriptionOfferDetails off : offers) {
            for (ProductDetails.PricingPhase ph : off.getPricingPhases().getPricingPhaseList()) {
                if (ph.getPriceAmountMicros() == 0) { if (trial.isEmpty()) trial = ph.getBillingPeriod(); }
                else if (ph.getRecurrenceMode() == ProductDetails.RecurrenceMode.INFINITE_RECURRING && (recurring == null || off.getOfferId() == null)) recurring = ph;
            }
        }
        if (recurring == null) return null;
        JSObject p = new JSObject();
        p.put("id", pd.getProductId());
        p.put("title", pd.getName());
        p.put("price", recurring.getFormattedPrice());
        p.put("amount", recurring.getPriceAmountMicros() / 1_000_000.0);
        p.put("currency", recurring.getPriceCurrencyCode());
        p.put("period", recurring.getBillingPeriod());
        p.put("trial", trial);
        return p;
    }

    /** The offer to buy: one with a free phase when Play says this account is eligible for it (Play lists only eligible offers), else the base plan. */
    private static String offerToken(ProductDetails pd) {
        List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        String base = null;
        for (ProductDetails.SubscriptionOfferDetails off : offers) {
            for (ProductDetails.PricingPhase ph : off.getPricingPhases().getPricingPhaseList())
                if (ph.getPriceAmountMicros() == 0) return off.getOfferToken();
            if (off.getOfferId() == null) base = off.getOfferToken();
        }
        return base != null ? base : offers.get(0).getOfferToken();
    }

    // ---------------------------------------------------------------- purchase

    @PluginMethod
    public void purchase(PluginCall call) {
        String id = call.getString("id", "");
        Activity act = getActivity();
        if (!ALLOWED.contains(id) || act == null) { call.reject("unknown_product"); return; }
        ready(() -> {
            ProductDetails pd = details.get(id);
            if (pd == null) { call.reject("products_not_loaded"); return; }
            String token = offerToken(pd);
            if (token == null) { call.reject("no_offer"); return; }
            BillingFlowParams.Builder pb = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(List.of(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).setOfferToken(token).build()));
            /* our server's account token (HMAC of the uid, the one StoreKit carries): the
               server then binds this purchase to THIS account only. A UUID, never the uid. */
            String acct = call.getString("accountId", "");
            if (acct != null && acct.matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")) pb.setObfuscatedAccountId(acct);
            BillingFlowParams params = pb.build();
            call.setKeepAlive(true);
            buying = call;
            act.runOnUiThread(() -> {
                BillingResult r = client.launchBillingFlow(act, params);
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) answer(errorOf(r));
            });
        }, () -> call.reject("billing_unavailable"));
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, List<Purchase> purchases) {
        if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) {
                for (String pid : p.getProducts()) {
                    if (!ALLOWED.contains(pid)) continue;
                    JSObject o = new JSObject();
                    o.put("productId", pid);
                    o.put("purchaseToken", p.getPurchaseToken());
                    // PENDING still carries a token: the server answers payment_pending (no Premium, not acknowledged)
                    if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) o.put("pending", true);
                    answer(o);
                    return;
                }
            }
        }
        answer(errorOf(r));
    }

    private static JSObject errorOf(BillingResult r) {
        JSObject o = new JSObject();
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) o.put("cancelled", true);
        else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) o.put("owned", true);
        else o.put("error", "billing_" + code);
        return o;
    }

    private void answer(JSObject o) {
        PluginCall c = buying; buying = null;
        if (c == null) {
            /* an update with no purchase call open — a pending payment that cleared, a
               purchase finished after the app was backgrounded: hand it to the page, which
               sends it to our server like a Restore (index.html BillingProviders.play.listen) */
            if (o.has("purchaseToken")) notifyListeners("purchase", o, true);
            return;
        }
        c.resolve(o);
        c.setKeepAlive(false);
        getBridge().releaseCall(c);
    }

    // ---------------------------------------------------------------- owned (silent)

    /** What this Google account owns, with no prompt — the launch reconcile and Restore. */
    @PluginMethod
    public void owned(PluginCall call) {
        ready(() -> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (r, list) -> {
            JSArray items = new JSArray();
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                for (Purchase p : list) for (String pid : p.getProducts()) if (ALLOWED.contains(pid)) {
                    JSObject o = new JSObject();
                    o.put("productId", pid); o.put("purchaseToken", p.getPurchaseToken());
                    o.put("acknowledged", p.isAcknowledged());
                    o.put("pending", p.getPurchaseState() == Purchase.PurchaseState.PENDING);
                    items.put(o);
                }
            }
            JSObject o = new JSObject(); o.put("items", items); call.resolve(o);
        }), () -> { JSObject o = new JSObject(); o.put("items", new JSArray()); call.resolve(o); });
    }

    // ---------------------------------------------------------------- manage

    /** Play's own subscription page for this app (and the plan, when known). */
    @PluginMethod
    public void manage(PluginCall call) {
        String sku = call.getString("product", "");
        String url = "https://play.google.com/store/account/subscriptions?package=" + getContext().getPackageName()
            + (sku != null && !sku.isEmpty() ? "&sku=" + Uri.encode(sku.toLowerCase(Locale.ROOT)) : "");
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) client.endConnection();
    }
}
