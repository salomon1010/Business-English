/* Executive Polish capture rig — the shots the Phrase Lab flyers are built from.
 *
 * Same stage as shoot.js (index.html in an iframe at a handset CSS width, scaled
 * up), with one hard requirement: the page MUST be served from a port the polish
 * Worker's CORS list allows, or exGo() falls back to the offline rule-based
 * clean-up and the screenshot shows the wrong feature. backend/polish-worker.js
 * allows localhost:8000, so that is the default here — not 8765 like shoot.js.
 *
 *   python3 -m http.server 8000
 *   NODE_PATH=<where playwright-core is> node scripts/store-art/shoot-polish.js general
 *   NODE_PATH=<where playwright-core is> node scripts/store-art/shoot-polish.js welding
 *
 * Output: marketing/shots-polish[-welding]/. The polish result is a live API
 * call, so the wording changes run to run — re-read it out of result.json and
 * keep the flyer copy in step with whatever the committed PNGs actually show.
 */
const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE || "http://localhost:8000";
const W = 540, H = 1200, S = 2;                       // -> 1080x2400

/* One preset per area. The sentence is deliberately the ordinary meeting that
   area's learner walks into: a daily standup for the office, the pre-shift
   toolbox talk for the site. The seeded phrase examples are the first two
   phrases of that area's own week 1, so the list under the lab reads like a
   returning user rather than an empty shell. */
const PRESETS = {
  general: {
    out: "shots-polish",
    track: "general-english",
    raw: "Yesterday I had a meeting with the technical lead and this is what we did. "
       + "Today I will be working on the API and tomorrow we will be working on the tests.",
    mastered: { p0: 1, p1: 1, p4: 1 },
    examples: {
      p0: "I currently work as a delivery lead on the payments platform.",
      p1: "My focus is on reducing the time it takes to ship a change.",
    },
  },
  welding: {
    out: "shots-polish-welding",
    track: "welding",
    trade: "welder",
    raw: "Yesterday I finished the joints on line 3, but the extraction fan was not working well, "
       + "so I stopped and told the foreman. Today I will do the root pass on the new spool, "
       + "and tomorrow I will grind and check the welds.",
    mastered: { p0: 1, p1: 1 },
    examples: {
      p0: "I'm a welder with six years in structural fabrication, mostly SMAW and FCAW.",
      p1: "I take safety and quality seriously in every job — I check the joint prep before I strike an arc.",
    },
  },
};

/* Seeded straight into the per-area buckets the app actually reads (aMap →
   S.phMasterA[area]), not the pre-split legacy S.phMaster. Phrase 7 on Welding
   is the trade's wording of phrase 7, so the two areas must not share these. */
const seed = cfg => {
  const DAY = 86400000, now = Date.now();
  const iso = d => new Date(d).toISOString().slice(0, 10);
  const dates = [], dayLog = {};
  for (let i = 41; i >= 0; i--) {
    if (i % 7 === 6) continue;
    const d = iso(now - i * DAY);
    dates.push(d); dayLog[d] = 1 + (i % 3);
  }
  const days = {};
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => { days["w1" + d] = true });
  const S = {
    days, steps: {}, notes: {}, scores: {}, weekly: {}, monthly: {}, tutor: {}, clips: [],
    fbHist: [], fbV: {}, convos: [], vocab: {},
    phMasterA: { [cfg.track]: cfg.mastered },
    phExampleA: { [cfg.track]: cfg.examples },
    dayLogA: { [cfg.track]: dayLog },
    professionalTracks: { activeId: cfg.track, tradeId: cfg.trade || "welder" },
    profile: { name: "Alex", role: "Product / PM", goal: "\u{1F3A4} Speak confidently in meetings",
               slot: "☀️ Morning coffee", lang: "en", ts: now - 40 * DAY },
    dates, dayLog, startDate: iso(now - 40 * DAY),
  };
  localStorage.setItem("be12_v1", JSON.stringify(S));
  localStorage.setItem("be_theme", "dark");
  localStorage.setItem("be12_syncNudge", "1");        // keeps the sign-in nudge off the shot
};

(async () => {
  const name = process.argv[2] || "general";
  const cfg = PRESETS[name];
  if (!cfg) { console.error("unknown preset: " + name + " (have " + Object.keys(PRESETS).join(", ") + ")"); process.exit(1) }
  const OUT = path.join(__dirname, "..", "..", "marketing", cfg.out);
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: W * S, height: H * S }, deviceScaleFactor: 1 });

  await page.goto(BASE + "/scripts/store-art/frame.html");
  await page.evaluate(seed, cfg);
  await page.goto(`${BASE}/scripts/store-art/frame.html?w=${W}&h=${H}&s=${S}&u=${encodeURIComponent("../../index.html")}`);
  await page.waitForFunction(() => {
    const w = document.getElementById("fr").contentWindow;
    return w && typeof w.go === "function" && w.document.querySelector("nav");
  }, null, { timeout: 20000 });

  const shot = async (file, y, settle = 350) => {
    await page.evaluate(t => document.getElementById("fr").contentWindow.scrollTo(0, t), y);
    await page.waitForTimeout(settle);
    await page.screenshot({ path: path.join(OUT, file + ".png") });
    console.log("  " + file + ".png  ok  (scroll " + y + ")");
  };

  /* The open area decides which phrases the lab lists and which identity the app
     wears, so assert it rather than trust the seed. */
  const area = await page.evaluate(() => document.getElementById("fr").contentWindow.areaId());
  if (area !== cfg.track) { console.error("WRONG AREA: wanted " + cfg.track + ", got " + area); process.exit(1) }
  console.log("  area: " + area);

  // ---- the lab at rest, then with the sentence you were about to say ----
  await page.evaluate(() => { const w = document.getElementById("fr").contentWindow; w.go("phrases"); w.scrollTo(0, 0) });
  await page.waitForTimeout(700);
  await shot("x0-lab", 0);

  await page.evaluate(raw => {
    const w = document.getElementById("fr").contentWindow;
    const i = w.document.getElementById("exIn");
    i.value = raw; i.dispatchEvent(new w.Event("input", { bubbles: true }));
  }, cfg.raw);
  await page.waitForTimeout(250);
  await shot("x1-before", 0);

  /* ---- the real API call ----
     The model sometimes returns a single version, and then there is no "Another
     way to say it" disclosure to shoot. Pressing Polish it again is exactly what
     a user would do, and it refills the queue — so retry rather than ship a
     capture of the wrong disclosure. */
  let alts = 0;
  for (let attempt = 1; attempt <= 4 && !alts; attempt++) {
    await page.evaluate(() => document.getElementById("fr").contentWindow.exGo());
    await page.waitForFunction(() => {
      const d = document.getElementById("fr").contentWindow.document;
      const p = d.querySelector("#exOut .ex-best-t");
      return p && p.textContent.trim().length > 20;
    }, null, { timeout: 45000 });
    await page.waitForTimeout(500);
    alts = await page.evaluate(() =>
      document.getElementById("fr").contentWindow.document.querySelectorAll("#exOut .ex-alt").length);
    console.log("  polish attempt " + attempt + ": " + alts + " alternate(s)");
  }
  if (!alts) throw new Error("no alternate version after 4 attempts");

  const result = await page.evaluate(() => {
    const d = document.getElementById("fr").contentWindow.document;
    const best = d.querySelector("#exOut .ex-best-t");
    const learn = d.querySelector("#exOut .ex-why p");
    const alts = [...d.querySelectorAll("#exOut .ex-alt")].map(a => ({
      text: a.querySelector(".ex-alt-t").textContent.trim(),
      learn: (a.querySelector(".ex-alt-why") || {}).textContent || "",
    }));
    return { best: best.textContent.trim(), learn: learn ? learn.textContent.trim() : "", alts,
             top: Math.round(d.getElementById("exOut").getBoundingClientRect().top + document.getElementById("fr").contentWindow.scrollY) };
  });
  console.log("\nLIVE POLISH RESULT — keep the flyer copy in step with this:");
  console.log(JSON.stringify(result, null, 1) + "\n");
  fs.writeFileSync(path.join(OUT, "result.json"),
    JSON.stringify({ area, input: cfg.raw, ...result }, null, 1));

  /* Frame the result: the flyer's phone windows show roughly the top 1400 device
     px of a shot, so the executive version has to sit near the top of the frame. */
  await shot("x2-polished", Math.max(0, result.top - 120), 500);

  // ---- the alternates, where the new vocabulary comes from ----
  await page.evaluate(() => {
    const d = document.getElementById("fr").contentWindow.document;
    const s = [...d.querySelectorAll("#exOut details")].find(x => x.querySelector(".ex-alt"));
    if (s) s.open = true;
  });
  await page.waitForTimeout(400);
  const altTop = await page.evaluate(() => {
    const w = document.getElementById("fr").contentWindow;
    const d = [...w.document.querySelectorAll("#exOut details")].find(x => x.querySelector(".ex-alt"));
    return Math.round(d.getBoundingClientRect().top + w.scrollY);
  });
  /* two framings of the same state: the app's sticky header eats the top ~80 CSS
     px, so the disclosure title only survives the crop at the larger offset. */
  await shot("x3-alternates", Math.max(0, altTop - 150), 450);
  await shot("x3b-alternates-tight", Math.max(0, altTop - 40), 450);

  // ---- the phrase list the polished line gets saved into ----
  await shot("x4-phrases", 1180, 450);

  await browser.close();
  console.log("done -> " + OUT + `  (${W * S}x${H * S})`);
})();
