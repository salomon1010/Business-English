package com.bemastery.app.widget;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.RemoteViews;
import android.widget.ScrollView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Debug only — see src/debug/AndroidManifest.xml. */
public class BEWidgetPreviewActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String mood = getIntent().getStringExtra("mood");
        boolean light = getIntent().getBooleanExtra("light", false);
        boolean pro = getIntent().getBooleanExtra("pro", false);
        boolean empty = getIntent().getBooleanExtra("empty", false);
        /* "free": signed in without Premium; "out": signed out (6 Oct 2026, the widget locks) */
        String gate = getIntent().getStringExtra("gate");
        long now = System.currentTimeMillis();
        /* "risk" needs an evening: pretend it is 20:00 local today; "pending" a morning (09:00) */
        if ("risk".equals(mood) || "pending".equals(mood)) {
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.setTimeInMillis(now);
            cal.set(java.util.Calendar.HOUR_OF_DAY, "risk".equals(mood) ? 20 : 9);
            cal.set(java.util.Calendar.MINUTE, 0);
            now = cal.getTimeInMillis();
        }
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        String today = f.format(new Date(now)), yesterday = f.format(new Date(now - 86_400_000L)), old = f.format(new Date(now - 5 * 86_400_000L));
        String lastDay = "risk".equals(mood) || "pending".equals(mood) ? yesterday : "cold".equals(mood) ? old : today;
        String json = "{\"v\":1,\"at\":0,\"lang\":\"en\",\"dir\":\"ltr\",\"theme\":\"" + (light ? "light" : "dark") + "\",\"area\":\"" + (pro ? "pro" : "ge") + "\","
            + "\"programme\":\"" + (pro ? "Welding English" : "General English") + "\",\"streak\":12,\"best\":21,\"lastDay\":\"" + lastDay + "\","
            + "\"week\":{\"n\":3,\"total\":12,\"done\":2,\"per\":7,\"title\":\"Clear updates\"},\"overall\":{\"done\":16,\"total\":84,\"pct\":19},\"weekGoal\":{\"n\":3,\"goal\":6},\"words\":7,"
            + "\"today\":{\"kind\":\"week\",\"kicker\":\"Week 3 · Tuesday\",\"title\":\"Give a clear status update\",\"cta\":\"Continue Week 3\",\"view\":\"session\",\"w\":3,\"d\":\"Tue\"},"
            + "\"steps\":[\"done\",\"done\",\"now\",\"next\",\"locked\",\"locked\",\"locked\",\"locked\",\"locked\",\"locked\",\"locked\",\"locked\"],"
            + "\"phases\":[{\"label\":\"Foundations\",\"pct\":100,\"state\":\"done\"},{\"label\":\"Fluency\",\"pct\":30,\"state\":\"now\"},{\"label\":\"Influence\",\"pct\":0,\"state\":\"locked\"}],"
            + ("free".equals(gate) ? "\"gate\":{\"signedIn\":true,\"full\":false,\"recs\":false}," : "")
            + "\"line\":\"25 minutes today keeps the streak alive.\",\"labels\":{\"streak\":\"day streak\",\"today\":\"Today\",\"words\":\"words due\",\"goal\":\"this week\",\"best\":\"best streak\",\"roadmap\":\"Road map\",\"unit\":\"Week\",\"open\":\"Open\"}}";
        BEWidgetSnapshot s = empty || "out".equals(gate) ? null : BEWidgetSnapshot.parse(json);
        area = empty ? (pro ? "pro" : getIntent().getStringExtra("area")) : null;   // an empty fixed-programme widget names its programme

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        col.setBackgroundColor(light ? 0xFFDDE3F0 : 0xFF2A3350);
        int pad = dp(16);
        col.setPadding(pad, pad, pad, pad);
        add(col, s, now, 160, 160);
        add(col, s, now, 340, 160);
        add(col, s, now, 340, 360);
        if (gate != null) {   // the Recommendations widget, locked
            int lock = BEWidgetSnapshot.lockOf(s, "recs");
            if (lock != BEWidgetSnapshot.LOCK_NONE) addRv(col, BEWidgetRenderer.locked(this, s, lock, BEWidgetRenderer.GHOST_RECS, 340, 200, null), 340, 200);
        }
        ScrollView sv = new ScrollView(this);
        sv.addView(col);
        setContentView(sv);
    }

    private String area;

    private void add(LinearLayout col, BEWidgetSnapshot s, long now, int wDp, int hDp) {
        addRv(col, BEWidgetRenderer.build(this, s, wDp, hDp, now, area), wDp, hDp);
    }

    private void addRv(LinearLayout col, RemoteViews rv, int wDp, int hDp) {
        FrameLayout host = new FrameLayout(this);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(wDp), dp(hDp));
        lp.bottomMargin = dp(16);
        host.setLayoutParams(lp);
        View v = rv.apply(this, host);
        host.addView(v, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        col.addView(host);
    }

    private int dp(int d) { return Math.round(d * getResources().getDisplayMetrics().density); }
}
