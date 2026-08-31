import { createRequire } from "node:module";
import { seed } from "./seed.mjs";
import fs from "node:fs";
const P = "/Users/salomonnorengoucheme/.vscode/extensions/danielsanmedium.dscodegpt-3.24.57/standalone/";
const { chromium } = createRequire(P)("patchright");

const OUT = process.argv[2];
const ONLY = process.argv[3];
const URL = "http://127.0.0.1:8011/index.html";

/* Slow, readable movement. A cut that snaps between screens is unwatchable at
   9:16; easing the scroll is what makes it read as a product demo. */
const glide = async (page, px, ms = 1400) => {
  await page.evaluate(([px, ms]) => new Promise(res => {
    const t0 = performance.now(), y0 = window.scrollY;
    const ease = t => t < .5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
    (function step(){
      const t = Math.min(1,(performance.now()-t0)/ms);
      window.scrollTo(0, y0 + px*ease(t));
      t < 1 ? requestAnimationFrame(step) : res();
    })();
  }), [px, ms]);
};
const tap = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s); if (e) { e.click(); return true } return false;
}, sel);

const caption = (page, text) => page.evaluate(t => {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;"
    + "background:linear-gradient(180deg,rgba(6,8,16,.97),rgba(6,8,16,.90));"
    + "padding:20px 22px 14px;text-align:center;pointer-events:none";
  const h = document.createElement("div");
  h.textContent = t;
  h.style.cssText = "font:800 26px/1.28 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;"
    + "color:#fff;letter-spacing:-.3px";
  const u = document.createElement("div");
  u.textContent = "BE Mastery · free · app.lomonec.com";
  u.style.cssText = "margin-top:7px;font:700 14px/1 -apple-system,system-ui,sans-serif;"
    + "color:#f6c453;letter-spacing:.3px";
  wrap.appendChild(h); wrap.appendChild(u);
  document.body.appendChild(wrap);
}, text);

const nav = async (page, v, wait = 1100) => { await tap(page, `.bottom-nav button[data-v="${v}"]`); await page.waitForTimeout(wait); };

const SCENES = [
  { id: "01-today", caption: "Open it. Today's session is already chosen.",     area: "welding", async run(page) {
      await page.waitForTimeout(2200); await glide(page, 420); await page.waitForTimeout(1600);
      await glide(page, 420); await page.waitForTimeout(1800); } },
  { id: "02-weeks", caption: "Twelve weeks. You always know where you are.",     area: "welding", async run(page) {
      await nav(page, "journey", 1500); await page.waitForTimeout(2000);
      await glide(page, 500); await page.waitForTimeout(2200); } },
  { id: "03-workshop", caption: "Five people. One first day. You speak to all of them.",  area: "welding", async run(page) {
      await nav(page, "practice", 1400);
      await page.evaluate(() => { const e=[...document.querySelectorAll("#v-practice button,#v-practice a")]
        .find(x=>/workplace|scenario|simulation/i.test(x.textContent)); if(e)e.click(); });
      await page.waitForTimeout(1600);
      await page.evaluate(() => { const d=document.querySelector(".sim-scenario-card"); if(d)d.open=true; });
      await page.waitForTimeout(2400); await glide(page, 380); await page.waitForTimeout(2400); } },
  { id: "04-feedback", caption: "Not a score \u2014 the sentence you should have said.",  area: "welding", async run(page) {
      await nav(page, "practice", 1300);
      await page.evaluate(() => { const e=[...document.querySelectorAll("#v-practice button,#v-practice a")]
        .find(x=>/workplace|scenario|simulation/i.test(x.textContent)); if(e)e.click(); });
      await page.waitForTimeout(1400);
      await page.evaluate(() => { const d=document.querySelector(".sim-scenario-card"); if(d)d.open=true; });
      await page.waitForTimeout(900);
      await page.evaluate(() => { const b=[...document.querySelectorAll(".sim-past button,.sim-scenario-card button")]
        .find(x=>/attempt/i.test(x.textContent)); if(b)b.click(); });
      await page.waitForTimeout(2200); await glide(page, 520, 1600); await page.waitForTimeout(2000);
      await glide(page, 520, 1600); await page.waitForTimeout(2200); } },
  { id: "05-shadow", caption: "The lines you'll actually need at work.",    area: "welding", async run(page) {
      await nav(page, "shadow", 1600); await page.waitForTimeout(2000);
      await glide(page, 460); await page.waitForTimeout(2200); } },
  { id: "06-phrases", caption: "Say it casually. Hear it back boardroom-ready.",   area: "welding", async run(page) {
      await nav(page, "phrases", 1500); await page.waitForTimeout(2000);
      await glide(page, 460); await page.waitForTimeout(2200); } },
  { id: "07-progress", caption: "Every number comes from something you said out loud.",  area: "welding", async run(page) {
      await nav(page, "review", 1600); await page.waitForTimeout(2200);
      await glide(page, 500, 1600); await page.waitForTimeout(2000);
      await glide(page, 520, 1600); await page.waitForTimeout(2200); } },
  { id: "08-profile", caption: "Proof you're improving.",   area: "welding", async run(page) {
      await nav(page, "profile", 1600); await page.waitForTimeout(2000);
      await glide(page, 540, 1600); await page.waitForTimeout(2400); } },
  { id: "09-general", caption: "Business English too \u2014 meetings, interviews, calls.",   area: "general-english", async run(page) {
      await page.waitForTimeout(2000); await glide(page, 420); await page.waitForTimeout(1600);
      await nav(page, "review", 1600); await page.waitForTimeout(2200);
      await glide(page, 480, 1600); await page.waitForTimeout(2000); } },
];

const b = await chromium.launch({ headless: true, channel: "chromium" });
for (const sc of SCENES) {
  if (ONLY && sc.id !== ONLY) continue;
  const dir = `${OUT}/${sc.id}`;
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
    recordVideo: { dir, size: { width: 540, height: 960 } },
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(s => { localStorage.setItem("be12_v1", JSON.stringify(s));
                             localStorage.setItem("be_theme","dark");
                             localStorage.setItem("be12_syncNudge","1"); }, seed(sc.area));
  await page.reload({ waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => { const h=document.getElementById("v-home"); return h && h.children.length>0 },
                               null, { timeout: 90000 });
  } catch (e) {
    const diag = await page.evaluate(() => ({
      url: location.href, title: document.title,
      homeKids: (document.getElementById("v-home")||{}).childElementCount ?? -1,
      ob: !!document.getElementById("obWrap"),
      bodyLen: document.body.innerText.length,
      first: document.body.innerText.slice(0,120)
    }));
    console.log("  DIAG", JSON.stringify(diag));
    throw e;
  }
  if (sc.caption) await caption(page, sc.caption);
  await sc.run(page);
  await ctx.close();
  const f = fs.readdirSync(dir).find(x => x.endsWith(".webm"));
  console.log(`  ${sc.id}  ${f ? (fs.statSync(`${dir}/${f}`).size/1024/1024).toFixed(1)+" MB" : "NO VIDEO"}`);
}
await b.close();
