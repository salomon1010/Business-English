/* The Home accordion under a real TOUCH screen, at iPhone size, against the
   same rig the phone uses. What only this file adds: taps at real coordinates
   (not .click()), Apple's 44 pt tap target, no clipping or sideways scroll at
   iPhone width, and Safari's own engine.
     cd tests && node home-accordion-touch.mjs                  (localhost rig)
     RIG=http://192.168.1.196:8188 BROWSER=webkit node home-accordion-touch.mjs
   The rig is the working tree plus a seed page; see the report / scratchpad. */
import { chromium, webkit, devices } from "playwright"; import { setTimeout as sleep } from "node:timers/promises";
const BASE = process.env.RIG || "http://127.0.0.1:8188";   /* RIG=http://<LAN ip>:8188 to drive the rig the phone uses */
const ENGINE = process.env.BROWSER === "webkit" ? webkit : chromium;
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
console.log(`  engine: ${process.env.BROWSER || "chromium"} · ${BASE}`);
const b = await ENGINE.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block", colorScheme: "dark" });
await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail|gstatic|googleapis/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
await ctx.route(u => /i\.ytimg\.com|yt3\.googleusercontent\.com/.test(u.href), r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
const p = await ctx.newPage(); const errs = []; /* "A network error occurred." is raised by the Shadow workspace's third-party
   media whenever a clip is opened — home-rows.mjs documents it as pre-existing
   on the unmodified base, and WebKit words it "NetworkError:  A network error
   occurred." Verified here: nothing is raised through load, Home and four
   open/close cycles; it appears only on the clip at P13. */
p.on("pageerror", e => { if (!/A network error occurred/.test(e.message)) errs.push(e.message); });

await p.goto(BASE + "/seed.html"); await sleep(600);
ok("P1 · the rig page loads over the LAN address the phone will use", /iPhone test rig/.test(await p.title() + await p.textContent("h1")));
await p.click("button.go"); await sleep(3500);
await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#syncNudge").forEach(e => e.remove()); }); await sleep(600);

const env = await p.evaluate(() => ({ host: location.hostname, gate: (()=>{try{return webGateOn()}catch(e){return "?"}})(),
  v2: homeV2On(), billing: flag("billing_enabled"), locked: entLocked("recommended_content"),
  rows: document.querySelectorAll(".hx-row").length, cards: document.querySelectorAll(".hx-rcard").length,
  bars: document.querySelectorAll(".hx-row-prem").length, ver: APP_VERSION }));
ok("P2 · the visitor landing does not block a LAN address, so Home is reached directly", env.gate === false, JSON.stringify(env));
ok("P3 · the seed turns billing off, so the recommendation CARDS are the thing on screen — not a Premium bar",
  env.billing === false && env.locked === false && env.bars === 0 && env.cards >= 6, JSON.stringify(env));
ok("P4 · it is serving the working tree, not the old staging snapshot", env.ver === "be12-v687", env.ver);
ok("P5 · the seeded learner gets a real set of groups to open and close", env.rows >= 5, JSON.stringify(env));

const state = () => p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => ({ id: r.dataset.row, open: r.classList.contains("open") })));
const openIds = s => s.filter(x => x.open).map(x => x.id);
const s0 = await state();
ok("P6 · only the strongest signal is open on arrival", openIds(s0).length === 1 && s0[0].open, JSON.stringify(openIds(s0)));
/* real taps at real coordinates, not .click() */
/* scroll it into view first — a tap below the fold lands on nothing, which is
   what a learner's thumb would do too */
const tapRow = async i => { await p.locator(".hx-row").nth(i).scrollIntoViewIfNeeded(); await sleep(250);
  const box = await p.locator(".hx-row").nth(i).locator(".hx-row-tog").boundingBox();
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await sleep(450); };
await tapRow(1); const s1 = await state();
ok("P7 · tapping the second group's header opens it and closes the first", openIds(s1).join() === s0[1].id, JSON.stringify(openIds(s1)));
await tapRow(2); const s2 = await state();
ok("P8 · tapping a third closes the second", openIds(s2).join() === s0[2].id, JSON.stringify(openIds(s2)));
await tapRow(2); const s3 = await state();
ok("P9 · tapping it again leaves every group closed", openIds(s3).length === 0, JSON.stringify(openIds(s3)));

const lay = await p.evaluate(() => {
  const rows = [...document.querySelectorAll(".hx-row")];
  const tog = rows.map(r => r.querySelector(".hx-row-tog").getBoundingClientRect());
  return { pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    clipped: rows.some(r => { const h = r.querySelector(".hx-row-h"); return h.scrollWidth > h.clientWidth + 1; }),
    minTap: Math.round(Math.min(...tog.map(t => Math.min(t.height, t.width)))),
    tapH: Math.round(Math.min(...tog.map(t => t.height))),
    chevVisible: rows.every(r => r.querySelector(".hx-row-chev").getBoundingClientRect().width > 0),
    iw: innerWidth };
});
ok("P10 · no sideways page scroll and no header clipped at iPhone width", !lay.pageOverflow && !lay.clipped, JSON.stringify(lay));
ok("P11 · every expand control is at least 44 px tall — Apple's tap target", lay.tapH >= 44, JSON.stringify(lay));
ok("P12 · the chevron is visible on every group", lay.chevVisible, JSON.stringify(lay));
/* a card tap must open the activity, not toggle */
await tapRow(0); await sleep(300);
const before = openIds(await state()).join();
await p.locator(".hx-row.open .hx-rcard").first().scrollIntoViewIfNeeded(); await sleep(250);
const cb = await p.locator(".hx-row.open .hx-rcard").first().boundingBox();
await p.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2); await sleep(2500);
const went = await p.evaluate(() => (typeof cur !== "undefined" && cur) ? cur.v : "?");
ok("P13 · tapping a card opens its activity rather than collapsing the group", went !== "home", String(went));
await p.evaluate(() => { try { shCloseWork() } catch (e) {} go("home"); }); await sleep(1600);
ok("P14 · coming back to Home keeps the group the learner chose", openIds(await state()).join() === before, JSON.stringify({ before, now: openIds(await state()) }));
await p.reload(); await sleep(3000);
await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#syncNudge").forEach(e => e.remove()); go("home"); }); await sleep(1600);
const rel = await state();
ok("P15 · reloading the page goes back to the strongest signal", openIds(rel).length === 1 && rel[0].open, JSON.stringify(openIds(rel)));
ok("P16 · no JavaScript errors", errs.length === 0, errs.join(" | "));
await p.screenshot({ path: "/private/tmp/claude-501/-Users-salomonnorengoucheme-Developer-be-staging/31d47be6-605d-42b5-aa33-2ba52c6bb001/scratchpad/rig-" + (process.env.BROWSER || "chromium") + ".png" });
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
