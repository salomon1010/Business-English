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
  if (req.method === "POST") init.body = await req.arrayBuffer();
  const res = await fetch(target, init);
  /* a redirect Firebase issues to its own host stays on ours */
  const out = new Headers(res.headers);
  const loc = out.get("location");
  if (loc && loc.startsWith("https://" + host + "/")) out.set("location", "https://" + url.host + loc.slice(("https://" + host).length));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export default { fetch: (req, env) => handle(req, env) };
