/* The game streak countdown — the web half of the iOS Live Activity (10 Oct 2026).
   Run: cd tests && node live-activity.mjs     (the Swift half is built by Xcode: BEWidget/BEStreakActivity.swift)
   The shell's BEWidget plugin is stood in for, so this checks WHEN the app asks for a countdown,
   WHAT it sends, that finishing the daily and signing out end it, and the lock-screen tap. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const PORT = +(process.env.PORT || 8871);
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
const b = await chromium.launch();
async function open(tr, lang = "en", stub = true) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([tr, lang]) => { localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "A", lang, ts: 1 }, professionalTracks: { activeId: tr }, fnd: { [tr]: { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1 })); localStorage.setItem("be_lang", lang);
    localStorage.setItem("be_flags", JSON.stringify({ english_mastery_enabled: true, welding_mastery_enabled: true, ios_live_activity_enabled: true })); }, [tr, lang]);
  const view = { day: new Date().toISOString().slice(0, 10), plan: "free", energy: { used: 0, limit: 5 }, xp: { total: 0, today: 0 }, daily: { done: false } };
  await ctx.route(u => /be-polish/.test(u.href), r => { let body = {}; try { body = JSON.parse(r.request().postData() || "{}"); } catch (e) {} const w = body.wm || {};
    const done = w.op === "finish" && w.mode === "daily"; const v = { ...view, daily: { done } };
    return r.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(w.op === "start" ? { ok: true, ticket: "t:" + w.sid, ...v } : w.op === "finish" ? { ok: true, awarded: 40, dailyBonus: done ? 30 : 0, ...v } : v) }); });
  await ctx.route(u => /be-events|be-partner|cloudflareinsights|entitlements|gstatic/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`); await sleep(1700);
  await p.evaluate(stub => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    FBUser = { uid: "u", getIdToken: async () => "t" };
    if (!stub) return;
    /* the shell's plugin, recorded */
    window.__live = []; const fake = { liveStart: async o => { __live.push(["start", o]); return { started: true }; }, liveEnd: async o => { __live.push(["end", o]); return { ended: 1 }; } };
    window.beLive = () => fake; window.liveOn = () => true; }, stub);
  return { ctx, p, errs };
}
for (const [tr, view, ui, name] of [["general-english", "english", "EMUI", "English Mastery"], ["welding", "mastery", "WMUI", "Welding Mastery"]]) {
  console.log(`\n# ${name}`);
  const { ctx, p, errs } = await open(tr);
  await p.evaluate(v => go(v, "home"), view); await sleep(900); await p.evaluate(ui => window[ui]._refresh(), ui); await sleep(400);
  const info = await p.evaluate(ui => window[ui].liveInfo(), ui);
  const mid = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z") + 864e5;
  ok(`${name} · L1 · the hub says what and until when: its own programme and title, the end of the UTC game day, not done`, info && info.deadline === mid && info.done === false && info.prog === tr && info.title === name && /Last chance/.test(info.line), JSON.stringify(info));
  /* when */
  const when = await p.evaluate(ui => { const real = window[ui].liveInfo, base = real(); const out = {};
    for (const [k, h] of [["h5", 5], ["h2", 2], ["m30s", 0.008]]) { __live = []; window[ui].liveInfo = () => Object.assign({}, base, { deadline: Date.now() + h * 3600e3 }); liveSync(); out[k] = __live.map(x => x[0]).join(","); }
    __live = []; window[ui].liveInfo = () => Object.assign({}, base, { done: true, deadline: Date.now() + 3600e3 }); liveSync(); out.done = JSON.stringify(__live);
    window[ui].liveInfo = real; return out; }, ui);
  ok(`${name} · L2 · leaving the app: 5 h before the deadline nothing; 2 h before a countdown starts; under a minute nothing`, when.h5 === "" && when.h2 === "start" && when.m30s === "", JSON.stringify(when));
  ok(`${name} · L3 · the daily already done: the countdown is ended with "streak safe" instead`, /"end",\{"done":true\}/.test(when.done), when.done);
  const sent = await p.evaluate(ui => { const real = window[ui].liveInfo; window[ui].liveInfo = () => Object.assign({}, real(), { deadline: Date.now() + 2 * 3600e3 }); __live = []; liveSync(); window[ui].liveInfo = real; return __live[0] && __live[0][1]; }, ui);
  ok(`${name} · L4 · what is sent: programme, title, line, done-line, streak, deadline — nothing else`, sent && Object.keys(sent).sort().join() === "deadline,doneLine,line,prog,streak,title", JSON.stringify(sent));
  /* the lock-screen tap opens today's daily; finishing it ends the countdown */
  await p.evaluate(() => { __live = []; widgetOpenRoute({ view: ({ "general-english": "english", welding: "mastery" })[S.professionalTracks.activeId], act: "daily" }); }); await sleep(1500);
  const g = await p.evaluate(ui => { const G = window[ui]._game(); return G && { daily: G.daily, mode: G.mode }; }, ui);
  ok(`${name} · L5 · tapping the lock-screen card opens today's daily`, g && g.daily === true, JSON.stringify(g));
  for (let i = 0; i < 12; i++) { const more = await p.evaluate(async ui => { const G = window[ui]._game(); if (!G || G.done) return false; const C = window[ui]._corpus(), id = G.ids[G.i], t = (C.terms || []).find(x => x.id === id);
    const btn = document.querySelector(`#wmGame [data-wm="qpick"][data-a="${id}"],#emGame [data-em="qpick"][data-a="${id}"]`) || document.querySelector('#wmGame [data-wm="qpick"],#emGame [data-em="qpick"],#emGame [data-em="gpick"]'); if (btn) btn.click(); await new Promise(r => setTimeout(r, 150)); const n = document.querySelector('#wmGame [data-wm="next"],#emGame [data-em="next"]'); if (n) n.click(); await new Promise(r => setTimeout(r, 150)); return true; }, ui); if (!more) break; }
  await sleep(1200);
  ok(`${name} · L6 · finishing the daily ends the countdown with "streak safe"`, await p.evaluate(() => __live.some(x => x[0] === "end" && x[1].done === true)), await p.evaluate(() => JSON.stringify(__live)));
  await p.evaluate(() => { __live = []; widgetClear(); }); await sleep(200);
  ok(`${name} · L7 · sign-out (widgetClear) also ends any countdown`, await p.evaluate(() => __live.some(x => x[0] === "end")));
  ok(`${name} · L8 · no page errors`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, p } = await open("welding", "fr");
  await p.evaluate(() => go("mastery", "home")); await sleep(900);
  const i = await p.evaluate(() => WMUI.liveInfo());
  ok("L9 · in French the card speaks French", i && /Dernière chance/.test(i.line) && /sauvée/.test(i.doneLine), JSON.stringify(i));
  await ctx.close();
  const o = await open("general-english", "en", false);
  ok("L10 · outside the iOS app nothing is ever asked of the shell (no plugin, liveOn false, liveSync a no-op)", await o.p.evaluate(() => { try { liveSync(); return IS_IOS_APP === false && beLive() === null && liveOn() === false; } catch (e) { return String(e); } }));
  await o.ctx.close();
}
await b.close(); srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
