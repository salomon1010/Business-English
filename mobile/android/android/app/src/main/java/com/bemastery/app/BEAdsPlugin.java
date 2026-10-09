package com.bemastery.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.ads.mediation.admob.AdMobAdapter;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdView;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * BE Mastery — AdMob for the Android shell (9 Oct 2026). The Android twin of
 * mobile/ios/.../BEAdsPlugin.swift: same jsName ("BEAds"), same methods, same
 * answers, so index.html's beNativeAdsInit() builds window.BENativeAds the same way.
 *
 * Rules carried over from iOS, deliberately:
 *  - Consent before the first request: configure() runs Google's UMP flow and the
 *    SDK is started only when canRequestAds() is true.
 *  - Non-personalised ads only: every request carries npa=1 (no advertising id use).
 *  - Test creatives wherever a person who is not a learner might see an ad: a debug
 *    build, or a staging build (BuildConfig.BE_TEST_ADS) ALWAYS requests Google's
 *    test units instead of the real ones — AdMob treats a developer's or tester's
 *    real impression as invalid traffic. Only a production release build requests
 *    the real units from res/values/ads.xml.
 *  - An absent or malformed id means "not_configured", never a guess.
 * Interstitial and native advanced only; rewarded stays unimplemented.
 */
@CapacitorPlugin(name = "BEAds")
public class BEAdsPlugin extends Plugin {

    static final String[] FORMATS = {"interstitial", "native"};
    /** Google's own always-fill Android test units */
    static final String TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
    static final String TEST_NATIVE = "ca-app-pub-3940256099942544/2247696110";
    static final Pattern UNIT_ID = Pattern.compile("^ca-app-pub-[0-9]{16}/[0-9]{10}$");

    private boolean started = false, consentResolved = false, canRequestAds = false, configuring = false;
    private String interstitialUnit, nativeUnit;
    private InterstitialAd interstitial;
    private PluginCall showing;   // the show() call waiting for the learner to close the ad
    private final Map<String, View> nativeViews = new HashMap<>();
    private final Map<String, NativeAd> nativeAds = new HashMap<>();

    static boolean validUnitId(String s) { return s != null && UNIT_ID.matcher(s).matches(); }
    static boolean testUnitsAllowed() { return BuildConfig.DEBUG || BuildConfig.BE_TEST_ADS; }

    private static JSObject unavailable(String reason) {
        JSObject o = new JSObject();
        o.put("available", false); o.put("reason", reason); o.put("formats", new JSArray());
        o.put("npa", true); o.put("consent", reason);
        return o;
    }

    private JSObject state() {
        JSObject o = new JSObject();
        JSArray f = new JSArray(); for (String s : FORMATS) f.put(s);
        o.put("available", started && consentResolved && canRequestAds);
        o.put("formats", f); o.put("npa", true);
        o.put("consent", consentResolved ? (canRequestAds ? "can_request" : "cannot_request") : "unresolved");
        return o;
    }

    private static JSObject ready(boolean r) { JSObject o = new JSObject(); o.put("ready", r); return o; }
    private static JSObject shown(boolean s) { JSObject o = new JSObject(); o.put("shown", s); return o; }

    // ---------------------------------------------------------------- configure

    @PluginMethod
    public void configure(PluginCall call) {
        String inter = getContext().getString(R.string.be_ads_interstitial_unit);
        String nat = getContext().getString(R.string.be_ads_native_unit);
        if (testUnitsAllowed()) { inter = TEST_INTERSTITIAL; nat = TEST_NATIVE; }
        if (!validUnitId(inter) || !validUnitId(nat)) { call.resolve(unavailable("not_configured")); return; }
        interstitialUnit = inter; nativeUnit = nat;

        if (started && consentResolved) { call.resolve(state()); return; }
        if (configuring) { call.resolve(unavailable("configuring")); return; }
        configuring = true;

        Activity act = getActivity();
        if (act == null) { configuring = false; call.resolve(unavailable("no_activity")); return; }
        ConsentInformation info = UserMessagingPlatform.getConsentInformation(act);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(false).build();
        info.requestConsentInfoUpdate(act, params,
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(act, formError -> {
                // shown, not required, or failed to load: UMP's own answer decides
                consentResolved = true;
                canRequestAds = info.canRequestAds();
                afterConsent(call);
            }),
            requestError -> {
                // the consent service could not be reached: serve nothing rather than guess
                consentResolved = true; canRequestAds = false;
                afterConsent(call);
            });
    }

    private void afterConsent(PluginCall call) {
        if (!canRequestAds) { configuring = false; call.resolve(unavailable("consent")); return; }
        MobileAds.initialize(getContext(), status -> {
            started = true; configuring = false;
            call.resolve(state());
        });
    }

    private AdRequest request() {
        Bundle extras = new Bundle();
        extras.putString("npa", "1");
        return new AdRequest.Builder().addNetworkExtrasBundle(AdMobAdapter.class, extras).build();
    }

    private boolean live() { return started && consentResolved && canRequestAds; }

    // ---------------------------------------------------------------- interstitial

    @PluginMethod
    public void load(PluginCall call) {
        String format = call.getString("format", "");
        if (!live()) { call.resolve(ready(false)); return; }
        if ("native".equals(format)) { call.resolve(ready(true)); return; }   // loaded per placement by showNative
        if (!"interstitial".equals(format) || interstitialUnit == null) { call.resolve(ready(false)); return; }
        getActivity().runOnUiThread(() -> InterstitialAd.load(getContext(), interstitialUnit, request(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull InterstitialAd ad) { interstitial = ad; call.resolve(ready(true)); }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { interstitial = null; call.resolve(ready(false)); }   // no fill is not an error
        }));
    }

    @PluginMethod
    public void isReady(PluginCall call) {
        String format = call.getString("format", "");
        if ("interstitial".equals(format)) { call.resolve(ready(interstitial != null)); return; }
        if ("native".equals(format)) { call.resolve(ready(live())); return; }
        call.resolve(ready(false));
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!"interstitial".equals(call.getString("format", ""))) { call.resolve(shown(false)); return; }
        Activity act = getActivity();
        InterstitialAd ad = interstitial;
        if (ad == null || act == null) { call.resolve(shown(false)); return; }
        interstitial = null;   // one impression per load
        call.setKeepAlive(true);
        showing = call;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { finishInterstitial(true); }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { finishInterstitial(false); }
        });
        // GMA draws its own full-screen activity with its own close control
        act.runOnUiThread(() -> ad.show(act));
    }

    private void finishInterstitial(boolean wasShown) {
        PluginCall c = showing; showing = null;
        if (c == null) return;
        JSObject o = new JSObject();
        o.put("shown", wasShown);
        if (wasShown) { o.put("closable", true); o.put("completed", true); }
        c.resolve(o);
        c.setKeepAlive(false);
        getBridge().releaseCall(c);
    }

    @PluginMethod
    public void dismiss(PluginCall call) {
        interstitial = null;
        finishInterstitial(true);
        call.resolve();
    }

    // ---------------------------------------------------------------- native advanced

    /** The slot's rectangle in CSS pixels, converted to the parent view's pixels. */
    private int[] rect(PluginCall call) {
        float d = getContext().getResources().getDisplayMetrics().density;
        WebView wv = getBridge().getWebView();
        int x = Math.round(call.getFloat("x", 0f) * d) + wv.getLeft();
        int y = Math.round(call.getFloat("y", 0f) * d) + wv.getTop();
        int w = Math.round(call.getFloat("w", 0f) * d), h = Math.round(call.getFloat("h", 0f) * d);
        return new int[]{x, y, w, h, Math.round(call.getFloat("w", 0f)), Math.round(call.getFloat("h", 0f))};
    }

    private ViewGroup host() {
        WebView wv = getBridge().getWebView();
        return wv != null && wv.getParent() instanceof ViewGroup ? (ViewGroup) wv.getParent() : null;
    }

    @PluginMethod
    public void showNative(PluginCall call) {
        String placement = call.getString("placement", "");
        int[] r = rect(call);
        if (!live() || nativeUnit == null || placement.isEmpty() || r[4] <= 40 || r[5] <= 40) { call.resolve(shown(false)); return; }
        getActivity().runOnUiThread(() -> {
            ViewGroup host = host();
            if (host == null) { call.resolve(shown(false)); return; }
            final boolean[] done = {false};
            AdLoader loader = new AdLoader.Builder(getContext(), nativeUnit)
                .forNativeAd(nativeAd -> {
                    if (done[0]) { nativeAd.destroy(); return; }
                    done[0] = true;
                    View v = buildNativeView(nativeAd);
                    place(v, r);
                    View old = nativeViews.put(placement, v);
                    if (old != null) host.removeView(old);
                    NativeAd oldAd = nativeAds.put(placement, nativeAd);
                    if (oldAd != null) oldAd.destroy();
                    host.addView(v);
                    call.resolve(shown(true));
                })
                .withAdListener(new AdListener() {
                    @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { if (!done[0]) { done[0] = true; call.resolve(shown(false)); } }   // no fill: an ordinary answer
                })
                .build();
            loader.loadAd(request());
        });
    }

    @PluginMethod
    public void moveNative(PluginCall call) {
        String placement = call.getString("placement", "");
        int[] r = rect(call);
        getActivity().runOnUiThread(() -> {
            View v = nativeViews.get(placement);
            if (v != null) {
                // off-screen or collapsed: hide rather than draw a sliver over the app
                v.setVisibility(r[5] < 20 || r[4] < 40 ? View.INVISIBLE : View.VISIBLE);
                place(v, r);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void hideNative(PluginCall call) {
        String placement = call.getString("placement", "");
        getActivity().runOnUiThread(() -> {
            ViewGroup host = host();
            if (placement.isEmpty()) {
                for (View v : nativeViews.values()) if (host != null) host.removeView(v);
                for (NativeAd a : nativeAds.values()) a.destroy();
                nativeViews.clear(); nativeAds.clear();
            } else {
                View v = nativeViews.remove(placement);
                if (v != null && host != null) host.removeView(v);
                NativeAd a = nativeAds.remove(placement);
                if (a != null) a.destroy();
            }
            call.resolve();
        });
    }

    private static void place(View v, int[] r) {
        ViewGroup.LayoutParams lp = v.getLayoutParams();
        if (lp == null) lp = new ViewGroup.LayoutParams(r[2], r[3]);
        lp.width = r[2]; lp.height = r[3];
        v.setLayoutParams(lp);
        v.setX(r[0]); v.setY(r[1]);
        v.setElevation(8f);
    }

    /** A plain, clearly-an-ad layout: Google's required "Ad" badge, headline, body,
     *  call to action. Its own dark panel keeps it readable on both app themes and
     *  never imitates a BE Mastery card. */
    private View buildNativeView(NativeAd ad) {
        android.content.Context c = getContext();
        float d = c.getResources().getDisplayMetrics().density;
        NativeAdView view = new NativeAdView(c);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#1b2233")); bg.setCornerRadius(12 * d);
        view.setBackground(bg);
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        int pad = Math.round(10 * d);
        col.setPadding(pad, pad, pad, pad);

        LinearLayout top = new LinearLayout(c);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView badge = new TextView(c);
        badge.setText("Ad");
        badge.setTextColor(Color.WHITE);
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bb = new GradientDrawable(); bb.setColor(Color.parseColor("#d98c1a")); bb.setCornerRadius(3 * d);
        badge.setBackground(bb);
        badge.setPadding(Math.round(5 * d), Math.round(1 * d), Math.round(5 * d), Math.round(1 * d));
        TextView headline = new TextView(c);
        headline.setTextColor(Color.WHITE);
        headline.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        headline.setTypeface(Typeface.DEFAULT_BOLD);
        headline.setMaxLines(2);
        headline.setPadding(Math.round(6 * d), 0, 0, 0);
        top.addView(badge); top.addView(headline);

        TextView body = new TextView(c);
        body.setTextColor(Color.parseColor("#b8c0d4"));
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        body.setMaxLines(2);
        body.setPadding(0, Math.round(4 * d), 0, Math.round(4 * d));

        TextView cta = new TextView(c);
        cta.setTextColor(Color.parseColor("#8fb4ff"));
        cta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cta.setTypeface(Typeface.DEFAULT_BOLD);

        col.addView(top); col.addView(body); col.addView(cta);
        view.addView(col);

        headline.setText(ad.getHeadline());
        body.setText(ad.getBody() != null ? ad.getBody() : "");
        cta.setText(ad.getCallToAction() != null ? ad.getCallToAction() : "");
        // Google's required wiring: register the asset views, then set the ad LAST
        view.setHeadlineView(headline);
        view.setBodyView(body);
        view.setCallToActionView(cta);
        view.setNativeAd(ad);
        return view;
    }

    @Override
    protected void handleOnDestroy() {
        for (NativeAd a : nativeAds.values()) a.destroy();
        nativeAds.clear(); nativeViews.clear();
    }
}
