package com.bemastery.app.widget;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import com.bemastery.app.R;

/**
 * BE Mastery — the two directions of the widget's only channel.
 *
 * OUT: the Play app is a Trusted Web Activity, so it can hand the page nothing
 * but the launch URL. {@link #decorate} appends {@code ?wid=<widget id>} to
 * every launch (Chrome's documented "query parameters" pattern); index.html
 * reads it once, strips it, and from then on publishes its snapshot to
 * be-widget under that id.
 *
 * IN: a tap on the widget opens the app on the thing it showed —
 * {@code ?widget=1#session/3/Tue}, {@code ?widget=words#practice},
 * {@code ?widget=1#journey} — through the same LauncherActivity, which
 * accepts an https URL of its own host as the page to open.
 */
public final class BEWidgetLaunch {
    private BEWidgetLaunch() {}

    public static Uri decorate(Context c, Uri uri) {
        if (uri == null || uri.getQueryParameter("wid") != null) return uri;
        try {
            return uri.buildUpon().appendQueryParameter("wid", BEWidgetStore.wid(c)).build();
        } catch (Exception e) {
            return uri;
        }
    }

    /** {@code https://host/?widget=<act>#<hash>} */
    public static Uri target(Context c, String act, String hash) {
        String base = c.getString(R.string.launchUrl);
        if (!base.endsWith("/")) base = base + "/";
        return Uri.parse(base + "?widget=" + act + (hash == null || hash.isEmpty() ? "" : "#" + hash));
    }

    public static PendingIntent open(Context c, int requestCode, String act, String hash) {
        Intent i = new Intent(Intent.ACTION_VIEW, target(c, act, hash));
        i.setClassName(c.getPackageName(), c.getPackageName() + ".LauncherActivity");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(c, requestCode, i, flags);
    }

    /** Today's step: the session the snapshot names, else the road map. */
    public static PendingIntent today(Context c, BEWidgetSnapshot s) {
        if (s != null && "session".equals(s.todayView) && s.todayWeek > 0 && !s.todayDay.isEmpty())
            return open(c, 1, "1", "session/" + s.todayWeek + "/" + s.todayDay);
        if (s != null && "foundations".equals(s.todayView))
            return open(c, 1, "1", s.todayWeek > 0 ? "foundations/" + s.todayWeek : "foundations");
        if (s != null && "practice".equals(s.todayView))
            return open(c, 1, "words", "practice");
        if (s != null && !s.todayView.isEmpty() && !"home".equals(s.todayView))
            return open(c, 1, "1", s.todayView);
        return open(c, 1, "1", "journey");
    }

    public static PendingIntent roadmap(Context c) { return open(c, 2, "1", "journey"); }
    public static PendingIntent words(Context c) { return open(c, 3, "words", "practice"); }
    public static PendingIntent progress(Context c) { return open(c, 4, "1", "review"); }
    public static PendingIntent home(Context c) { return open(c, 5, "1", ""); }
    /** A locked widget: the sign-in sheet, or the Premium offer (owner, 6 Oct 2026). */
    public static PendingIntent unlock(Context c, boolean premium) { return open(c, premium ? 7 : 6, premium ? "premium" : "signin", ""); }

    /** The Recommendations list's tap template: each row fills in its own address (rec()). Mutable, so the fill-in can set the data. */
    public static PendingIntent recTemplate(Context c) {
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setClassName(c.getPackageName(), c.getPackageName() + ".LauncherActivity");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getActivity(c, 8, i, flags);
    }

    /** One recommendation: {@code https://host/?widget=rec&wv=shadow&wa=clip&w0=<vid>&wch=1}. */
    public static Intent rec(Context c, BEWidgetSnapshot.Rec r) {
        String base = c.getString(R.string.launchUrl);
        if (!base.endsWith("/")) base = base + "/";
        Uri.Builder u = Uri.parse(base).buildUpon().appendQueryParameter("widget", "rec").appendQueryParameter("wv", r.view);
        if (!r.act.isEmpty()) u.appendQueryParameter("wa", r.act);
        for (int i = 0; i < r.a.size() && i < 3; i++) u.appendQueryParameter("w" + i, r.a.get(i));
        if (r.ch) u.appendQueryParameter("wch", "1");
        return new Intent().setData(u.build());
    }
}
