/* The legal pages must never be a dead end (owner, 30 September 2026).
   Run: cd tests && node legal-pages.mjs

   privacy.html and delete-account.html are opened from inside the app with
   target="_blank". In a browser tab that is fine. In the INSTALLED app there is
   no tab strip and no back gesture, so the reader arrived on the policy with no
   way out — reported from a real iPhone against the Premium sheet.

   Each page now carries its own close button. Inside the app's document sheet
   (openDoc -> an iframe with its own .doc-close) it stays hidden, because two
   close buttons on one panel is worse than none. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = 8123, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });

const PAGES = ["privacy.html", "delete-account.html"];

for (const page of PAGES) {
  console.log(`\n# ${page}`);
  const errs = [];
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + page); await sleep(400);

  const st = await p.evaluate(() => {
    const b = document.getElementById("docClose"); if (!b) return null;
    const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    return { shown: !b.hidden, w: Math.round(r.width), h: Math.round(r.height), pos: cs.position,
      onScreen: r.top >= 0 && r.left >= 0 && r.right <= innerWidth,
      label: b.getAttribute("aria-label"), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  ok(`${page}: standalone, a visible close button — 44px, on screen, labelled, no page overflow`,
    st && st.shown && st.w >= 44 && st.h >= 44 && st.pos === "fixed" && st.onScreen && st.label && !st.overflow, JSON.stringify(st));

  /* the dead end itself: a fresh window (no history to step back to) must still
     land somewhere real, never about:blank */
  await p.click("#docClose"); await sleep(800);
  const landed = p.url();
  ok(`${page}: closing a fresh window lands in the app, never a blank page`,
    /\/(#|$)/.test(landed.replace(BASE, "/")) && !/about:blank/.test(landed), landed);
  ok(`${page}: no page errors`, !errs.length, errs.join(" | "));
  await p.close();

  /* embedded = the app's own document sheet, which has its own close button */
  const p2 = await ctx.newPage();
  await p2.setContent(`<iframe src="${BASE}${page}" style="width:390px;height:600px;border:0"></iframe>`);
  await sleep(800);
  const hidden = await p2.frames()[1].evaluate(() => {
    const b = document.getElementById("docClose"); return !!b && b.hidden;
  });
  ok(`${page}: inside the in-app sheet (an iframe) the button stays hidden — the sheet closes it`, hidden);
  await p2.close();
}

/* the app really does open these in a sheet that can be closed, so the hidden
   case above is not hiding the only way out */
console.log("\n# the in-app route still has its own close button");
{
  const src = (await import("node:fs")).readFileSync(new URL("../index.html", import.meta.url), "utf8");
  ok("openDoc renders a .doc-close button beside the iframe", /class="doc-close"[^>]*onclick="closeDoc\(\)"/.test(src));
  ok("…and the iOS shell routes same-origin target=_blank pages into it", /openDoc\(h,\(a\.textContent\|\|""\)\.trim\(\),\{theme:true\}\)/.test(src.replace(/\s+/g, "")) || /openDoc\(h,/.test(src));
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
