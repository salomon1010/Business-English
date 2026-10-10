// Drive the Android shell on the emulator (debug build, WebView forwarded by webview.sh)
// and walk the ad path: plugin present → configure (UMP + SDK) → a test interstitial
// loads → the Home native slot fills. Raw DevTools protocol (an Android WebView does not
// support Playwright's browser-level attach).
//   node mobile/android/scripts/device-ads.mjs [general-english|welding]
const area = process.argv[2] || "general-english";
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
/* the app's own page — once the ads SDK runs, its own WebView page is listed too */
const page = targets.find(t => t.type === "page" && /^https:\/\/localhost\//.test(t.url));
if (!page) { console.error("no page target"); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let id = 0; const pending = {};
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description };
  return r.result && r.result.result ? r.result.result.value : r;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

await run(`localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: ${JSON.stringify(area)} },
  fnd: { ${JSON.stringify(area)}: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }));
  localStorage.setItem("be12_syncNudge", "1"); return true;`);
await send("Page.reload"); await sleep(3000);
for (let i = 0; i < 30; i++) { if (await run(`return typeof go === "function" && typeof IS_ANDROID_APP !== "undefined"`) === true) break; await sleep(1000); }
console.log("state:", JSON.stringify(await run(`
  document.querySelectorAll(".cf-ov,.wc-ov,#rmCel,#syncNudge").forEach(e => e.remove());
  const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.BEAds;
  const out = { android: IS_ANDROID_APP, area: areaId(), ads_enabled: flag("ads_enabled"), trackAllows: adsTrackAllows(), systemLive: adsSystemLive(), plugin: !!P };
  if (P) { out.configure = await P.configure(); out.load = await P.load({ format: "interstitial", context: "test" }); }
  return out;`), null, 1));
await run(`go("home"); return true;`); await sleep(8000);
console.log("home:", JSON.stringify(await run(`return { bridge: typeof window.BENativeAds === "object", supports: window.BENativeAds ? window.BENativeAds.supports("native") : null, slots: [...document.querySelectorAll("[data-ad-slot]")].map(e => e.dataset.placement) };`)));
ws.close();
