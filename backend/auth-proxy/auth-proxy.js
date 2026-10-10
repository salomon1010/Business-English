/* BE Mastery — be-auth: Firebase's sign-in helper, served from our own domain.

   Why (owner, 6 Oct 2026: Google and Apple sign-in must work in the Android app
   as on the iPhone): the Play app is a Trusted Web Activity on app.lomonec.com.
   It has no popup opener, and a redirect to be-mastery.firebaseapp.com cannot
   come back, because Chrome partitions storage by SITE and firebaseapp.com is
   another site. Firebase's documented answer ("Best practices for using
   signInWithRedirect", option 3) is to proxy /__/auth/* from a host of your own.
   auth.lomonec.com is a sibling of app.lomonec.com — the same site — so the
   redirect returns and the session is readable. A static copy of the helper is
   not enough: Apple answers with a form POST to /__/auth/handler.

   What it does: forwards GET/POST/OPTIONS on /__/auth/* and /__/firebase/* to
   FIREBASE_HOST (be-mastery.firebaseapp.com in production, the validation
   project on staging), body and query unchanged, and returns Firebase's answer.
   Every other path is 404. It stores nothing and logs nothing.

   The client switches to it with the flag auth_proxy_enabled (index.html,
   fbAuthProxyHost). Before turning that on: Google Cloud → the web OAuth client
   → add https://auth.lomonec.com/__/auth/handler as an authorised redirect URI;
   Apple → the Services ID → add the same URL as a return URL. */
const PATHS = /^\/__\/(auth|firebase)\//;
/* SIGN IN WITH APPLE FOR THE ANDROID APP (10 Oct 2026). Android has no native Apple
   sign-in, so BEAuthPlugin.java opens Apple's own page in a browser tab with
   redirect_uri = this handler (already a return URL of the Services ID, for the web)
   and a state that starts with "bea.". Apple form-POSTs its answer here. That one
   answer is NOT forwarded to Firebase: it is handed back to the app through its own
   link, bemastery://apple, and the app signs in with Firebase exactly as the iPhone
   does (idToken + the raw nonce only the app knows — an intercepted token is useless
   without it). Every other request is forwarded unchanged. Nothing is stored or logged. */
const APP_STATE = /^bea\.[A-Za-z0-9_-]{16,64}$/;
const APP_LINK = "bemastery://apple";
function appleBack(form) {
  const q = new URLSearchParams({ state: form.get("state") });
  for (const k of ["id_token", "user", "error"]) { const v = form.get(k); if (v) q.set(k, String(v).slice(0, 8000)); }
  const href = APP_LINK + "?" + q.toString();
  const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>BE Mastery</title>
<body style="font:16px system-ui;background:#0f1230;color:#fff;display:grid;place-items:center;min-height:90vh;text-align:center">
<p>Returning to BE Mastery…</p><p><a style="color:#8fd3ff" href="${esc(href)}">Open BE Mastery</a></p>
<script>location.replace(${JSON.stringify(href)})</script></body>`;
  /* a server redirect, not only the script: Chrome lets a navigation that came from the
     learner's own tap on Apple's page open an app link, but may block a scripted one */
  return new Response(html, { status: 303, headers: { location: href, "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
const HOP = ["host", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "x-forwarded-proto", "x-real-ip"];

export async function handle(req, env) {
  const url = new URL(req.url);
  if (!PATHS.test(url.pathname)) return new Response("not found", { status: 404 });
  if (!["GET", "HEAD", "POST", "OPTIONS"].includes(req.method)) return new Response("method", { status: 405 });
  const host = String((env && env.FIREBASE_HOST) || "");
  if (!/^[a-z0-9-]+\.firebaseapp\.com$/.test(host)) return new Response("not configured", { status: 503 });
  const target = "https://" + host + url.pathname + url.search;
  const headers = new Headers(req.headers);
  for (const h of HOP) headers.delete(h);
  const init = { method: req.method, headers, redirect: "manual" };
  if (req.method === "POST") {
    init.body = await req.arrayBuffer();
    if (url.pathname === "/__/auth/handler" && /application\/x-www-form-urlencoded/i.test(req.headers.get("content-type") || "")) {
      const form = new URLSearchParams(new TextDecoder().decode(init.body));
      if (APP_STATE.test(form.get("state") || "")) return appleBack(form);
    }
  }
  const res = await fetch(target, init);
  /* a redirect Firebase issues to its own host stays on ours */
  const out = new Headers(res.headers);
  const loc = out.get("location");
  if (loc && loc.startsWith("https://" + host + "/")) out.set("location", "https://" + url.host + loc.slice(("https://" + host).length));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export default { fetch: (req, env) => handle(req, env) };
