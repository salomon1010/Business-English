/* The AI path end to end: this checkout's client, the REAL staging Workers, a
   REAL be-mastery-test ID token. Nothing is mocked but the page's own origin.

     # mint a token in the validation project (be-mastery-test, never be-mastery):
     curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=<be-mastery-test web key>" \
       -H 'content-type: application/json' \
       --data '{"email":"...","password":"...","returnSecureToken":true}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["idToken"])' > /tmp/tok
     cd tests && TOKFILE=/tmp/tok node staging-ai-e2e.mjs

   Why the origin trick: be-polish-staging and be-entitlements-staging allow
   https://staging.lomonec.com, so a localhost page cannot reach them. The page
   is therefore SERVED FROM DISK under that origin — real Worker CORS and real
   Worker auth, this tree's JavaScript. Short of restaging, this is as close to
   the device as a local run gets; it does not replace the manual pass on a
   phone, and it writes nothing to production.

   A Firebase ID token expires in an hour; mint a fresh one if check 4 fails. */
/* Patched client + the REAL staging Workers + a REAL be-mastery-test token.
   The page is served from my worktree but under the staging origin, so the
   Workers' own CORS and auth apply exactly as they do on the device. */
import { chromium } from "playwright";
import fs from "node:fs"; import path from "node:path";
const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const TOK = fs.readFileSync(process.env.TOKFILE, "utf8").trim();
const b = await chromium.launch();
const res=[]; const ok=(n,c,d="")=>{res.push(!!c);console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  — "+String(d).slice(0,260)}`)};
const TYPES={".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".ico":"image/x-icon"};
const ctx = await b.newContext({ viewport:{width:390,height:844}, serviceWorkers:"block" });
await ctx.addInitScript(()=>{ localStorage.setItem("be12_v1", JSON.stringify({profile:{name:"Alex",lang:"en",ts:1},professionalTracks:{activeId:"general-english"},
  fnd:{"general-english":{placed:"full",finished:true,day:15,done:{},checkedAt:1}},days:{},dates:[],dayLog:{},steps:{},scores:{},notes:{},lastSeen:Date.now(),backupAsked:1})); });
/* serve the staging origin from disk; everything else (the Workers) goes to the network */
await ctx.route("https://staging.lomonec.com/**", r=>{
  let u=new URL(r.request().url()).pathname; if(u==="/"||u==="") u="/index.html";
  const f=path.join(root, decodeURIComponent(u));
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()) return r.fulfill({status:404,body:""});
  r.fulfill({status:200, contentType:TYPES[path.extname(f).toLowerCase()]||"application/octet-stream", body:fs.readFileSync(f)});
});
await ctx.route(u=>/cloudflareinsights|youtube\.com|ytimg|gstatic\.com\/firebasejs|be-events/.test(u.href), r=>r.fulfill({status:404,body:"{}"}));
const polish=[]; ctx.on("response", r=>{ if(/be-polish-staging/.test(r.url())) polish.push(r.status()) });
const p = await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto("https://staging.lomonec.com/index.html", {waitUntil:"load"});
await p.waitForTimeout(1500);
await p.evaluate(()=>document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv").forEach(e=>e.remove()));

const env = await p.evaluate(()=>({polish:POLISH_API, ent:entApiBase(), gated:entGated()}));
ok("1 · the page really is pointed at the staging Workers", /be-polish-staging/.test(env.polish)&&/be-entitlements-staging/.test(env.ent), JSON.stringify(env));

console.log("\n# signed OUT against the real Worker");
{
  const m=await p.evaluate(async()=>{const blob=new Blob([new Uint8Array(4000)],{type:"audio/webm"});
    const said=await fbTranscribe(blob);return {said,why:fbTxWhy(),msg:said?null:((fbTxWhy()&&fbTxWhyText())||SIM_NOTHING_HEARD)}});
  ok("2 · an interview turn asks the learner to sign in, and never blames the mic", m.why==="account"&&/sign in/i.test(m.msg)&&!/nothing came through/i.test(m.msg), JSON.stringify(m));
  const tr=await p.evaluate(async()=>{let e=null;try{await svShTrFetch({id:"s1",vid:"V1",text:"We need to align on the delivery date before Friday."})}catch(x){e=String(x&&x.message)}return e});
  ok("3 · Shadow translation stops with the account reason, no doomed call", tr==="acct", String(tr));
}

console.log("\n# signed IN with a real be-mastery-test token (Free plan)");
await p.evaluate(tok=>{ FBUser={uid:"shakeout",getIdToken:async()=>tok}; }, TOK);
await p.evaluate(()=>entRefresh()); await p.waitForTimeout(1200);
{
  const v=await p.evaluate(()=>({plan:entView().plan, paid:entView().paid, noAcct:aiNoAccount()}));
  ok("4 · the real entitlements Worker answered and the plan is Free", v.plan==="free"&&v.paid===false&&v.noAcct===false, JSON.stringify(v));
  const tx=await p.evaluate(async()=>{const blob=new Blob([new Uint8Array(4000)],{type:"audio/webm"});
    const said=await fbTranscribe(blob);return {said,why:fbTxWhy(),msg:said?null:((fbTxWhy()&&fbTxWhyText())||SIM_NOTHING_HEARD)}});
  ok("5 · the turn now says hearing the answer is Premium — the recording is kept", tx.why==="premium"&&/Premium/.test(tx.msg)&&/recording is saved/i.test(tx.msg), JSON.stringify(tx));
  const tr=await p.evaluate(async()=>{try{return {text:await svShTrFetch({id:"s2",vid:"V1",text:"We need to align on the delivery date before Friday."})}}catch(e){return {err:String(e&&e.message)}}});
  ok("6 · Shadow translation now SUCCEEDS against the live Worker, in French", !!tr.text&&/livraison|date/i.test(tr.text), JSON.stringify(tr));
  console.log("      translation returned:", JSON.stringify(tr.text||tr.err));
}
ok("7 · no uncaught page errors", errs.length===0, errs.slice(0,3).join(" | "));
console.log("\n  be-polish-staging statuses seen:", JSON.stringify(polish));
const pass=res.filter(Boolean).length; console.log(`  ${pass}/${res.length} pass`);
await b.close(); process.exit(0);
