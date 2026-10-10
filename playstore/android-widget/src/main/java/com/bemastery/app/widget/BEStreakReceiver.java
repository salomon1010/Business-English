package com.bemastery.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * BE Mastery — wakes the streak countdown ({@link BEStreakCountdown}): its own alarms,
 * and the phone restarting (alarms do not survive a reboot). Each run fetches the
 * latest snapshot first, redraws the widgets if it changed, then posts, updates or
 * removes the notification and plans the next run.
 */
public class BEStreakReceiver extends BroadcastReceiver {
    public static final String ACTION = "com.bemastery.app.live.TICK";

    @Override
    public void onReceive(Context c, Intent intent) {
        final PendingResult result = goAsync();
        final Context app = c.getApplicationContext();
        new Thread(() -> {
            try {
                if (BEWidgetFeed.refresh(app)) BEWidgetProvider.drawEverything(app);
            } catch (Exception ignored) {
            }
            try {
                BEStreakCountdown.sync(app);
            } finally {
                result.finish();
            }
        }).start();
    }
}
