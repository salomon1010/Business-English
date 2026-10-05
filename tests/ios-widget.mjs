/* iOS home-screen widget — the WEB half, inside the App Store shell (5 Oct 2026).
   Run: cd tests && node ios-widget.mjs        (PORT=nnnn for a free port)

   What is real: index.html's widgetSnapshot / widgetSync / widgetClear /
   widgetOpenRoute / widgetNativeBoot, in a real browser, on the app's own
   state and curriculum.
   What is played: the Capacitor bridge and the BEWidget plugin (shaped like
   BEWidgetPlugin.swift: available / update / clear / pendingOpen plus
   addListener), which records every snapshot the app publishes.

   What this cannot prove: that WidgetKit draws it on an iPhone. That is the
   device row in docs/IOS_WIDGET.md. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8796), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const own = !process.env.BASE;
const srv = own ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }) : null;
if (own) await sleep(800);
{ /* another session's server on this port would certify someone else's tree */
  const disk = readFileSync(root + "index.html", "utf8");
  let served = ""; try { served = await (await fetch(BASE + "index.html")).text(); } catch (e) {}
  if (!served) { console.error(`\nNothing is answering at ${BASE}.\n`); if (srv) srv.kill(); process.exit(1); }
  if (served.length !== disk.length) { console.error(`\n${BASE} is serving a DIFFERENT index.html. Run with PORT=<a free port>.\n`); if (srv) srv.kill(); process.exit(1); }
}
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 600)}`); };
const b = await chromium.launch();

/* the bridge the iOS shell injects, with the BEWidget plugin behind it */
const BRIDGE = ([pending]) => {
  const be = window.__wg = { stored: [], cleared: 0, calls: [], listeners: {}, pending };
  const P = {
    available: async () => { be.calls.push("available"); return { available: true, group: true }; },
    update: async ({ snapshot }) => { be.calls.push("update"); if (typeof snapshot !== "string") throw new Error("bad_snapshot"); be.stored.push(snapshot); return { stored: true }; },
    clear: async () => { be.calls.push("clear"); be.cleared++; },
    pendingOpen: async () => { be.calls.push("pendingOpen"); const o = be.pending; be.pending = null; return { open: o }; },
    addListener: (name, cb) => { (be.listeners[name] = be.listeners[name] || []).push(cb); return { remove() {} }; },
    removeAllListeners: async () => {},
  };
  const a = (window.Capacitor = window.Capacitor || {});
  a.getPlatform = () => "ios"; a.isNativePlatform = () => true;
  const pl = (a.Plugins = a.Plugins || {});
  pl.BEWidget = P;
  (a.PluginHeaders = a.PluginHeaders || []).push({ name: "BEWidget", methods: ["available", "update", "clear", "pendingOpen"].map(n => ({ name: n, rtype: "promise" })) });
};

const seed = (extra = {}) => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1, email: "alex@example.com" }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1, ...extra });

async function open({ ios = true, pending = null, state = {}, flags = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, f]) => { localStorage.setItem("be12_v1", s); if (f) localStorage.setItem("be_flags", f); }, [seed(state), flags ? JSON.stringify(flags) : null]);
  if (ios) await ctx.addInitScript(BRIDGE, [pending]);
  await ctx.route(u => /be-push|be-partner|be-polish|be-events|gstatic\.com\/firebasejs|ytimg|youtube|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(3200);   // the boot publish, then the one after the curriculum is in
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#ppFab").forEach(e => e.remove()));
  return { ctx, p, errs };
}
const last = p => p.evaluate(() => { const s = window.__wg.stored; return s.length ? JSON.parse(s[s.length - 1]) : null; });
const count = p => p.evaluate(() => window.__wg.stored.length);
const todayKey = new Date().toISOString().slice(0, 10);

console.log("\n# the app publishes what the widget shows");
{
  const { p, ctx, errs } = await open();
  const g = await p.evaluate(() => ({ ios: IS_IOS_APP, on: widgetOn(), plug: !!beNativeWidget(), n: window.__wg.stored.length, listening: !!(window.__wg.listeners.open || []).length, asked: window.__wg.calls.includes("pendingOpen") }));
  ok("1 · inside the shell the plugin is found, the flag is on, a snapshot was published at boot, the tap listener is on and the launch tap was asked for", g.ios && g.on && g.plug && g.n >= 1 && g.listening && g.asked, JSON.stringify(g));
  const s = await last(p);
  ok("2 · the snapshot is version 1 for the open programme, with the road map, today's step and its deep link", s && s.v === 1 && s.area === "ge" && s.programme === "General English" && s.lang === "en" && s.dir === "ltr"
    && Array.isArray(s.steps) && s.steps.length >= 12 && s.steps.filter(x => x === "now").length === 1 && s.steps.every(x => ["done", "now", "next", "locked"].includes(x))
    && s.week && s.week.n === 1 && s.week.total === 12 && s.overall && s.overall.total === 84 && s.overall.done === 0
    && s.today && s.today.view === "session" && s.today.w === 1 && s.today.d === "Mon" && s.today.kicker && s.today.title && s.today.cta, JSON.stringify(s));
  ok("3 · labels travel translated (the widget holds only English fallbacks), the streak is 0 and no day is marked yet", s && s.labels && s.labels.streak === "day streak" && s.labels.today === "Today" && s.labels.roadmap === "Road map" && s.labels.unit === "Week"
    && s.labels.risk === "Keep your streak alive tonight" && s.streak === 0 && s.lastDay === "" && s.weekGoal && s.weekGoal.goal === 6 && s.weekGoal.n === 0, JSON.stringify(s && s.labels));
  const raw = await p.evaluate(() => window.__wg.stored[window.__wg.stored.length - 1]);
  ok("4 · nothing personal: no name, no email, under 6 KB", !/Alex|alex@example\.com/.test(raw) && raw.length < 6000, `${raw.length} bytes`);
  /* a practice day */
  const before = await count(p);
  await p.evaluate(() => { markPracticed(); save(); });
  await sleep(2200);
  const s2 = await last(p);
  ok("5 · practising today republishes (debounced): the day is marked, the streak and this week's count are 1", (await count(p)) > before && s2 && s2.lastDay === todayKey && s2.streak === 1 && s2.weekGoal.n === 1, JSON.stringify({ before, now: await count(p), lastDay: s2 && s2.lastDay, streak: s2 && s2.streak, wg: s2 && s2.weekGoal }));
  const n2 = await count(p);
  await p.evaluate(() => { save(); }); await sleep(2000);
  ok("6 · a save that changes nothing the widget shows is NOT republished (WidgetKit's redraw budget)", (await count(p)) === n2, `${n2} → ${await count(p)}`);
  /* a session finished → the road map moves */
  await p.evaluate(() => { S.days[dayKey(1, "Mon")] = true; save(); }); await sleep(2200);
  const s3 = await last(p);
  ok("7 · a finished session moves today's step to the next day and the overall count", s3 && s3.today.d === "Tue" && s3.overall.done === 1 && s3.week.done === 1, JSON.stringify(s3 && { today: s3.today, overall: s3.overall, week: s3.week }));
  /* language and theme */
  await p.evaluate(async () => { await setLang("fr"); }); await sleep(2200);
  const s4 = await last(p);
  ok("8 · a language change republishes in that language", s4 && s4.lang === "fr" && s4.labels.streak !== "day streak" && s4.labels.risk !== "Keep your streak alive tonight", JSON.stringify(s4 && { lang: s4.lang, labels: s4.labels }));
  await p.evaluate(() => setTheme("light")); await sleep(2200);
  const s5 = await last(p);
  ok("9 · the theme (which lives outside S) republishes too", s5 && s5.theme === "light", JSON.stringify(s5 && s5.theme));
  ok("10 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# a tap on the widget lands on the thing it showed");
{
  const { p, ctx } = await open();
  const fire = d => p.evaluate(d => { (window.__wg.listeners.open || []).forEach(f => f(d)); return location.hash; }, d);
  const h1 = await fire({ view: "session", w: 1, d: "Tue", src: "widget" }); await sleep(300);
  ok("11 · today's step → that session page", /^#session\/1\/Tue/.test(await p.evaluate(() => location.hash)), h1 + " → " + await p.evaluate(() => location.hash));
  await fire({ view: "practice", act: "words", src: "widget" }); await sleep(600);
  ok("12 · the words chip → Practice", /^#practice/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));
  await fire({ view: "journey", src: "widget" }); await sleep(300);
  ok("13 · the road map strip → the Road map", /^#journey/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));
  const r = await p.evaluate(() => [widgetOpenRoute({ view: "settings" }), widgetOpenRoute(null), widgetOpenRoute("journey")]);
  ok("14 · an unknown view, or no payload, is refused — the page does not move", r.every(x => x === false) && /^#journey/.test(await p.evaluate(() => location.hash)), JSON.stringify(r));
  await ctx.close();
}
{
  const { p, ctx } = await open({ pending: { view: "review", src: "widget" } });
  ok("15 · the tap that LAUNCHED the app is served once by pendingOpen and routed at boot", /^#review/.test(await p.evaluate(() => location.hash)) && (await p.evaluate(() => window.__wg.pending)) === null, await p.evaluate(() => location.hash));
  await ctx.close();
}

console.log("\n# the other programme, sign-out, the switch, and the web");
{
  const { p, ctx } = await open({ state: { professionalTracks: { activeId: "welding" } } });
  const s = await last(p);
  ok("16 · Welding publishes its own programme, colours and unit name — never General English's", s && s.area === "pro" && s.programme === "Welding English" && s.labels.unit !== "Week" && s.today && s.today.view, JSON.stringify(s && { area: s.area, programme: s.programme, unit: s.labels.unit, today: s.today }));
  await ctx.close();
}
{
  const { p, ctx } = await open();
  const n = await count(p);
  await p.evaluate(() => { fbWipeDevice(); }); await sleep(2200);
  const w = await p.evaluate(() => ({ cleared: window.__wg.cleared, n: window.__wg.stored.length }));
  ok("17 · signing out clears the widget and publishes no blank learner afterwards", w.cleared >= 1 && w.n === n, JSON.stringify({ before: n, after: w }));
  await ctx.close();
}
{
  const { p, ctx } = await open({ flags: { ios_widget_enabled: false } });
  const g = await p.evaluate(() => ({ on: widgetOn(), calls: window.__wg.calls }));
  ok("18 · the kill switch: flag off → nothing published, nothing asked", !g.on && !g.calls.includes("update") && !g.calls.includes("pendingOpen"), JSON.stringify(g));
  await ctx.close();
}
{
  const { p, ctx, errs } = await open({ ios: false });
  const g = await p.evaluate(() => ({ on: widgetOn(), plug: beNativeWidget(), snap: typeof widgetSnapshot === "function" ? !!widgetSnapshot() : null }));
  ok("19 · on the web: no plugin, nothing on, no errors — the snapshot builder still runs (it is plain data)", !g.on && g.plug === null && g.snap === true && errs.length === 0, JSON.stringify({ g, errs }));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
