/* "Keep your progress" — the prompt that protects a signed-out Play learner before
   the Android app moves from the TWA (Chrome's storage) to the native shell (an
   empty WebView). Run: cd tests && node keep-progress.mjs   (PORT=nnnn)

   Only today's Play app (the TWA) asks; a signed-in learner, a plain browser,
   the native shells and a learner with nothing to lose are never asked; at most
   four times, three days apart; "Sign in to keep it" opens the sign-up sheet. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8803), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
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
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const seed = (extra = {}) => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: { "general-english:w1d1": true, "general-english:w1d2": true }, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {},
  rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: Date.now(), ...extra });

async function open({ twa = true, state = {}, android = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", userAgent: UA });
  await ctx.addInitScript(([s, twa]) => { localStorage.setItem("be12_v1", s); if (twa) sessionStorage.setItem("be_twa", "1"); }, [seed(state), twa]);
  if (android) await ctx.addInitScript(() => { const a = (window.Capacitor = window.Capacitor || {}); a.getPlatform = () => "android"; a.isNativePlatform = () => true; a.Plugins = a.Plugins || {}; });
  await ctx.route(u => /be-push|be-partner|be-polish|be-events|be-entitlements|gstatic\.com\/firebasejs|ytimg|youtube|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1500);
  return { ctx, p, errs };
}
/* the dialog itself, opened by the Home hook after 1.2 s + idle */
const dialog = p => p.evaluate(() => { const d = [...document.querySelectorAll(".cf-ov,.cf-box,[role=dialog],[role=alertdialog]")].map(e => e.textContent).join(" "); return d; });

console.log("\n# today's Play app, signed out, with progress on the phone");
{
  const { p, ctx, errs } = await open();
  await p.evaluate(() => go("home")); await sleep(2600);
  const txt = await dialog(p);
  ok("1 · Home asks: the title, the learner's own count, and why", /Keep your progress/.test(txt) && /2 completed sessions/.test(txt) && /new phone|reinstall/.test(txt), txt);
  const st = await p.evaluate(() => S.keepAsk);
  ok("2 · the ask is counted and dated, so it cannot repeat on the next Home visit", st && st.n === 1 && Date.now() - st.at < 60000, JSON.stringify(st));
  await p.evaluate(() => { window.__opened = null; const o = window.fbOpenModal; window.fbOpenModal = m => { window.__opened = m; }; });
  const btn = await p.$("text=Sign in to keep it");
  if (btn) await btn.click(); await sleep(400);
  ok("3 · \"Sign in to keep it\" opens the sign-up sheet", (await p.evaluate(() => window.__opened)) === "up", await p.evaluate(() => String(window.__opened)));
  ok("4 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  const { p, ctx } = await open();
  const r = await p.evaluate(() => {
    const out = {};
    S.keepAsk = { n: 1, at: Date.now() - 3600_000 }; out.soon = keepNudge();
    S.keepAsk = { n: 1, at: Date.now() - 4 * 86_400_000 }; out.later = keepNudge();
    S.keepAsk = { n: 4, at: 0 }; out.max = keepNudge();
    return out;
  });
  ok("5 · three days apart, at most four times", r.soon === false && r.later === true && r.max === false, JSON.stringify(r));
  await ctx.close();
}

console.log("\n# everyone else is never asked");
{
  const { p, ctx } = await open();
  const r = await p.evaluate(() => { delete S.keepAsk; FBUser = { uid: "u1" }; const a = keepNudge(); FBUser = null; return { a, asked: S.keepAsk || null }; });
  ok("6 · a signed-in learner: their progress is already in their account", r.a === false && !r.asked, JSON.stringify(r));
  await ctx.close();
}
{
  const { p, ctx } = await open({ twa: false });
  ok("7 · a plain Android browser (not the Play app)", (await p.evaluate(() => ({ play: isPlayApp(), k: keepNudge() }))).k === false);
  await ctx.close();
}
{
  const { p, ctx } = await open({ android: true });
  ok("8 · the native Android shell itself (it is the destination, not the risk)", (await p.evaluate(() => IS_ANDROID_APP && keepNudge() === false)) === true);
  await ctx.close();
}
{
  const { p, ctx } = await open({ state: { days: {} } });
  ok("9 · a learner with no completed session has nothing to lose", (await p.evaluate(() => keepNudge())) === false);
  await ctx.close();
}
{
  const { p, ctx } = await open();
  ok("10 · the flag turns it off", (await p.evaluate(() => { localStorage.setItem("be_flags", JSON.stringify({ play_keep_progress_enabled: false })); return keepNudge(); })) === false);
  await ctx.close();
}

/* ---------- the other half: the native shell's FIRST RUN (11 Oct 2026) ----------
   The TWA's storage cannot follow the app into its own WebView, so a learner who
   never signed in sees an empty first run. restoreAsk() explains that, over
   onboarding, once per device. */
console.log("\n# the native shell's first run — restoreAsk()");
async function first({ android = true, twa = false, flagOff = false, asked = false, profile = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", userAgent: UA });
  await ctx.addInitScript(([pro, tw, off, was]) => {
    if (pro) localStorage.setItem("be12_v1", pro);
    if (tw) sessionStorage.setItem("be_twa", "1");
    if (off) localStorage.setItem("be_flags", JSON.stringify({ play_keep_progress_enabled: false }));
    if (was) localStorage.setItem("be_restore_asked", "1");
  }, [profile ? seed() : null, twa, flagOff, asked]);
  if (android) await ctx.addInitScript(() => { const a = (window.Capacitor = window.Capacitor || {}); a.getPlatform = () => "android"; a.isNativePlatform = () => true; a.Plugins = a.Plugins || {}; });
  await ctx.route(u => /be-push|be-partner|be-polish|be-events|be-entitlements|gstatic\.com\/firebasejs|ytimg|youtube|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1800);
  return { ctx, p, errs };
}
{
  const { ctx, p, errs } = await first();
  const d = await dialog(p);
  const ob = await p.evaluate(() => !!document.getElementById("obWrap") || !!document.querySelector(".ob-wrap"));
  ok("R1 · Android shell, first run, signed out: the prompt explains the move and offers both ways out", /Used BE Mastery before/.test(d) && /Sign in to bring it back/.test(d) && /I'm new here/.test(d), d.slice(0, 200));
  ok("R2 · it never blocks: onboarding is already drawn underneath it", ob === true, String(ob));
  const asked = await p.evaluate(() => localStorage.getItem("be_restore_asked"));
  ok("R3 · the device is marked so it is asked once, and the marker is OUTSIDE S (a sync replaces S)", asked === "1" && await p.evaluate(() => { try { return !("restoreAsked" in (JSON.parse(localStorage.getItem("be12_v1") || "{}"))); } catch (e) { return true; } }), String(asked));
  const opened = await p.evaluate(async () => { let m = null; window.fbOpenModal = x => { m = x; }; const btn = [...document.querySelectorAll(".cf-ov button,[role=dialog] button,[role=alertdialog] button")].find(x => /bring it back/i.test(x.textContent)); if (!btn) return "no-button"; btn.click(); await new Promise(r => setTimeout(r, 400)); return m; });
  ok("R4 · 'Sign in to bring it back' opens the same sign-in sheet every other entry point uses", opened === "in", String(opened));
  ok("R5 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, p } = await first({ asked: true });
  ok("R6 · asked once per device: the next launch is silent", !/Used BE Mastery before/.test(await dialog(p)));
  await ctx.close();
}
{
  const { ctx, p } = await first({ profile: true });
  ok("R7 · a learner already set up on this device is never asked", !/Used BE Mastery before/.test(await dialog(p)));
  await ctx.close();
}
{
  const { ctx, p } = await first({ android: false, twa: true });
  ok("R8 · the TWA is never asked — that is keepNudge's job, before the switch", !/Used BE Mastery before/.test(await dialog(p)));
  await ctx.close();
}
{
  const { ctx, p } = await first({ android: false, twa: false });
  ok("R9 · a plain browser is never asked (nothing moved for it)", !/Used BE Mastery before/.test(await dialog(p)));
  await ctx.close();
}
{
  const { ctx, p } = await first({ flagOff: true });
  ok("R10 · the flag turns it off", !/Used BE Mastery before/.test(await dialog(p)));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
