/* Welding Practice = five tools; Career Destination moved out of the header (owner, 29 Sep 2026).
   Run: cd tests && node welding-practice-career.mjs        (BASE=… to test another tree)

   The Welding header carried an "International · Welder" chip that opened the Career
   Center. It is gone; Career Destination is now tool 5 on Welding Practice, after
   4 · Practice text shadowing (the workplace lines). General English keeps its
   Practice page and its header exactly as they were. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8131);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await chromium.launch();
const seed = (tr, lang = "en") => ({ profile: { name: "Alex", lang, ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
async function open(track, { width = 390, hash = "", lang = "en" } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, lang]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_lang", lang); }, [JSON.stringify(seed(track, lang)), lang]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + hash); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()));
  return { ctx, p, errs };
}
const tools = p => p.evaluate(() => [...document.querySelectorAll("#v-practice .path-tool-list .path-tool")].map(x => ({ t: x.querySelector("b").textContent.trim(), on: x.getAttribute("onclick") })));
const litTab = p => p.evaluate(() => [...document.querySelectorAll(".bnav-item")].filter(b => b.classList.contains("on") || b.getAttribute("aria-current") === "page").map(b => b.dataset.v).join(","));
const WELD = ["Shadowing Studio", "Phrase Lab & Executive Polish", "Vocabulary & grammar drills", "Practice text shadowing", "Career Destination"];

console.log("\n# Welding header");
{
  const { ctx, p, errs } = await open("welding");
  const h = await p.evaluate(() => ({ chip: !!document.getElementById("trackIndicator"), any: document.querySelectorAll("nav .track-indicator").length, txt: document.querySelector("nav").innerText, dataTrack: document.documentElement.getAttribute("data-track") }));
  ok("1 · the International Welder chip is gone from the header", !h.chip && !h.any && !/INTERNATIONAL/i.test(h.txt), JSON.stringify(h));
  ok("1b · the page is still themed as Welding (data-track)", h.dataTrack && h.dataTrack !== "general", h.dataTrack);

  console.log("\n# Welding Practice — five tools, in order");
  await p.evaluate(() => go("practice")); await sleep(400);
  const tl = await tools(p);
  ok("4/5 · exactly five tools: 1–3 unchanged, 4 = Practice text shadowing, 5 = Career Destination", JSON.stringify(tl.map(x => x.t)) === JSON.stringify(WELD), JSON.stringify(tl.map(x => x.t)));
  const days = {};
  for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) days[d] = await p.evaluate(d => { const o = currentPos; currentPos = () => ({ ...o(), d }); const n = new DOMParser().parseFromString(pathToolsHTML(), "text/html").querySelectorAll(".path-tool").length; currentPos = o; return n; }, d);
  ok("4/5 · five tools on every day of the week (the Thu/Sat conversation row stays on Life Simulations)", Object.values(days).every(n => n === 5), JSON.stringify(days));

  console.log("\n# tools 1–3 still go where they went");
  for (const [i, v] of [[0, "shadow"], [1, "phrases"], [2, "practice"]]) {
    await p.evaluate(() => go("practice")); await sleep(300);
    await p.locator("#v-practice .path-tool").nth(i).click(); await sleep(400);
    ok(`8 · tool ${i + 1} opens ${v}`, (await p.evaluate(() => cur.v)) === v);
  }

  console.log("\n# 4 · Practice text shadowing");
  await p.evaluate(() => go("practice")); await sleep(300);
  await p.locator("#v-practice .path-tool").nth(3).click(); await sleep(700);
  const ln = await p.evaluate(() => ({ v: cur.v, lines: !!document.querySelector("#v-shadow .sh-lines"), rows: document.querySelectorAll("#v-shadow .sh-lines .shl-row, #v-shadow .sh-lines [data-line], #v-shadow .sh-lines li, #v-shadow .sh-lines .sh-line").length, video: !!document.querySelector("#v-shadow #shLib") }));
  ok("4 · opens the workplace lines (the same list the Shadow tab shows, not a copy)", ln.v === "shadow" && ln.lines, JSON.stringify(ln));

  console.log("\n# 5 · Career Destination");
  await p.evaluate(() => go("practice")); await sleep(300);
  await p.locator("#v-practice .path-tool").nth(4).click(); await sleep(500);
  const cc = await p.evaluate(() => ({ v: cur.v, cc: !!document.querySelector("#v-career .career-center"), back: (document.querySelector("#v-career .career-center .back") || {}).textContent }));
  ok("2/3 · opens the existing Career Center from Practice", cc.v === "career" && cc.cc, JSON.stringify(cc));
  ok("13 · its back button names Practice", /Practice/.test(cc.back || ""), cc.back);
  ok("13 · the Practice tab is lit on the Career page", (await litTab(p)) === "practice", await litTab(p));
  const before = await p.evaluate(() => S.careerCenter.destination);
  const other = before === "canada" ? "nigeria" : "canada";
  await p.evaluate(id => CareerCenter.select(id), other); await sleep(500);
  const after = await p.evaluate(() => ({ d: S.careerCenter.destination, stored: JSON.parse(localStorage.getItem("be12_v1")).careerCenter.destination, v: cur.v }));
  ok("7 · changing the destination saves it (S and localStorage) and stays on the Career page", after.d === other && after.stored === other && after.v === "career", JSON.stringify(after));
  /* the page-label bar that holds this Back has been hidden app-wide since 22 Sep 2026 (.pg-eyebrow),
     so on a phone the way back is the lit Practice tab; both are checked */
  await p.evaluate(() => careerBack()); await sleep(500);
  ok("13 · careerBack() returns to Practice, even after a destination change", (await p.evaluate(() => cur.v)) === "practice");
  await p.evaluate(() => goCareer("practice")); await sleep(300);
  await p.locator('.bnav-item[data-v="practice"]').click(); await sleep(500);
  ok("13 · tapping the lit Practice tab on the Career page lands on Practice", (await p.evaluate(() => cur.v)) === "practice");
  ok("7 · …and the destination is still the new one", (await p.evaluate(() => S.careerCenter.destination)) === other);
  ok("5 tools still in order after the round trip", JSON.stringify((await tools(p)).map(x => x.t)) === JSON.stringify(WELD));
  await p.evaluate(() => goCareer("home")); await sleep(300);
  await p.evaluate(() => careerBack()); await sleep(400);
  ok("13 · from Home's Career Center row, Back still goes Home (owner rule kept)", (await p.evaluate(() => cur.v)) === "home");
  ok("14 · no page errors on Welding", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# 6 · old deep link");
{
  const { ctx, p, errs } = await open("welding", { hash: "#career" });
  const d = await p.evaluate(() => ({ v: cur.v, cc: !!document.querySelector("#v-career .career-center") }));
  ok("6 · index.html#career still opens Career Destination", d.v === "career" && d.cc, JSON.stringify(d));
  await p.evaluate(() => careerBack()); await sleep(400);
  ok("6 · …and its Back lands Home (not a dead end)", (await p.evaluate(() => cur.v)) === "home");
  ok("14 · no page errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# 9/10 · General English is unchanged");
{
  const { ctx, p, errs } = await open("general-english");
  const h = await p.evaluate(() => ({ chip: !!document.getElementById("trackIndicator"), dataTrack: document.documentElement.getAttribute("data-track") }));
  ok("9 · no chip on General English (as before)", !h.chip && h.dataTrack === "general", JSON.stringify(h));
  await p.evaluate(() => go("practice")); await sleep(400);
  const tl = (await tools(p)).map(x => x.t);
  ok("9 · General English Practice has no text-shadowing or Career tool", !tl.includes("Practice text shadowing") && !tl.includes("Career Destination") && tl.slice(0, 3).join("|") === WELD.slice(0, 3).join("|"), JSON.stringify(tl));
  ok("10 · pathTools() on General English has neither id", await p.evaluate(() => !pathTools().some(x => x.id === "lines" || x.id === "career")));
  ok("9 · General English Shadow is still the video library, not workplace lines", await p.evaluate(() => { go("shadow"); return !document.querySelector("#v-shadow .sh-lines"); }));
  ok("14 · no page errors on General English", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# 12 · i18n (French)");
{
  const { ctx, p } = await open("welding", { lang: "fr" });
  await p.evaluate(async () => { if (typeof setLang === "function") await setLang("fr"); go("practice"); }); await sleep(900);
  const tl = (await tools(p)).map(x => x.t);
  ok("12 · tools 4 and 5 read in French", tl[3] === "Shadowing sur texte" && tl[4] === "Destination professionnelle", JSON.stringify(tl));
  await ctx.close();
}

console.log("\n# 11 · widths");
for (const w of [375, 390, 400, 428, 430, 1280]) {
  const { ctx, p } = await open("welding", { width: w });
  await p.evaluate(() => go("practice")); await sleep(400);
  const m = await p.evaluate(() => {
    const doc = document.documentElement, rows = [...document.querySelectorAll("#v-practice .path-tool")];
    const hs = rows.map(r => Math.round(r.getBoundingClientRect().height));
    const clip = rows.some(r => [...r.querySelectorAll("b,small")].some(x => x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflow !== "visible"));
    const out = rows.some(r => { const b = r.getBoundingClientRect(); return b.right > innerWidth + 0.5 || b.left < -0.5; });
    const nav = document.querySelector("nav").getBoundingClientRect();
    return { hscroll: doc.scrollWidth > innerWidth, n: rows.length, hs, min: Math.min(...hs), max: Math.max(...hs), clip, out, navH: Math.round(nav.height) };
  });
  ok(`11 · ${w}px: five rows, no horizontal scroll, nothing clipped or off-screen, rows ≥ 44 px`, m.n === 5 && !m.hscroll && !m.clip && !m.out && m.min >= 44, JSON.stringify(m));
  await p.screenshot({ path: `${process.env.SHOTS || "/tmp"}/wpc-practice-${w}.png`, fullPage: false });
  await p.evaluate(() => window.scrollTo(0, 0));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
