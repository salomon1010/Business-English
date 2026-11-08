/* AUDIT: what does the guided lesson actually support in each of the 12 weeks, day by day?
   Run: node tests/weeks-audit.mjs [baseUrl]      (the server must serve a copy with DLP_WEEKS lifted)
   READ-ONLY: it builds each day's plan and renders every step of its recipe, with the network blocked (so the AI
   paths take their offline route), and reports what is missing or broken. It changes nothing and approves nothing.
   For every one of the 84 days it records: does the plan build and validate against the curriculum; which recipe;
   how many target expressions; whether a scenario and a supporting video exist; how many curriculum passages the
   Listen step would have; and, per step, whether it rendered (page errors, an empty screen, a raw i18n key, or
   "undefined"/"NaN"/"[object" in the text). */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const BASE = process.argv[2] || "http://127.0.0.1:8602", OUT = process.env.OUT || "/tmp/weeks-audit";
const FLAGS = "onboarding_v2_enabled,home_v2_enabled,daily_learning_plan_pilot_enabled";
const b = await chromium.launch();
const result = {};
for (const [label, prof] of Object.entries({ withProfile: { name: "Dan", role: { label: "Data analyst", id: "tech.data_analyst", cat: "tech" }, sits: ["meetings", "presentations"] }, noProfile: { name: "Nia" } })) {
  const ctx = await b.newContext({ viewport: { width: 430, height: 930 }, serviceWorkers: "block" });
  await ctx.route(u => /be-events|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube|entitlements|workers\.dev|lomonec\.com\/(?!bemastery)/.test(u.href) && !u.href.startsWith(BASE), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const pageErrs = []; p.on("pageerror", e => pageErrs.push(String(e).slice(0, 160)));
  await p.goto(`${BASE}/index.html?flags=${FLAGS}`, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => typeof window.dlpOn === "function" && (curriculumOrEmpty().weeks || []).length > 0, null, { timeout: 60000 });
  const lifted = await p.evaluate(() => { try { return dlpOn(12, "Sun"); } catch (e) { return String(e); } });
  if (lifted !== true) { console.log("DLP_WEEKS is not lifted in the served page (dlpOn(12,'Sun') =", lifted, ")"); process.exit(2); }
  await p.evaluate(a => {
    document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    S.profile = Object.assign({}, S.profile, { name: a.name, lang: "en" });
    S.fnd = { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } };
    try { if (a.role) LearnerProfile.set(S, "role", { role: a.role.label, roleId: a.role.id, roleCat: a.role.cat });
      if (a.sits) LearnerProfile.set(S, "situations", { situations: a.sits, primarySituation: a.sits[0] });
      LearnerProfile.set(S, "confidence", { selfLevel: "Can get by" }); } catch (e) {}
    document.querySelectorAll(".view").forEach(x => x.classList.remove("on")); document.getElementById("v-journey").classList.add("on");
  }, prof);
  const days = [];
  for (let w = 1; w <= 12; w++) for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    days.push(await p.evaluate(async ({ w, d }) => {
      const o = { w, d }; window.__e = []; const prev = window.onerror; window.onerror = (m) => { window.__e.push(String(m).slice(0, 120)); };
      try {
        const wk = trackWeeks()[w - 1], dd = wk.days[d], key = dayKey(w, d);
        const phrases = trackPhrases().filter(x => x.w === w && !x.i).slice(0, 5);
        const video = DailyPlan.pickSupportingVideo(trackShadowStarters(), dlpVideoKeywords());
        S.dlp = {};
        const entry = DailyPlan.start(S, { trackId: "general", w, day: d, pack: dlpPack(), profile: dlpProfile(), phrases: dlpPool(w, phrases), video });
        o.built = !!entry; o.core = (dd && (dd.focus || "")).slice(0, 48);
        if (!entry) return o;
        const plan = entry.plan; o.shape = plan.shape; o.steps = DailyPlan.stepsOf(entry);
        const v = DailyPlan.validate(plan); o.valid = v.valid !== false && !(v.errors && v.errors.length); o.validErr = (v.errors || v.problems || []).slice(0, 2);
        let cv = null; try { cv = DailyPlan.validateAgainstCurriculum(plan, dlpPack()); } catch (e) { cv = { valid: false, errors: [String(e)] }; }
        o.curValid = cv && cv.valid !== false && !(cv.errors && cv.errors.length); o.curErr = ((cv && (cv.errors || cv.problems)) || []).slice(0, 2);
        o.targets = (plan.targetExpressions || []).length; o.scenario = !!(plan.personalizedScenario && plan.personalizedScenario.task); o.personalised = !!(plan.personalizedScenario && plan.personalizedScenario.personalized);
        o.video = !!plan.supportingVideo; o.task = !!(plan.staticFallback && plan.staticFallback.task); o.passages = dlpPassages(w, 2).length;
        o.render = {}; const el = document.getElementById("v-journey");
        for (const s of o.steps) {
          _dlpEntry = entry; entry.step = s; const e0 = window.__e.length; let thrown = "";
          try { dlpRenderStep(el, w, d, key); } catch (e) { thrown = String(e).slice(0, 100); }
          await new Promise(r => setTimeout(r, 120));
          const txt = el.innerText || "";
          o.render[s] = { len: txt.length, rawKeys: (txt.match(/\b(?:dlp|sess|home)\.[a-z0-9_.]+/g) || []).slice(0, 2), bad: /undefined|NaN|\[object/.test(txt), errs: window.__e.length - e0, thrown, lis: el.querySelectorAll("li").length, btn: el.querySelectorAll("button").length };
        }
      } catch (e) { o.fatal = String(e).slice(0, 140); }
      window.onerror = prev; return o;
    }, { w, d }));
  }
  result[label] = { days, pageErrs: [...new Set(pageErrs)].slice(0, 8) };
  await ctx.close();
}
writeFileSync(OUT + ".json", JSON.stringify(result, null, 1));
const problems = x => {
  const bad = [];
  for (const [s, v] of Object.entries(x.render || {})) {
    const why = [];
    if (v.len < 120) why.push("empty"); if (v.rawKeys.length) why.push("raw key " + v.rawKeys[0]);
    if (v.bad) why.push("undefined/NaN"); if (v.errs || v.thrown) why.push("error");
    if (why.length) bad.push(`${x.d}:${s}(${why.join(",")})`);
  }
  return bad;
};
for (const [label, r] of Object.entries(result)) {
  console.log(`\n===== ${label} =====   (page errors seen: ${r.pageErrs.length})`);
  console.log("wk | built valid curr | shapes     | targets/day     | scen pers vid | passages | step problems");
  for (let w = 1; w <= 12; w++) {
    const D = r.days.filter(x => x.w === w), bad = D.flatMap(problems);
    const line = [String(w).padStart(2), `${D.filter(x => x.built).length}/7   ${D.filter(x => x.valid).length}/7   ${D.filter(x => x.curValid).length}/7`, [...new Set(D.map(x => x.shape))].join("/").padEnd(10),
      D.map(x => x.targets).join(",").padEnd(15), `${D.filter(x => x.scenario).length}/7  ${D.filter(x => x.personalised).length}/7  ${D.filter(x => x.video).length}/7`, D.map(x => x.passages).join(",").padEnd(8),
      bad.length ? bad.slice(0, 4).join(" ") + (bad.length > 4 ? " +" + (bad.length - 4) : "") : "none"];
    console.log(line.join(" | "));
  }
}
await b.close();
