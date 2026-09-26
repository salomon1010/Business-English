/* BE Mastery — PHASE 5 gate: light-theme depth, icon audit, inline-colour
   clean-up (docs/DESIGN_SYSTEM_BEMASTERY.md §15).

   Run:  cd tests && node ds-phase5.mjs

   1. Icons — every name passed to ic() / tIc() / hIcon() / pfRow() and every
      EMOJI_ICON target exists in ICON (a missing name silently draws the
      help "?" icon instead).
   2. Tokens — in all four themes (Signal / Forge × dark / light) tertiary
      text (--mut2) reads at AA 4.5:1 on --card and --card2, and the label on
      the brand fill (--on-accent on --accent-fill) reads at AA. Forge light
      used to inherit Forge dark's dark label (2.5–3.1:1).
   3. Screens — both tracks × dark and light, on every reachable screen:
      · no inline style and no SVG fill / stroke / stop-color carries a
        colour literal (they cannot follow the theme). Allowed on purpose:
        the language badges (a categorical palette, one hue per language)
        and SVG masks (white is what a mask means). Pure white / black as the
        second colour of a color-mix() is a lightness step, not a hue;
      · no OS emoji in visible text (the app draws line icons);
      · no SVG gradient stop paints the OTHER theme's brand colour (the Home
        progress ring was Signal indigo → cyan on Welding until Phase 5 —
        <stop> has no box, so the Phase 4 scan could not see it). */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
let fails = 0; const log = (ok, msg) => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails++; };

/* 1 · icon audit (static) */
{
  const h = readFileSync(root + "index.html", "utf8");
  const s = h.indexOf("const ICON"), blk = h.slice(s, h.indexOf("\n};", s) + 3);
  const names = new Set([...blk.matchAll(/^\s*"?([\w-]+)"?\s*:/gm)].map(m => m[1]));
  const used = new Set();
  for (const re of [/\bic\(\s*"([\w-]+)"/g, /\bic\(\s*'([\w-]+)'/g, /\btIc\([^,()]+,\s*"([\w-]+)"/g, /\bhIcon\(\s*"([\w-]+)"/g, /\bpfRow\(\s*"([\w-]+)"/g]) for (const m of h.matchAll(re)) used.add(m[1]);
  const e = h.indexOf("const EMOJI_ICON"), eb = h.slice(e, h.indexOf("};", e)); for (const m of eb.matchAll(/:"([\w-]+)"/g)) used.add(m[1]);
  const missing = [...used].filter(k => !names.has(k));
  log(!missing.length, `icons: ${used.size} names used, all present in ICON (${names.size})${missing.length ? " — missing: " + missing.join(", ") : ""}`);
}

const srv = spawn("python3", ["-m", "http.server", "8068", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const SIGNAL = ["99,102,241", "79,70,229", "129,140,248", "34,211,238", "168,85,247", "59,130,246", "8,145,178"];
const FORGE = ["212,151,23", "246,196,83", "201,138,13", "226,175,47", "155,98,0", "125,211,252"];
const SCREENS = {
  "general-english": [["home","go('home')"],["roadmap","go('journey')"],["session","go('session',1,'Mon')"],["practice","go('practice')"],["shadow","go('shadow')"],["phraselab","go('phrases')"],["progress","go('review')"],["profile","go('profile')"],["partner","go('partner')"],["roleplay","go('roleplay')"],["history","go('mvhist')"],["setup","go('data')"]],
  "welding": [["home","go('home')"],["journey","go('journey')"],["session","go('session',1,'Mon')"],["practice","go('practice')"],["shadow","go('shadow')"],["phraselab","go('phrases')"],["progress","go('review')"],["profile","go('profile')"],["simulation","go('simulation')"],["career","goCareer('profile')"],["tracks","go('tracks')"],["setup","go('data')"]],
};
const seed = tr => JSON.stringify({ profile: { name: "Awa", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
const b = await chromium.launch();
for (const theme of ["dark", "light"]) for (const track of Object.keys(SCREENS)) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, th]) => { localStorage.setItem("be_theme", th); localStorage.setItem("be12_v1", s); }, [seed(track), theme]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); await p.goto("http://127.0.0.1:8068/index.html", { waitUntil: "domcontentloaded" }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));

  /* 2 · tokens, measured in the page with the theme applied */
  const tok = await p.evaluate(() => {
    const L = c => { const m = c.match(/\d*\.?\d+/g).map(Number), k = /^color\(/.test(c) ? 1 : 255; return m.slice(0, 3).map(v => v / k).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0); };
    const res = n => { const d = document.createElement("i"); d.style.color = `var(${n})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    const cr = (a, b) => { const x = L(res(a)), y = L(res(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    return { mutCard: cr("--mut2", "--card"), mutCard2: cr("--mut2", "--card2"), label: cr("--on-accent", "--accent-fill") };
  });
  log(tok.mutCard >= 4.5 && tok.mutCard2 >= 4.5, `${theme} ${track}: tertiary text --mut2 ${tok.mutCard.toFixed(2)}:1 on --card, ${tok.mutCard2.toFixed(2)}:1 on --card2 (AA 4.5)`);
  log(tok.label >= 4.5, `${theme} ${track}: label on the brand fill ${tok.label.toFixed(2)}:1 (AA 4.5)`);

  /* 3 · screens */
  const foreign = track === "welding" ? SIGNAL : FORGE;
  const bad = { lit: [], emoji: [], stop: [] };
  for (const [name, js] of SCREENS[track]) {
    await p.evaluate(js); await sleep(600);
    const r = await p.evaluate(foreign => {
      const LIT = /#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i, out = { lit: [], emoji: [], stop: [] };
      const tag = el => el.tagName.toLowerCase() + "." + String(el.className.baseVal ?? el.className).trim().split(/\s+/).slice(0, 2).join(".");
      document.querySelectorAll(".view.on [style], .view.on svg [fill], .view.on svg [stroke], .view.on stop").forEach(el => {
        if (el.closest(".lang-ic, mask, .brand, .logo, .track-entry")) return;
        const box = (el.ownerSVGElement || el).getBoundingClientRect(); if (!box.width) return;
        for (const a of ["style", "fill", "stroke", "stop-color"]) { const v = el.getAttribute(a); if (v && LIT.test(v.replace(/,\s*#(fff|000)(fff|000)?\s*\)/gi, ")"))) out.lit.push(tag(el) + " " + a + "=" + v.slice(0, 70)); }
      });
      document.querySelectorAll(".view.on stop").forEach(el => {
        const box = (el.ownerSVGElement || el).getBoundingClientRect(); if (!box.width || el.closest(".brand, .logo, .track-entry")) return;
        const c = getComputedStyle(el).stopColor.replace(/\s+/g, "");
        if (foreign.some(f => new RegExp("rgba?\\(" + f + "(,|\\))").test(c))) out.stop.push(tag(el.closest("svg").parentElement) + " stop " + c);
      });
      const w = document.createTreeWalker(document.querySelector(".view.on") || document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const el = n.parentElement; if (!el || !el.getBoundingClientRect().width) continue; const m = n.nodeValue.match(/\p{Extended_Pictographic}/gu); if (m && m.some(c => !"©®™".includes(c))) out.emoji.push(tag(el) + " «" + n.nodeValue.trim().slice(0, 30) + "»"); }
      return out;
    }, foreign);
    for (const k of Object.keys(bad)) r[k].forEach(x => bad[k].push(name + ": " + x));
  }
  log(!bad.lit.length, `${theme} ${track}: no colour literal in inline styles / SVG paint on ${SCREENS[track].length} screens${bad.lit.length ? "\n         " + [...new Set(bad.lit)].slice(0, 8).join("\n         ") : ""}`);
  log(!bad.emoji.length, `${theme} ${track}: no OS emoji in visible text${bad.emoji.length ? "\n         " + [...new Set(bad.emoji)].slice(0, 8).join("\n         ") : ""}`);
  log(!bad.stop.length, `${theme} ${track}: no gradient stop in the other theme's brand colour${bad.stop.length ? "\n         " + [...new Set(bad.stop)].slice(0, 8).join("\n         ") : ""}`);
  await ctx.close();
}
await b.close(); srv.kill();
console.log(`\n${fails ? "FAIL" : "PASS"} — ${fails} failing checks`);
process.exit(fails ? 1 : 0);
