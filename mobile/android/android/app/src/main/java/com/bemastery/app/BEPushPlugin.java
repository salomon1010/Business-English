package com.bemastery.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * BE Mastery — notifications for the Android shell (10 Oct 2026). The Android twin of
 * mobile/ios/.../BEPushPlugin.swift: same jsName ("BEPush"), same answers, so
 * index.html's beNativePush() drives both. The token is an FCM registration token
 * instead of an APNs device token; the web layer sends it to be-push as `fcm:{token}`.
 *
 * be-push sends DATA messages only (title and body inside `data`), so this app draws
 * every notification itself in BEMessagingService — one code path whether the app
 * is open, in the background or closed.
 *
 * Without google-services.json (the repository has none; the owner adds it from the
 * Firebase console) Firebase is not initialised and available() answers false: the
 * web layer then shows no notification switch, exactly as a build without push.
 *
 * Smart Coach's local session reminders (coachSchedule / coachPending) are iOS only
 * for now; smart-coach.js asks for them on the iPhone alone.
 */
@CapacitorPlugin(
    name = "BEPush",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class BEPushPlugin extends Plugin {
    static final String PREFS = "be_push";
    private static BEPushPlugin live;
    /** the notification that opened the app, kept until the page asks (a cold launch has no listener yet) */
    private static JSObject pendingTap;

    @Override
    public void load() {
        live = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (live == this) live = null;
    }

    static boolean firebaseReady(Context ctx) {
        try { return !FirebaseApp.getApps(ctx).isEmpty(); } catch (Throwable t) { return false; }
    }

    /** "granted" / "denied" / "default", the strings iOS answers. Asked of the system, never assumed. */
    private String status() {
        Context ctx = getContext();
        boolean on = NotificationManagerCompat.from(ctx).areNotificationsEnabled();
        if (on) return "granted";
        if (Build.VERSION.SDK_INT >= 33) {
            // never asked → the prompt can still be shown; asked and refused → "denied" (Settings only)
            boolean asked = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("asked", false);
            return getPermissionState("notifications") == PermissionState.GRANTED ? "denied"   // channel/app switched off
                : asked ? "denied" : "default";
        }
        return "denied";   // before Android 13 there is no prompt: off means the learner turned it off
    }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        boolean ok = firebaseReady(getContext());
        r.put("available", ok);
        r.put("permission", status());
        r.put("registered", ok && token() != null);
        r.put("env", "production");
        call.resolve(r);
    }

    @PluginMethod
    public void permission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permission", status());
        r.put("registered", token() != null);
        call.resolve(r);
    }

    /** Ask once if Android 13+ has not been asked, then fetch the FCM token. `denied` is its own code. */
    @PluginMethod
    public void register(PluginCall call) {
        if (!firebaseReady(getContext())) { call.reject("notifications are not configured in this build", "unavailable"); return; }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            boolean asked = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("asked", false);
            if (asked && !shouldShowRationale()) { call.reject("notifications are turned off for this app", "denied"); return; }
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("asked", true).apply();
            requestPermissionForAlias("notifications", call, "afterPrompt");
            return;
        }
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) { call.reject("notifications are turned off for this app", "denied"); return; }
        fetchToken(call);
    }

    private boolean shouldShowRationale() {
        try { return getActivity().shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS); }
        catch (Throwable t) { return false; }
    }

    @PermissionCallback
    private void afterPrompt(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) { call.reject("permission was not granted", "denied"); return; }
        fetchToken(call);
    }

    private void fetchToken(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (!task.isSuccessful() || task.getResult() == null) { call.reject("could not register with Firebase Cloud Messaging", "network"); return; }
                String tok = task.getResult();
                saveToken(getContext(), tok);
                JSObject r = new JSObject();
                r.put("token", tok);
                r.put("env", "production");
                r.put("permission", "granted");
                call.resolve(r);
            });
        } catch (Throwable t) {
            call.reject("could not register with Firebase Cloud Messaging", "unavailable");
        }
    }

    private String token() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", null);
    }

    static void saveToken(Context ctx, String tok) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("token", tok).apply();
    }

    @PluginMethod
    public void pendingTap(PluginCall call) {
        JSObject r = new JSObject();
        synchronized (BEPushPlugin.class) {
            r.put("tap", pendingTap == null ? JSObject.NULL : pendingTap);
            pendingTap = null;
        }
        call.resolve(r);
    }

    /** The learner has opened the app: the notifications have done their job. */
    @PluginMethod
    public void clear(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancelAll();
        call.resolve();
    }

    @PluginMethod
    public void coachSchedule(PluginCall call) { call.unimplemented("Smart Coach reminders are iOS only for now"); }

    @PluginMethod
    public void coachPending(PluginCall call) { call.unimplemented("Smart Coach reminders are iOS only for now"); }

    /* ---------- plumbing used by MainActivity and BEMessagingService ---------- */

    /** Only the fields the web layer routes on, only as short strings (as BEPushBox.shape on iOS). */
    static JSObject shape(Bundle extras) {
        JSObject out = new JSObject();
        if (extras == null) return out;
        for (String key : BEMessagingService.ROUTE_KEYS) {
            String v = extras.getString(BEMessagingService.EXTRA + key);
            if (v != null && !v.isEmpty()) out.put(key, v.length() > 64 ? v.substring(0, 64) : v);
        }
        return out;
    }

    /** A notification was tapped (MainActivity.onCreate / onNewIntent). */
    static void deliverTap(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(BEMessagingService.EXTRA + "tap", false)) return;
        JSObject tap = shape(intent.getExtras());
        intent.removeExtra(BEMessagingService.EXTRA + "tap");   // a rotation must not replay it
        BEPushPlugin p = live;
        // one route only: a live listener gets the event, otherwise the page reads it at boot
        if (p != null && p.hasListeners("tap")) { p.notifyListeners("tap", tap, false); return; }
        synchronized (BEPushPlugin.class) { pendingTap = tap; }
    }

    /** A message arrived while the page is alive (the twin of iOS `arrived`). */
    static void deliverArrived(JSObject payload) {
        BEPushPlugin p = live;
        if (p != null) p.notifyListeners("arrived", payload, false);
    }

    static boolean pageAlive() {
        BEPushPlugin p = live;
        return p != null && p.getActivity() != null && p.bridge != null && p.getActivity().hasWindowFocus();
    }

    static NotificationManager manager(Context ctx) {
        return (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    }
}
