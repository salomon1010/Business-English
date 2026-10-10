/* Screenshot the contact sheet in parts, one PNG per term group, for review.
   node scripts/welding-photos/shoot-sheet.mjs [first-index] [count] */
import { chromium } from "../../tests/node_modules/playwright/index.mjs";
const OUT = new URL("./out/", import.meta.url).pathname;
const args = process.argv.slice(2).filter(x => !x.startsWith("--")), tag = process.argv.includes("--more") ? "-more" : "";
const [a = 0, n = 4] = args.map(Number);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 980, height: 600 } });
await p.goto("file://" + OUT + "sheet" + tag + ".html"); await p.waitForTimeout(5000);
await p.evaluate(([a, n]) => { const hs = [...document.querySelectorAll("h2")]; hs.forEach((h, i) => { const keep = i >= a && i < a + n; h.style.display = keep ? "" : "none"; h.nextElementSibling.style.display = keep ? "" : "none"; }); }, [a, n]);
await p.waitForTimeout(1500);
await p.screenshot({ path: OUT + `sheet${tag}-${a}.png`, fullPage: true });
await b.close(); console.log(OUT + `sheet${tag}-${a}.png`);
