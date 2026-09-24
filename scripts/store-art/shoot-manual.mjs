/* Help-centre capture rig — regenerates manual/screenshots/m*.png from the
 * current design (docs/DESIGN_SYSTEM_BEMASTERY.md, Phase 6).
 *
 *   node scripts/store-art/shoot-manual.mjs            (serves the repo itself)
 *   ONLY=m01,m09 node scripts/store-art/shoot-manual.mjs
 *
 * Playwright comes from tests/node_modules (cd tests && npm install once).
 * Dark theme only — BE Mastery is dark by default (§16); the Help centre shows
 * the app as a learner first meets it. "Alex" is the neutral demo learner: the
 * General English data is shoot.js's seed and the Welding data is
 * shoot-career.js's, read out of those files so the three rigs cannot drift.
 * Every figure is the app's own render path — nothing is drawn by hand.
 *
 * Phone figures: 390 CSS px wide at 2× (780 px). Desktop figures: 1280 at 2×.
 * Each capture is written as WebP (cwebp -q 82): the Help centre loads every
 * figure at once and most learners read it on mobile data; lossy WebP keeps the
 * dark gradients smooth where a 256-colour PNG bands, at about a fifth of the
 * PNG size. Needs cwebp (brew install webp).
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
const ROOT = new URL("../../", import.meta.url).pathname;
const { chromium } = await import(ROOT + "tests/node_modules/playwright/index.mjs");
const OUT = ROOT + "manual/screenshots/"; mkdirSync(OUT, { recursive: true });
const PORT = 8074, BASE = `http://127.0.0.1:${PORT}/`;
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);

const src = (file, start, end) => { const s = readFileSync(ROOT + "scripts/store-art/" + file, "utf8"); const a = s.indexOf(start); const b = s.indexOf(end, a); if (a < 0 || b < 0) throw new Error("seed not found in " + file); return s.slice(a, b + end.length); };
const GE_SEED = src("shoot.js", "const seed = () => {", "\n};").replace("const seed = ", "").replace(/;$/, "");
const WELD_SEED = src("shoot-career.js", "function seedInFrame() {", "\n}\n");

const CLEAN = () => {
  document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary,.coach-ov,#toast,.toast,#ppFab,#syncNudge,.sync-nudge").forEach(e => e.remove());
};
/* the header, bottom bar and floating buttons are fixed / sticky: they would
   sit across a crop taller than the screen, so crops hide them and put them back */
const BARS_SEL = "nav:not(.social-row), .bnav, #ppFab, .shl-fab, .stick-back";
/* opacity, not display: hiding the nav from layout sets off the app's own
   layout observers; visibility can be overridden by a child */
const bars = (p, show) => p.evaluate(([s, show]) => document.querySelectorAll(s).forEach(e => show ? e.style.removeProperty("opacity") : e.style.setProperty("opacity", "0", "important")), [BARS_SEL, show]);
const PHONE = { width: 390, height: 844 }, DESK = { width: 1280, height: 800 };

/* GE: [file, viewport, how] — how runs in the page after go() */
const GE = [
  ["m09-mobile", PHONE, "go('home')"],
  ["m01-dashboard", { width: 1280, height: 560 }, "go('home')"],
  ["m00-nav", { ...DESK, clip: { x: 0, y: 0, width: 1280, height: 64 } }, "go('home')"],
  ["m02-journey", { width: 390, height: 1500 }, "go('journey')"],
  ["m03-session", { width: 390, height: 1600 }, "go('session',1,'Mon')"],
  ["m04-shadow", { width: 390, height: 1400 }, "go('shadow')"],
  ["m12-shadow", PHONE, "go('shadow')"],
  ["m06-phrases", { width: 390, height: 560 }, "go('phrases')"],
  ["m11-phrases", PHONE, "go('phrases')"],
  ["m07-progress", { width: 390, height: 1700 }, "go('review')"],
  ["m08-account", { width: 390, height: 1500 }, "go('data')"],
  ["m13-share", { width: 390, height: 844, cards: "[onclick*=\"shShare('card')\"]" }, "go('review')"],
  ["m05-feedback", { width: 390, height: 1300, report: true }, "go('shadow')"],
];
const WELD = [
  ["m17-scenarios", { width: 390, height: 1400 }, "go('simulation')"],
  ["m15-coaches", { width: 390, height: 844, cardsText: "Professional Interview Coaches", n: 1 }, "go('career')"],
  ["m20-passport", { width: 390, height: 844, cardsText: "Your professional evidence", n: 1 }, "go('review')"],
  ["m16-interview-report", { width: 390, height: 1100, simReport: true }, "go('simulation')"],
];
const want = f => !ONLY.length || ONLY.some(o => f.startsWith(o));

const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" }); await sleep(900);
const b = await chromium.launch(); let bad = 0;
const ctxFor = async (vp, init) => {
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, serviceWorkers: "block", colorScheme: "dark" });
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|googletagmanager/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  if (init) await ctx.addInitScript(init);
  return ctx;
};
const shoot = (p, file, vp, how) => { let done = false;
  return Promise.race([shoot1(p, file, vp, how).then(() => { done = true; }),
    sleep(60000).then(() => { if (!done) { console.error(`  ${file}: timed out`); bad++; } })]); };
const shoot1 = async (p, file, vp, how) => {
  await p.setViewportSize({ width: vp.width, height: vp.height });
  await p.evaluate(CLEAN); await p.evaluate(how); await sleep(900); await p.evaluate(CLEAN);
  await p.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); scrollTo(0, 0); });
  const view = await p.evaluate(() => (document.querySelector(".view.on") || {}).id || "");
  if (vp.find || vp.findText) {
    const y = await p.evaluate(([sel, txt]) => {
      let el = sel ? document.querySelector(".view.on " + sel) : [...document.querySelectorAll(".view.on h2,.view.on h3,.view.on b,.view.on .eyebrow")].find(e => e.textContent.trim().startsWith(txt));
      if (!el) return null; el = el.closest(".card") || el; return scrollY + el.getBoundingClientRect().top - 84;
    }, [vp.find, vp.findText]);
    if (y == null) { console.error(`  ${file}: anchor not found`); bad++; } else await p.evaluate(v => scrollTo(0, v), y);
    await sleep(400);
  }
  if (vp.cards || vp.cardsText) {
    /* a run of cards at the foot of a long page: the card holding the anchor
       and the one after it, clipped out of the full page */
    await bars(p, false);
    const r = await p.evaluate(([sel, txt, n]) => {
      const hit = sel ? document.querySelector(".view.on " + sel) : [...document.querySelectorAll(".view.on h2,.view.on h3,.view.on b,.view.on .eyebrow")].find(e => e.textContent.trim().startsWith(txt));
      const a = hit.closest(".card"), z = n === 1 ? a : (a.nextElementSibling || a);
      document.querySelectorAll("[data-shot]").forEach(e => e.removeAttribute("data-shot")); a.setAttribute("data-shot", "1");
      const t = a.getBoundingClientRect().top + scrollY, bt = z.getBoundingClientRect().bottom + scrollY;
      return { y: Math.max(0, t - 16), h: bt - t + 32 };
    }, [vp.cards, vp.cardsText, vp.n || 2]);
    /* one card: an element shot. Two: a clip out of the full page */
    if ((vp.n || 2) === 1) await p.locator("[data-shot]").screenshot({ path: OUT + file + ".png" });
    else await p.screenshot({ path: OUT + file + ".png", fullPage: true, clip: { x: 0, y: r.y, width: vp.width, height: r.h } });
    await bars(p, true);
    console.log(`  ${file}.png  ${view} cards`); return;
  }
  if (vp.report) {
    /* the speaking report, drawn by the app's own fbShowResults into a card on
       the Shadow page — the element is captured alone, so no clip artwork */
    await p.evaluate(() => {
      const host = document.createElement("section"); host.className = "card"; host.id = "__fbHost";
      host.innerHTML = '<div id="__fbOut" class="fb-out"></div>';
      document.querySelector(".view.on").prepend(host);
      fbCtx = { vid: "manual", recCtx: "shadow-manual" }; fbT0 = Date.now() - 7000;
      fbShowResults("So I applied to one job and I applied to probably around ninety", "So I applied to one job and I applied to probable around ninety", false, "__fbOut");
    });
    await sleep(900);
    await bars(p, false);
    await p.locator("#__fbHost").screenshot({ path: OUT + file + ".png" });
    await bars(p, true);
    await p.evaluate(() => document.getElementById("__fbHost").remove());
    console.log(`  ${file}.png  report`); return;
  }
  if (vp.simReport) {
    await p.evaluate(() => { const st = eval("(S.simulations&&S.simulations.attempts)||{}"); const id = Object.keys(st)[0], runs = st[id] || []; simOpenAttempt(id, runs[runs.length - 1].startedAt); });
    await sleep(1200);
    /* the first answer card, opened, cropped out of the full page */
    await bars(p, false);
    const r = await p.evaluate(() => {
      const d = document.querySelector(".view.on details.sim-ans"); d.open = true;
      const b = d.getBoundingClientRect(); return { y: Math.max(0, b.top + scrollY - 12), h: b.height + 24 };
    });
    await sleep(500);
    await p.locator(".view.on details.sim-ans >> nth=0").screenshot({ path: OUT + file + ".png" });
    await bars(p, true);
    console.log(`  ${file}.png  ${view} answer`); return;
  }
  await p.screenshot({ path: OUT + file + ".png", clip: vp.clip });
  console.log(`  ${file}.png  ${view}`);
};

/* onboarding: a first visit, nothing stored */
if (want("m10")) {
  const ctx = await ctxFor(PHONE); const p = await ctx.newPage();
  await p.goto(BASE + "index.html"); await sleep(1800);
  await p.screenshot({ path: OUT + "m10-onboarding.png" }); console.log("  m10-onboarding.png  first visit");
  await ctx.close();
}
/* General English */
if (GE.some(([f]) => want(f))) {
  const ctx = await ctxFor(PHONE); const p = await ctx.newPage();
  await p.goto(BASE + "robots.txt"); await p.evaluate("(" + GE_SEED + ")()");
  await p.goto(BASE + "index.html"); await sleep(1800);
  for (const [f, vp, how] of GE) if (want(f)) await shoot(p, f, vp, how);
  await ctx.close();
}
/* Welding — seeded through the app's own state, then reloaded */
if (WELD.some(([f]) => want(f))) {
  const ctx = await ctxFor(PHONE); const p = await ctx.newPage();
  await p.goto(BASE + "robots.txt"); await p.evaluate("(" + GE_SEED + ")()");
  await p.goto(BASE + "index.html"); await sleep(1800); await p.evaluate(CLEAN);
  const info = await p.evaluate("(" + WELD_SEED + ")()");
  /* shoot-career.js predates the area split: its records carry no tk stamp, so
     the Welding views (areaAttempts / areaConvos / areaFbHist) would filter
     them out. Stamp them as Welding and mark Welding's placement check passed
     (the GE seed only passes General English's). */
  await p.evaluate(() => {
    const W = "welding";
    Object.values((S.simulations && S.simulations.attempts) || {}).forEach(runs => runs.forEach(r => { r.tk = W; }));
    (S.convos || []).forEach(c => { c.tk = W; }); (S.fbHist || []).forEach(x => { x.tk = W; });
    S.fnd = S.fnd || {}; S.fnd[W] = { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() };
    save();
  }); console.log("  welding seed:", JSON.stringify({ scenarios: info.scenarios, convos: info.convos }));
  await sleep(500); await p.reload(); await sleep(1800);
  for (const [f, vp, how] of WELD) if (want(f)) await shoot(p, f, vp, how);
  await ctx.close();
}
await b.close(); srv.kill();
/* PNG capture → WebP, then drop the PNG */
for (const f of [...GE, ...WELD].map(x => x[0]).concat("m10-onboarding").filter(want)) {
  const png = OUT + f + ".png"; if (!existsSync(png)) continue;
  const r = spawnSync("cwebp", ["-quiet", "-q", "82", "-m", "6", png, "-o", OUT + f + ".webp"]);
  if (r.status !== 0) { console.error("  cwebp failed for " + f); bad++; } else unlinkSync(png);
}
if (bad) { console.error(bad + " problem(s)"); process.exit(1); }
