/* BE Mastery — PHASE 4 TRACK SURFACES gate (docs/DESIGN_SYSTEM_BEMASTERY.md §14).

   Run:  cd tests && node ds-phase4.mjs

   Every track surface speaks its OWN theme. For both tracks × dark and light,
   on every reachable screen (General English: Home, road map, session,
   practice, shadow, Phrase Lab, progress, profile, Practice Partner,
   roleplay, V2 mission, speaking history; Welding: Home, journey, session,
   practice, shadow, Phrase Lab, progress, profile, simulation, Career Centre,
   tracks) no visible element paints the OTHER theme's brand colours — Signal
   indigo / cyan / violet / blue on Welding, Forge amber / arc-blue on General
   English — in text, background, gradient, border, shadow, outline, fill or
   stroke. Allowed on purpose: the logo, the other track's selection card
   (it IS that track's identity) and the shared Help centre. Canvas / SVG
   charts read the theme through dsTok() at render time; this gate checks
   the Progress page and its area chart follow it. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname; const srv = spawn("python3", ["-m", "http.server", "8065", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const SIGNAL = ["99,102,241", "79,70,229", "129,140,248", "91,91,240", "165,180,252", "199,210,254", "34,211,238", "168,85,247", "192,132,252", "59,130,246", "37,99,235", "124,58,237", "8,145,178", "30,27,75", "99, 102, 241"];
const FORGE = ["212,151,23", "246,196,83", "201,138,13", "226,175,47", "166,107,8", "202,138,4", "253,230,138", "125,211,252"];
const SCREENS = {
  "general-english": [["home","go('home')"],["roadmap","go('journey')"],["session","go('session',1,'Mon')"],["practice","go('practice')"],["shadow","go('shadow')"],["phraselab","go('phrases')"],["progress","go('review')"],["profile","go('profile')"],["partner","go('partner')"],["roleplay","go('roleplay')"],["mission","mvGo('explain-work-guided','see')"],["history","go('mvhist')"]],
  "welding": [["home","go('home')"],["journey","go('journey')"],["session","go('session',1,'Mon')"],["practice","go('practice')"],["shadow","go('shadow')"],["phraselab","go('phrases')"],["progress","go('review')"],["profile","go('profile')"],["simulation","go('simulation')"],["career","goCareer('profile')"],["tracks","go('tracks')"]],
};
const b = await chromium.launch(); const out = {};
for (const theme of ["dark","light"]) for (const track of Object.keys(SCREENS)) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(([tr,th]) => { localStorage.setItem("be_theme",th); localStorage.setItem("be_missions","1"); localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Awa", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 })); }, [track, theme]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); await p.goto("http://127.0.0.1:8065/index.html", { waitUntil: "domcontentloaded" }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  const foreign = track === "welding" ? SIGNAL : FORGE;
  for (const [name, js] of SCREENS[track]) {
    await p.evaluate(js); await sleep(600);
    await p.evaluate(() => { try { document.getAnimations().forEach(a => { try { if (a.effect.getComputedTiming().iterations !== Infinity) a.finish(); } catch (e) {} }); } catch (e) {} });
    const hits = await p.evaluate(foreign => {
      const norm = s => String(s).replace(/\s+/g, "");
      const res = {};
      document.querySelectorAll("body *").forEach(el => {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") return;
        if (el.closest(".brand-name,.brand,.logo,#trackIndicator,.track-card,.pf-ic.track,.welding-card,svg image,.track-entry,.manual-doc")) return;
        const props = { color: cs.color, bg: cs.backgroundColor, img: cs.backgroundImage, border: cs.borderTopColor + cs.borderLeftColor, shadow: cs.boxShadow, outline: cs.outlineColor, fill: cs.fill, stroke: cs.stroke };
        for (const [k, v] of Object.entries(props)) {
          const nv = norm(v);
          for (const f of foreign) { const re = new RegExp("rgba?\\(" + f.replace(/,/g, ",") + "(,([0-9.]+))?\\)"); const m = nv.match(re); if (m && (m[2] === undefined || +m[2] > .05)) {
            const sel = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "");
            const key = sel + " [" + k + " " + f + "]"; res[key] = (res[key] || 0) + 1; } }
        }
      });
      return res;
    }, foreign.map(f => f.replace(/\s/g, "")));
    out[theme + " " + track + "/" + name] = hits;
  }
  await ctx.close();
}
await b.close(); srv.kill();
let fails = 0;
for (const [k, v] of Object.entries(out)) { const n = Object.values(v).reduce((a, b) => a + b, 0); console.log(`  ${n ? "FAIL" : "PASS"}  ${k}: ${n} foreign-colour paints`); if (n) { fails++; Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([s, c]) => console.log(`         ×${c} ${s}`)); } }
/* charts: canvas / SVG colours come from the theme at render time */
{
  const b2 = await chromium.launch(); const charts = {};
  const srv2 = spawn("python3", ["-m", "http.server", "8066", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
  for (const track of ["general-english", "welding"]) {
    const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await ctx.addInitScript(tr => localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Awa", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 })), track);
    await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
    const p = await ctx.newPage(); await p.goto("http://127.0.0.1:8066/index.html", { waitUntil: "domcontentloaded" }); await sleep(1400);
    await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()); go("home"); }); await sleep(600);   /* the dashboard reads Home's own render state */
    charts[track] = await p.evaluate(() => { go("review"); return { accent: dsTok("--accent"), live: dsTok("--live"), area: pgArea([10, 40, 70], dsTok("--accent"), 460, 150, "%"), page: document.querySelector(".view.on").innerHTML }; });
    await ctx.close();
  }
  await b2.close(); srv2.kill();
  for (const [track, c] of Object.entries(charts)) {
    const ok = c.area.includes(`stroke="${c.accent}"`) && (track !== "welding" || !/#6366f1|rgba\(99, ?102, ?241/.test(c.page));
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${track}: the Progress page and its chart are drawn in the theme's own accent ${c.accent} (no Signal indigo on Welding)`);
    if (!ok) fails++;
  }
  if (charts.welding.accent === charts["general-english"].accent) { console.log("  FAIL  the two tracks resolved the same accent"); fails++; }
}
console.log(`\n${fails ? "FAIL" : "PASS"} — ${fails} failing checks`);
process.exit(fails ? 1 : 0);
