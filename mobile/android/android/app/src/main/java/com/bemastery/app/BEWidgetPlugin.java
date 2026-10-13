package com.bemastery.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import com.bemastery.app.widget.BEStreakCountdown;
import com.bemastery.app.widget.BEWidgetProvider;
import com.bemastery.app.widget.BEWidgetSnapshot;
import com.bemastery.app.widget.BEWidgetStore;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * BE Mastery — the bridge behind {@code window.BEWidget} in the Android shell (11 Oct 2026).
 * The Android twin of mobile/ios/.../BEWidgetPlugin.swift: same jsName, same methods
 * (available / update / clear / pendingOpen + the "open" event), so index.html's
 * widgetSync / widgetNativeBoot drive both.
 *
 * The widgets themselves are the Play TWA's (playstore/android-widget, built into this app
 * by build.gradle's sourceSets). The TWA could only reach them through be-widget, because a
 * Trusted Web Activity cannot call its own app; here the page hands the snapshot over
 * directly, so nothing leaves the phone and the widget is current the moment the app is.
 *
 * A tap on a widget opens MainActivity with {@code bemastery://open?view=…} (BEWidgetLaunch
 * in shell mode). {@link #route} accepts the iPhone's allow-list and nothing else.
 *
 * Nothing is logged.
 */
@CapacitorPlugin(name = "BEWidget")
public class BEWidgetPlugin extends Plugin {

    static final int MAX_BYTES = 16_384;   // as on iOS

    private static BEWidgetPlugin live;
    private static JSObject pending;

    @Override
    public void load() {
        synchronized (BEWidgetPlugin.class) { live = this; }
    }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", true);
        call.resolve(r);
    }

    /** Store the snapshot as the latest and as its programme's last; redraw every widget. */
    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("snapshot");
        if (json == null || json.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES || BEWidgetSnapshot.parse(json) == null) {
            call.reject("not a widget snapshot", "bad_snapshot");
            return;
        }
        String area;
        try { area = "pro".equals(new JSONObject(json).optString("area")) ? "pro" : "ge"; }
        catch (Exception e) { call.reject("not a widget snapshot", "bad_snapshot"); return; }
        Context c = getContext().getApplicationContext();
        long now = System.currentTimeMillis();
        BEWidgetStore.put(c, null, json, now);
        BEWidgetStore.put(c, area, json, now);
        redraw(c);
        JSObject r = new JSObject();
        r.put("stored", true);
        call.resolve(r);
    }

    /** Sign-out, account deletion: every widget forgets this learner, and the countdown ends. */
    @PluginMethod
    public void clear(PluginCall call) {
        Context c = getContext().getApplicationContext();
        BEWidgetStore.clear(c);
        redraw(c);
        call.resolve();
    }

    /** The widget tap that LAUNCHED the app, served once (no listener exists yet on a cold launch). */
    @PluginMethod
    public void pendingOpen(PluginCall call) {
        JSObject p;
        synchronized (BEWidgetPlugin.class) { p = pending; pending = null; }
        JSObject r = new JSObject();
        r.put("open", p == null ? JSONObject.NULL : p);
        call.resolve(r);
    }

    /* drawing and the countdown read the store; off the main thread like every widget update */
    private static void redraw(Context c) {
        new Thread(() -> {
            try { BEWidgetProvider.drawEverything(c); } catch (Exception ignored) { }
            try { BEStreakCountdown.sync(c); } catch (Exception ignored) { }
        }).start();
    }

    /** From MainActivity: true when the intent was a widget tap (and has been routed). */
    static boolean deliver(Intent intent) {
        Uri d = intent == null ? null : intent.getData();
        JSObject payload = route(d);
        if (payload == null) return false;
        intent.setData(null);                                   // a rotation must not replay it
        BEWidgetPlugin p;
        synchronized (BEWidgetPlugin.class) {
            p = live;
            if (p == null || p.getBridge() == null) { pending = payload; return true; }
        }
        p.notifyListeners("open", payload, true);
        return true;
    }

    static final Set<String> VIEWS = set("session", "journey", "practice", "shadow", "review", "home", "foundations", "lines", "phrases", "mastery", "english");
    static final Set<String> DAYS = set("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
    static final Set<String> ACTS = set("words", "today", "roadmap", "signin", "premium", "shift", "daily");
    static final Set<String> REC_VIEWS = set("session", "practice", "shadow", "partner", "phrases", "phrasebank", "roleplay", "mastery", "english");
    static final Set<String> REC_ACTS = set("clip", "trouble", "study-due", "ai", "shift", "cards", "quiz", "crossword", "visual", "listen", "builder", "match", "workshop");

    private static Set<String> set(String... v) { return new HashSet<>(Arrays.asList(v)); }

    private static String value(Uri u, String name) {
        String v = u.getQueryParameter(name);
        if (v == null || v.isEmpty()) return null;
        return v.length() > 32 ? v.substring(0, 32) : v;
    }

    /** {@code bemastery://open?view=session&w=3&d=Tue} → {view, w, d, src}; only known values survive. */
    static JSObject route(Uri u) {
        if (u == null || !"bemastery".equalsIgnoreCase(u.getScheme()) || !"open".equalsIgnoreCase(u.getHost())) return null;
        if ("1".equals(value(u, "rec"))) {
            String view = value(u, "view");
            if (view == null || !REC_VIEWS.contains(view)) return null;
            JSObject rec = new JSObject();
            rec.put("view", view);
            String a = value(u, "act");
            if (a != null && REC_ACTS.contains(a)) rec.put("act", a);
            JSArray args = new JSArray();
            for (int i = 0; i < 3; i++) {
                String v = value(u, "a" + i);
                if (v != null && v.matches("^[A-Za-z0-9_.:-]{1,40}$")) args.put(v);
            }
            rec.put("a", args);
            rec.put("ch", "1".equals(value(u, "ch")));
            JSObject out = new JSObject();
            out.put("rec", rec);
            out.put("src", "widget");
            return out;
        }
        String view = value(u, "view");
        if (view == null || !VIEWS.contains(view)) return null;
        JSObject out = new JSObject();
        out.put("view", view);
        out.put("src", "widget");
        try {
            String w = value(u, "w");
            if (w != null) { int n = Integer.parseInt(w); if (n >= 1 && n <= 52) out.put("w", n); }
        } catch (NumberFormatException ignored) { }
        String d = value(u, "d");
        if (d != null && DAYS.contains(d)) out.put("d", d);
        String a = value(u, "act");
        if (a != null && ACTS.contains(a)) out.put("act", a);
        return out;
    }
}
