/* The reminder ask (30 Oct 2026): after a finished session, a learner with no
   reminder is asked "Same time tomorrow?" — at most REM_ASK_MAX times,
   REM_ASK_GAP_MS apart, never when notifications cannot arrive, and never on
   top of the rating prompt. "Remind me" switches the same reminder the
   Settings switch does, at the time chosen in the dialog.

     cd tests && node reminder-ask.mjs        (PORT=<free port> if 8796 is taken) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = +(process.env.PORT || 8796);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
await sleep(900);
const BASE = "http://127.0.0.1:" + PORT;
const res = [];
const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 240)}`); };
const browser = await chromium.launch();

async function fresh(perm) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  /* headless Chromium answers "denied" on http://127.0.0.1 even after
     grantPermissions, so the permission a real phone would report is stubbed */
  await ctx.addInitScript(p => {
    const N = window.Notification; if (!N) return;
    Object.defineProperty(N, "permission", { get: () => p, configurable: true });
    N.requestPermission = () => Promise.resolve(p);
  }, perm === "granted" ? "default" : "denied");
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
  await page.goto(BASE + "/index.html", { waitUntil: "load" });
  await page.evaluate(() => { OB.name = "Rem"; obFinish(); try { wcClose(); } catch (e) {} });
  await sleep(500);
  /* the dialogs a fresh learner meets first are not what is under test */
  await page.evaluate(() => document.querySelectorAll(".cf-ov,.wc-ov").forEach(o => o.remove()));
  return { ctx, page, errors };
}
/* finish a session and clear the coach summary, as a learner would */
async function finish(page, w) {
  await page.evaluate(w => { toggleDay(dayKey(w, "Mon"), w, "Mon"); }, w);
  for (let i = 0; i < 20; i++) { await sleep(250); await page.evaluate(() => { const c = document.getElementById("coachSummary"); if (c) c.remove(); }); }
  await sleep(1500);
}

try {
  {
    const { ctx, page, errors } = await fresh("granted");
    ok("1 · a learner with no reminder is due to be asked", await page.evaluate(() => remAskDue()) === true);
    await finish(page, 1);
    const shown = await page.evaluate(() => {
      const ov = document.querySelector(".rem-ask-ov");
      return { on: !!ov, title: ov && ov.querySelector("h3").textContent, time: ov && ov.querySelector("#remAskTime").value, rate: !!document.querySelector(".ra-ov:not(.rem-ask-ov)") };
    });
    ok("2 · finishing a session shows the ask", shown.on && shown.title === "Same time tomorrow?", JSON.stringify(shown));
    ok("3 · the default time is a quarter hour (the time just practised, or the evening slot)", /^\d{2}:(00|15|30|45)$/.test(shown.time || ""), shown.time);
    ok("4 · it is not stacked with the rating prompt", shown.rate === false);
    await page.fill("#remAskTime", "08:15");
    await page.click(".rem-ask-ov [data-ra='1']");
    await sleep(400);
    const after = await page.evaluate(() => ({ on: S.reminder.on, time: S.reminder.time, gone: !document.querySelector(".rem-ask-ov"), due: remAskDue(), n: S.remAsk.n }));
    ok("5 · 'Remind me' switches the reminder on at the chosen time", after.on === true && after.time === "08:15", JSON.stringify(after));
    ok("6 · the dialog closes and is not due again while the reminder is on", after.gone && after.due === false, JSON.stringify(after));
    ok("7 · no page errors", !errors.length, errors.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh("granted");
    await finish(page, 1);
    await page.click(".rem-ask-ov [data-ra='0']");
    await sleep(400);
    const a = await page.evaluate(() => ({ on: !!(S.reminder && S.reminder.on), n: S.remAsk.n, due: remAskDue() }));
    ok("8 · 'Not now' leaves the reminder off and holds the ask for a few days", a.on === false && a.n === 1 && a.due === false, JSON.stringify(a));
    await finish(page, 2);
    ok("9 · …so the next session that day does not ask again", await page.evaluate(() => !document.querySelector(".rem-ask-ov")));
    const later = await page.evaluate(() => { S.remAsk.at = Date.now() - REM_ASK_GAP_MS - 1000; return remAskDue(); });
    ok("10 · after the gap it may ask a second time", later === true);
    const capped = await page.evaluate(() => { S.remAsk = { n: REM_ASK_MAX, at: 0 }; return remAskDue(); });
    ok("11 · never more than REM_ASK_MAX times", capped === false);
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh("denied");
    await finish(page, 1);
    ok("12 · blocked notifications: no ask (it would promise what cannot arrive)", await page.evaluate(() => !document.querySelector(".rem-ask-ov") && remAskDue() === false));
    const noApi = await page.evaluate(() => { const N = window.Notification; window.Notification = undefined; const r = remAskDue(); window.Notification = N; return r; });
    ok("13 · no notification API (an iPhone Safari tab): no ask", noApi === false);
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh("granted");
    const t = await page.evaluate(() => [remAskTime(new Date(2026, 9, 30, 7, 52)), remAskTime(new Date(2026, 9, 30, 23, 40)), remAskTime(new Date(2026, 9, 30, 3, 5))]);
    ok("14 · remAskTime rounds to the quarter hour and keeps nights to the evening slot", t[0] === "07:45" && t[1] === "19:00" && t[2] === "19:00", JSON.stringify(t));
    const keys = await page.evaluate(async () => {
      const K = ["rem.ask_title", "rem.ask_body", "rem.ask_time", "rem.ask_go"];
      const miss = [];
      for (const c of ["fr", "es", "pt", "it", "de", "ru", "ar", "ur", "hi", "bn", "id", "vi", "zh", "ja", "ko"]) {
        const j = await (await fetch("i18n/" + c + ".json")).json();
        for (const k of K) if (!j[k] || j[k] === I18N_EN[k]) miss.push(c + ":" + k);
      }
      return miss;
    });
    ok("15 · the four strings are translated in all 15 language files", !keys.length, keys.join(", "));
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
const failed = res.filter(x => !x).length;
console.log(`\n${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
