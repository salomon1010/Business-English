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

    public static void put(Context c, String snapJson, long at) {
        prefs(c).edit().putString(K_SNAP, snapJson).putLong(K_AT, at).apply();
    }

    public static void clear(Context c) {
        prefs(c).edit().remove(K_SNAP).remove(K_AT).apply();
    }

    public static String snapJson(Context c) { return prefs(c).getString(K_SNAP, null); }

    public static long at(Context c) { return prefs(c).getLong(K_AT, 0L); }
}
