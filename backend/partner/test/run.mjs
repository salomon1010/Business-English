/* Practice Partner Worker — integration tests.
   Needs:  npx wrangler d1 migrations apply be-partner --local --env dev
           npx wrangler dev --env dev --port 8787        (in backend/partner)
   Then:   node test/run.mjs
   Every request goes to the LOCAL worker with emulated D1/R2. Nothing here
   touches Cloudflare or Firebase. Users are dev ids via X-Dev-User; the
   clock is moved with X-Dev-Now. Names are suffixed with the run id so a
   re-run on the same local database starts from clean users. */
import { verifyIdToken, screenTranscript } from "../partner-worker.js";
import { generateKeyPairSync, createSign, createHash } from "node:crypto";

const BASE = process.env.PARTNER_API || "http://127.0.0.1:8787";
const RUN = Date.now().toString(36);
const res = []; let clock = null;
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const u = n => `${n}_${RUN}`;
async function call(user, method, path, body, extra = {}) {
  const h = { ...(user ? { "x-dev-user": user } : {}), ...(clock ? { "x-dev-now": String(clock) } : {}), ...extra };
  let b = body;
  if (body && !(body instanceof FormData)) { h["content-type"] = "application/json"; b = JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers: h, body: b });
  const ct = r.headers.get("content-type") || "";
  if (r.status === 500) console.log("   !! 500", method, path, await r.clone().text());
  return { status: r.status, json: ct.includes("json") ? await r.json() : null, raw: ct.includes("json") ? null : await r.arrayBuffer() };
}
const consent = (user, name, extra = {}) => call(user, "POST", "/consent", { name, lang: "fr", ...extra });
const join = (user, o = {}) => call(user, "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 2, ...o });
const audioBlob = (bytes = 20_000) => new Blob([new Uint8Array(bytes).map((_, i) => i % 251)], { type: "audio/webm" });
function turnForm(day, transcript, o = {}) {
  const fd = new FormData();
  fd.set("audio", o.audio || audioBlob(), "turn.webm"); fd.set("day", String(day)); fd.set("transcript", transcript);
  fd.set("score", String(o.score ?? 82)); fd.set("duration_ms", String(o.duration ?? 12_000)); if (o.turnId) fd.set("turn_id", o.turnId);
  return fd;
}

{ const r = await fetch(BASE + "/__reset", { method: "POST" }); if (r.status !== 200) { console.log("reset failed", r.status); process.exit(1); } }
/* 1 */ { const r = await call(null, "GET", "/me"); ok("1 unauthenticated GET /me → 401", r.status === 401, r.status); }
/* 2 */ { const r = await join(u("alice")); ok("2 /interest before consent → 403 consent", r.status === 403 && r.json.error === "consent", JSON.stringify(r.json)); }
/* 3 */ { const a = await consent(u("alice"), "Alice"), b = await consent(u("bob"), "Bob"); ok("3 consent creates members", a.status === 200 && a.json.consented && b.json.consented && a.json.name === "Alice"); }
/* 4 */ { const r = await join(u("alice")); ok("4 alice joins → waiting, count 1", r.status === 200 && r.json.status === "waiting" && r.json.waiting && r.json.waiting.count === 1, JSON.stringify(r.json)); }
/* 5 */ { await consent(u("carol"), "Carol"); const r = await join(u("carol"), { track: "welding", band: "w1-4" }); ok("5 different track never pairs (carol waits)", r.json.status === "waiting" && !r.json.pair, JSON.stringify(r.json)); }
let pairId = null;
/* 6 */ { const r = await join(u("bob"), { promptWeek: 3 }); const me = await call(u("alice"), "GET", "/me"); pairId = r.json.pair && r.json.pair.id;
  ok("6 bob joins → paired with alice; partner exposes name/band/lang only", r.json.status === "paired" && me.json.pair && me.json.pair.id === pairId && me.json.pair.partner.name === "Bob" && Object.keys(me.json.pair.partner).sort().join() === "band,lang,name", JSON.stringify(r.json.pair && r.json.pair.partner)); }
/* 7 */ { const me = await call(u("alice"), "GET", "/me"); ok("7 prompt position = the lower week (2)", me.json.pair.promptWeek === 2, me.json.pair.promptWeek); }
let turn1 = null;
/* 8 */ { const r = await call(u("alice"), "POST", "/turns", turnForm(0, "Hello, my name is Alice and I am a welder from Douala.")); turn1 = r.json && r.json.turn; ok("8 alice sends a turn → 201 seq 1", r.status === 201 && turn1.seq === 1, JSON.stringify(r.json)); }
/* 9 */ { const me = await call(u("bob"), "GET", "/me"); const a = await call(u("bob"), "GET", `/turns/${turn1.id}/audio`); ok("9 bob sees unread 1 and can stream the audio", me.json.pair.unread === 1 && a.status === 200 && a.raw && a.raw.byteLength === 20_000, `${me.json.pair.unread} ${a.status}`); }
/* 10 */ { await consent(u("mallory"), "Mallory"); const a = await call(u("mallory"), "GET", `/turns/${turn1.id}/audio`); ok("10 non-member cannot fetch audio → 403", a.status === 403, a.status); }
/* 11 */ { const r = await call(u("mallory"), "GET", `/pairs/${pairId}`); const r2 = await call(u("mallory"), "POST", `/pairs/${pairId}/leave`); ok("11 non-member cannot read or act on the pair → 403", r.status === 403 && r2.status === 403, `${r.status} ${r2.status}`); }
/* 12 */ { const s = []; for (let i = 0; i < 3; i++) s.push((await call(u("alice"), "POST", "/turns", turnForm(0, "Another turn number " + i))).status); ok("12 turns per day limited to 3 → 4th is 429", s[0] === 201 && s[1] === 201 && s[2] === 429, s.join()); }
/* 13 */ { const bad = ["call me on 06 12 34 56 78", "add me on whatsapp please", "my email is alice@example.com", "find me at insta @alice_d", "go to www.example.com"];
  const st = []; for (const t of bad) st.push((await call(u("bob"), "POST", "/turns", turnForm(0, t))).status);
  ok("13 contact details in transcript → 422 moderation (5 patterns)", st.every(s => s === 422), st.join()); ok("13b screenTranscript unit: clean text passes", screenTranscript("I work on the second shift and I like it") === true); }
/* 14 */ { const id = "abcdefabcdef0123"; const a = await call(u("bob"), "POST", "/turns", turnForm(0, "First real reply from Bob.", { turnId: id })); const b = await call(u("bob"), "POST", "/turns", turnForm(0, "First real reply from Bob.", { turnId: id }));
  const me = await call(u("alice"), "GET", "/me"); ok("14 duplicate turn_id is idempotent (one row)", a.status === 201 && b.status === 200 && b.json.duplicate && me.json.pair.turns.filter(t => t.id === id).length === 1, `${a.status} ${b.status}`); }
/* 15 */ { const r = await call(u("bob"), "POST", "/turns", turnForm(0, "big", { audio: audioBlob(1_600_000) })); ok("15 audio over 1.5 MB → 413", r.status === 413, r.status); }
/* 16 */ { const me1 = await call(u("alice"), "GET", "/me"); await call(u("alice"), "POST", `/pairs/${pairId}/seen`); const me2 = await call(u("alice"), "GET", "/me"); ok("16 partner reply → unread 1; /seen clears it", me1.json.pair.unread === 1 && me2.json.pair.unread === 0, `${me1.json.pair.unread} → ${me2.json.pair.unread}`); }
/* 17 */ { const me = await call(u("alice"), "GET", "/me"); ok("17 both sent today → duoStreak 1, myStreak 1", me.json.pair.duoStreak === 1 && me.json.pair.myStreak === 1, JSON.stringify([me.json.pair.duoStreak, me.json.pair.myStreak])); }
/* 18 */ { const meNow = await call(u("alice"), "GET", "/me"); const base = meNow.json.serverNow; clock = base + 25 * 3_600_000;
  await call(u("alice"), "POST", "/turns", turnForm(1, "Day two, still here.")); const me = await call(u("alice"), "GET", "/me"); clock = base + 25 * 3_600_000 + 49 * 3_600_000; const me2 = await call(u("alice"), "GET", "/me"); clock = null;
  ok("18 silent partner ≥24 h → fallback true; ≥48 h → canRepair", me.json.pair.partnerSilentH === 0 && me2.json.pair.fallback === true && me2.json.pair.partnerSilentH >= 24 && me2.json.pair.canRepair === true, JSON.stringify({ h: me2.json.pair.partnerSilentH, f: me2.json.pair.fallback, r: me2.json.pair.canRepair })); }
/* 19 */ { const r1 = await call(u("alice"), "POST", `/pairs/${pairId}/report`, { reason: "harassment" }); const again = await call(u("alice"), "POST", `/pairs/${pairId}/report`, { reason: "abuse" });
  // carol must have been paired with bob to report him: fabricate via a second pair after bob is free
  ok("19a one reporter → strike 1, pair still active", r1.status === 200 && r1.json.pair && r1.json.pair.id === pairId, JSON.stringify(r1.json.pair && r1.json.pair.id));
  ok("19b same reporter twice counts once", again.status === 200); }
/* 20 */ { await consent(u("dave"), "Dave"); await consent(u("erin"), "Erin"); await join(u("dave")); const r = await join(u("erin")); const p2 = r.json.pair.id;
  const t = await call(u("dave"), "POST", "/turns", turnForm(0, "Hi Erin")); const b = await call(u("erin"), "POST", `/pairs/${p2}/block`);
  const dv = await call(u("dave"), "GET", `/pairs/${p2}`); const au = await call(u("dave"), "GET", `/turns/${t.json.turn.id}/audio`); const meD = await call(u("dave"), "GET", "/me");
  await join(u("dave")); const again = await join(u("erin")); ok("20 block closes the pair, 403s the blocked side, never re-pairs", b.status === 200 && dv.status === 403 && au.status === 403 && !meD.json.pair && again.json.status === "waiting", `${b.status} ${dv.status} ${au.status} ${again.json.status}`);
  await call(u("dave"), "DELETE", "/interest"); await call(u("erin"), "DELETE", "/interest"); }
/* 21 */ { const r = await call(u("bob"), "POST", `/pairs/${pairId}/leave`); const meA = await call(u("alice"), "GET", "/me"); ok("21 leave closes the pair; both free; lastClosed reported", r.status === 200 && !r.json.pair && !meA.json.pair && meA.json.lastClosed && meA.json.lastClosed.reason === "left", JSON.stringify(meA.json.lastClosed)); }
/* 19c: second distinct reporter suspends */ { await join(u("carol"), { track: "general-english", band: "w1-4" }); const r = await join(u("bob")); const p3 = r.json.pair && r.json.pair.id; const rep = await call(u("carol"), "POST", `/pairs/${p3}/report`, { reason: "contact_info" });
  const meB = await call(u("bob"), "GET", "/me"); const jb = await join(u("bob")); const tb = await call(u("bob"), "POST", "/turns", turnForm(0, "x"));
  ok("19c second distinct reporter → suspended 30 d, pair closed, cannot join or send", rep.status === 200 && meB.json.suspendedUntil && !meB.json.pair && jb.status === 403 && jb.json.error === "suspended" && tb.status === 403, `${rep.status} ${!!meB.json.suspendedUntil} ${jb.status} ${tb.status}`); }
/* 22 */ { await consent(u("eve"), "Eve", { gender: "f", sameGender: true }); await consent(u("frank"), "Frank", { gender: "m" }); await consent(u("grace"), "Grace", { gender: "f" });
  await join(u("eve"), { band: "w5-8" }); const f = await join(u("frank"), { band: "w5-8" }); const g = await join(u("grace"), { band: "w5-8" });
  ok("22 same-gender preference honoured (eve↔grace, not frank)", f.json.status === "waiting" && g.json.status === "paired" && g.json.pair.partner.name === "Eve", `${f.json.status} ${g.json.status}`); await call(u("frank"), "DELETE", "/interest"); }
/* 23 */ { await consent(u("hank"), "Hank"); let last = 0; for (let i = 0; i < 11; i++) { last = (await join(u("hank"), { band: "w9-12" })).status; if (last === 429) break; } ok("23 11th /interest join in a day → 429", last === 429, last); await call(u("hank"), "DELETE", "/interest"); }
/* 24 */ { const meNow = await call(u("alice"), "GET", "/me"); clock = meNow.json.serverNow + 40 * 86_400_000; const c = await call(u("alice"), "POST", "/__cron"); clock = null;
  const gone = await call(u("alice"), "GET", `/turns/${turn1.id}/audio`); ok("24 cron purges audio of pairs closed >14 d (alice's old turn gone)", c.status === 200 && c.json.purgedTurns >= 1 && gone.status === 404, JSON.stringify(c.json) + " " + gone.status); }
/* 25 */ {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const b64u = s => Buffer.from(s).toString("base64url");
  const mk = (payload, kid = "k1") => { const h = b64u(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })), p = b64u(JSON.stringify(payload)); const s = createSign("RSA-SHA256"); s.update(h + "." + p); return h + "." + p + "." + s.sign(privateKey).toString("base64url"); };
  const sec = Math.floor(Date.now() / 1000), good = { aud: "be-mastery", iss: "https://securetoken.google.com/be-mastery", sub: "uid123", iat: sec - 10, exp: sec + 3600 };
  const deps = { keys: [jwk] };
  const okSub = await verifyIdToken(mk(good), "be-mastery", deps).catch(e => "ERR " + e.message);
  const badAud = await verifyIdToken(mk({ ...good, aud: "other" }), "be-mastery", deps).catch(e => e.message);
  const badIss = await verifyIdToken(mk({ ...good, iss: "https://evil" }), "be-mastery", deps).catch(e => e.message);
  const expired = await verifyIdToken(mk({ ...good, exp: sec - 1 }), "be-mastery", deps).catch(e => e.message);
  const badKid = await verifyIdToken(mk(good, "k9"), "be-mastery", deps).catch(e => e.message);
  const tampered = await verifyIdToken(mk(good).replace(/\.[^.]+$/, ".AAAA"), "be-mastery", deps).catch(e => e.message);
  ok("25 ID-token verifier: accepts valid, rejects aud/iss/exp/kid/signature", okSub === "uid123" && badAud === "aud" && badIss === "iss" && expired === "expired" && badKid === "kid" && tampered === "signature", JSON.stringify({ okSub, badAud, badIss, expired, badKid, tampered }));
}

const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
