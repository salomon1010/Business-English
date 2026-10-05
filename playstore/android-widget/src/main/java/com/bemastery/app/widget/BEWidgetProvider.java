package com.bemastery.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * BE Mastery — the home-screen widget (Android), 5 Oct 2026.
 *
 * Draws whatever snapshot is on the phone at once, then asks be-widget for a
 * fresh one in the background and draws again if it changed. The system
 * calls {@link #onUpdate} every 30 minutes (be_widget_info.xml); the app's
 * LauncherActivity also asks for a refresh shortly after the app is opened
 * and when the learner comes back from it (the page publishes on both).
 */
public class BEWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_REFRESH = "com.bemastery.app.widget.REFRESH";

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        drawAll(c, mgr, ids);
        final PendingResult result = goAsync();
        final Context app = c.getApplicationContext();
        new Thread(() -> {
            try {
                if (BEWidgetFeed.refresh(app)) drawAll(app, AppWidgetManager.getInstance(app), ids(app));
            } catch (Exception ignored) {
            } finally {
                result.finish();
            }
        }).start();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager mgr, int id, Bundle options) {
        draw(c, mgr, id);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (intent != null && ACTION_REFRESH.equals(intent.getAction())) {
            onUpdate(c, AppWidgetManager.getInstance(c), ids(c));
            return;
        }
        super.onReceive(c, intent);
    }

    // ---- drawing

    static int[] ids(Context c) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, BEWidgetProvider.class));
    }

    static void drawAll(Context c, AppWidgetManager mgr, int[] ids) {
        if (ids == null) return;
        for (int id : ids) draw(c, mgr, id);
    }

    static void draw(Context c, AppWidgetManager mgr, int id) {
        BEWidgetSnapshot s = BEWidgetSnapshot.parse(BEWidgetStore.snapJson(c));
        Bundle o = mgr.getAppWidgetOptions(id);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        RemoteViews rv = BEWidgetRenderer.build(c, s, w, h, System.currentTimeMillis());
        mgr.updateAppWidget(id, rv);
    }

    // ---- asking for a refresh

    /** Redraw every placed widget now, fetching first. Safe when none is placed. */
    public static void requestRefresh(Context c) {
        try {
            if (ids(c).length == 0) return;
            Intent i = new Intent(c, BEWidgetProvider.class).setAction(ACTION_REFRESH);
            c.sendBroadcast(i);
        } catch (Exception ignored) {
        }
    }

    /** The same, a little later — after the page has had time to publish. */
    public static void scheduleRefresh(Context c, long delayMs) {
        try {
            if (ids(c).length == 0) return;
            Intent i = new Intent(c, BEWidgetProvider.class).setAction(ACTION_REFRESH);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(c, 90, i, flags);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.set(AlarmManager.RTC, System.currentTimeMillis() + delayMs, pi);
        } catch (Exception ignored) {
        }
    }
}
