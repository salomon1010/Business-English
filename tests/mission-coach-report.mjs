/* The Coach step's speaking report (owner, 24 Sep 2026): after the learner
   speaks in a V2 mission, the Coach step shows the Executive Polish report —
   the same report the Phrase Lab and the session's Record yourself card draw —
   judged against the mission (competency, the question asked, the goal, the
   moves' patterns as the phrases to use). The mission's own did-well /
   to-improve report is no longer on that screen; the evidence (moves,
   coverage, state, history) is untouched.

   Run: cd tests && node mission-coach-report.mjs
   The Worker is a fixture: STT returns a fixed transcript, analyse returns a
   fixed report and records the context it was sent; mvreport (the evidence
   pass) answers as before. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";

const res=[];const ok=(n,c,d="")=>{res.push(!!c);console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  — "+d}`)};
let BASE=process.env.BASE,server=null;
if(!BASE){
  const root=new URL("..",import.meta.url).pathname;const mine=readFileSync(root+"index.html","utf8");
  for(const port of [8051,8052,8053,8054,8055]){
    const s=spawn("python3",["-m","http.server",String(port)],{cwd:root,stdio:"ignore"});await sleep(700);
    let served=null;try{served=await (await fetch(`http://localhost:${port}/index.html`)).text()}catch(e){}
    if(served&&served.length===mine.length){server=s;BASE=`http://localhost:${port}`;break}
    s.kill();console.log(`  (port ${port} is serving someone else's tree — trying the next one)`);
  }
  if(!BASE){console.error("Could not start a server on a free port. Pass BASE=… instead.");process.exit(1)}
}
console.log("  serving: "+BASE);
const POLISH="https://be-polish.nore-ngou.workers.dev";
const browser=await chromium.launch({args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]});
const errors=[];
const AI={key_message:"I look after the weekly delivery reports.",clarity:"clear",
 sharper:"I am the operations analyst who keeps the weekly delivery reports honest.",
 level:"B1+",level_note:"Clear sentences; the link between tasks and why they matter is missing.",
 structure:["Role","Responsibility","Right now"],structure_note:"The order works.",
 answer_directly:"Open with the role, then say who it is for.",
 example:"I am an operations analyst in logistics.",evidence:"You named the reports but not who reads them.",
 credibility:"You said 'I think I do the reports', which sounds unsure.",
 hedges:[{said:"I think",better:"I do"}],
 corrections:[{said:"i am responsible of",fix:"I am responsible for",why:"'Responsible' takes 'for'.",kind:"preposition"}],
 sentences:[{said:"i am responsible of the weekly reports",rebuilt:"I am responsible for the weekly delivery reports.",pattern:"I am responsible for [what].",pattern_use:"Naming a duty."}],
 words:[{said:"do",better:"produce",meaning:"Make and deliver.",example:"I produce the weekly reports."},{said:"help",better:"support",meaning:"Give practical help.",example:"I support the warehouse managers."}],
 collocations:[],remember_title:"Say who it is for",remember_body:"Name the reader of your work.",
 next_recording:"Answer the same question again and say who your reports are for.",
 quick_win_title:"Drop 'I think'",quick_win_goal:"Zero hedges next time.",
 concept_title:"Role before detail",concept_body:"Listeners need the role first.",
 coach_script:"You sounded calm. You said 'responsible of'. It is 'responsible for'. Say the role first, then who your work is for. Next time, name who reads the reports.",
 versions:[{style:"Clear and direct",text:"I am an operations analyst. I produce the weekly delivery reports. Right now I am rebuilding how we track late shipments.",learn:["late shipments"]},
   {style:"Executive polish",text:"I lead the delivery reporting for logistics, so the warehouse managers see a problem before the customer does.",learn:["before the customer does"]}],
 idioms:[{idiom:"keep on top of",meaning:"Stay in control of.",when:"Describing duties.",example:"I keep on top of the delivery data."}]};
const calls=[];
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:["microphone"]});
await ctx.addInitScript(()=>{ try{localStorage.setItem("be_missions","1")}catch(e){} /* V2 missions are hidden in production — on for this suite */
  try{navigator.serviceWorker.register=()=>new Promise(()=>{})}catch(e){}
  class F{constructor(){this._t=null}
    _fire(){const txt=window.__say||"";if(txt&&this.onresult){const r=[{0:{transcript:txt,confidence:.9},isFinal:true,length:1}];r.length=1;try{this.onresult({results:r,resultIndex:0})}catch(e){}}}
    _end(){this._on=false;if(this._t){clearTimeout(this._t);this._t=null}if(this.onend)setTimeout(()=>{try{this.onend()}catch(e){}},0)}
    start(){this._on=true;this._t=setTimeout(()=>{if(!this._on)return;this._fire();this._end()},120)}
    stop(){if(this._on)this._fire();this._end()}abort(){this._on=false;this._end()}}
  window.SpeechRecognition=F;window.webkitSpeechRecognition=F;
  if(!localStorage.getItem("be12_v1")){
    const st={profile:{name:"Test",role:"",goal:"Speak with confidence in meetings",slot:"",lang:"en",ts:Date.now()},professionalTracks:{activeId:"general-english"},
      fnd:{"general-english":{placed:"full",finished:true,day:15,done:{},checkedAt:Date.now()},"welding":{placed:"full",finished:true,day:15,done:{},checkedAt:Date.now()}},
      days:{},dates:[],dayLog:{},steps:{},scores:{},notes:{},rmSeen:Date.now(),lastSeen:Date.now()};
    localStorage.setItem("be12_v1",JSON.stringify(st));
  }
});
let sttMode="ok";
await ctx.route(u=>u.href.startsWith(POLISH),async route=>{
  const rq=route.request();const url=rq.url();
  if(rq.method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});
  if(url.includes("fillers=1")){calls.push({kind:"stt"});if(sttMode==="fail")return route.fulfill({status:500,headers:{"access-control-allow-origin":"*"},body:""});
    return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({text:"i think i do the reports i am responsible of the weekly reports and i help the warehouse managers",words:null})})}
  let b={};try{b=JSON.parse(rq.postData()||"{}")}catch(e){}
  if(b.analyse){calls.push({kind:"analyse",ctx:b.analyse.context||null,lang:b.analyse.lang});return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(AI)})}
  if(b.assess)return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({overall:86,mode:"ai",words:[{word:"a",score:86}]})});
  if(b.mvreport){calls.push({kind:"mvreport"});return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({covered:[],
    well:[{move:"role",note:"You named the role."}],improve:[{move:"why",note:"Say why the job exists."}],
    better:"I am responsible for the weekly reports and I help the warehouse managers.",expressions:[{e:"I am responsible for",why:"a duty"}],one:"Say who your work is for."})})}
  return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"{}"});
});
const page=await ctx.newPage();
page.on("pageerror",e=>errors.push(String(e.message)));
await page.goto(BASE+"/index.html?mc="+Date.now(),{waitUntil:"load"});await sleep(1000);
await page.evaluate(()=>document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e=>e.remove()));

async function speak(text){
  await page.evaluate(t=>{window.__say=t},text);
  await page.evaluate(()=>mvRecord());
  await page.waitForFunction(()=>rec.mr&&rec.mr.state==="recording",null,{timeout:8000});
  await sleep(1500);
  await page.evaluate(()=>mvRecord());
  await page.waitForFunction(()=>_mv&&!_mv.busy&&(_mv.ev||_mv.err),null,{timeout:15000}).catch(()=>{});
  await page.waitForFunction(()=>typeof _mvRepBusy!=="undefined"&&_mvRepBusy===null,null,{timeout:15000}).catch(()=>{});
  await sleep(300);
}
const SAID="I think I do the reports. I am responsible of the weekly reports and I help the warehouse managers.";

/* 1 · speak in Week 1's guided mission → the Coach step is the speaking report */
await page.evaluate(()=>mvGo("explain-work-guided","speak"));await sleep(300);
await speak(SAID);
const a=await page.evaluate(()=>{const v=document.getElementById("v-mission");const w=document.getElementById("mvRepWrap");const q=s=>w&&w.querySelector(s);
  const key=_mv.ev.key,rep=S.notes["exrep:"+key];
  return {step:_mv.step,wrap:!!w,head:(v.querySelector(".mv-rep-head .eyebrow")||{}).innerText||"",chips:v.querySelectorAll(".mv-rep-head .mv-move").length,
    card:!!q(".ex-rep-card"),stations:w?w.querySelectorAll(".ex-station").length:0,coach:!!q("#exCoachBtn"),level:(q(".ex-level-b")||{}).textContent||"",corr:w?w.querySelectorAll(".ex-corr").length:0,versions:w?w.querySelectorAll(".ex-version").length:0,again:!!q(".ex-againbtn"),
    oldReport:!!v.querySelector(".mv-rep-well, .mv-rep-big, .mv-better-t, .mv-folds"),host:exHost&&exHost.wrapId,hostKey:exHost&&exHost.key===key,
    stored:!!(rep&&rep.ai&&rep.m&&rep.tx),tk:rep&&rep.tk,mission:rep&&rep.mission,ctx:rep&&rep.ctx,targets:rep&&rep.targets,
    dock:!!v.querySelector(".mv-dock .btn-primary"),dockText:(v.querySelector(".mv-dock .btn-primary")||{}).innerText||"",
    row:(()=>{const r=mvStore()["explain-work"];const at=r&&r.attempts||[];const x=at[at.length-1];return x?{answered:x.answered,pending:!!x.coachPending,report:!!x.report}:null})(),
    polishWrap:(document.getElementById("exReportWrap")||{innerHTML:""}).innerHTML.length,exRep:aList("exRep").length}});
ok("After speaking, the Coach step IS the speaking report: five stations, the coach button, level, the correction, two versions, Say it again",
  a.step==="coach"&&a.wrap&&a.card&&a.stations===5&&a.coach&&a.level==="B1+"&&a.corr===1&&a.versions===2&&a.again,JSON.stringify(a));
ok("The mission's old did-well / to-improve report is gone from that screen; the move chips head it once",
  !a.oldReport&&/speaking report/i.test(a.head)&&a.chips===5,JSON.stringify({old:a.oldReport,head:a.head,chips:a.chips}));
ok("The host is the mission's wrap, keyed to this attempt; Executive Polish's own wrap and list are untouched",
  a.host==="mvRepWrap"&&a.hostKey&&a.polishWrap===0&&a.exRep===0,JSON.stringify({host:a.host,k:a.hostKey,pw:a.polishWrap,n:a.exRep}));
ok("The report is stored per attempt, tagged with the area and the mission, with the context it was judged against and the phrases to carry",
  a.stored&&a.tk==="general-english"&&a.mission==="explain-work-guided"&&a.ctx&&a.ctx.track==="general"&&a.ctx.week===1&&Array.isArray(a.targets)&&a.targets.length>=1,JSON.stringify({tk:a.tk,m:a.mission,ctx:a.ctx,t:a.targets}));
const an=calls.filter(c=>c.kind==="analyse");
ok("The Worker was told the mission: programme, week, the competency as focus, the question and situation as the task, the goal, the moves' patterns as phrases",
  an.length===1&&an[0].ctx&&an[0].ctx.track==="general"&&an[0].ctx.week===1&&/explain what you do/i.test(an[0].ctx.focus)&&/what do you actually do here/i.test(an[0].ctx.task)&&/30 seconds/.test(an[0].ctx.out)&&an[0].ctx.phrases.length>=3&&an[0].ctx.phrases.length<=6,JSON.stringify(an[0]));
ok("The evidence pass still ran beside it: the attempt row is answered, not pending, and carries the mission's own report for the history; the dock offers the engine's next step",
  calls.some(c=>c.kind==="mvreport")&&a.row&&a.row.answered&&!a.row.pending&&a.row.report&&a.dock&&a.dockText.length>0,JSON.stringify({row:a.row,dock:a.dockText}));

/* 2 · the coach speaks from the mission's report, scoped to its wrap */
const c=await page.evaluate(async()=>{const w=document.getElementById("mvRepWrap");w.querySelector("#exCoachBtn").click();await new Promise(r=>setTimeout(r,250));const on=w.querySelector("#exCoachBtn").classList.contains("on"),live=w.querySelector("#exCoachLive").classList.contains("on");exCoachStop();await new Promise(r=>setTimeout(r,100));return {on,live,off:!w.querySelector("#exCoachBtn").classList.contains("on"),lines:w.querySelectorAll("#exCoachScript p").length}});
ok("Play coach feedback starts and stops on the mission's own report",c.on&&c.live&&c.off&&c.lines>=3,JSON.stringify(c));

/* 3 · Say it again = the mission's retry; leaving clears the host */
await page.evaluate(()=>exAgainGo());await sleep(300);
const d=await page.evaluate(()=>({step:_mv.step,retry:!!_mv.retry,mic:!!document.getElementById("recBtn")}));
ok("Say it again goes back to the Speak step as a retry, mic ready",d.step==="speak"&&d.retry&&d.mic,JSON.stringify(d));
await page.evaluate(()=>go("home"));await sleep(300);
const hostAway=await page.evaluate(()=>exHost);
ok("Leaving the mission clears the host",hostAway===null,JSON.stringify(hostAway));

/* 4 · a second attempt at the same mission: the previous take is 'prev' → carry-over score */
await page.evaluate(()=>mvGo("explain-work-guided","speak"));await sleep(300);
await speak(SAID.replace("I help","I support"));
const e=await page.evaluate(()=>{const w=document.getElementById("mvRepWrap");const rep=S.notes["exrep:"+_mv.ev.key];return {card:!!w.querySelector(".ex-rep-card"),carry:!!w.querySelector(".ex-carry"),score:(w.querySelector(".ex-carry-score")||{}).textContent||"",prev:!!(rep&&rep.prev&&rep.prev.m&&Array.isArray(rep.prev.targets)),keys:Object.keys(S.notes).filter(k=>k.startsWith("exrep:")).length,attempts:mvStore()["explain-work"].attempts.filter(x=>x.answered).length}});
ok("A second attempt keeps the first as 'prev': the carry-over score appears, two reports kept, two attempts on the record",
  e.card&&e.carry&&/\//.test(e.score)&&e.prev&&e.keys===2&&e.attempts===2,JSON.stringify(e));

/* 5 · the transcript never syncs; the report does */
const g=await page.evaluate(()=>{const p=fbSyncPayload(S);const k="exrep:"+_mv.ev.key;return {sent:!!(p.notes[k]&&p.notes[k].ai),tx:p.notes[k]&&p.notes[k].tx,local:!!S.notes[k].tx}});
ok("The report syncs with the notes; the minute of speech stays on the device",g.sent&&g.tx===undefined&&g.local,JSON.stringify(g));

/* 6 · STT down: the plain note and a Get my report button; the evidence is still saved */
sttMode="fail";
await page.evaluate(()=>mvGo("explain-work-guided","speak"));await sleep(300);
await speak(SAID);
const f=await page.evaluate(()=>{const w=document.getElementById("mvRepWrap");return {note:(w.querySelector(".ex-note")||{}).textContent||"",btn:!!w.querySelector(".sess-rep-btn"),card:!!w.querySelector(".ex-rep-card"),attempts:mvStore()["explain-work"].attempts.filter(x=>x.answered).length,dock:!!document.querySelector(".mv-dock .btn-primary")}});
ok("With the transcription down the step says so plainly and offers Get my report; the attempt is still recorded and the dock still offers the next step",
  /could not write down/i.test(f.note)&&f.btn&&!f.card&&f.attempts===3&&f.dock,JSON.stringify(f));
sttMode="ok";
await page.evaluate(()=>mvReportLast());
await page.waitForFunction(()=>_mvRepBusy===null&&!!document.querySelector("#mvRepWrap .ex-rep-card"),null,{timeout:15000}).catch(()=>{});
const h=await page.evaluate(()=>({card:!!document.querySelector("#mvRepWrap .ex-rep-card"),keys:Object.keys(S.notes).filter(k=>k.startsWith("exrep:")).length}));
ok("Get my report sends the same recording again and the report lands on the same attempt",h.card&&h.keys===3,JSON.stringify(h));

/* 7 · the Speaking History still opens the mission's own stored reports */
const hist=await page.evaluate(()=>{go("mvhist");return new Promise(r=>setTimeout(()=>{const rows=document.querySelectorAll(".mv-hist-row");r({rows:rows.length})},400))});
ok("The Speaking History still lists every attempt",hist.rows===3,JSON.stringify(hist));

/* 8 · desktop width: no horizontal overflow on the report */
await page.setViewportSize({width:1280,height:800});
await page.evaluate(()=>{mvGo("explain-work-guided","coach")});await sleep(400);
const wide=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,card:!!document.querySelector("#mvRepWrap .ex-rep-card, #mvRepWrap .ex-note")}));
ok("At 1280×800 the coach step renders without horizontal overflow",!wide.overflow,JSON.stringify(wide));

ok("No page errors",errors.length===0,errors.join(" | "));
await browser.close();if(server)server.kill();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean)?0:1);
