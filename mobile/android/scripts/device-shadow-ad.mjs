// Drive the Android shell on the emulator and look at the SHADOW WORKSPACE ad
// (12 Oct 2026). After device-ads.mjs' pattern: raw DevTools over the socket
// scripts/webview.sh forwards. Opens a clip, lets the slot fill, then reports
// the slot's rectangle and what the page told the shell at several scroll
// positions — the screenshots beside it are taken by the caller with
// `adb exec-out screencap`, which captures the platform ad view too.
//   node mobile/android/scripts/device-shadow-ad.mjs [general-english|welding]
const area = process.argv[2] || "general-english";
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find(t => t.type === "page" && /^https:\/\/localhost\//.test(t.url));
if (!page) { console.error("no page target", JSON.stringify(targets.map(t => t.url))); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let id = 0; const pending = {};
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const run = async expr => {
  const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) return { error: String((r.result.exceptionDetails.exception || {}).description || "").slice(0, 300) };
  return r.result && r.result.result ? r.result.result.value : r;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("seed:", JSON.stringify(await run(`localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: ${JSON.stringify(area)} },
  fnd: { ${JSON.stringify(area)}: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }));
  return true;`)));
await run(`location.reload(); return true;`); await sleep(6000);
console.log("state:", JSON.stringify(await run(`document.querySelectorAll("#obWrap,.cf-ov,.wc-ov,#rmCel,#syncNudge,#fndCheckOv").forEach(e => e.remove());
  AD_BOOT = Date.now() - 10*60e3; go("shadow"); await new Promise(r=>setTimeout(r,1500));
  return { native: !!window.BENativeAds, provider: adProvider().id, flag: flag("ads_enabled"), live: adsSystemLive(), track: adsTrackAllows(), v: (typeof cur!=="undefined"&&cur)?cur.v:"?" };`)));

/* open a clip the library really has */
console.log("open:", JSON.stringify(await run(`const btn = [...document.querySelectorAll("#shLibFeed [onclick]")].find(e => /^shLibOpen\\('/.test(e.getAttribute("onclick")));
  const c = { vid: btn ? btn.getAttribute("onclick").replace(/.*shLibOpen\\('([^']+)'.*/, "$1") : "arj7oStGLkU", title: "clip" };
  if (btn) btn.click(); else await shLoad({ vid: c.vid, start: 0, end: 0, title: c.title }, true).catch(e => e);
  await new Promise(r=>setTimeout(r,9000));
  const w = document.getElementById("shWork");
  return { open: !!(w && getComputedStyle(w).display !== "none"), v3: !!(w && w.dataset.v3), mode: typeof svMode !== "undefined" ? svMode : "?", vid: c.vid };`)));
await sleep(4000);

const read = async label => {
  const out = await run(`const s = document.querySelector('[data-ad-slot][data-placement="shadow_video"]');
    const host = document.getElementById("shAdHost"), tx = document.getElementById("shV2"), stick = document.querySelector("#shPlayerWrap .sh-stick");
    const r = e => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
    const body = s && (s.querySelector(".ad-native-body") || s);
    return { slots: document.querySelectorAll("[data-ad-slot]").length,
      inWork: [...document.querySelectorAll("[data-ad-slot]")].filter(x => document.getElementById("shWork").contains(x)).length,
      inHost: !!(s && host && host.contains(s)), hostBeforeTx: !!(host && tx && tx.previousElementSibling === host),
      rect: body ? r(body) : null, tx: tx ? r(tx) : null, player: stick ? r(stick) : null,
      iw: innerWidth, ih: innerHeight, scrollTop: Math.round((document.querySelector(".sh-work-body")||{scrollTop:0}).scrollTop) };`);
  console.log(label, JSON.stringify(out));
  return out;
};
await read("AD@top   ");
for (const px of [300, 700, 1400]) {
  await run(`const b = document.querySelector(".sh-work-body"); if (b) b.scrollTop = ${px}; return true;`);
  await sleep(900);
  await read(`AD@${String(px).padStart(4)} `);
}
await run(`const b = document.querySelector(".sh-work-body"); if (b) b.scrollTop = 0; return true;`);
await sleep(900);
ws.close();
