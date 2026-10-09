package com.bemastery.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import com.bemastery.app.R;

import org.json.JSONObject;

/**
 * BE Mastery — the Welding Mastery game widget (Android), 9 Oct 2026.
 *
 * Welding English only: it reads the Welding snapshot ("pro") and draws its
 * {@code wm} block — words mastered of 250, level, XP, the streak in the
 * game, today's shift and its progress. The page puts that block in the
 * snapshot only while the game exists for this learner, so without it the
 * widget shows a plain invitation. Signed out it shows the sign-in line.
 * It computes nothing; a tap opens the game hub ({@code #mastery}).
 *
 * It shares the one fetch with the other widgets: {@link BEWidgetFeed#refresh}
 * stores every programme's snapshot, and {@link BEWidgetProvider#drawEverything}
 * redraws this one too.
 */
public class BEWidgetMasteryProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        drawAll(c, mgr, ids);
        final PendingResult result = goAsync();
        final Context app = c.getApplicationContext();
        new Thread(() -> {
            try {
                if (BEWidgetFeed.refresh(app)) BEWidgetProvider.drawEverything(app);
            } catch (Exception ignored) {
            } finally {
                result.finish();
            }
        }).start();
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (intent != null && BEWidgetProvider.ACTION_REFRESH.equals(intent.getAction())) {
            onUpdate(c, AppWidgetManager.getInstance(c), ids(c));
            return;
        }
        super.onReceive(c, intent);
    }

    static int[] ids(Context c) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, BEWidgetMasteryProvider.class));
    }

    static void drawEverything(Context c) { drawAll(c, AppWidgetManager.getInstance(c), ids(c)); }

    static void drawAll(Context c, AppWidgetManager mgr, int[] ids) {
        if (ids == null || ids.length == 0) return;
        RemoteViews rv = build(c, BEWidgetStore.snapJson(c, "pro"));
        for (int id : ids) mgr.updateAppWidget(id, rv);
    }

    private static String label(JSONObject L, String key, String fallback) {
        String v = L == null ? "" : L.optString(key, "").trim();
        return v.isEmpty() ? fallback : v;
    }

    static RemoteViews build(Context c, String json) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.be_widget_mastery);
        JSONObject snap = null, wm = null;
        try { if (json != null) snap = new JSONObject(json); } catch (Exception ignored) {}
        if (snap != null) wm = snap.optJSONObject("wm");
        JSONObject gate = snap == null ? null : snap.optJSONObject("gate");
        boolean signedIn = gate == null || gate.optBoolean("signedIn", false);

        if (snap == null || !signedIn) {
            fill(rv, "", "", "", "", c.getString(R.string.be_widget_lock_signin), 0, false);
            rv.setOnClickPendingIntent(R.id.wm_root, BEWidgetLaunch.unlock(c, false));
            return rv;
        }
        if (wm == null) {
            fill(rv, "", "", "", "", c.getString(R.string.be_widget_wm_empty), 0, false);
            rv.setOnClickPendingIntent(R.id.wm_root, BEWidgetLaunch.open(c, 9, "mastery", "mastery"));
            return rv;
        }
        JSONObject L = wm.optJSONObject("labels"), sh = wm.optJSONObject("shift");
        int m = wm.optInt("m", 0), total = wm.optInt("total", 250), xp = wm.optInt("xp", 0), streak = wm.optInt("streak", 0);
        boolean done = sh != null && sh.optBoolean("done", false);
        int p = sh == null ? 0 : sh.optInt("p", 0), n = sh == null ? 5 : Math.max(1, sh.optInt("n", 5));
        String shiftLine = done ? label(L, "done", "Shift complete")
                : label(L, "shift", "Today's Shift") + ": " + (sh == null ? "" : sh.optString("t", "")) + " · " + p + "/" + n;
        String stats = label(L, "level", "Level " + wm.optInt("lvl", 1)) + " · " + xp + " " + label(L, "xp", "XP")
                + (streak > 0 ? " · " + streak + " " + label(L, "streak", "day streak") : "");
        rv.setTextViewText(R.id.wm_title, label(L, "title", c.getString(R.string.be_widget_name_mastery)));
        fill(rv, String.valueOf(m), "/" + total, label(L, "mastered", "words mastered"), stats, shiftLine,
                done ? 100 : Math.round(100f * p / n), done);
        rv.setOnClickPendingIntent(R.id.wm_root, BEWidgetLaunch.open(c, 9, "mastery", "mastery"));
        return rv;
    }

    private static void fill(RemoteViews rv, String count, String total, String mastered, String stats, String shift, int pct, boolean done) {
        rv.setTextViewText(R.id.wm_count, count);
        rv.setTextViewText(R.id.wm_total, total);
        rv.setTextViewText(R.id.wm_mastered, mastered);
        rv.setTextViewText(R.id.wm_stats, stats);
        rv.setTextViewText(R.id.wm_shift, shift);
        rv.setViewVisibility(R.id.wm_bar, done ? View.GONE : View.VISIBLE);
        rv.setViewVisibility(R.id.wm_bar_ok, done ? View.VISIBLE : View.GONE);
        rv.setProgressBar(R.id.wm_bar, 100, Math.max(0, Math.min(100, pct)), false);
    }
}
