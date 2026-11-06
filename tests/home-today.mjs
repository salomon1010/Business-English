/* CURRICULUM-FIRST TODAY — owner-approved redesign, 4 Nov 2026, General English
   only. Run: cd tests && node home-today.mjs        (BASE=… for another tree)

   Written alongside the redesign (not after it): the Explore grid is gone from
   General English Home, the "Because you…" rows stay exactly where they were,
   the hero names today's one tool as a real deep link, a speaking day with a
   defined MissionEngine competency previews itself honestly ("Start today's
   mission"), a new "N of 84 sessions · next milestone" strip sits under the rows,
   and a "Today" tab is the primary entry point on both the desktop nav and the
   phone's bottom bar. Welding must see none of it: isGeneralEnglish() gates
   every line this file checks, and Welding's own Explore grid must still be
   exactly what it was before this redesign touched General English. */
import { chromium, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8924);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 500)}`); };
const b = await chromium.launch();
const seed = (o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: 1, lastSeen: 1, backupAsked: 1, ...o });
async function open(state = {}, opts = {}) {
  const ctx = await b.newContext({ ...(opts.device || devices["iPhone 13"]), serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s]) => { localStorage.setItem("be12_v1", s); }, [JSON.stringify(seed(state))]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + (opts.hash || "")); await sleep(1800);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs };
}
const hero = p => p.evaluate(() => {
  const h = document.querySelector(".hx"); if (!h) return null;
  const tb = document.querySelector(".hx-today-tool"), mb = document.querySelector(".hx-today-mission");
  const prog = document.querySelector(".home-today-progress");
  return {
    cta: h.querySelector(".hx-cta").innerText.replace(/→/g, "").trim(),
    tool: tb ? { label: tb.innerText.replace(/→/g, "").trim(), go: tb.getAttribute("onclick") } : null,
    missionTag: mb ? mb.innerText.trim() : null,
    exploreGrid: document.querySelectorAll(".hx-dcard").length,
    progress: prog ? { text: prog.innerText.replace(/\n/g, " ").trim(), go: prog.getAttribute("onclick") } : null,
    rowsPresent: !!document.getElementById("hxRows"),
  };
});

console.log("# Monday · classic tool day (shadow), no mission");
{ const { ctx, p, errs } = await open();
  const h = await hero(p);
  ok("1 · the CTA is still the plain 'Start session' — Monday has no mission", h.cta === "Start session", h.cta);
  ok("2 · Today's tool names the exact deep link the classic session page uses (Open the Shadow Studio, Week 1 Mon)", h.tool && /Open the Shadow Studio/.test(h.tool.label) && /sessGo\('shadow',1,'Mon'\)/.test(h.tool.go), JSON.stringify(h.tool));
  ok("3 · no mission tag on a non-speaking day", h.missionTag === null, h.missionTag);
  ok("4 · the Explore grid is gone from General English Home", h.exploreGrid === 0, h.exploreGrid);
  ok("5 · the rows are exactly where they were — not removed, not collapsed behind a fold", h.rowsPresent, JSON.stringify(h));
  ok("6 · the progress strip names the programme position and opens the Road map", h.progress && /0 of 84 sessions · Week 1 of 12/.test(h.progress.text) && /Next milestone: review after Week 4/.test(h.progress.text) && /go\('journey'\)/.test(h.progress.go), JSON.stringify(h.progress));
  await p.click(".hx-today-tool"); await sleep(800);
  const dest = await p.evaluate(() => cur.v);
  ok("7 · tapping Today's tool actually opens Shadow", dest === "shadow", dest);
  ok("8 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Tuesday, missions at their PRODUCTION default — the owner's 24 Sep 2026 kill switch");
{ /* missionsOn() reads localStorage.be_missions, off everywhere today (mvPack
     comment, index.html ~12006): "every day opens the classic session page…
     the suites (and a maker) turn it back on with localStorage.be_missions=1".
     My own mission preview reads mvComps() — the SAME gate every other mission
     surface reads through — so with the switch off (the real default) it must
     stay silent: a speaking day is still a plain "Start session", not a promise
     the app will not keep. This is the one check that would have caught me
     describing a disabled feature as live. */
  const { ctx, p, errs } = await open({ days: { w1Mon: true } });
  const h = await hero(p);
  ok("9 · missions OFF (today's real default): Tuesday still reads 'Start session', not 'Start today's mission'", h.cta === "Start session", h.cta);
  ok("9b · … and no guided-mission tag either", h.missionTag === null, h.missionTag);
  await ctx.close(); }
console.log("\n# Tuesday, missions ON — the maker/suite switch mission-week2.mjs and friends already use");
{ const { ctx, p, errs } = await open({ days: { w1Mon: true } });
  await p.evaluate(() => { try { localStorage.setItem("be_missions", "1"); } catch (e) {} });
  await p.reload(); await sleep(1800);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  const h = await hero(p);
  ok("10 · the CTA previews the real destination honestly: 'Start today's mission', not a plain 'session'", h.cta === "Start today's mission", h.cta);
  ok("11 · the guided-mission tag is shown", h.missionTag && /Guided mission/.test(h.missionTag), h.missionTag);
  ok("12 · Tuesday has no sessionLinks entry, so no separate tool button duplicates the mission", h.tool === null, JSON.stringify(h.tool));
  await p.evaluate(() => document.querySelector(".hx-cta").click()); await sleep(1200);
  /* the route stays "session" (rSession's own wrapper always renders into
     #v-journey, with no separate "mission" route for the daily hand-off —
     go('mission',id,step) is a different, directly-reachable page); what
     actually changes is the MARKUP inside it: rSessionV2 draws the guided
     mission dock (.mv-dock) in place of the classic timer/template/recorder */
  const v = await p.evaluate(() => ({ v: cur.v, guided: !!document.querySelector(".mv-dock") }));
  ok("13 · the button genuinely opens the guided mission flow (rSession's own v2&&sessIsSpeaking hand-off), not a bare session page", v.v === "session" && v.guided, JSON.stringify(v));
  ok("14 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Welding sees none of this — isGeneralEnglish() gates every line above");
{ const { ctx, p, errs } = await open({ professionalTracks: { activeId: "welding" } }, { flags: {} });
  await p.evaluate(() => { localStorage.setItem("be_flags", JSON.stringify({ welding_studio_enabled: true })); });
  await p.reload(); await sleep(1800);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  const w = await p.evaluate(() => ({
    today: document.querySelectorAll(".hx-today-tool,.hx-today-mission").length,
    progress: !!document.querySelector(".home-today-progress"),
    exploreGrid: document.querySelectorAll(".hx-dcard").length,
  }));
  ok("15 · no Today-specific line on Welding's hero", w.today === 0, JSON.stringify(w));
  ok("16 · no 'N of 84 sessions' strip on Welding (that is a General English fact, not a Welding one)", !w.progress, JSON.stringify(w));
  ok("17 · Welding's own Explore grid is untouched by this redesign — still there, still full", w.exploreGrid >= 4, w.exploreGrid);
  ok("18 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Navigation — Today is the first, primary tab, on phone and desktop");
{ const { ctx, p, errs } = await open({}, { device: devices["iPhone 13"] });
  const m = await p.evaluate(() => { const items = [...document.querySelectorAll(".bnav-item")]; return { first: items[0] && items[0].dataset.v, labels: items.map(i => i.dataset.v), todayOn: items[0] && items[0].classList.contains("on") }; });
  ok("19 · phone bottom bar: Today is the first item and lands on Home", m.first === "home", JSON.stringify(m.labels));
  ok("20 · … and it is lit, since Home is the page open", m.todayOn, JSON.stringify(m));
  await ctx.close(); }
{ const ctx = await b.newContext({ viewport: { width: 900, height: 800 } });
  await ctx.addInitScript(([s]) => localStorage.setItem("be12_v1", s), [JSON.stringify(seed())]);
  const p = await ctx.newPage();
  await p.goto(BASE + "/index.html"); await sleep(1500);
  const d = await p.evaluate(() => { const nav = document.querySelector(".nav-in"); const tabs = [...document.querySelectorAll(".nav-in .tab")];
    return { first: tabs[0] && tabs[0].dataset.v, count: tabs.length, overflow: nav.scrollWidth > nav.getBoundingClientRect().width + 1 }; });
  ok("21 · desktop, 900px (the narrow 821-1023px band a past QA pass tuned): seven tabs, Today first, no overflow", d.first === "home" && d.count === 7 && !d.overflow, JSON.stringify(d));
  await ctx.close(); }

console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
await b.close(); if (srv) srv.kill();
process.exit(res.every(Boolean) ? 0 : 1);
