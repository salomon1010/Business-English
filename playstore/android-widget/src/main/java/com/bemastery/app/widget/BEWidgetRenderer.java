package com.bemastery.app.widget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.View;
import android.widget.RemoteViews;

import com.bemastery.app.R;

import java.util.List;

/**
 * BE Mastery — drawing the widget. The same three sizes and the same pieces
 * as the iOS widget (BEWidget.swift): the streak ring whose flame follows the
 * day's mood, today's step by name with its button, the road map as a strip,
 * the words due, this week's goal, the best streak, the phases. RemoteViews
 * cannot draw shapes, so the ring, the strip and the phase bars are bitmaps
 * painted here; everything else is text over gradient drawables.
 *
 * Colours follow the programme (General English indigo → cyan, Welding amber)
 * and the app's own theme, never the system's.
 */
public final class BEWidgetRenderer {
    private BEWidgetRenderer() {}

    static final int SMALL = 0, MEDIUM = 1, LARGE = 2;

    static final class Pal {
        final boolean light, pro;
        final int text, muted, acc, acc2, gold, green, red;
        Pal(boolean light, boolean pro) {
            this.light = light; this.pro = pro;
            if (light) {
                text = 0xFF0F172A; muted = 0xFF586179;
                acc = pro ? 0xFF9B6200 : 0xFF4F46E5; acc2 = pro ? 0xFFC98A0D : 0xFF0891B2;
                gold = 0xFFB45309; green = 0xFF046A4E; red = 0xFFC01C1C;
            } else {
                text = 0xFFE6EAF4; muted = 0xFF98A1B7;
                acc = pro ? 0xFFD49717 : 0xFF6366F1; acc2 = pro ? 0xFFF6C453 : 0xFF22D3EE;
                gold = 0xFFFBBF24; green = 0xFF34D399; red = 0xFFF87171;
            }
        }
        int bg() { return light ? R.drawable.be_widget_bg_light : R.drawable.be_widget_bg_dark; }
        int card() { return light ? R.drawable.be_widget_card_light : R.drawable.be_widget_card_dark; }
        int pill() { return pro ? R.drawable.be_widget_pill_pro : R.drawable.be_widget_pill_ge; }
        int mark() { return pro ? R.drawable.be_widget_mark_pro : R.drawable.be_widget_mark_ge; }
        int muted(int alpha) { return (muted & 0x00FFFFFF) | (alpha << 24); }
    }

    static Pal pal(BEWidgetSnapshot s) { return new Pal(s != null && s.isLight(), s != null && s.isPro()); }

    static int sizeClass(int wDp, int hDp) {
        if (wDp == 0 && hDp == 0) return MEDIUM;
        if (hDp >= 220) return LARGE;
        return wDp >= 240 ? MEDIUM : SMALL;
    }

    public static RemoteViews build(Context c, BEWidgetSnapshot s, int wDp, int hDp, long now) {
        return build(c, s, wDp, hDp, now, null);
    }

    /** `area` is the widget's own programme (null = follows the open one); it only colours and words the empty state. */
    public static RemoteViews build(Context c, BEWidgetSnapshot s, int wDp, int hDp, long now, String area) {
        int cls = sizeClass(wDp, hDp);
        /* small: signed in; medium and large: Premium (owner, 6 Oct 2026) */
        int lock = BEWidgetSnapshot.lockOf(s, cls == SMALL ? "small" : "full");
        if (lock != BEWidgetSnapshot.LOCK_NONE) return locked(c, s, lock, cls == SMALL ? GHOST_SMALL : GHOST_ROAD, wDp, hDp, area);
        if (s == null) return empty(c, cls, wDp, area);
        switch (cls) {
            case SMALL: return small(c, s, now, wDp);
            case LARGE: return large(c, s, now, wDp);
            default: return medium(c, s, now, wDp);
        }
    }

    /* Bitmaps are drawn at the width they will be shown at (an ImageView
       stretches them otherwise, which squashes the phase labels); when the
       launcher has not said how wide the widget is, a typical width is used. */
    static int stripWidth(int wDp, int fallback, int minus) { return Math.max(80, (wDp > 0 ? wDp : fallback) - minus); }

    // ---- the three sizes

    static RemoteViews small(Context c, BEWidgetSnapshot s, long now, int wDp) {
        Pal p = pal(s);
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.be_widget_small);
        rv.setInt(R.id.be_root, "setBackgroundResource", p.bg());
        rv.setInt(R.id.be_mark, "setBackgroundResource", p.mark());
        ring(c, rv, s, p, now, 56);
        text(rv, R.id.be_streak_l, s.label("streak", "day streak"), p.muted);
        text(rv, R.id.be_title, s.todayTitle.isEmpty() ? s.programme : s.todayTitle, p.text);
        rv.setImageViewBitmap(R.id.be_strip, strip(c, s.steps, p, stripWidth(wDp, 160, 24), 6));
        text(rv, R.id.be_kicker, s.todayKicker, p.muted);
        rv.setOnClickPendingIntent(R.id.be_root, BEWidgetLaunch.today(c, s));
        return rv;
    }

    static RemoteViews medium(Context c, BEWidgetSnapshot s, long now, int wDp) {
        Pal p = pal(s);
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.be_widget_medium);
        rv.setInt(R.id.be_root, "setBackgroundResource", p.bg());
        ring(c, rv, s, p, now, 72);
        text(rv, R.id.be_streak_l, s.label("streak", "day streak"), p.muted);
        text(rv, R.id.be_eyebrow, (s.label("today", "Today") + "  ·  " + s.todayKicker).toUpperCase(), p.muted);
        text(rv, R.id.be_title, s.todayTitle.isEmpty() ? s.programme : s.todayTitle, p.text);
        text(rv, R.id.be_line, s.moodLine(now), p.muted);
        rv.setInt(R.id.be_cta, "setBackgroundResource", p.pill());
        text(rv, R.id.be_cta, (s.todayCta.isEmpty() ? s.label("open", "Open") : s.todayCta) + "  →", 0xFFFFFFFF);
        if (s.words > 0) {
            rv.setViewVisibility(R.id.be_words, View.VISIBLE);
            rv.setInt(R.id.be_words, "setBackgroundResource", p.card());
            text(rv, R.id.be_words, "▮ " + s.words, p.acc2);
            rv.setOnClickPendingIntent(R.id.be_words, BEWidgetLaunch.words(c));
        } else {
            rv.setViewVisibility(R.id.be_words, View.GONE);
        }
        rv.setImageViewBitmap(R.id.be_strip, strip(c, s.steps, p, stripWidth(wDp, 340, 24 + 72 + 14), 6));
        text(rv, R.id.be_week, weekLine(s), p.muted);
        text(rv, R.id.be_pct, s.overallPct + "%", p.acc2);
        rv.setOnClickPendingIntent(R.id.be_ring_wrap, BEWidgetLaunch.progress(c));
        rv.setOnClickPendingIntent(R.id.be_cta, BEWidgetLaunch.today(c, s));
        rv.setOnClickPendingIntent(R.id.be_road, BEWidgetLaunch.roadmap(c));
        rv.setOnClickPendingIntent(R.id.be_today, BEWidgetLaunch.today(c, s));
        return rv;
    }

    static RemoteViews large(Context c, BEWidgetSnapshot s, long now, int wDp) {
        Pal p = pal(s);
        BEWidgetSnapshot.Mood mood = s.mood(now);
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.be_widget_large);
        rv.setInt(R.id.be_root, "setBackgroundResource", p.bg());
        rv.setInt(R.id.be_mark, "setBackgroundResource", p.mark());
        text(rv, R.id.be_programme, s.programme.isEmpty() ? "BE Mastery" : s.programme, p.text);
        rv.setInt(R.id.be_streak_chip, "setBackgroundResource", p.card());
        int flame = mood == BEWidgetSnapshot.Mood.DONE ? p.gold : mood == BEWidgetSnapshot.Mood.AT_RISK ? p.red : p.acc2;
        text(rv, R.id.be_streak_chip, "▲ " + s.streakShown(now) + " " + s.label("streak", "day streak"), flame);
        rv.setInt(R.id.be_today, "setBackgroundResource", p.card());
        ring(c, rv, s, p, now, 64);
        text(rv, R.id.be_eyebrow, (s.label("today", "Today") + "  ·  " + s.todayKicker).toUpperCase(), p.muted);
        text(rv, R.id.be_title, s.todayTitle, p.text);
        text(rv, R.id.be_line, s.moodLine(now), p.muted);
        rv.setInt(R.id.be_cta, "setBackgroundResource", p.pill());
        text(rv, R.id.be_cta, (s.todayCta.isEmpty() ? s.label("open", "Open") : s.todayCta) + "  →", 0xFFFFFFFF);
        text(rv, R.id.be_road_h, s.label("roadmap", "Road map"), p.text);
        text(rv, R.id.be_sessions, s.overallTotal > 0 ? s.overallDone + " / " + s.overallTotal + " · " + s.overallPct + "%" : "", p.muted);
        int inner = stripWidth(wDp, 340, 28);
        rv.setImageViewBitmap(R.id.be_strip, strip(c, s.steps, p, inner, 8));
        if (s.phases.isEmpty()) rv.setViewVisibility(R.id.be_phases, View.GONE);
        else { rv.setViewVisibility(R.id.be_phases, View.VISIBLE); rv.setImageViewBitmap(R.id.be_phases, phases(c, s.phases, p, inner, 30)); }
        stat(rv, p, R.id.be_stat1, R.id.be_stat1_v, R.id.be_stat1_l, s.goalN + "/" + s.goalOf, s.label("goal", "this week"), p.acc);
        stat(rv, p, R.id.be_stat2, R.id.be_stat2_v, R.id.be_stat2_l, String.valueOf(s.words), s.label("words", "words due"), p.acc2);
        stat(rv, p, R.id.be_stat3, R.id.be_stat3_v, R.id.be_stat3_l, String.valueOf(s.best), s.label("best", "best streak"), p.gold);
        text(rv, R.id.be_quote, "❝ " + (s.line.isEmpty() ? s.label("line", "25 minutes today keeps the streak alive.") : s.line), p.muted);
        rv.setOnClickPendingIntent(R.id.be_today, BEWidgetLaunch.today(c, s));
        rv.setOnClickPendingIntent(R.id.be_cta, BEWidgetLaunch.today(c, s));
        rv.setOnClickPendingIntent(R.id.be_streak_chip, BEWidgetLaunch.progress(c));
        rv.setOnClickPendingIntent(R.id.be_road, BEWidgetLaunch.roadmap(c));
        rv.setOnClickPendingIntent(R.id.be_stat1, BEWidgetLaunch.progress(c));
        rv.setOnClickPendingIntent(R.id.be_stat2, BEWidgetLaunch.words(c));
        rv.setOnClickPendingIntent(R.id.be_stat3, BEWidgetLaunch.progress(c));
        return rv;
    }

    /** A phone that has never opened the app — or that programme: an invitation, not zeros. */
    static RemoteViews empty(Context c, int cls, int wDp, String area) {
        Pal p = new Pal(false, "pro".equals(area));
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.be_widget_empty);
        rv.setInt(R.id.be_root, "setBackgroundResource", p.bg());
        rv.setInt(R.id.be_mark, "setBackgroundResource", p.mark());
        int h = "pro".equals(area) ? R.string.be_widget_name_pro : "ge".equals(area) ? R.string.be_widget_name_ge : R.string.be_widget_empty_h;
        text(rv, R.id.be_title, c.getString(h), p.text);
        text(rv, R.id.be_line, c.getString(area == null ? R.string.be_widget_empty_b : R.string.be_widget_empty_area_b), p.muted);
        rv.setImageViewBitmap(R.id.be_strip, strip(c, null, p, stripWidth(wDp, cls == SMALL ? 160 : 340, 28), 6));
        rv.setOnClickPendingIntent(R.id.be_root, BEWidgetLaunch.home(c));
        return rv;
    }

    // ---- locked: the widget's shape in grey, a lock, one line

    static final int GHOST_SMALL = 0, GHOST_ROAD = 1, GHOST_RECS = 2;

    public static RemoteViews locked(Context c, BEWidgetSnapshot s, int lock, int ghost, int wDp, int hDp, String area) {
        Pal p = s != null ? pal(s) : new Pal(false, "pro".equals(area));
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.be_widget_locked);
        rv.setInt(R.id.be_root, "setBackgroundResource", p.bg());
        rv.setImageViewBitmap(R.id.be_ghost, ghost(c, ghost, wDp > 0 ? wDp : (ghost == GHOST_SMALL ? 160 : 320), hDp > 0 ? hDp : (ghost == GHOST_SMALL ? 160 : 160), p));
        boolean prem = lock == BEWidgetSnapshot.LOCK_PREMIUM;
        rv.setImageViewResource(R.id.be_lock_ic, prem ? R.drawable.be_widget_crown : R.drawable.be_widget_lock);
        rv.setInt(R.id.be_lock_ic, "setColorFilter", prem ? p.gold : p.text);
        String msg = prem ? (s != null ? s.label("lprem", c.getString(R.string.be_widget_lock_prem)) : c.getString(R.string.be_widget_lock_prem))
                          : (s != null ? s.label("lsign", c.getString(R.string.be_widget_lock_signin)) : c.getString(R.string.be_widget_lock_signin));
        text(rv, R.id.be_lock_msg, msg, p.text);
        text(rv, R.id.be_lock_brand, "BE Mastery", p.muted);
        rv.setContentDescription(R.id.be_root, msg);
        rv.setOnClickPendingIntent(R.id.be_root, BEWidgetLaunch.unlock(c, prem));
        return rv;
    }

    /** A grey, faded drawing of the widget's own layout, so the learner sees what the lock keeps. */
    static Bitmap ghost(Context c, int kind, int wDp, int hDp, Pal p) {
        int w = px(c, wDp), h = px(c, hDp);
        Bitmap b = Bitmap.createBitmap(Math.max(1, w), Math.max(1, h), Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        Paint g = new Paint(Paint.ANTI_ALIAS_FLAG);
        g.setColor(p.muted(0x2A));
        float pad = px(c, 14), r = px(c, 8);
        if (kind == GHOST_RECS) {
            cv.drawRoundRect(new RectF(pad, pad, pad + w * 0.45f, pad + px(c, 12)), r, r, g);
            float top = pad + px(c, 26), rowH = px(c, 48), gap = px(c, 8);
            for (float y = top; y + rowH <= h - pad / 2; y += rowH + gap) {
                cv.drawRoundRect(new RectF(pad, y, w - pad, y + rowH), r * 1.5f, r * 1.5f, g);
                Paint d = new Paint(Paint.ANTI_ALIAS_FLAG); d.setColor(p.muted(0x40));
                cv.drawRoundRect(new RectF(pad + px(c, 6), y + px(c, 6), pad + px(c, 82), y + rowH - px(c, 6)), r, r, d);
                cv.drawRoundRect(new RectF(pad + px(c, 92), y + px(c, 12), w - pad * 3, y + px(c, 20)), r, r, d);
                cv.drawRoundRect(new RectF(pad + px(c, 92), y + px(c, 26), w * 0.62f, y + px(c, 34)), r, r, d);
            }
        } else {
            float ring = kind == GHOST_SMALL ? px(c, 56) : px(c, 70);
            Paint st = new Paint(Paint.ANTI_ALIAS_FLAG); st.setStyle(Paint.Style.STROKE); st.setStrokeWidth(ring * 0.09f); st.setColor(p.muted(0x40));
            cv.drawCircle(pad + ring / 2, pad + ring / 2, ring / 2 - ring * 0.05f, st);
            float x0 = kind == GHOST_SMALL ? pad : pad + ring + px(c, 14);
            float y0 = kind == GHOST_SMALL ? pad + ring + px(c, 14) : pad + px(c, 6);
            cv.drawRoundRect(new RectF(x0, y0, w - pad * 2, y0 + px(c, 10)), r, r, g);
            cv.drawRoundRect(new RectF(x0, y0 + px(c, 18), w * 0.7f, y0 + px(c, 26)), r, r, g);
            cv.drawRoundRect(new RectF(pad, h - pad - px(c, 6), w - pad, h - pad), r, r, g);
            if (h > px(c, 260)) {   // the large widget: today's card, the road map, three stat tiles
                float y = pad + ring + px(c, 22);
                cv.drawRoundRect(new RectF(pad, y, w - pad, y + px(c, 8)), r, r, g);
                float ty = y + px(c, 26), tw = (w - pad * 2 - px(c, 16)) / 3f;
                for (int i = 0; i < 3; i++) cv.drawRoundRect(new RectF(pad + i * (tw + px(c, 8)), ty, pad + i * (tw + px(c, 8)) + tw, ty + px(c, 52)), r * 1.5f, r * 1.5f, g);
                cv.drawRoundRect(new RectF(pad, ty + px(c, 70), w * 0.75f, ty + px(c, 78)), r, r, g);
            }
        }
        return b;
    }

    // ---- pieces

    static void text(RemoteViews rv, int id, CharSequence t, int color) {
        rv.setTextViewText(id, t == null ? "" : t);
        rv.setTextColor(id, color);
    }

    static void stat(RemoteViews rv, Pal p, int box, int v, int l, String value, String label, int tint) {
        rv.setInt(box, "setBackgroundResource", p.card());
        text(rv, v, value, p.text);
        text(rv, l, label, p.muted);
        rv.setTextColor(v, p.text);
    }

    static String weekLine(BEWidgetSnapshot s) {
        if (s.weekN <= 0 || s.weekTotal <= 0) return s.label("roadmap", "Road map");
        return s.label("unit", "Week") + " " + s.weekN + " / " + s.weekTotal;
    }

    static void ring(Context c, RemoteViews rv, BEWidgetSnapshot s, Pal p, long now, int dp) {
        BEWidgetSnapshot.Mood mood = s.mood(now);
        int flame = mood == BEWidgetSnapshot.Mood.DONE ? p.gold : mood == BEWidgetSnapshot.Mood.AT_RISK ? p.red
                : mood == BEWidgetSnapshot.Mood.PENDING ? p.acc2 : p.muted;
        rv.setImageViewBitmap(R.id.be_ring, ringBitmap(c, dp, s.weekProgress(), p, flame));
        text(rv, R.id.be_streak_n, String.valueOf(s.streakShown(now)), p.text);
    }

    static int px(Context c, float dp) { return Math.round(dp * c.getResources().getDisplayMetrics().density); }

    /** The week's goal as a ring, the flame above the number's place. */
    static Bitmap ringBitmap(Context c, int dp, float progress, Pal p, int flameColor) {
        int size = px(c, dp);
        Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        float stroke = size * 0.09f;
        RectF r = new RectF(stroke / 2, stroke / 2, size - stroke / 2, size - stroke / 2);
        Paint pt = new Paint(Paint.ANTI_ALIAS_FLAG);
        pt.setStyle(Paint.Style.STROKE);
        pt.setStrokeWidth(stroke);
        pt.setStrokeCap(Paint.Cap.ROUND);
        pt.setColor(p.muted(0x2E));
        cv.drawArc(r, 0, 360, false, pt);
        if (progress > 0) {
            pt.setShader(new LinearGradient(0, 0, size, size, p.acc, p.acc2, Shader.TileMode.CLAMP));
            cv.drawArc(r, -90, 360 * Math.min(1f, progress), false, pt);
            pt.setShader(null);
        }
        // the flame: a teardrop with a brighter heart
        float cx = size / 2f, top = size * 0.22f, bottom = size * 0.50f, w = size * 0.17f, h = bottom - top;
        Paint fp = new Paint(Paint.ANTI_ALIAS_FLAG);
        fp.setColor(flameColor);
        cv.drawPath(flame(cx, top, bottom, w), fp);
        fp.setColor(0x99FFFFFF);
        float ih = h * 0.45f, ib = bottom - h * 0.08f;
        cv.drawPath(flame(cx, ib - ih, ib, w * 0.45f), fp);
        return b;
    }

    static Path flame(float cx, float top, float bottom, float w) {
        float h = bottom - top;
        Path f = new Path();
        f.moveTo(cx, top);
        f.cubicTo(cx + w * 0.15f, top + h * 0.40f, cx + w, bottom - h * 0.42f, cx + w * 0.78f, bottom - h * 0.10f);
        f.quadTo(cx, bottom + h * 0.18f, cx - w * 0.78f, bottom - h * 0.10f);
        f.cubicTo(cx - w, bottom - h * 0.42f, cx - w * 0.15f, top + h * 0.40f, cx, top);
        f.close();
        return f;
    }

    /** The road map: one capsule per unit — lit behind, a beacon here, dim ahead. */
    static Bitmap strip(Context c, List<String> steps, Pal p, int wDp, int hDp) {
        int n = steps == null || steps.isEmpty() ? 12 : steps.size();
        int w = px(c, wDp), h = px(c, hDp);
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        float gap = px(c, 3), seg = (w - gap * (n - 1)) / n, r = h / 2f;
        Paint pt = new Paint(Paint.ANTI_ALIAS_FLAG);
        for (int i = 0; i < n; i++) {
            String st = steps == null || steps.isEmpty() ? "locked" : steps.get(i);
            float x = i * (seg + gap);
            RectF rr = new RectF(x, 0, x + seg, h);
            if ("done".equals(st)) {
                pt.setShader(new LinearGradient(x, 0, x + seg, 0, p.acc, p.acc2, Shader.TileMode.CLAMP));
                cv.drawRoundRect(rr, r, r, pt);
                pt.setShader(null);
            } else if ("now".equals(st)) {
                pt.setColor(p.acc);
                cv.drawRoundRect(rr, r, r, pt);
                pt.setColor(0xFFFFFFFF);
                cv.drawCircle(x + seg / 2, h / 2f, h * 0.3f, pt);
            } else {
                pt.setColor(p.muted("next".equals(st) ? 0x61 : 0x29));
                cv.drawRoundRect(rr, r, r, pt);
            }
        }
        return b;
    }

    /** Up to four phases: a label and a thin bar each. */
    static Bitmap phases(Context c, List<String[]> ph, Pal p, int wDp, int hDp) {
        int w = px(c, wDp), h = px(c, hDp), n = Math.max(1, ph.size());
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        float gap = px(c, 8), col = (w - gap * (n - 1)) / n, barH = px(c, 4);
        Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG);
        tp.setColor(p.muted);
        tp.setTextSize(px(c, 10));
        tp.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        Paint bp = new Paint(Paint.ANTI_ALIAS_FLAG);
        for (int i = 0; i < n; i++) {
            String[] it = ph.get(i);
            float x = i * (col + gap);
            String label = it[0];
            while (label.length() > 1 && tp.measureText(label) > col) label = label.substring(0, label.length() - 1);
            cv.drawText(label, x, px(c, 12), tp);
            RectF track = new RectF(x, h - barH, x + col, h);
            bp.setColor(p.muted(0x29));
            cv.drawRoundRect(track, barH / 2, barH / 2, bp);
            int pct; try { pct = Math.max(0, Math.min(100, Integer.parseInt(it[1]))); } catch (Exception e) { pct = 0; }
            if (pct > 0) {
                RectF fill = new RectF(x, h - barH, x + col * pct / 100f, h);
                if ("done".equals(it[2])) bp.setColor(p.green);
                else bp.setShader(new LinearGradient(x, 0, x + col, 0, p.acc, p.acc2, Shader.TileMode.CLAMP));
                cv.drawRoundRect(fill, barH / 2, barH / 2, bp);
                bp.setShader(null);
            }
        }
        return b;
    }
}
