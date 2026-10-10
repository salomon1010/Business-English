/* be-auth: run with  node backend/auth-proxy/test/run.mjs  (no network: fetch is stubbed) */
import { handle } from "../auth-proxy.js";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };
const seen = [];
globalThis.fetch = async (u, init) => { seen.push({ u: String(u), init }); if (/handler$/.test(new URL(u).pathname) && init.method === "GET") return new Response("<html>helper</html>", { status: 200, headers: { "content-type": "text/html" } });
  return new Response("ok", { status: 302, headers: { location: "https://be-mastery.firebaseapp.com/__/auth/handler?x=1" } }); };
const env = { FIREBASE_HOST: "be-mastery.firebaseapp.com" };
let r = await handle(new Request("https://auth.lomonec.com/__/auth/handler?apiKey=k&authType=signInViaRedirect"), env);
ok("1 · GET /__/auth/handler is Firebase's own page, query unchanged", r.status === 200 && (await r.text()).includes("helper") && seen[0].u === "https://be-mastery.firebaseapp.com/__/auth/handler?apiKey=k&authType=signInViaRedirect", seen[0] && seen[0].u);
r = await handle(new Request("https://auth.lomonec.com/__/auth/handler", { method: "POST", body: "code=abc&state=s", headers: { "content-type": "application/x-www-form-urlencoded", host: "auth.lomonec.com", "cf-connecting-ip": "1.2.3.4" } }), env);
const p = seen[1];
ok("2 · Apple's form POST is forwarded with its body; our edge headers are not", p.init.method === "POST" && new TextDecoder().decode(p.init.body) === "code=abc&state=s" && !p.init.headers.get("cf-connecting-ip") && !p.init.headers.get("host"), JSON.stringify([...p.init.headers]));
ok("3 · a redirect to Firebase's host is rewritten to ours", r.headers.get("location") === "https://auth.lomonec.com/__/auth/handler?x=1", r.headers.get("location"));
const n = seen.length;
r = await handle(new Request("https://auth.lomonec.com/"), env); const r2 = await handle(new Request("https://auth.lomonec.com/index.html"), env);
ok("4 · anything outside /__/auth and /__/firebase is 404 and never reaches Firebase", r.status === 404 && r2.status === 404 && seen.length === n);
r = await handle(new Request("https://auth.lomonec.com/__/auth/handler", { method: "PUT" }), env);
ok("5 · other methods are refused", r.status === 405 && seen.length === n);
r = await handle(new Request("https://auth.lomonec.com/__/auth/handler"), { FIREBASE_HOST: "evil.example.com" });
ok("6 · only a *.firebaseapp.com target is ever used", r.status === 503 && seen.length === n);
{ /* the Android app's Apple answer goes back to the app, never to Firebase */
  const m = seen.length, st = "bea." + "a1B2c3D4e5F6g7H8i9J0";
  const body = new URLSearchParams({ state: st, code: "c0de", id_token: "eyJ.apple.token", user: JSON.stringify({ name: { firstName: "Muna" } }) }).toString();
  const a = await handle(new Request("https://auth.lomonec.com/__/auth/handler", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } }), env);
  const html = await a.text(), href = a.headers.get("location") || "";
  const q = new URL(href.replace("bemastery://", "https://x/")).searchParams;
  ok("7 · an Apple answer with the app's state is handed to bemastery://apple, and Firebase is never called", a.status === 303 && href.startsWith("bemastery://apple?") && html.includes("Open BE Mastery") && q.get("state") === st && q.get("id_token") === "eyJ.apple.token" && /Muna/.test(q.get("user")) && seen.length === m, href);
  ok("8 · the one-time code is NOT passed on, and the page is never cached", !q.get("code") && a.headers.get("cache-control") === "no-store");
  const w = await handle(new Request("https://auth.lomonec.com/__/auth/handler", { method: "POST", body: "code=abc&state=firebase-own-state", headers: { "content-type": "application/x-www-form-urlencoded" } }), env);
  ok("9 · any other state (the website's Apple sign-in) is still forwarded to Firebase", seen.length === m + 1 && new TextDecoder().decode(seen[m].init.body) === "code=abc&state=firebase-own-state");
  const bad = await handle(new Request("https://auth.lomonec.com/__/auth/handler", { method: "POST", body: "state=bea.x&id_token=t", headers: { "content-type": "application/x-www-form-urlencoded" } }), env);
  ok("10 · a malformed app state is not treated as the app's (it is forwarded)", seen.length === m + 2);
}
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
