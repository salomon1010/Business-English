/* be-widget, in process.   Run: node backend/widget/test/run.mjs
   The Worker's routes against an in-memory SQLite standing in for D1 (the
   migration applied as written), with a fixed clock. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handle, shapeSnap } from "../widget-worker.js";

const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };

function d1() {
  const db = new DatabaseSync(":memory:");
  for (const m of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../migrations/" + m, import.meta.url), "utf8"));
  return { raw: db, prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
}
const env = { DB: d1(), EXTRA_ORIGINS: "https://staging.lomonec.com" };
const T0 = Date.UTC(2026, 9, 5, 12, 0);
const WID = "a".repeat(32), WID2 = "b".repeat(32);
const SNAP = { v: 1, at: T0, lang: "fr", dir: "ltr", theme: "dark", area: "ge", programme: "General English", streak: 12, best: 21, lastDay: "2026-10-05",
  week: { n: 3, total: 12, done: 2, per: 7, title: "Clear updates" }, overall: { done: 16, total: 84, pct: 19 }, weekGoal: { n: 3, goal: 6 }, words: 7,
  today: { kind: "week", kicker: "Semaine 3 · mardi", title: "Donner un point clair", cta: "Continuer la semaine 3", view: "session", w: 3, d: "Tue" },
  steps: ["done", "done", "now", "next", "locked", "locked", "locked", "locked", "locked", "locked", "locked", "locked"],
  phases: [{ label: "Fondations", pct: 100, state: "done" }], line: "25 minutes aujourd'hui.", labels: { streak: "jours de suite", today: "Aujourd'hui" } };
const call = (method, path, body, origin = "https://staging.lomonec.com", now = T0, headers = {}) =>
  handle(new Request("https://be-widget.test" + path, { method, headers: { ...(origin ? { origin } : {}), "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async r => ({ status: r.status, body: await r.json().catch(() => null), h: Object.fromEntries(r.headers) });

console.log("\n# publish and read back");
{
  let r = await j(await call("POST", "/feed", { wid: WID, snap: SNAP }));
  ok("1 · the page publishes a snapshot for its widget id", r.status === 200 && r.body.ok === true && r.body.at === T0, JSON.stringify(r));
  r = await j(await call("GET", `/feed?wid=${WID}`, undefined, ""));
  ok("2 · the widget (no Origin header) reads it back whole, with when it was published, uncached", r.status === 200 && r.body.at === T0 && r.body.area === "ge" && r.body.snap.streak === 12 && r.body.snap.today.title === "Donner un point clair" && r.body.snap.labels.streak === "jours de suite" && r.body.snap.steps.length === 12 && /no-store/.test(r.h["cache-control"]), JSON.stringify(r.body));
  /* the Welding widget (5 Oct 2026): a second programme publishes its own row;
     one GET serves both, and "latest" follows whichever was open last */
  await call("POST", "/feed", { wid: WID, snap: { ...SNAP, area: "pro", programme: "Welding English", streak: 4 } }, "https://staging.lomonec.com", T0 + 60_000);
  r = await j(await call("GET", `/feed?wid=${WID}`, undefined, "", T0 + 61_000));
  ok("2b · a Welding snapshot is kept beside the General English one: `areas` carries both, the top-level answer is the most recent", r.status === 200 && r.body.area === "pro" && r.body.snap.streak === 4 && r.body.areas.ge && r.body.areas.ge.snap.streak === 12 && r.body.areas.pro && r.body.areas.pro.snap.programme === "Welding English", JSON.stringify(r.body && { area: r.body.area, keys: Object.keys(r.body.areas || {}) }));
  await call("POST", "/feed", { wid: WID, snap: { ...SNAP, streak: 13 } }, "https://staging.lomonec.com", T0 + 120_000);
  r = await j(await call("GET", `/feed?wid=${WID}`, undefined, "", T0 + 121_000));
  ok("2c · publishing General English again updates ITS row only — Welding's stays", r.body.area === "ge" && r.body.areas.ge.snap.streak === 13 && r.body.areas.pro.snap.streak === 4);
  r = await j(await call("GET", `/feed?wid=${WID2}`, undefined, ""));
  ok("3 · an id nobody published for → 404, not an empty snapshot", r.status === 404 && r.body.error === "none");
  r = await j(await call("GET", `/feed?wid=${WID}`, undefined, "", T0 + 31 * 86_400_000));
  ok("4 · a snapshot older than 30 days is gone (404) — a phone that stopped opening the app is forgotten", r.status === 404);
  const after = await j(await call("DELETE", `/feed?wid=${WID}`));
  const gone = await j(await call("GET", `/feed?wid=${WID}`, undefined, "", T0 + 130_000));
  ok("4b · DELETE removes every programme's row for the id", after.status === 200 && gone.status === 404);
  await call("POST", "/feed", { wid: WID, snap: SNAP });
}

console.log("\n# what may be stored");
{
  const s = shapeSnap({ ...SNAP, name: "Alex", email: "alex@example.com", uid: "u1", transcript: "I said…", labels: { ...SNAP.labels, "Evil-Key": "x", toolong: "y".repeat(300) }, today: { ...SNAP.today, extra: "no" }, steps: ["done", "wat"], streak: "12" });
  ok("5 · unknown keys are dropped at every level — a name, an email, a uid or a transcript can never be parked here", s && !("name" in s) && !("email" in s) && !("uid" in s) && !("transcript" in s) && !("extra" in s.today) && !("Evil-Key" in s.labels), JSON.stringify(s));
  ok("6 · strings are capped, numbers coerced, step states forced into the four the widget knows", s && s.labels.toolong.length === 80 && s.streak === 12 && s.steps[1] === "locked", JSON.stringify(s && { l: s.labels.toolong && s.labels.toolong.length, st: s.steps }));
  /* the widget locks and the Recommendations list (owner, 6 Oct 2026) */
  const g = shapeSnap({ ...SNAP, gate: { signedIn: true, full: "yes", recs: true, uid: "u1" }, recs: [
    { t: "A clip", s: "Watch", why: "Because…", k: "video", img: "https://i.ytimg.com/vi/MZAjfsyJa1U/mqdefault.jpg", min: 6, go: { view: "shadow", act: "clip", a: ["MZAjfsyJa1U", "0", "0"], ch: true }, email: "x@y" },
    { t: "Words", k: "words", img: "home-shots/vocab.jpg", go: { view: "practice", act: "study-due" } },
    { t: "Bad", k: "video", img: "https://evil.example/x.jpg", go: { view: "settings", act: "wipe", a: ["../../etc", "ok"] } } ] });
  ok("6b · gate keeps three booleans only (a non-true value is false, an extra key is dropped)", g && g.gate.signedIn === true && g.gate.full === false && g.gate.recs === true && !("uid" in g.gate), JSON.stringify(g && g.gate));
  ok("6c · a recommendation keeps its text, an allowed picture and a nudgeGo place; unknown keys go", g && g.recs.length === 3 && g.recs[0].img.startsWith("https://i.ytimg.com/") && g.recs[0].go.view === "shadow" && g.recs[0].go.a.length === 3 && g.recs[0].go.ch === true && !("email" in g.recs[0]) && g.recs[1].img === "home-shots/vocab.jpg", JSON.stringify(g && g.recs));
  ok("6d · a picture from anywhere else, an unknown place or action, and an unsafe argument are dropped", g && g.recs[2].img === undefined && g.recs[2].go.view === undefined && g.recs[2].go.act === undefined && g.recs[2].go.a.join() === "ok", JSON.stringify(g && g.recs[2]));
  ok("7 · not a version-1 object → refused", shapeSnap({ v: 2 }) === null && shapeSnap([1]) === null && shapeSnap(null) === null && shapeSnap("x") === null);
  let r = await j(await call("POST", "/feed", { wid: WID, snap: { v: 2 } }));
  ok("8 · … and the route says 400 snapshot", r.status === 400 && r.body.error === "snapshot");
  r = await j(await call("POST", "/feed", { wid: "not-a-wid", snap: SNAP }));
  ok("9 · a malformed widget id → 400", r.status === 400 && r.body.error === "wid");
  r = await j(await call("POST", "/feed", { wid: WID, snap: { ...SNAP, line: "z".repeat(40_000) } }));
  ok("10 · an oversized body → 413, never stored", r.status === 413, JSON.stringify(r.status));
}

console.log("\n# limits, deletion, origins");
{
  const w = "c".repeat(32); let last = null;
  for (let i = 0; i < 61; i++) last = await j(await call("POST", "/feed", { wid: w, snap: SNAP }, "https://app.lomonec.com", T0 + i * 1000));
  ok("11 · the 61st write in an hour is refused (429) — the client is debounced, this is the backstop", last.status === 429 && last.body.error === "rate", JSON.stringify(last));
  const next = await j(await call("POST", "/feed", { wid: w, snap: SNAP }, "https://app.lomonec.com", T0 + 3_600_000 + 1));
  ok("12 · the next hour starts fresh", next.status === 200);
  let r = await j(await call("DELETE", `/feed?wid=${WID}`));
  const after = await j(await call("GET", `/feed?wid=${WID}`, undefined, ""));
  ok("13 · sign-out deletes the feed: the widget then shows its invitation, not the account that left", r.status === 200 && after.status === 404);
  r = await j(await call("POST", "/feed", { wid: WID2, snap: SNAP }, "https://evil.example"));
  ok("14 · a foreign origin is refused before anything is read", r.status === 403);
  const pre = await call("OPTIONS", "/feed", undefined, "https://app.lomonec.com");
  ok("15 · the app's origins get CORS; a preflight is answered", pre.status === 204 && pre.headers.get("access-control-allow-origin") === "https://app.lomonec.com" && /POST/.test(pre.headers.get("access-control-allow-methods")));
  const loc = await j(await call("POST", "/feed", { wid: WID2, snap: SNAP }, "http://127.0.0.1:8471"));
  ok("16 · a local test server may publish (the browser suites run against one)", loc.status === 200);
  r = await j(await call("GET", "/nope", undefined, ""));
  ok("17 · anything else is 404", r.status === 404);
}

{
  const wm = { m: 38, total: 250, lvl: 4, xp: 720, need: 280, pct: 40, streak: 5, next: "Visual recognition", uid: "u1",
    shift: { t: "Identify five tools correctly", p: 2, n: 5, done: false, words: ["secret"] }, labels: { title: "Welding Mastery", "Bad-Key": "x" } };
  const pro = shapeSnap({ ...SNAP, area: "pro", wm, recs: [{ t: "Today's Shift", k: "game", go: { view: "mastery", act: "listen" } }] });
  ok("WM1 · the Welding Mastery block passes on a Welding snapshot: numbers, the shift, clean labels, nothing extra", pro.wm && pro.wm.m === 38 && pro.wm.shift.p === 2 && pro.wm.shift.t === "Identify five tools correctly" && !pro.wm.uid && !pro.wm.shift.words && !("Bad-Key" in pro.wm.labels), JSON.stringify(pro.wm));
  ok("WM2 · a game recommendation keeps its place (mastery / listen)", pro.recs[0].go.view === "mastery" && pro.recs[0].go.act === "listen", JSON.stringify(pro.recs));
  ok("WM3 · a General English snapshot never carries the block", shapeSnap({ ...SNAP, area: "ge", wm }).wm === undefined);
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
