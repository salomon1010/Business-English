/* be-widget — the feed behind the Android home-screen widget (5 Oct 2026).
   Run the tests: node backend/widget/test/run.mjs

   WHY A WORKER AT ALL. On iOS the app and its widget share an App Group, so
   the app writes a snapshot and the widget reads it — no network. The Android
   app is a Trusted Web Activity: the web page runs inside Chrome, in Chrome's
   process, and the TWA library keeps the browser session private, so there is
   no supported channel from the page to our own app on the same phone. The
   page therefore publishes the SAME snapshot here, keyed by a random id the
   Android app minted and handed to the page on the launch URL (?wid=…, the
   documented "query parameters" pattern), and the widget pulls it back.

   WHAT IS STORED. Exactly what the iOS widget shows and nothing else: the
   learner's own progress numbers, the day's title and button text, the road
   map as a row of states, translated labels. shapeSnap() drops every key not
   on the allow-list and caps every string, so nothing personal can be parked
   here even by a future client. No name, no email, no uid, no transcript.
   The id is random and unlinked to any account. Rows are purged after 30 days
   opportunistically (no cron: the account is at its cron-trigger limit).

   One D1 table, one row per widget id AND programme (General English /
   Welding — a phone may carry one widget of each, drawn from the last
   snapshot published while that programme was open), an hourly write counter
   in the row. Nothing is logged. */

const WID_RE = /^[a-f0-9]{32}$/;
const MAX_BYTES = 16_384;
const WRITES_PER_HOUR = 60;
const KEEP_MS = 30 * 86_400_000;
const ORIGINS = ["https://app.lomonec.com", "https://staging.lomonec.com", "capacitor://localhost", "https://localhost"];   // https://localhost = the Android shell (mobile/android)

/* ---- the snapshot, reduced to what the widget draws (mirrors
   BEWidgetSnapshot in mobile/ios/ios/App/BEWidget/BEWidgetModel.swift) */
const STEP_STATES = new Set(["done", "now", "next", "locked"]);
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, n) : undefined);
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : undefined);
const obj = (v, f) => (v && typeof v === "object" && !Array.isArray(v) ? f(v) : undefined);
const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const REC_VIEWS = new Set(["session", "practice", "shadow", "partner", "phrases", "phrasebank", "roleplay", "mastery"]);
/* "mastery" (Welding Mastery): today's shift or one of its eight games */
const REC_ACTS = new Set(["clip", "trouble", "study-due", "ai", "shift", "cards", "quiz", "crossword", "visual", "listen", "builder", "match", "workshop"]);
const REC_IMG = /^(https:\/\/(i\.ytimg\.com|img\.youtube\.com)\/vi\/[A-Za-z0-9_-]{11}\/[a-z]+\.jpg|(home-shots|rp-photos)\/[A-Za-z0-9_-]{1,60}\.jpg)$/;
export function shapeSnap(s) {
  if (!s || typeof s !== "object" || Array.isArray(s) || s.v !== 1) return null;
  const out = clean({
    v: 1,
    at: int(s.at, 0, 4e12),
    lang: str(s.lang, 8), dir: s.dir === "rtl" ? "rtl" : "ltr",
    theme: s.theme === "light" ? "light" : "dark",
    area: s.area === "pro" ? "pro" : "ge",
    programme: str(s.programme, 60),
    streak: int(s.streak, 0, 9999), best: int(s.best, 0, 9999),
    lastDay: typeof s.lastDay === "string" && /^(\d{4}-\d{2}-\d{2})?$/.test(s.lastDay) ? s.lastDay : "",
    week: obj(s.week, w => clean({ n: int(w.n, 0, 99), total: int(w.total, 0, 99), done: int(w.done, 0, 99), per: int(w.per, 0, 14), title: str(w.title, 120) })),
    overall: obj(s.overall, o => clean({ done: int(o.done, 0, 9999), total: int(o.total, 0, 9999), pct: int(o.pct, 0, 100) })),
    weekGoal: obj(s.weekGoal, g => clean({ n: int(g.n, 0, 99), goal: int(g.goal, 0, 99) })),
    words: int(s.words, 0, 99_999),
    today: obj(s.today, t => clean({ kind: str(t.kind, 16), kicker: str(t.kicker, 80), title: str(t.title, 160), cta: str(t.cta, 60),
      view: str(t.view, 20), w: int(t.w, 1, 99), d: str(t.d, 3), act: str(t.act, 16) })),
    steps: Array.isArray(s.steps) ? s.steps.slice(0, 40).map(x => (STEP_STATES.has(x) ? x : "locked")) : undefined,
    phases: Array.isArray(s.phases) ? s.phases.slice(0, 6).map(p => clean({ label: str(p && p.label, 40), pct: int(p && p.pct, 0, 100), state: str(p && p.state, 10) })) : undefined,
    line: str(s.line, 160),
    /* who may use which widget (owner, 6 Oct 2026): three booleans, nothing else */
    gate: obj(s.gate, g => ({ signedIn: g.signedIn === true, full: g.full === true, recs: g.recs === true })),
    /* the Recommendations widget's list: text, a kind, a picture from an allowed
       place (YouTube's thumbnail host, or one of the app's own bundled pictures),
       and the place a tap opens as nudgeGo takes it */
    recs: Array.isArray(s.recs) ? s.recs.slice(0, 12).map(r => r && typeof r === "object" ? clean({
      t: str(r.t, 90), s: str(r.s, 80), why: str(r.why, 90), k: str(r.k, 16),
      img: typeof r.img === "string" && REC_IMG.test(r.img) ? r.img : undefined,
      min: int(r.min, 0, 600), ext: r.ext === true ? true : undefined,
      go: obj(r.go, g => clean({ view: REC_VIEWS.has(g.view) ? g.view : undefined, act: REC_ACTS.has(g.act) ? g.act : undefined,
        a: Array.isArray(g.a) ? g.a.slice(0, 3).filter(x => typeof x === "string" && /^[A-Za-z0-9_.:-]{1,40}$/.test(x)) : undefined, ch: g.ch === true ? true : undefined })),
    }) : null).filter(Boolean) : undefined,
    /* the Welding Mastery widget's block (9 Oct 2026): numbers, one shift title, a few labels — nothing else */
    wm: s.area === "pro" ? obj(s.wm, w => clean({
      m: int(w.m, 0, 9999), total: int(w.total, 0, 9999), lvl: int(w.lvl, 1, 999), xp: int(w.xp, 0, 9_999_999), need: int(w.need, 0, 9_999_999),
      pct: int(w.pct, 0, 100), streak: int(w.streak, 0, 9999), next: str(w.next, 40),
      shift: obj(w.shift, x => clean({ t: str(x.t, 80), p: int(x.p, 0, 99), n: int(x.n, 0, 99), done: x.done === true })),
      labels: obj(w.labels, L => Object.fromEntries(Object.entries(L).slice(0, 12).filter(([k, v]) => /^[a-z]{1,16}$/.test(k) && typeof v === "string").map(([k, v]) => [k, str(v, 60)]))),
    })) : undefined,
    /* the game streak countdown (10 Oct 2026, the Play app's BEStreakCountdown): which
       hub, its own translated words, the streak, the end of the game day, done or not */
    live: obj(s.live, x => {
      const prog = x.prog === "welding" || x.prog === "general-english" ? x.prog : undefined;
      return prog ? clean({ prog, title: str(x.title, 60), line: str(x.line, 120), doneLine: str(x.doneLine, 80),
        streak: int(x.streak, 0, 9999), deadline: int(x.deadline, 0, 4e12), done: x.done === true }) : undefined;
    }),
    labels: obj(s.labels, L => Object.fromEntries(Object.entries(L).slice(0, 24).filter(([k, v]) => /^[a-z]{1,16}$/.test(k) && typeof v === "string").map(([k, v]) => [k, str(v, 80)]))),
  });
  const json = JSON.stringify(out);
  return json.length <= MAX_BYTES ? out : null;
}

/* ---- plumbing */
function origins(env) { return ORIGINS.concat(String((env && env.EXTRA_ORIGINS) || "").split(",").map(s => s.trim()).filter(Boolean)); }
function allowed(origin, env) {
  if (!origin) return true;                                   // the widget itself: no Origin header, no CORS
  if (origins(env).includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);   // local tests
}
function cors(origin) {
  return origin ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET,POST,DELETE,OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "origin" } : {};
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(origin) } });
}

export async function handle(req, env, now = Date.now()) {
  const origin = req.headers.get("origin") || "";
  if (!allowed(origin, env)) return json({ error: "origin" }, 403, "");
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (url.pathname !== "/feed") return json({ error: "not found" }, 404, origin);

  /* GET: every programme's last snapshot for this id in one answer — `snap`/
     `at`/`area` are the most recent of them (the "follows the open programme"
     widget), `areas.ge` / `areas.pro` the per-programme widgets'. */
  if (req.method === "GET") {
    const wid = url.searchParams.get("wid") || "";
    if (!WID_RE.test(wid)) return json({ error: "wid" }, 400, origin);
    const rows = (await env.DB.prepare("SELECT area, snap, at FROM feeds WHERE wid = ? AND at > ?").bind(wid, now - KEEP_MS).all()).results || [];
    const areas = {}; let latest = null;
    for (const r of rows) {
      let snap = null; try { snap = JSON.parse(r.snap); } catch (e) { continue; }
      areas[r.area] = { snap, at: r.at };
      if (!latest || r.at > latest.at) latest = { snap, at: r.at, area: r.area };
    }
    if (!latest) return json({ error: "none" }, 404, origin);
    return json({ snap: latest.snap, at: latest.at, area: latest.area, areas }, 200, origin);
  }

  if (req.method === "DELETE") {
    const wid = url.searchParams.get("wid") || "";
    if (!WID_RE.test(wid)) return json({ error: "wid" }, 400, origin);
    await env.DB.prepare("DELETE FROM feeds WHERE wid = ?").bind(wid).run();
    return json({ ok: true }, 200, origin);
  }

  if (req.method === "POST") {
    const len = +(req.headers.get("content-length") || 0);
    if (len > MAX_BYTES * 2) return json({ error: "too large" }, 413, origin);
    let text = ""; try { text = await req.text(); } catch (e) { return json({ error: "body" }, 400, origin); }
    if (text.length > MAX_BYTES * 2) return json({ error: "too large" }, 413, origin);
    let b = null; try { b = JSON.parse(text); } catch (e) { return json({ error: "json" }, 400, origin); }
    const wid = b && typeof b.wid === "string" ? b.wid : "";
    if (!WID_RE.test(wid)) return json({ error: "wid" }, 400, origin);
    const snap = shapeSnap(b && b.snap);
    if (!snap) return json({ error: "snapshot" }, 400, origin);
    const area = snap.area, hour = Math.floor(now / 3_600_000);
    const prev = await env.DB.prepare("SELECT writes, hour FROM feeds WHERE wid = ? AND area = ?").bind(wid, area).first();
    const writes = prev && prev.hour === hour ? prev.writes + 1 : 1;
    if (writes > WRITES_PER_HOUR) return json({ error: "rate" }, 429, origin);
    await env.DB.prepare("INSERT INTO feeds (wid, area, snap, at, writes, hour) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(wid, area) DO UPDATE SET snap = excluded.snap, at = excluded.at, writes = excluded.writes, hour = excluded.hour")
      .bind(wid, area, JSON.stringify(snap), now, writes, hour).run();
    /* no cron on this account: every fiftieth write sweeps what nobody has refreshed in 30 days */
    if (Math.random() < 0.02) { try { await env.DB.prepare("DELETE FROM feeds WHERE at < ?").bind(now - KEEP_MS).run(); } catch (e) {} }
    return json({ ok: true, at: now }, 200, origin);
  }
  return json({ error: "method" }, 405, origin);
}

export default { fetch: (req, env) => handle(req, env) };
