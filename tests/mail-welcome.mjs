/* be-mail /welcome — local end-to-end. This process plays Google (JWKS,
   OAuth token, accounts:lookup) and Brevo on one port; the mail Worker runs
   under wrangler dev with those URLs pointed here and throwaway secrets in
   backend/mail/.dev.vars (gitignored). A token signed by a key generated
   here proves the caller.        cd tests && node mail-welcome.mjs */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { webcrypto as wc } from "node:crypto";
import http from "node:http";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = new URL("..", import.meta.url).pathname;
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : " — " + d}`); };
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* keys: one RSA pair "Google" signs ID tokens with; one RSA pair as the service account */
const idKey = await wc.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pubJwk = { ...(await wc.subtle.exportKey("jwk", idKey.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
const saKey = await wc.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const saPem = "-----BEGIN PRIVATE KEY-----\n" + Buffer.from(await wc.subtle.exportKey("pkcs8", saKey.privateKey)).toString("base64").match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----\n";
const token = async (claims, kid = "k1") => { const h = b64u(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })), p = b64u(JSON.stringify(claims)); const sig = await wc.subtle.sign("RSASSA-PKCS1-v1_5", idKey.privateKey, Buffer.from(h + "." + p)); return h + "." + p + "." + b64u(sig); };
const now = Math.floor(Date.now() / 1000);
const good = uid => ({ aud: "be-mastery", iss: "https://securetoken.google.com/be-mastery", sub: uid, user_id: uid, email: uid + "@example.com", iat: now - 5, exp: now + 3600 });

/* the stub: users and what Brevo received */
const users = { fresh: { localId: "fresh", email: "fresh@example.com", createdAt: String(Date.now() - 60e3) }, old: { localId: "old", email: "old@example.com", createdAt: String(Date.now() - 2 * 86400e3) } };
const mails = [];
const stub = http.createServer((req, res) => { let b = ""; req.on("data", d => b += d); req.on("end", () => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/jwks") return res.end(JSON.stringify({ keys: [pubJwk] }));
  if (req.url === "/token") return res.end(JSON.stringify({ access_token: "sa-token", expires_in: 3600 }));
  if (req.url === "/idtk/accounts:lookup") { const j = JSON.parse(b || "{}"); const u = users[(j.localId || [])[0]]; return res.end(JSON.stringify(u ? { users: [u] } : {})); }
  if (req.url === "/brevo") { const j = JSON.parse(b); if ((req.headers["api-key"] || "") !== "brevo-test-key") { res.statusCode = 401; return res.end('{"code":"unauthorized"}'); } mails.push(j); res.statusCode = 201; return res.end(JSON.stringify({ messageId: "<m" + mails.length + ">" })); }
  res.statusCode = 404; res.end("{}"); }); }).listen(8793);
const S = "http://127.0.0.1:8793";
writeFileSync(root + "backend/mail/.dev.vars", `FB_SA_JSON=${JSON.stringify({ client_email: "sa@be-mastery.iam.gserviceaccount.com", private_key: saPem })}\nBREVO_API_KEY=brevo-test-key\nJWKS_URL=${S}/jwks\nTOKEN_URL=${S}/token\nIDTK_URL=${S}/idtk\nBREVO_URL=${S}/brevo\n`);
const w = spawn("npx", ["wrangler", "dev", "--port", "8794", "--inspector-port", "9794"], { cwd: root + "backend/mail", stdio: ["ignore", "pipe", "pipe"] }); w.stdout.on("data", () => {}); w.stderr.on("data", () => {});
const M = "http://127.0.0.1:8794";
const up = async () => { const t0 = Date.now(); while (Date.now() - t0 < 120000) { try { const r = await fetch(M + "/welcome", { method: "OPTIONS", headers: { origin: "http://localhost:8000" } }); if (r.status === 204) return true; } catch (e) {} await sleep(500); } return false; };
const finish = () => { try { w.kill(); } catch (e) {} stub.close(); const pass = res.filter(Boolean).length; console.log(`\n  ${pass}/${res.length} pass`); process.exit(pass === res.length ? 0 : 1); };
if (!(await up())) { console.log("  FAIL  mail Worker did not start"); finish(); }
const call = (tok, body, origin = "http://localhost:8000") => fetch(M + "/welcome", { method: "POST", headers: { "content-type": "application/json", origin, ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));

ok("no token → 401, nothing sent", (await call(null, { lang: "en" })).status === 401 && mails.length === 0);
ok("forged token (wrong project) → 401", (await call(await token({ ...good("fresh"), aud: "other" }), {})).status === 401);
ok("unknown signing key → 401", (await call(await token(good("fresh"), "k9"), {})).status === 401);
ok("foreign origin → 403", (await call(await token(good("fresh")), {}, "https://evil.example")).status === 403);
const r1 = await call(await token(good("fresh")), { lang: "fr", name: "Aminata <b>x</b>\nKone" });
ok("a fresh account → one email through Brevo, from noreply@lomonec.com, tagged welcome", r1.status === 200 && r1.sent === true && mails.length === 1 && mails[0].sender.email === "noreply@lomonec.com" && mails[0].tags.join() === "welcome" && mails[0].to[0].email === "fresh@example.com", JSON.stringify(r1) + " mails=" + mails.length);
const m1 = mails[0] || {};
ok("French subject and body; the name is greeted with tags and line breaks stripped; the login address is stated", /Bienvenue sur BE Mastery/.test(m1.subject) && /Bonjour Aminata bxb Kone,/.test(m1.htmlContent) && m1.htmlContent.includes("fresh@example.com") && /Ouvrir BE Mastery/.test(m1.htmlContent), (m1.htmlContent || "").match(/Bonjour[^<]*/)?.[0]);
ok("the animated hero, the four features, the app button and the Google Play link are in the HTML; a plain-text part exists", m1.htmlContent.includes("https://app.lomonec.com/mail/welcome.gif") && /Shadow Studio/.test(m1.htmlContent) && /Practice Partner/.test(m1.htmlContent) && /Phrase Lab/.test(m1.htmlContent) && m1.htmlContent.includes('href="https://app.lomonec.com/"') && m1.htmlContent.includes("play.google.com") && /Shadow Studio/.test(m1.textContent) && /Lomonec LLC/.test(m1.htmlContent));
ok("nothing script-like survives the name", !/<b>|<script/.test(m1.htmlContent));
const r2 = await call(await token(good("fresh")), { lang: "en" });
ok("the same account again within the hour → 200 but not sent (replay guard)", r2.status === 200 && r2.sent === false && mails.length === 1, JSON.stringify(r2));
const r3 = await call(await token(good("old")), { lang: "en" });
ok("a two-day-old account → 200 but not sent (only new accounts)", r3.status === 200 && r3.sent === false && mails.length === 1, JSON.stringify(r3));
const r4 = await call(await token({ ...good("fresh"), sub: "old", user_id: "old" }), { lang: "en" });
ok("a token cannot pick another account: the uid in the token is what Firebase is asked about", r4.sent === false && mails.length === 1);
users.esp = { localId: "esp", email: "esp@example.com", createdAt: String(Date.now() - 1000) };
const r5 = await call(await token(good("esp")), { lang: "xx" });
ok("an unsupported language falls back to English", r5.sent === true && /Welcome to BE Mastery/.test(mails[1].subject) && /Hello,/.test(mails[1].htmlContent));
finish();
