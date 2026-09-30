/* ============================================================================
   Ten Welding professions, one list, and the standards behind them.
   --------------------------------------------------------------------------
   The acceptance test the owner set is not "the dropdown works". It is that
   choosing a profession reaches the interview, the evaluation, the feedback,
   the AI coach context, the simulation and the career readiness — and that the
   standards named are real ones the registry holds, never invented.

   Run: node tests/professions.mjs            (BASE=http://127.0.0.1:8471)
   ========================================================================== */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:8471";
const PROFS = ["welder","pipefitter","boilermaker","operator","instrumentation",
               "electrician","hse","ndt","process","millwright"];

let pass = 0, fail = 0;
const ok  = (n, c, extra) => { c ? (pass++, console.log("  ok   " + n)) : (fail++, console.log("  FAIL " + n + (extra ? "  → " + extra : ""))); };

const boot = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem("be_theme", "dark");
    localStorage.setItem("be_events_api", "");
    if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({
      profile: { name: "Alex", lang: "en", ts: Date.now() },
      professionalTracks: { activeId: "welding", tradeId: "welder" },
      careerCenter: { destination: "international-contractor" },
      fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {},
      rmSeen: Date.now(), lastSeen: Date.now()
    }));
  });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.Trades && !!window.ProfessionalStandards, null, { timeout: 15000 });
  return errs;
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = await boot(page);

  /* ---------- 1. one list, ten professions, four groups ---------- */
  console.log("\n1. The list");
  const list = await page.evaluate(() => ({
    trades: Trades.all().map(t => t.id),
    groups: Trades.groups().map(g => ({ id: g.id, ids: g.trades.map(t => t.id) })),
    labels: Trades.all().map(t => t.name)
  }));
  ok("ten professions", list.trades.length === 10, list.trades.join(","));
  ok("every expected id present", PROFS.every(p => list.trades.includes(p)));
  ok("four groups", list.groups.length === 4, JSON.stringify(list.groups.map(g => g.id)));
  ok("groups match the Shadow catalogue's four",
     ["ops","elec","insp","mech"].every(g => list.groups.some(x => x.id === g)));
  ok("every profession is in exactly one group",
     PROFS.every(p => list.groups.filter(g => g.ids.includes(p)).length === 1));

  /* ---------- 2. selection persists and is the one source ---------- */
  console.log("\n2. Selection and persistence");
  for (const id of PROFS) {
    const r = await page.evaluate(p => {
      profSet(p);
      return { active: Trades.active(S).id, stored: S.professionalTracks.tradeId };
    }, id);
    ok("select " + id + " → active and stored", r.active === id && r.stored === id, JSON.stringify(r));
  }
  const survives = await page.evaluate(() => { profSet("hse"); saveFlush(); return JSON.parse(localStorage.getItem("be12_v1")).professionalTracks.tradeId; });
  ok("the choice is written to storage", survives === "hse", survives);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.Trades, null, { timeout: 15000 });
  const afterReload = await page.evaluate(() => Trades.active(S).id);
  ok("the choice survives a reload", afterReload === "hse", afterReload);

  /* ---------- 3. the Shadow filter is independent (owner, 30 Sep) ---------- */
  console.log("\n3. The Shadow filter does NOT change the profession");
  const indep = await page.evaluate(() => {
    profSet("hse");
    const before = Trades.active(S).id;
    weldProfSet("welder");                       /* library filter only */
    const afterFilter = Trades.active(S).id;
    const filter = S.profile.weldProf;
    weldProfSet("none");
    return { before, afterFilter, filter, none: S.profile.weldProf, stillProf: Trades.active(S).id };
  });
  ok("filtering to Welder leaves the profession on HSE",
     indep.before === "hse" && indep.afterFilter === "hse", JSON.stringify(indep));
  ok("the filter stores its own value", indep.filter === "welder", indep.filter);
  ok("'No filter' leaves the profession alone", indep.stillProf === "hse", indep.stillProf);

  /* ---------- 4. standards resolve, and only from the registry ---------- */
  console.log("\n4. Standards mapping");
  const std = await page.evaluate(profs => profs.map(id => {
    const tr = Trades.get(id);
    const primary = ProfessionalStandards.forProfession(id);
    const mods = [];
    for (let m = 1; m <= 12; m++) {
      const c = Trades.standardsFor(tr, m);
      if (c.verified) mods.push(m);
    }
    return { id, primary: primary.map(x => x.code), modules: mods,
             interview: Trades.standardsFor(tr, 11).standards.map(x => x.code),
             focus: Trades.standardsFor(tr, 11).focus,
             chips: (tr.codes || []) };
  }), PROFS);

  for (const r of std) {
    ok(r.id + " has primary standards", r.primary.length >= 2, r.primary.join(", "));
    ok(r.id + " resolves standards on the interview (11)", r.interview.length >= 1, r.interview.join(", "));
    ok(r.id + " states a professional focus on 11", !!r.focus, r.focus);
    ok(r.id + " card chips come from the registry",
       r.chips.length === r.primary.length && r.chips.every((c, i) => c.startsWith(r.primary[i])),
       JSON.stringify(r.chips));
  }

  /* every profession's standards must differ from the welder's — that is the
     whole complaint the owner raised */
  const welder = std.find(x => x.id === "welder").primary.join("|");
  for (const r of std.filter(x => x.id !== "welder")) {
    ok(r.id + " is NOT held to the welder's standards", r.primary.join("|") !== welder, r.primary.join(", "));
  }

  /* ---------- 5. no fabricated standards ---------- */
  console.log("\n5. No fabricated citations");
  const reg = await page.evaluate(() => {
    const ids = ProfessionalStandards.registry();
    const all = ids.map(i => ProfessionalStandards.get(i));
    return {
      count: ids.length,
      clauses: all.filter(x => /clause/i.test(x.code)).map(x => x.code),
      employer: all.filter(x => x.employer).map(x => x.code),
      missingExpects: all.filter(x => !x.expects).map(x => x.id),
      orgs: [...new Set(all.map(x => x.org))]
    };
  });
  ok("registry is populated", reg.count > 40, String(reg.count));
  ok("every standard says what it expects", reg.missingExpects.length === 0, reg.missingExpects.join(","));
  ok("the only clause-level citation is the one the repo already carried",
     reg.clauses.length === 1 && reg.clauses[0] === "ISO 9001 Clause 8.7", reg.clauses.join(","));
  ok("employer documents are marked as employer documents, not standards",
     reg.employer.length >= 3 && reg.employer.every(c => /Employer/.test(c)), reg.employer.join(", "));

  /* no profession may cite a standard the registry does not hold */
  const orphan = await page.evaluate(profs => {
    const held = new Set(ProfessionalStandards.registry());
    const bad = [];
    profs.forEach(id => {
      for (let m = 1; m <= 12; m++)
        ProfessionalStandards.forModule(id, m).forEach(s => { if (!held.has(s.id)) bad.push(id + "/" + m + "/" + s.id); });
    });
    return bad;
  }, PROFS);
  ok("no profession cites a standard outside the registry", orphan.length === 0, orphan.join(","));

  /* ---------- 6. the interview follows the profession ---------- */
  console.log("\n6. Interview content");
  const iv = await page.evaluate(profs => profs.map(id => {
    profSet(id);
    const tr = Trades.active(S);
    const coach = trackAiMentors().find(m => m.id === "welding-mentor-11");
    const sim = trackSimulations().find(s => s.id === "welding-sim-11");
    return {
      id,
      title: rpTitleText(coach),
      greet: rpGreet(coach),
      model: rpModel(coach),
      simTitle: (Trades.scenarioFor(tr, 11) || {}).title || sim.title,
      q1: !!Trades.questionFor(tr, 11, "open"),
      vocab: Trades.vocabFor(tr).length
    };
  }), PROFS);

  const greets = new Set(), models = new Set(), titles = new Set();
  for (const r of iv) {
    greets.add(r.greet); models.add(r.model); titles.add(r.simTitle);
    ok(r.id + " interview has its own title", /interview/i.test(r.simTitle), r.simTitle);
    ok(r.id + " interview model answer is non-empty", r.model.length > 60);
    ok(r.id + " carries trade vocabulary", r.vocab >= 10, String(r.vocab));
  }
  ok("all ten interview openings differ", greets.size === 10, String(greets.size));
  ok("all ten interview model answers differ", models.size === 10, String(models.size));
  ok("all ten interview titles differ", titles.size === 10, String(titles.size));

  /* the welding words must not appear in a non-welding profession's interview */
  /* NDT is excluded on purpose: a technician's job IS weld examination, so
     "weld" in their answer is their trade, not leaked welding copy. The test is
     that nobody is asked to BE a welder. */
  const leak = iv.filter(r => !["welder","pipefitter","boilermaker","ndt"].includes(r.id))
                 .filter(r => /\bweld(ing|er)?\b/i.test(r.greet + " " + r.model));
  ok("no welding wording leaks into the other six interviews",
     leak.length === 0, leak.map(x => x.id).join(","));
  ok("NDT talks about examining welds, not about being a welder",
     /examination|examine/i.test(iv.find(x => x.id === "ndt").model) &&
     !/I'm a welder|as a welder/i.test(iv.find(x => x.id === "ndt").model));

  /* ---------- 7. workshops: all twelve, per profession ---------- */
  console.log("\n7. Workshop coverage");
  const ws = await page.evaluate(profs => profs.map(id => {
    const tr = Trades.get(id);
    let mods = 0, qs = 0;
    for (let m = 1; m <= 12; m++) {
      const sc = Trades.scenarioFor(tr, m);
      if (sc && sc.title) mods++;
      ["open","t0","t1","t2","t3"].forEach(k => { if (Trades.questionFor(tr, m, k)) qs++; });
    }
    return { id, mods, qs };
  }), PROFS);
  for (const r of ws) {
    if (r.id === "welder") { ok("welder uses the pack itself (by design)", r.qs === 0, String(r.qs)); continue; }
    ok(r.id + " renames all 12 workshops", r.mods === 12, String(r.mods));
    ok(r.id + " has its own questions in all 12 (60 entries)", r.qs === 60, String(r.qs));
  }

  /* ---------- 8. evaluation uses the profession ---------- */
  console.log("\n8. Evaluation");
  const ev = await page.evaluate(() => {
    const out = {};
    ["hse","welder","millwright"].forEach(id => {
      profSet(id);
      const tr = Trades.active(S);
      out[id] = {
        extra: [10, 9, 5, 6].map(m => Trades.benchmarksFor(tr, m).map(b => b.id)).flat(),
        vocab: Trades.vocabFor(tr).slice(0, 4)
      };
    });
    return out;
  });
  ok("HSE adds its own benchmarks", ev.hse.extra.length >= 2, ev.hse.extra.join(","));
  ok("Millwright's benchmarks differ from HSE's",
     ev.millwright.extra.join("|") !== ev.hse.extra.join("|"),
     ev.millwright.extra.join(","));
  ok("HSE vocabulary is HSE vocabulary", ev.hse.vocab.includes("hazard"), ev.hse.vocab.join(","));
  ok("Millwright vocabulary is mechanical", ev.millwright.vocab.includes("alignment"), ev.millwright.vocab.join(","));

  /* ---------- 9. the AI coach is given profession + standards ---------- */
  console.log("\n9. AI coach context");
  const coach = await page.evaluate(() => {
    profSet("hse");
    const tr = Trades.active(S);
    const lines = ProfessionalStandards.promptLines(tr.id, 10);
    profSet("electrician");
    const lines2 = ProfessionalStandards.promptLines(Trades.active(S).id, 10);
    return { hse: lines, elec: lines2 };
  });
  ok("HSE's coach lines name HSE standards",
     coach.hse.some(l => /1910\.146|confined/i.test(l)), coach.hse[0]);
  ok("the electrician's differ from HSE's",
     coach.hse.join("|") !== coach.elec.join("|"), coach.elec[0]);
  ok("coach lines carry the plain-English expectation",
     coach.hse.every(l => l.includes(": ")), coach.hse[0]);

  /* ---------- 10. the profile card renders the list and the standards ---------- */
  console.log("\n10. The profile card");
  await page.evaluate(() => { profSet("ndt"); go("career"); });
  await page.waitForTimeout(400);
  const card = await page.evaluate(() => {
    const el = document.querySelector(".career-trade");
    if (!el) return null;
    el.open = true;
    const pill = el.querySelector(".wprof-pill");
    return {
      name: (el.querySelector(".cf-now") || {}).textContent || "",
      hasPill: !!pill,
      pillLabel: pill ? (pill.querySelector("b") || {}).textContent : "",
      chips: [...el.querySelectorAll(".career-std .sim-skill-chips span")].map(x => x.textContent),
      expects: [...el.querySelectorAll(".career-std-list li")].length,
      noPay: /varies widely/i.test(el.textContent)
    };
  });
  ok("the card exists", !!card);
  ok("it names the chosen profession", card && /NDT/.test(card.name), card && card.name);
  ok("it uses the dropdown pill, not chips", card && card.hasPill);
  ok("the pill shows the profession", card && /NDT/.test(card.pillLabel), card && card.pillLabel);
  ok("it shows the standards", card && card.chips.length >= 2, card && card.chips.join(" | "));
  ok("each standard says what it expects", card && card.expects >= 2, card && String(card.expects));
  ok("no pay figure is invented for a profession without one", card && card.noPay);

  /* the dropdown opens and offers ten, with no 'No filter' row */
  await page.evaluate(() => weldProfSheet(document.querySelector(".career-trade .wprof-pill"), { mode: "profession" }));
  await page.waitForTimeout(250);
  const pop = await page.evaluate(() => {
    const p = document.getElementById("weldProfOv");
    if (!p) return null;
    return {
      opts: [...p.querySelectorAll(".sv-tr-opt")].map(b => b.textContent.trim()),
      groups: [...p.querySelectorAll(".wprof-gl")].map(g => g.textContent.trim()),
      none: !!p.querySelector(".wprof-none")
    };
  });
  ok("the dropdown opens on the profile card", !!pop);
  ok("it offers exactly ten professions", pop && pop.opts.length === 10, pop && String(pop.opts.length));
  ok("it shows the four group headings", pop && pop.groups.length === 4, pop && pop.groups.join(" / "));
  ok("it has no 'No filter' row (a learner always has a profession)", pop && !pop.none);
  await page.evaluate(() => weldProfPopClose());

  /* ---------- 11. the report names the standard ---------- */
  console.log("\n11. Feedback names the standard");
  const rep = await page.evaluate(() => {
    const out = {};
    ["hse","welder"].forEach(id => {
      profSet(id);
      const sc = trackSimulations().find(s => s.id === "welding-sim-10");
      const run = { startedAt: Date.now(), answers: [{ q: "open", ask: "x", said: "I checked the permit and the isolation before we started.", answered: true, covered: [], missed: [], vocabUsed: [], vocabMissed: [], coverage: 0.4 }] };
      const html = String(simReportHTML(run, sc, "", "", {}) || "");
      out[id] = {
        assessed: /Assessed against/.test(html),
        named: (html.match(/<span>([^<]*—[^<]*)<\/span>/g) || []).slice(0, 4),
        focus: /Professional focus/.test(html),
        expects: /What the standard expects/.test(html),
        verify: /Confirm the standard and edition/.test(html),
        notCert: /not evidence of your welding ability|not a certification/i.test(html)
      };
    });
    return out;
  });
  ok("the report has an Assessed against block", rep.hse.assessed);
  ok("HSE's report names HSE standards",
     rep.hse.named.some(x => /1910\.146|Permit-required/i.test(x)), rep.hse.named.join(" | "));
  ok("the welder's report names welding standards",
     rep.welder.named.some(x => /Permit|NFPA|Employer/i.test(x)), rep.welder.named.join(" | "));
  ok("HSE's citations differ from the welder's on the same workshop",
     rep.hse.named.join("|") !== rep.welder.named.join("|"));
  ok("the report states the professional focus", rep.hse.focus);
  ok("the report says what the standard expects", rep.hse.expects);
  ok("the report tells the learner to confirm the edition", rep.hse.verify);

  /* ---------- 12. switching profession leaves no stale standards ---------- */
  console.log("\n12. No stale context after a switch");
  const sw = await page.evaluate(() => {
    const snap = id => {
      profSet(id);
      const tr = Trades.active(S);
      const sc = trackSimulations().find(s => s.id === "welding-sim-10");
      const coachSc = trackAiMentors().find(m => m.id === "welding-mentor-11");
      return {
        prof: tr.id,
        codes: (Trades.codesFor(tr, 10) || []).join("|"),
        chips: (tr.codes || []).join("|"),
        greet: rpGreet(coachSc),
        model: rpModel(coachSc),
        report: String(simReportHTML({ startedAt: Date.now(), answers: [{ q: "open", ask: "x", said: "I checked the permit and the isolation before we started.", answered: true, covered: [], missed: [], vocabUsed: [], vocabMissed: [], coverage: 0.4 }] }, sc, "", "", {}) || ""),
        prompt: ProfessionalStandards.promptLines(tr.id, 10).join("|")
      };
    };
    const a = snap("welder"), b = snap("hse"), c = snap("boilermaker");
    return { a, b, c };
  });
  ok("Welder → HSE changes the module citations", sw.a.codes !== sw.b.codes, sw.b.codes);
  ok("Welder → HSE changes the card chips", sw.a.chips !== sw.b.chips);
  ok("Welder → HSE changes the interview opening", sw.a.greet !== sw.b.greet, sw.b.greet);
  ok("Welder → HSE changes the model answer", sw.a.model !== sw.b.model);
  ok("Welder → HSE changes the coach's standards", sw.a.prompt !== sw.b.prompt);
  ok("HSE report holds no welder citation", !/AWS D1\.1|ISO 9606/.test(sw.b.report));
  ok("HSE → Boilermaker changes the citations again", sw.b.codes !== sw.c.codes, sw.c.codes);
  ok("Boilermaker report holds no HSE-only citation", !/ISO 31000/.test(sw.c.report));

  /* ---------- 13. General English is untouched ---------- */
  console.log("\n13. General English has no profession");
  const ge = await page.evaluate(() => {
    S.professionalTracks.activeId = "general-english"; save();
    const card = CareerCenter.render(S);
    return { pro: isProfessionalJourney(), hasTrade: /career-trade/.test(card) };
  });
  ok("General English is not a professional journey", ge.pro === false);
  ok("General English shows no profession card", ge.hasTrade === false);

  /* ---------- 14. no runtime errors ---------- */
  console.log("\n14. Runtime");
  /* cloudflareinsights is the analytics beacon; it is CORS-blocked on a local
     server and has nothing to do with this change */
  const real = errs.filter(e => !/favicon|manifest|sw\.js|Failed to load resource|cloudflareinsights|cdn-cgi\/rum/i.test(e));
  ok("no JS errors during the run", real.length === 0, real.slice(0, 3).join(" ‖ "));

  await browser.close();
  console.log("\n" + "=".repeat(52));
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log("=".repeat(52));
  process.exit(fail ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
