/* The Shadow report is written in the learner's Shadow TRANSLATION language,
   not the app's (owner, 3 Oct 2026). _tOvr only holds for one synchronous
   render, but the report is not finished when that render ends: the
   pronunciation cell waits for the AI pass and the micro-practice card is
   redrawn on every phase change. This file is the proof that those LATE
   writers speak the report's language too — the owner's 3 Oct device
   screenshot showed a French report with an English "Not available" in it.

   Run: cd tests && PORT=<free> node report-lang.mjs
   Nothing here is mocked at the language layer: the fr/es packs are the real
   i18n/*.json files, fetched over the test server by the app's own loader. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8533), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
const b = await chromium.launch();

const FR = JSON.parse(readFileSync(new URL("../i18n/fr.json", import.meta.url), "utf8"));
const ES = JSON.parse(readFileSync(new URL("../i18n/es.json", import.meta.url), "utf8"));
const EN_NA = "Not available";

const seed = trLang => JSON.stringify({
  profile: { name: "Alex", lang: "en", trLang, ts: 1 },
  professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {},
  rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

async function open(trLang) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: "dark" });
  await ctx.addInitScript(s => { localStorage.setItem("be12_v1", s); }, seed(trLang));
  await ctx.route(u => /be-events|be-polish|be-partner|be-entitlements|cloudflareinsights|googletag|youtube/.test(u.href),
    r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => typeof window.t === "function" || typeof window.go === "function", null, { timeout: 15000 }).catch(() => {});
  return { ctx, p, errs };
}

/* draws a real report into a detached host, then hands back what the late
   writers put on screen. recCtx decides whether this counts as a Shadow
   report at all — that is the switch the feature turns on. */
const drive = (p, recCtx) => p.evaluate(async ctx => {
  const out = document.createElement("div"); out.id = "repProbe";
  document.body.appendChild(out);
  fbCtx.recCtx = ctx;
  await svRepDictEnsure();                       // the pack the report will use
  fbShowResults("I can tell you", "I can with you", true, "repProbe");
  const sync = out.textContent;
  /* the summary strip exists only when the report had a target and a take;
     give the late writer its cell either way so the assertion is about the
     language, not about the layout */
  let host = out.querySelector("#fbSumPron");
  if (!host) { host = document.createElement("div"); host.id = "fbSumPron"; host.innerHTML = "<small>x</small><b>…</b>"; out.appendChild(host); }
  fbPronSum(out, null);                          // the AI pass came back empty
  const late = host.querySelector("b").textContent;
  const repLang = (typeof _fbRepLang === "undefined") ? "undef" : (_fbRepLang ? "set" : "null");
  const leaked = (typeof _tOvr === "undefined") ? "undef" : (_tOvr ? "LEAKED" : "clear");
  out.remove();
  return { sync, late, repLang, leaked };
}, recCtx);

/* ---------- 1. a French learner's Shadow report ---------- */
{
  const { ctx, p, errs } = await open("fr");
  const r = await drive(p, "general-english:shadow-abc123");
  ok("R1 report language is remembered for the late writers", r.repLang === "set", r.repLang);
  ok("R2 _tOvr is not left on after the render", r.leaked === "clear", r.leaked);
  /* the attempt row only renders once there IS a history, so assert on strings
     the first report always carries: the metric labels of the summary strip */
  ok("R3 the synchronous report is French", [FR["sv.ch_dim_pron"], FR["fb.fillers_label"]].every(x => x && r.sync.includes(x)), r.sync.slice(0, 200));
  ok("R4 the pronunciation cell is French, not English", r.late === FR["fb.c_na"], `got ${JSON.stringify(r.late)}, want ${JSON.stringify(FR["fb.c_na"])}`);
  ok("R5 the English string is gone from that cell", r.late !== EN_NA, r.late);
  ok("R6 no page error", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------- 2. the same thing in Spanish, to prove it follows the choice ---------- */
{
  const { ctx, p, errs } = await open("es");
  const r = await drive(p, "general-english:shadow-abc123");
  ok("R7 the cell follows the chosen language, not a hard-coded French", r.late === ES["fb.c_na"], `got ${JSON.stringify(r.late)}`);
  ok("R8 Spanish and French really differ here", ES["fb.c_na"] !== FR["fb.c_na"], ES["fb.c_na"]);
  ok("R9 no page error", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------- 3. a report that is NOT a Shadow report keeps the app language ---------- */
{
  const { ctx, p, errs } = await open("fr");
  const r = await drive(p, "general-english:phrase7");
  ok("R10 a non-Shadow report takes no override", r.repLang === "null", r.repLang);
  ok("R11 and stays in the app language", r.late === EN_NA, r.late);
  ok("R12 no page error", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------- 4. the key exists everywhere, so no report can fall through ---------- */
{
  const miss = [];
  for (const c of ["es","fr","pt","it","de","ru","ar","ur","hi","bn","id","vi","zh","ja","ko"]) {
    const d = JSON.parse(readFileSync(new URL(`../i18n/${c}.json`, import.meta.url), "utf8"));
    if (d["fb.c_na"] == null) miss.push(c);
  }
  ok("R13 fb.c_na is present in all 15 packs", miss.length === 0, miss.join(","));
  ok("R14 fr/es/pt/ar carry a real translation", ["fr","es","pt","ar"].every(c => {
    const d = JSON.parse(readFileSync(new URL(`../i18n/${c}.json`, import.meta.url), "utf8"));
    return d["fb.c_na"] !== EN_NA;
  }));
}

/* ---------- 5. the Welding side gets the same treatment ---------- */
{
  const { ctx, p, errs } = await open("fr");
  await p.evaluate(() => { S.professionalTracks.activeId = "welding"; });
  const r = await drive(p, "welding:shadow-w1");
  ok("R15 a Welding Shadow report is a Shadow report", r.repLang === "set", r.repLang);
  ok("R16 its late cell is French too", r.late === FR["fb.c_na"], r.late);
  ok("R17 no page error", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await b.close(); srv.kill();
const bad = res.filter(x => !x).length;
console.log(`\n  ${res.length - bad}/${res.length} pass  (${BASE})`);
process.exit(bad ? 1 : 0);
