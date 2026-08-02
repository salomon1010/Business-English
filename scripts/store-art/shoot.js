/* Play Store capture rig.
 *
 * The app is a handset layout (its widest breakpoint is 820px), so a tablet-sized
 * viewport would render it as a stretched desktop page. Instead we load index.html
 * in an iframe at a handset CSS width and scale the whole stage up, so the output
 * lands on Play's pixel size while the app still lays out the way a phone shows it.
 *
 * Usage — serve the repo root first, then run from anywhere:
 *   python3 -m http.server 8765
 *   npm i playwright-core            # not a project dependency; install ad hoc
 *   node scripts/store-art/shoot.js phone
 *   node scripts/store-art/shoot.js tablet
 *
 * Output: playstore/$OUT_ROOT/{phone,tablet}/. Overrides: CHROME, BASE, OUT_ROOT.
 *
 * Every shot asserts which view actually rendered and exits non-zero on a
 * mismatch — the routing is easy to get subtly wrong (a day session, for one,
 * renders into the journey container, not a container of its own).
 */
const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE || "http://localhost:8765";
const OUT_ROOT = process.env.OUT_ROOT || "store-art-2026-08";

const PRESETS = {
  // css box the app lays out in, then the multiplier that hits Play's pixel size
  phone:  { w: 540, h: 1200, s: 2, out: "phone" },    // -> 1080x2400
  tablet: { w: 720, h: 1280, s: 2, out: "tablet" },   // -> 1440x2560
};

// go = router args, applied directly rather than via the hash so boot order can't
// race us; scrollTo = css px to scroll the frame before the shot
const SHOTS = [
  { file: "01-dashboard", go: ["home"] },
  { file: "02-journey",   go: ["journey"] },
  { file: "03-phrases",   go: ["phrases"] },
  // the calendar sits below the profile header, so scroll past the avatar block
  { file: "04-progress",  go: ["profile"], settle: 900, scrollTo: 380 },
  // a day session deliberately renders into the journey view's container
  { file: "05-session",   go: ["session", 1, "Mon"], expect: "v-journey" },
  // Shadow is deliberately absent: every dense screen in the studio renders
  // third-party YouTube artwork, and the one that doesn't (Trouble words) is
  // two-thirds empty. Practice fills the slot instead — it is the spaced-
  // repetition gym, which nothing else in the set shows.
  { file: "06-practice",  go: ["practice"], settle: 600 },
];

const seed = () => {
  const DAY = 86400000, now = Date.now();
  const iso = d => new Date(d).toISOString().slice(0, 10);
  // six weeks of history with one rest day a week: a believable committed user,
  // and the six most recent days are unbroken so the streak reads 6.
  const dates = [], dayLog = {};
  for (let i = 41; i >= 0; i--) {
    if (i % 7 === 6) continue;                       // the weekly rest day
    const d = iso(now - i * DAY);
    dates.push(d);
    dayLog[d] = 1 + (i % 3);                         // vary the heat-map intensity
  }
  const days = {};
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => { days["w1" + d] = true; });
  // `l` is the CEFR level and is NOT optional — vocRow() reads l[0] to colour the chip
  const vocab = {};
  const due = { stakeholder: "C1", escalation: "C1", mitigation: "C1", dependency: "C1",
                blocker: "B2", prioritize: "C1", timeline: "B2", deliverable: "C1" };
  Object.keys(due).forEach((w, i) => {
    vocab[w] = { l: due[w], reps: 1, due: now - (i + 1) * DAY, ts: now - (i + 4) * DAY };
  });
  const soon = { revenue: "B2", workflow: "B2", feedback: "B1" };
  Object.keys(soon).forEach((w, i) => {
    vocab[w] = { l: soon[w], reps: 2, due: now + (i + 2) * DAY, ts: now - (i + 6) * DAY };
  });
  const done = { meeting: "A2", schedule: "B1" };
  Object.keys(done).forEach((w, i) => {
    vocab[w] = { l: done[w], reps: 5, due: now + 40 * DAY, ts: now - (i + 12) * DAY };
  });
  const fbHist = [64, 68, 71, 70, 75, 79, 78, 83, 86, 88, 91, 94, 96].map((s, i, a) =>
    ({ ts: now - (a.length - 1 - i) * 3 * DAY, score: s, wpm: 104 + i * 4, words: 28 + i * 3 }));
  const S = {
    days, steps: {}, notes: {}, scores: {}, phMaster: {}, phExample: {}, weekly: {}, monthly: {},
    tutor: {}, clips: [], trouble: { rhythm: 3, particularly: 2, thorough: 2 }, fbHist, fbV: {},
    convos: [], vocab,
    profile: { name: "Alex", role: "Product / PM", goal: "\u{1F3A4} Speak confidently in meetings",
               slot: "☀️ Morning coffee", lang: "en", ts: now - 40 * DAY },
    dates, dayLog, startDate: iso(now - 40 * DAY),
  };
  localStorage.setItem("be12_v1", JSON.stringify(S));
  localStorage.setItem("be_theme", "dark");
  // the cloud sign-in nudge floats over the bottom of every page ~800ms in
  localStorage.setItem("be12_syncNudge", "1");
};

(async () => {
  const name = process.argv[2] || "tablet";
  const P = PRESETS[name];
  if (!P) { console.error("unknown preset:", name); process.exit(1); }

  const outDir = path.join(__dirname, "..", "..", "playstore", OUT_ROOT, P.out);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({
    viewport: { width: P.w * P.s, height: P.h * P.s },
    deviceScaleFactor: 1,
  });

  // seed once for the origin; the iframe shares it
  await page.goto(BASE + "/scripts/store-art/frame.html");
  await page.evaluate(seed);

  const url = `${BASE}/scripts/store-art/frame.html?w=${P.w}&h=${P.h}&s=${P.s}&u=${encodeURIComponent("../../index.html")}`;

  for (const shot of SHOTS) {
    await page.goto(url);
    await page.waitForFunction(() => {
      const w = document.getElementById("fr").contentWindow;
      return w && typeof w.go === "function" && w.document.querySelector("nav");
    }, null, { timeout: 20000 });

    const active = await page.evaluate(args => {
      const w = document.getElementById("fr").contentWindow;
      w.go.apply(null, args);
      w.scrollTo(0, 0);
      const shown = [...w.document.querySelectorAll('[id^="v-"]')]
        .filter(e => getComputedStyle(e).display !== "none").map(e => e.id);
      return shown.join(",");
    }, shot.go);

    await page.waitForTimeout(shot.settle || 500);
    if (shot.scrollTo) {
      await page.evaluate(y => document.getElementById("fr").contentWindow.scrollTo(0, y), shot.scrollTo);
      await page.waitForTimeout(350);
    }

    const file = path.join(outDir, shot.file + ".png");
    await page.screenshot({ path: file });
    const want = shot.expect || "v-" + shot.go[0];
    if (active !== want) { console.error(`  ${shot.file}.png  MISMATCH: wanted ${want}, got ${active}`); process.exitCode = 1; }
    else console.log(`  ${shot.file}.png  ok`);
  }

  await browser.close();
  console.log("\n" + name + " -> " + outDir + `  (${P.w * P.s}x${P.h * P.s})`);
})();
