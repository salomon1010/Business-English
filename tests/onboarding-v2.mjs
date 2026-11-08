/* Onboarding V2 (General English): the real flow in a real browser.
   Covers the initial flow, searchable panels, primary focus, the review, saving into the learner profile, Welding
   isolation, existing learners, Profile editing, "Tune your practice", the lesson plan consuming the profile, keyboard
   behaviour, geometry (no overlap / overflow) and accessibility.
   Run: cd tests && node onboarding-v2.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
setTimeout(() => { console.log("WATCHDOG"); process.exit(2); }, 420000).unref?.();
const PORT = process.env.PORT || 8995; let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(900); BASE = "http://127.0.0.1:" + PORT; }
const b = await chromium.launch();
const jsErr = e => e.filter(x => !/MIME type|net::ERR|Failed to load resource|CORS|cloudflare/i.test(x));
const FND = t => ({ placed: "full", finished: true, day: 1, done: {} });
async function open({ flags = { onboarding_v2_enabled: true }, track = "general-english", state = null, vp = { width: 390, height: 844 }, reduced = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript(([f, tr, st]) => { if (tr) window.BE_BUILD = { track: tr }; if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.setItem("be_flags", JSON.stringify(f)); if (st) localStorage.setItem("be12_v1", JSON.stringify(st)); } }, [flags, track, state]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  await p.goto(BASE + "/index.html"); await sleep(1800);
  return { ctx, p, errs };
}
const seedGE = (extra = {}) => ({ profile: { name: "Pat", role: "Student", goal: "", slot: "", selfLevel: "Can get by", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": FND() }, areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {}, ...extra });
const click = (p, sel) => p.click(sel);
const next = async p => { await p.click("[data-act=next]"); await sleep(450); };
const overlaps = (p, scope) => p.evaluate(sc => { const rows = [...document.querySelectorAll(sc + " .obx-row")].map(r => r.getBoundingClientRect()).filter(r => r.height > 0); let n = 0; for (let i = 1; i < rows.length; i++) if (rows[i].top < rows[i - 1].bottom - 0.5 && rows[i].left < rows[i - 1].right && rows[i].right > rows[i - 1].left) n++; return { n, rows: rows.length, hscroll: document.documentElement.scrollWidth > window.innerWidth + 1 }; }, scope);

console.log("\n# 1. the flag decides: off = the released onboarding, unchanged");
{
  const { ctx, p, errs } = await open({ flags: {} });
  const st = await p.evaluate(() => ({ legacy: !!document.getElementById("obName"), v2: !!document.querySelector(".obx-card"), v2active: window.OnboardingV2 ? OnboardingV2.active() : "none" }));
  ok("1 · flag OFF: the released onboarding shows (name field, no V2 card)", st.legacy && !st.v2 && st.v2active === false, JSON.stringify(st));
  await p.evaluate(() => { document.getElementById("obName").value = "Alex"; obNext(); }); await sleep(300); await p.evaluate(() => obLangPick("en")); await sleep(600);   /* pinned build: the programme step is already skipped */
  const legacySteps = await p.evaluate(() => ({ step: OB.step, h1: document.querySelector("#obWrap h1")?.innerText }));
  ok("2 · and it is still the original sequence (role step next, no situations step)", legacySteps.step === 3 && /What do you do/.test(legacySteps.h1), JSON.stringify(legacySteps));
  await p.evaluate(() => { OB.role = "Student"; obNext(); }); await sleep(300); await p.evaluate(() => obGoalPick("🏆 Ace interviews in English")); await sleep(300);
  ok("3 · after the goal the next question is the confidence one (the unreleased situations step is NOT in the released flow)", /English today/.test(await p.evaluate(() => document.querySelector("#obWrap h1")?.innerText)));
  await p.evaluate(() => obLevelPick("Can get by")); await sleep(300); await p.evaluate(() => obFinish()); await sleep(300);
  const prof = await p.evaluate(() => ({ p: S.profile, lp: S.lp }));
  ok("4 · flag OFF writes the legacy profile only: no learner profile, and nothing new inside S.profile", !prof.lp && !("situations" in prof.p) && !("roleOther" in prof.p) && prof.p.role === "Student", JSON.stringify(prof));
  await ctx.close();
}

console.log("\n# 2. the initial flow (flag ON, General English)");
let s1;
{
  const { ctx, p, errs } = await open(); s1 = { ctx, p, errs };
  const st0 = await p.evaluate(() => ({ v2: !!document.querySelector(".obx-card"), dots: document.querySelectorAll(".ob-dot").length, nextDisabled: document.querySelector("[data-act=next]").disabled, track: BE_APP_TRACK }));
  ok("5 · flag ON in a General English build: the V2 name step, 7 dots, Continue disabled until a name", st0.v2 && st0.dots === 7 && st0.nextDisabled && st0.track === "general-english", JSON.stringify(st0));
  await p.fill("#obxName", "Alex"); ok("6 · typing a name enables Continue", !(await p.evaluate(() => document.querySelector("[data-act=next]").disabled)));
  await next(p);
  /* native language */
  await click(p, "#obxLang"); await sleep(400);
  const lang0 = await p.evaluate(() => ({ rows: document.querySelectorAll(".obx-body .obx-row").length, sheet: document.querySelector(".obx-sheet")?.getAttribute("role"), modal: document.querySelector(".obx-sheet")?.getAttribute("aria-modal"), groupHeads: [...document.querySelectorAll(".obx-body .obx-grp")].map(x => x.textContent) }));
  ok("7 · the native-language panel lists the app's 105 languages in two groups", lang0.rows >= 100 && lang0.groupHeads.length === 2 && lang0.sheet === "dialog" && lang0.modal === "true", JSON.stringify({ r: lang0.rows, g: lang0.groupHeads }));
  await p.fill(".obx-search input", "espanol"); await sleep(250);
  ok("8 · search is accent-insensitive: 'espanol' finds Español", await p.evaluate(() => [...document.querySelectorAll(".obx-body .obx-row")].some(r => /Español/.test(r.textContent))));
  await p.fill(".obx-search input", "tagal"); await sleep(250);
  const found = await p.evaluate(() => document.querySelectorAll(".obx-body .obx-row").length);
  await click(p, ".obx-body .obx-row"); await click(p, ".obx-confirm"); await sleep(500);
  const nat = await p.evaluate(() => ({ lang: OnboardingV2._state.nativeLang, sheet: !!document.querySelector(".obx-sheet") }));
  ok("9 · a language the app is not translated into (Tagalog) can still be the native language; the app stays in English", found >= 1 && nat.lang === "tl" && !nat.sheet && (await p.evaluate(() => (S.profile && S.profile.lang) || "en")) === "en", JSON.stringify(nat));
  await next(p);
  /* profession */
  await click(p, "#obxProf"); await sleep(400);
  const pr0 = await p.evaluate(() => ({ rows: document.querySelectorAll(".obx-body .obx-row").length, chips: document.querySelectorAll(".obx-gchips button").length, heads: document.querySelectorAll(".obx-body .obx-grp").length, confirmDisabled: document.querySelector(".obx-confirm").disabled, other: !!document.querySelector(".obx-body [data-other]") }));
  ok("10 · the profession panel holds 280+ options in 17 groups with a chip per group and Other at the end", pr0.rows > 280 && pr0.heads === 18 && pr0.chips === 17 && pr0.confirmDisabled && pr0.other, JSON.stringify(pr0));
  const g0 = await overlaps(p, ".obx-sheet");
  ok("11 · no rows overlap and nothing overflows sideways in the long list", g0.n === 0 && !g0.hscroll, JSON.stringify(g0));
  await p.fill(".obx-search input", "weld"); await sleep(250);
  const top = await p.evaluate(() => document.querySelector(".obx-body .obx-row")?.textContent.trim());
  ok("12 · searching 'weld' puts Welder first; it is just a profession in the list", /Welder/.test(top), top);
  await p.fill(".obx-search input", "zzqqxx"); await sleep(250);
  const none = await p.evaluate(() => ({ empty: !!document.querySelector(".obx-empty"), other: !!document.querySelector(".obx-body [data-other]") }));
  ok("13 · with no match the panel says so and still offers Other", none.empty && none.other, JSON.stringify(none));
  await p.fill(".obx-search input", ""); await sleep(250);
  await p.evaluate(() => { window.__row = document.querySelector('.obx-body .obx-row[data-id="trades.welder"]'); }); await click(p, '.obx-body .obx-row[data-id="trades.welder"]');
  const same = await p.evaluate(() => ({ same: window.__row === document.querySelector('.obx-body .obx-row[data-id="trades.welder"]'), on: window.__row.classList.contains("on"), sel: window.__row.getAttribute("aria-selected") }));
  ok("14 · choosing a row updates it IN PLACE (same element, no re-render: the cause of the earlier flicker/ghosting is gone)", same.same && same.on && same.sel === "true", JSON.stringify(same));
  ok("15 · Confirm enables, and the footer names the choice", await p.evaluate(() => !document.querySelector(".obx-confirm").disabled && /Welder/.test(document.querySelector(".obx-count").textContent)));
  await click(p, ".obx-confirm"); await sleep(400);
  const prof = await p.evaluate(() => ({ id: OnboardingV2._state.roleId, cat: OnboardingV2._state.roleCat, route: location.hash, track: areaId(), active: S.professionalTracks && S.professionalTracks.activeId, weld: S.profile && S.profile.weldProf }));
  ok("16 · Welder is saved as a General English profession and activates nothing (area, programme and weldProf unchanged)", prof.id === "trades.welder" && prof.cat === "trades" && prof.track === "general-english" && !prof.weld, JSON.stringify(prof));
  await next(p);
  /* goal */
  const goals = await p.evaluate(() => [...document.querySelectorAll("#obxGoals .obx-row")].map(r => r.textContent.trim()));
  ok("17 · the goal step offers all 14 goals, including the two renamed ones", goals.length === 14 && goals.includes("Speak confidently on phone and video calls") && goals.includes("Communicate confidently in academic settings"), goals.join("|"));
  ok("18 · Continue stays disabled until a goal is chosen", await p.evaluate(() => document.querySelector("[data-act=next]").disabled));
  await click(p, "#obxGoals .obx-row >> nth=9"); await next(p);
  /* situations */
  const sit0 = await p.evaluate(() => ({ rows: document.querySelectorAll("#obxSits .obx-row[data-id]").length, heads: [...document.querySelectorAll("#obxSits .obx-grp")].map(h => h.textContent), status: document.getElementById("obxStatus").textContent, mainHidden: document.querySelector("#obxSits .obx-main").hidden }));
  ok("19 · the situations step lists 16 situations in 4 groups; nothing is required", sit0.rows === 16 && sit0.heads.length === 4 && sit0.mainHidden && /skip/i.test(sit0.status), JSON.stringify(sit0));
  for (const i of [2, 0, 5, 12]) await click(p, `#obxSits .obx-row[data-id] >> nth=${i}`);
  const sit1 = await p.evaluate(() => ({ sel: OnboardingV2._state.situations, primary: OnboardingV2._state.primary, status: document.getElementById("obxStatus").textContent, main: document.querySelector("#obxSits .obx-main").hidden }));
  ok("20 · four situations can be chosen, and the FIRST one becomes the main focus automatically", sit1.sel.length === 4 && sit1.primary === sit1.sel[0] && !sit1.main && /4 selected/.test(sit1.status), JSON.stringify(sit1));
  await click(p, "#obxSits .obx-row[data-id] >> nth=15");
  ok("21 · a fifth is refused (limit 4) and nothing changes", (await p.evaluate(() => OnboardingV2._state.situations.length)) === 4);
  await click(p, "#obxSits [data-p] >> nth=2");
  const sit2 = await p.evaluate(() => OnboardingV2._state);
  ok("22 · the learner can change the main focus explicitly", sit2.primary === sit2.situations[2], JSON.stringify([sit2.primary, sit2.situations]));
  await p.evaluate(() => { document.querySelector(`#obxSits .obx-row[data-id="${OnboardingV2._state.primary}"]`).click(); });
  const sit3 = await p.evaluate(() => OnboardingV2._state);
  ok("23 · un-choosing the main focus moves it to the first remaining choice (never left dangling)", sit3.situations.length === 3 && sit3.situations.includes(sit3.primary));
  const g1 = await overlaps(p, "#obxSits");
  ok("24 · the long situations list has no overlapping rows and the sticky bar stays inside the screen", g1.n === 0 && !g1.hscroll && await p.evaluate(() => { const r = document.querySelector(".obx-bar").getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top > 0; }), JSON.stringify(g1));
  await next(p);
  /* confidence */
  await click(p, "#obxConf .obx-row >> nth=2"); await next(p);
  /* review */
  const rev = await p.evaluate(() => [...document.querySelectorAll(".obx-sum-row")].map(r => r.querySelector(".k").textContent + "=" + r.querySelector(".v").textContent));
  ok("25 · the review shows what was chosen (native language, profession, goal, situations with the main one starred, confidence)", rev.length === 5 && /Welder/.test(rev[1]) && /★/.test(rev[3]) && /Comfortable/.test(rev[4]), rev.join(" | "));
  await click(p, '.obx-sum-row >> nth=2'); await sleep(400);
  ok("26 · tapping a row goes back to that step (goal) with its choice still selected", await p.evaluate(() => !!document.querySelector("#obxGoals .obx-row.on")));
  await next(p); await next(p); await next(p);   /* goal -> situations -> confidence -> review (NOT a fourth: that would press "start") */
  ok("27 · the review states that this is self-reported", /self-reported/i.test(await p.evaluate(() => document.querySelector(".obx-note")?.textContent || "")));
}

console.log("\n# 3. resumable draft, then finishing");
{
  await s1.p.reload(); await sleep(1800);
  const st = await s1.p.evaluate(() => ({ step: OnboardingV2._state.step, name: OnboardingV2._state.name, prof: OnboardingV2._state.roleId, sits: OnboardingV2._state.situations.length }));
  ok("28 · reloading in the middle resumes at the same step with every answer kept (draft)", st.step === 6 && st.name === "Alex" && st.prof === "trades.welder" && st.sits === 3, JSON.stringify(st));
  await s1.p.click("[data-act=next]"); await sleep(1800);
  const fin = await s1.p.evaluate(() => ({ profile: S.profile, groups: Object.fromEntries(Object.entries(S.lp.g).map(([k, v]) => [k, v.v])), dirty: Object.keys(S.lp.dirty).length, draft: localStorage.getItem("be_obx_draft"), welcome: !!document.getElementById("wcOv"), ob: !!document.getElementById("obWrap") }));
  ok("29 · finishing writes the learner profile groups (role, goal, situations + main focus, confidence, native language)", fin.groups.role.roleId === "trades.welder" && fin.groups.goal.goalId === "phone_video_calls" && fin.groups.situations.situations.length === 3 && fin.groups.situations.primarySituation && fin.groups.confidence.selfLevel === "Comfortable but not confident" && fin.groups.native.nativeLang === "tl", JSON.stringify(fin.groups));
  ok("30 · NOTHING new lives inside S.profile (no situations, no roleOther): one authority; the legacy fields are one-way mirrors", !("situations" in fin.profile) && !("roleOther" in fin.profile) && fin.profile.role === "Other" && /phone|calls/i.test(fin.profile.goal || "") && fin.profile.selfLevel === "Comfortable but not confident", JSON.stringify(fin.profile));
  ok("31 · the draft is cleared, onboarding is gone and the welcome offers the first lesson", fin.draft === null && !fin.ob && fin.welcome);
  await s1.p.evaluate(() => document.querySelector("#wcOv .wc-go").click()); await sleep(900);
  ok("32 · the welcome button enters the first lesson (Week 1 Monday session)", await s1.p.evaluate(() => cur && cur.v === "session"), await s1.p.evaluate(() => JSON.stringify(cur)));
  await s1.p.evaluate(() => { for (const g of ["priorities"]) { } });
  ok("33 · no JavaScript errors through the whole flow", !jsErr(s1.errs).length, jsErr(s1.errs).join(" | "));
  await s1.ctx.close();
}

console.log("\n# 4. keyboard, small screens, accessibility, reduced motion");
{
  const { ctx, p, errs } = await open({ vp: { width: 320, height: 568 } });
  await p.fill("#obxName", "Al"); await next(p); await click(p, "#obxLang"); await sleep(300);
  const sm = await p.evaluate(() => { const c = document.querySelector(".obx-confirm").getBoundingClientRect(), s = document.querySelector(".obx-search input").getBoundingClientRect(); return { confirmInside: c.bottom <= innerHeight + 1 && c.top > 0, inputFont: parseFloat(getComputedStyle(document.querySelector(".obx-search input")).fontSize), rowH: document.querySelector(".obx-row").getBoundingClientRect().height, searchInside: s.bottom < innerHeight }; });
  ok("34 · on a 320×568 phone the Confirm button is on screen, the search font is ≥16px (no iOS zoom) and rows are ≥44px tall", sm.confirmInside && sm.inputFont >= 16 && sm.rowH >= 44 && sm.searchInside, JSON.stringify(sm));
  await p.focus(".obx-search input"); await p.setViewportSize({ width: 320, height: 300 }); await sleep(300);
  const kb = await p.evaluate(() => { const sh = document.querySelector(".obx-sheet").getBoundingClientRect(), c = document.querySelector(".obx-confirm").getBoundingClientRect(), body = document.querySelector(".obx-body"); return { sheetH: Math.round(sh.height), vh: innerHeight, confirmInside: c.bottom <= innerHeight + 1 && c.top >= 0, scrolls: body.scrollHeight > body.clientHeight, bodyH: Math.round(body.clientHeight) }; });
  ok("35 · when the keyboard shrinks the viewport the panel shrinks with it, Confirm stays visible and the list still scrolls", kb.sheetH <= kb.vh + 1 && kb.confirmInside && kb.scrolls && kb.bodyH > 40, JSON.stringify(kb));
  await p.setViewportSize({ width: 320, height: 568 }); await sleep(300);
  await p.keyboard.press("Escape"); await sleep(250);
  ok("36 · Escape closes the panel without choosing", !(await p.evaluate(() => !!document.querySelector(".obx-sheet"))) && (await p.evaluate(() => OnboardingV2._state.nativeLang)) === "");
  await click(p, "#obxLang"); await sleep(300);
  const aria = await p.evaluate(() => { const lb = document.querySelector(".obx-body"), row = document.querySelector(".obx-row"); return { listbox: lb.getAttribute("role"), opt: row.getAttribute("role"), sel: row.getAttribute("aria-selected"), live: !!document.querySelector('.obx-sheet [aria-live="polite"]'), focusHeading: document.activeElement && document.activeElement.tagName === "H2", labelled: !!document.querySelector(".obx-sheet").getAttribute("aria-labelledby"), search: !!document.querySelector(".obx-search input").getAttribute("aria-label") }; });
  ok("37 · accessibility: dialog is labelled, list is a listbox of options with aria-selected, a live region announces counts, focus moves into the panel", aria.listbox === "listbox" && aria.opt === "option" && aria.sel === "false" && aria.live && aria.focusHeading && aria.labelled && aria.search, JSON.stringify(aria));
  ok("38 · no JavaScript errors on the small-screen run", !jsErr(errs).length, jsErr(errs).join("|"));
  await ctx.close();
  const rm = await open({ reduced: true }); await rm.p.fill("#obxName", "Al"); await next(rm.p); await click(rm.p, "#obxLang"); await sleep(300);
  ok("39 · with reduced motion requested the panel does not animate", await rm.p.evaluate(() => getComputedStyle(document.querySelector(".obx-sheet")).animationName === "none"));
  await rm.ctx.close();
}

console.log("\n# 5. Welding stays separate");
{
  const w = await open({ track: "welding", flags: { onboarding_v2_enabled: true } });
  const wi = await w.p.evaluate(() => ({ v2: window.OnboardingV2 ? OnboardingV2.active() : "absent", legacy: !!document.getElementById("obName"), card: !!document.querySelector(".obx-card"), lpOn: typeof lpOn === "function" ? lpOn() : "n/a" }));
  ok("40 · a Welding-pinned app with the flag forced ON still runs the released onboarding (V2 inactive, lp off)", wi.legacy && !wi.card && (wi.v2 === false || wi.v2 === "absent") && wi.lpOn === false, JSON.stringify(wi));
  await w.ctx.close();
  const web = await open({ track: null, flags: { onboarding_v2_enabled: true } });
  const wb = await web.p.evaluate(() => ({ card: !!document.querySelector(".obx-card"), dots: document.querySelectorAll(".ob-dot").length }));
  await web.p.fill("#obxName", "Al"); await next(web.p); await click(web.p, "#obxLang"); await sleep(300); await click(web.p, ".obx-body .obx-row"); await click(web.p, ".obx-confirm"); await sleep(400); await next(web.p);
  const prog = await web.p.evaluate(() => ({ t: document.querySelector("#obxGE") && true, w: !!document.querySelector("#obxWD") }));
  ok("41 · the plain web build (both programmes) offers the programme choice inside V2: 8 dots, General English continues, Welding hands over to the released flow", wb.card && wb.dots === 8 && prog.t && prog.w, JSON.stringify({ wb, prog }));
  await web.p.click("#obxWD"); await sleep(900);
  const hand = await web.p.evaluate(() => ({ v2card: !!document.querySelector(".obx-card"), legacyH1: document.querySelector("#obWrap h1")?.innerText, track: OB.track, lp: !!S.lp }));
  ok("42 · choosing Welding leaves V2 entirely: the released Welding steps continue, and nothing of the learner profile is created", !hand.v2card && hand.track === "welding" && !hand.lp, JSON.stringify(hand));
  await web.ctx.close();
}

console.log("\n# 6. an existing learner: nothing is lost or forced");
let ex;
{
  ex = await open({ state: seedGE({ profile: { name: "Old", role: "Engineering / Data", goal: "🎤 Speak confidently in meetings", slot: "bar", selfLevel: "Can get by", lang: "en", ts: 1 } }) });
  const p = ex.p; const st = await p.evaluate(() => ({ ob: !!document.getElementById("obWrap"), lp: S.lp === undefined, prof: JSON.stringify(S.profile) }));
  ok("43 · an existing learner is not sent through onboarding and nothing is written by opening the app", !st.ob && st.lp, JSON.stringify(st));
  await p.evaluate(() => go("profile")); await sleep(700);
  const rows = await p.evaluate(() => [...document.querySelectorAll("#v-profile .pf-row")].map(r => r.innerText.trim().split("\n")[0]));
  ok("44 · Profile gains 'Learning profile' and 'Tune your practice' rows", rows.includes("Learning profile") && rows.includes("Tune your practice"), rows.join("|"));
  await p.evaluate(() => OnboardingV2.openLearningProfile()); await sleep(500);
  const lpv = await p.evaluate(() => [...document.querySelectorAll("#obxLP .obx-sum-row")].map(r => r.querySelector(".k").textContent + "=" + r.querySelector(".v").textContent));
  ok("45 · the Learning profile shows the OLD answers mapped (profession category/goal/level), 'Not set' for the new ones, and invents nothing", lpv.length === 12 && /Not set/.test(lpv.find(x => /^Daily situations/.test(x))) && /Speak confidently in meetings/.test(lpv.find(x => /^Main goal/.test(x))) && /Can get by/.test(lpv.find(x => /^Speaking confidence/.test(x))), lpv.join(" | "));
  await click(p, '#obxLP [data-field="goal"]'); await sleep(400); await click(p, '.obx-sheet:last-of-type .obx-body .obx-row[data-id="career_growth"]'); await click(p, ".obx-sheet:last-of-type .obx-confirm"); await sleep(600);
  const after = await p.evaluate(() => ({ lp: LearnerProfile.view(S).goalId, legacyGoal: S.profile.goal, other: S.profile.slot }));
  ok("46 · editing the goal writes the learner profile and mirrors the legacy field one way; other legacy fields are untouched", after.lp === "career_growth" && /career/i.test(after.legacyGoal) && after.other === "bar", JSON.stringify(after));
  await p.evaluate(() => document.querySelector(".obx-sheet [data-close]").click());
  await p.evaluate(() => go("data")); await sleep(700);
  const acct = await p.evaluate(() => ({ role: !!document.getElementById("acRole"), goal: !!document.getElementById("acGoal"), level: !!document.getElementById("acLevel"), slot: !!document.getElementById("acSlot"), btn: [...document.querySelectorAll("#v-data button")].some(b => /Learning profile/.test(b.textContent)) }));
  ok("47 · Account settings stops editing role/goal/level (they live in Learning profile) but still edits the time-of-day slot; saving does not crash", !acct.role && !acct.goal && !acct.level && acct.slot && acct.btn);
  await p.evaluate(() => acctSave()); await sleep(400);
  ok("48 · saving Account settings leaves the learner profile alone", (await p.evaluate(() => LearnerProfile.view(S).goalId)) === "career_growth");
}

console.log("\n# 7. Tune your practice");
{
  const p = ex.p;
  /* the learner has finished a lesson, so the offer is due; first on Home it appears, never inside a lesson */
  await p.evaluate(() => { S.dlp = { "general:w1Mon": { lessonId: "general:w1Mon", completedAt: Date.now(), step: "finish", plan: {}, stepData: {} } }; lpSet("role", { roleCat: "tech", roleId: "tech.data_engineer", role: "Engineering / Data" }); localStorage.removeItem("be_tune"); });
  await p.evaluate(() => go("session", 1, "Tue")); await sleep(1400);
  ok("49 · the offer never appears inside a lesson page", !(await p.evaluate(() => !!document.getElementById("obxTune"))));
  await p.evaluate(() => go("home")); await sleep(1800);
  ok("50 · it appears on Home once a lesson is complete", await p.evaluate(() => !!document.getElementById("obxTune")));
  await p.click("#obxTune [data-a=later]"); await sleep(300);
  const sn = await p.evaluate(() => JSON.parse(localStorage.getItem("be_tune")));
  ok("51 · 'Not now' snoozes it (3 days) and it stays away on the next visit to Home", sn.snoozeUntil > Date.now() + 2 * 86400000 && (await (async () => { await p.evaluate(() => { go("journey"); go("home"); }); await sleep(1600); return !(await p.evaluate(() => !!document.getElementById("obxTune"))); })()));
  await p.evaluate(() => { localStorage.removeItem("be_tune"); OnboardingV2.tuneOpen(); }); await sleep(500);
  const t1 = await p.evaluate(() => ({ title: document.querySelector(".obx-sheet h2").textContent, rows: document.querySelectorAll(".obx-body .obx-row").length, search: !!document.querySelector(".obx-search") }));
  ok("52 · the sequence starts with priorities (14 options, no search needed)", /improve/i.test(t1.title) && t1.rows === 14 && !t1.search, JSON.stringify(t1));
  for (const i of [3, 0, 5]) await p.click(`.obx-body .obx-row >> nth=${i}`);
  await p.click(".obx-body .obx-row >> nth=7");
  const ranks = await p.evaluate(() => { const rows = [...document.querySelectorAll(".obx-body .obx-row")]; return { byPick: [rows[3], rows[0], rows[5]].map(r => r.querySelector(".obx-mark").textContent), on: rows.filter(r => r.classList.contains("on")).length }; });
  ok("53 · rank 1 goes to the FIRST CHOSEN (not the first listed), and a fourth pick is refused", ranks.byPick.join() === "1,2,3" && ranks.on === 3, JSON.stringify(ranks));
  await p.click(".obx-confirm"); await sleep(600);
  ok("54 · confirming saves them and moves on to vocabulary goals", (await p.evaluate(() => LearnerProfile.view(S).priorities.length)) === 3 && /words/i.test(await p.evaluate(() => document.querySelector(".obx-sheet h2")?.textContent || "")));
  await p.click(".obx-body .obx-row >> nth=1"); await p.click(".obx-confirm"); await sleep(600);
  await p.click(".obx-body .obx-row >> nth=0"); await p.click(".obx-body .obx-row >> nth=2"); await p.click(".obx-confirm"); await sleep(600);
  ok("55 · then practice methods (max 3) and the three schedule questions, one per screen", /minutes/i.test(await p.evaluate(() => document.querySelector(".obx-sheet h2")?.textContent || "")));
  await p.click(".obx-body .obx-row >> nth=4"); await p.click(".obx-confirm"); await sleep(600);
  ok("56 · the schedule asks days next", /days/i.test(await p.evaluate(() => document.querySelector(".obx-sheet h2")?.textContent || "")));
  /* leave mid-way: Back closes the whole sequence; nothing already saved is lost */
  await p.click(".obx-x"); await sleep(400);
  const mid = await p.evaluate(() => ({ sheet: !!document.querySelector(".obx-sheet"), v: LearnerProfile.view(S), left: OnboardingCatalog.tuneRemaining(OnboardingV2.resolved()) }));
  ok("57 · leaving part-way keeps what was saved and remembers what is left (derived, no extra state)", !mid.sheet && mid.v.dailyMinutes === "m25" && mid.v.priorities.length === 3 && mid.left.join() === "schedule", JSON.stringify({ m: mid.v.dailyMinutes, left: mid.left }));
  await p.evaluate(() => OnboardingV2.tuneOpen()); await sleep(500);
  ok("58 · reopening resumes at the first unfinished question (days), not from the start", /days/i.test(await p.evaluate(() => document.querySelector(".obx-sheet h2")?.textContent || "")));
  await p.click(".obx-body .obx-row >> nth=3"); await p.click(".obx-confirm"); await sleep(600); await p.click(".obx-body .obx-row >> nth=1"); await p.click(".obx-confirm"); await sleep(700);
  const done = await p.evaluate(() => ({ v: LearnerProfile.view(S), left: OnboardingCatalog.tuneRemaining(OnboardingV2.resolved()), sheet: !!document.querySelector(".obx-sheet") }));
  ok("59 · finishing saves the schedule (minutes, days, time of day) and everything is set", done.v.practiceDays === "d6" && done.v.timeOfDay === "lunch" && done.left.length === 0 && !done.sheet, JSON.stringify(done.v));
  ok("60 · no JavaScript errors in the existing-learner run", !jsErr(ex.errs).length, jsErr(ex.errs).join(" | "));
  await ex.ctx.close();
}

console.log("\n# 8. the lesson plan reads the profile (and only what it actually reads)");
async function lessonFor(groups) {
  const { ctx, p, errs } = await open({ flags: { onboarding_v2_enabled: true, daily_learning_plan_pilot_enabled: true }, state: seedGE() });
  await p.evaluate(g => { for (const [k, v] of Object.entries(g)) lpSet(k, v); }, groups);
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(900);
  const out = await p.evaluate(() => { const e = S.dlp && S.dlp["general:w1Mon"]; return e ? { scenario: e.plan.personalizedScenario, expr: e.plan.targetExpressions, pf: e.plan.pronunciationFocus, ctx: e.plan.learnerContext, speaking: e.plan.speakingTask, tryHasScenario: /Today's situation/.test(document.getElementById("dlpBody") ? document.getElementById("dlpBody").innerText : ""), note: dlpDeclaredNote(e.plan), objective: e.plan.competencyObjective } : null; });
  await ctx.close(); return { out, errs };
}
{
  const A = await lessonFor({ role: { roleCat: "tech", roleId: "tech.data_engineer", role: "Engineering / Data" }, situations: { situations: ["meetings", "calls"], primarySituation: "calls" }, confidence: { selfLevel: "Comfortable but not confident" }, priorities: { priorities: ["pronunciation", "fluency"] }, vocab: { vocabGoals: ["meeting_phrases"] }, schedule: { dailyMinutes: "m10", practiceDays: "d5", timeOfDay: "morning" } });
  const Bp = await lessonFor({ role: { roleCat: "sales", roleId: "sales.customer_support", role: "Sales / Marketing" }, situations: { situations: ["customer_service", "everyday"], primarySituation: "everyday" }, confidence: { selfLevel: "Can get by" }, priorities: { priorities: ["clarity_structure"] }, schedule: { dailyMinutes: "m30", practiceDays: "d6", timeOfDay: "evening" } });
  const Cp = await lessonFor({ role: { roleCat: "mgmt", roleId: "biz.project_manager", role: "Product / PM" }, situations: { situations: ["presentations"] }, confidence: { selfLevel: "Fluent, want to sound sharper" }, priorities: { priorities: ["intonation", "word_stress_rhythm", "professional_tone"] } });
  const none = await lessonFor({});
  ok("61 · the objective is IDENTICAL for every learner (the 12-week curriculum is untouched)", [A, Bp, Cp, none].every(x => x.out && x.out.objective === "Pronunciation baseline"));
  ok("62 · the scenario follows the MAIN situation, not just the first listed: A (main = calls) gets the call frame", /phone or video call/.test(A.out.scenario.task) && A.out.scenario.personalized, A.out.scenario.task);
  ok("63 · and the other learners get their own: customer-service/everyday, presentation; none gets the plain curriculum task", /someone you're meeting/.test(Bp.out.scenario.task) && /present to a group/.test(Cp.out.scenario.task) && !none.out.scenario.personalized);
  ok("64 · the situation is SHOWN to the learner in the TRY step, only when their own answers chose it", A.out.tryHasScenario && Bp.out.tryHasScenario && !none.out.tryHasScenario);
  ok("65 · the number of expressions follows the minutes they have: 10 min → 3, 30 min → 5, unset → 5 (the 3-5 principle)", A.out.expr.length === 3 && Bp.out.expr.length === 5 && none.out.expr.length === 5, [A, Bp, none].map(x => x.out.expr.length).join());
  ok("66 · they are chosen from the whole week's phrase pool, still in the curriculum's own words", A.out.expr.every(x => /…$/.test(x) || x.length > 3) && new Set(A.out.expr).size === 3);
  ok("67 · task length follows declared confidence (as before): B1 learner 15-60 s, A2 learner 14-50 s", A.out.speaking.maxSeconds === 60 && Bp.out.speaking.maxSeconds === 50);
  ok("68 · declared pronunciation priorities are recorded as DECLARED, only the pronunciation ones, at most 3 (fluency/clarity are not pronunciation)", JSON.stringify(A.out.pf.declared) === '["pronunciation"]' && Bp.out.pf.declared.length === 0 && JSON.stringify(Cp.out.pf.declared) === '["intonation","word_stress_rhythm"]');
  ok("69 · the IMPROVE step says they are the learner's own choice and that the correction comes from their recording", /You asked to work on/.test(A.out.note) && /only from your own recording/.test(A.out.note) && Bp.out.note === "");
  ok("70 · the plan's context carries the declared fields separately from assessment (proficiency is untouched by confidence)", A.out.ctx.priorities.length === 2 && A.out.ctx.dailyMinutes === "m10" && A.out.ctx.proficiency.confidence === "low" && A.out.ctx.proficiency.basis === "self-declared only, not yet evidenced");
  ok("71 · no JavaScript errors in the lesson runs", ![A, Bp, Cp, none].some(x => jsErr(x.errs).length));
}

await b.close(); if (server) server.kill();
const fails = res.filter(x => !x).length; console.log(`\n${res.length - fails}/${res.length} passed`); process.exit(fails ? 1 : 0);
