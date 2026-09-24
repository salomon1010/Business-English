/* The daily session's speaking report (2026-09-24): the Executive Polish
   report drawn inside the Record yourself card of a classic session page —
   every Welding day, General English Week 1 and its non-mission days — with
   the week's task sent to the Worker as context. Run: cd tests && npm run
   test:session (or BASE=https://app.lomonec.com node session-report.mjs).

   The Worker is a fixture: STT returns a fixed transcript, analyse returns a
   fixed report and records the context it was sent. This asserts what the
   app builds and stores, not the model's taste. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
const ROOT=new URL("..", import.meta.url).pathname;
let BASE=process.env.BASE,server=null;
if(!BASE){server=spawn("python3",["-m","http.server","8793"],{cwd:ROOT,stdio:"ignore"});await sleep(800);BASE="http://localhost:8793"}
const res=[];const ok=(n,c,d="")=>{res.push(c);console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  — "+d}`)};
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36"});
const page=await ctx.newPage();
const errors=[];page.on("pageerror",e=>errors.push(String(e.message)));
await page.addInitScript(()=>{try{navigator.serviceWorker.register=()=>new Promise(()=>{})}catch(e){}});

const AI={key_message:"I check the joint before I weld it.",clarity:"clear",
 sharper:"Before every weld I check the fit-up, the gap and the bevel, then I start.",
 level:"B1",level_note:"Short sentences, no linking words.",
 structure:["Who I am","What I check","Why"],structure_note:"The order works.",
 answer_directly:"Open with the check, not your name.",
 example:"Before I weld, I check the fit-up.",evidence:"You named the check but not what you look for.",
 credibility:"You said 'I think it is ok', which sounds unsure.",
 hedges:[{said:"I think",better:"It is"}],
 corrections:[{said:"i am check the joint",fix:"I check the joint",why:"Present simple for a routine: no 'am'.",kind:"tense"}],
 sentences:[{said:"i am check the joint before i weld",rebuilt:"I check the joint before I weld it.",pattern:"I check [what] before I [action].",pattern_use:"A routine step."}],
 words:[{said:"ok",better:"within tolerance",meaning:"Inside the allowed limit.",example:"The gap is within tolerance."},
   {said:"check",better:"inspect",meaning:"Look at carefully.",example:"I inspect the joint before I weld it."}],
 collocations:[],remember_title:"Say the check first",remember_body:"Name the check before the result.",
 next_recording:"Describe the same check again, naming the gap and the bevel.",
 quick_win_title:"Drop 'I think'",quick_win_goal:"Zero hedges next time.",
 concept_title:"Routine in present simple",concept_body:"Routines take the present simple.",
 coach_script:"You sounded calm. You said 'I am check the joint'. A routine takes the present simple: 'I check the joint'. Next time, name the gap and the bevel.",
 versions:[{style:"Clear and direct",text:"I am a welder. Before I weld, I check the joint. I look at the gap and the bevel. If it is within tolerance, I start.",learn:["within tolerance"]},
   {style:"Site-ready",text:"I am a welder. Before every weld I inspect the fit-up: the gap and the bevel. Once it is within tolerance, I strike the arc.",learn:["fit-up","strike the arc"]}],
 idioms:[{idiom:"get it right first time",meaning:"No rework.",when:"Quality talk.",example:"We check the fit-up so we get it right first time."},
   {idiom:"sign off",meaning:"Approve formally.",when:"Inspection.",example:"The inspector signs off the weld."},
   {idiom:"on the tools",meaning:"Doing the hands-on work.",when:"Describing your role.",example:"I am on the tools most of the day."},
   {idiom:"down time",meaning:"Time when work stops.",when:"Planning.",example:"A bad fit-up means down time."}]};
const calls=[];
const API="https://be-polish.nore-ngou.workers.dev";
await page.route(API+"/**",async route=>{
  const rq=route.request();const url=rq.url();
  if(rq.method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});
  if(url.includes("fillers=1")){calls.push({kind:"stt"});return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({text:"hello i am a welder and i am check the joint before i weld i think it is ok so i start the weld and then i clean it",words:null})})}
  let body={};try{body=JSON.parse(rq.postData()||"{}")}catch(e){}
  if(body.analyse){calls.push({kind:"analyse",ctx:body.analyse.context||null,lang:body.analyse.lang});return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(AI)})}
  if(body.repolish){calls.push({kind:"repolish",ctx:body.repolish.context||null});return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({version:{style:"Plain",text:"I am a welder and before I weld I always check the joint, the gap and the bevel, then I start.",learn:["check the joint"]},idioms:[]})})}
  return route.fulfill({status:404,headers:{"access-control-allow-origin":"*"},body:""});
});

await page.goto(BASE+"/index.html?t="+Date.now(),{waitUntil:"load"});
await page.evaluate(()=>{OB.name="Check";obFinish()});await sleep(700);
await page.evaluate(()=>{try{wcClose()}catch(e){}document.querySelectorAll(".cf-ov,.wc-ov,#obWrap").forEach(e=>e.remove())});
await page.evaluate(()=>{S.fnd=S.fnd||{};S.fnd["general-english"]={placed:"full",finished:true};S.fnd["welding"]={placed:"full",finished:true};save();go("session",1,"Mon")});await sleep(900);

const a=await page.evaluate(()=>({wrap:!!document.getElementById("sessRepWrap"),head:document.querySelector(".sess-rep-h")?.textContent.trim()||"",idle:document.querySelector("#sessRepWrap .rec-none")?.textContent||"",host:exHost&&exHost.wrapId,key:dayKey(1,"Mon")}));
ok("Week 1 Monday (General English): the Record yourself card carries the report block, idle until there is a recording",a.wrap&&/report/i.test(a.head)&&/Record yourself first/.test(a.idle)&&a.host==="sessRepWrap",JSON.stringify(a));

const blob=()=>new Blob([new Uint8Array(6000)],{type:"audio/webm"});
await page.evaluate(async()=>{await sessReport(dayKey(1,"Mon"),new Blob([new Uint8Array(6000)],{type:"audio/webm"}),21)});await sleep(500);
const b=await page.evaluate(()=>{const w=document.getElementById("sessRepWrap");const q=s=>w.querySelector(s);const rep=S.notes["exrep:"+dayKey(1,"Mon")];
  return {card:!!q(".ex-rep-card"),stations:w.querySelectorAll(".ex-station").length,coach:!!q("#exCoachBtn"),level:q(".ex-level-b")?.textContent||"",corr:w.querySelectorAll(".ex-corr").length,versions:w.querySelectorAll(".ex-version").length,idioms:w.querySelectorAll(".ex-idiom").length,
    stored:!!(rep&&rep.ai&&rep.m&&rep.tx),tk:rep&&rep.tk,ctx:rep&&rep.ctx,targets:rep&&rep.targets,again:!!q(".ex-againbtn"),polishWrap:document.getElementById("exReportWrap")?.innerHTML.length||0,exRep:aList("exRep").length,exReport:ex.report}});
ok("The report is drawn inside the card: five stations, the coach button, level, the correction, two versions and the idioms",b.card&&b.stations===5&&b.coach&&b.level==="B1"&&b.corr===1&&b.versions===2&&b.idioms===4&&b.again,JSON.stringify(b));
ok("It is stored per session day, tagged with the area, with the context it was judged against and the phrases to carry",b.stored&&b.tk==="general-english"&&b.ctx&&b.ctx.track==="general"&&b.ctx.week===1&&b.ctx.day==="Mon"&&b.ctx.focus.length>3&&b.ctx.task.length>3&&Array.isArray(b.targets)&&b.targets.length===4,JSON.stringify({tk:b.tk,ctx:b.ctx,targets:b.targets}));
const an=calls.filter(c=>c.kind==="analyse");
ok("The Worker was told the task: programme, week, day, focus, task and the say-these-aloud phrases",an.length===1&&an[0].ctx&&an[0].ctx.track==="general"&&an[0].ctx.week===1&&an[0].ctx.phrases.length>=3&&an[0].ctx.task.length>3,JSON.stringify(an[0]));
ok("Executive Polish is untouched: its wrap is empty, its list has nothing, its report is null",b.polishWrap===0&&b.exRep===0&&b.exReport===null,JSON.stringify({w:b.polishWrap,n:b.exRep}));

/* the coach speaks from the session's report, scoped to its wrap */
const c=await page.evaluate(async()=>{const w=document.getElementById("sessRepWrap");w.querySelector("#exCoachBtn").click();await new Promise(r=>setTimeout(r,250));const on=w.querySelector("#exCoachBtn").classList.contains("on"),live=w.querySelector("#exCoachLive").classList.contains("on");exCoachStop();await new Promise(r=>setTimeout(r,100));return {on,live,off:!w.querySelector("#exCoachBtn").classList.contains("on"),lines:w.querySelectorAll("#exCoachScript p").length}});
ok("Play coach feedback starts and stops on the session's own report",c.on&&c.live&&c.off&&c.lines>=3,JSON.stringify(c));

/* leave and come back: the report is mounted again, without a new call */
await page.evaluate(()=>go("home"));await sleep(300);
const hostAway=await page.evaluate(()=>exHost);
await page.evaluate(()=>go("session",1,"Mon"));await sleep(900);
const d=await page.evaluate(()=>({card:!!document.querySelector("#sessRepWrap .ex-rep-card"),host:exHost&&exHost.wrapId,rep:exHost&&exHost.report===S.notes["exrep:"+dayKey(1,"Mon")]}));
ok("Leaving clears the host; coming back mounts the stored report again with no new request",hostAway===null&&d.card&&d.host==="sessRepWrap"&&d.rep&&calls.filter(x=>x.kind==="analyse").length===1,JSON.stringify({hostAway,d}));

/* a second take: the carry-over score marks the previous take's targets */
await page.evaluate(async()=>{await sessReport(dayKey(1,"Mon"),new Blob([new Uint8Array(6000)],{type:"audio/webm"}),25)});await sleep(400);
const e=await page.evaluate(()=>{const w=document.getElementById("sessRepWrap");const rep=S.notes["exrep:"+dayKey(1,"Mon")];return {carry:!!w.querySelector(".ex-carry"),score:w.querySelector(".ex-carry-score")?.textContent.trim()||"",prev:!!(rep.prev&&rep.prev.m&&rep.prev.targets.length===4),one:Object.keys(S.notes).filter(k=>k.startsWith("exrep:")).length}});
ok("A second recording keeps the previous take as 'prev': the carry-over score appears and one report per day is kept",e.carry&&/\/4/.test(e.score)&&e.prev&&e.one===1,JSON.stringify(e));

/* Polish it again carries the session's context */
await page.evaluate(async()=>{const b=document.querySelector("#sessRepWrap .ex-repolish");if(b)await exRepolish(b)});await sleep(400);
const rp=calls.filter(x=>x.kind==="repolish");
const f=await page.evaluate(()=>({versions:document.querySelectorAll("#sessRepWrap .ex-version").length}));
ok("Polish it again is sent with the same task context and the third version lands in the session's report",rp.length===1&&rp[0].ctx&&rp[0].ctx.track==="general"&&f.versions===3,JSON.stringify({rp,f}));

/* the sync payload carries the report without the transcript */
const g=await page.evaluate(()=>{const p=fbSyncPayload(S);const k="exrep:"+dayKey(1,"Mon");return {sent:!!(p.notes[k]&&p.notes[k].ai),tx:p.notes[k].tx,local:!!S.notes[k].tx}});
ok("The report syncs with the notes; the minute of speech stays on the device",g.sent&&g.tx===undefined&&g.local,JSON.stringify(g));

/* Executive Polish still renders its own report, in its own wrap */
const h=await page.evaluate(async()=>{go("phrases");await new Promise(r=>setTimeout(r,400));
  const m={sec:30,words:40,wpm:80,fillers:[],fillerN:0,hedges:[],hedgeN:0,sents:3,wps:13,ttr:70,hes:0,hesList:[],semis:2,pitch:null};
  const rep={at:Date.now(),tk:areaId(),m,ai:null,tx:"a polish minute",targets:[]};
  aList("exRep").unshift(rep);ex.report=rep;ex.showReport=true;ex.repOpen=true;exRenderReport(rep,true);await new Promise(r=>setTimeout(r,200));
  return {host:exHost,polish:!!document.querySelector("#exReportWrap .ex-rep-card"),session:document.querySelectorAll("#sessRepWrap .ex-rep-card").length}});
ok("On the Phrase Lab the host is null and the Polish report draws in its own wrap",h.host===null&&h.polish,JSON.stringify(h));

/* Welding: its own key, the welding context, nothing shared with General English */
await page.evaluate(()=>areaSwitch("welding","journey"));await sleep(400);
await page.evaluate(()=>go("session",1,"Mon"));await sleep(900);
const w0=await page.evaluate(()=>({key:dayKey(1,"Mon"),wrap:!!document.getElementById("sessRepWrap"),idle:document.querySelector("#sessRepWrap .rec-none")?.textContent||"",gate:!!document.querySelector(".fnd-gate")}));
ok("Welding Week 1 Monday: its own key, the report block present and idle (no General English report bleeds in)",/^welding:/.test(w0.key)&&w0.wrap&&/Record yourself first/.test(w0.idle),JSON.stringify(w0));
await page.evaluate(async()=>{await sessReport(dayKey(1,"Mon"),new Blob([new Uint8Array(6000)],{type:"audio/webm"}),18)});await sleep(500);
const wa=calls.filter(c=>c.kind==="analyse").pop();
const w1=await page.evaluate(()=>{const rep=S.notes["exrep:"+dayKey(1,"Mon")];return {card:!!document.querySelector("#sessRepWrap .ex-rep-card"),tk:rep&&rep.tk,track:rep&&rep.ctx.track,ge:!!S.notes["exrep:w1Mon"],keys:Object.keys(S.notes).filter(k=>k.startsWith("exrep:")).sort()}});
ok("The Welding report is judged as welding — the Worker is told track 'welding' with that programme's task and phrases — and sits beside, not over, the General English one",w1.card&&w1.tk==="welding"&&w1.track==="welding"&&wa.ctx.track==="welding"&&wa.ctx.phrases.length>=1&&w1.ge&&w1.keys.length===2,JSON.stringify({w1,ctx:wa.ctx}));

/* too short, offline, and a take that cannot be transcribed all say so */
const s1=await page.evaluate(async()=>{await sessReport(dayKey(1,"Mon"),new Blob([new Uint8Array(6000)],{type:"audio/webm"}),4);return document.querySelector("#sessRepWrap .ex-note")?.textContent||""});
ok("A recording under the minimum length gets a plain note, not a report",/at least 8 seconds/.test(s1),s1);
await page.evaluate(()=>go("session",1,"Mon"));await sleep(700);
const s2=await page.evaluate(()=>!!document.querySelector("#sessRepWrap .ex-rep-card"));
ok("The stored report is back after the note",s2);

ok("No page errors",errors.length===0,errors.join(" | "));
await browser.close();if(server)server.kill();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean)?0:1);
