/* Visual-identity rig: full-page captures of the main screens at iPhone width.
   Run: cd tests && OUT=/path TAG=before node vi-shoot.mjs   (BASE=… PORT=…) */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8840), OUT = process.env.OUT || "/tmp", TAG = process.env.TAG || "shot";
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900); BASE = `http://127.0.0.1:${PORT}`; }
const b = await webkit.launch();
const DAY = 864e5, d = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const seed = (area, o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1, role: "Engineering / Data", goal: "Speak confidently in meetings" }, professionalTracks: { activeId: area, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, areaSplit: true,
  days: { w1Mon: true, w1Tue: true }, dates: [d(2), d(1)], dayLog: { [d(2)]: 1, [d(1)]: 1 }, dayLogA: { [area]: { [d(2)]: 1, [d(1)]: 1 } }, steps: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
async function open(state, { theme = "dark", flags = { home_v2_enabled: true } } = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s, f, t]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", f); if (t) localStorage.setItem("be_theme", t) } }, [JSON.stringify(state), JSON.stringify(flags), theme === "light" ? "light" : ""]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(2200); if (process.env.PREM) await p.evaluate(() => { window.__showPrem = 1 }); return { ctx, p, errs };
}
const view = async (p, v, a) => { await p.evaluate(([v, a]) => { document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel,.sync-nudge").forEach(e => e.remove()); go(v, a); scrollTo(0, 0); if (window.__showPrem) { const h = document.getElementById("hdrPrem"); if (h) h.hidden = false } }, [v, a]); await sleep(1300); };
const shot = async (p, name, full = false) => { await p.screenshot({ path: `${OUT}/${TAG}-${name}.png`, fullPage: full }); };
const only = (process.env.ONLY || "").split(",").filter(Boolean);
const want = n => !only.length || only.includes(n);
for (const [area, pre] of [["general-english", "ge"], ["welding", "wd"]]) {
  for (const theme of (process.env.THEMES || "dark").split(",")) {
    const { ctx, p, errs } = await open(seed(area), { theme });
    const px = `${pre}-${theme}`;
    for (const v of ["home", "journey", "shadow", "phrases", "practice", "review", "profile", "data"]) {
      if (!want(v)) continue;
      await view(p, v); await shot(p, `${px}-${v}`); if (process.env.FULL) await shot(p, `${px}-${v}-full`, true);
    }
    if (want("premium") && area === "general-english") { await p.evaluate(() => { try { premiumOpen("header") } catch (e) {} }); await sleep(1200); await shot(p, `${px}-premium`); }
    if (errs.length) console.log(px, "errors:", errs.join(" | "));
    await ctx.close();
  }
}
await b.close(); if (srv) srv.kill(); console.log("done", OUT);
