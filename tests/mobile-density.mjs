/* Mobile typography & density (29 Sep 2026, feature/bemastery-complete-ux-redesign).
   docs/MOBILE_TYPOGRAPHY_DENSITY_AUDIT.md has the before/after figures these checks hold.
   Run: cd tests && node mobile-density.mjs   (BASE=… for another tree; PORT=… for the server it starts) */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8148);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await webkit.launch();
const DAY = 864e5, d = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const seed = (area, o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: area, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, areaSplit: true,
  days: {}, dates: [], dayLog: {}, steps: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
async function open(state, w = 375, lang = "en", plans = false) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: 760 }, serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.route(u => /127\.0\.0\.1:9\//.test(u.href), r => r.fulfill({ status: 503, body: "" }));
  /* plans = Premium can be bought: billing on + a (stubbed, unreachable) entitlement service — localhost only */
  await ctx.addInitScript(([s, pl]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", pl ? '{"home_v2_enabled":true,"billing_enabled":true}' : '{"home_v2_enabled":true}'); if (pl) localStorage.setItem("be_ent_api", "http://127.0.0.1:9/ent") } }, [JSON.stringify(state), plans]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(2000);
  if (lang !== "en") { await p.evaluate(l => setLang(l), lang); await sleep(1000); }
  return { ctx, p, errs };
}
const view = async (p, v) => { await p.evaluate(v => { document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel").forEach(e => e.remove()); go(v); scrollTo(0, 0) }, v); await sleep(1000); };
/* this month's label is inside the visible part of the year grid (either direction) */
const yearNowSrc = `(() => { const y = document.querySelector("#v-review .pcal-year"); if (!y) return false; const r = y.getBoundingClientRect(); const m = new Date().toLocaleDateString(document.documentElement.lang || "en", { month: "short" });
  const labs = [...y.querySelectorAll("*")].filter(e => !e.children.length && e.innerText && e.innerText.trim()); const l = labs.reverse().find(e => e.innerText.trim().toLowerCase().startsWith(m.toLowerCase().slice(0, 3))) || null;
  if (!l) return "no-label:" + m; const q = l.getBoundingClientRect(); return q.left >= r.left - 2 && q.right <= r.right + 2 })()`;
const jsErr = errs => errs.filter(e => !/MIME type/.test(e));

console.log("\n# the bottom bar: compact icon, readable label, the selected item never grows");
for (const [w, lang] of [[375, "en"], [375, "fr"], [375, "ar"], [430, "en"]]) {
  const { ctx, p, errs } = await open(seed("general-english", { days: { w1Mon: true } }), w, lang); await view(p, "review");
  const n = await p.evaluate(() => { const i = [...document.querySelectorAll(".bnav-item")], on = document.querySelector(".bnav-item.on");
    return { icon: Math.round(i[0].querySelector(".ic svg").getBoundingClientRect().width), label: getComputedStyle(i[0].querySelector("span:not(.ic)")).fontSize, minH: Math.min(...i.map(x => x.getBoundingClientRect().height)),
      over: i.filter(x => { const s = x.querySelector("span:not(.ic)"); return s.scrollWidth > x.clientWidth + 1 }).map(x => x.innerText), onScale: getComputedStyle(on.querySelector(".ic")).transform, onW: getComputedStyle(on.querySelector("span:not(.ic)")).fontWeight } });
  ok(`1 · ${w}px ${lang}: 22px icons, 10px labels, every label on one line, items ≥44px, the selected icon not scaled, its label bold`, n.icon === 22 && n.label === "10px" && !n.over.length && n.minH >= 44 && n.onScale === "none" && +n.onW >= 700, JSON.stringify(n));
  ok(`1b · ${w}px ${lang}: no JavaScript errors`, !jsErr(errs).length, errs.join(" | ")); await ctx.close();
}

console.log("\n# Progress: short tiles, the number leads, and 'Your record' is on the page again");
{ const { ctx, p, errs } = await open(seed("general-english", { days: { w1Mon: true, w1Tue: true }, dates: [d(2), d(1)], dayLog: { [d(2)]: 1, [d(1)]: 1 }, dayLogA: { "general-english": { [d(2)]: 1, [d(1)]: 1 } } }));
  await view(p, "review"); await sleep(300);
  const s = await p.evaluate(() => { const st = [...document.querySelectorAll(".pg-ess .stat")]; return { h: st.map(x => Math.round(x.getBoundingClientRect().height)), n: parseFloat(getComputedStyle(st[0].querySelector(".n")).fontSize), l: parseFloat(getComputedStyle(st[0].querySelector(".l")).fontSize) } });
  ok("2 · stat tiles ≤76px (were 78–90); the number ≥20px, the label 12px", s.h.every(h => h <= 76) && s.n >= 20 && s.l === 12, JSON.stringify(s));
  await p.evaluate(src => { window.__yn = src }, yearNowSrc);
  const r = await p.evaluate(() => { const v = document.getElementById("v-review"), more = v.querySelector("details.pg-more"), h = v.querySelector(".pg-record-h"), yr = v.querySelector(".pg-year"), core = h && h.nextElementSibling;
    const txt = (h ? h.innerText : "") + "\n" + (core ? core.innerText : "") + "\n" + (yr ? yr.innerText : "");
    const yearNow = () => eval(window.__yn); return { head: h && h.innerText, outsideFold: !!h && !more.contains(h) && !!yr && !more.contains(yr), open: more.open, txt, dupYear: v.querySelectorAll(".pg-year").length, empty: [...v.querySelectorAll(".pf-stats .stat")].map(x => x.classList.contains("stat-empty")),
      yearScrolled: yearNow() } });
  ok("3 · 'Your record' sits on the page, outside 'See all details' (which stays closed)", r.head === "Your record" && r.outsideFold && !r.open, JSON.stringify(r));
  ok("4 · it shows the five figures: phrases & idioms mastered, Shadowing clips saved, best streak, days practised, consistency", /Phrases & idioms mastered/.test(r.txt) && /Shadowing clips saved/.test(r.txt) && /best streak/i.test(r.txt) && /Days practised/i.test(r.txt) && /consistency/i.test(r.txt), r.txt);
  ok("5 · the year grid appears once, opened on this month; counts still at zero recede", r.dupYear === 1 && r.yearScrolled && r.empty.every(Boolean), JSON.stringify({ d: r.dupYear, y: r.yearScrolled, e: r.empty }));
  await p.evaluate(() => { const m = document.querySelector("details.pg-more"); m.open = true }); await sleep(400);
  const more = await p.evaluate(() => { const m = document.querySelector("details.pg-more"); return { share: !!m.querySelector(".pf-act"), year: m.querySelectorAll(".pg-year").length } });
  ok("6 · 'See all details' keeps the rest (share card …) and no second year grid", more.share && more.year === 0, JSON.stringify(more));
  const nud = await p.evaluate(() => { const n = document.querySelector(".sync-nudge"); if (!n) return null; const b = n.querySelector(".auth-go").getBoundingClientRect(); return { h: Math.round(n.getBoundingClientRect().height), btn: Math.round(b.height) } });
  ok("7 · the sign-in bar is two lines beside its button: ≤80px (was 125), button ≥40px", !nud || (nud.h <= 80 && nud.btn >= 40), JSON.stringify(nud));
  ok("7b · no JavaScript errors", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }

{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true } }), 375, "ar"); await view(p, "review"); await sleep(400);
  const yn = await p.evaluate(src => eval(src), yearNowSrc);
  ok("5b · Arabic (right-to-left): the year grid opens on this month, not last October", yn === true, String(yn)); await ctx.close(); }

console.log("\n# headings carry rank by weight; Practice's recommended row is not squeezed");
{ const { ctx, p, errs } = await open(seed("general-english", { days: { w1Mon: true, w1Tue: true } }));
  await view(p, "practice");
  const h = await p.evaluate(() => { const s = document.querySelector(".prac-sec"), rec = document.querySelector(".path-tool.rec"), t = rec && rec.querySelector(".pt-t"), c = rec && rec.querySelector(".chip");
    return { sec: getComputedStyle(s).fontSize + "/" + getComputedStyle(s).fontWeight, tW: t && Math.round(t.getBoundingClientRect().width), rowW: rec && Math.round(rec.getBoundingClientRect().width), chipBelow: c && c.getBoundingClientRect().top >= t.getBoundingClientRect().bottom - 1 } });
  ok("8 · section headings 17px/700 (were 19–26px/800)", h.sec === "17px/700", JSON.stringify(h));
  ok("9 · the 'Recommended' chip sits under the text, which keeps the row's width", h.chipBelow && h.tW >= h.rowW - 90, JSON.stringify(h));
  await view(p, "profile");
  const g = await p.evaluate(() => getComputedStyle(document.querySelector(".pf-group-h")).fontWeight);
  ok("10 · Profile group headings weight 700 (were 800)", g === "700", g);
  await view(p, "home");
  const hh = await p.evaluate(() => [...document.querySelectorAll("#v-home h3")].filter(e => e.getBoundingClientRect().height).map(e => getComputedStyle(e).fontSize));
  ok("10c · Home's own row headings keep their sizes (15 / 14 / 16px, owner 28 Sep) — the density block does not touch them", hh.length >= 3 && hh.slice(0, 3).join() === "15px,14px,16px", JSON.stringify(hh));
  await view(p, "roleplay"); await sleep(400);
  const rh = await p.evaluate(() => { const h = document.querySelector("#v-roleplay h3:not([class])"); return h && getComputedStyle(h).fontSize });
  ok("10d · Life Simulations group headings 17px (were the browser's 18.72px default)", rh === "17px", rh);
  ok("10b · no JavaScript errors", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Welding: the same record, from the Welding record; no General English features");
{ const { ctx, p, errs } = await open(seed("welding", { days: { "welding:w1Mon": true } }));
  await view(p, "review");
  const w = await p.evaluate(() => { const v = document.getElementById("v-review"), more = v.querySelector("details.pg-more"), h = v.querySelector(".pg-record-h");
    return { head: !!h && !more.contains(h), year: v.querySelectorAll(".pg-year").length, ge: !!document.querySelector(".view.on .hx") || !!document.querySelector("#hxOnline:not([hidden])") || !!(document.getElementById("ppFab") && document.getElementById("ppFab").offsetParent), area: areaId() } });
  ok("11 · Welding Progress: 'Your record' on the page, one year grid, no Home V2 hero / online pill / partner button", w.area === "welding" && w.head && w.year === 1 && !w.ge, JSON.stringify(w));
  ok("11b · no JavaScript errors", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }

console.log("\n# 'Your record' is a Premium report — only where Premium can be bought, never destroying anything");
const recState = () => document.getElementById("v-review") && (() => { const v = document.getElementById("v-review"), more = v.querySelector("details.pg-more"), lock = v.querySelector(".pg-rec-lock");
  return { plans: planOn(), lock: !!lock && !more.contains(lock), txt: lock ? lock.innerText : "", stats: !!v.querySelector(".pf-stats-2"), year: v.querySelectorAll(".pg-year").length, head: !!v.querySelector(".pg-record-h") } })();
const geDone = seed("general-english", { days: { w1Mon: true, w1Tue: true }, dates: [d(1)], dayLog: { [d(1)]: 1 }, dayLogA: { "general-english": { [d(1)]: 1 } } });
{ const { ctx, p, errs } = await open(geDone, 375, "en", true); await view(p, "review");
  const r = await p.evaluate(recState);
  ok("12 · plans on, a free General English learner: the heading stays, the report becomes the Premium card — no counts, no year grid", r.plans && r.head && r.lock && !r.stats && r.year === 0, JSON.stringify(r));
  ok("13 · the card names all six parts, says the practice is still counted and kept, and what Free keeps", ["Phrases & idioms mastered", "Shadowing clips saved", "best streak", "Days practised", "consistency", "Your year"].every(x => r.txt.toLowerCase().includes(x.toLowerCase())) && /still counted and kept/.test(r.txt) && /Free keeps this week, your streak, your sessions and your certificate/.test(r.txt), r.txt);
  ok("13b · no countdown, no 'lose', no blurred figures in the card", !/\d+:\d\d|lose|lost|expire|only \d/i.test(r.txt) && !(await p.evaluate(() => [...document.querySelectorAll(".pg-rec-lock *")].some(e => /blur/.test(getComputedStyle(e).filter)))), r.txt);
  const ess = await p.evaluate(() => document.querySelectorAll(".pg-ess .stat").length + document.querySelectorAll(".pg-mile").length);
  ok("14 · Free keeps this week's four numbers and the certificate milestone", ess === 5, String(ess));
  await p.click(".pg-rec-go"); await sleep(700);
  ok("15 · 'See Premium plans' opens the plans sheet, from progress_record", await p.evaluate(() => { const o = document.getElementById("premOv"); return !!o && o.dataset.from === "progress_record" }));
  await p.evaluate(() => { window.entIsPremiumForDisplay = () => true; premClose && premClose(); go("review") }); await sleep(900);
  const pr = await p.evaluate(recState);
  ok("16 · a Premium learner: the full report, no Premium card", !pr.lock && pr.stats && pr.year === 1, JSON.stringify(pr));
  ok("16b · no JavaScript errors", !jsErr(errs).length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p, errs } = await open(seed("welding", { days: { "welding:w1Mon": true } }), 375, "en", true); await view(p, "review");
  const r = await p.evaluate(recState);
  ok("17 · plans on, Welding (Premium is General English only): the report as before", r.plans && !r.lock && r.stats && r.year === 1, JSON.stringify(r)); await ctx.close(); }
for (const [lang, h] of [["fr", "Votre relevé complet fait partie de Premium"], ["ar", "سجلّك الكامل جزء من Premium"]]) {
  const { ctx, p } = await open(geDone, 375, lang, true); await view(p, "review");
  const r = await p.evaluate(() => { const l = document.querySelector(".pg-rec-lock"); if (!l) return null; const b = l.getBoundingClientRect(); return { t: l.innerText, dir: getComputedStyle(l).direction, off: [...l.querySelectorAll("*")].some(e => { const q = e.getBoundingClientRect(); return q.width && (q.left < b.left - 1 || q.right > b.right + 1) }) } });
  ok(`18 · ${lang}: the Premium card is translated and nothing leaves the card`, r && r.t.includes(h) && !r.off && (lang !== "ar" || r.dir === "rtl"), JSON.stringify(r));
  if (process.env.OUT) { await p.evaluate(() => { document.querySelectorAll(".sync-nudge").forEach(e => e.remove()); document.querySelector(".pg-rec-lock").scrollIntoView({ block: "center" }) }); await sleep(300); await p.screenshot({ path: `${process.env.OUT}/record-premium-${lang}.png` }) }
  await ctx.close(); }
{ const { ctx, p } = await open(geDone, 375, "en", true); await view(p, "review");
  if (process.env.OUT) { await p.evaluate(() => { document.querySelectorAll(".sync-nudge").forEach(e => e.remove()); document.querySelector(".pg-rec-lock").scrollIntoView({ block: "center" }) }); await sleep(300); await p.screenshot({ path: `${process.env.OUT}/record-premium-en.png` }) }
  await ctx.close(); }

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
