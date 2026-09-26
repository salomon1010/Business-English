/* Invitations ring a closed app (owner, 2026-09-26) — local end-to-end.
   Starts the partner Worker (dev, PUSH_API → the local push Worker, a test
   PUSH_SECRET), the push Worker (local KV, throwaway VAPID key in
   backend/push/.dev.vars, the same secret) and a fake push endpoint that
   records every delivery. Then: a phone registers for calls, its learner is
   invited to a practice and to a live call, and the phone is woken with the
   right "why" — once. Finally sw.js's push handler is run in a sandbox: an
   app in front is told and not notified; a closed app gets a call-style
   notification.                      cd tests && node push-invite.mjs */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import http from "node:http";
import vm from "node:vm";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = new URL("..", import.meta.url).pathname;
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : " — " + d}`); };
const devVars = root + "backend/push/.dev.vars";
if (!existsSync(devVars)) { const p = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]); writeFileSync(devVars, `VAPID_PRIVATE_JWK=${JSON.stringify(await webcrypto.subtle.exportKey("jwk", p.privateKey))}\n`); }
let hits = [];
const ep = http.createServer((req, res) => { hits.push({ url: req.url, vapid: /^vapid t=/.test(req.headers.authorization || ""), ttl: req.headers.ttl, urgency: req.headers.urgency }); res.statusCode = 201; res.end(); });
await new Promise(r => ep.listen(8793, "127.0.0.1", r));
const procs = [];
const up = async (url, ms = 120000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if ((await fetch(url)).status < 500) return true; } catch (e) {} await sleep(500); } return false; };
const quiet = p => { p.stdout.on("data", () => {}); p.stderr.on("data", () => {}); return p; };
const PUSH = "http://127.0.0.1:8792", PARTNER = "http://127.0.0.1:8798", EP = "http://127.0.0.1:8793", SECRET = "test-secret-1";
const finish = code => { procs.forEach(p => { try { p.kill(); } catch (e) {} }); ep.close(); const pass = res.filter(Boolean).length; console.log(`\n  ${pass}/${res.length} pass`); process.exit(code ?? (pass === res.length ? 0 : 1)); };
procs.push(quiet(spawn("npx", ["wrangler", "dev", "--env", "dev", "--port", "8798", "--inspector-port", "9798", "--var", "PUSH_API:" + PUSH, "--var", "PUSH_SECRET:" + SECRET], { cwd: root + "backend/partner", stdio: ["ignore", "pipe", "pipe"] })));
if (!(await up(PARTNER + "/health"))) { console.log("  FAIL  partner Worker did not start"); finish(1); }
procs.push(quiet(spawn("npx", ["wrangler", "dev", "--port", "8792", "--inspector-port", "9792", "--var", "DEV_LOCAL_ENDPOINTS:1", "--var", "PUSH_SECRET:" + SECRET], { cwd: root + "backend/push", stdio: ["ignore", "pipe", "pipe"] })));
if (!(await up(PUSH + "/key"))) { console.log("  FAIL  push Worker did not start"); finish(1); }
await fetch(PARTNER + "/__reset", { method: "POST" });
const O = { "content-type": "application/json", origin: "http://localhost:8000" };
const post = (path, body, headers = O) => fetch(PUSH + path, { method: "POST", headers, body: JSON.stringify(body) }).then(r => r.json().then(j => ({ status: r.status, ...j })));
const why = id => fetch(PUSH + "/why?id=" + id).then(r => r.json());
const take = () => { const h = hits; hits = []; return h; };
const api = (u, m, p, b) => fetch(PARTNER + p, { method: m, headers: { "x-dev-user": u, ...(b ? { "content-type": "application/json" } : {}) }, body: b ? JSON.stringify(b) : undefined });
const wakes = () => fetch(PARTNER + "/__wakes").then(r => r.json()).then(j => j.wakes);

/* ---- push Worker: registration and the wake route ---- */
ok("A phone can register for invitation wake-ups alone (no reminder, no online alerts)", (await post("/subscribe", { id: "phone-bob-0001", slot: null, endpoint: EP + "/bob", calls: true, tz: 0 })).calls === true);
ok("/wake without the secret is refused (403) — the Origin is not the check", (await post("/wake", { id: "phone-bob-0001", kind: "live", name: "Alice" })).status === 403);
ok("/wake with the secret but a bad kind is 400", (await post("/wake", { secret: SECRET, id: "phone-bob-0001", kind: "spam", name: "Alice" })).status === 400);
ok("/wake for a phone that never registered is 404", (await post("/wake", { secret: SECRET, id: "phone-nobody-01", kind: "live", name: "Alice" })).status === 404);
{ take(); const r = await post("/wake", { secret: SECRET, id: "phone-bob-0001", kind: "live", name: "Alice", ref: "a1b2c3d4e5f6a7b8" }); await sleep(300); const h = take();
  ok("/wake sends ONE bare push with a VAPID header, high urgency and a 10-minute TTL", r.ok === true && h.length === 1 && h[0].url === "/bob" && h[0].vapid && h[0].urgency === "high" && h[0].ttl === "600", JSON.stringify({ r, h })); }
{ const w1 = await why("phone-bob-0001"), w2 = await why("phone-bob-0001");
  ok("The service worker learns why (live, Alice, the session id) — and only once; the next ask is a plain reminder", w1.kind === "live" && w1.name === "Alice" && w1.ref === "a1b2c3d4e5f6a7b8" && w2.kind === "reminder", JSON.stringify([w1, w2])); }
ok("A second wake within 20 s is held back (429), so a burst of invitations cannot ring a phone over and over", (await post("/wake", { secret: SECRET, id: "phone-bob-0001", kind: "trial", name: "Alice" })).status === 429);
{ const r = await post("/subscribe", { id: "phone-eve-0001", slot: "0900", endpoint: EP + "/eve", presence: false, calls: false }); const w = await post("/wake", { secret: SECRET, id: "phone-eve-0001", kind: "live", name: "Alice" });
  ok("A phone with the reminder only (calls off) is never rung", r.slot === "0900" && w.status === 404); }

/* ---- partner Worker: the invitation wakes the invitee ---- */
for (const [u, n] of [["alice", "Alice"], ["bob", "Bob"]]) {
  await api(u, "POST", "/consent", { name: n, lang: "fr", adult: true, gender: "f", goals: ["workplace"], avail: ["evening"], tz: 0 });
  await api(u, "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1, goals: ["workplace"] });
}
await api("bob", "GET", "/me?push=phone-bob-0002");   /* Bob's phone identifies itself on its ordinary /me call */
await post("/subscribe", { id: "phone-bob-0002", slot: null, endpoint: EP + "/bob2", calls: true, tz: 0 });
ok("The app's ?push= on /me is remembered on the member (no header, so an older Worker ignores it harmlessly)", (await wakes()).length === 0);
const match = await (await api("alice", "POST", "/match", {})).json();
const offer = (match.candidates || []).find(c => c.name === "Bob");
take(); await api("alice", "POST", "/invite", { offer: offer && offer.offer }); await sleep(800);
{ const w = await wakes(), h = take(), y = await why("phone-bob-0002");
  ok("Try a practice → Bob's phone is woken as 'trial' with Alice's first name; the push reached the endpoint", w.length === 1 && /bob$/.test(w[0].uid) && w[0].kind === "trial" && w[0].name === "Alice" && w[0].id === "phone-bob-0002" && h.length === 1 && h[0].url === "/bob2" && y.kind === "trial" && y.name === "Alice", JSON.stringify({ w, h, y })); }
ok("Alice's own phone is not woken by her own invitation", (await wakes()).every(w => /bob$/.test(w.uid)));
const bobInv = (await (await api("bob", "GET", "/me")).json()).invite;
await api("bob", "POST", `/pairs/${bobInv.id}/accept`);
await sleep(21000);   /* past the per-phone gap */
take(); await api("alice", "POST", "/live", { band: "w1-4", promptWeek: 1 }); await sleep(800);
{ const w = await wakes(), h = take(), y = await why("phone-bob-0002");
  ok("Practise live → Bob's phone is woken as 'live' with the session id; why says live / Alice", w.length === 2 && w[1].kind === "live" && /bob$/.test(w[1].uid) && /^[a-f0-9]{16}$/.test(w[1].ref) && h.length === 1 && y.kind === "live" && y.name === "Alice" && y.ref === w[1].ref, JSON.stringify({ w, h, y })); }
{ const lv = (await (await api("alice", "GET", "/me")).json()).live; await api("alice", "POST", `/live/${lv.id}/cancel`); await api("alice", "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1 }); }
ok("A learner whose phone never sent a push id is simply not woken (Alice invited by Bob)", await (async () => { await api("bob", "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1 }); const m = await (await api("bob", "POST", "/match", {})).json(); const o = (m.candidates || []).find(c => c.name === "Alice"); const before = (await wakes()).length; await api("bob", "POST", "/invite", { offer: o && o.offer }); await sleep(500); return (await wakes()).length === before; })());

/* ---- sw.js: the push handler in a sandbox ---- */
const sw = readFileSync(root + "sw.js", "utf8");
async function runSw(whyAnswer, clientList, dismissAfter) {
  const handlers = {}, shown = [], posted = [];
  const doc = { title: "T", body: "B", pushId: "phone-bob-0002", lang: "fr", dir: "ltr", online: { title: "Online", body: "{{n}} online" }, call: { live: { title: "{{name}} veut pratiquer en direct avec vous", body: "Un appel vocal…" }, trial: { title: "{{name}} vous invite", body: "Quatre tours…" } } };
  const self = { addEventListener: (k, f) => { handlers[k] = f; }, registration: { showNotification: async (t, o) => { shown.push({ t, o }); }, getNotifications: async () => (dismissAfter && shown.length >= dismissAfter ? [] : shown.map(x => ({ tag: x.o.tag }))) }, location: { href: "http://x/sw.js" }, skipWaiting() {}, clients: {} };
  const clients = { matchAll: async () => clientList.map(c => ({ ...c, postMessage: m => posted.push(m) })), claim: async () => {} };
  const ctx = { self, clients, caches: { open: async () => ({ match: async () => ({ json: async () => doc }), keys: async () => [] }) }, fetch: async () => ({ ok: true, json: async () => whyAnswer }), Response, URL, console, setTimeout: (f, ms) => setTimeout(f, ms >= 1000 ? 40 : ms), Promise };   /* the 8-s gaps run at 40 ms here */
  vm.runInNewContext(sw, ctx);
  let done; const ev = { waitUntil: p => { done = p; } }; handlers.push(ev); await done;
  return { shown, posted };
}
{ const r = await runSw({ kind: "live", name: "Alice", ref: "a1b2c3d4e5f6a7b8" }, []);
  ok("App closed, live invitation → an ordinary notification in the learner's language, repeated three times (same card, re-alerted), short vibration, not a call that stays up; tap lands on the partner page", r.shown.length === 3 && r.shown.every(x => x.t === "Alice veut pratiquer en direct avec vous" && x.o.tag === "be-partner-call" && x.o.renotify === true && !x.o.requireInteraction && x.o.vibrate.length === 3 && x.o.data.view === "partner" && x.o.lang === "fr"), JSON.stringify(r.shown)); }
{ const r = await runSw({ kind: "live", name: "Alice" }, [], 1);
  ok("Swiped away or tapped after the first alert → no repeat", r.shown.length === 1, JSON.stringify(r.shown.length)); }
{ const r = await runSw({ kind: "trial", name: "Alice" }, [{ focused: false, visibilityState: "hidden" }]);
  ok("App open in the background, practice invitation → the page is told AND the notification shows (the page cannot ring while hidden)", r.shown.length === 3 && r.shown[0].t === "Alice vous invite" && r.posted.length === 1 && r.posted[0].type === "partner-invite" && r.posted[0].kind === "trial", JSON.stringify(r)); }
{ const r = await runSw({ kind: "live", name: "Alice" }, [{ focused: true, visibilityState: "visible" }]);
  ok("App in front → the page is told (it rings itself) and NO notification is raised", r.shown.length === 0 && r.posted.length === 1 && r.posted[0].kind === "live", JSON.stringify(r)); }
{ const r = await runSw({ kind: "presence", n: 3 }, []);
  ok("The online-learners push still shows as before", r.shown.length === 1 && r.shown[0].t === "Online" && r.shown[0].o.body === "3 online", JSON.stringify(r.shown)); }
{ const r = await runSw({ kind: "reminder" }, []);
  ok("The daily reminder still shows as before", r.shown.length === 1 && r.shown[0].t === "T" && r.shown[0].o.tag === "be-daily", JSON.stringify(r.shown)); }
finish();
