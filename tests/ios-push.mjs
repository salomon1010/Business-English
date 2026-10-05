/* iOS notifications — the WEB half, inside the App Store shell (4 Oct 2026).
   Run: cd tests && node ios-push.mjs        (PORT=nnnn for a free port)

   What is real: index.html's pushSync / pushOff / pushId / remToggle /
   nudgeReady / the tap routing, in a real browser.
   What is played: the Capacitor bridge and the BEPush plugin (shaped like
   BEPushPlugin.swift: available / permission / register / pendingTap / clear
   plus addListener), and be-push itself, which records what the app sends.

   What this cannot prove: that Apple issues a token, or that a real iPhone
   shows the notification. Those need an APNs key and a device — see
   docs/IOS_NOTIFICATIONS.md. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8799), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
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

/* the bridge the iOS shell injects, with the BEPush plugin behind it */
const BRIDGE = ([perm, token, failCode]) => {
  const be = window.__push = { calls: [], listeners: {}, perm, token, failCode, cleared: 0, prompted: 0, pending: null };
  const P = {
    available: async () => { be.calls.push("available"); return { available: true, permission: be.perm, registered: !!be.registered, env: "sandbox" }; },
    permission: async () => { be.calls.push("permission"); return { permission: be.perm, registered: !!be.registered }; },
    register: async () => {
      be.calls.push("register");
      if (be.perm === "default") { be.prompted++; be.perm = be.answer || "granted"; }
      if (be.perm !== "granted") { const e = new Error("denied"); e.code = "denied"; throw e; }
      if (be.failCode) { const e = new Error(be.failCode); e.code = be.failCode; throw e; }
      be.registered = true;
      return { token: be.token, env: "sandbox", permission: "granted" };
    },
    pendingTap: async () => { be.calls.push("pendingTap"); const t = be.pending; be.pending = null; return { tap: t }; },
    clear: async () => { be.cleared++; },
    addListener: (name, cb) => { (be.listeners[name] = be.listeners[name] || []).push(cb); return { remove() {} }; },
    removeAllListeners: async () => {},
  };
  const a = (window.Capacitor = window.Capacitor || {});
  a.getPlatform = () => "ios"; a.isNativePlatform = () => true;
  const pl = (a.Plugins = a.Plugins || {});
  pl.BEPush = P;
  (a.PluginHeaders = a.PluginHeaders || []).push({ name: "BEPush", methods: ["available", "permission", "register", "pendingTap", "clear"].map(n => ({ name: n, rtype: "promise" })) });
  /* WKWebView has neither of these; the suite must see the shell as it is */
  try { delete window.Notification; } catch (e) { window.Notification = undefined; }
  try { delete window.PushManager; } catch (e) {}
};

const seed = (extra = {}) => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1, ...extra });

async function open({ ios = true, perm = "granted", token = "a".repeat(64), failCode = null, state = {}, lang = null } = {}) {
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

console.log("\n# the shell is seen for what it is, and nothing is asked unprompted");
{
  const { p, sent, ctx, errs } = await open({ perm: "default" });
  const g = await p.evaluate(() => ({ ios: IS_IOS_APP, on: iosPushOn(), plug: !!beNativePush(), notif: typeof window.Notification, granted: pushPermGranted() }));
  ok("1 · inside the shell the plugin is found, the flag is on, and WKWebView still has no Notification of its own", g.ios && g.on && g.plug && g.notif === "undefined", JSON.stringify(g));
  await p.evaluate(async () => { S.reminder = { on: true, time: "19:00" }; save(); await pushSync(); });
  const st = await p.evaluate(() => ({ prompted: window.__push.prompted, calls: window.__push.calls }));
  ok("2 · a LAUNCH never prompts: permission is read, registration is not forced, nothing is sent", st.prompted === 0 && !st.calls.includes("register") && subs(sent).length === 0, JSON.stringify({ st, sent: sent.map(x => x.path) }));
  ok("3 · and no JavaScript errors where there used to be no push code at all", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# turning the reminder on registers the device with be-push");
{
  const { p, sent, ctx, errs } = await open({ perm: "default" });
  await p.evaluate(async () => { remToggle(true); });
  await sleep(600);
  const body = subs(sent)[0] || null;
  ok("4 · the switch prompts once, through the plugin", (await p.evaluate(() => window.__push.prompted)) === 1);
  ok("5 · the device token is registered in the same call a browser uses, with no endpoint", !!body && body.apns && body.apns.token === "a".repeat(64) && body.apns.env === "sandbox" && !body.endpoint, JSON.stringify(body));
  ok("6 · the reminder minute is the learner's local time in UTC, with the phone's offset", !!body && /^\d{4}$/.test(body.slot) && Number.isFinite(body.tz), JSON.stringify({ slot: body && body.slot, tz: body && body.tz }));
  ok("7 · the wording travels with it, because APNs has no service worker to ask", !!body && body.text && body.text.reminder.title.length > 3 && /\{\{n\}\}/.test(body.text.online.body) && /\{\{name\}\}/.test(body.text.call.live.title), JSON.stringify(body && body.text));
  ok("8 · the text holds only templates — no name, no progress, nothing the learner typed", !!body && !JSON.stringify(body.text).includes("Alex"), JSON.stringify(body && body.text));
  const note = await p.evaluate(() => { const n = document.createElement("div"); n.innerHTML = remNoteHTML(); return n.textContent; });
  ok("9 · the note no longer says the app cannot notify while closed", /even when the app is closed/i.test(note), note);
  ok("10 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# a learner who says no, and one who has said no before");
{
  const { p, sent, ctx } = await open({ perm: "default" });
  await p.evaluate(() => { window.__push.answer = "denied"; });
  await p.evaluate(async () => { remToggle(true); });
  await sleep(600);
  const note = await p.evaluate(() => { const n = document.createElement("div"); n.innerHTML = remNoteHTML(); return n.textContent; });
  ok("11 · refused: nothing is registered, and the note explains where to turn it back on", subs(sent).length === 0 && /turned off|Settings/i.test(note), JSON.stringify({ sent: sent.map(x => x.path), note }));
  ok("12 · the in-app reminder is still set, so the learner is not left with nothing", (await p.evaluate(() => !!S.reminder.on)) === true);
  await ctx.close();
}
{
  const { p, sent, ctx } = await open({ perm: "denied", state: { reminder: { on: true, time: "19:00" } } });
  await p.evaluate(async () => { await pushSync(); });
  ok("13 · a phone that already said no is never asked again on a launch", (await p.evaluate(() => window.__push.prompted)) === 0 && subs(sent).length === 0);
  ok("14 · and a nudge is never scheduled for a phone that cannot show one", (await p.evaluate(() => { FBUser = { uid: "u1" }; return nudgeReady(); })) === false);
  await ctx.close();
}

console.log("\n# switching the reminder off, and the push id that must never travel");
{
  const { p, sent, ctx } = await open({ perm: "granted", state: { reminder: { on: true, time: "19:00" } } });
  await p.evaluate(async () => { await pushSync(true); });
  const id = await p.evaluate(() => localStorage.getItem("be_push_id"));
  ok("15 · the id the phone registers under is its own, kept outside the synced state", /^[0-9a-f]{32}$/.test(id || "") && (await p.evaluate(() => S.pushId)) === id);
  ok("16 · a cloud copy never carries it, so a second device cannot take over this one's reminder",
    (await p.evaluate(() => "pushId" in fbSyncPayload({ pushId: "x".repeat(32), dates: [] }))) === false);
  await p.evaluate(async () => { remToggle(false); });
  await sleep(400);
  const un = sent.filter(x => x.path === "/unsubscribe");
  ok("17 · switching it off tells be-push to drop the row — there is no subscription object here to unsubscribe", un.length === 1 && un[0].body.id === id, JSON.stringify(un));
  await ctx.close();
}
{
  /* the dangerous case: an iPhone whose synced progress carried a browser's id */
  const { p, sent, ctx } = await open({ perm: "granted", state: { pushId: "f".repeat(32), reminder: { on: true, time: "19:00" } } });
  await p.evaluate(async () => { await pushSync(true); });
  const body = subs(sent)[0] || null;
  ok("18 · an id that arrived from the cloud is NOT reused in the shell: the browser's reminder keeps its own row", !!body && body.id !== "f".repeat(32) && /^[0-9a-f]{32}$/.test(body.id), JSON.stringify({ sent: body && body.id }));
  await ctx.close();
}
{
  /* everything off from the START, so the launch has nothing to want: partner
     alerts are on by default, and a phone that wants those registers at boot
     even with the reminder off — that is the behaviour the web already has. */
  const { p, sent, ctx } = await open({ perm: "granted", state: { reminder: { on: false, time: "19:00" }, ppAlerts: false } });
  await p.evaluate(async () => { await pushSync(); });
  ok("19 · with the reminder and the alerts both off, a launch sends nothing at all — no registration, and nothing to unsubscribe", sent.length === 0, JSON.stringify(sent.map(x => x.path)));
  await ctx.close();
}
{
  const { sent, ctx } = await open({ perm: "granted", state: { reminder: { on: false, time: "19:00" } } });
  const body = subs(sent)[0] || null;
  ok("19b · but a phone that wants partner alerts registers at boot with no reminder minute, exactly as a browser does", !!body && body.slot === null && body.presence === true, JSON.stringify(body && { slot: body.slot, presence: body.presence }));
  await ctx.close();
}

console.log("\n# a tap: the destinations the service worker reaches on the web");
{
  const { p, ctx } = await open({ perm: "granted" });
  const r = await p.evaluate(async () => {
    const out = {};
    out.listeners = Object.keys(window.__push.listeners);
    out.cleared = window.__push.cleared;
    const fire = d => window.__push.listeners.tap.forEach(f => f(d));
    fire({ view: "partner", tag: "be-partner-call", call: "live" }); await new Promise(r => setTimeout(r, 400));
    out.partner = cur.v;
    fire({ view: "journey", tag: "be-daily" }); await new Promise(r => setTimeout(r, 400));
    out.journey = cur.v;
    return out;
  });
  /* REVERSED 5 Oct 2026 (owner): "the notifications should stay permanent even
     if the app is closed until the user removes it". Opening the app used to
     wipe every delivered notification, so a reminder nobody had acted on went
     with it. iOS removes the one the learner taps by itself. */
  ok("20 · the plugin's events are listened for at boot, and opening the app does NOT wipe what is on the lock screen", r.listeners.includes("tap") && r.listeners.includes("arrived") && r.cleared === 0, JSON.stringify(r));
  ok("21 · an invitation lands on Practice Partner and the daily reminder on the road map", r.partner === "partner" && r.journey === "journey", JSON.stringify(r));
  await ctx.close();
}
{
  /* the tap that LAUNCHED the app: nothing is listening yet, so the plugin held it */
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(s => { localStorage.setItem("be12_v1", s); }, seed());
  await ctx.addInitScript(BRIDGE, ["granted", "a".repeat(64), null]);
  await ctx.addInitScript(() => { const t = setInterval(() => { if (window.__push) { window.__push.pending = { view: "partner", tag: "be-partner-call", call: "live" }; clearInterval(t); } }, 5); });
  await ctx.route(/be-push|be-partner|be-polish|be-events|gstatic\.com\/firebasejs|ytimg|youtube|cloudflareinsights/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const p = await ctx.newPage(); await p.goto(BASE + "index.html"); await sleep(1800);
  ok("22 · a cold launch from a notification still lands on the right page", (await p.evaluate(() => cur && cur.v)) === "partner", await p.evaluate(() => cur && cur.v));
  await ctx.close();
}

console.log("\n# the web is untouched");
{
  const { p, sent, ctx, errs } = await open({ ios: false, state: { reminder: { on: true, time: "19:00" } } });
  const g = await p.evaluate(() => ({ ios: IS_IOS_APP, on: iosPushOn(), notif: typeof window.Notification }));
  ok("23 · outside the shell none of this is reachable and the browser's own path is the one that runs", !g.ios && !g.on && g.notif === "function", JSON.stringify(g));
  ok("24 · an existing browser id is kept, so a web subscription is never orphaned by the new per-device id",
    (await p.evaluate(() => { localStorage.removeItem("be_push_id"); S.pushId = "c".repeat(32); return pushId(); })) === "c".repeat(32));
  ok("25 · no JavaScript errors on the web either", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
