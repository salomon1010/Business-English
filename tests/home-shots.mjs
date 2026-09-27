/* Home → Explore card pictures: 16:9 clips of the app's own pages (the word list, the road map,
   the progress calendar) from a seeded demo learner "Alex" — not a real person. Serve the tree
   first (python3 -m http.server 8148), then:  cd tests && OUT=/tmp/shots node home-shots.mjs
   Then: convert each PNG to home-shots/<name>.jpg (quality 82). Offsets: RM (road map), PG (progress). */
import { chromium, devices } from "playwright"; import { setTimeout as sleep } from "node:timers/promises";
const BASE = process.env.BASE || "http://127.0.0.1:8148", OUT = process.env.OUT;
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block", colorScheme: "dark" });
await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail|gstatic/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
await ctx.addInitScript(() => { if (sessionStorage.getItem("s")) return; sessionStorage.setItem("s", 1);
  const day = 86400000, now = Date.now(), d = n => new Date(now - n * day).toISOString().slice(0, 10);
  const dates = [0, 1, 2, 3, 4, 6, 7, 8, 10, 11, 13, 14, 15, 16, 18, 20, 21, 22, 24, 25, 27, 29, 30, 32, 35, 36, 38].map(d);
  const dayLog = {}; dates.forEach(x => dayLog[x] = 1 + (x.charCodeAt(9) % 3));
  const vocab = {}; [["stakeholder", 2], ["leverage", 5], ["deliverable", 1], ["milestone", 3], ["mitigate", 0], ["consensus", 4], ["bandwidth", 1], ["alignment", 5], ["escalate", 2], ["trade-off", 0]].forEach(([w, reps], i) => vocab[w] = { ts: now - i * day, reps, due: now - (i % 3) * day, tk: ["general-english"] });
  const days = { w1Mon: true, w1Tue: true, w1Wed: true, w1Thu: true, w1Fri: true, w1Sat: true, w2Mon: true, w2Tue: true, w2Wed: true };
  localStorage.setItem("be_theme", "dark");
  localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1, role: "Project manager", goal: "Lead meetings" }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, done: {}, day: 1 } }, days, dates, dayLog, dayLogA: { "general-english": dayLog }, steps: {}, scores: { w1Mon: 4, w1Tue: 4, w1Wed: 5, w2Mon: 4 }, notes: {}, vocab, backupAsked: 1, rmSeen: now, lastSeen: now, start: d(45) })); });
const p = await ctx.newPage();
const clipTo = async (v, find, off, name) => {
  await p.goto(BASE + "/index.html#" + v); await sleep(2500);
  await p.evaluate(v => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#toast").forEach(e => e.remove()); go(v); }, v); await sleep(1500);
  const y = await p.evaluate(([find, off]) => {
    document.querySelectorAll("#ppFab,#syncNudge,.bnav,nav,.app-scroll").forEach(e => e.style.display = "none");
    const el = [...document.querySelectorAll(find.sel)].filter(e => !find.txt || new RegExp(find.txt, "i").test(e.textContent || "")).sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0]; if (!el) return null;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + off); return Math.round(el.getBoundingClientRect().top);
  }, [find, off]); await sleep(700);
  if (y == null) { console.log("NO ANCHOR", v); return; }
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: 390, height: 219 } });
  console.log(name, "at", Math.round(y));
};
await clipTo("practice", { sel: "button", txt: "^\\s*STUDY" }, -10, "vocab");
await clipTo("journey", { sel: "#rmRoad" }, +(process.env.RM || 300), "roadmap");
await clipTo("review", { sel: "h3,h2,b,span,div", txt: "Progress calendar" }, +(process.env.PG || 60), "progress");
await b.close();
