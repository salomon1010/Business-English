package com.bemastery.app.widget;

import android.content.Context;

import com.bemastery.app.R;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import org.json.JSONObject;

/**
 * BE Mastery — fetching the widget's snapshot from be-widget
 * (backend/widget/widget-worker.js). One GET, six seconds, no retries: a
 * failed fetch leaves the last snapshot in place, and a 404 (the page has
 * published nothing for this id, or the learner signed out) clears it so the
 * widget shows its invitation rather than a stale learner.
 *
 * Nothing is logged.
 */
public final class BEWidgetFeed {
    private BEWidgetFeed() {}

    /** True when the stored snapshot changed (fetched or cleared). */
    public static boolean refresh(Context c) {
        String api = c.getString(R.string.be_widget_api);
        if (api == null || api.isEmpty() || !api.startsWith("https://")) return false;
        String wid = BEWidgetStore.wid(c);
        HttpURLConnection conn = null;
        try {
            URL u = new URL(api + "/feed?wid=" + wid);
            conn = (HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setRequestProperty("Accept", "application/json");
            conn.setUseCaches(false);
            int code = conn.getResponseCode();
            if (code == 404) {
                boolean had = BEWidgetStore.snapJson(c, null) != null;
                BEWidgetStore.clear(c);
                return had;
            }
            if (code != 200) return false;
            InputStream in = conn.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[4096];
            int n, total = 0;
            while ((n = in.read(b)) > 0) {
                total += n;
                if (total > 80_000) return false;
                buf.write(b, 0, n);
            }
            JSONObject body = new JSONObject(buf.toString("UTF-8"));
            /* one answer carries the latest snapshot and each programme's last
               (the General English and Welding widgets read their own) */
            boolean changed = store(c, null, body.optJSONObject("snap"), body.optLong("at", System.currentTimeMillis()));
            JSONObject areas = body.optJSONObject("areas");
            if (areas != null) for (String a : BEWidgetStore.AREAS) {
                JSONObject row = areas.optJSONObject(a);
                if (row != null) changed |= store(c, a, row.optJSONObject("snap"), row.optLong("at", 0L));
            }
            return changed;
        } catch (Exception e) {
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static boolean store(Context c, String area, JSONObject snap, long at) {
        if (snap == null || BEWidgetSnapshot.parse(snap.toString()) == null) return false;
        String json = snap.toString();
        boolean changed = !json.equals(BEWidgetStore.snapJson(c, area));
        BEWidgetStore.put(c, area, json, at);
        return changed;
    }
}
