package com.bemastery.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import com.bemastery.app.R;

/**
 * BE Mastery — the Recommendations widget (Android), owner 6 Oct 2026.
 *
 * Everything Home recommends, in Home's own order, in a list the learner
 * scrolls; each row a thumbnail, what it is, its title and why it was picked,
 * and a tap that opens exactly that recommendation. Premium only
 * (recommended_content): without it the widget is drawn as a grey ghost with a
 * lock and "Go Premium to unlock this widget"; signed out, "Sign in…".
 * The rows come from {@link BEWidgetRecsService}; the snapshot is the one the
 * road-map widgets use, fetched by {@link BEWidgetFeed}.
 */
public class BEWidgetRecsProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        drawAll(c, mgr, ids);
        final PendingResult result = goAsync();
        final Context app = c.getApplicationContext();
        new Thread(() -> {
            try { if (BEWidgetFeed.refresh(app)) BEWidgetProvider.drawEverything(app); }
            catch (Exception ignored) {}
            finally { result.finish(); }
        }).start();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager mgr, int id, Bundle options) {
        draw(c, mgr, id);
    }

    static int[] ids(Context c) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, BEWidgetRecsProvider.class));
    }

    static void drawAll(Context c, AppWidgetManager mgr, int[] ids) {
        if (ids == null) return;
        for (int id : ids) draw(c, mgr, id);
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.be_recs_list);
    }

    static void draw(Context c, AppWidgetManager mgr, int id) {
        BEWidgetSnapshot s = BEWidgetSnapshot.parse(BEWidgetStore.snapJson(c, null));
        Bundle o = mgr.getAppWidgetOptions(id);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        int lock = BEWidgetSnapshot.lockOf(s, "recs");
        if (lock != BEWidgetSnapshot.LOCK_NONE) {
            mgr.updateAppWidget(id, BEWidgetRenderer.locked(c, s, lock, BEWidgetRenderer.GHOST_RECS, w > 0 ? w : 320, h > 0 ? h : 180, null));
            return;
        }
        BEWidgetRenderer.Pal p = BEWidgetRenderer.pal(s);
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.be_widget_recs);
        rv.setInt(R.id.be_root, "setBackgroundResource", p.bg());
        BEWidgetRenderer.text(rv, R.id.be_recs_h, s.label("recs", c.getString(R.string.be_widget_recs_h)), p.text);
        rv.setTextColor(R.id.be_recs_spark, p.gold);
        BEWidgetRenderer.text(rv, R.id.be_recs_empty, s.label("recnone", c.getString(R.string.be_widget_recs_none)), p.muted);
        Intent svc = new Intent(c, BEWidgetRecsService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));   // one adapter per widget
        rv.setRemoteAdapter(R.id.be_recs_list, svc);
        rv.setEmptyView(R.id.be_recs_list, R.id.be_recs_empty);
        rv.setPendingIntentTemplate(R.id.be_recs_list, BEWidgetLaunch.recTemplate(c));
        rv.setOnClickPendingIntent(R.id.be_recs_h, BEWidgetLaunch.home(c));
        rv.setViewVisibility(R.id.be_recs_empty, s.recs.isEmpty() ? View.VISIBLE : View.GONE);
        mgr.updateAppWidget(id, rv);
    }

    /** Every placed Recommendations widget, from the snapshot on the phone now. */
    static void drawEverything(Context c) {
        drawAll(c, AppWidgetManager.getInstance(c), ids(c));
    }
}
