/* Google + Apple sign-in (the App Store shell) — the web half, end to end, in a
   real browser.  Run: cd tests && node auth-social.mjs

   What is REAL here: index.html — beNativeAuth(), socialAuthOn/socialAuthCaps(),
   fbSocial(), fbEmailAuth(), fbErr(), fbLinkPending(), fbSignOut(), the sign-in
   sheet's markup, the POLISH_API signing wrapper — plus the committed iOS
   project files, read from disk.
   What is PLAYED: the Capacitor bridge (a fake `BEAuth` plugin with the same
   method names and error codes as BEAuthPlugin.swift) and the Firebase compat
   SDK (a stand-in served in place of gstatic.com, recording every call).
   What this CANNOT prove: that Apple's sheet, Google's web session or Firebase's
   real servers behave as the stand-ins do. That needs a signed build on a
   physical iPhone — docs/auth/SOCIAL_SIGNIN.md, "Device matrix". */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8191), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const own = !process.env.BASE;
const srv = own ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }) : null;
if (own) await sleep(800);

/* PROVENANCE GUARD. The port may already be held by another session's server —
   it has happened, and the suite then certifies somebody else's index.html
   (see partner.mjs, which carries the same guard). Compare what is being
   served with what is on disk, and refuse rather than lie. */
{
  const disk = readFileSync(root + "index.html", "utf8");
  let served = "";
  try { served = await (await fetch(BASE + "index.html")).text(); } catch (e) { served = ""; }
  if (!served) { console.error(`\nNothing is answering at ${BASE}. Start a server in the repository root, or pass PORT/BASE.\n`); process.exit(1); }
  if (served.length !== disk.length) {
    console.error(`\n${BASE} is serving a DIFFERENT index.html (${served.length} bytes served, ${disk.length} on disk).`);
    console.error(`Another session almost certainly holds port ${PORT}. Run with PORT=<a free port>, or BASE=<your own server>.\n`);
    if (srv) srv.kill();
    process.exit(1);
  }
  console.log(`  (serving ${root}index.html — ${disk.length} bytes — at ${BASE})`);
}

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const pend = (name, why) => { console.log(`  PENDING  ${name}  — ${why}`); };

/* ---------- the stand-in Firebase compat SDK (served as all three parts) ---- */
const FAKE_SDK = `
(function(){
  if(window.firebase&&window.firebase.__fake)return;             /* parts 2 and 3 are no-ops */
  const log=window.__fb={calls:[],users:[],tokens:0,linked:[],reset:[],welcome:0,signedOut:0};
  const KEY="__fake_fb_user";
  function user(uid,email,provider){return {uid,email,providerData:[{providerId:provider}],
    getIdToken:async()=>{log.tokens++;return "ID_TOKEN_"+uid},
    linkWithCredential:async c=>{log.linked.push({uid,cred:c});if(window.__fb.linkFails)throw {code:window.__fb.linkFails};return {user:{uid,email}}},
    delete:async()=>{}}}
  const auth={
    currentUser:null,_cbs:[],
    onAuthStateChanged(cb){this._cbs.push(cb);setTimeout(()=>cb(this.currentUser),0);return ()=>{}},
    _set(u){this.currentUser=u;if(u)log.users.push(u.uid);this._cbs.forEach(cb=>{try{cb(u)}catch(e){}})},
    async signInWithEmailAndPassword(em,pw){log.calls.push("password:"+em);
      if(window.__fb.passwordFails)throw {code:window.__fb.passwordFails};
      this._set(user("uid-"+em,em,"password"));return {user:this.currentUser,additionalUserInfo:{isNewUser:false}}},
    async createUserWithEmailAndPassword(em,pw){log.calls.push("signup:"+em);
      this._set(user("uid-"+em,em,"password"));return {user:this.currentUser,additionalUserInfo:{isNewUser:true}}},
    async signInWithCredential(c){log.calls.push("credential:"+c.providerId);(log.creds=log.creds||[]).push(c);
      if(window.__fb.credFails){const e=window.__fb.credFails;window.__fb.credFails=null;throw e}
      this._set(user("uid-"+c.providerId,window.__fb.credEmail||("x@"+c.providerId),c.providerId));
      return {user:this.currentUser,additionalUserInfo:{isNewUser:!!window.__fb.newUser},credential:c}},
    async signOut(){log.signedOut++;this._set(null)},
    async sendPasswordResetEmail(em){log.reset.push(em)},
    async getRedirectResult(){return {user:null}},
    setPersistence:async()=>{},
  };
  function Provider(id){this.providerId=id;this.addScope=()=>{};this.setCustomParameters=()=>{}}
  function OAuthProvider(id){this.providerId=id;
    this.credential=o=>({providerId:id,idToken:o&&o.idToken,rawNonce:o&&o.rawNonce})}
  const GoogleAuthProvider=function(){Provider.call(this,"google.com")};
  GoogleAuthProvider.credential=(idToken,accessToken)=>({providerId:"google.com",idToken,accessToken});
  const docs={};
  const db={collection:()=>({doc:id=>({
      get:async()=>({exists:!!docs[id],data:()=>docs[id]||{}}),
      set:async(v)=>{docs[id]=Object.assign({},docs[id],v)},
      delete:async()=>{delete docs[id]}})})};
  window.firebase={__fake:true,initializeApp(){},auth(){return auth},firestore(){return db}};
  window.firebase.auth.GoogleAuthProvider=GoogleAuthProvider;
  window.firebase.auth.OAuthProvider=OAuthProvider;
  window.firebase.auth.EmailAuthProvider={credential:(e,p)=>({providerId:"password",e,p})};
  window.firebase.firestore.FieldValue={serverTimestamp:()=>1};
  window.__fbAuth=auth;
})();`;

/* ---------- the stand-in BEAuth plugin (same shapes as BEAuthPlugin.swift) --- */
const BRIDGE = ([caps]) => {
  const be = window.__be = { calls: [], caps, next: { apple: "ok", google: "ok" } };
  const fail = (code) => { const e = new Error(code); e.code = code; return e; };
  const P = {
    available: async () => { be.calls.push("available"); return be.caps; },
    appleSignIn: async () => {
      be.calls.push("appleSignIn");
      const m = be.next.apple;
      if (m !== "ok") throw fail(m);
      return { idToken: "APPLE_ID_TOKEN", rawNonce: "RAWNONCE_A", provider: "apple.com", email: "relay@privaterelay.appleid.com", givenName: "Ada" };
    },
    googleSignIn: async () => {
      be.calls.push("googleSignIn");
      const m = be.next.google;
      if (m !== "ok") throw fail(m);
      if (m === "ok" && be.noToken) return { rawNonce: "RAWNONCE_G", provider: "google.com" };
      return { idToken: "GOOGLE_ID_TOKEN", rawNonce: "RAWNONCE_G", provider: "google.com" };
    },
  };
  /* Shaped like the bridge iOS ACTUALLY injects, because the earlier stub was
     the reason a 108/108 green suite sat on top of a broken device build: it
     invented `registerPlugin`, which Capacitor's native-bridge.js does not
     define (that is an @capacitor/core API and this app has no bundler). What
     the bridge really injects, at document start and per registered plugin, is
     Capacitor.Plugins.<jsName> plus a PluginHeaders entry — see
     node_modules/@capacitor/ios/.../JSExport.swift. No registerPlugin here, on
     purpose: a stub that is kinder than the device is worse than no stub. */
  const a = (window.Capacitor = window.Capacitor || {});
  a.getPlatform = () => "ios"; a.isNativePlatform = () => true;
  a.isPluginAvailable = (n) => Object.prototype.hasOwnProperty.call(a.Plugins || {}, n);
  const pl = (a.Plugins = a.Plugins || {});
  pl.BEAuth = Object.assign({ addListener: () => {}, removeAllListeners: () => Promise.resolve() }, P);
  (a.PluginHeaders = a.PluginHeaders || []).push({ name: "BEAuth",
    methods: ["available", "appleSignIn", "googleSignIn"].map(n => ({ name: n, rtype: "promise" })) });
};

const seed = (tr) => JSON.stringify({ profile: { name: "", lang: "en", ts: 1 }, professionalTracks: { activeId: tr },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

const b = await chromium.launch();
async function open({ ios = true, caps = { apple: true, google: true }, track = "general-english", owner = null, pre = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, ow]) => { localStorage.setItem("be12_v1", s); if (ow) localStorage.setItem("be12_owner", ow); }, [seed(track), owner]);
  if (ios) await ctx.addInitScript(BRIDGE, [caps]);
  if (pre) await ctx.addInitScript(pre);
  /* the SDK the app loads on demand, replaced by the stand-in */
  await ctx.route(/gstatic\.com\/firebasejs/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_SDK }));
  const net = [];
  await ctx.route(/be-polish|be-partner|be-events|be-push|be-mail|cloudflareinsights|ytimg|youtube|googleapis|accounts\.google/, r => {
    const q = r.request(); net.push({ url: q.url(), auth: (q.headers().authorization || "") });
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true }) });
  });
  const p = await ctx.newPage();
  const logs = []; p.on("console", m => logs.push(m.text())); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1300);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#ppFab").forEach(e => e.remove()));
  return { ctx, p, logs, errs, net };
}
const sheet = async (p, mode = "up") => { await p.evaluate(m => fbOpenModal(m), mode); await sleep(400);
  return p.evaluate(() => { const o = document.getElementById("authOv"); if (!o) return null;
    return { text: o.innerText, soc: [...o.querySelectorAll(".auth-soc")].map(x => ({ cls: x.className, label: x.innerText.trim(), svg: !!x.querySelector("svg") })),
      sep: !!o.querySelector(".auth-sep"), email: !!o.querySelector("#authEmail"), pw: !!o.querySelector("#authPw"), err: (o.querySelector("#authErr") || {}).textContent || "" }; }); };
const err = p => p.evaluate(() => (document.getElementById("authErr") || {}).textContent || "");
const who = p => p.evaluate(() => { const u = typeof FBUser !== "undefined" ? FBUser : null; return u ? { uid: u.uid, email: u.email, provider: (u.providerData || [{}])[0].providerId } : null; });

console.log("\n# the shell offers both providers, the web offers neither");
{
  const { p, ctx } = await open();
  const s = await sheet(p);
  ok("A1 · the sign-in sheet shows Continue with Apple and Continue with Google", s.soc.length === 2 && /Apple/.test(s.soc[0].label) && /Google/.test(s.soc[1].label), JSON.stringify(s.soc));
  ok("A2 · Apple is listed first (Apple's own guidance where it is offered)", /apple/.test(s.soc[0].cls));
  ok("A3 · each button carries its provider mark (logo) and a separator follows", s.soc.every(x => x.svg) && s.sep);
  ok("A4 · email and password are still there, below", s.email && s.pw);
  ok("A5 · the plugin was asked what the BUILD can offer", (await p.evaluate(() => window.__be.calls)).includes("available"));
  await ctx.close();
}
{
  /* The physical-device report of 2 Oct 2026: a real iPhone build showed only
     email/password. The buttons are drawn from socialAuthCaps(), and it used to
     CACHE a negative — so one rejected available() call, which a cold launch can
     produce because the bridge registers its plugins in capacitorDidLoad, hid
     both buttons for the rest of the session with nothing on screen to explain
     it. A "no" must never be remembered. */
  const { p, ctx, logs } = await open({ pre: () => {
    /* the plugin rejects the FIRST available() and works afterwards */
    let first = true;
    const P = { available: async () => { if (first) { first = false; const e = new Error("not ready"); e.code = "unavailable"; throw e; } return { apple: true, google: true }; },
      appleSignIn: async () => ({ idToken: "A", rawNonce: "N", provider: "apple.com" }),
      googleSignIn: async () => ({ idToken: "G", rawNonce: "N", provider: "google.com" }) };
    const a = (window.Capacitor = window.Capacitor || {});
    a.getPlatform = () => "ios"; a.isNativePlatform = () => true;
    a.Plugins = { BEAuth: P };          /* the real surface, no registerPlugin */
  } });
  const first = await sheet(p, "in");
  ok("A5a · a rejected available() draws no button, as it must — nothing half-working is offered", first.soc.length === 0 && !first.sep, JSON.stringify(first.soc));
  ok("A5b · … and it says why in the console, so a device build can be diagnosed instead of guessed", logs.some(l => /BEAuth\.available failed/.test(l)), logs.slice(-3).join(" | "));
  await p.evaluate(() => fbCloseModal()); await sleep(200);
  const second = await sheet(p, "in");
  ok("A5c · the NEXT open asks again and both buttons appear: a transient failure is not remembered",
    second.soc.length === 2 && /Apple/.test(second.soc[0].label) && /Google/.test(second.soc[1].label), JSON.stringify(second.soc));
  ok("A5d · and only then is the answer cached", JSON.stringify(await p.evaluate(() => socialAuthCaps())) === '{"apple":true,"google":true}', JSON.stringify(await p.evaluate(() => socialAuthCaps())));
  await ctx.close();
}
{
  /* the supported iOS App Shell conditions, named one by one, so a future
     regression says WHICH of them stopped being true */
  const { p, ctx } = await open();
  const env = await p.evaluate(() => ({ iosApp: IS_IOS_APP, platform: Capacitor.getPlatform(),
    fbConfigured: fbConfigured(), flag: flag("social_signin_enabled"), plugin: !!beNativeAuth(), on: socialAuthOn() }));
  ok("A5e · in the shell every gate the buttons depend on is true (IS_IOS_APP, platform ios, Firebase configured, flag on, plugin reachable, socialAuthOn)",
    env.iosApp === true && env.platform === "ios" && env.fbConfigured === true && env.flag === true && env.plugin === true && env.on === true, JSON.stringify(env));
  const caps = await p.evaluate(() => socialAuthCaps());
  ok("A5f · … and the build reports Apple unconditionally, Google because the client id is in Info.plist",
    caps.apple === true && caps.google === true, JSON.stringify(caps));
  const s = await sheet(p, "in");
  ok("A5g · both buttons are rendered on the LOG IN sheet too, not only on Create account", s.soc.length === 2, JSON.stringify(s.soc));
  await ctx.close();
}
{
  /* THE PHYSICAL-DEVICE FAILURE, 2 Oct 2026. A fresh build on a real iPhone
     showed no Google and no Apple button, and the suite was green, because
     the app asked for `Capacitor.registerPlugin` — an @capacitor/core API this
     bundler-less app never imports, and one the injected native-bridge.js does
     not define (0 occurrences in its twenty methods). The stubs above invented
     it, so they could not see the hole. These checks pin the real contract. */
  const { p, ctx } = await open();
  const bridge = await p.evaluate(() => ({
    registerPlugin: typeof window.Capacitor.registerPlugin,
    plugins: !!(window.Capacitor.Plugins && window.Capacitor.Plugins.BEAuth),
    headers: (window.Capacitor.PluginHeaders || []).some(h => h && h.name === "BEAuth"),
  }));
  ok("A6a · the stub is the bridge iOS really injects: Capacitor.Plugins.BEAuth and PluginHeaders, and NO registerPlugin",
    bridge.registerPlugin === "undefined" && bridge.plugins === true && bridge.headers === true, JSON.stringify(bridge));
  ok("A6b · and on that bridge the app still finds the plugin — the device regression",
    (await p.evaluate(() => !!window.beNativeAuth())) === true && (await p.evaluate(() => window.socialAuthOn())) === true);
  const caps = await p.evaluate(() => window.socialAuthCaps());
  ok("A6c · … reports both providers", caps.apple === true && caps.google === true, JSON.stringify(caps));
  const s2 = await sheet(p, "in");
  ok("A6d · … and draws both buttons on the Log in sheet", s2.soc.length === 2 && /Apple/.test(s2.soc[0].label) && /Google/.test(s2.soc[1].label), JSON.stringify(s2.soc));
  await ctx.close();
}
{
  /* a bundled build (or any host that DOES provide @capacitor/core) must keep
     working through the fallback, so the fix is additive, not a swap */
  const { p, ctx } = await open({ pre: () => {
    const P = { available: async () => ({ apple: true, google: true }),
      appleSignIn: async () => ({ idToken: "A", rawNonce: "N" }), googleSignIn: async () => ({ idToken: "G", rawNonce: "N" }) };
    window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, registerPlugin: (n) => (n === "BEAuth" ? P : {}) };
  } });
  const s3 = await sheet(p, "in");
  ok("A6e · a host that only offers registerPlugin (a bundled build) still gets both buttons", s3.soc.length === 2, JSON.stringify(s3.soc));
  await ctx.close();
}
{
  /* no plugin on the bridge at all = no buttons. The shell must never offer an
     OAuth button it cannot complete. */
  const { p, ctx } = await open({ pre: () => {
    const a = (window.Capacitor = window.Capacitor || {});
    a.getPlatform = () => "ios"; a.isNativePlatform = () => true; a.Plugins = {};   /* registered nothing */
  } });
  const s4 = await sheet(p, "in");
  ok("A6f · a bridge with no BEAuth draws no button and no separator — nothing fake is shipped", s4.soc.length === 0 && !s4.sep, JSON.stringify(s4.soc));
  ok("A6g · … and email/password is untouched there", s4.email && s4.pw);
  await ctx.close();
}
{
  /* the JS name and the method names must match the Swift plugin exactly, or
     Capacitor.Plugins.<jsName>.<method> is simply not there */
  const at = (...q) => root + q.join("/");    /* `f` is declared later, in the K block */
  const sw = readFileSync(at("mobile/ios/ios/App/App/BEAuthPlugin.swift"), "utf8");
  const html = readFileSync(at("index.html"), "utf8");
  const jsName = (sw.match(/let jsName = "([^"]+)"/) || [])[1];
  const methods = [...sw.matchAll(/CAPPluginMethod\(name: "([^"]+)"/g)].map(m => m[1]);
  ok(`A6h · the Swift jsName (${jsName}) is the name the web layer asks for`, jsName === "BEAuth" && /capPlugin\("BEAuth"\)/.test(html), jsName);
  ok(`A6i · every method the web layer calls is exported by the plugin (${methods.join(", ")})`,
    ["available", "appleSignIn", "googleSignIn"].every(m => methods.includes(m)), methods.join(", "));
  ok("A6j · the web layer reads Capacitor.Plugins first and does not depend on registerPlugin alone",
    /C\.Plugins&&C\.Plugins\[name\]/.test(html), "capPlugin must read Capacitor.Plugins");
}
{
  const { p, ctx } = await open({ ios: false });
  const s = await sheet(p);
  ok("A6 · on the web (no native plugin) NO social button is drawn — a redirect cannot complete from app.lomonec.com", s.soc.length === 0 && !s.sep);
  ok("A7 · the web sheet still has email and password", s.email && s.pw);
  await ctx.close();
}
{
  const { p, ctx } = await open({ caps: { apple: true, google: false } });
  const s = await sheet(p);
  ok("A8 · a build with no Google client id offers Apple only (never a button that must fail)", s.soc.length === 1 && /Apple/.test(s.soc[0].label));
  await ctx.close();
}
{
  const { p, ctx } = await open({ pre: () => { localStorage.setItem("be_flags", JSON.stringify({ social_signin_enabled: false })); } });
  const s = await sheet(p);
  ok("A9 · the kill switch (social_signin_enabled=false) removes both buttons and leaves email/password", s.soc.length === 0 && s.email, JSON.stringify(s.soc));
  await ctx.close();
}

console.log("\n# Apple");
{
  const { p, ctx, logs } = await open();
  await sheet(p);
  await p.evaluate(() => fbSocial("apple")); await sleep(500);
  const fb = await p.evaluate(() => window.__fb);
  ok("B1 · the native sheet was asked, then Firebase received an apple.com credential", (await p.evaluate(() => window.__be.calls)).includes("appleSignIn") && fb.calls.includes("credential:apple.com"));
  ok("B2 · the credential carries Apple's ID token AND the raw nonce (so Firebase can bind it to the request)", await p.evaluate(() => { const c = window.__fb.creds && window.__fb.creds.pop(); return !!c && c.idToken === "APPLE_ID_TOKEN" && c.rawNonce === "RAWNONCE_A"; }), JSON.stringify(await p.evaluate(() => window.__fb.creds)));
  const u = await who(p);
  ok("B3 · the app's auth state is the SAME one email/password produces (FBUser set, provider apple.com)", !!u && u.provider === "apple.com", JSON.stringify(u));
  ok("B4 · the sheet closed on success", !(await p.evaluate(() => !!document.getElementById("authOv"))));
  ok("B5 · Apple's one-time first name filled the empty profile name", (await p.evaluate(() => S.profile.name)) === "Ada");
  ok("B6 · the private-relay address was NOT written into the profile as an e-mail", !(JSON.stringify(await p.evaluate(() => S.profile))).includes("privaterelay"));
  ok("B7 · no token appeared in the console", !logs.some(l => /APPLE_ID_TOKEN|ID_TOKEN_|RAWNONCE/.test(l)), logs.filter(l => /TOKEN/.test(l)).join(" | "));
  await ctx.close();
}
{
  const { p, ctx } = await open();
  const cred = await p.evaluate(async () => { await fbLoad(); const c = new firebase.auth.OAuthProvider("apple.com").credential({ idToken: "T", rawNonce: "N" }); return c; });
  ok("B8 · Apple goes through OAuthProvider('apple.com'), not a custom backend", cred.providerId === "apple.com" && cred.rawNonce === "N");
  await ctx.close();
}

console.log("\n# Google");
{
  const { p, ctx, logs } = await open();
  await sheet(p);
  await p.evaluate(() => fbSocial("google")); await sleep(500);
  const fb = await p.evaluate(() => window.__fb);
  ok("C1 · the native flow ran and Firebase received a google.com credential", (await p.evaluate(() => window.__be.calls)).includes("googleSignIn") && fb.calls.includes("credential:google.com"));
  const u = await who(p);
  ok("C2 · the same application auth state results (provider google.com)", !!u && u.provider === "google.com");
  ok("C3 · no Google access token is kept anywhere in app state", !JSON.stringify(await p.evaluate(() => S)).includes("GOOGLE"));
  ok("C4 · no token in the console", !logs.some(l => /GOOGLE_ID_TOKEN/.test(l)));
  await ctx.close();
}

console.log("\n# email/password is untouched");
{
  const { p, ctx } = await open();
  await sheet(p, "in");
  await p.evaluate(() => { document.getElementById("authEmail").value = "ada@example.com"; document.getElementById("authPw").value = "hunter22"; });
  await p.evaluate(() => fbEmailAuth("in")); await sleep(500);
  const u = await who(p);
  ok("D1 · password sign-in still works and still sets the same state", !!u && u.provider === "password" && u.email === "ada@example.com", JSON.stringify(u));
  ok("D2 · it was the password endpoint, not a credential", (await p.evaluate(() => window.__fb.calls)).some(c => c.startsWith("password:")));
  await p.evaluate(() => { window.__skipConfirm = true; });
  await ctx.close();
}
{
  const { p, ctx } = await open();
  await sheet(p, "up");
  await p.evaluate(() => { document.getElementById("authEmail").value = "new@example.com"; document.getElementById("authPw").value = "hunter22"; });
  await p.evaluate(() => fbEmailAuth("up")); await sleep(400);
  ok("D3 · sign-up still works", (await p.evaluate(() => window.__fb.calls)).some(c => c.startsWith("signup:")));
  await ctx.close();
}

console.log("\n# account linking — no duplicate accounts");
{
  const { p, ctx } = await open();
  await sheet(p);
  await p.evaluate(() => { window.__fb.credFails = { code: "auth/account-exists-with-different-credential", email: "ada@example.com", credential: { providerId: "google.com", idToken: "G" } }; });
  await p.evaluate(() => fbSocial("google")); await sleep(600);
  const s = await p.evaluate(() => { const o = document.getElementById("authOv"); return o ? { err: (o.querySelector("#authErr") || {}).textContent, email: (o.querySelector("#authEmail") || {}).value, login: o.innerText } : null; });
  ok("E1 · Firebase's refusal is turned into a plain sentence naming the address, on the LOG IN sheet", !!s && /ada@example\.com/.test(s.err) && /already has an account/i.test(s.err), JSON.stringify(s && s.err));
  ok("E2 · the e-mail is pre-filled so the learner only types the password", s.email === "ada@example.com");
  ok("E3 · no second account was created (no further credential call)", (await p.evaluate(() => window.__fb.calls.filter(c => c.startsWith("credential:")).length)) === 1);
  await p.evaluate(() => { document.getElementById("authPw").value = "hunter22"; });
  await p.evaluate(() => fbEmailAuth("in")); await sleep(500);
  const linked = await p.evaluate(() => window.__fb.linked);
  ok("E4 · after the password sign-in the kept credential is LINKED to that one account", linked.length === 1 && linked[0].cred.providerId === "google.com", JSON.stringify(linked));
  ok("E5 · the learner ends up signed in to the existing account", ((await who(p)) || {}).email === "ada@example.com", JSON.stringify(await who(p)));
  await ctx.close();
}
{
  const { p, ctx } = await open();
  await sheet(p);
  await p.evaluate(() => { window.__fb.credFails = { code: "auth/account-exists-with-different-credential", email: "ada@example.com", credential: { providerId: "apple.com" } }; window.__fb.linkFails = "auth/credential-already-in-use"; });
  await p.evaluate(() => fbSocial("apple")); await sleep(500);
  await p.evaluate(() => { document.getElementById("authPw").value = "hunter22"; });
  await p.evaluate(() => fbEmailAuth("in")); await sleep(500);
  ok("E6 · a link that Firebase refuses still leaves the learner signed in, with no error thrown at them", (await who(p)) !== null && !(await p.evaluate(() => !!document.getElementById("authOv"))));
  await ctx.close();
}

/* The kept credential belongs to ONE address — the one Firebase said it
   collided with — and is spent on no other. Without that binding the next
   password sign-in of the session consumed it whatever account it was, so a
   learner who ignored the pre-filled address, or tapped Create account
   instead, would quietly attach their Google/Apple identity to a different
   account of theirs and from then on be signed in to the wrong one. */
const collide = async (p, kind, email) => p.evaluate(([k, em]) => {
  window.__fb.credFails = { code: "auth/account-exists-with-different-credential", email: em,
    credential: { providerId: k === "apple" ? "apple.com" : "google.com", idToken: "TOK" } };
  return fbSocial(k);
}, [kind, email]);
const login = async (p, email, mode = "in") => { await p.evaluate(em => {
    document.getElementById("authEmail").value = em; document.getElementById("authPw").value = "hunter22"; }, email);
  await p.evaluate(m => fbEmailAuth(m), mode); await sleep(500); };
const toastText = p => p.evaluate(() => (document.getElementById("toast") || {}).textContent || "");

for (const kind of ["google", "apple"]) {
  const prov = kind === "apple" ? "apple.com" : "google.com", Name = kind === "apple" ? "Apple" : "Google";
  {
    const { p, ctx } = await open();
    await sheet(p); await collide(p, kind, "ada@example.com"); await sleep(500);
    await login(p, "ada@example.com");
    const linked = await p.evaluate(() => window.__fb.linked);
    ok(`E7${kind[0]} · ${Name} collision → password sign-in with the SAME address → the provider is linked to that one account`,
      linked.length === 1 && linked[0].cred.providerId === prov && linked[0].uid === "uid-ada@example.com", JSON.stringify(linked));
    ok(`E8${kind[0]} · … and the learner is told it was connected, not just "Signed in"`, new RegExp(Name).test(await toastText(p)), await toastText(p));
    await ctx.close();
  }
  {
    const { p, ctx } = await open();
    await sheet(p); await collide(p, kind, "ada@example.com"); await sleep(500);
    await login(p, "bob@example.com");                    // a different account of theirs
    const linked = await p.evaluate(() => window.__fb.linked);
    ok(`E9${kind[0]} · ${Name} collision → password sign-in with a DIFFERENT address → NOTHING is linked`, linked.length === 0, JSON.stringify(linked));
    ok(`E10${kind[0]} · … and they are told plainly that this is not the account it belongs to`,
      /not connected/i.test(await toastText(p)) && new RegExp(Name).test(await toastText(p)), await toastText(p));
    ok(`E11${kind[0]} · … the sign-in itself still succeeds, into the account they actually asked for`,
      ((await who(p)) || {}).email === "bob@example.com", JSON.stringify(await who(p)));
    ok(`E12${kind[0]} · … and no duplicate account was made: one credential attempt, one password account`,
      (await p.evaluate(() => window.__fb.calls.filter(c => c.startsWith("credential:")).length)) === 1
      && (await p.evaluate(() => window.__fb.users.filter(u => u !== "uid-bob@example.com").length)) === 0,
      JSON.stringify(await p.evaluate(() => window.__fb.users)));
    /* spent or dropped, it is gone: coming back and signing in as the RIGHT
       address must not resurrect it (fbSignOut is not used here \u2014 it waits on a
       confirm dialog nobody is there to tap) */
    await p.evaluate(() => fbOpenModal("in")); await sleep(400);
    await login(p, "ada@example.com");
    ok(`E13${kind[0]} · the credential is CLEARED by the mismatch — a later correct sign-in does not link it either`,
      (await p.evaluate(() => window.__fb.linked.length)) === 0, JSON.stringify(await p.evaluate(() => window.__fb.linked)));
    await ctx.close();
  }
  {
    const { p, ctx } = await open();
    await sheet(p); await collide(p, kind, "ada@example.com"); await sleep(500);
    await p.evaluate(() => fbCloseModal()); await sleep(200);
    await p.evaluate(() => fbOpenModal("in")); await sleep(400);
    await login(p, "ada@example.com");
    ok(`E14${kind[0]} · closing the sheet drops it: the learner walked away, so the right address does not link it later either`,
      (await p.evaluate(() => window.__fb.linked.length)) === 0, JSON.stringify(await p.evaluate(() => window.__fb.linked)));
    await ctx.close();
  }
  {
    /* the toggle to Create account runs through fbCloseModal too, which is
       exactly where someone would otherwise have linked it to a NEW account */
    const { p, ctx } = await open();
    await sheet(p); await collide(p, kind, "ada@example.com"); await sleep(500);
    await p.evaluate(() => fbOpenModal("up")); await sleep(400);
    await login(p, "new@example.com", "up");
    ok(`E15${kind[0]} · tapping Create account instead cannot carry it over to the brand-new account`,
      (await p.evaluate(() => window.__fb.linked.length)) === 0 && ((await who(p)) || {}).email === "new@example.com",
      JSON.stringify(await p.evaluate(() => window.__fb.linked)) + JSON.stringify(await who(p)));
    await ctx.close();
  }
}
{
  /* Firebase stores addresses lower-cased, the field does not: the comparison
     uses the app's own trim/lower-case semantics on both sides, and both sides
     come from Firebase — the provider error, then the authenticated session. */
  const { p, ctx } = await open();
  await sheet(p); await collide(p, "google", "Ada@Example.COM"); await sleep(500);
  await login(p, " ada@example.com ");
  ok("E16 · case and stray spaces do not break the match (nor invent a different identity policy)",
    (await p.evaluate(() => window.__fb.linked.length)) === 1, JSON.stringify(await p.evaluate(() => window.__fb.linked)));
  await ctx.close();
}
{
  /* and with no collision at all, nothing links — the ordinary path is untouched */
  const { p, ctx } = await open();
  await sheet(p, "in"); await login(p, "ada@example.com");
  ok("E17 · an ordinary email/password sign-in links nothing and shows the usual confirmation",
    (await p.evaluate(() => window.__fb.linked.length)) === 0 && /signed in/i.test(await toastText(p)), await toastText(p));
  await ctx.close();
}
{
  /* the credential is held in a script-scoped `let`, so it is not a window
     property and nothing can read it from the console or another script \u2014 and
     no value of it is ever printed, on either path */
  const { p, ctx, logs } = await open();
  await sheet(p); await collide(p, "google", "ada@example.com"); await sleep(500);
  const reach = await p.evaluate(() => Object.keys(window).filter(k => /_fbPend|pendCred|pendKind/i.test(k)));
  ok("E18 · while it is held, the pending credential is not on window: page scripts and the console cannot read it", reach.length === 0, reach.join(","));
  await login(p, "bob@example.com");
  const leaked = logs.filter(l => /TOK\b|idToken|rawNonce|RAWNONCE/.test(l));
  ok("E19 · nothing of the credential is logged, on the match path or the mismatch path", leaked.length === 0, leaked.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("\n# cancelling, provider failure, network, bad credential");
{
  const { p, ctx } = await open();
  await sheet(p);
  await p.evaluate(() => { window.__be.next.apple = "cancelled"; });
  await p.evaluate(() => fbSocial("apple")); await sleep(400);
  ok("F1 · a cancelled Apple sheet says NOTHING (no error, sheet still open)", (await err(p)) === "" && (await p.evaluate(() => !!document.getElementById("authOv"))));
  ok("F2 · the buttons are usable again after a cancel", await p.evaluate(() => [...document.querySelectorAll(".auth-soc")].every(b => !b.disabled)));
  ok("F3 · nobody was signed in", (await who(p)) === null);
  await p.evaluate(() => { window.__be.next.google = "network"; });
  await p.evaluate(() => fbSocial("google")); await sleep(400);
  ok("F4 · a network failure gets the plain network line", /connection|network/i.test(await err(p)), await err(p));
  await p.evaluate(() => { window.__be.next.google = "provider"; });
  await p.evaluate(() => fbSocial("google")); await sleep(400);
  ok("F5 · a provider failure gets a plain line that points at email/password", /email and password/i.test(await err(p)), await err(p));
  await p.evaluate(() => { window.__be.next.google = "unconfigured"; });
  await p.evaluate(() => fbSocial("google")); await sleep(400);
  ok("F6 · an unconfigured build says so plainly", /isn't available|not available/i.test(await err(p)), await err(p));
  await ctx.close();
}
{
  const { p, ctx } = await open();
  await sheet(p);
  await p.evaluate(() => { window.__be.noToken = true; });
  await p.evaluate(() => fbSocial("google")); await sleep(400);
  const e = await err(p);
  ok("F7 · a provider answer with no ID token is refused, not sent on", !!e && (await p.evaluate(() => window.__fb.calls.filter(c => c.startsWith("credential:")).length)) === 0, e);
  await ctx.close();
}
{
  const { p, ctx } = await open();
  await sheet(p);
  await p.evaluate(() => { window.__fb.credFails = { code: "auth/internal-error", message: "FIREBASE INTERNALS: ya29.a0AfB_byC-SECRET" }; });
  await p.evaluate(() => fbSocial("google")); await sleep(400);
  const e = await err(p);
  ok("F8 · a raw Firebase/OAuth message is NEVER shown to the learner", !!e && !/SECRET|ya29|INTERNALS/.test(e), e);
  await ctx.close();
}

{
  /* auth/invalid-credential reached the learner as "Wrong email or password."
     after a Google or Apple sheet — where there is no password and no typed
     address, so the line is nonsense and sends them looking for a typo they
     never made. The provider line belongs there instead. Both sides of the
     boundary are asserted, because the e-mail form must KEEP that wording:
     the strings are read from the page's own t(), so this holds in any language. */
  const { p, ctx } = await open();
  await sheet(p);
  const S_PROV = await p.evaluate(() => t("auth.err_provider"));
  const S_CRED = await p.evaluate(() => t("auth.err_invalid_credential"));
  const S_PW   = await p.evaluate(() => t("auth.err_wrong_password"));
  for (const kind of ["google", "apple"]) {
    const Name = kind === "apple" ? "Apple" : "Google";
    await p.evaluate(k => { window.__fb.credFails = { code: "auth/invalid-credential" }; return fbSocial(k); }, kind);
    await sleep(400);
    const e = await err(p);
    ok(`F9${kind[0]} · a ${Name} credential refusal gets the provider line, NOT "Wrong email or password."`,
      e === S_PROV && e !== S_CRED, e);
  }
  /* the same code, thrown by fbSocial itself when the plugin answers with no token */
  await p.evaluate(() => { window.__be.noToken = true; return fbSocial("google"); });
  await sleep(400);
  ok("F10 · the no-ID-token refusal reads as a provider failure too, not a wrong password",
    (await err(p)) === S_PROV, await err(p));
  await p.evaluate(() => { window.__be.noToken = false; });
  /* and the e-mail form is untouched: the same code keeps its own wording */
  await p.evaluate(() => { window.__fb.passwordFails = "auth/invalid-credential";
    document.getElementById("authEmail").value = "ada@example.com";
    document.getElementById("authPw").value = "hunter22"; return fbEmailAuth("in"); });
  await sleep(400);
  ok('F11 · email/password keeps "Wrong email or password." for that very same code',
    (await err(p)) === S_CRED, await err(p));
  await p.evaluate(() => { window.__fb.passwordFails = "auth/wrong-password"; return fbEmailAuth("in"); });
  await sleep(400);
  ok("F12 · auth/wrong-password stays password-specific", (await err(p)) === S_PW, await err(p));
  ok("F13 · no token, code or secret appears in any of those messages",
    !/ya29|eyJ|idToken|TOK\b/.test([S_PROV, S_CRED, S_PW].join(" ")));
  await ctx.close();
}

console.log("\n# session persistence, restoration and sign-out");
{
  const { p, ctx } = await open();
  await sheet(p);
  await p.evaluate(() => fbSocial("apple")); await sleep(500);
  const owner = await p.evaluate(() => localStorage.getItem("be12_owner"));
  ok("G1 · signing in with Apple records the account as this device's owner (the key the boot path reads)", !!owner, String(owner));
  await ctx.close();
}
{
  /* a device that has signed in before: the boot path must load the SDK itself,
     which is what restores the session after a force-close */
  const { p, ctx } = await open({ owner: "uid-apple.com" });
  await sleep(600);
  ok("G2 · on relaunch, a device with an owner key loads Firebase at boot without anyone tapping", await p.evaluate(() => !!window.firebase && !!FBauth));
  ok("G3 · the SDK's own auth-state callback is what sets FBUser (no parallel session store)", await p.evaluate(() => typeof fbOnAuth === "function" && !!window.__fbAuth._cbs.length));
  await ctx.close();
}
{
  const { p, ctx } = await open();
  await sheet(p);
  await p.evaluate(() => fbSocial("google")); await sleep(500);
  await p.evaluate(() => { window.askConfirm = async () => true; });
  await p.evaluate(() => fbSignOut()); await sleep(700);
  ok("G4 · sign-out goes through Firebase", (await p.evaluate(() => window.__fb.signedOut)) >= 1);
  ok("G5 · sign-out clears the account state (FBUser null, owner key gone)", (await who(p)) === null && !(await p.evaluate(() => localStorage.getItem("be12_owner"))));
  ok("G6 · the signed-out app still works (Home renders, sign-in is offered again)", await p.evaluate(() => { go("home"); return !!document.getElementById("v-home"); }));
  const s = await sheet(p);
  ok("G7 · the sheet after sign-out offers all three ways in again", s.soc.length === 2 && s.email);
  await ctx.close();
}

console.log("\n# the backend still gets a verified Firebase ID token");
{
  const { p, ctx, net } = await open();
  await sheet(p);
  await p.evaluate(() => fbSocial("apple")); await sleep(500);
  await p.evaluate(async () => { try { await fetch(POLISH_API + "/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ytai: "dQw4w9WgXcQ" }) }); } catch (e) {} });
  await sleep(400);
  const call = net.filter(x => /be-polish/.test(x.url)).pop();
  ok("H1 · an AI call made after a social sign-in carries the Firebase ID token", !!call && /^Bearer ID_TOKEN_/.test(call.auth), JSON.stringify(call && call.auth.slice(0, 20)));
  ok("H2 · the token came from the SDK's getIdToken (not from anything the client made up)", (await p.evaluate(() => window.__fb.tokens)) >= 1);
  ok("H3 · no uid or e-mail is sent as identity in the body", !!call && !/uid=|email=/.test(call.url));
  await ctx.close();
}

console.log("\n# track isolation — Welding gains sign-in, nothing else");
{
  const { p, ctx } = await open({ track: "welding" });
  const s = await sheet(p);
  ok("I1 · a Welding learner gets the same three ways in", s.soc.length === 2 && s.email);
  await p.evaluate(() => fbSocial("apple")); await sleep(500);
  ok("I2 · signing in on Welding does not expose Practice Partner", await p.evaluate(() => { go("home"); const txt = document.body.innerText; return !/Practice Partner|Real People/i.test(txt) && !document.getElementById("ppFab"); }));
  ok("I3 · Welding is still Welding after signing in (isGeneralEnglish false)", await p.evaluate(() => !isGeneralEnglish()));
  ok("I4 · the partner page is not reachable from Welding", await p.evaluate(() => { go("partner"); return !/Practice Partner/i.test((document.getElementById("v-partner") || { innerText: "" }).innerText) || !ppAvailable(); }));
  await ctx.close();
}

console.log("\n# Premium, ytai and the rest are untouched by this change");
{
  const { p, ctx } = await open();
  ok("J1 · billing is still off and ENT_API is still empty", await p.evaluate(() => !flag("billing_enabled") && ENT_API === ""));
  ok("J2 · the ytai client gate is still in place", await p.evaluate(() => typeof ytaiNoAccount === "function"));
  ok("J3 · the POLISH_API signing wrapper is still the one used", await p.evaluate(() => /be-polish/.test(POLISH_API)));
  await ctx.close();
}

console.log("\n# show/hide password");
{
  /* a touch context, tapped like a thumb would — not a mouse click */
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  await ctx.addInitScript(([s]) => { localStorage.setItem("be12_v1", s); }, [seed("general-english")]);
  await ctx.addInitScript(BRIDGE, [{ apple: true, google: true }]);
  await ctx.route(/gstatic\.com\/firebasejs/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_SDK }));
  await ctx.route(/be-polish|be-partner|be-events|be-push|be-mail|cloudflareinsights|ytimg|youtube|googleapis/, r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1300);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#ppFab").forEach(e => e.remove()));
  await p.evaluate(() => fbOpenModal("in")); await sleep(350);
  const state = () => p.evaluate(() => { const i = document.getElementById("authPw"), e = document.querySelector(".pw-eye");
    return { type: i.type, value: i.value, pressed: e.getAttribute("aria-pressed"), label: e.getAttribute("aria-label"), icon: (e.querySelector("svg") || {}).innerHTML || "" }; });
  await p.fill("#authPw", "hunter22 Ünïcode");
  const s0 = await state();
  ok("L1 · the password starts masked", s0.type === "password" && s0.pressed === "false", JSON.stringify(s0.type));
  ok("L2 · the eye has an accessible label saying what the tap does", /show password/i.test(s0.label), s0.label);
  await p.tap(".pw-eye"); await sleep(120);
  const s1 = await state();
  ok("L3 · one tap reveals it", s1.type === "text" && s1.pressed === "true");
  ok("L4 · the label and the icon flip with the state", /hide password/i.test(s1.label) && s1.icon !== s0.icon, s1.label);
  await p.tap(".pw-eye"); await sleep(120);
  const s2 = await state();
  ok("L5 · tapping again masks it", s2.type === "password" && s2.pressed === "false");
  ok("L6 · the value is untouched throughout (not even re-typed)", s0.value === "hunter22 Ünïcode" && s1.value === s0.value && s2.value === s0.value, [s0.value, s1.value, s2.value].join("|"));
  const box = await p.evaluate(() => { const r = document.querySelector(".pw-eye").getBoundingClientRect(); const i = document.getElementById("authPw").getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), insideField: r.right <= i.right + 1 && r.top >= i.top - 1 && r.bottom <= i.bottom + 1, pad: getComputedStyle(document.getElementById("authPw")).paddingRight }; });
  ok(`L7 · the target is big enough for a thumb (${box.w}×${box.h})`, box.w >= 44 && box.h >= 44);
  ok("L8 · it sits inside the field, and the field's right padding keeps the text clear of it", box.insideField && parseInt(box.pad, 10) >= 44, JSON.stringify(box));
  ok("L9 · it is a real <button type=button>, with no nested control and no form submit", await p.evaluate(() => { const e = document.querySelector(".pw-eye");
    return e.tagName === "BUTTON" && e.type === "button" && e.querySelectorAll("button,a,input,select,textarea").length === 0 && !e.parentElement.closest("button,a,label") && !e.closest("form"); }));
  /* the toggle must not change what sign-in does */
  await p.evaluate(() => { document.getElementById("authEmail").value = "ada@example.com"; });
  await p.tap(".pw-eye");                                   // revealed, then sign in
  await p.evaluate(() => fbEmailAuth("in"));
  await sleep(500);
  ok("L10 · signing in while the password is visible still works, with the typed value", (await p.evaluate(() => window.__fb.calls)).includes("password:ada@example.com") && ((await who(p)) || {}).email === "ada@example.com");
  /* validation is Firebase's and is untouched: an empty password still refuses */
  await p.evaluate(() => { window.askConfirm = async () => true; });
  await p.evaluate(() => fbSignOut()); await sleep(600);
  await p.evaluate(() => fbOpenModal("up")); await sleep(300);
  await p.evaluate(() => { window.__fb.passwordFails = null; document.getElementById("authEmail").value = "x@example.com"; document.getElementById("authPw").value = ""; });
  const sheetSignup = await p.evaluate(() => { const o = document.getElementById("authOv");
    return { pw: !!o.querySelector("#authPw"), eye: !!o.querySelector(".pw-eye"), auto: o.querySelector("#authPw").getAttribute("autocomplete") }; });
  ok("L11 · the create-account sheet has the same one field, the same toggle, and still asks the browser for a NEW password", sheetSignup.pw && sheetSignup.eye && sheetSignup.auto === "new-password", JSON.stringify(sheetSignup));
  ok("L12 · nothing else on the sheet changed (email, submit, forgot, terms all still there)", await p.evaluate(() => { const o = document.getElementById("authOv"), txt = o.innerText;
    return !!o.querySelector("#authEmail") && !!o.querySelector(".btn-p") && !!o.querySelector(".auth-terms") && /Apple/.test(txt); }));
  ok("L13 · no page error from any of it", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
/* Password RESET has no password field at all — it is an e-mail link, so there
   is nothing to reveal. Asserted rather than assumed, so a future change that
   adds a field here is caught by this suite. */
{
  const { p, ctx } = await open();
  await sheet(p, "in");
  const before = await p.evaluate(() => document.querySelectorAll('#authOv input[type="password"]').length);
  await p.evaluate(() => { document.getElementById("authEmail").value = "ada@example.com"; });
  await p.evaluate(() => fbReset()); await sleep(600);
  const after = await p.evaluate(() => ({ pw: document.querySelectorAll('#authOv input[type="password"]').length, reset: (window.__fb.reset || []).length, note: (document.getElementById("authErr") || {}).textContent || "" }));
  ok("L14 · the reset flow is an e-mail link: no new-password field exists to toggle", before === 1 && after.pw <= 1, JSON.stringify(after));
  ok("L15 · reset still sends (through whichever sender answered) and still names the address on the form", /ada@example\.com/.test(after.note) && /reset link/i.test(after.note), JSON.stringify(after.note));
  await ctx.close();
}

console.log("\n# the committed iOS project and this repository");
{
  const f = (...p) => root + p.join("/");
  const sw = readFileSync(f("mobile/ios/ios/App/App/BEAuthPlugin.swift"), "utf8");
  const ent = f("mobile/ios/ios/App/App/App.entitlements");
  const plist = readFileSync(f("mobile/ios/ios/App/App/Info.plist"), "utf8");
  const pbx = readFileSync(f("mobile/ios/ios/App/App.xcodeproj/project.pbxproj"), "utf8");
  const vc = readFileSync(f("mobile/ios/ios/App/App/BEBridgeViewController.swift"), "utf8");
  ok("K1 · App.entitlements asks for Sign in with Apple and nothing else", existsSync(ent) && /applesignin/.test(readFileSync(ent, "utf8")) && (readFileSync(ent, "utf8").match(/<key>/g) || []).length === 1);
  ok("K2 · both build configurations sign with it", (pbx.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) || []).length === 2);
  ok("K3 · no push, no associated domains, no iCloud were added", !/aps-environment|associated-domains|com\.apple\.developer\.icloud/.test(readFileSync(ent, "utf8")));
  ok("K4 · BEAuthPlugin is in the Sources phase and registered on the bridge", /BEAuthPlugin\.swift in Sources/.test(pbx) && /registerPluginInstance\(BEAuthPlugin\(\)\)/.test(vc));
  ok("K5 · the plugin holds no secret and logs nothing", !/client_secret|BEGIN PRIVATE KEY/.test(sw) && !/\bprint\(|NSLog|os_log/.test(sw));
  ok("K6 · Apple's request is bound to a SHA-256 nonce", /request\.nonce = Self\.sha256\(raw\)/.test(sw));
  ok("K7 · Google is PKCE with state checked, and the access token is dropped", /code_challenge_method/.test(sw) && /value\("state"\) == state/.test(sw) && /deliberately dropped/.test(sw));
  ok("K8 · no CFBundleURLTypes was needed (ASWebAuthenticationSession owns the callback)", !/CFBundleURLTypes/.test(plist));
  /* The client id IS configured now (2 Oct 2026). It is public by design — an
     iOS OAuth client has no secret — but it must be a real one and it must
     belong to THIS Firebase project, so the check is format + project number
     and not the literal credential. The number is read out of index.html's own
     FB_CONFIG, so a client minted in the wrong Google Cloud project fails here
     rather than on a learner's phone at the end of the flow. The {16,} tail
     rejects a placeholder like the example in the plist comment. */
  const gid = (plist.match(/<key>BEGoogleIosClientID<\/key>\s*<string>([^<]*)<\/string>/) || [])[1] || "";
  const gproj = (readFileSync(f("index.html"), "utf8").match(/messagingSenderId:"(\d+)"/) || [])[1] || "";
  ok("K9 · the Google client id is configured: a real iOS OAuth client of this very Firebase project, and still nothing secret in the plist",
    !!gproj && gid.startsWith(gproj + "-") && gid.endsWith(".apps.googleusercontent.com")
    && /^\d+-[a-z0-9]{16,}\.apps\.googleusercontent\.com$/.test(gid)
    && !/client_secret|BEGIN PRIVATE KEY|AuthKey_/.test(plist),
    `len=${gid.length} project=${gproj || "?"}`);
  ok("K10 · the bundle id is unchanged", (pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.lomonec\.bemastery;/g) || []).length === 2);
  const html = readFileSync(f("index.html"), "utf8");
  ok("K11 · no key, token or client id is committed in the web app", !/apps\.googleusercontent\.com|client_secret|BEGIN PRIVATE KEY|AuthKey_/.test(html));
  const keys = new Set([...html.split("const I18N_EN")[1].split("\n};")[0].matchAll(/"([A-Za-z0-9_.\-]+)"\s*:/g)].map(x => x[1]));
  const langs = ["es", "fr", "pt", "it", "de", "ru", "ar", "ur", "hi", "bn", "id", "vi", "zh", "ja", "ko"];
  let bad = [];
  for (const l of langs) { const d = JSON.parse(readFileSync(f("i18n", l + ".json"), "utf8")); const k = new Set(Object.keys(d));
    const miss = [...keys].filter(x => !k.has(x)), orph = [...k].filter(x => !keys.has(x));
    if (miss.length || orph.length) bad.push(`${l} -${miss.length}/+${orph.length}`); }
  ok(`K12 · all 15 translation packs carry every key (${keys.size})`, bad.length === 0, bad.join(", "));
  for (const l of ["fr", "es", "pt", "ar"]) { const d = JSON.parse(readFileSync(f("i18n", l + ".json"), "utf8"));
    ok(`K13 · ${l}: the new sign-in strings are translated, not left in English`, d["auth.err_provider"] !== JSON.parse(readFileSync(f("i18n", "de.json"), "utf8"))["auth.err_provider"]); }
}

console.log("\n# what only a phone can answer");
pend("Apple's own sheet, Face ID, private relay delivery", "needs a signed build on a physical iPhone");
pend("Google's real web session, account chooser and token exchange", "needs a signed build on a physical iPhone");
pend("session survives a real force-close", "needs a physical iPhone");
pend("the App ID capability and the Firebase provider settings", "owner's console work — docs/auth/SOCIAL_SIGNIN.md");

const pass = res.filter(Boolean).length;
console.log(`\n${pass === res.length ? "ALL PASS" : "FAILURES"} — ${pass}/${res.length}\n`);
await b.close(); if (srv) srv.kill();
process.exit(pass === res.length ? 0 : 1);
