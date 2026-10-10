package com.bemastery.app.widget;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import com.bemastery.app.R;

import org.json.JSONObject;

/**
 * BE Mastery — the game streak countdown on Android (owner, 10 Oct 2026), the twin of
 * the iPhone's Live Activity (mobile/ios/ios/App/BEWidget/BEStreakActivity.swift).
 *
 * In the LAST THREE HOURS of the game day (UTC midnight, the day the hubs and the
 * server count) with today's daily mission (English Mastery) or daily challenge
 * (Welding Mastery) not done, an ongoing notification counts down to the deadline.
 * The clock is a system Chronometer, so nothing ticks here. Finishing the daily turns
 * it green ("streak safe") for a few seconds, then it goes.
 *
 * WHERE THE FACTS COME FROM. The Play app is a Trusted Web Activity: the page cannot
 * call this code. It puts the hub's countdown block ({@code live}: hub, translated
 * words, streak, deadline, done) in the widget snapshot it publishes to be-widget,
 * and this class reads the stored snapshots ({@link BEWidgetFeed#refresh} fetches).
 *
 * WHEN IT RUNS. {@link BEStreakReceiver} wakes it: after a launch, when the learner
 * comes back and when they leave (LauncherActivity), at the start of the window, every
 * 15 minutes inside it, after a reboot, and with each widget refresh. Every run plans
 * the next one, so the chain keeps itself going once the app has been opened.
 *
 * A NEW DAY WITHOUT OPENING THE APP. The block is the last one the page published. If
 * that day was finished, the streak carries into the next day — so the next day's
 * countdown is shown with the same words, which is the case that matters most (the
 * learner who has not opened the app today). If the old day was not finished, the
 * streak is gone and nothing is shown.
 *
 * Nothing is sent anywhere and nothing is logged.
 */
public final class BEStreakCountdown {
    private BEStreakCountdown() {}

    static final String CHANNEL = "be_streak";
    static final int NOTIF_ID = 4711;
    static final long WINDOW_MS = 3L * 3600_000L;   // as the page's LIVE_WINDOW_MS
    static final long DAY_MS = 86_400_000L;
    static final long STEP_MS = 15L * 60_000L;      // the ring and the facts, refreshed inside the window

    private static final String PREFS = "be_streak", K_SHOWN = "shown";

    /** One hub's countdown, as the page described it. */
    static final class Live {
        String prog = "", title = "", line = "", doneLine = "";
        int streak; long deadline; boolean done;

        static Live parse(String snapJson) {
            if (snapJson == null) return null;
            try {
                JSONObject x = new JSONObject(snapJson).optJSONObject("live");
                if (x == null) return null;
                Live l = new Live();
                l.prog = x.optString("prog", "");
                if (!"welding".equals(l.prog) && !"general-english".equals(l.prog)) return null;
                l.title = x.optString("title", "");
                l.line = x.optString("line", "");
                l.doneLine = x.optString("doneLine", "");
                l.streak = x.optInt("streak", 0);
                l.deadline = x.optLong("deadline", 0L);
                l.done = x.optBoolean("done", false);
                return l.deadline > 0 ? l : null;
            } catch (Exception e) {
                return null;
            }
        }

        /** The same block, carried into the day it now is (see the class note). Null = nothing to say. */
        Live at(long now) {
            if (now < deadline) return this;
            if (!done) return null;                          // yesterday not finished: the streak is gone
            long d = deadline;
            while (d <= now) d += DAY_MS;
            if (d - deadline > DAY_MS) return null;          // more than a day missed
            Live n = new Live();
            n.prog = prog; n.title = title; n.line = line; n.doneLine = doneLine;
            n.streak = streak; n.deadline = d; n.done = false;
            return n;
        }

        boolean welding() { return "welding".equals(prog); }
    }

    /** The hub that matters now: the one closest to its deadline and not done. */
    static Live pick(Context c, long now) {
        Live best = null;
        for (String area : new String[] { null, "ge", "pro" }) {
            Live l = Live.parse(BEWidgetStore.snapJson(c, area));
            if (l != null) l = l.at(now);
            if (l == null) continue;
            if (best == null || (!l.done && (best.done || l.deadline < best.deadline))) best = l;
        }
        return best;
    }

    /** Post, update or remove the notification, and plan the next run. */
    public static void sync(Context c) {
        try {
            long now = System.currentTimeMillis();
            Live l = pick(c, now);
            boolean shown = prefs(c).getBoolean(K_SHOWN, false);
            if (l == null) {
                if (shown) cancel(c);
                return;                                  // the next launch will publish again
            }
            if (l.done) {
                if (shown) post(c, l, now, true);        // "streak safe", for a few seconds
                schedule(c, l.deadline + DAY_MS - WINDOW_MS - now);
                return;
            }
            long left = l.deadline - now;
            if (left > 60_000L && left <= WINDOW_MS) {
                post(c, l, now, false);
                schedule(c, Math.min(STEP_MS, left - 30_000L));
            } else {
                if (shown) cancel(c);
                schedule(c, left > WINDOW_MS ? left - WINDOW_MS : l.deadline + DAY_MS - WINDOW_MS - now);
            }
        } catch (Exception ignored) {
        }
    }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void cancel(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIF_ID);
        prefs(c).edit().putBoolean(K_SHOWN, false).apply();
    }

    private static void channel(Context c, NotificationManager nm) {
        if (Build.VERSION.SDK_INT < 26 || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, c.getString(R.string.be_streak_channel), NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription(c.getString(R.string.be_streak_channel_desc));
        ch.setSound(null, null);                         // a countdown, not an alarm: silent
        ch.enableVibration(false);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }

    /** Accent colours, as the iPhone card: cyan English Mastery, amber Welding Mastery, green safe. */
    static int accent(Live l, boolean safe) { return safe ? 0xFF34D399 : l.welding() ? 0xFFF59E0B : 0xFF22D3EE; }

    static void post(Context c, Live l, long now, boolean safe) {
        if (Build.VERSION.SDK_INT < 24) return;          // no counting-down Chronometer before Android 7
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !nm.areNotificationsEnabled()) return;
        channel(c, nm);
        RemoteViews small = views(c, l, now, safe, false), big = views(c, l, now, safe, true);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notification_icon)
                .setColor(accent(l, safe))
                .setContentTitle(l.title)
                .setContentText(safe ? l.doneLine : l.line)
                .setCustomContentView(small)
                .setCustomBigContentView(big)
                .setStyle(new Notification.DecoratedCustomViewStyle())
                .setContentIntent(BEWidgetLaunch.open(c, 20, "daily", l.welding() ? "mastery" : "english"))
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setVisibility(Notification.VISIBILITY_PUBLIC);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_DEFAULT).setDefaults(0);
        if (safe) {
            b.setOngoing(false).setAutoCancel(true);
            if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(8000L);
        } else {
            b.setOngoing(true);
            if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(Math.max(1000L, l.deadline - now));
        }
        nm.notify(NOTIF_ID, b.build());
        prefs(c).edit().putBoolean(K_SHOWN, !safe).apply();
    }

    /** The console card: ring + symbol, "HUB // flame n", the glowing clock, one line. */
    static RemoteViews views(Context c, Live l, long now, boolean safe, boolean big) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), big ? R.layout.be_live_big : R.layout.be_live_small);
        int left = (int) Math.max(0, Math.min(WINDOW_MS, l.deadline - now));
        int pct = safe ? 1000 : (int) Math.round(1000.0 * left / WINDOW_MS);
        rv.setViewVisibility(R.id.lv_ring_ge, !safe && !l.welding() ? View.VISIBLE : View.GONE);
        rv.setViewVisibility(R.id.lv_ring_pro, !safe && l.welding() ? View.VISIBLE : View.GONE);
        rv.setViewVisibility(R.id.lv_ring_ok, safe ? View.VISIBLE : View.GONE);
        rv.setProgressBar(safe ? R.id.lv_ring_ok : l.welding() ? R.id.lv_ring_pro : R.id.lv_ring_ge, 1000, pct, false);
        rv.setImageViewResource(R.id.lv_icon, safe ? R.drawable.be_live_ic_safe : l.welding() ? R.drawable.be_live_ic_pro : R.drawable.be_live_ic_ge);
        String head = l.title.toUpperCase(java.util.Locale.ROOT) + (l.streak > 0 ? "  //  🔥 " + l.streak : "");
        rv.setTextViewText(R.id.lv_head, head);
        rv.setTextColor(R.id.lv_head, safe ? 0xFFA7F3D0 : l.welding() ? 0xFFFDE68A : 0xFFA5F3FC);
        if (safe) {
            rv.setViewVisibility(R.id.lv_clock, View.GONE);
            rv.setViewVisibility(R.id.lv_clock_pro, View.GONE);
            rv.setViewVisibility(R.id.lv_done, View.VISIBLE);
            rv.setTextViewText(R.id.lv_done, l.doneLine);
        } else {
            rv.setViewVisibility(R.id.lv_done, View.GONE);
            /* two clocks, one per hub: a RemoteViews cannot change a glow (shadow) colour */
            int clock = l.welding() ? R.id.lv_clock_pro : R.id.lv_clock;
            rv.setViewVisibility(R.id.lv_clock, l.welding() ? View.GONE : View.VISIBLE);
            rv.setViewVisibility(R.id.lv_clock_pro, l.welding() ? View.VISIBLE : View.GONE);
            rv.setChronometer(clock, SystemClock.elapsedRealtime() + (l.deadline - now), null, true);
            rv.setChronometerCountDown(clock, true);
        }
        if (big) {
            rv.setViewVisibility(R.id.lv_line, safe || l.line.isEmpty() ? View.GONE : View.VISIBLE);
            rv.setTextViewText(R.id.lv_line, l.line);
        }
        return rv;
    }

    /** Wake {@link BEStreakReceiver} in {@code delayMs} (inexact; Doze may defer it a little). */
    public static void schedule(Context c, long delayMs) {
        try {
            Intent i = new Intent(c, BEStreakReceiver.class).setAction(BEStreakReceiver.ACTION);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(c, 91, i, flags);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            long at = System.currentTimeMillis() + Math.max(2000L, delayMs);
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.set(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (Exception ignored) {
        }
    }
}
