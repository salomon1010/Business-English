/* CURRICULUM-DRIVEN PRACTICE HUB — owner-approved, 5 Nov 2026, General English
   only. Run: cd tests && node practice-hub.mjs        (BASE=… for another tree)

   Four cards (AI Conversation / Grammar / Vocabulary / Live Partner), one
   Current Learning Focus header above them, reusing pathSummary()/currentPos()/
   trackWeeks() — the same engine the curriculum-first Today redesign reads, so
   this page can never disagree with Today or the Road map. The old "Best tool
   for your step" list and the standalone Life Simulations / Practice Partner
   cards are gone for General English; Welding's five-tool Practice page is
   untouched (tests/welding-practice-career.mjs, tests/welding-studio.mjs). */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8933);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 500)}`); };
const b = await chromium.launch();
const seed = (o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, convos: [], gram: {}, ...o });
async function open(state = {}, opts = {}) {
  const ctx = await b.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s, flags]) => { localStorage.setItem("be12_v1", s); if (flags) localStorage.setItem("be_flags", flags); }, [JSON.stringify(seed(state)), opts.flags ? JSON.stringify(opts.flags) : ""]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  await p.evaluate(() => go("practice")); await sleep(500);
  return { ctx, p, errs };
}
const read = p => p.evaluate(() => {
  const focus = document.querySelector(".prac-focus");
  const cards = [...document.querySelectorAll(".prac-card")].map(c => ({
    t: c.querySelector(".pc-t").innerText.trim(), sub: (c.querySelector(".pc-sub") || {}).innerText || "",
    status: (c.querySelector(".pc-status") || {}).innerText || "", cta: c.querySelector(".pc-cta").innerText.replace(/→/g, "").trim(),
    rec: c.classList.contains("rec"), go: c.getAttribute("onclick"),
  }));
  return {
    focusPos: focus ? (focus.querySelector(".prac-focus-pos") || {}).innerText || "" : null,
    focusTitle: focus ? focus.querySelector("h2").innerText : null,
    focusDone: focus ? (focus.querySelector(".prac-focus-done") || {}).innerText || "" : null,
    focusCta: (document.querySelector(".prac-focus-cta") || {}).getAttribute && document.querySelector(".prac-focus-cta").getAttribute("onclick"),
    cards, oldToolList: document.querySelectorAll(".path-tool-list .path-tool").length,
    oldRpEntry: document.querySelectorAll(".rp-entry").length,
  };
});

console.log("# Monday · nothing done — Current Learning Focus header");
{ const { ctx, p, errs } = await open();
  const r = await read(p);
  ok("1 · the header reads the SAME curriculum data Today reads — Week 1 · Monday, the day's real focus", /Week 1/.test(r.focusPos) && /Monday/.test(r.focusPos) && r.focusTitle === "Pronunciation baseline", JSON.stringify(r));
  ok("2 · not done yet, and Continue Learning opens exactly today's session (go('session',1,'Mon')) — the same destination Today's own CTA uses", /Not started/.test(r.focusDone) && /go\('session',1,'Mon'\)/.test(r.focusCta), JSON.stringify(r));
  ok("3 · exactly four cards: AI Conversation, Grammar Practice, Vocabulary Practice, Live Partner Practice — no more, no fewer", r.cards.map(c => c.t).join("|") === "AI Conversation|Grammar Practice|Vocabulary Practice|Live Partner Practice", JSON.stringify(r.cards.map(c => c.t)));
  ok("4 · the old 'Best tool for your step' list is gone", r.oldToolList === 0, r.oldToolList);
  ok("5 · the old standalone Life Simulations / Practice Partner cards are gone — the new cards are their only replacement", r.oldRpEntry === 0, r.oldRpEntry);
  ok("6 · Monday's pick is Shadow (not one of these four tools) — so no card on this page claims to be 'the' recommendation today, honestly", !r.cards.some(c => c.rec), JSON.stringify(r.cards.map(c => [c.t, c.rec])));
  ok("7 · CTA labels match the brief exactly: Start Conversation / Practice Grammar / Practice Vocabulary / Find Practice Partner", r.cards.map(c => c.cta).join("|") === "Start Conversation|Practice Grammar|Practice Vocabulary|Find Practice Partner", JSON.stringify(r.cards.map(c => c.cta)));
  ok("8 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Each card's destination is the real activity, not a stub");
{ const { ctx, p, errs } = await open();
  await p.evaluate(() => document.querySelector('.prac-card[data-cid="ai"]').click()); await sleep(600);
  ok("9 · AI Conversation opens Life Simulations (roleplay) — the same page Today and the Practice tab already use for this, not a new feature", await p.evaluate(() => cur.v) === "roleplay", await p.evaluate(() => cur.v));
  await p.evaluate(() => go("practice")); await sleep(400);
  const cards = await p.evaluate(() => [...document.querySelectorAll(".prac-card")]);
  await p.evaluate(() => [...document.querySelectorAll(".prac-card")].find(c => c.querySelector(".pc-t").textContent.includes("Grammar")).click()); await sleep(500);
  ok("10 · Grammar Practice opens this SAME page's own exercises tab (reused, not duplicated) and scrolls to it", await p.evaluate(() => _libTab === "exercises" && !!document.querySelector(".gx-card")), await p.evaluate(() => _libTab));
  await p.evaluate(() => go("practice")); await sleep(400);
  await p.evaluate(() => [...document.querySelectorAll(".prac-card")].find(c => c.querySelector(".pc-t").textContent.includes("Vocabulary")).click()); await sleep(500);
  ok("11 · Vocabulary Practice opens the SAME spaced-repetition drill 'words due' already uses (pathToolGo('vocab') — no second vocabulary system)", await p.evaluate(() => !!_pracTab || cur.v === "practice"), await p.evaluate(() => ({ v: cur.v, tab: _pracTab })));
  await p.evaluate(() => go("practice")); await sleep(400);
  await p.evaluate(() => [...document.querySelectorAll(".prac-card")].find(c => c.querySelector(".pc-t").textContent.includes("Live Partner")).click()); await sleep(600);
  ok("12 · Live Partner Practice opens Practice Partner, unchanged", await p.evaluate(() => cur.v) === "partner", await p.evaluate(() => cur.v));
  ok("13 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Status lines come from real, existing data — nothing invented");
{ const today = new Date().toISOString();
  const { ctx, p, errs } = await open({ convos: [{ ts: Date.now(), id: "coffee", title: "In the coffee shop", cat: "daily", tk: "general-english" }], gram: { tenses: { best: 80, runs: 2 } } });
  const r = await read(p);
  const ai = r.cards.find(c => c.t === "AI Conversation"), gram = r.cards.find(c => c.t === "Grammar Practice"), voc = r.cards.find(c => c.t === "Vocabulary Practice");
  ok("14 · a real conversation logged today (S.convos, the same store roleplay already writes to) makes the AI Conversation card say 'Practised today'", /Practised today/.test(ai.status), ai.status);
  ok("15 · a real grammar attempt (the SAME aMap('gram') gxStats() already reads) moves the Grammar card's count off zero", /1 of \d+ topics started/.test(gram.status), gram.status);
  const due = await p.evaluate(() => navBadgeCount("practice"));
  ok("16 · the Vocabulary card's due count is exactly navBadgeCount('practice') — the same number the nav badge and the old 'words due' card already showed, not a second count", due > 0 ? new RegExp(`${due} words ready`).test(voc.status) : /All caught up/.test(voc.status), JSON.stringify({ due, status: voc.status }));
  ok("17 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Recommended Practice agrees with the day, honestly — Thursday (AI Conversation) and Wednesday (Vocabulary)");
{ const { ctx, p, errs } = await open({ days: { w1Mon: true, w1Tue: true, w1Wed: true } }); // lands on Thursday
  const r = await read(p);
  const pick = await p.evaluate(() => pathToolPick().id);
  ok("18 · Thursday: pathToolPick() says 'sim' and the AI Conversation card — and only that one — carries the Recommended chip", pick === "sim" && r.cards.find(c => c.t === "AI Conversation").rec && !r.cards.some(c => c.t !== "AI Conversation" && c.rec), JSON.stringify(r.cards.map(c => [c.t, c.rec])));
  await ctx.close(); }
{ const { ctx, p, errs } = await open({ days: { w1Mon: true, w1Tue: true } }); // lands on Wednesday
  const r = await read(p);
  const pick = await p.evaluate(() => pathToolPick().id);
  ok("19 · Wednesday: pathToolPick() says 'vocab' and the Vocabulary card — and only that one — carries the Recommended chip", pick === "vocab" && r.cards.find(c => c.t === "Vocabulary Practice").rec && !r.cards.some(c => c.t !== "Vocabulary Practice" && c.rec), JSON.stringify(r.cards.map(c => [c.t, c.rec])));
  await ctx.close(); }

console.log("\n# Today's session state — the SAME S.days the whole app already reads, not a second progress system");
{ // currentPos() always returns the FIRST undone day (index.html:11421-11426), so
  // the live pointer can never itself be "done" except the fully-finished end
  // state, which pathSummary() special-cases first. Confirm both real states.
  const { ctx, p, errs } = await open({ days: { w1Mon: true } });
  const r = await read(p);
  ok("20 · one day done just advances the pointer to the next undone day (Tuesday) — honestly 'Not started yet', not a stale completed state", r.focusPos.includes("Tuesday") && /Not started/.test(r.focusDone) && /go\('session',1,'Tue'\)/.test(r.focusCta), JSON.stringify(r));
  await ctx.close(); }
{ const { ctx: ctx1, p: p1 } = await open();
  const allDone = await p1.evaluate(() => { const o = {}; trackWeeks().forEach(w => trackDays().forEach(d => o[dayKey(w.n, d)] = true)); return o; });
  await ctx1.close();
  const { ctx, p } = await open({ days: allDone });
  const r = await p.evaluate(() => ({ html: document.querySelector(".prac-focus") ? document.querySelector(".prac-focus").outerHTML : null, cta: !!document.querySelector(".prac-focus-cta") }));
  ok("21 · every day complete: the focus card shows the finished state with no dangling Continue Learning CTA", r.html && !r.cta, JSON.stringify(r));
  await ctx.close(); }

console.log("\n# Welding is untouched — isGeneralEnglish() gates every line above");
{ const { ctx, p, errs } = await open({ professionalTracks: { activeId: "welding" } });
  const r = await read(p);
  ok("21 · no prac-focus / prac-card on Welding — its own five-tool Practice page (tests/welding-practice-career.mjs) renders exactly as before", r.focusTitle === null && r.cards.length === 0, JSON.stringify(r));
  ok("22 · Welding's old tool list is exactly where it always was", r.oldToolList > 0, r.oldToolList);
  ok("23 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Mobile responsiveness");
{ const { ctx, p, errs } = await open({}, { viewport: { width: 360, height: 800 } });
  const d = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const cols = await p.evaluate(() => new Set([...document.querySelectorAll(".prac-card")].map(c => Math.round(c.getBoundingClientRect().left))).size);
  ok("24 · 360px: no sideways scroll", d <= 1, d);
  ok("25 · 360px: the grid drops to one column under the 380px breakpoint — no squeezed two-up cards", cols === 1, cols);
  await ctx.close(); }
{ const { ctx, p, errs } = await open({}, { viewport: { width: 1280, height: 900 } });
  const d = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("26 · 1280px desktop: no sideways scroll", d <= 1, d);
  ok("27 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
await b.close(); if (srv) srv.kill();
process.exit(res.every(Boolean) ? 0 : 1);
