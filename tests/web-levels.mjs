/* THE WEB, THREE LEVELS — docs/WEB-STANDALONE.md
   Run: cd tests && node web-levels.mjs            (PORT=… BASE=… as usual)

   The two standalone web apps (scripts/web/build-standalone.mjs) are the store
   apps' shape on the web: one programme each, pinned by be-build.js. A learner
   arriving in a browser meets three doors, and this suite is the evidence that
   each one leads where it says:

     §1  the landing offers all three, and names only this app's programme
     §2  "Start without an account" lets a visitor learn, and is remembered —
         including after a cloud sync replaces S, because the marker is not in S
     §3  the entitlement question is the BUILD's programme, so Premium bought in
         the phone app of this programme is the Premium this web app shows
     §4  a plain browser cannot buy: the sheet says where Premium is sold and
         links THIS app's listing, never the other one
     §5  the combined app at app.lomonec.com/bemastery/ is unchanged — both
         programmes, and the same three doors

   No network: every Worker call is routed to a 404. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";

const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8233);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await chromium.launch();

/* `build` = the programme the bundle is pinned to (null = the combined web app).
   The gate is off on a local host unless be_flags names it (webGateFlag), which
   is exactly what a test must do rather than pretend to be production. */
async function open(build, { mark = false, state = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith(BASE)) return r.continue();
    return r.fulfill({ status: 404, body: "" });                 /* no Worker is reachable in a test */
  });
  await ctx.addInitScript(({ build, mark, state }) => {
    if (build) window.BE_BUILD = { track: build, flags: { billing_enabled: true } };
    localStorage.setItem("be_flags", JSON.stringify({ web_visitor_gate_enabled: true }));
    if (mark) localStorage.setItem("be_web_try", "1");
    if (state) localStorage.setItem("be12_v1", state);
  }, { build, mark, state });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  return { ctx, p, errs };
}
const gate = p => p.evaluate(() => {
  const el = document.getElementById("webGate");
  if (!el) return null;
  const lists = [...el.querySelectorAll(".wv-list")];
  return {
    doors: [...el.querySelectorAll(".wv-actions button")].map(x => x.textContent.trim()),
    headings: [...el.querySelectorAll(".wv-h")].map(x => x.textContent.trim()),
    programmes: lists[0] ? [...lists[0].querySelectorAll("b")].map(x => x.textContent.trim()) : [],
    levels: lists[1] ? [...lists[1].querySelectorAll("b")].map(x => x.textContent.trim()) : [],
    play: (el.querySelector(".wv-foot a") || {}).href || "",
  };
});

console.log("\n# §1 three doors, one programme");
for (const [build, mine, theirs] of [["general-english", "General English", "Welding"], ["welding", "Welding", "General English"]]) {
  const { ctx, p, errs } = await open(build);
  const g = await gate(p);
  ok(`1 · ${build}: the landing is there and offers three ways in`, g && g.doors.length === 3, JSON.stringify(g && g.doors));
  ok(`2 · ${build}: one of them is an account, one is signing in, one needs neither`,
    g && /account/i.test(g.doors[0]) && /sign in/i.test(g.doors[1]) && /without an account/i.test(g.doors[2]), JSON.stringify(g && g.doors));
  ok(`3 · ${build}: it names its OWN programme and not the other`,
    g && g.programmes.length === 1 && g.programmes[0].includes(mine) && !JSON.stringify(g.programmes).includes(theirs), JSON.stringify(g && g.programmes));
  ok(`4 · ${build}: the three levels are described, cheapest first`,
    g && g.levels.length === 3 && /without an account/i.test(g.levels[0]) && /free/i.test(g.levels[1]) && /premium/i.test(g.levels[2]), JSON.stringify(g && g.levels));
  ok(`5 · ${build}: no JavaScript errors`, !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# §2 the door that needs no account");
{
  const { ctx, p, errs } = await open("welding");
  await p.click("#webGate .wv-try");
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({ gate: !!document.getElementById("webGate"), ob: !!document.getElementById("obWrap"),
    mark: localStorage.getItem("be_web_try"), inS: JSON.stringify(JSON.parse(localStorage.getItem("be12_v1") || "{}")).includes("be_web_try") }));
  ok("6 · the landing gives way to onboarding — a visitor can start learning", !after.gate && after.ob, JSON.stringify(after));
  ok("7 · the choice is remembered on the DEVICE, outside the synced state", after.mark === "1" && !after.inS, JSON.stringify(after));
  ok("8 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  /* the marker's reason for living outside S: a sync replaces S wholesale, and
     a device that already chose must not be asked again because another device
     wrote something. */
  const { ctx, p } = await open("welding", { mark: true });
  const g = await gate(p);
  ok("9 · a device that has already chosen is not asked again", g === null, JSON.stringify(g));
  const ob = await p.evaluate(() => !!document.getElementById("obWrap"));
  ok("10 · …it goes straight to onboarding", ob);
  await ctx.close();
}

console.log("\n# §3 the entitlement question is this app's programme");
for (const [build, want] of [["general-english", "general-english"], ["welding", "welding"]]) {
  const { ctx, p } = await open(build);
  const f = await p.evaluate(() => ({ app: entApp(), area: areaId(), plans: planOn(), base: entApiBase() }));
  ok(`11 · ${build}: entApp() is the build's programme — a purchase in that app's store listing is the one this web app reads`,
    f.app === want && f.area === want, JSON.stringify(f));
  ok(`12 · ${build}: with billing on and a service configured, the plan is in force here`, f.plans === true && !!f.base, JSON.stringify(f));
  await ctx.close();
}

console.log("\n# §4 a plain browser cannot buy, and says so");
for (const [build, pkg, other] of [["general-english", "com.bemastery.app", "com.lomonec.bemastery.welding"], ["welding", "com.lomonec.bemastery.welding", "com.bemastery.app"]]) {
  const { ctx, p } = await open(build, { mark: true });
  const f = await p.evaluate(async () => {
    await Billing.init();
    return { why: billingWhy(), provider: Billing.provider && Billing.provider.id, html: premMainHTML() };
  });
  ok(`13 · ${build}: no store provider in a browser tab`, f.why === "no_store" && !f.provider, JSON.stringify({ why: f.why, provider: f.provider }));
  ok(`14 · ${build}: the sheet says Premium is bought in the app`, /Google Play/i.test(f.html) && /can't be bought/i.test(f.html), f.html.slice(0, 200));
  ok(`15 · ${build}: and the link is THIS app's listing, never the other's`,
    f.html.includes(pkg) && !f.html.includes(other), (f.html.match(/id=com[\w.]+/g) || []).join(","));
  await ctx.close();
}

console.log("\n# §5 the combined web app is unchanged");
{
  const { ctx, p, errs } = await open(null);
  const g = await gate(p);
  ok("16 · app.lomonec.com/bemastery/ still offers both programmes", g && g.programmes.length === 2, JSON.stringify(g && g.programmes));
  ok("17 · …with the same three doors", g && g.doors.length === 3, JSON.stringify(g && g.doors));
  ok("18 · …and no programme is pinned", await p.evaluate(() => window.BE_APP_TRACK === null));
  ok("19 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const bad = res.filter(x => !x).length;
console.log(`\n${res.length - bad}/${res.length} passed   (${BASE})`);
process.exit(bad ? 1 : 0);
