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
 *
 * Three gallery entries share this class: this one follows whichever
 * programme is open in the app ({@link #area()} null); {@link BEWidgetProviderGE}
 * and {@link BEWidgetProviderPro} each show one programme's last state, so a
 * learner on both can keep both on the home screen.
 */
public class BEWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_REFRESH = "com.bemastery.app.widget.REFRESH";

    /** null = the open programme; "ge" / "pro" = that programme only. */
    protected String area() { return null; }

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        drawAll(c, mgr, ids, area());
        final PendingResult result = goAsync();
        final Context app = c.getApplicationContext();
        new Thread(() -> {
            try {
                if (BEWidgetFeed.refresh(app)) drawEverything(app);
            } catch (Exception ignored) {
            } finally {
                BEStreakCountdown.sync(app);   // the streak countdown reads the same snapshots
                result.finish();
            }
        }).start();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager mgr, int id, Bundle options) {
        draw(c, mgr, id, area());
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (intent != null && ACTION_REFRESH.equals(intent.getAction())) {
            onUpdate(c, AppWidgetManager.getInstance(c), ids(c, getClass()));
            return;
        }
        super.onReceive(c, intent);
    }

    // ---- drawing

    static final Class<?>[] PROVIDERS = { BEWidgetProvider.class, BEWidgetProviderGE.class, BEWidgetProviderPro.class };

    static int[] ids(Context c, Class<?> provider) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, provider));
    }

    static String areaOf(Class<?> provider) {
        return provider == BEWidgetProviderGE.class ? "ge" : provider == BEWidgetProviderPro.class ? "pro" : null;
    }

    /** Every placed widget of every kind, from what is on the phone now. */
    static void drawEverything(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (Class<?> p : PROVIDERS) drawAll(c, mgr, ids(c, p), areaOf(p));
        BEWidgetRecsProvider.drawEverything(c);   // the Recommendations widget reads the same snapshot
        BEWidgetMasteryProvider.drawEverything(c); // the Welding Mastery widget reads the Welding one
    }

    static void drawAll(Context c, AppWidgetManager mgr, int[] ids, String area) {
        if (ids == null) return;
        for (int id : ids) draw(c, mgr, id, area);
    }

    static void draw(Context c, AppWidgetManager mgr, int id, String area) {
        BEWidgetSnapshot s = BEWidgetSnapshot.parse(BEWidgetStore.snapJson(c, area));
        Bundle o = mgr.getAppWidgetOptions(id);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        RemoteViews rv = BEWidgetRenderer.build(c, s, w, h, System.currentTimeMillis(), area);
        mgr.updateAppWidget(id, rv);
    }

    // ---- asking for a refresh (all three kinds at once; one fetch serves them all)

    static boolean anyPlaced(Context c) {
        for (Class<?> p : PROVIDERS) if (ids(c, p).length > 0) return true;
        return BEWidgetRecsProvider.ids(c).length > 0 || BEWidgetMasteryProvider.ids(c).length > 0;
    }

    /** Redraw every placed widget now, fetching first. Safe when none is placed. */
    public static void requestRefresh(Context c) {
        try {
            if (!anyPlaced(c)) return;
            c.sendBroadcast(new Intent(c, BEWidgetProvider.class).setAction(ACTION_REFRESH));
        } catch (Exception ignored) {
        }
    }

    /** The same, a little later — after the page has had time to publish. */
    public static void scheduleRefresh(Context c, long delayMs) {
        try {
            if (!anyPlaced(c)) return;
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
