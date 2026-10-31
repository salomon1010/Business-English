package com.bemastery.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * BE Mastery — the bridge behind {@code BEReview} (capPlugin("BEReview")) in the Android shell (31 Oct 2026).
 * The Android twin of mobile/ios/.../BEReviewPlugin.swift: one method, {@code request},
 * which shows Google Play's own in-app review card over the app.
 *
 * Play policy: nothing may be asked before or while the card shows (no "do you like the
 * app?", no star picker), so the page calls this straight after a finished session and
 * draws no dialog of its own. Play decides whether the card actually appears (a quota per
 * learner); the result never says whether it was shown or what was rated, so the call
 * always resolves {@code {done:true}} and the page must not treat it as "rated".
 *
 * Nothing is logged.
 */
@CapacitorPlugin(name = "BEReview")
public class BEReviewPlugin extends Plugin {

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", true);
        call.resolve(r);
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (getActivity() == null) { call.reject("no_activity"); return; }
        ReviewManager manager = ReviewManagerFactory.create(getContext());
        manager.requestReviewFlow().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) { call.reject("unavailable"); return; }
            ReviewInfo info = task.getResult();
            getActivity().runOnUiThread(() ->
                manager.launchReviewFlow(getActivity(), info).addOnCompleteListener(done -> {
                    JSObject r = new JSObject();
                    r.put("done", true);
                    call.resolve(r);
                }));
        });
    }
}
