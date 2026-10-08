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
const path = require("path");
let chromium; try { ({ chromium } = require("playwright-core")); } catch (e) { ({ chromium } = require(path.join(__dirname, "..", "..", "tests", "node_modules", "playwright"))); }
const fs = require("fs");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE || "http://localhost:8765";
const OUT_ROOT = process.env.OUT_ROOT || "store-art-2026-10";

const PRESETS = {
  // css box the app lays out in, then the multiplier that hits Play's pixel size
  phone:  { w: 540, h: 1200, s: 2, out: "phone" },    // -> 1080x2400
  tablet: { w: 720, h: 1280, s: 2, out: "tablet" },   // -> 1440x2560
  // App Store, 6.9" iPhone (the one size App Store Connect requires today): 1320x2868
  iphone: { w: 440, h: 956, s: 3, out: "iphone-6.9" },
};

// go = router args, applied directly rather than via the hash so boot order can't
// race us; scrollTo = css px to scroll the frame before the shot
/* The Executive Polish speaking report, drawn by the app's own exRenderReport
   from demo data (the same fixture shape tests/polish-report.mjs uses), so the
   shot needs no live AI call and the wording is stable run to run. */
const polishReport = async (w) => {
  const AI = {
    key_message: "The launch moves one week so we can fix the payment bug first.", clarity: "fuzzy",
    sharper: "We are moving the launch to the 14th so we can fix the payment bug first.",
    level: "B1+", level_note: "Your update is clear, but the decision arrives last.",
    structure: ["Status", "The problem", "The decision"], structure_note: "Lead with the decision, then the reason.",
    answer_directly: "Open with the new date.", example: "We are moving the launch to the 14th.",
    evidence: "You named the bug but not its impact.",
    credibility: "You said 'I think maybe we should wait', which reads as a wish, not a decision.",
    hedges: [{ said: "I think maybe", better: "We will" }],
    corrections: [
      { said: "we have discovered a bug yesterday", fix: "we discovered a bug yesterday", why: "Use the past simple with a finished time like 'yesterday'.", kind: "tense" },
      { said: "the customers can loose their payment", fix: "customers could lose their payment", why: "'Lose' is the verb; 'loose' means not tight.", kind: "word choice" }],
    sentences: [
      { said: "so I think maybe we should wait one more week", rebuilt: "We are moving the launch by one week, to the 14th.", pattern: "We are moving [what] to [when].", pattern_use: "When you announce a decision." },
      { said: "because yesterday we have discovered a bug", rebuilt: "Because we found a payment bug yesterday, we need five more days.", pattern: "Because [fact], we need [what].", pattern_use: "When the reason must come first." }],
    words: [
      { said: "a big problem", better: "a blocker", meaning: "Something that stops the work.", example: "The payment bug is a blocker for launch." },
      { said: "wait", better: "push back", meaning: "Move to a later date.", example: "We will push back the launch by a week." }],
    collocations: [{ said: "do a decision", better: "make a decision", why: "Decisions are made, not done." }],
    remember_title: "Decision first", remember_body: "Say the new date in your first sentence. The reason comes second.",
    next_recording: "Give the same update in 45 seconds, opening with the new date.",
    quick_win_title: "Cut the hedges", quick_win_goal: "No 'I think' and no 'maybe' in the next minute.",
    concept_title: "One idea per sentence", concept_body: "Your middle section held three ideas in one breath.",
    coach_script: "You sounded calm, and your facts were right. The hedging is what costs you. You said 'I think maybe we should wait'. A project lead says 'We are moving the launch to the 14th.' Your grammar slip was the tense: we discovered, not we have discovered. Record the same update again and open with the date.",
    versions: [
      { style: "Clear and direct", text: "We are moving the launch to the 14th. Yesterday we found a payment bug. Customers could lose a payment, so we need five more days to fix and test it.", learn: ["moving the launch"] },
      { style: "Executive polish", text: "We are pushing the launch back a week, to the 14th. Yesterday's payment bug is a blocker: shipping now would put customer payments at risk. Five days lets us fix it and test it properly.", learn: ["pushing back", "a blocker", "at risk"] }],
    idioms: [
      { idiom: "back to the drawing board", meaning: "Start again.", when: "A plan has failed.", example: "If the fix fails, it is back to the drawing board." },
      { idiom: "on the same page", meaning: "Everyone agrees.", when: "Before a decision.", example: "I want the whole team on the same page by Friday." },
      { idiom: "a moving target", meaning: "Something that keeps changing.", when: "Scope keeps shifting.", example: "The scope has been a moving target all month." },
      { idiom: "buy some time", meaning: "Get a short delay.", when: "Asking for a delay.", example: "One week buys us time to test properly." }]
  };
  const m = { sec: 58, words: 96, wpm: 99, fillers: [{ w: "um", n: 2 }, { w: "you know", n: 1 }], fillerN: 3, hedges: [{ w: "i think", n: 1 }, { w: "maybe", n: 1 }], hedgeN: 2, sents: 4, wps: 24, ttr: 68, hes: 4, hesList: [{ t: 6, len: 1.1 }, { t: 31, len: 0.8 }], semis: 2.4, pitch: null };
  const prev = { at: Date.now() - 86400000, tk: w.areaId(), m: { ...m, fillerN: 6, hedgeN: 4, wpm: 88 }, ai: null, tx: "earlier take", targets: ["on the same page", "a blocker", "push back", "buy some time"] };
  const rep = { at: Date.now(), tk: w.areaId(), m, ai: AI, sttFailed: false,
    tx: "um so the status update is that the launch was planned for the 7th but um yesterday we have discovered a bug in the payment and the customers can loose their payment so I think maybe we should wait one more week you know to fix it",
    targets: w.exTargets(AI) };
  const L = w.aList("exRep"); L.length = 0; L.push(rep, prev);
  const ex = w.eval("ex");   // a top-level const, so not a window property
  ex.report = rep; ex.showReport = true; ex.repOpen = true;
  w.exRenderReport(rep, true);
  await new Promise(r => setTimeout(r, 400));
  const wrap = w.document.getElementById("exReportWrap");
  if (wrap) w.scrollTo(0, wrap.getBoundingClientRect().top + w.scrollY - 70);
};

const SHOTS = [
  { file: "01-journey",   go: ["journey"] },
  { file: "02-polish",    go: ["phrases"], settle: 900, after: polishReport, afterSettle: 900 },
  // Shadow is deliberately absent: every dense screen in the studio renders
  // third-party YouTube artwork, and the one that doesn't (Trouble words) is
  // two-thirds empty. Practice fills the slot instead — it is the spaced-
  // repetition gym, which nothing else in the set shows.
  { file: "03-practice",  go: ["practice"], settle: 4500 },
  // Life Simulations: the scenario list behind the Practice tab's card
  { file: "04-roleplay",  go: ["roleplay"], settle: 900 },
  // a day session deliberately renders into the journey view's container
  { file: "05-session",   go: ["session", 1, "Mon"], expect: "v-journey" },
  // Progress lives on its own tab since v418 (Profile became Settings): the
  // week's story and the key numbers sit at the top of it
  { file: "06-progress",  go: ["review"], settle: 900 },
  { file: "07-phrasebank", go: ["phrasebank", 1], settle: 900 },
  // Home is left out (Oct 2026): with one programme card it is two-thirds
  // empty, and the old 07-trend scroll no longer reaches the charts.
];
// Practice Partner (App Store set): real UI against the local be-partner Worker
// (wrangler dev, DEV_AUTH) — "Alex" is consented, "Sam" is in line, so the page
// shows the presence strip and Match me finds a real candidate card. Opt-in:
//   PARTNER=1 PARTNER_API=http://127.0.0.1:8790 node scripts/store-art/shoot.js iphone
const PARTNER_API = process.env.PARTNER_API || "http://127.0.0.1:8790";
const PARTNER_SHOTS = [
  { file: "08-partner", go: ["partner"], settle: 4500 },
  { file: "09-partner-match", go: ["partner"], settle: 1200, after: async (w) => { await w.ppMatch(); }, afterSettle: 4500 },
];
if (process.env.PARTNER === "1") SHOTS.push(...PARTNER_SHOTS);

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
    /* the per-feature histories the Progress trend section reads — a rising
       story, because that section exists to show improvement */
    gram: { blanks: { best: 92, runs: 5,
      hist: [50, 63, 75, 88, 92].map((p, i) => ({ t: now - (5 - i) * 3 * DAY, p })) } },
    quizHist: [40, 55, 70, 80, 90].map((p, i) => ({ t: now - (5 - i) * 2 * DAY, p })),
    profile: { name: "Alex", role: "Product / PM", goal: "\u{1F3A4} Speak confidently in meetings",
               slot: "☀️ Morning coffee", lang: "en", ts: now - 40 * DAY },
    dates, dayLog, startDate: iso(now - 40 * DAY),
    // past the placement check (otherwise Practice and Practice Partner show the
    // Foundations gate), and the partner-alerts nudge already seen — the App
    // Store shell has no web push, so the "Turn on" row must not appear in a shot
    fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} } },
    pp: { nudgeDone: true },
    rmSeen: now,   // the one-time "your road map lives here" announcement, already seen
  };
  localStorage.setItem("be12_v1", JSON.stringify(S));
  localStorage.setItem("be_theme", "dark");
  // the cloud sign-in nudge floats over the bottom of every page ~800ms in
  localStorage.setItem("be12_syncNudge", "1");
  if (window.__partnerApi) { localStorage.setItem("be_partner_api", window.__partnerApi); localStorage.setItem("be_partner_dev_user", "alex"); }
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

  // seed once for the origin; the iframe shares it. The iframe must NOT hold the
  // app while we seed: since save() became a deferred write that flushes on
  // pagehide, an app booted before the seed would overwrite it on navigation.
  /* IOS=1: the App Store build — the iframe's app sees the Capacitor shell
     (IS_IOS_APP), so Play links and web-only rows disappear as on the iPhone.
     Every native plugin is present and inert: no store products (billing is
     off in production anyway), no ad provider, no push prompt. */
  if (process.env.IOS === "1") await page.addInitScript(() => {
    if (window === window.top) return;
    const none = async () => ({});
    const P = {
      BEStoreKit: { getProducts: async () => ({ products: [] }), purchase: none, restore: async () => ({ items: [] }), currentEntitlements: async () => ({ items: [] }), pendingTransactions: async () => ({ items: [] }), finish: none, manageSubscriptions: none, addListener: () => ({ remove() {} }) },
      BEAds: { configure: async () => ({ available: false }) },
      BEPush: { status: async () => ({ permission: "prompt" }), addListener: () => ({ remove() {} }) },
      BEWidget: { update: async () => ({ stored: true }), clear: none, pendingOpen: async () => ({}), addListener: () => ({ remove() {} }) },
    };
    window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, Plugins: P, PluginHeaders: Object.keys(P).map(name => ({ name })) };
  });
  await page.goto(BASE + "/scripts/store-art/frame.html?u=about:blank");
  if (process.env.PARTNER === "1") {
    const api = (u, p, b) => fetch(PARTNER_API + p, { method: "POST", headers: { "x-dev-user": u, "content-type": "application/json" }, body: JSON.stringify(b) });
    const h = await (await fetch(PARTNER_API + "/health")).json().catch(() => null);
    if (!h || !h.dev) { console.error("PARTNER=1 needs a local be-partner (wrangler dev --env dev) at " + PARTNER_API); process.exit(1); }
    await api("alex", "/consent", { name: "Alex", lang: "en", adult: true, goals: ["workplace"], avail: ["morning"], tz: 0 });
    await api("sam", "/consent", { name: "Sam", lang: "en", adult: true, goals: ["workplace"], avail: ["morning"], tz: 0 });
    await api("sam", "/interest", { track: "general-english", band: "w1-4", lang: "en", promptWeek: 1 });
    await page.evaluate(api => { window.__partnerApi = api; }, PARTNER_API);
  }
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
    // toasts are transient by design (presence nudges, "N learners waiting");
    // a capture must not freeze one over the page
    const clearToasts = () => page.evaluate(() => { const d = document.getElementById("fr").contentWindow.document; d.querySelectorAll("#toast, .toast").forEach(t => { t.style.display = "none"; }); });
    await clearToasts();
    if (shot.after) {
      await page.evaluate(async (fn) => { const w = document.getElementById("fr").contentWindow; await (new Function("w", "return (" + fn + ")(w)"))(w); }, shot.after.toString());
      await page.waitForTimeout(shot.afterSettle || 800);
      await clearToasts();
    }
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
