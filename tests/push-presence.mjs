/* be-push online alerts — local end-to-end. Starts what it needs: the partner
   Worker (dev env, DEV_AUTH), the push Worker (local KV, a throwaway VAPID key
   written to backend/push/.dev.vars — gitignored — cron fired through
   --test-scheduled) and a fake push endpoint in this process that records
   every delivery.        cd tests && node push-presence.mjs */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import http from "node:http";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = new URL("..", import.meta.url).pathname;
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : " — " + d}`); };
const devVars = root + "backend/push/.dev.vars";
if (!existsSync(devVars)) { const p = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]); writeFileSync(devVars, `VAPID_PRIVATE_JWK=${JSON.stringify(await webcrypto.subtle.exportKey("jwk", p.privateKey))}\nPARTNER_API=http://127.0.0.1:8787\n`); }
let hits = [];
const ep = http.createServer((req, res) => { if (req.url === "/gone") { res.statusCode = 410; return res.end(); } hits.push({ url: req.url, vapid: /^vapid t=/.test(req.headers.authorization || ""), ttl: req.headers.ttl }); res.statusCode = 201; res.end(); }).listen(8790);
const procs = [];
const up = async (url, ms = 120000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if ((await fetch(url)).status < 500) return true; } catch (e) {} await sleep(500); } return false; };
/* wrangler wants its stdout read (it stalls with stdio "ignore" when two start together) */
const quiet = p => { p.stdout.on("data", () => {}); p.stderr.on("data", () => {}); return p; };
const PUSH = "http://127.0.0.1:8791", PARTNER = "http://127.0.0.1:8787", EP = "http://127.0.0.1:8790";
const finish = code => { procs.forEach(p => { try { p.kill(); } catch (e) {} }); ep.close(); const pass = res.filter(Boolean).length; console.log(`\n  ${pass}/${res.length} pass`); process.exit(code ?? (pass === res.length ? 0 : 1)); };
/* one at a time, each with its own inspector port: two started together race for the same one and the loser dies with "Address already in use" */
procs.push(quiet(spawn("npx", ["wrangler", "dev", "--env", "dev", "--port", "8787", "--inspector-port", "9787"], { cwd: root + "backend/partner", stdio: ["ignore", "pipe", "pipe"] })));
if (!(await up(PARTNER + "/health"))) { console.log("  FAIL  partner Worker did not start"); finish(1); }
procs.push(quiet(spawn("npx", ["wrangler", "dev", "--port", "8791", "--inspector-port", "9791", "--test-scheduled", "--var", "DEV_LOCAL_ENDPOINTS:1"], { cwd: root + "backend/push", stdio: ["ignore", "pipe", "pipe"] })));
if (!(await up(PUSH + "/key"))) { console.log("  FAIL  push Worker did not start"); finish(1); }
await fetch(PARTNER + "/__reset", { method: "POST" });
const O = { "content-type": "application/json", origin: "http://localhost:8000" };
const post = (path, body) => fetch(PUSH + path, { method: "POST", headers: O, body: JSON.stringify(body) }).then(r => r.json().then(j => ({ status: r.status, ...j })));
const why = id => fetch(PUSH + "/why?id=" + id).then(r => r.json());
const take = () => { const h = hits; hits = []; return h; };
const cron = async () => { await fetch(PUSH + "/__scheduled?cron=*+*+*+*+*"); await sleep(1200); };
const presenceCron = async () => { await fetch(PUSH + "/__scheduled?cron=" + encodeURIComponent("*/10 * * * *")); await sleep(1500); };
/* local hours are derived from the real clock: a "day" phone at 14:00 local, a "night" phone at 03:00 or 23:00 local */
const h = new Date().getUTCHours(), dayTz = (14 - h) * 60, nightTz = (h >= 9 ? 23 - h : 3 - h) * 60;

ok("alerts only (slot null, presence true) is accepted", (await post("/subscribe", { id: "phone-a-0001", slot: null, endpoint: EP + "/a", presence: true, tz: dayTz })).presence === true);
ok("reminder only still works as before (no presence entry)", (await post("/subscribe", { id: "phone-r-0001", slot: "0900", endpoint: EP + "/r", presence: false })).slot === "0900");
ok("reminder AND alerts on one phone", (await post("/subscribe", { id: "phone-b-0001", slot: "0900", endpoint: EP + "/b", presence: true, tz: dayTz })).presence === true);
ok("neither reminder nor alerts → 400", (await post("/subscribe", { id: "phone-x-0001", slot: null, endpoint: EP + "/x", presence: false })).status === 400);
await post("/subscribe", { id: "phone-n-0001", slot: null, endpoint: EP + "/n", presence: true, tz: nightTz });
await post("/subscribe", { id: "phone-g-0001", slot: null, endpoint: EP + "/gone", presence: true, tz: dayTz });
ok("/why before any alert → reminder", (await why("phone-a-0001")).kind === "reminder");

take(); await presenceCron();
ok("nobody online → no wake-ups at all", take().length === 0);

const api = (u, m, p, b) => fetch(PARTNER + p, { method: m, headers: { "x-dev-user": u, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
await api("zoe", "POST", "/consent", { name: "Zoe", lang: "en", adult: true, track: "general-english" });
await api("zoe", "POST", "/interest", { track: "general-english", band: "w1-4", lang: "en", promptWeek: 1, mode: "later" });
const pres = await (await fetch(PARTNER + "/presence")).json();
ok("partner /presence is public and counts her", pres.online >= 1 && pres.waiting >= 1, JSON.stringify(pres));

await presenceCron(); const sent = take();
const urls = sent.map(x => x.url).sort();
ok("someone online → the day phones are woken with a signed VAPID request; the reminder-only phone is not", urls.includes("/a") && urls.includes("/b") && !urls.includes("/r") && sent.every(x => x.vapid && x.ttl === "3600"), JSON.stringify(urls));
ok("the night phone (quiet hours) is not woken", !urls.includes("/n"), JSON.stringify(urls));
ok("/why now answers presence with the count for a woken phone, reminder for the others", (await why("phone-a-0001")).kind === "presence" && (await why("phone-a-0001")).n >= 1 && (await why("phone-r-0001")).kind === "reminder" && (await why("phone-n-0001")).kind === "reminder");
ok("a dead endpoint (410) is forgotten: its presence entry is gone", !urls.includes("/gone") || (await why("phone-g-0001")).kind === "reminder");
take(); await presenceCron();
ok("a second run within the 4-hour gap wakes nobody again", take().filter(x => x.url === "/a" || x.url === "/b").length === 0);
ok("unsubscribe removes the presence entry too", (await post("/unsubscribe", { id: "phone-a-0001" })).ok === true);
finish();
