/* Android home-screen widget — the WEB half (5 Oct 2026).
   Run: cd tests && node android-widget.mjs        (PORT=nnnn for a free port)

   What is real: index.html's capture of ?wid= / ?widget= from the launch URL,
   widgetFeedOn / widgetFeedSend / widgetFeedBoot / widgetClear, in a real
   browser on the app's own state.
   What is played: the staging environment (window.BE_BUILD, so WIDGET_API is
   the staging feed) and be-widget itself, which records what the page sends.

   What this cannot prove: that the Play app hands the page the id and that
   the widget draws — docs/ANDROID_WIDGET.md has the device checklist. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8795), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const own = !process.env.BASE;
const srv = own ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }) : null;
if (own) await sleep(800);
{ const disk = readFileSync(root + "index.html", "utf8");
  let served = ""; try { served = await (await fetch(BASE + "index.html")).text(); } catch (e) {}
  if (!served) { console.error(`\nNothing is answering at ${BASE}.\n`); if (srv) srv.kill(); process.exit(1); }
  if (served.length !== disk.length) { console.error(`\n${BASE} is serving a DIFFERENT index.html. Run with PORT=<a free port>.\n`); if (srv) srv.kill(); process.exit(1); } }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 600)}`); };
const b = await chromium.launch();
const WID = "ab".repeat(16);
const seed = (extra = {}) => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1, email: "alex@example.com" }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1, ...extra });

async function open({ query = "", hash = "", state = {}, flags = null, staging = true, signedIn = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, f, st]) => { localStorage.setItem("be12_v1", s); if (f) localStorage.setItem("be_flags", f); if (st) window.BE_BUILD = { env: "staging", flags: {} }; }, [seed(state), flags ? JSON.stringify(flags) : null, staging]);
  const feed = [];
  await ctx.route(/be-widget/, async r => {
    const q = r.request(), u = new URL(q.url()); let body = null; try { body = JSON.parse(q.postData() || "null"); } catch (e) {}
    feed.push({ method: q.method(), path: u.pathname + u.search, body });
    await r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true }) });
  });
  await ctx.route(u => /be-push|be-partner|be-polish|be-events|be-entitlements|gstatic\.com\/firebasejs|ytimg|youtube|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html" + query + hash); await sleep(3400);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#ppFab").forEach(e => e.remove()));
  /* signed out, the widgets get no progress (owner, 6 Oct 2026): the checks about what a widget SHOWS need a signed-in learner */
  if (signedIn) { await p.evaluate(() => { try { FBUser = { uid: "wg-test", email: "", getIdToken: async () => "t" }; _wgRecs.at = 0; widgetSync(true); } catch (e) {} }); await sleep(300); }
  return { ctx, p, feed, errs };
}
const posts = feed => feed.filter(f => f.method === "POST");
const todayKey = new Date().toISOString().slice(0, 10);

console.log("\n# the Play app hands the page its widget id on the launch URL");
{
  const { p, ctx, feed, errs } = await open({ query: `?wid=${WID}&widget=words`, hash: "#practice" });
  const g = await p.evaluate(() => ({ wid: localStorage.getItem("be_widget_wid"), on: widgetFeedOn(), api: WIDGET_API, url: location.search, hash: location.hash }));
  ok("1 · ?wid= is kept, ?widget= consumed, both stripped from the address, the feed is on and points at staging", g.wid === WID && g.on && /be-widget-staging/.test(g.api) && g.url === "" , JSON.stringify(g));
  const pb = posts(feed);
  ok("2 · the page published its snapshot to the feed at boot — version 1, under that id", pb.length >= 1 && pb.every(x => x.path === "/feed" && x.body.wid === WID && x.body.snap && x.body.snap.v === 1) && pb[pb.length - 1].body.snap.today && pb[pb.length - 1].body.snap.today.view   /* the latest: the first can be the signed-out one (locked, no progress) */, JSON.stringify(pb[0] && { path: pb[0].path, wid: pb[0].body.wid, v: pb[0].body.snap && pb[0].body.snap.v }));
  ok("3 · ?widget=words landed on Practice (the due words), not Home", /^#practice/.test(g.hash), g.hash);
  const raw = JSON.stringify(pb[0] && pb[0].body);
  ok("4 · nothing personal travels: no name, no email, no uid", !/Alex|alex@example\.com|uid/.test(raw), raw.slice(0, 200));
  /* a change: the client throttles the feed to one a minute; the boot publish is forced, so lift the throttle for the test */
  await p.evaluate(() => { _wgFeedAt = 0; markPracticed(); save(); }); await sleep(2300);
  const pb2 = posts(feed);
  ok("5 · practising republishes to the feed with the day marked", pb2.length > pb.length && pb2[pb2.length - 1].body.snap.lastDay === todayKey && pb2[pb2.length - 1].body.snap.streak === 1, JSON.stringify({ n: pb2.length, last: pb2[pb2.length - 1].body.snap.lastDay }));
  const n = pb2.length;
  await p.evaluate(() => { _wgFeedAt = 0; save(); }); await sleep(2000);
  ok("6 · a save that changes nothing visible is NOT republished", posts(feed).length === n);
  await p.evaluate(() => { fbWipeDevice(); }); await sleep(2300);
  ok("7 · signing out DELETEs the feed, so the widget shows its invitation and not the learner who left", feed.some(f => f.method === "DELETE" && f.path === `/feed?wid=${WID}`), JSON.stringify(feed.map(f => f.method + " " + f.path)));
  ok("8 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# a tap on the widget keeps its page, even on a comeback");
{
  const { p, ctx } = await open({ query: `?wid=${WID}&widget=1`, hash: "#session/1/Tue", state: { lastSeen: Date.now() - 5 * 3_600_000 } });
  ok("9 · ?widget=1#session/1/Tue opens that session although the app would otherwise land on Home after a gap", /^#session\/1\/Tue/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));
  await ctx.close();
}

console.log("\n# when there is no id, a bad id, the switch, or production");
{
  const { p, ctx, feed } = await open({ query: "?wid=not-hex-at-all" });
  const g = await p.evaluate(() => ({ wid: localStorage.getItem("be_widget_wid"), on: widgetFeedOn() }));
  ok("10 · a malformed id is not kept and nothing is published", g.wid === null && !g.on && posts(feed).length === 0, JSON.stringify({ g, feed }));
  await ctx.close();
}
{
  const { p, ctx, feed } = await open({});
  ok("11 · a plain open (no id ever handed over) publishes nothing — the web and the PWA are untouched", !(await p.evaluate(() => widgetFeedOn())) && posts(feed).length === 0);
  await ctx.close();
}
{
  const { p, ctx, feed } = await open({ query: `?wid=${WID}`, flags: { android_widget_enabled: false } });
  ok("12 · the kill switch: flag off → the id is kept but nothing is published", (await p.evaluate(() => localStorage.getItem("be_widget_wid"))) === WID && !(await p.evaluate(() => widgetFeedOn())) && posts(feed).length === 0);
  await ctx.close();
}
{
  const { p, ctx, feed } = await open({ query: `?wid=${WID}`, staging: false });
  ok("13 · production has no feed address yet (WIDGET_API empty until be-widget is deployed) → nothing published, no error", (await p.evaluate(() => WIDGET_API)) === "" && !(await p.evaluate(() => widgetFeedOn())) && posts(feed).length === 0);
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
