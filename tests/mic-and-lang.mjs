/* Two release-critical surfaces the 1 Oct 2026 shakeout touched.
   Run: cd tests && node mic-and-lang.mjs

   · the new ai.need_acct string really is translated in the packs that are
     translated (fr/es/pt/ar) and falls back to English — never to a raw key —
     in the eleven that are not yet.
   · a refused microphone is still reported as a refused microphone. This is the
     control for the transcription fix: the app must keep telling the truth about
     the mic, now that an empty transcript no longer blames it. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT=8750, BASE=`http://127.0.0.1:${PORT}/`;
const srv=spawn("python3",["-m","http.server",String(PORT),"--bind","127.0.0.1"],{cwd:root,stdio:"ignore"}); await sleep(900);
const b=await chromium.launch();
const res=[]; const ok=(n,c,d="")=>{res.push(!!c);console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  — "+String(d).slice(0,240)}`)};
const seed=tr=>JSON.stringify({profile:{name:"Alex",lang:"en",ts:1},professionalTracks:{activeId:tr},
  fnd:{"general-english":{placed:"full",finished:true,day:15,done:{},checkedAt:1},welding:{placed:"full",finished:true,day:15,done:{},checkedAt:1}},
  days:{},dates:[],dayLog:{},steps:{},scores:{},notes:{},lastSeen:Date.now(),backupAsked:1});

console.log("\n# the new string reaches the 15 packs, not just English");
{
  const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
  await ctx.addInitScript(([s])=>localStorage.setItem("be12_v1",s),[seed("general-english")]);
  await ctx.route(u=>/be-events|be-partner|cloudflareinsights|youtube|ytimg|gstatic|be-polish/.test(u.href),r=>r.fulfill({status:404,body:"{}"}));
  const p=await ctx.newPage(); await p.goto(BASE+"index.html"); await sleep(1200);
  const out=await p.evaluate(async()=>{
    const got={};
    for(const c of ["fr","es","pt","ar","de"]){ await setLang(c); got[c]=t("ai.need_acct") }
    await setLang("en"); got.en=t("ai.need_acct");
    return got;
  });
  ok("1 · French is translated, not the English fallback", /Connectez-vous/.test(out.fr), out.fr);
  ok("2 · Spanish and Portuguese too", /Inicia sesión/.test(out.es)&&/Entre na sua conta/.test(out.pt), out.es+" | "+out.pt);
  ok("3 · Arabic too", /سجّل الدخول/.test(out.ar), out.ar);
  ok("4 · a language with no translation yet falls back to English, not to the raw key", out.de===out.en && !/^ai\./.test(out.de), out.de);
  await ctx.close();
}

console.log("\n# microphone refused: the app says so, and never silently");
{
  const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:"block",permissions:[]});
  await ctx.addInitScript(([s])=>localStorage.setItem("be12_v1",s),[seed("welding")]);
  await ctx.route(u=>/be-events|be-partner|cloudflareinsights|youtube|ytimg|gstatic|be-polish/.test(u.href),r=>r.fulfill({status:404,body:"{}"}));
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE+"index.html"); await sleep(1200);
  const r=await p.evaluate(async()=>{
    // a hard refusal, as a learner who has blocked the mic in site settings
    navigator.mediaDevices.getUserMedia=()=>Promise.reject(Object.assign(new Error("denied"),{name:"NotAllowedError"}));
    simRun={listening:true,voiceStatus:"",debrief:false,finished:false,missionComplete:false};   /* top-level let: assign the binding, not a window property */
    const okm=await simMicReady();
    return { granted:okm, status:simRun.voiceStatus, blocked:simMicBlockedText() };
  });
  ok("5 · a refused microphone is reported, not swallowed", r.granted===false && /microphone/i.test(r.status), JSON.stringify(r));
  ok("6 · and the wording tells the learner where to fix it", /settings/i.test(r.blocked), r.blocked);
  ok("7 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
const pass=res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass`);
await b.close(); srv.kill(); process.exit(0);
