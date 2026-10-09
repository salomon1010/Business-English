// After device-ads.mjs: put Home on screen (onboarding layer removed), then ask the plugin
// to show the loaded TEST interstitial and leave it up for a screenshot.
//   node mobile/android/scripts/device-show-ad.mjs
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find(t => t.type === "page" && /^https:\/\/localhost\//.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let id = 0; const pending = {};
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const run = async expr => { const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
console.log(await run(`document.querySelectorAll("#obWrap,.cf-ov,.wc-ov,#rmCel,#syncNudge").forEach(e => e.remove()); go("home"); await new Promise(r=>setTimeout(r,3000));
  const P = Capacitor.Plugins.BEAds; const l = await P.load({ format: "interstitial", context: "test" });
  P.show({ format: "interstitial", context: "test" }).then(r => console.log("interstitial closed", JSON.stringify(r)));
  return "load " + JSON.stringify(l) + " · show requested";`));
await sleep(5000);
ws.close();
