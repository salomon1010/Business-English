package com.bemastery.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Draws every BE Mastery notification on Android (10 Oct 2026). be-push sends FCM
 * DATA messages (backend/push/push-worker.js sendFcm): title, body, view, tag,
 * urgent "1"/"0", an optional image, and the routing fields rid / nkind / call /
 * coach. The wording is already translated by the server from the text the app
 * registered, exactly as on iPhone.
 *
 * Rules carried over from BEAppDelegate on iOS:
 *  - a call (tag be-partner-call) while the app is open draws nothing — the page
 *    rings itself; everything else is shown even in the foreground;
 *  - one notification per tag (a newer reminder replaces the older one);
 *  - a picture is best-effort and only from the hosts be-push allows; the text is
 *    always delivered.
 */
public class BEMessagingService extends FirebaseMessagingService {
    static final String EXTRA = "be_";
    static final String[] ROUTE_KEYS = { "view", "tag", "rid", "nkind", "call", "coach" };
    static final String CH_DAILY = "be_daily", CH_CALLS = "be_calls";
    /* the same allow-list as be-push's cleanImage: a phone fetches this, so never "any URL" */
    private static final Pattern IMAGE_OK = Pattern.compile("^https://(i\\.ytimg\\.com|img\\.youtube\\.com|app\\.lomonec\\.com|staging\\.lomonec\\.com)/[^\\s]{0,270}$");

    @Override
    public void onNewToken(@NonNull String token) {
        // the page re-sends the token to be-push on its next launch (pushSync → register)
        BEPushPlugin.saveToken(this, token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        String title = clip(d.get("title"), 120), body = clip(d.get("body"), 400);
        if (title == null || body == null) return;
        String tag = d.get("tag") == null ? "be-reminder" : clip(d.get("tag"), 64);
        boolean urgent = "1".equals(d.get("urgent"));
        boolean call = "be-partner-call".equals(tag);

        JSObject payload = new JSObject();
        for (String k : ROUTE_KEYS) { String v = d.get(k); if (v != null && !v.isEmpty()) payload.put(k, clip(v, 64)); }
        boolean open = BEPushPlugin.pageAlive();
        if (open) BEPushPlugin.deliverArrived(payload);
        if (open && call) return;

        ensureChannels(this);
        Intent tap = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA + "tap", true);
        for (String k : ROUTE_KEYS) { String v = d.get(k); if (v != null && !v.isEmpty()) tap.putExtra(EXTRA + k, clip(v, 64)); }
        int id = tag.hashCode();
        PendingIntent pi = PendingIntent.getActivity(this, id, tap, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, urgent ? CH_CALLS : CH_DAILY)
            .setSmallIcon(R.drawable.ic_stat_be)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setPriority(urgent ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(call ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_REMINDER);
        if (urgent) b.setTimeoutAfter(10 * 60 * 1000L);   // an invitation is worthless after ten minutes (be-push's TTL)
        Bitmap pic = picture(d.get("image"));
        if (pic != null) b.setLargeIcon(pic).setStyle(new NotificationCompat.BigPictureStyle().bigPicture(pic).setSummaryText(body));

        try { NotificationManagerCompat.from(this).notify(tag, id, b.build()); }
        catch (SecurityException e) { /* permission withdrawn between the check and now: nothing to show */ }
    }

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager m = BEPushPlugin.manager(ctx);
        if (m == null) return;
        if (m.getNotificationChannel(CH_DAILY) == null) {
            NotificationChannel c = new NotificationChannel(CH_DAILY, ctx.getString(R.string.be_ch_daily), NotificationManager.IMPORTANCE_DEFAULT);
            c.setDescription(ctx.getString(R.string.be_ch_daily_desc));
            m.createNotificationChannel(c);
        }
        if (m.getNotificationChannel(CH_CALLS) == null) {
            NotificationChannel c = new NotificationChannel(CH_CALLS, ctx.getString(R.string.be_ch_calls), NotificationManager.IMPORTANCE_HIGH);
            c.setDescription(ctx.getString(R.string.be_ch_calls_desc));
            m.createNotificationChannel(c);
        }
    }

    /** Runs on FCM's worker thread, so a short synchronous fetch is allowed. Any failure = no picture. */
    private static Bitmap picture(String url) {
        if (url == null || !IMAGE_OK.matcher(url).matches()) return null;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(5000);
            c.setReadTimeout(5000);
            if (c.getResponseCode() != 200 || c.getContentLength() > 2_000_000) return null;
            try (InputStream in = c.getInputStream()) { return BitmapFactory.decodeStream(in); }
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String clip(String s, int n) {
        if (s == null) return null;
        s = s.trim();
        if (s.isEmpty()) return null;
        return s.length() > n ? s.substring(0, n) : s;
    }
}
