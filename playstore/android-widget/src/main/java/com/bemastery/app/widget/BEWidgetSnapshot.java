package com.bemastery.app.widget;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * BE Mastery — the snapshot the web app published for this widget, as the
 * widget reads it. Mirrors BEWidgetSnapshot in the iOS extension and the
 * allow-list in backend/widget/widget-worker.js: every field is optional, an
 * unknown key is ignored, and the one thing computed here is the time of day
 * (done / pending / at risk / cold) on UTC day keys, exactly as index.html
 * keeps them (new Date().toISOString().slice(0,10)).
 */
public final class BEWidgetSnapshot {
    public enum Mood { DONE, PENDING, AT_RISK, COLD }

    public final String lang, dir, theme, area, programme, lastDay, line;
    public final int streak, best, words;
    public final int weekN, weekTotal, weekDone, weekPer;
    public final String weekTitle;
    public final int overallDone, overallTotal, overallPct;
    public final int goalN, goalOf;
    public final String todayKind, todayKicker, todayTitle, todayCta, todayView, todayDay, todayAct;
    public final int todayWeek;
    public final List<String> steps = new ArrayList<>();
    public final List<String[]> phases = new ArrayList<>();   // {label, pct, state}
    private final JSONObject labels;
    /** Who may use which widget (owner, 6 Oct 2026). hasGate false = an app from before the rule: unlocked. */
    public final boolean hasGate, signedIn, full, recsOn;
    /** One recommendation: what the card shows, and where a tap goes (nudgeGo's view / act / args). */
    public static final class Rec {
        public final String t, s, why, k, img, view, act; public final int min; public final boolean ch;
        public final List<String> a = new ArrayList<>();
        Rec(JSONObject o) {
            t = o.optString("t", ""); s = o.optString("s", ""); why = o.optString("why", ""); k = o.optString("k", "");
            img = o.optString("img", ""); min = o.optInt("min", 0);
            JSONObject g = o.optJSONObject("go");
            view = g == null ? "" : g.optString("view", ""); act = g == null ? "" : g.optString("act", "");
            ch = g != null && g.optBoolean("ch", false);
            JSONArray aa = g == null ? null : g.optJSONArray("a");
            if (aa != null) for (int i = 0; i < Math.min(3, aa.length()); i++) a.add(aa.optString(i, ""));
        }
    }
    public final List<Rec> recs = new ArrayList<>();

    private BEWidgetSnapshot(JSONObject o) {
        lang = o.optString("lang", "en");
        dir = o.optString("dir", "ltr");
        theme = o.optString("theme", "dark");
        area = o.optString("area", "ge");
        programme = o.optString("programme", "");
        lastDay = o.optString("lastDay", "");
        line = o.optString("line", "");
        streak = o.optInt("streak", 0);
        best = o.optInt("best", 0);
        words = o.optInt("words", 0);
        JSONObject w = o.optJSONObject("week");
        weekN = w == null ? 0 : w.optInt("n", 0);
        weekTotal = w == null ? 0 : w.optInt("total", 0);
        weekDone = w == null ? 0 : w.optInt("done", 0);
        weekPer = w == null ? 7 : w.optInt("per", 7);
        weekTitle = w == null ? "" : w.optString("title", "");
        JSONObject ov = o.optJSONObject("overall");
        overallDone = ov == null ? 0 : ov.optInt("done", 0);
        overallTotal = ov == null ? 0 : ov.optInt("total", 0);
        overallPct = ov == null ? 0 : ov.optInt("pct", 0);
        JSONObject g = o.optJSONObject("weekGoal");
        goalN = g == null ? 0 : g.optInt("n", 0);
        goalOf = g == null ? 6 : g.optInt("goal", 6);
        JSONObject t = o.optJSONObject("today");
        todayKind = t == null ? "" : t.optString("kind", "");
        todayKicker = t == null ? "" : t.optString("kicker", "");
        todayTitle = t == null ? "" : t.optString("title", "");
        todayCta = t == null ? "" : t.optString("cta", "");
        todayView = t == null ? "" : t.optString("view", "");
        todayDay = t == null ? "" : t.optString("d", "");
        todayAct = t == null ? "" : t.optString("act", "");
        todayWeek = t == null ? 0 : t.optInt("w", 0);
        JSONArray st = o.optJSONArray("steps");
        if (st != null) for (int i = 0; i < Math.min(40, st.length()); i++) steps.add(st.optString(i, "locked"));
        JSONArray ph = o.optJSONArray("phases");
        if (ph != null) for (int i = 0; i < Math.min(4, ph.length()); i++) {
            JSONObject p = ph.optJSONObject(i);
            if (p != null) phases.add(new String[]{ p.optString("label", ""), String.valueOf(p.optInt("pct", 0)), p.optString("state", "") });
        }
        JSONObject L = o.optJSONObject("labels");
        labels = L == null ? new JSONObject() : L;
        JSONObject gt = o.optJSONObject("gate");
        hasGate = gt != null;
        signedIn = gt == null || gt.optBoolean("signedIn", false);
        full = gt == null || gt.optBoolean("full", false);
        recsOn = gt == null || gt.optBoolean("recs", false);
        JSONArray rc = o.optJSONArray("recs");
        if (rc != null) for (int i = 0; i < Math.min(12, rc.length()); i++) { JSONObject r = rc.optJSONObject(i); if (r != null) recs.add(new Rec(r)); }
    }

    /** Null for anything that is not a version-1 snapshot. */
    public static BEWidgetSnapshot parse(String json) {
        if (json == null || json.length() > 16_384) return null;
        try {
            JSONObject o = new JSONObject(json);
            if (o.optInt("v", 0) != 1) return null;
            return new BEWidgetSnapshot(o);
        } catch (Exception e) {
            return null;
        }
    }

    /** A translated label the app sent, or the English the widget was built with. */
    public String label(String key, String fallback) {
        String v = labels.optString(key, "");
        return v.trim().isEmpty() ? fallback : v;
    }

    /** The lock a widget of this tier wears: 0 none, 1 sign in, 2 Premium. "small" | "full" | "recs". */
    public static final int LOCK_NONE = 0, LOCK_SIGNIN = 1, LOCK_PREMIUM = 2;
    public static int lockOf(BEWidgetSnapshot s, String tier) {
        if (s == null) return LOCK_SIGNIN;               // nobody has signed in on this phone
        if (!s.hasGate) return LOCK_NONE;
        if (!s.signedIn) return LOCK_SIGNIN;
        if ("full".equals(tier)) return s.full ? LOCK_NONE : LOCK_PREMIUM;
        if ("recs".equals(tier)) return s.recsOn ? LOCK_NONE : LOCK_PREMIUM;
        return LOCK_NONE;
    }

    public boolean isLight() { return "light".equals(theme); }
    public boolean isPro() { return "pro".equals(area); }
    public boolean isRTL() { return "rtl".equals(dir); }

    public float weekProgress() {
        if (goalOf <= 0) return 0f;
        return Math.max(0f, Math.min(1f, goalN / (float) goalOf));
    }

    public float overallProgress() {
        if (overallTotal <= 0) return 0f;
        return Math.max(0f, Math.min(1f, overallDone / (float) overallTotal));
    }

    // ---- the clock

    static String utcKey(long millis) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(millis));
    }

    public Mood mood(long now) {
        String today = utcKey(now), yesterday = utcKey(now - 86_400_000L);
        if (today.equals(lastDay)) return Mood.DONE;
        boolean alive = yesterday.equals(lastDay) && streak > 0;
        if (!alive) return Mood.COLD;
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        return c.get(Calendar.HOUR_OF_DAY) >= 18 ? Mood.AT_RISK : Mood.PENDING;
    }

    /** The streak as the app would count it now: alive today or yesterday, else zero. */
    public int streakShown(long now) {
        Mood m = mood(now);
        return (m == Mood.DONE || m == Mood.PENDING || m == Mood.AT_RISK) ? streak : 0;
    }

    public String moodLine(long now) {
        switch (mood(now)) {
            case DONE: return label("done", "Today's practice is done");
            case AT_RISK: return label("risk", "Keep your streak alive tonight");
            case COLD: return label("start", "Start a new streak today");
            default: return line.isEmpty() ? label("line", "25 minutes today keeps the streak alive.") : line;
        }
    }
}
