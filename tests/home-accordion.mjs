/* The Home recommendations accordion — the OPERATION of it, where
   tests/home-rows.mjs covers the rows' content and the one-open-at-a-time rule.
   Run: cd tests && PORT=<free> node home-accordion.mjs

   What only this file proves: real keyboard operation (focus, Enter, Space —
   not a synthetic .click()), that a collapsed group's cards cannot be focused,
   hit or reached by Tab, what Chromium's own accessibility tree exposes, a
   genuine page reload returning to the strongest signal, the Premium-locked
   rendering, and Welding with and without its studio. */
import { chromium, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises"; import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 9477), BASE = `http://127.0.0.1:${PORT}`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
const cat = JSON.parse(fs.readFileSync(root + "catalogue/general.json", "utf8"));
const V = { W: "S0kfnpgY-Gs", SH: "-5q6tNovay8", CF: "mmfo9spNaWA" }; const T = k => cat.videos[V[k]].title;
const seed = ([V, T, FLAGS, area]) => { localStorage.setItem("be_flags", JSON.stringify(FLAGS)); localStorage.setItem("be_theme", "dark");
  const GE = "general-english", day = 86400000, H = 3600000, now = Date.now(), d = n => new Date(now - n * day).toISOString().slice(0, 10);
  const dates = [0,1,2,3].map(d), dayLog = {}; dates.forEach(x => dayLog[x] = 1);
  const S = { profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: area || GE },
    fnd: { [GE]: { placed: "full", finished: true, done: {}, day: 1 }, welding: { placed: "full", finished: true, done: {}, day: 1 } },
    days: {}, dates, dayLog, dayLogA: { [GE]: dayLog, welding: dayLog }, steps: {}, scores: {}, notes: {}, vocab: {}, convos: [], backupAsked: 1, rmSeen: now, lastSeen: now };
  ["leverage","milestone","deliverable"].forEach((w,i)=>S.vocab[w]={ts:now-i*H,reps:1,due:now-day,tk:[GE]});
  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(x=>S.days["w1"+x]=true);
  const dims={words:"fair",pron:"fair",fluency:"good",timing:"na",rhythm:"na"},ch=ts=>({kind:"challenge",ts,vid:V.CF,title:T.CF,seg:"s1",text:"x",n:1,level:2,rung:"gate",verdict:"retry",coverage:.5,ok:5,total:10,pass:false,heard:"x",issues:[{type:"mispron",text:"schedule"}],dims,pronMode:null,ctx:null,drills:[]});
  S.chHistA={[GE]:[{kind:"shadow",ts:now-H,vid:V.SH,title:T.SH,text:"x",heard:"x",score:71,wpm:120,fillers:1,fix:["thorough","status"],ctx:null},ch(now-day),ch(now-day-H)]};
  S.watchedA={[GE]:[{vid:V.W,title:T.W,ts:now-2*H,secs:240}]};
  S.troubleA={[GE]:{thorough:3,schedule:2}};
  S.convos=[{ts:now-day,id:"standup",title:"Daily stand-up",cat:"work",tk:GE,covered:2,total:3,turns:3,lines:[]}];
  S.notes["exrep:w1Fri"]={at:now-3*H,tk:GE,key:"w1Fri",m:{fillerN:3,hedgeN:2,wpm:130},ai:null,tx:"x",targets:[]};
  localStorage.setItem("be12_v1", JSON.stringify(S)); };
const FLAGS = { billing_enabled: false, home_v2_enabled: true, welding_studio_enabled: false, shadow_studio_v2_enabled: true, shadow_challenge_enabled: true, shadow_word_timing_enabled: true, shadow_library_enabled: true };
const b = await chromium.launch();
const open = async (flags = FLAGS, area, desktop) => {
  const ctx = await b.newContext(desktop ? { viewport: { width: 1280, height: 900 }, serviceWorkers: "block", colorScheme: "dark" } : { ...devices["iPhone 13"], serviceWorkers: "block", colorScheme: "dark" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail|gstatic/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.route(u => /i\.ytimg\.com|yt3\.googleusercontent\.com/.test(u.href), r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
  await ctx.addInitScript(seed, [V, { W: T("W"), SH: T("SH"), CF: T("CF") }, flags, area]);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => { if (e.message !== "A network error occurred.") p.errs.push(e.message); });
  await p.goto(BASE + "/index.html#home"); await sleep(2600);
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#syncNudge").forEach(e => e.remove()); go("home"); }); await sleep(2000);
  return { ctx, p };
};
const state = p => p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => ({ id: r.dataset.row, open: r.classList.contains("open"),
  exp: (r.querySelector(".hx-row-tog") || {}).getAttribute ? r.querySelector(".hx-row-tog").getAttribute("aria-expanded") : null })));
const openIds = s => s.filter(x => x.open).map(x => x.id);

console.log("\n# initial load, and only the strongest signal");
{ const { ctx, p } = await open();
  const s = await state(p);
  ok("R1 · exactly one group open on load, and it is the first", openIds(s).length === 1 && s[0].open && s[0].exp === "true", JSON.stringify(s));
  ok("R2 · the first group is the one carrying the gold 'YOUR STRONGEST SIGNAL' label",
    await p.evaluate(() => { const r = document.querySelectorAll(".hx-row")[0]; return r.classList.contains("hx-row-lead") && /strongest signal|Start here/i.test(r.querySelector(".hx-row-kick").textContent) && r.classList.contains("open"); }));
  ok("R3 · its heading, its reason AND its cards are all on screen",
    await p.evaluate(() => { const r = document.querySelectorAll(".hx-row")[0];
      return r.querySelector(".hx-row-h h3").getBoundingClientRect().height > 0 && r.querySelector(".hx-row-h p").getBoundingClientRect().height > 0
        && [...r.querySelectorAll(".hx-rcard")].filter(c => c.getBoundingClientRect().height > 0).length >= 2; }));

  /* THE REVIEW'S OWN QUESTION: a collapsed group's cards must be unreachable */
  const reach = await p.evaluate(() => {
    const closed = [...document.querySelectorAll(".hx-row:not(.open)")];
    const cards = closed.flatMap(r => [...r.querySelectorAll(".hx-rcard,.hx-row-prem")]);
    let focusable = 0, hit = 0;
    for (const c of cards) { c.focus(); if (document.activeElement === c) focusable++;
      const b = c.getBoundingClientRect(); if (b.width || b.height) hit++; }
    /* and the real tab order: walk every focusable thing on the page */
    const all = [...document.querySelectorAll("button,a[href],input,select,textarea,[tabindex]")].filter(e => !e.disabled);
    const inClosed = all.filter(e => closed.some(r => { const p = r.querySelector(".hx-row-p"); return p && p.contains(e); }));
    return { cards: cards.length, focusable, hit, inClosedTabbable: inClosed.filter(e => e.offsetParent !== null).length, closedRows: closed.length };
  });
  ok("R4 · a collapsed group's cards cannot take focus", reach.cards >= 3 && reach.focusable === 0, JSON.stringify(reach));
  ok("R5 · …they have no box either, so they cannot be tapped or hit-tested", reach.hit === 0, JSON.stringify(reach));
  ok("R6 · …and nothing inside a collapsed panel is in the tab order", reach.inClosedTabbable === 0, JSON.stringify(reach));

  /* real keyboard, not a synthetic click */
  const kb = await p.evaluate(() => { const t = document.querySelectorAll(".hx-row")[1].querySelector(".hx-row-tog"); t.focus(); return document.activeElement === t; });
  ok("R7 · the second group's control takes keyboard focus", kb);
  await p.keyboard.press("Enter"); await sleep(350);
  let s2 = await state(p);
  ok("R8 · Enter opens it, and that closes the first", openIds(s2).length === 1 && s2[1].open && !s2[0].open && s2[0].exp === "false", JSON.stringify(openIds(s2)));
  await p.evaluate(() => document.querySelectorAll(".hx-row")[2].querySelector(".hx-row-tog").focus());
  await p.keyboard.press("Space"); await sleep(350);
  let s3 = await state(p);
  ok("R9 · Space on the third opens it, and that closes the second", openIds(s3).length === 1 && s3[2].open && !s3[1].open, JSON.stringify(openIds(s3)));
  await p.keyboard.press("Space"); await sleep(350);
  const s4 = await state(p);
  ok("R10 · Space again closes it and leaves EVERY group collapsed — none reopens", openIds(s4).length === 0 && s4.every(x => x.exp === "false"), JSON.stringify(openIds(s4)));
  ok("R11 · …and the headings are all still readable", await p.evaluate(() => [...document.querySelectorAll(".hx-row")].every(r => r.querySelector(".hx-row-h h3").getBoundingClientRect().height > 0)));

  /* WHAT A SCREEN READER ACTUALLY GETS — Chromium's own accessibility tree,
     not the attributes we wrote. Short of a person with TalkBack, this is the
     real evidence: the control is a button, it is named by its heading, it
     says whether it is expanded, and a collapsed group's cards are not in the
     tree at all. */
  await p.evaluate(() => document.querySelectorAll(".hx-row")[0].querySelector(".hx-row-tog").click()); await sleep(350);
  const ax = await p.accessibility.snapshot({ interestingOnly: false });
  const flat = (n, out = []) => { out.push(n); (n.children || []).forEach(c => flat(c, out)); return out; };
  const nodes = flat(ax);
  const headings = await p.evaluate(() => [...document.querySelectorAll(".hx-row .hx-row-h h3")].map(h => h.textContent.trim()));
  const togs = nodes.filter(n => n.role === "button" && headings.some(h => h && (n.name || "").includes(h)));
  /* Playwright leaves `expanded` off a node that is NOT expanded, so the tree
     can only confirm the open one; the closed ones are confirmed in the DOM. */
  const closedAria = await p.evaluate(() => [...document.querySelectorAll(".hx-row:not(.open) .hx-row-tog")].every(b => b.getAttribute("aria-expanded") === "false"));
  ok("R11b · every control is exposed as a BUTTON named by its own heading; exactly one reports itself expanded",
    togs.length === headings.length && togs.filter(t => t.expanded === true).length === 1 && closedAria,
    JSON.stringify({ headings: headings.length, buttons: togs.length, expanded: togs.map(t => t.expanded), closedAria }));
  /* A collapsed card must not be in the tree. Compare by the card's own
     accessible name, and ignore any title an OPEN card happens to share (the
     same clip is recommended by more than one row) and the row headings, which
     legitimately quote the clip they are about ("Because you practised
     'Daily stand-up' with Priya"). */
  const names = await p.evaluate(() => { const nm = c => [c.querySelector("small"), c.querySelector("b")].filter(Boolean).map(e => e.textContent.trim()).join(" ");
    return { open: [...document.querySelectorAll(".hx-row.open .hx-rcard")].map(nm), closed: [...document.querySelectorAll(".hx-row:not(.open) .hx-rcard")].map(nm) }; });
  const togNames = new Set(togs.map(t => t.name));
  const treeButtons = nodes.filter(n => n.role === "button" && !togNames.has(n.name)).map(n => n.name || "");
  const onlyClosed = [...new Set(names.closed)].filter(x => x && !names.open.includes(x));
  const leaked = onlyClosed.filter(x => treeButtons.some(b => b.includes(x)));
  ok("R11c · no card that exists ONLY in a collapsed group is anywhere in the accessibility tree",
    onlyClosed.length >= 5 && leaked.length === 0, JSON.stringify({ closedOnly: onlyClosed.length, leaked }));
  ok("R11d · the open group's cards ARE in the tree, as buttons",
    names.open.length >= 2 && names.open.every(x => treeButtons.some(b => b.includes(x))),
    JSON.stringify({ open: names.open.length, found: names.open.filter(x => treeButtons.some(b => b.includes(x))).length }));

  /* navigation away and back keeps the learner's choice; a RELOAD does not */
  await p.evaluate(() => document.querySelectorAll(".hx-row")[3].querySelector(".hx-row-tog").click()); await sleep(300);
  const chose = (await state(p)).find(x => x.open).id;
  await p.evaluate(() => go("profile")); await sleep(800);
  await p.evaluate(() => go("home")); await sleep(1500);
  const back = await state(p);
  ok("R12 · navigating away and back keeps the group the learner chose", openIds(back).join() === chose, JSON.stringify({ chose, back: openIds(back) }));
  await p.reload(); await sleep(2600);
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#syncNudge").forEach(e => e.remove()); go("home"); }); await sleep(1800);
  const rel = await state(p);
  ok("R13 · a page RELOAD goes back to the strongest signal", openIds(rel).length === 1 && rel[0].open, JSON.stringify({ chose, after: openIds(rel) }));

  /* data refresh: the engine re-runs and the page is re-drawn */
  await p.evaluate(() => { const el = document.getElementById("v-home"); _homeRows = homeRows(""); rHomeV2(el); }); await sleep(900);
  const rf = await state(p);
  ok("R14 · a recommendation refresh leaves exactly one group open, never two", openIds(rf).length === 1, JSON.stringify(openIds(rf)));
  ok("R15 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }

console.log("\n# Premium-locked rows, and Welding");
{ const { ctx, p } = await open({ ...FLAGS, billing_enabled: true });
  const lk = await p.evaluate(() => ({ locked: entLocked("recommended_content"),
    rows: document.querySelectorAll(".hx-row").length,
    bars: document.querySelectorAll(".hx-row-prem").length,
    cards: document.querySelectorAll(".hx-rcard").length,
    openBars: [...document.querySelectorAll(".hx-row-prem")].filter(e => e.getBoundingClientRect().height > 0).length,
    firstOpen: (document.querySelectorAll(".hx-row")[0] || {}).classList ? document.querySelectorAll(".hx-row")[0].classList.contains("open") : null,
    tabbable: [...document.querySelectorAll(".hx-row:not(.open) .hx-row-prem")].filter(e => e.offsetParent !== null).length }));
  ok("R16 · Premium gating is untouched: locked rows still show the offer bar and NO cards", lk.locked && lk.rows >= 2 && lk.bars === lk.rows && lk.cards === 0, JSON.stringify(lk));
  ok("R17 · …only the first group's bar is on screen; the rest are collapsed and out of the tab order", lk.firstOpen && lk.openBars === 1 && lk.tabbable === 0, JSON.stringify(lk));
  ok("R18 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
{ const { ctx, p } = await open(FLAGS, "welding");
  const w = await p.evaluate(() => ({ rows: document.querySelectorAll(".hx-row").length,
    txt: /Because you|Start here/.test(document.getElementById("v-home").textContent),
    tog: document.querySelectorAll(".hx-row-tog").length }));
  ok("R19 · Welding (studio off) still has no rows at all — the accordion leaked nothing into it", w.rows === 0 && !w.txt && w.tog === 0, JSON.stringify(w));
  ok("R20 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
{ const { ctx, p } = await open({ ...FLAGS, welding_studio_enabled: true }, "welding");
  const w = await p.evaluate(() => ({ rows: [...document.querySelectorAll(".hx-row")].map(r => r.dataset.row),
    open: [...document.querySelectorAll(".hx-row.open")].map(r => r.dataset.row),
    ge: /Practice Partner|partner/i.test([...document.querySelectorAll(".hx-row .hx-rbody small")].map(e => e.textContent).join(" ")) }));
  ok("R21 · Welding WITH the studio: rows exist, exactly one open, and no Practice Partner row",
    w.rows.length >= 1 && w.open.length === 1 && w.open[0] === w.rows[0] && !w.rows.includes("partner") && !w.ge, JSON.stringify(w));
  ok("R22 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }

console.log("\n# desktop");
{ const { ctx, p } = await open(FLAGS, null, true);
  const d = await state(p);
  ok("R23 · desktop: one open, the first", openIds(d).length === 1 && d[0].open, JSON.stringify(openIds(d)));
  ok("R24 · desktop: no sideways page scroll", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok("R25 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }

console.log(`\n${res.filter(Boolean).length}/${res.length} passed   (${BASE})`);
await b.close(); srv.kill();
process.exit(res.every(Boolean) ? 0 : 1);
