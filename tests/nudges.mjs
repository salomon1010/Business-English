/* Personalised Learning Nudges — the app and the service worker (26 Sep 2026).
   Run: cd tests && node nudges.mjs        (BASE=… to test another tree)
   The app's real code in a browser, be-push answered by a route here; the
   service worker's push / close branches evaluated in a stub. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { readFileSync } from "node:fs"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8133);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await chromium.launch();
const DAY = 86_400_000, today = new Date().toISOString().slice(0, 10), yday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
const vocab = n => Object.fromEntries(Array.from({ length: n }, (_, i) => ["word" + i, { ts: Date.now() - i, reps: 1, due: Date.now() - 1000, tk: ["general-english", "welding"] }]));
const seed = (tr, extra = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [yday], dayLog: { [yday]: 1 }, dayLogA: { "general-english": { [yday]: 1 }, welding: { [yday]: 1 } }, steps: {}, scores: {}, notes: {}, vocab: vocab(7), rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1, pushId: "phone-test-0001", reminder: { on: false, time: "19:00" }, ...extra });
let pushMode = "ok"; const pushCalls = [];
async function open(track, extra = {}, query = "") {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.grantPermissions(["notifications"], { origin: BASE });
  await ctx.addInitScript(s => {
    if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1");
    localStorage.setItem("be12_v1", s); localStorage.setItem("be_partner_api", "http://partner.test");
    localStorage.setItem("be_flags", JSON.stringify({ learning_nudges_enabled: true, practice_partner_enabled: true }));
  }, JSON.stringify(seed(track, extra)));
  /* headless Chromium answers "denied" even after grantPermissions: stand in for a phone that allowed notifications */
  await ctx.addInitScript(() => { try { Object.defineProperty(Notification, "permission", { get: () => "granted" }); } catch (e) {} });
  await ctx.addInitScript(() => { window.__beacons = []; navigator.sendBeacon = (u, blob) => { blob.text().then(t => { try { const j = JSON.parse(t); window.__beacons.push(j.name + (j.props && j.props.result ? ":" + j.props.result : "") + (j.props && j.props.gap ? ":" + j.props.gap : "")); } catch (e) {} }); return true; }; });
  await ctx.route(u => /be-events|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  await ctx.route("http://partner.test/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(/presence/.test(r.request().url()) ? { online: 0, waiting: 0 } : { consented: false }) }));
  await ctx.route("https://be-push.nore-ngou.workers.dev/**", async r => {
    const u = new URL(r.request().url()); let body = null; try { body = r.request().postDataJSON(); } catch (e) {}
    pushCalls.push({ p: u.pathname, auth: r.request().headers().authorization || "", body });
    const H = { "access-control-allow-origin": "*", "access-control-allow-headers": "Content-Type, Authorization" };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    if (u.pathname === "/nudge") return r.fulfill(pushMode === "welding" ? { status: 403, contentType: "application/json", headers: H, body: '{"error":"track"}' } : { status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ ok: true, rid: body.rec.rid }) });
    return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: '{"ok":true}' });
  });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + query); await sleep(1500);
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()); FBUser = { uid: "u-n", email: "a@b.c", getIdToken: async () => "tok-ge" }; });
  return { ctx, p, errs };
}
const beacons = p => p.evaluate(() => window.__beacons.slice());

console.log("\n# General English: learner state → the best next action → be-push");
{
  const { ctx, p, errs } = await open("general-english");
  const sig = await p.evaluate(() => nudgeSignals());
  ok("A1 · signals come from the learner's own state: lesson position, 7 words due, not practised today, 1 day away", sig.ge && sig.pos && sig.pos.w >= 1 && sig.wordsReady === 7 && !sig.practicedToday && sig.daysAway === 1, JSON.stringify(sig));
  pushCalls.length = 0;
  const pend = await p.evaluate(() => nudgeSchedule("test"));
  const put = pushCalls.find(c => c.p === "/nudge");
  ok("A2 · the engine picks today's lesson and be-push gets a structured record with the learner's token", pend && pend.kind === "lesson" && put && put.auth === "Bearer tok-ge" && put.body.id === "phone-test-0001" && put.body.rec.view === "session" && put.body.rec.args.length === 2, JSON.stringify({ pend, put }));
  ok("A3 · the message is the fixed template filled with the learner's week — no free text", /^Week \d+ is ready$/.test(put.body.rec.title) && /minutes today moves you forward/.test(put.body.rec.body), JSON.stringify(put.body.rec));
  ok("A4 · expiry and send time are set (sent within a day, expires ≤ 36 h)", put.body.rec.sendAfter > Date.now() && put.body.rec.expiresAt - Date.now() <= 36 * 3_600_000 + 5000 && put.body.rec.expiresAt > put.body.rec.sendAfter, JSON.stringify(put.body.rec));
  ok("A5 · nudge_generated is counted (kind, reason, curriculum week)", (await beacons(p)).includes("nudge_generated"), JSON.stringify(await beacons(p)));
  pushCalls.length = 0; pushMode = "welding";
  await p.evaluate(() => { S.nudge.pending = null; }); const refused = await p.evaluate(() => nudgeSchedule("test"));
  ok("A6 · the server refuses (the account is not General English) → nothing kept on the device", refused === null && (await p.evaluate(() => S.nudge.pending)) === null, JSON.stringify(refused));
  pushMode = "ok"; await p.evaluate(() => nudgeSchedule("test"));
  /* the learner does the lesson before the notification */
  pushCalls.length = 0;
  const rid = await p.evaluate(() => S.nudge.pending.rid);
  await p.evaluate(() => { const pos = currentPos(); S.days[dayKey(pos.w, pos.d)] = true; markPracticed(); }); await sleep(600);
  const cancel = pushCalls.find(c => c.p === "/nudge/cancel");
  ok("A7 · done before it was sent → cancelled on the server (that rid), remembered as void", cancel && cancel.body.rid === rid && (await p.evaluate(r => S.nudge.doneRids.includes(r) && !S.nudge.pending, rid)), JSON.stringify(cancel));
  const cached = await p.evaluate(async () => { await remCacheText(); const r = await (await caches.open(REM_CACHE)).match(REM_KEY); return r ? r.json() : null; });
  ok("A8 · the service worker is told too: the void rid is in the reminder cache (nudgeDone), with the push Worker to ask", cached && cached.nudgeDone.includes(rid) && typeof cached.events !== "undefined" && cached.pushApi === "https://be-push.nore-ngou.workers.dev", JSON.stringify(cached && { d: cached.nudgeDone, p: cached.pushApi }));
  ok("A9 · … and counted as nudge_expired:invalidated", (await beacons(p)).includes("nudge_expired:invalidated"), JSON.stringify(await beacons(p)));
  const next = await p.evaluate(() => nudgeSchedule("test"));
  ok("A10 · practised today → the next best action is the 7 due words (practice / study-due)", next && next.kind === "words" && next.view === "practice" && next.act === "study-due", JSON.stringify(next));
  /* a tap arrives */
  await p.evaluate(() => { window.__beacons.length = 0; });
  const went = await p.evaluate(async r => { nudgeArrive({ rid: r.rid, kind: r.kind, view: r.view, act: r.act, args: r.args }, "push"); await new Promise(x => setTimeout(x, 700)); return { v: cur.v, tab: typeof _pracTab !== "undefined" ? _pracTab : null }; }, next);
  ok("A11 · the tap deep-links to the activity: Practice, word review started", went.v === "practice" && went.tab === "ready", JSON.stringify(went));
  const b1 = await beacons(p);
  ok("A12 · nudge_opened and nudge_accepted counted", b1.includes("nudge_opened") && b1.includes("nudge_accepted"), JSON.stringify(b1));
  await p.evaluate(() => markPracticed()); await sleep(200);
  const b2 = await beacons(p);
  ok("A13 · the first practice after the tap → nudge_started and nudge_practice (conversion)", b2.includes("nudge_started") && b2.includes("nudge_practice"), JSON.stringify(b2));
  await p.evaluate(() => { Object.values(S.vocab).forEach(v => { v.due = Date.now() + 9e9; }); nudgeInvalidate(); }); await sleep(200);
  ok("A14 · the recommended activity done (no words left due) → nudge_completed", (await beacons(p)).includes("nudge_completed"), JSON.stringify(await beacons(p)));
  await p.evaluate(() => nudgeConvPartner()); await sleep(100);
  ok("A15 · a partner practice after the tap → nudge_partner (once)", (await beacons(p)).filter(x => x === "nudge_partner").length === 1);
  const sess = await p.evaluate(async () => { nudgeGo({ view: "session", args: [2, "Tue"] }); await new Promise(x => setTimeout(x, 500)); return cur.v; });
  ok("A16 · a lesson nudge opens that session day", sess === "session", sess);
  const sh = await p.evaluate(async () => { nudgeGo({ view: "shadow", act: "trouble" }); await new Promise(x => setTimeout(x, 600)); return cur.v; });
  ok("A17 · a Shadow nudge opens Shadow", sh === "shadow", sh);
  const bad = await p.evaluate(() => nudgeGo({ view: "https://evil.example" }));
  ok("A18 · an unknown destination goes nowhere", bad === false);
  /* Settings */
  const sw = await p.evaluate(async () => { go("data"); await new Promise(x => setTimeout(x, 500)); const c = document.getElementById("nudgesOn"); return { has: !!c, on: c && c.checked }; });
  ok("A19 · Settings carries the switch, on by default", sw.has && sw.on, JSON.stringify(sw));
  /* something to be pending again: words due, a fresh history */
  const fresh = () => p.evaluate(() => { Object.values(S.vocab).forEach(v => { v.due = Date.now() - 1000; }); S.nudge.hist = { sent: {}, dismissed: {}, done: {} }; S.nudge.pending = null; return nudgeSchedule("test"); });
  const again = await fresh(); pushCalls.length = 0;
  await p.evaluate(() => nudgeToggle(false)); await sleep(300);
  ok("A20 · switching it off cancels what is pending and schedules nothing more", again && pushCalls.some(c => c.p === "/nudge/cancel") && (await p.evaluate(() => nudgeSchedule("test"))) === null && !pushCalls.some(c => c.p === "/nudge"), JSON.stringify(pushCalls.map(c => c.p)));
  await p.evaluate(() => nudgeToggle(true)); await sleep(500);   /* let the switch's own scheduling finish */
  /* switching to Welding */
  const again2 = await fresh(); pushCalls.length = 0;
  await p.evaluate(() => selectProfessionalTrack("welding")); await sleep(500);
  ok("A21 · switching the programme to Welding cancels the pending nudge", again2 && pushCalls.some(c => c.p === "/nudge/cancel") && (await p.evaluate(() => !S.nudge.pending)), JSON.stringify(pushCalls.map(c => c.p)));
  const envs = await p.evaluate(() => ({ stg: (beEnv("staging.lomonec.com") || {}).push, prod: beEnv("app.lomonec.com"), here: PUSH_API, staging: nudgeStaging(), panel: !!document.querySelector(".nudge-staging") }));
  ok("A23 · the staging host has its own push Worker (be-push-staging); production and this host keep production's; the staging test panel is absent here", envs.stg === "https://be-push-staging.nore-ngou.workers.dev" && envs.prod === null && envs.here === "https://be-push.nore-ngou.workers.dev" && !envs.staging && !envs.panel, JSON.stringify(envs));
  ok("A22 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# launch: retention, expiry, a tap on a closed app");
{
  const opened = { rid: "words-" + yday + "-x", kind: "words", view: "practice", act: "study-due", args: [], at: Date.now() - DAY - 3_600_000, started: true, completed: false, practice: true, partner: false, retained: false };
  const pending = { rid: "lesson-old", kind: "lesson", view: "session", args: [1, "Mon"], createdAt: Date.now() - 2 * DAY, sendAfter: Date.now() - 2 * DAY, expiresAt: Date.now() - DAY };
  const { ctx, p, errs } = await open("general-english", { nudge: { opened, pending, hist: { sent: {}, dismissed: {}, done: {} }, doneRids: [] } });
  await sleep(400); const bb = await beacons(p);
  ok("B1 · came back the next day after an opened nudge → nudge_retained:1d", bb.includes("nudge_retained:1d"), JSON.stringify(bb));
  ok("B2 · a pending nudge past its expiry → nudge_expired:expired, dropped", bb.includes("nudge_expired:expired") && (await p.evaluate(() => !S.nudge.pending)), JSON.stringify(bb));
  await ctx.close();
  const pend2 = { rid: "shadow-" + today + "-x", kind: "shadow", view: "shadow", act: "trouble", args: [], createdAt: Date.now(), sendAfter: Date.now(), expiresAt: Date.now() + DAY };
  const o2 = await open("general-english", { nudge: { pending: pend2, hist: { sent: {}, dismissed: {}, done: {} }, doneRids: [] } }, "?nudge=" + pend2.rid + "#shadow");
  await sleep(1200);
  const st = await o2.p.evaluate(() => ({ v: cur.v, opened: S.nudge.opened && S.nudge.opened.rid, url: location.search }));
  ok("B3 · a tap that opened the app (?nudge=rid) lands on the activity and is counted", st.v === "shadow" && st.opened === pend2.rid && !st.url && (await beacons(o2.p)).includes("nudge_opened"), JSON.stringify(st));
  ok("B4 · no JavaScript errors", !errs.length && !o2.errs.length, [...errs, ...o2.errs].join(" | "));
  await o2.ctx.close();
}

console.log("\n# Welding: no nudge, whatever is called");
{
  pushCalls.length = 0;
  const { ctx, p, errs } = await open("welding");
  const w = await p.evaluate(async () => ({ avail: nudgeAvailable(), sched: await nudgeSchedule("test"), sig: nudgeSignals().ge, arrive: nudgeArrive({ rid: "x-1234", kind: "words", view: "practice" }, "push") }));
  ok("W1 · Welding: not available, nothing scheduled, a forged arrival ignored", !w.avail && w.sched === null && !w.sig && w.arrive === false && !pushCalls.some(c => c.p === "/nudge"), JSON.stringify({ w, calls: pushCalls.map(c => c.p) }));
  const noSwitch = await p.evaluate(async () => { go("data"); await new Promise(x => setTimeout(x, 500)); return !document.getElementById("nudgesOn"); });
  ok("W2 · Welding Settings has no nudges switch", noSwitch);
  await p.evaluate(() => { window.__beacons.length = 0; ["nudge_generated", "nudge_opened", "nudge_practice"].forEach(n => track(n, { kind: "words" })); });
  await sleep(200);
  ok("W3 · nudge_* analytics are dropped on Welding", !(await beacons(p)).some(n => /^nudge_/.test(n)), JSON.stringify(await beacons(p)));
  ok("W4 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# the service worker");
{
  const src = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const mk = (cacheBody, why) => {
    const shown = [], fetched = [], handlers = {}, store = new Map();
    const cache = { match: async k => (k === "./__reminder__" ? { json: async () => cacheBody } : store.has(k) ? { json: async () => JSON.parse(store.get(k)) } : undefined), put: async (k, r) => { store.set(k, await r.text()); }, keys: async () => [] };
    const sandbox = { self: { addEventListener: (k, f) => { handlers[k] = f; }, registration: { showNotification: (t, o) => { shown.push({ t, o }); return Promise.resolve(); }, getNotifications: async () => [] }, skipWaiting: () => {}, clients: {} },
      caches: { open: async () => cache, keys: async () => [], delete: async () => true },
      fetch: async (u, init) => { fetched.push({ u: String(u), body: init && init.body }); return { ok: true, json: async () => (/\/why\?id=/.test(u) ? why : {}) }; },
      clients: { matchAll: async () => [] }, console, URL, Promise, setTimeout, Response, JSON, Date };
    new Function(...Object.keys(sandbox), src)(...Object.values(sandbox));
    const push = () => new Promise(r => handlers.push({ waitUntil: p => p.then(r) }));
    return { shown, fetched, handlers, store, push };
  };
  const cacheBody = { title: "Time to practise", body: "reminder body", pushId: "phone-test-0001", nudgeDone: ["words-done-1"], events: "https://be-events.test/e", lang: "en", dir: "ltr" };
  const good = { kind: "nudge", rid: "words-2026-09-26-x", nkind: "words", view: "practice", act: "study-due", args: [], title: "7 words to review", body: "🔁 7 words …", createdAt: Date.now(), expiresAt: Date.now() + DAY };
  let s = mk(cacheBody, good); await s.push();
  const n = s.shown[0];
  ok("SW1 · a nudge is shown with its own text, tag be-nudge, and a deep link (?nudge=rid#practice, act study-due)", n && n.t === "7 words to review" && n.o.tag === "be-nudge" && n.o.data.url === "./?nudge=words-2026-09-26-x#practice" && n.o.data.nudge.act === "study-due", JSON.stringify(n));
  ok("SW2 · nudge_sent is counted by the worker, and what it showed is recorded for the app", s.fetched.some(f => f.u === "https://be-events.test/e" && /nudge_sent/.test(f.body)) && JSON.parse(s.store.get("./__nudge_seen__")).last.rid === good.rid);
  s = mk(cacheBody, { ...good, rid: "words-done-1" }); await s.push();
  ok("SW3 · advice the learner already acted on (rid in nudgeDone) → the plain reminder instead, never stale advice", s.shown[0] && s.shown[0].t === "Time to practise" && s.shown[0].o.tag === "be-daily" && s.fetched.some(f => /nudge_expired/.test(f.body || "")), JSON.stringify(s.shown[0]));
  s = mk(cacheBody, { ...good, expiresAt: Date.now() - 1 }); await s.push();
  ok("SW4 · an expired nudge → the plain reminder", s.shown[0] && s.shown[0].o.tag === "be-daily");
  s = mk(cacheBody, good);
  await new Promise(r => s.handlers.notificationclose({ notification: { data: { nudge: { kind: "words", rid: good.rid }, pushId: "phone-test-0001" } }, waitUntil: p => p.then(r) }));
  const dis = s.fetched.find(f => /\/nudge\/dismiss$/.test(f.u));
  ok("SW5 · swiped away → be-push is told (that kind rests 7 days), nudge_dismissed counted, recorded for the app", dis && JSON.parse(dis.body).kind === "words" && s.fetched.some(f => /nudge_dismissed/.test(f.body || "")) && JSON.parse(s.store.get("./__nudge_seen__")).dismissed.words > 0, JSON.stringify(s.fetched));
  s = mk({ ...cacheBody, pushApi: "https://be-push-staging.test" }, good); await s.push();
  ok("SW7 · the worker asks the push Worker the app named (staging has its own), not a hard-coded one", s.fetched.some(f => f.u.startsWith("https://be-push-staging.test/why?id=")) && !s.fetched.some(f => /be-push\.nore-ngou/.test(f.u)), JSON.stringify(s.fetched.map(f => f.u)));
  s = mk({ ...cacheBody, pushApi: "https://be-push-staging.test" }, good);
  await new Promise(r => s.handlers.notificationclose({ notification: { data: { nudge: { kind: "words", rid: good.rid }, pushId: "phone-test-0001" } }, waitUntil: p => p.then(r) }));
  ok("SW8 · a swipe is reported to that same push Worker", s.fetched.some(f => f.u === "https://be-push-staging.test/nudge/dismiss"), JSON.stringify(s.fetched.map(f => f.u)));
  s = mk(cacheBody, { kind: "reminder" }); await s.push();
  ok("SW6 · the ordinary daily reminder is unchanged", s.shown[0] && s.shown[0].t === "Time to practise" && s.shown[0].o.tag === "be-daily");
}
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
