/* Home card pictures: 16:9 clips of the app's own pages from a seeded demo learner "Alex" — not a
   real person. Explore: the word list, the road map, the progress calendar, Phrase Lab, Practice
   Partner. The "Because you…" cards with no video (owner, 27 Sep 2026: "where there is no picture,
   a screenshot of that feature"): a lesson day, trouble words, the AI coach's scenarios. Serve the tree
   first (python3 -m http.server 8148), then:  cd tests && OUT=/tmp/shots node home-shots.mjs
   Then: convert each PNG to home-shots/<name>.jpg (quality 82; the card-only shots — session, phrases,
   trouble, partner, ai — at 780 px wide, quality 80: they are text-heavy and cards are at most 260 pt).
   ONLY=session,phrases shoots a subset. Offsets: RM (road map), PG (progress). */
import { chromium, devices } from "playwright"; import { setTimeout as sleep } from "node:timers/promises";
const BASE = process.env.BASE || "http://127.0.0.1:8148", OUT = process.env.OUT, ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
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
  localStorage.setItem("be_flags", JSON.stringify({ practice_partner_enabled: true }));
  /* trouble words are plain counts (troubleMap()[w]-- when one is said right) */
  const troubleA = { "general-english": { thorough: 3, schedule: 2, colleague: 2, particularly: 1, entrepreneur: 1 } };
  localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1, role: "Project manager", goal: "Lead meetings" }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, done: {}, day: 1 } }, days, dates, dayLog, dayLogA: { "general-english": dayLog }, steps: {}, troubleA, scores: { w1Mon: 4, w1Tue: 4, w1Wed: 5, w2Mon: 4 }, notes: {}, vocab, backupAsked: 1, rmSeen: now, lastSeen: now, start: d(45) })); });
const p = await ctx.newPage();
/* v: a view name, or [view, ...go() args]; prep: code run on the page once it is drawn */
const clipTo = async (v, find, off, name, prep) => {
  if (ONLY && !ONLY.includes(name)) return;
  const [view, ...args] = [].concat(v);
  await p.goto(BASE + "/index.html#" + view); await sleep(2500);
  await p.evaluate(([view, args]) => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#toast").forEach(e => e.remove()); go(view, ...args); }, [view, args]); await sleep(1500);
  if (prep) { await p.evaluate(prep); await sleep(1200); }
  const y = await p.evaluate(([find, off]) => {
    document.querySelectorAll("#ppFab,#syncNudge,.bnav,nav,.app-scroll,.sess-back,.stick-back").forEach(e => e.style.display = "none");
    if (!document.getElementById("shotNoBar")) document.head.insertAdjacentHTML("beforeend", `<style id="shotNoBar">*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important;width:0!important}#appScrollV,#appScrollH,[id^=appScroll]{display:none!important}</style>`);   /* the app's scroll thumb is not part of the picture */
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
await clipTo(["session", 1, "Mon"], { sel: "div,span,b", txt: "^\\s*Focused practice block" }, -12, "session");
await clipTo("phrases", { sel: "div,span,b", txt: "^\\s*Executive Polish" }, -20, "phrases", () => {
  const t = document.querySelector("#v-phrases textarea"); t.value = "So basically we are late on the project because the supplier did not send the parts, and I think we need two more weeks."; t.dispatchEvent(new Event("input", { bubbles: true })); t.style.height = t.style.minHeight = "86px";
  /* the page is one screen tall and cannot scroll: drop the prompt box so the sentence and "Polish it" fit the frame */
  const lbl = [...document.querySelectorAll("#v-phrases div,#v-phrases span,#v-phrases b")].filter(e => /^\s*Today's prompt\s*$/i.test(e.textContent)).sort((x, y) => x.textContent.length - y.textContent.length)[0]; if (lbl && lbl.parentElement) lbl.parentElement.style.display = "none"; });
await clipTo("shadow", { sel: "h3,h2,b,div", txt: "^\\s*My trouble words\\s*$" }, -12, "trouble", () => { shTab("trouble"); });
await clipTo("partner", { sel: "b,h3,div", txt: "^\\s*Find a partner" }, -24, "partner");
await clipTo("roleplay", { sel: "div,span,small", txt: "^\\s*Featured scenario\\s*$" }, -28, "ai");
await b.close();
