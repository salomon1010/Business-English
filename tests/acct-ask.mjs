/* The account ask at the first AI moment (owner, 31 Oct 2026).
   Run: cd tests && node acct-ask.mjs        (PORT=nnnn for a free port)
   A signed-out learner whose AI report was withheld for want of an account is
   asked, once, to create a FREE account — never a paywall, never over another
   dialog, at most three times two days apart. Real index.html; the sign-in
   sheet is a stub that records it was asked for. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8797), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await chromium.launch();
const seed = JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
async function open({ ask = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, a]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test"); localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true })); if (a) localStorage.setItem("be_acct_ask", a); }, [seed, ask]);
  await ctx.route(u => /ent\.test|be-events|be-partner|be-polish|be-push|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1800);
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv,#webGate").forEach(e => e.remove()); window.__auth = []; window.fbOpenModal = m => { window.__auth.push(m); }; });
  return { ctx, p, errs };
}
const dlg = p => p.evaluate(() => { const o = document.querySelector(".acct-ask-ov"); return o ? { h: o.querySelector("h3").innerText, text: o.innerText.replace(/\s+/g, " "), focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.aa : "" } : null; });
const withheld = p => p.evaluate(() => aiOffNote("ai_analysis"));

{ /* the first AI moment, signed out */
  const { ctx, p, errs } = await open();
  const pre = await p.evaluate(() => ({ planOn: planOn(), noAcct: aiNoAccount() }));
  ok("A0 · the harness is a signed-out learner where the account rule is in force (planOn, aiNoAccount)", pre.planOn && pre.noAcct, JSON.stringify(pre));
  const note = await withheld(p); await sleep(1800);
  const d = await dlg(p);
  ok("A1 · a report withheld for want of an account → the ask opens by itself, and the inline note still says why", d && /speaking report/i.test(d.h) && /sign in/i.test(note), JSON.stringify({ d, note }));
  ok("A2 · it is not a paywall: it says the account is free and Premium separate, and names no price", d && /costs nothing/.test(d.text) && /Premium is separate/.test(d.text) && !/\$|€|£|\/ month|\/ year/.test(d.text), d && d.text);
  ok("A3 · Create a free account is the focused, primary action", d && d.focus === "1", JSON.stringify(d));
  const go = await p.evaluate(async () => { document.querySelector('[data-aa="1"]').click(); await new Promise(r => setTimeout(r, 500)); return { auth: window.__auth.slice(), open: !!document.querySelector(".acct-ask-ov") }; });
  ok("A4 · …it opens the sign-up sheet (mode 'up') and closes itself", go.auth.join() === "up" && !go.open, JSON.stringify(go));
  await withheld(p); await sleep(1800);
  ok("A5 · once per app session: a second withheld report does not ask again", !(await dlg(p)));
  ok("A6 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{ /* the pace: two days apart, three times at most */
  let o = await open({ ask: JSON.stringify({ n: 1, at: Date.now() - 3600e3 }) }); await withheld(o.p); await sleep(1800);
  ok("A7 · asked an hour ago (another session) → not again within two days", !(await dlg(o.p))); await o.ctx.close();
  o = await open({ ask: JSON.stringify({ n: 1, at: Date.now() - 3 * 864e5 }) }); await withheld(o.p); await sleep(1800);
  ok("A8 · …three days later it may ask again", !!(await dlg(o.p))); await o.ctx.close();
  o = await open({ ask: JSON.stringify({ n: 3, at: Date.now() - 30 * 864e5 }) }); await withheld(o.p); await sleep(1800);
  ok("A9 · after three asks, never again", !(await dlg(o.p))); await o.ctx.close();
}
{ /* never over anything, never for a signed-in learner, Escape closes */
  let o = await open();
  await o.p.evaluate(() => { const d = document.createElement("div"); d.className = "auth-ov"; d.id = "busyAuth"; document.body.appendChild(d); });
  await withheld(o.p); await sleep(1800);
  const waited = await dlg(o.p);
  await o.p.evaluate(() => document.getElementById("busyAuth").remove()); await sleep(1500);
  ok("A10 · never over the sign-in sheet (or any dialog): it waits, then asks once that is gone", !waited && !!(await dlg(o.p)));
  const esc = await o.p.evaluate(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await new Promise(r => setTimeout(r, 300)); return { open: !!document.querySelector(".acct-ask-ov"), auth: window.__auth.length }; });
  ok("A11 · Escape closes it and does not open the sign-in sheet", !esc.open && esc.auth === 0, JSON.stringify(esc));
  await o.ctx.close();
  o = await open();
  await o.p.evaluate(() => { FBUser = { uid: "u1", email: "u1@test", getIdToken: async () => "t" }; });
  await withheld(o.p); await sleep(1800);
  ok("A12 · a signed-in learner is never asked", !(await dlg(o.p))); await o.ctx.close();
}
{ /* every withheld-for-account moment reaches it (static: the graders after a take) */
  const h = readFileSync(root + "index.html", "utf8");
  const hooked = (h.match(/aiNoAccount\(\)\?\(acctAsk\("shadow"\),"acct"\):"net"/g) || []).length;
  ok("A13 · the report notes (aiOffNote / aiErrText) and the Shadow / Challenge / drill graders all call it", /aiOffNote\(cap\)\{try\{return aiNoAccount\(\)\?\(acctAsk\(/.test(h) && /aiErrText\(key\)\{try\{return aiNoAccount\(\)\?\(acctAsk\(/.test(h) && hooked >= 7 && /_fbTxWhy=aiNoAccount\(\)\?\(acctAsk\(/.test(h), "graders hooked: " + hooked);
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
