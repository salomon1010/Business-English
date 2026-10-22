/* The usage meters — the allowance shown BEFORE the expensive activity
   (22 October 2026, docs/USAGE-LIMITS-ANDROID.md).
   Run: cd tests && node usage-meters.mjs

   What this proves is the DISPLAY contract, which is all a meter is. Who is
   allowed to spend is proved by backend/test-premium-gate.mjs against the real
   Worker module, and the metering itself by backend/test-rate-limit.mjs; the
   point of the checks below is that the card never invents a figure, never
   contradicts the server, never says "unlimited", never nags a subscriber, and
   draws nothing at all while Premium is not on sale.

   The meter is display only by construction: it reads the server's own
   X-BE-Allowance / X-BE-Video-Allowance answer out of localStorage, where
   aiAllowTap() parked it. Check 9 is the one that matters most — METERS holds
   no limit numbers, so there is no second copy of a quota to drift. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8114), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
const b = await chromium.launch();

const HOUR = 3600e3;
const seed = JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

/* billing + an entitlement service are stated explicitly: since Phase C the
   production defaults are ON, so leaving them out would not test the off state */
async function open({ billing = true, api = true, ai = null, yt = null, unconf = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, api, flags, ai, yt, unconf]) => {
    localStorage.setItem("be12_v1", s);
    localStorage.setItem("be_ent_api", api ? "http://ent.test" : "");
    localStorage.setItem("be_flags", JSON.stringify(flags));
    if (ai) localStorage.setItem("be_ai_allow", JSON.stringify(ai));
    if (yt) localStorage.setItem("be_yt_allow", JSON.stringify(yt));
    if (unconf) sessionStorage.setItem("be_ent_unconfirmed", String(Date.now() + 60000));
  }, [seed, api, { billing_enabled: !!billing, home_v2_enabled: true }, ai, yt, unconf]);
  await ctx.route(u => /be-polish|be-events|be-partner|be-push|cloudflareinsights|youtube|ytimg|gstatic|googleapis/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  await ctx.route("http://ent.test/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ plan: "free", paid: false, capabilities: {} }) }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => typeof window.meterHTML === "function", null, { timeout: 15000 });
  return { ctx, p, errs };
}
const draw = (p, id) => p.evaluate(i => window.meterHTML(i), id);

/* ---- 1-2: nothing is drawn where nothing is in force ---- */
{
  const { ctx, p, errs } = await open({ billing: false, ai: { used: 1, limit: 3, resetAt: Date.now() + HOUR, plan: "free" } });
  ok("1  billing off (production today) draws no meter at all", (await draw(p, "verdicts")) === "");
  ok("2  no page error", errs.length === 0, errs[0]);
  await ctx.close();
}
{
  const { ctx, p } = await open({ api: false, ai: { used: 1, limit: 3, resetAt: Date.now() + HOUR, plan: "free" } });
  ok("3  no entitlement service draws no meter", (await draw(p, "verdicts")) === "");
  await ctx.close();
}
{
  const { ctx, p } = await open();                 // gated, but the server has not answered yet
  ok("4  before the server has spoken, nothing is invented", (await draw(p, "verdicts")) === "" && (await draw(p, "video")) === "");
  await ctx.close();
}

/* ---- 5-7: the Free count, mid-allowance ---- */
{
  const resetAt = Date.now() + 4 * HOUR;
  const { ctx, p } = await open({ ai: { used: 1, limit: 3, resetAt, plan: "free" } });
  const h = await draw(p, "verdicts");
  ok("5  reads as what is LEFT: '2 of 3 remaining today'", /2 of 3 remaining today/.test(h), h);
  ok("6  the bar is the existing .bar component at the right width", /class="bar" role="progressbar" aria-valuenow="33"/.test(h) && /<i style="width:33%"><\/i>/.test(h), h);
  const local = await p.evaluate(r => new Date(r).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }), resetAt);
  ok("7  the reset is the learner's LOCAL time, not UTC", h.includes(local), `want ${local} in ${h}`);
  ok("8  no upgrade button while the learner still has some left", !/premiumOpen/.test(h), h);
  await ctx.close();
}

/* ---- 9-11: Free, spent ---- */
{
  const { ctx, p } = await open({ ai: { used: 3, limit: 3, resetAt: Date.now() + 2 * HOUR, plan: "free" } });
  const h = await draw(p, "verdicts");
  ok("9  spent is marked .out and says the limit is reached", /class="meter out"/.test(h) && /Limit reached/.test(h), h);
  ok("10 an ALTERNATIVE is offered first, and it is the ungated curriculum", h.indexOf("go('journey')") > -1 && h.indexOf("go('journey')") < (h.indexOf("premiumOpen") + 1 || 1e9), h);
  ok("11 and only then the offer, tagged with its source", /premiumOpen\('meter_verdicts'\)/.test(h), h);
  await ctx.close();
}

/* ---- 12-14: Premium is never nagged and never oversold ---- */
{
  const { ctx, p } = await open({ ai: { used: 120, limit: 120, resetAt: Date.now() + HOUR, plan: "premium" } });
  const h = await draw(p, "verdicts");
  ok("12 Premium entitlement is stated", /Premium access/.test(h), h);
  ok("13 a subscriber at the ceiling is shown NO offer", !/premiumOpen/.test(h), h);
  ok("14 the ceiling is called fair use, never 'unlimited'", /fair.use/i.test(h) && !/unlimited/i.test(h), h);
  await ctx.close();
}

/* ---- 15-17: the video meter counts minutes, and the trial is not a day ---- */
{
  const { ctx, p } = await open({ yt: { used: 12 * 60, limit: 30 * 60, resetAt: Date.now() + HOUR, plan: "free" } });
  const h = await draw(p, "video");
  ok("15 a duration reads as what is SPENT: '12 of 30 minutes used'", /12 of 30 minutes used/.test(h), h);
  ok("16 seconds are shown as whole minutes, never seconds", !/\b720\b|\b1800\b/.test(h), h);
  await ctx.close();
}
{
  const { ctx, p } = await open({ yt: { used: 0, limit: 10 * 60, resetAt: Date.now() + 30 * 864e5, plan: "free", trial: true } });
  const h = await draw(p, "video");
  ok("17 the one-off trial is not described as a daily allowance", /one free trial/i.test(h) && !/resets/i.test(h), h);
  await ctx.close();
}

/* ---- 18-20: the structural guarantees ---- */
{
  const src = readFileSync(root + "index.html", "utf8");
  /* the LITERAL only — the prose after it is free to mention a status code */
  const from = src.indexOf("const METERS=Object.freeze(");
  const reg = src.slice(from, src.indexOf("});", from) + 3);
  ok("18 METERS holds NO limit number — there is no second copy of a quota", !/\blimit\s*:/.test(reg) && !/\d/.test(reg), reg);
  ok("19 the meter is mounted on the Polish page, before the mic", /\$\{meterHTML\("verdicts"\)\}/.test(src));
  ok("20 and on the paste-a-link box, before Load", /\$\{meterHTML\("video"\)\}/.test(src));
}

/* ---- 21-23: it really reaches the DOM, not just the function ---- */
{
  const { ctx, p, errs } = await open({ ai: { used: 1, limit: 3, resetAt: Date.now() + 4 * HOUR, plan: "free" } });
  await p.evaluate(() => window.go("phrases"));
  await p.waitForTimeout(600);
  const card = await p.evaluate(() => { const el = document.querySelector('#exCard [data-meter="verdicts"]'); return el ? el.innerText.replace(/\s+/g, " ").trim() : null; });
  ok("21 the card is in the Polish card itself, above the mic", !!card && /2 of 3 remaining today/.test(card), card);
  const order = await p.evaluate(() => { const m = document.querySelector('[data-meter="verdicts"]'), mic = document.getElementById("exRecBtn"); return !!(m && mic) && (m.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; });
  ok("22 it comes BEFORE the record button — the allowance is known first", order);
  ok("23 no page error with the card mounted", errs.length === 0, errs[0]);
  await ctx.close();
}

/* ---- 24-26: the two surfaces added in the completion pass ---- */
{
  const src = readFileSync(root + "index.html", "utf8");
  ok("24 the meter is mounted on the session record card", /\$\{aiAcctNoticeHTML\("session"\)\}\s*\n\s*\$\{meterHTML\("verdicts"\)\}/.test(src));
  ok("25 and on the Shadow Studio report card, above Analyze", /\$\{meterHTML\("verdicts"\)\}\s*\n\s*<div class="fb-head">/.test(src));
  ok("26 exactly four mount points, no more", (src.match(/\$\{meterHTML\(/g) || []).length === 4, String((src.match(/\$\{meterHTML\(/g) || []).length));
}

/* ---- 27-29: the states the figure cannot speak for itself in ---- */
{
  const { ctx, p } = await open({ unconf: true, ai: { used: 1, limit: 3, resetAt: Date.now() + HOUR, plan: "free" } });
  const h = await draw(p, "verdicts");
  ok("27 an unconfirmed plan is labelled, not silently trusted", /may be out of date/.test(h), h);
  await ctx.close();
}
{
  const { ctx, p } = await open({ unconf: true, ai: { used: 3, limit: 3, resetAt: Date.now() + HOUR, plan: "free" } });
  const h = await draw(p, "verdicts");
  ok("28 and is never sold against — no offer while the plan is unknown", !/premiumOpen/.test(h), h);
  await ctx.close();
}
{
  const { ctx, p } = await open({ ai: { used: 1, limit: 3, resetAt: Date.now() + HOUR, plan: "free" } });
  await ctx.setOffline(true);
  const h = await draw(p, "verdicts");
  ok("29 offline says the figure is the last one we were given", /offline/i.test(h) && /last count/i.test(h), h);
  await ctx.setOffline(false); await ctx.close();
}

/* ---- 30: a lapsed window must not announce a reset it was never told about ---- */
{
  const { ctx, p } = await open({ ai: { used: 3, limit: 3, resetAt: Date.now() - HOUR, plan: "free" } });
  const h = await draw(p, "verdicts");
  ok("30 a lapsed window draws nothing — no invented fresh count, no 'reset' claim", h === "" , h);
  await ctx.close();
}

await b.close(); srv.kill();
const bad = res.filter(x => !x).length;
console.log(`\n${res.length - bad}/${res.length} passed`);
process.exit(bad ? 1 : 0);
