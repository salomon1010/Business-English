package com.bemastery.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

import java.security.SecureRandom;

/**
 * BE Mastery — what the Android widget keeps on the phone: its own random id
 * (the only thing the web page ever learns about this install), the last
 * snapshot it fetched, and when. Nothing here identifies a person.
 */
public final class BEWidgetStore {
    private static final String PREFS = "be_widget";
    private static final String K_WID = "wid", K_SNAP = "snap", K_AT = "at";

    private BEWidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** The widget id: 32 hex characters, minted once, never derived from anything. */
    public static synchronized String wid(Context c) {
        SharedPreferences p = prefs(c);
        String w = p.getString(K_WID, null);
        if (w != null && w.matches("[a-f0-9]{32}")) return w;
        byte[] b = new byte[16];
        new SecureRandom().nextBytes(b);
        StringBuilder sb = new StringBuilder(32);
        for (byte x : b) sb.append(String.format("%02x", x));
        w = sb.toString();
        p.edit().putString(K_WID, w).apply();
        return w;
    }

    /** The programmes a fixed widget may follow; null = whichever was open last. */
    public static final String[] AREAS = { "ge", "pro" };

    private static String key(String base, String area) { return area == null ? base : base + "_" + area; }

    /** Store a programme's snapshot (area "ge"/"pro"); the latest one is `area == null`. */
    public static void put(Context c, String area, String snapJson, long at) {
        prefs(c).edit().putString(key(K_SNAP, area), snapJson).putLong(key(K_AT, area), at).apply();
    }

    public static void clear(Context c) {
        SharedPreferences.Editor e = prefs(c).edit().remove(K_SNAP).remove(K_AT);
        for (String a : AREAS) e.remove(key(K_SNAP, a)).remove(key(K_AT, a));
        e.apply();
    }

    public static String snapJson(Context c, String area) { return prefs(c).getString(key(K_SNAP, area), null); }

    public static long at(Context c, String area) { return prefs(c).getLong(key(K_AT, area), 0L); }
}
