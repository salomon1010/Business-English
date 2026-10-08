package com.bemastery.app.widget;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import com.bemastery.app.R;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

/**
 * BE Mastery — the rows of the Recommendations widget. Runs off the main
 * thread (RemoteViewsFactory), so each row's picture can be fetched here and
 * kept in the app's cache: YouTube's own thumbnail host over https, or one of
 * the app's bundled pictures read from its own site. Anything else draws the
 * kind's glyph on the programme's colours instead. Nothing is logged.
 */
public class BEWidgetRecsService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) { return new Rows(getApplicationContext()); }

    static final class Rows implements RemoteViewsFactory {
        private final Context c;
        private BEWidgetSnapshot s;
        private List<BEWidgetSnapshot.Rec> recs = new ArrayList<>();
        Rows(Context c) { this.c = c; }

        @Override public void onCreate() {}
        @Override public void onDestroy() {}
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int i) { return i; }
        @Override public boolean hasStableIds() { return false; }
        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getCount() { return recs.size(); }

        @Override public void onDataSetChanged() {
            s = BEWidgetSnapshot.parse(BEWidgetStore.snapJson(c, null));
            recs = (s == null || BEWidgetSnapshot.lockOf(s, "recs") != BEWidgetSnapshot.LOCK_NONE) ? new ArrayList<>() : s.recs;
        }

        @Override public RemoteViews getViewAt(int i) {
            BEWidgetSnapshot.Rec r = recs.get(i);
            BEWidgetRenderer.Pal p = BEWidgetRenderer.pal(s);
            RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.be_widget_rec_item);
            rv.setInt(R.id.be_rec, "setBackgroundResource", p.card());
            String kind = r.s.toUpperCase() + (r.min > 0 ? "  ·  " + r.min + " min" : "");
            BEWidgetRenderer.text(rv, R.id.be_rec_kind, glyph(r.k) + "  " + kind, p.acc2);
            BEWidgetRenderer.text(rv, R.id.be_rec_t, r.t, p.text);
            BEWidgetRenderer.text(rv, R.id.be_rec_why, r.why, p.muted);
            BEWidgetRenderer.text(rv, R.id.be_rec_go, "›", p.muted);
            Bitmap b = thumb(r.img);
            if (b != null) {
                rv.setImageViewBitmap(R.id.be_rec_img, b);
                BEWidgetRenderer.text(rv, R.id.be_rec_ic, "", 0);
            } else {
                rv.setImageViewResource(R.id.be_rec_img, p.pill());
                BEWidgetRenderer.text(rv, R.id.be_rec_ic, glyph(r.k), 0xE6FFFFFF);
            }
            rv.setOnClickFillInIntent(R.id.be_rec, BEWidgetLaunch.rec(c, r));
            return rv;
        }

        static String glyph(String k) {
            switch (k) {
                case "video": return "▶";
                case "challenge": return "◆";
                case "words": return "▤";
                case "trouble": return "≋";
                case "session": return "▶";
                case "phrases": case "roleplay": case "ai": return "❝";
                case "partner": return "◎";
                default: return "✦";
            }
        }

        /** The row's picture, from the cache or fetched once; null when it cannot be had. */
        private Bitmap thumb(String img) {
            if (img == null || img.isEmpty()) return null;
            String url;
            if (img.matches("^https://(i\\.ytimg\\.com|img\\.youtube\\.com)/vi/[A-Za-z0-9_-]{11}/[a-z]+\\.jpg$")) url = img;
            else if (img.matches("^(home-shots|rp-photos)/[A-Za-z0-9_-]{1,60}\\.jpg$")) {
                String base = c.getString(R.string.launchUrl);
                url = (base.endsWith("/") ? base : base + "/") + img;
            } else return null;
            File dir = new File(c.getCacheDir(), "be_widget_thumbs");
            File f = new File(dir, hash(url) + ".jpg");
            try {
                if (!f.exists()) {
                    if (!dir.exists() && !dir.mkdirs()) return null;
                    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setConnectTimeout(6000); conn.setReadTimeout(6000);
                    try {
                        if (conn.getResponseCode() != 200) return null;
                        Bitmap raw;
                        try (InputStream in = conn.getInputStream()) { raw = BitmapFactory.decodeStream(in); }
                        if (raw == null) return null;
                        int w = 240, h = Math.max(1, Math.round(raw.getHeight() * (240f / Math.max(1, raw.getWidth()))));
                        Bitmap small = Bitmap.createScaledBitmap(raw, w, h, true);
                        try (FileOutputStream out = new FileOutputStream(f)) { small.compress(Bitmap.CompressFormat.JPEG, 72, out); }
                    } finally { conn.disconnect(); }
                }
                return BitmapFactory.decodeFile(f.getPath());
            } catch (Exception e) {
                return null;
            }
        }

        static String hash(String s) {
            try {
                byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes("UTF-8"));
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < 12; i++) sb.append(String.format("%02x", d[i]));
                return sb.toString();
            } catch (Exception e) {
                return Integer.toHexString(s.hashCode());
            }
        }
    }
}
