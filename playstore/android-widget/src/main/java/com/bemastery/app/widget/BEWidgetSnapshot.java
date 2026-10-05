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
