/* Google sign-in in the Android shell (10 Oct 2026). Run: cd tests && node android-auth.mjs */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8807), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const own = !process.env.BASE;
const srv = own ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }) : null;
if (own) await sleep(800);
{ /* another session's server on this port would certify someone else's tree */
  const disk = readFileSync(root + "index.html", "utf8");
  let served = ""; try { served = await (await fetch(BASE + "index.html")).text(); } catch (e) {}
  if (!served) { console.error(`\nNothing is answering at ${BASE}.\n`); if (srv) srv.kill(); process.exit(1); }
  if (served.length !== disk.length) { console.error(`\n${BASE} is serving a DIFFERENT index.html. Run with PORT=<a free port>.\n`); if (srv) srv.kill(); process.exit(1); }
}
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await chromium.launch();
const seed = JSON.stringify({ profile: { name: "Muna", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: Date.now() });
async function open(plugin) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(s => localStorage.setItem("be12_v1", s), seed);
  await ctx.addInitScript(withPlugin => {
    const a = (window.Capacitor = window.Capacitor || {}); a.getPlatform = () => "android"; a.isNativePlatform = () => true; a.Plugins = a.Plugins || {};
    window.__auth = { calls: [] };
    if (withPlugin) a.Plugins.BEAuth = {
      available: async () => { __auth.calls.push("available"); return { apple: true, google: true }; },
      googleSignIn: async () => { __auth.calls.push("google"); const e = new Error("cancelled"); e.code = "cancelled"; throw e; },
      appleSignIn: async () => { __auth.calls.push("apple"); throw Object.assign(new Error("x"), { code: "cancelled" }); },
    };
  }, plugin);
  await ctx.route(u => /be-push|be-partner|be-polish|be-events|be-entitlements|ytimg|youtube|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  return { ctx, p, errs };
}
console.log("\n# Google sign-in in the Android shell (BEAuthPlugin.java)");
{
  const { p, ctx, errs } = await open(true);
  await p.evaluate(async () => { document.querySelectorAll(".cf-ov,#wcOv,#obWrap").forEach(e => e.remove()); FBauth = FBauth || {}; await fbOpenModal("in"); });
  await sleep(600);
  const g = await p.evaluate(() => ({ google: !!document.querySelector(".auth-soc.google"), apple: !!document.querySelector(".auth-soc.apple"), calls: __auth.calls.slice() }));
  ok("1 · the sheet asks the plugin and shows the Google button", g.google && g.calls.includes("available"), JSON.stringify(g));
  ok("2 · and the Apple button (Apple's page in a browser tab, BEAuthPlugin.appleSignIn)", g.apple, JSON.stringify(g));
  await p.evaluate(() => document.querySelector(".auth-soc.apple").click()); await sleep(400);
  ok("2b · tapping Apple asks the plugin, and a cancelled Apple sheet says nothing", (await p.evaluate(() => __auth.calls.includes("apple") && !((document.getElementById("authErr") || {}).textContent || "").trim())));
  await p.evaluate(() => document.querySelectorAll(".auth-soc").forEach(b => b.disabled = false));
  await p.evaluate(() => document.querySelector(".auth-soc.google").click()); await sleep(400);
  const c = await p.evaluate(() => ({ calls: __auth.calls.slice(), err: (document.getElementById("authErr") || {}).textContent || "" }));
  ok("3 · tapping it asks the plugin for a Google token; closing Google's sheet says nothing", c.calls.includes("google") && !c.err.trim(), JSON.stringify(c));
  ok("4 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  const { p, ctx } = await open(false);
  await p.evaluate(async () => { document.querySelectorAll(".cf-ov,#wcOv,#obWrap").forEach(e => e.remove()); FBauth = FBauth || {}; await fbOpenModal("in"); });
  await sleep(600);
  ok("5 · an Android build without the plugin keeps email only (no broken buttons)", (await p.evaluate(() => document.querySelectorAll(".auth-soc").length)) === 0);
  await ctx.close();
}
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
