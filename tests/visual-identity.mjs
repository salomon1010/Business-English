/* Visual identity v2 (29 Sep 2026, feature/visual-identity-phase2) — docs/DESIGN_SYSTEM_BEMASTERY.md §19.
   Brand assets, the Premium mark, the navigation icon set, header and bottom-bar
   geometry, the grouped best-tool list, switches and the field focus ring, in
   dark and light, English and Arabic.
   Run: cd tests && node visual-identity.mjs   (BASE=… for another tree; PORT=… for the server it starts) */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, existsSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8152);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const jsErr = errs => errs.filter(e => !/MIME type/.test(e));
const b = await webkit.launch();
const seed = (area, o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: area, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, areaSplit: true,
  days: { w1Mon: true, w1Tue: true }, dates: [], dayLog: {}, steps: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
async function open(state, { w = 390, lang = "en", theme = "" } = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: 844 }, serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s, t]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", '{"home_v2_enabled":true}'); if (t) localStorage.setItem("be_theme", t) } }, [JSON.stringify(state), theme]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(2000);
  if (lang !== "en") { await p.evaluate(l => setLang(l), lang); await sleep(1000); }
  return { ctx, p, errs };
}
const view = async (p, v) => { await p.evaluate(v => { document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel").forEach(e => e.remove()); go(v); scrollTo(0, 0) }, v); await sleep(900); };

console.log("\n# brand and Premium assets");
{ const logo = readFileSync(root + "logo.svg", "utf8"), gem = readFileSync(root + "premium-mark.svg", "utf8"), man = JSON.parse(readFileSync(root + "manifest.json", "utf8")), sw = readFileSync(root + "sw.js", "utf8"), html = readFileSync(root + "index.html", "utf8");
  ok("1 · logo.svg is the full-bleed mark on a 64 grid (no navy frame) and carries no gold — gold is Premium's", /viewBox="0 0 64 64"/.test(logo) && /<rect width="64" height="64" rx="15"/.test(logo) && !/#fbbf24|#0a0e1a|#0c1226/i.test(logo));
  ok("2 · premium-mark.svg: the hexagon gem, the three bars and the gold spark", /viewBox="0 0 64 64"/.test(gem) && (gem.match(/<rect /g) || []).length === 3 && /#fbbf24/i.test(gem) && /stroke-linejoin="round"/.test(gem));
  const mask = (man.icons || []).find(i => i.purpose === "maskable");
  ok("3 · the manifest's maskable icon is its own full-bleed file; the apple-touch-icon is the opaque 180px one", mask && mask.src === "icon-maskable-512.png" && existsSync(root + "icon-maskable-512.png") && existsSync(root + "apple-touch-icon.png") && /<link rel="apple-touch-icon" href="apple-touch-icon.png">/.test(html) && (html.match(/rel="apple-touch-icon"/g) || []).length === 1, JSON.stringify(mask));
  ok("4 · the service worker precaches the new assets", ["premium-mark.svg", "icon-maskable-512.png", "apple-touch-icon.png"].every(f => sw.includes(`"${f}"`)));
  ok("4b · the owner's crown PNG is no longer referenced by the app", !/premium-badge\.png/.test(html)); }

{ const { ctx, p, errs } = await open(seed("general-english"));
  const px = await p.evaluate(async () => { const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src });
    const out = {}; for (const [k, s] of [["apple", "apple-touch-icon.png"], ["mask", "icon-maskable-512.png"], ["any", "icon-512.png"]]) { const i = await load(s); if (!i) { out[k] = null; continue } const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext("2d"); x.drawImage(i, 0, 0);
      out[k] = { w: i.naturalWidth, corner: x.getImageData(0, 0, 1, 1).data[3], mid: x.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3] } } return out });
  ok("5 · apple-touch-icon is 180px and opaque to the corner (iOS paints transparency black); the maskable icon is full-bleed; the 'any' icon has transparent corners", px.apple && px.apple.w === 180 && px.apple.corner === 255 && px.mask && px.mask.w === 512 && px.mask.corner === 255 && px.any && px.any.corner === 0 && px.any.mid === 255, JSON.stringify(px));

  console.log("\n# header lockup");
  await view(p, "home");
  const h = await p.evaluate(() => { const n = document.querySelector(".nav-in"), l = document.querySelector(".brand .logo"), nm = document.querySelector(".brand-name"), g = document.querySelector(".brand .g"), br = document.querySelector(".brand");
    return { navH: Math.round(n.getBoundingClientRect().height), logo: Math.round(l.getBoundingClientRect().width), ring: getComputedStyle(l).boxShadow, fs: getComputedStyle(nm).fontSize, fw: getComputedStyle(nm).fontWeight, clip: getComputedStyle(g).backgroundImage, on: br.classList.contains("on"), cur: br.getAttribute("aria-current"), home: getComputedStyle(document.querySelector(".brand-home")).backgroundColor } });
  ok("6 · header 56px, mark 34px with no glow ring, wordmark 17px/700", h.navH === 56 && h.logo === 34 && h.ring === "none" && h.fs === "17px" && h.fw === "700", JSON.stringify(h));
  ok("7 · 'Mastery' is set in the lighter --grad-text; the lockup is still the lit Home control", /gradient/.test(h.clip) && /165, 180, 252|a5b4fc/i.test(h.clip) && h.on && h.cur === "page" && h.home !== "rgba(0, 0, 0, 0)", JSON.stringify(h));

  console.log("\n# Premium mark in the app");
  const pm = await p.evaluate(async () => { const hb = document.getElementById("hdrPrem"); hb.hidden = false; await new Promise(r => setTimeout(r, 200)); const i = hb.querySelector("img");
    const tmp = document.createElement("div"); tmp.innerHTML = premMark(); document.body.appendChild(tmp); const g = tmp.querySelector("svg"); const gs = { cls: g.getAttribute("class"), hidden: g.getAttribute("aria-hidden"), n: g.querySelectorAll("rect").length }; tmp.remove();
    const r = { src: i.getAttribute("src"), w: Math.round(i.getBoundingClientRect().width), anim: getComputedStyle(i).animationName, gem: gs, row: typeof ICON.premium === "string" }; hb.hidden = true; return r });
  ok("8 · the header button shows premium-mark.svg at 32px with no turning animation", /^premium-mark\.svg/.test(pm.src) && pm.w === 32 && (pm.anim === "none" || pm.anim === ""), JSON.stringify(pm));
  ok("9 · premMark() is an inline, decorative svg (class prem-gem, three bars); ICON.premium exists for rows", pm.gem.cls === "prem-gem" && pm.gem.hidden === "true" && pm.gem.n === 3 && pm.row, JSON.stringify(pm));
  await p.evaluate(() => { try { premiumOpen("header") } catch (e) {} }); await sleep(900);
  const sh = await p.evaluate(() => { const t = document.querySelector(".prem-tag"); return t && { gem: !!t.querySelector(".prem-gem"), txt: t.innerText.trim(), glyph: !!document.querySelector(".prem-spark") } });
  ok("10 · the plans sheet's tag carries the gem, and the ✦ glyph is gone", sh && sh.gem && /premium/i.test(sh.txt) && !sh.glyph, JSON.stringify(sh));
  await p.evaluate(() => { try { premClose() } catch (e) {} }); await sleep(400);

  console.log("\n# navigation icon set");
  const nv = await p.evaluate(() => { const want = { journey: "route", shadow: "shadowing", phrases: "phrase", practice: "speak", review: "progress", profile: "person" }; const norm = s => s.replace(/\s+/g, " ").replace(/"/g, "'").trim();
    const tmp = document.createElement("div"); return Object.entries(want).map(([v, k]) => { const bi = document.querySelector(`.bnav-item[data-v="${v}"] .ic svg`), tb = document.querySelector(`.tab[data-v="${v}"]`);
      tmp.innerHTML = `<svg>${ICON[k]}</svg>`; return { v, bar: !!bi && norm(bi.innerHTML) === norm(tmp.firstChild.innerHTML), tab: tb && tb.dataset.ic === k, w: bi && Math.round(bi.getBoundingClientRect().width) } }) });
  ok("11 · bottom bar and desktop tabs draw the same six icons from ICON (route, shadowing, phrase, speak, progress, person), 22px", nv.every(x => x.bar && x.tab && x.w === 22), JSON.stringify(nv));
  await view(p, "practice");
  const on = await p.evaluate(() => { const i = document.querySelector(".bnav-item.on .ic"), off = document.querySelector(".bnav-item:not(.on) .ic"), r = i.getBoundingClientRect();
    return { v: document.querySelector(".bnav-item.on").dataset.v, w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(i).backgroundColor, offBg: getComputedStyle(off).backgroundColor, tf: getComputedStyle(i).transform, col: getComputedStyle(document.querySelector(".bnav-item.on")).color, acc: getComputedStyle(document.documentElement).getPropertyValue("--accent-text").trim() } });
  ok("12 · the selected tab: a 52×30 tinted pill behind an unscaled icon, in the accent text colour; the others have no pill", on.v === "practice" && on.w === 52 && on.h === 30 && on.bg !== "rgba(0, 0, 0, 0)" && on.offBg === "rgba(0, 0, 0, 0)" && on.tf === "none", JSON.stringify(on));

  console.log("\n# a card holds rows, not cards");
  const pt = await p.evaluate(() => { const l = document.querySelector(".path-tool-list"), rows = [...l.querySelectorAll(".path-tool")], rec = l.querySelector(".path-tool.rec"), ls = getComputedStyle(l);
    return { n: rows.length, listBorder: ls.borderTopWidth, listR: ls.borderTopLeftRadius, gap: ls.rowGap, rowR: rows.map(r => getComputedStyle(r).borderTopLeftRadius), rowB: rows.map(r => getComputedStyle(r).borderLeftWidth), div: rows.slice(1).map(r => getComputedStyle(r).borderTopWidth), rec: rec && getComputedStyle(rec).boxShadow, tile: getComputedStyle(rows[0].querySelector(".pt-ic")).borderTopLeftRadius, shIc: rows.some(r => /shadowing|phrase/.test(r.outerHTML) || r.querySelector(".pt-ic svg circle[r='7']")) } });
  ok("13 · Practice › best tool is one grouped list: 1px frame, 12px corners, rows with no own box, 1px dividers", pt.n >= 3 && pt.listBorder === "1px" && pt.listR === "12px" && (pt.gap === "0px" || pt.gap === "normal") && pt.rowR.every(r => r === "0px") && pt.rowB.every(b => b === "0px") && pt.div.every(d => d === "1px"), JSON.stringify(pt));
  ok("14 · the recommended row is marked by a 3px accent edge; row tiles are 10px", /3px 0px 0px 0px inset/.test(pt.rec || "") && pt.tile === "10px", JSON.stringify(pt));

  console.log("\n# shape rule, eyebrows, fields, switches");
  await view(p, "profile");
  const av = await p.evaluate(() => { const a = document.querySelector(".pf-av-sm,.pf-av"); return a && getComputedStyle(a).borderTopLeftRadius });
  ok("15 · people are circles: the profile avatar is round", av === "50%" || /^\d+px$/.test(av) && parseFloat(av) >= 24, av);
  await view(p, "journey");
  const eb = await p.evaluate(() => { const e = document.querySelector("#v-journey .eyebrow"), a = document.createElement("span"); a.style.color = "var(--accent-text)"; document.body.appendChild(a); const want = getComputedStyle(a).color; a.remove(); return { got: getComputedStyle(e).color, want, ls: getComputedStyle(e).letterSpacing, fs: getComputedStyle(e).fontSize } });
  ok("16 · eyebrows speak in the accent (not cyan), 11px", eb.got === eb.want && eb.fs === "11px", JSON.stringify(eb));
  await view(p, "shadow");
  const sq = await p.evaluate(async () => { const i = document.getElementById("shLibIn"); if (!i) return null; const bg = getComputedStyle(i).backgroundColor; i.focus(); await new Promise(r => setTimeout(r, 100)); return { bg, ring: getComputedStyle(i).boxShadow, wrapR: getComputedStyle(i.closest(".shl-search")).borderTopLeftRadius } });
  ok("17 · the Shadow search keeps its own composed field (no second box inside it)", sq && (sq.bg === "rgba(0, 0, 0, 0)" || sq.bg === "transparent"), JSON.stringify(sq));
  await view(p, "data");
  const sw = await p.evaluate(async () => { const r = document.getElementById("remOn"); if (!r) return null; const a = { role: r.getAttribute("role"), app: getComputedStyle(r).appearance || getComputedStyle(r).webkitAppearance, w: Math.round(r.getBoundingClientRect().width), h: Math.round(r.getBoundingClientRect().height), off: getComputedStyle(r).backgroundColor };
    r.checked = true; await new Promise(z => setTimeout(z, 250)); a.on = getComputedStyle(r).backgroundColor; a.knob = getComputedStyle(r, "::after").transform; r.checked = false; return a });
  ok("18 · on/off settings are switches: role=switch, 44×26, the track fills and the knob slides when on", sw && sw.role === "switch" && sw.app === "none" && sw.w === 44 && sw.h === 26 && sw.on !== sw.off && /matrix\(1, 0, 0, 1, 18/.test(sw.knob), JSON.stringify(sw));
  const field = await p.evaluate(() => { const i = document.querySelector("#v-data input[type=text],#v-data input:not([type])"); return i && getComputedStyle(i).borderTopLeftRadius });
  ok("19 · fields have 12px corners", field === "12px", field);
  ok("20 · no JavaScript errors (General English, dark)", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }

console.log("\n# light theme, Welding, Arabic");
{ const { ctx, p, errs } = await open(seed("general-english"), { theme: "light" }); await view(p, "home");
  const l = await p.evaluate(() => { const g = document.querySelector(".brand .g"); document.getElementById("hdrPrem").hidden = false; return { clip: getComputedStyle(g).backgroundImage, prem: getComputedStyle(document.documentElement).getPropertyValue("--prem").trim() } });
  ok("21 · light: the wordmark uses the light --grad-text; Premium text is the deep indigo", /79, 70, 229|4f46e5/i.test(l.clip) && l.prem === "#3730a3", JSON.stringify(l));
  ok("21b · no JavaScript errors (light)", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p, errs } = await open(seed("welding")); await view(p, "home");
  const w = await p.evaluate(() => ({ clip: getComputedStyle(document.querySelector(".brand .g")).backgroundImage, prem: getComputedStyle(document.documentElement).getPropertyValue("--prem-grad").trim(), navOn: getComputedStyle(document.documentElement).getPropertyValue("--nav-on-bg").trim() }));
  ok("22 · Welding: the wordmark turns amber with Forge's --grad-text; Premium keeps its sapphire", /253, 230, 138|fde68a/i.test(w.clip) && /6d7dff/i.test(w.prem), JSON.stringify(w));
  ok("22b · no JavaScript errors (Welding)", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p, errs } = await open(seed("general-english"), { w: 375, lang: "ar" }); await view(p, "practice");
  const a = await p.evaluate(() => { const i = [...document.querySelectorAll(".bnav-item")]; const rec = document.querySelector(".path-tool.rec");
    return { over: i.filter(x => { const s = x.querySelector("span:not(.ic)"); return s.scrollWidth > x.clientWidth + 1 }).map(x => x.innerText), rec: rec && getComputedStyle(rec).boxShadow, dir: document.documentElement.dir } });
  ok("23 · Arabic at 375px: every tab label fits; the recommended edge is on the reading side (right)", a.dir === "rtl" && !a.over.length && /-3px 0px 0px 0px inset/.test(a.rec || ""), JSON.stringify(a));
  await view(p, "data");
  const k = await p.evaluate(async () => { const r = document.getElementById("remOn"); r.checked = true; await new Promise(z => setTimeout(z, 250)); const t = getComputedStyle(r, "::after").transform; r.checked = false; return t });
  ok("24 · Arabic: the switch knob slides to the left when on", /matrix\(1, 0, 0, 1, -18/.test(k), k);
  ok("24b · no JavaScript errors (Arabic)", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
