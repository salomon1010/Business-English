import { chromium, devices } from "playwright"; import { setTimeout as sleep } from "node:timers/promises"; import fs from "node:fs";
const BASE = "http://127.0.0.1:8148", OUT = process.env.OUT;
const cat = JSON.parse(fs.readFileSync("../catalogue/general.json", "utf8")); const cats = {}; cat.categories.forEach(c => c.vids.forEach(v => cats[v] = cats[v] || c.id));
const pick = (re, id) => Object.keys(cat.videos).find(v => cats[v] === id && re.test(cat.videos[v].title) && cat.videos[v].cap === "human");
const chVid = pick(/meeting/i, "meetings"), shVid = pick(/pronunc|accent|sound/i, "skills");
console.log("seeds:", chVid, cat.videos[chVid].title, "|", shVid, cat.videos[shVid].title);
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail|gstatic/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
await ctx.addInitScript(([chVid, chT, shVid, shT]) => { if (sessionStorage.getItem("s")) return; sessionStorage.setItem("s", 1); localStorage.setItem("be_flags", JSON.stringify({ home_v2_enabled: true })); localStorage.setItem("be_theme", "dark");
  const day = 86400000, now = Date.now(), d = n => new Date(now - n * day).toISOString().slice(0, 10); const dates = [0, 1, 2, 3, 5, 6].map(d); const dayLog = {}; dates.forEach(x => dayLog[x] = 1);
  const vocab = {}; ["stakeholder", "leverage", "deliverable", "milestone"].forEach((w, i) => vocab[w] = { ts: now - i * day, reps: 1, due: now - day, tk: ["general-english"] });
  const days = { w1Mon: true, w1Tue: true, w1Wed: true, w1Thu: true, w1Fri: true, w1Sat: true, w1Sun: true };
  localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, done: {}, day: 1 } }, days, dates, dayLog, dayLogA: { "general-english": dayLog }, steps: {}, scores: {}, notes: {}, vocab, backupAsked: 1, rmSeen: now, lastSeen: now,
    chHistA: { "general-english": [{ kind: "shadow", ts: now - 3600000, vid: shVid, title: shT, text: "x", heard: "x" }, { kind: "challenge", ts: now - 2 * day, vid: chVid, title: chT, pass: true, level: 2 }] },
    troubleA: { "general-english": { thorough: { n: 3, ts: now }, schedule: { n: 2, ts: now } } },
    phMasterA: { "general-english": { p0: 1, p1: 1, p2: 1, p3: 1 } } })); }, [chVid, cat.videos[chVid].title, shVid, cat.videos[shVid].title]);
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(BASE + "/index.html#home"); await sleep(3500);
await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#syncNudge").forEach(e => e.remove()); go("home"); }); await sleep(2000);
console.log(JSON.stringify(await p.evaluate(() => ({ pos: currentPos(), recent: nudgeSignals().recent, tw: nudgeSignals().troubleWords, rows: _homeRows.map(r => ({ id: r.id, title: document.querySelector(`.hx-row[data-row="${r.id}"] h3`)?.textContent, items: r.items.map(i => i.type + ":" + (i.vid || i.args.join("/")) + ":" + (i.title || "").slice(0, 30)) })) })), null, 1));
await p.evaluate(() => { const g = document.getElementById("hxRows"); if (g) g.scrollIntoView({ block: "start" }); document.querySelectorAll("#syncNudge").forEach(e => e.remove()); }); await sleep(600);
await p.screenshot({ path: OUT + "/rows-iphone.png", fullPage: false });
console.log("scrollable:", await p.evaluate(() => [...document.querySelectorAll(".hx-row-scroll")].map(e => e.scrollWidth > e.clientWidth)), "errors:", errs);
await b.close();
