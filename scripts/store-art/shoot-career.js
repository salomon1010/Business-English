/* Marketing capture rig for the professional-track career features.
 *
 * Same iframe-scaling trick as shoot.js (the app is a handset layout, so a big
 * viewport would render it as a stretched desktop page) — see that file's header.
 * This one seeds a Boilermaker on the Welding track with enough spoken evidence
 * for the Passport, the Career Center and a finished workshop report to have
 * something real to show.
 *
 * Nothing here invents a claim: the numbers are ordinary demo data rendered by
 * the app's own code paths, exactly as a learner with that history would see.
 *
 *   python3 -m http.server 8765
 *   node scripts/store-art/shoot-career.js
 *
 * Output: marketing/shots-career/
 */
const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");

const CHROME = process.env.CHROME ||
  "/Users/salomonnorengoucheme/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const BASE = process.env.BASE || "http://localhost:8765";
const W = 540, H = 1200, S = 2;               // -> 1080x2400

/* Runs inside the iframe, after boot, so it can use the app's own ids and
   helpers rather than hard-coding a scenario list that would rot. */
function seedInFrame() {
  const DAY = 86400000, now = Date.now();
  const iso = d => new Date(d).toISOString().slice(0, 10);

  S.profile = { name: "Alex", role: "Boilermaker", goal: "Work abroad on a shutdown",
                slot: "Morning", lang: "en", ts: now - 40 * DAY };
  S.professionalTracks = { activeId: "welding" };
  ProfessionalTrackContext.setActive("welding");
  if (window.Trades) Trades.setActive(S, "boilermaker");
  applyTrackIdentity();

  /* six weeks of practice with one rest day a week */
  const dates = [], dayLog = {};
  for (let i = 41; i >= 0; i--) {
    if (i % 7 === 6) continue;
    const d = iso(now - i * DAY);
    dates.push(d); dayLog[d] = 1 + (i % 3);
  }
  S.dates = dates; S.dayLog = dayLog; S.startDate = iso(now - 40 * DAY);

  /* scored speaking takes — the "Speaking clarity" block reads these */
  S.fbHist = [61, 66, 68, 72, 74, 79, 81, 84, 86, 88, 91, 93, 95]
    .map((score, i, a) => ({ ts: now - (a.length - 1 - i) * 3 * DAY, score,
                             wpm: 102 + i * 3, words: 26 + i * 3 }));

  S.careerCenter = { destination: "international-contractor",
    resume: "Boilermaker with six years on pressure vessels and power boilers. " +
            "I read the drawing, set the fit-up and work to ASME Section VIII." };

  /* workshop attempts, built from the track's own scenarios */
  const sims = trackSimulations();
  const attempts = {};

  /* The first workshop gets REAL answers: spoken sentences run through the
     app's own grader, so the report card in the flyer shows genuine covered /
     missed points and the model answer the rubric actually holds. Nothing is
     typed into the card by hand. */
  const spoken = {
    open: "My name is Alex, I am a welder. I have six years experience, mostly MIG and stick.",
    t0:   "I can weld 1G, 2G and 3G. Overhead I am still learning. I am happy to do a test piece.",
    t1:   "First my helmet, gloves and boots. Then the area is clear, nothing flammable, screens up. I check the leads and the earth clamp.",
    t2:   "I go to the supervisor. I stop and ask rather than guess, because rework costs money.",
    t3:   "Tell me straight, no problem. Show me exactly where it is and I will grind it out and re-run it.",
  };
  const sc0 = sims[0];
  const order = [["open", sc0.lead]].concat((sc0.turns || []).map(t => [t.q, t.characterId]));
  const graded = order.map(([k, cid]) => {
    const r = AnswerEvaluator.evaluate(spoken[k] || "", sc0.questions[k] || {});
    r.characterId = cid;
    /* readiness() counts each question once at its best attempt, keyed by q —
       without it five answers collapse into one and readiness reads far low */
    r.q = k;
    return r;
  });
  const covWeighted = graded.reduce((n, a) => n + a.coverage, 0) / graded.length;
  attempts[sc0.id] = [
    { startedAt: now - 6 * DAY, at: now - 6 * DAY, coverage: 0.53,
      answered: graded.length, asked: graded.length, answers: graded },
    { startedAt: now - 2 * DAY, at: now - 2 * DAY, coverage: covWeighted,
      answered: graded.length, asked: graded.length, answers: graded },
  ];

  /* The rest only feed the Passport's aggregates, which read coverage and
     counts — not the answer text — so they stay as plain numbers. */
  const plan = [{ i: 1, runs: [0.62, 0.85] }, { i: 2, runs: [0.71] },
                { i: 3, runs: [0.58, 0.74] }, { i: 5, runs: [0.83] },
                { i: 6, runs: [0.72] }, { i: 8, runs: [0.68, 0.80] },
                /* module 11 is the interview workshop; "Interview readiness"
                   on the Career Center reads that one scenario alone */
                { i: sims.findIndex(x => x && x.regulatory && Number(x.regulatory.moduleId) === 11),
                  runs: [0.69, 0.82] }];
  plan.forEach(({ i, runs }) => {
    const sc = sims[i]; if (!sc) return;
    const qs = Object.keys(sc.questions || {});
    attempts[sc.id] = runs.map((coverage, k) => ({
      startedAt: now - (runs.length - k) * 3 * DAY,
      at: now - (runs.length - k) * 3 * DAY,
      coverage, answered: qs.length, asked: qs.length,
      answers: qs.map((qk, q) => ({
        q: qk,
        characterId: (simCast(sc)[q % simCast(sc).length] || {}).id,
        ask: "", answered: true,
        coverage: Math.min(0.95, coverage + (q % 3 - 1) * 0.08),
        said: "", covered: [], missed: [], model: "", why: "",
        vocabUsed: (window.Trades ? Trades.vocabFor(Trades.active(S)) : []).slice(q, q + 2),
        vocabMissed: [],
      })),
    }));
  });
  S.simulations = { history: [], attempts };

  /* Interview coaches carry their own history (S.convos), which is what puts
     "2 attempts · best 84%" on a coach card instead of "Not practised yet". */
  const mentors = trackAiMentors();
  const coachRuns = [[0, [71, 84]], [1, [66]], [2, [78, 88]], [4, [74]]];
  S.convos = [];
  coachRuns.forEach(([i, scores]) => {
    const m = mentors[i]; if (!m) return;
    scores.forEach((overall, k) => S.convos.push({
      id: m.id, ts: now - (scores.length - k) * 4 * DAY, overall,
      title: m.title, turns: 6,
    }));
  });

  /* Career Gap Analysis and the Passport activity bars read the competency log.
     Logged through the engine's own entry point rather than written by hand, so
     the totals, the weights and the achievement unlocks all stay consistent.
     logActivity is used directly instead of awardCompetency() — the latter
     raises a coach modal and a toast, which would land in the screenshot. */
  const activity = [
    ["professional_simulation", 11], ["professional_coach", 9], ["shadow_session", 26],
    ["phrase_lab", 22], ["vocabulary_practice", 18], ["pronunciation_feedback", 15],
    ["ai_conversation", 6],
  ];
  activity.forEach(([activityType, n]) => {
    for (let k = 0; k < n; k++) {
      CompetencyEngine.logActivity(S, { activityType, lesson: activityType,
        duration: 6, dedupeKey: activityType + ":" + k });
    }
  });

  save();
  return { scenarios: sims.length, first: sc0.id,
           graded: graded.map(a => Math.round(a.coverage * 100)),
           convos: S.convos.length, logs: (S.competency.logs || []).length,
           readiness: AnswerEvaluator.readiness(S, sims),
           achievements: Object.keys(S.competency.achievements || {}) };
}

const SHOTS = [
  { file: "c1-evidence",  go: ["review"],     settle: 1100, findText: "Your professional evidence" },
  { file: "c0-readiness", go: ["career"],     settle: 1100, findText: "Career readiness" },
  { file: "c2-coaches",   go: ["career"],     settle: 1100, findText: "Professional Interview Coaches" },
  { file: "c3-resume",    go: ["career"],     settle: 1100, findText: "Resume & LinkedIn Coach" },
  { file: "c4-scenarios", go: ["simulation"], settle: 900 },
  { file: "c5-report",    go: ["simulation"], settle: 1400, report: true },
];

(async () => {
  const outDir = path.join(__dirname, "..", "..", "marketing", "shots-career");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: W * S, height: H * S }, deviceScaleFactor: 1 });
  const url = `${BASE}/scripts/store-art/frame.html?w=${W}&h=${H}&s=${S}&u=${encodeURIComponent("../../index.html")}`;

  const boot = async () => {
    await page.goto(url);
    await page.waitForFunction(() => {
      const w = document.getElementById("fr").contentWindow;
      return w && typeof w.go === "function" && w.document.querySelector("nav");
    }, null, { timeout: 20000 });
  };

  /* seed once against the origin, through the app's own state */
  await boot();
  const info = await page.evaluate(fn => {
    const w = document.getElementById("fr").contentWindow;
    return w.eval("(" + fn + ")()");
  }, seedInFrame.toString());
  console.log("seeded:", JSON.stringify(info));

  for (const shot of SHOTS) {
    await boot();
    await page.evaluate(args => {
      const w = document.getElementById("fr").contentWindow;
      w.go.apply(null, args); w.scrollTo(0, 0);
    }, shot.go);
    await page.waitForTimeout(400);

    if (shot.report) {
      /* open the most recent attempt of the first practised workshop, then park
         on an expanded answer card — the screen the speaking report lives on */
      await page.evaluate(() => {
        const w = document.getElementById("fr").contentWindow;
        /* S is a module-scope binding in the app, not a window property */
        const store = w.eval("(S.simulations&&S.simulations.attempts)||{}");
        const id = Object.keys(store)[0];
        const runs = store[id] || [];
        w.simOpenAttempt(id, runs[runs.length - 1].startedAt);
      });
      await page.waitForTimeout(900);
    }

    await page.waitForTimeout(shot.settle || 500);

    if (shot.findText) {
      const y = await page.evaluate(txt => {
        const w = document.getElementById("fr").contentWindow;
        const el = [...w.document.querySelectorAll(".view.on h2,.view.on h3,.view.on b,.view.on .eyebrow")]
          .find(e => e.textContent.trim().startsWith(txt));
        if (!el) return null;
        const card = el.closest(".card") || el;
        /* clear the sticky header + page eyebrow so the card's own title shows */
        return w.scrollY + card.getBoundingClientRect().top - 92;
      }, shot.findText);
      if (y == null) { console.error(`  ${shot.file}: "${shot.findText}" not found`); process.exitCode = 1; }
      else await page.evaluate(v => document.getElementById("fr").contentWindow.scrollTo(0, v), y);
      await page.waitForTimeout(450);
    }
    if (shot.report) {
      const y = await page.evaluate(() => {
        const w = document.getElementById("fr").contentWindow;
        const d = w.document.querySelector(".view.on details.sim-ans");
        if (!d) return null;
        d.open = true;
        /* the sticky pill would float across the card in the artwork */
        w.document.querySelectorAll(".stick-back").forEach(b => b.style.display = "none");
        return w.scrollY + d.getBoundingClientRect().top - 92;
      });
      if (y != null) { await page.evaluate(v => document.getElementById("fr").contentWindow.scrollTo(0, v), y); }
      await page.waitForTimeout(600);
    }

    const file = path.join(outDir, shot.file + ".png");
    await page.screenshot({ path: file });
    console.log(`  ${shot.file}.png  ok`);
  }

  await browser.close();
  console.log("\n-> " + outDir + `  (${W * S}x${H * S})`);
})();
