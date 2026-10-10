/* Android notifications — the WEB half, inside the Capacitor Android shell (10 Oct 2026).
   Run: cd tests && node android-push.mjs    (PORT=nnnn for a free port)

   What is real: index.html's pushSync / pushOff / pushId / remToggle /
   nudgeReady / the tap routing, in a real browser.
   What is played: the Capacitor bridge and the BEPush plugin (shaped like
   BEPushPlugin.java: available / permission / register / pendingTap / clear
   plus addListener), and be-push itself, which records what the app sends.

   The iPhone suite (ios-push.mjs) covers the shared code in depth; this one
   proves what differs on Android: the FCM token travels as `fcm`, a build
   without google-services.json switches itself off, the Android flag, and the
   Android wording for "notifications are off".

   What this cannot prove: that Firebase issues a token, or that a real phone
   shows the notification. Those need google-services.json, FCM_SA_JSON on
   be-push and a device — see docs/ANDROID_NATIVE_SHELL_PLAN.md. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8801), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const own = !process.env.BASE;
const srv = own ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }) : null;
if (own) await sleep(800);
{ /* another session's server on this port would certify someone else's tree */
  const disk = readFileSync(root + "index.html", "utf8");
  let served = ""; try { served = await (await fetch(BASE + "index.html")).text(); } catch (e) {}
  if (!served) { console.error(`\nNothing is answering at ${BASE}.\n`); if (srv) srv.kill(); process.exit(1); }
  if (served.length !== disk.length) { console.error(`\n${BASE} is serving a DIFFERENT index.html. Run with PORT=<a free port>.\n`); if (srv) srv.kill(); process.exit(1); }
}
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch();
const FCM = "fQ1x:APA91b" + "Zk3_-".repeat(30);   // shaped like a real FCM registration token

/* the bridge the Android shell injects, with the BEPush plugin behind it */
const BRIDGE = ([perm, token, failCode]) => {
  const be = window.__push = { calls: [], listeners: {}, perm, token, failCode, cleared: 0, prompted: 0, pending: null };
  const P = {
    available: async () => { be.calls.push("available"); return { available: true, permission: be.perm, registered: !!be.registered, env: "production" }; },
    permission: async () => { be.calls.push("permission"); return { permission: be.perm, registered: !!be.registered }; },
    register: async () => {
      be.calls.push("register");
      if (be.perm === "default") { be.prompted++; be.perm = be.answer || "granted"; }
      if (be.perm !== "granted") { const e = new Error("denied"); e.code = "denied"; throw e; }
      if (be.failCode) { const e = new Error(be.failCode); e.code = be.failCode; throw e; }
      be.registered = true;
      return { token: be.token, env: "production", permission: "granted" };
    },
    pendingTap: async () => { be.calls.push("pendingTap"); const t = be.pending; be.pending = null; return { tap: t }; },
    clear: async () => { be.cleared++; },
    addListener: (name, cb) => { (be.listeners[name] = be.listeners[name] || []).push(cb); return { remove() {} }; },
    removeAllListeners: async () => {},
  };
  const a = (window.Capacitor = window.Capacitor || {});
  a.getPlatform = () => "android"; a.isNativePlatform = () => true;
  const pl = (a.Plugins = a.Plugins || {});
  pl.BEPush = P;
  (a.PluginHeaders = a.PluginHeaders || []).push({ name: "BEPush", methods: ["available", "permission", "register", "pendingTap", "clear"].map(n => ({ name: n, rtype: "promise" })) });
  /* Android's WebView has neither of these either; the suite must see the shell as it is */
  try { delete window.Notification; } catch (e) { window.Notification = undefined; }
  try { delete window.PushManager; } catch (e) {}
};

const seed = (extra = {}) => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1, ...extra });

async function open({ ios = true, perm = "granted", token = FCM, failCode = null, state = {}, lang = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(s => { localStorage.setItem("be12_v1", s); }, seed(state));
  if (ios) await ctx.addInitScript(BRIDGE, [perm, token, failCode]);
  const sent = [];
  await ctx.route(/be-push/, async r => {
    const q = r.request(), u = new URL(q.url());
    let body = null; try { body = JSON.parse(q.postData() || "null"); } catch (e) {}
    sent.push({ path: u.pathname, body });
    const out = u.pathname === "/key" ? { key: "BNYYDUjL-BivM99fGRtRYZ4mGW3MLovUtkEgNiopzUfPFsnXwt7sZQcvym109TbADLW3abdEsizVqFR7CrTG42c" } : { ok: true };
    await r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(out) });
  });
  await ctx.route(u => /be-partner|be-polish|be-events|gstatic\.com\/firebasejs|ytimg|youtube|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#ppFab").forEach(e => e.remove()));
  if (lang) await p.evaluate(async l => { await setLang(l); }, lang);
  return { ctx, p, sent, errs };
}
const subs = sent => sent.filter(x => x.path === "/subscribe").map(x => x.body);

console.log("\n# the Android shell is seen for what it is");
{
  const { p, sent, ctx, errs } = await open({ perm: "default" });
  const g = await p.evaluate(() => ({ and: IS_ANDROID_APP, ios: IS_IOS_APP, on: iosPushOn(), plug: !!beNativePush() }));
  ok("1 · inside the Android shell the plugin is found and the Android flag turns the native path on", g.and && !g.ios && g.on && g.plug, JSON.stringify(g));
  await p.evaluate(async () => { S.reminder = { on: true, time: "19:00" }; save(); await pushSync(); });
  const st = await p.evaluate(() => ({ prompted: window.__push.prompted, calls: window.__push.calls }));
  ok("2 · a LAUNCH never prompts and sends nothing", st.prompted === 0 && !st.calls.includes("register") && subs(sent).length === 0, JSON.stringify({ st, sent: sent.map(x => x.path) }));
  ok("3 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# turning the reminder on registers the FCM token");
{
  const { p, sent, ctx, errs } = await open({ perm: "default" });
  await p.evaluate(async () => { remToggle(true); });
  await sleep(600);
  const body = subs(sent)[0] || null;
  ok("4 · the switch prompts once, through the plugin", (await p.evaluate(() => window.__push.prompted)) === 1);
  ok("5 · the token travels as fcm:{token} — no apns, no endpoint", !!body && body.fcm && body.fcm.token === FCM && !body.apns && !body.endpoint, JSON.stringify(body));
  ok("6 · the slot, the offset and the translated templates travel with it, as on iPhone", !!body && /^\d{4}$/.test(body.slot) && Number.isFinite(body.tz) && body.text && /\{\{name\}\}/.test(body.text.call.live.title) && !JSON.stringify(body.text).includes("Alex"), JSON.stringify(body));
  ok("7 · the device's id is its own (never one that arrived in synced state)", !!body && /^[0-9a-f]{32}$/.test(body.id) && body.id === (await p.evaluate(() => localStorage.getItem("be_push_id"))));
  ok("8 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# refused, unavailable, switched off");
{
  const { p, sent, ctx } = await open({ perm: "default" });
  await p.evaluate(() => { window.__push.answer = "denied"; });
  await p.evaluate(async () => { remToggle(true); });
  await sleep(600);
  const note = await p.evaluate(() => { const n = document.createElement("div"); n.innerHTML = remNoteHTML(); return n.textContent; });
  ok("9 · refused: nothing is registered, and the note names Android's own Settings path", subs(sent).length === 0 && /Settings → Apps → BE Mastery → Notifications/.test(note), JSON.stringify({ sent: sent.map(x => x.path), note }));
  await ctx.close();
}
{
  /* a build without google-services.json: BEPushPlugin.register rejects "unavailable" */
  const { p, sent, ctx, errs } = await open({ perm: "granted", failCode: "unavailable", state: { reminder: { on: true, time: "19:00" } } });
  await p.evaluate(async () => { await pushSync(true); });
  const g = await p.evaluate(() => ({ on: iosPushOn(), perm: _pushPerm, granted: pushPermGranted() }));
  ok("10 · no Firebase in the build: nothing is sent, and the native path switches itself off for the session", subs(sent).length === 0 && !g.on && g.perm === "unavailable" && !g.granted, JSON.stringify({ g, sent: sent.map(x => x.path) }));
  ok("11 · and that is not an error", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  const ctx0 = await open({ perm: "granted", state: { reminder: { on: true, time: "19:00" } } });
  await ctx0.p.evaluate(() => { localStorage.setItem("be_flags", JSON.stringify({ android_push_enabled: false })); });
  await ctx0.p.reload(); await sleep(1400);
  const n0 = subs(ctx0.sent).length;
  await ctx0.p.evaluate(async () => { await pushSync(true); });
  const g = await ctx0.p.evaluate(() => ({ on: iosPushOn(), flag: flag("android_push_enabled") }));
  ok("12 · the Android kill switch: flag off = no registration at all", !g.on && !g.flag && subs(ctx0.sent).length === n0, JSON.stringify({ g, sent: ctx0.sent.map(x => x.path) }));
  await ctx0.ctx.close();
}

console.log("\n# a tap");
{
  const { p, ctx } = await open({ perm: "granted" });
  const r = await p.evaluate(async () => {
    const fire = d => window.__push.listeners.tap.forEach(f => f(d));
    fire({ view: "partner", tag: "be-partner-call", call: "live" }); await new Promise(r => setTimeout(r, 400));
    const a = cur.v;
    fire({ view: "journey", tag: "be-daily" }); await new Promise(r => setTimeout(r, 400));
    return { a, b: cur.v, l: Object.keys(window.__push.listeners) };
  });
  ok("13 · the same destinations as iPhone: an invitation on Practice Partner, the reminder on the road map", r.a === "partner" && r.b === "journey" && r.l.includes("arrived"), JSON.stringify(r));
  await ctx.close();
}
{
  const { p, sent, ctx } = await open({ perm: "granted", state: { reminder: { on: true, time: "19:00" } } });
  await p.evaluate(async () => { await pushSync(true); });
  const id = await p.evaluate(() => localStorage.getItem("be_push_id"));
  await p.evaluate(async () => { S.ppAlerts = false; save(); remToggle(false); });
  await sleep(400);
  const un = sent.filter(x => x.path === "/unsubscribe");
  ok("14 · switching everything off tells be-push to drop this phone's row", un.length >= 1 && un[0].body.id === id, JSON.stringify(sent.map(x => x.path)));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
