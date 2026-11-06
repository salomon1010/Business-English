/* Pronunciation assessment honesty (6 Nov 2026, Phase 0 stabilization).

   Run:  cd tests && node pronunciation-honesty.mjs

   fbAssess's Worker route answers two different things under one shape:
   mode "ai" means an audio model actually listened and scored each word —
   a real number. mode "whisper" means the Worker had no audio model and
   fell back to a plain transcript string-match — not a pronunciation
   judgement at all. Showing a digit in that second case (even with a "~"
   prefix and a footnote) claims precision the data doesn't have. This file
   proves NO surface ever renders a whisper-mode digit — only the colour-
   coded bucket (Strong/Good/Needs practice), honestly labelled for anyone
   using a screen reader via aria-label, with the "approx." note kept.
   ai mode is checked too, so the fix is proven not to suppress real numbers.

   fbRenderPron itself (the Shadow/Session pronunciation panel) is covered
   end-to-end, with a mocked Worker, in shadow-coach.mjs § 8 — this file
   covers ppRevResultHTML (the Practice Partner review score box), which is
   a pure function and needs no network mock to exercise directly. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };

let BASE = process.env.BASE, server = null;
if (!BASE) {
  server = spawn("python3", ["-m", "http.server", String(process.env.PORT || 8919), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
  await sleep(800); BASE = "http://127.0.0.1:" + (process.env.PORT || 8919);
}
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.goto(BASE + "/index.html"); await sleep(1200);

const render = (st, r = null) => p.evaluate(([st, r]) => ppRevResultHTML("rev1", "k1", st, r), [st, r]);
const parse = async html => p.evaluate(h => { const d = document.createElement("div"); d.innerHTML = h; document.body.appendChild(d);
  const out = { head: d.querySelector(".pp-rv-score b")?.textContent || "", note: !!d.querySelector(".pp-rv-note"),
    words: [...d.querySelectorAll(".pp-rv-pw .fb-pw")].map(x => x.textContent.trim()),
    wordLabels: [...d.querySelectorAll(".pp-rv-pw .fb-pw")].map(x => x.getAttribute("aria-label") || "") };
  d.remove(); return out; }, html);

console.log("\n# mode ai: real numbers, no 'approx.' note");
{ const html = await render({ state: "done", score: 82, mode: "ai", words: [{ word: "schedule", score: 91 }, { word: "deadline", score: 58 }] });
  const r = await parse(html);
  ok("1 · header shows a real '82%'", r.head === "82%", JSON.stringify(r));
  ok("2 · every word chip shows its real digit, no aria-label override", r.words.every(w => /^[a-z]+\d+$/.test(w.replace(/\s/g, ""))) && r.wordLabels.every(l => l === ""), JSON.stringify(r));
  ok("3 · no 'listening was not available' note", !r.note, JSON.stringify(r)); }

console.log("\n# mode whisper: never a digit, anywhere — bucket + 'approx.' + honest aria-label instead");
{ const html = await render({ state: "done", score: 82, mode: "whisper", words: [{ word: "schedule", score: 91 }, { word: "deadline", score: 58 }, { word: "probably", score: 18 }] });
  const r = await parse(html);
  ok("4 · header carries NO digit and says 'approx.'", !/\d/.test(r.head) && /approx/i.test(r.head), JSON.stringify(r));
  ok("5 · no word chip carries a digit", r.words.every(w => !/\d/.test(w)), JSON.stringify(r));
  ok("6 · every word's honest bucket verdict is on aria-label instead (Strong / Good / Needs practice)", r.wordLabels.every(l => /Strong|Good|Needs practice/.test(l)), JSON.stringify(r));
  ok("7 · the 'listening was not available' note is shown", r.note, JSON.stringify(r)); }

console.log("\n# other states are unaffected by the fix");
{ const grading = await render({ state: "grading" });
  ok("8 · grading state unchanged (still the shared AI-wait component)", /ai-inline/.test(grading), grading); }

const fails = res.filter(x => !x).length;
console.log(`\n${res.length - fails}/${res.length} passed`);
await b.close(); if (server) server.kill();
process.exit(fails ? 1 : 0);
