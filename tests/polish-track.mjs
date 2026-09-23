/* Executive Polish is one engine for two programmes, and the two must never
   see each other's minute. On 23 Sep 2026 a learner's General English speech,
   its "Say it better" version and its report were all sitting on the Welding
   Polish page: the page drew from one in-memory object with no area key. This
   asserts the boundary from every side — switching either way, both switch
   paths, a minute that finishes AFTER the learner switched, a refresh, and the
   device wipe that sign-out runs.   Run with: cd tests && npm run test:polish-track

   The Worker is a fixture here (analyse / repolish are stubbed in the page);
   the last check reads the Worker's source to show it holds no store at all,
   so there is nothing server-side that could carry one area's text to the
   other. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const ROOT=new URL("..", import.meta.url).pathname;
let BASE=process.env.BASE,server=null;
if(!BASE){server=spawn("python3",["-m","http.server","8793"],{cwd:ROOT,stdio:"ignore"});await sleep(800);BASE="http://localhost:8793"}
const res=[];const ok=(n,c,d="")=>{res.push(!!c);console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  — "+d}`)};
const md5=s=>createHash("md5").update(s).digest("hex");

/* Another session's server on the same port answers from another checkout,
   and every check below would then be about someone else's code. */
if(server){
  const served=await (await fetch(BASE+"/index.html?x="+Date.now())).text();
  ok("The server on the test port serves THIS checkout",md5(served)===md5(readFileSync(ROOT+"index.html","utf8")),"port 8793 is held by another tree — free it or pass BASE");
}

/* Server side: nothing to filter because nothing is kept. The analyse and
   repolish routes take a transcript and a language; the Worker has no KV,
   D1, R2, Durable Object or Cache API binding it could keep a minute in. */
{
  const w=readFileSync(ROOT+"backend/polish-worker.js","utf8"),toml=readFileSync(ROOT+"backend/wrangler.toml","utf8");
  const bindings=/kv_namespaces|d1_databases|r2_buckets|durable_objects|queues/.test(toml);
  const stores=/caches\.(default|open)\(|env\.[A-Z_]*(KV|DB|BUCKET|STORE)\b/.test(w);
  ok("The Polish Worker holds no store — nothing server-side can carry one area's minute to the other",!bindings&&!stores,JSON.stringify({bindings,stores}));
}

const GE_TEXT="Hello everyone today is the kick-off of this project called Anthropologie so the first thing I will say is to thank you everyone for being here";
const WD_TEXT="Before I strike the arc I check the ground clamp the gas flow and the joint fit up so the first pass is clean";
const WD2_TEXT="Second welding take the root pass needs a tighter gap and a slower travel speed than I used yesterday";

const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36"});
const page=await ctx.newPage();
const errors=[];page.on("pageerror",e=>errors.push(String(e.message)));
await page.goto(BASE+"/index.html?t="+Date.now(),{waitUntil:"load"});
await page.evaluate(()=>{OB.name="Check";obFinish()});await sleep(700);
await page.evaluate(()=>{try{wcClose()}catch(e){}document.querySelectorAll(".cf-ov,.wc-ov").forEach(e=>e.remove())});

/* The Worker, stubbed: every analyse / repolish answer is tagged with the
   area it was asked from, so a leak is visible in the text itself. */
const stub=()=>page.evaluate(()=>{
  window.__tag="";window.__delay=0;window.__sent=[];
  const ai=tag=>({key_message:"KEY "+tag,clarity:"clear",sharper:"SHARPER "+tag,level:"B1",level_note:"",structure:["Who I am","The ask"],
    versions:[{style:"Direct",text:"VERSION "+tag,learn:["the ask"]}],idioms:[{idiom:"IDIOM "+tag,meaning:"m",when:"w",example:"e"}],
    words:[],collocations:[],corrections:[],sentences:[],hedges:[],quick_win_title:"q",quick_win_goal:"g",concept_title:"c",concept_body:"b",
    remember_title:"r",remember_body:"b",next_recording:"n",coach_script:"Coach "+tag});
  const real=window.fetch;
  window.fetch=async(url,opt)=>{
    let body=null;try{body=opt&&typeof opt.body==="string"?JSON.parse(opt.body):null}catch(e){}
    if(body&&(body.analyse||body.repolish)){
      window.__sent.push(body);
      if(window.__delay)await new Promise(r=>setTimeout(r,window.__delay));
      const tag=window.__tag;
      if(body.analyse)return {ok:true,json:async()=>ai(tag)};
      return {ok:true,json:async()=>({version:{style:"Better",text:"BETTER "+tag+" "+(body.repolish.avoid.length+1),learn:["y"]},idioms:[{idiom:"QI "+tag,meaning:"m",when:"w",example:"e"}]})};
    }
    return real(url,opt);
  };
});
await stub();

/* ── General English: speak, Say it better, Polish it ── */
await page.evaluate(()=>go("phrases"));await sleep(400);
const ge=await page.evaluate(async txt=>{
  window.__tag="GE";
  const ta=document.getElementById("exIn");ta.value=txt;exDraft(ta);
  await exQuick(document.querySelector(".ex-quickbtn"));await new Promise(r=>setTimeout(r,100));
  await exRun({text:txt});await new Promise(r=>setTimeout(r,200));
  return {area:areaId(),draft:document.getElementById("exIn").value,qv:document.querySelectorAll(".ex-qv").length,
    report:document.querySelector(".ex-keymsg")?.textContent||"",reps:aList("exRep").length,tk:aList("exRep")[0]?.tk};
},GE_TEXT);
ok("General English: the minute, its version and its report are on the page and filed under general-english",
  ge.area==="general-english"&&ge.draft===GE_TEXT&&ge.qv===1&&/KEY GE/.test(ge.report)&&ge.reps===1&&ge.tk==="general-english",JSON.stringify(ge));

/* ── switch to Welding the way the review banner does ── */
const wd=await page.evaluate(async()=>{
  areaSwitch("welding","phrases");await new Promise(r=>setTimeout(r,400));
  return {area:areaId(),onPage:!!document.getElementById("exCard"),draft:document.getElementById("exIn").value,qv:document.querySelectorAll(".ex-qv").length,
    rep:document.getElementById("exReportWrap").innerHTML.length,reps:aList("exRep").length,last:!!document.querySelector(".ex-last"),
    exDraft:ex.draft,exQuick:ex.quick.length,exReport:ex.report,txt:document.getElementById("v-phrases").innerText};
});
ok("Welding: an empty box, no version, no report, no 'last report' row — and the accessors agree",
  wd.area==="welding"&&wd.onPage&&wd.draft===""&&wd.qv===0&&wd.rep===0&&wd.reps===0&&!wd.last&&wd.exDraft===""&&wd.exQuick===0&&wd.exReport===null,JSON.stringify({...wd,txt:undefined}));
ok("Nothing of the General English minute is anywhere in the Welding page",!/Anthropologie|KEY GE|BETTER GE|VERSION GE|IDIOM GE/.test(wd.txt));

/* ── Welding: its own minute ── */
const wd2=await page.evaluate(async txt=>{
  window.__tag="WD";
  const ta=document.getElementById("exIn");ta.value=txt;exDraft(ta);
  await exQuick(document.querySelector(".ex-quickbtn"));await new Promise(r=>setTimeout(r,100));
  await exRun({text:txt});await new Promise(r=>setTimeout(r,200));
  return {draft:document.getElementById("exIn").value,qv:[...document.querySelectorAll(".ex-qv")].map(e=>e.innerText).join(" "),
    report:document.querySelector(".ex-keymsg")?.textContent||"",reps:S.exRepA.welding.length,tk:S.exRepA.welding[0].tk,ge:S.exRepA["general-english"].length,
    geTk:S.exRepA["general-english"][0].tk};
},WD_TEXT);
ok("Welding: its own minute, version and report, filed under welding; the General English list is untouched",
  wd2.draft===WD_TEXT&&/BETTER WD/.test(wd2.qv)&&!/GE/.test(wd2.qv)&&/KEY WD/.test(wd2.report)&&wd2.reps===1&&wd2.tk==="welding"&&wd2.ge===1&&wd2.geTk==="general-english",JSON.stringify(wd2));

/* ── back to General English ── */
const back=await page.evaluate(async txt=>{
  areaSwitch("general-english","phrases");await new Promise(r=>setTimeout(r,400));
  return {area:areaId(),draft:document.getElementById("exIn").value,qv:[...document.querySelectorAll(".ex-qv")].map(e=>e.innerText).join(" "),
    report:document.querySelector(".ex-keymsg")?.textContent||"",tk:aList("exRep")[0]?.tk,txt:document.getElementById("v-phrases").innerText,same:document.getElementById("exIn").value===txt};
},GE_TEXT);
ok("Back in General English: its own minute, version and report return; nothing from Welding",
  back.area==="general-english"&&back.same&&/BETTER GE/.test(back.qv)&&!/WD/.test(back.qv)&&/KEY GE/.test(back.report)&&back.tk==="general-english"&&!/strike the arc|KEY WD|BETTER WD|VERSION WD/.test(back.txt),JSON.stringify({...back,txt:undefined}));

/* ── the other switch path: the tracks page, then the Phrase Lab tab ── */
const viaTracks=await page.evaluate(async()=>{
  selectProfessionalTrack("welding");await new Promise(r=>setTimeout(r,300));
  document.querySelectorAll(".cf-ov,.wc-ov").forEach(e=>e.remove());
  go("phrases");await new Promise(r=>setTimeout(r,400));
  return {area:areaId(),draft:document.getElementById("exIn").value,report:document.querySelector(".ex-keymsg")?.textContent||"",txt:document.getElementById("v-phrases").innerText};
});
ok("Switching through the tracks page lands on Welding's own box and report",
  viaTracks.area==="welding"&&/strike the arc/.test(viaTracks.draft)&&/KEY WD/.test(viaTracks.report)&&!/Anthropologie|KEY GE/.test(viaTracks.txt),JSON.stringify({...viaTracks,txt:undefined}));

/* ── a minute that finishes AFTER the learner switched programme ── */
const mid=await page.evaluate(async(GE)=>{
  window.__tag="WD2";window.__delay=700;
  const ta=document.getElementById("exIn");ta.value="Second welding take the root pass needs a tighter gap and a slower travel speed than I used yesterday";exDraft(ta);
  const run=exRun({text:ta.value});
  await new Promise(r=>setTimeout(r,150));
  const waitHere=!!document.querySelector(".ex-wait");
  areaSwitch("general-english","phrases");await new Promise(r=>setTimeout(r,120));
  const pending={wait:!!document.querySelector(".ex-wait"),draft:document.getElementById("exIn").value===GE,busyFor:ex.busyFor,report:document.querySelector(".ex-keymsg")?.textContent||""};
  await run;await new Promise(r=>setTimeout(r,150));
  window.__delay=0;
  const wb=exAreaState("welding");
  return {waitHere,pending,area:areaId(),
    wd:S.exRepA.welding.map(r=>r.tk+":"+(r.ai&&r.ai.key_message)),ge:S.exRepA["general-english"].map(r=>r.tk+":"+(r.ai&&r.ai.key_message)),
    wdBucket:{draft:wb.draft.slice(0,14),report:wb.report&&wb.report.ai.key_message,show:wb.showReport},
    busyFor:ex.busyFor,phase:ex.phase,geReport:document.querySelector(".ex-keymsg")?.textContent||"",geTxt:document.getElementById("v-phrases").innerText};
},GE_TEXT);
ok("A minute analysed after the switch is filed under the programme it was spoken in, with its box and its report waiting there",
  mid.waitHere&&mid.wd.length===2&&mid.wd[0]==="welding:KEY WD2"&&mid.ge.length===1&&mid.ge[0]==="general-english:KEY GE"&&mid.wdBucket.draft==="Second welding"&&mid.wdBucket.report==="KEY WD2"&&mid.wdBucket.show===true,JSON.stringify({...mid,geTxt:undefined}));
ok("General English, open meanwhile, shows neither the wait card nor that report — only its own",
  !mid.pending.wait&&mid.pending.draft&&mid.pending.busyFor==="welding"&&/KEY GE/.test(mid.pending.report)&&/KEY GE/.test(mid.geReport)&&!/KEY WD2|Second welding/.test(mid.geTxt)&&mid.busyFor===null&&mid.phase==="idle",JSON.stringify({...mid,geTxt:undefined}));
const ret=await page.evaluate(async()=>{
  areaSwitch("welding","phrases");await new Promise(r=>setTimeout(r,400));
  return {draft:document.getElementById("exIn").value,report:document.querySelector(".ex-keymsg")?.textContent||""};
});
ok("Returning to Welding opens the report that finished while away",/Second welding/.test(ret.draft)&&/KEY WD2/.test(ret.report),JSON.stringify(ret));

/* ── a refresh: the box is transient; the saved reports are per area ── */
await page.reload({waitUntil:"load"});await sleep(900);
const fresh=await page.evaluate(async()=>{
  document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov").forEach(e=>e.remove());
  go("phrases");await new Promise(r=>setTimeout(r,400));
  const a={area:areaId(),draft:document.getElementById("exIn").value,qv:document.querySelectorAll(".ex-qv").length,rep:document.getElementById("exReportWrap").innerHTML.length,last:!!document.querySelector(".ex-last"),reps:aList("exRep").length};
  exOpenLast();await new Promise(r=>setTimeout(r,200));
  a.opened=document.querySelector(".ex-keymsg")?.textContent||"";
  areaSwitch("general-english","phrases");await new Promise(r=>setTimeout(r,400));
  const b={area:areaId(),draft:document.getElementById("exIn").value,qv:document.querySelectorAll(".ex-qv").length,rep:document.getElementById("exReportWrap").innerHTML.length,last:!!document.querySelector(".ex-last"),reps:aList("exRep").length};
  exOpenLast();await new Promise(r=>setTimeout(r,200));
  b.opened=document.querySelector(".ex-keymsg")?.textContent||"";
  return {a,b};
});
ok("After a refresh the box is empty in both areas, and each 'last report' opens its own",
  fresh.a.area==="welding"&&fresh.a.draft===""&&fresh.a.qv===0&&fresh.a.rep===0&&fresh.a.last&&fresh.a.reps===2&&/KEY WD2/.test(fresh.a.opened)
  &&fresh.b.area==="general-english"&&fresh.b.draft===""&&fresh.b.qv===0&&fresh.b.rep===0&&fresh.b.last&&fresh.b.reps===1&&/KEY GE/.test(fresh.b.opened),JSON.stringify(fresh));

/* ── sign-out: the device wipe must take the box with it ── */
const wiped=await page.evaluate(()=>{
  const ta=document.getElementById("exIn");ta.value="typed before signing out on this phone";exDraft(ta);
  exAreaState("welding").draft="and a welding line left in the other box";
  const before={ge:exAreaState("general-english").draft,wd:exAreaState("welding").draft};
  fbWipeDevice();                                  /* what fbSignOut and fbDeleteAccount run */
  const after={ge:exAreaState("general-english").draft,wd:exAreaState("welding").draft,report:ex.report,quick:ex.quick.length};
  const reaches={signOut:String(fbSignOut).includes("fbWipeDevice()"),foreignAccount:String(fbFirstSync).includes("exWipe()")};
  return {before,after,reaches};
});
ok("The device wipe on sign-out empties the Polish box in every area",
  wiped.before.ge.startsWith("typed before")&&wiped.before.wd.startsWith("and a welding")&&wiped.after.ge===""&&wiped.after.wd===""&&wiped.after.report===null&&wiped.after.quick===0,JSON.stringify(wiped));
ok("Sign-out and a foreign account's sign-in both reach that wipe",wiped.reaches.signOut&&wiped.reaches.foreignAccount,JSON.stringify(wiped.reaches));

ok("No page errors",errors.length===0,errors.join(" | "));
await browser.close();if(server)server.kill();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean)?0:1);
