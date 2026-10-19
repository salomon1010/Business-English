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

    /* THE NATIVE SHELL (mobile/android, 11 Oct 2026) builds these same sources, but it has
       no LauncherActivity and no launchUrl: the page lives inside the app. There a tap opens
       MainActivity with the iPhone's own deep link, bemastery://open?view=…, which
       BEWidgetPlugin hands to the page (widgetOpenRoute). Decided at run time from the
       resources, so one set of sources serves both builds. */
    static String launchUrl(Context c) {
        int id = c.getResources().getIdentifier("launchUrl", "string", c.getPackageName());
        return id == 0 ? null : c.getString(id);
    }

    public static boolean shell(Context c) { return launchUrl(c) == null; }

    /** Where the app's own pictures (home-shots/, rp-photos/) can be fetched. */
    public static String webBase(Context c) {
        String base = launchUrl(c);
        if (base == null) base = "https://app.lomonec.com/bemastery/";
        return base.endsWith("/") ? base : base + "/";
    }

    private static String activity(Context c) { return c.getPackageName() + (shell(c) ? ".MainActivity" : ".LauncherActivity"); }

    /** The TWA's (act, hash) as the shell's {@code bemastery://open?view=&w=&d=&act=}. */
    static Uri shellTarget(String act, String hash) {
        String[] p = (hash == null ? "" : hash).split("/");
        String view = p.length > 0 && !p[0].isEmpty() ? p[0] : "home";
        Uri.Builder u = new Uri.Builder().scheme("bemastery").authority("open").appendQueryParameter("view", view);
        if (p.length > 1) u.appendQueryParameter("w", p[1]);
        if (p.length > 2) u.appendQueryParameter("d", p[2]);
        if (act != null && !act.isEmpty() && !"1".equals(act)) u.appendQueryParameter("act", act);
        return u.build();
    }

    /** {@code https://host/?widget=<act>#<hash>} (TWA) or {@code bemastery://open?…} (shell) */
    public static Uri target(Context c, String act, String hash) {
        String base = launchUrl(c);
        if (base == null) return shellTarget(act, hash);
        if (!base.endsWith("/")) base = base + "/";
        return Uri.parse(base + "?widget=" + act + (hash == null || hash.isEmpty() ? "" : "#" + hash));
    }

    public static PendingIntent open(Context c, int requestCode, String act, String hash) {
        Intent i = new Intent(Intent.ACTION_VIEW, target(c, act, hash));
        i.setClassName(c.getPackageName(), activity(c));
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
        i.setClassName(c.getPackageName(), activity(c));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getActivity(c, 8, i, flags);
    }

    /** One recommendation: {@code https://host/?widget=rec&wv=shadow&wa=clip&w0=<vid>&wch=1}. */
    public static Intent rec(Context c, BEWidgetSnapshot.Rec r) {
        if (shell(c)) {   /* the iPhone's form: bemastery://open?rec=1&view=&act=&a0=&ch=1 */
            Uri.Builder u = new Uri.Builder().scheme("bemastery").authority("open").appendQueryParameter("rec", "1").appendQueryParameter("view", r.view);
            if (!r.act.isEmpty()) u.appendQueryParameter("act", r.act);
            for (int i = 0; i < r.a.size() && i < 3; i++) u.appendQueryParameter("a" + i, r.a.get(i));
            if (r.ch) u.appendQueryParameter("ch", "1");
            return new Intent().setData(u.build());
        }
        Uri.Builder u = Uri.parse(webBase(c)).buildUpon().appendQueryParameter("widget", "rec").appendQueryParameter("wv", r.view);
        if (!r.act.isEmpty()) u.appendQueryParameter("wa", r.act);
        for (int i = 0; i < r.a.size() && i < 3; i++) u.appendQueryParameter("w" + i, r.a.get(i));
        if (r.ch) u.appendQueryParameter("wch", "1");
        return new Intent().setData(u.build());
    }
}
