/* iOS zoom guard (owner, 2026-09-20): a phone must never stay zoomed in.
   Three rules, checked in WebKit at phone width: every field is ≥16 px on
   every page and in the Shadow workspace (no zoom-on-focus); text carries
   touch-action: manipulation (no double-tap zoom); and if the page is zoomed
   anyway, leaving a field, changing page or closing the workspace resets it.
     cd tests && node zoom.mjs */
import { webkit } from "playwright"; import { spawn } from "node:child_process";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn("python3", ["-m", "http.server", "8776"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(700); process.on("exit", () => server.kill());
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : " — " + d}`); };
const browser = await webkit.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), reminder: { on: true, time: "19:00" } })); });
const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
/* the released flags make the page poll the public /presence count; on localhost the
   production Worker's allow-list refuses the origin and WebKit reports that as a page
   error, which is an environment artefact, not the app — answer it locally */
await page.route(/\/presence(\?|$)/, r => r.fulfill({ status: 200, contentType: "application/json", body: '{"online":0,"waiting":0}' }));
await page.goto("http://localhost:8776/index.html?z=" + Date.now(), { waitUntil: "load" }); await sleep(1500);
const r = await page.evaluate(async () => {
  const out = { small: [] }; const cs = (el, p) => el ? getComputedStyle(el)[p] : "none-found";
  const scan = where => { for (const el of document.querySelectorAll("input,textarea,select")) { if (["checkbox", "radio", "range", "hidden", "file"].includes(el.type)) continue; if (parseFloat(getComputedStyle(el).fontSize) < 16) out.small.push(where + ":" + (el.id || el.className)); } };
  for (const v of ["home", "journey", "shadow", "phrases", "practice", "review", "profile", "data", "roleplay", "session", "foundations"]) { try { go(v); } catch (e) {} await new Promise(r => setTimeout(r, 300)); document.querySelectorAll(".cf-ov,.wc-ov,#rmNotice").forEach(e => e.remove()); scan(v); }
  go("data"); await new Promise(r => setTimeout(r, 300)); try { fbOpenModal("in"); await new Promise(r => setTimeout(r, 300)); scan("auth"); fbCloseModal(); } catch (e) {}
  go("shadow"); await new Promise(r => setTimeout(r, 300)); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); await new Promise(r => setTimeout(r, 1500)); shOpenWork(); await new Promise(r => setTimeout(r, 300)); scan("shadow-work");
  out.ta = { body: cs(document.body, "touchAction"), p: cs(document.querySelector("p"), "touchAction"), note: cs(document.getElementById("shNote"), "touchAction"), work: cs(document.querySelector(".sh-work"), "touchAction") };
  const meta = document.getElementById("vpMeta"); const seq = []; const mo = new MutationObserver(() => seq.push(meta.getAttribute("content"))); mo.observe(meta, { attributes: true });
  Object.defineProperty(window, "visualViewport", { value: { scale: 2 }, configurable: true });
  shCloseWork(); await new Promise(r => setTimeout(r, 300)); out.closeSeq = seq.slice(); seq.length = 0;
  go("data"); await new Promise(r => setTimeout(r, 300)); out.navSeq = seq.slice(); seq.length = 0;
  const f = document.querySelector("#v-data input:not([disabled]):not([type=checkbox])"); f.focus(); f.blur(); await new Promise(r => setTimeout(r, 300)); out.blurSeq = seq.slice(); seq.length = 0;
  Object.defineProperty(window, "visualViewport", { value: { scale: 1 }, configurable: true }); f.focus(); f.blur(); go("home"); await new Promise(r => setTimeout(r, 300)); out.calmSeq = seq.slice(); mo.disconnect();
  out.metaNow = meta.getAttribute("content"); return out;
});
const clamp = "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1", base = "width=device-width, initial-scale=1, viewport-fit=cover";
ok("every field on every page, the sign-in modal and the Shadow workspace is ≥ 16 px (no zoom-on-focus)", r.small.length === 0, r.small.join(", "));
ok("text carries touch-action: manipulation (no double-tap zoom), including inside the Shadow workspace", Object.values(r.ta).every(v => v === "manipulation"), JSON.stringify(r.ta));
ok("zoomed + closing the Shadow workspace → viewport clamped to 1× then released", r.closeSeq[0] === clamp && r.closeSeq[1] === base, JSON.stringify(r.closeSeq));
ok("zoomed + changing page → same reset", r.navSeq[0] === clamp && r.navSeq[1] === base, JSON.stringify(r.navSeq));
ok("zoomed + leaving a field → same reset, and the meta ends restored (pinch-zoom stays available)", r.blurSeq[0] === clamp && r.blurSeq.at(-1) === base && r.metaNow === base, JSON.stringify(r.blurSeq));
ok("not zoomed → the viewport is never touched", r.calmSeq.length === 0, JSON.stringify(r.calmSeq));
ok("no page errors", errs.filter(e => !/cloudflareinsights/.test(e)).length === 0, errs.join(" | "));
await browser.close(); server.kill();
const pass = res.filter(Boolean).length; console.log(`\n  ${pass}/${res.length} pass`); process.exit(pass === res.length ? 0 : 1);
