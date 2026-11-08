import {chromium} from "playwright";
const BASE=process.env.BASE||"http://localhost:8000";
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:430,height:930}});
const p=await c.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
await p.goto(BASE+"/index.html?flags=onboarding_v2_enabled,home_v2_enabled,daily_learning_plan_pilot_enabled");
await p.waitForFunction(()=>typeof window.dlpSentRec==="function"&&typeof window.fndAlign==="function",null,{timeout:30000});

const r=await p.evaluate(()=>{
  const out={};
  S.profile=Object.assign({},S.profile,{name:"Hassan",role:"Welder",lang:"fr"});
  try{S.ob2=Object.assign({},S.ob2,{roleId:"trades.welder",situations:["presentations"],goalId:"accent",priorities:["accent"]})}catch(e){}
  out.name=dlpLearnerName();
  out.you=dlpYouLine();
  out.pass=dlpPass();
  out.max=DLP_POLISH_MAX;
  // a fake lesson entry
  const sents=[1,2,3,4,5].map(i=>({text:"I am responsible for the quality of the work that leaves my hands number "+i+"."}));
  _dlpEntry={plan:{targetExpressions:["I work as","I am responsible for","My focus is on","I work closely with","My background in","Part of my role is"]},
    stepData:{learn:{sentences:sents,profile:"Welder",intro:"",takes:{},pass:{},res:{}}},step:"learn"};
  out.html0=dlpLearnHTML(_dlpEntry.plan,"k",1,"mon");
  // sentence 1 below the bar -> no pass, 2 stays locked
  const L=_dlpEntry.stepData.learn;
  const bad=fndAlign(sents[0].text,"I am responsible for the quality");
  L.res[0]={pct:bad.pct,heard:"I am responsible for the quality",at:Date.now()};
  out.pct_partial=bad.pct;
  out.html1=dlpLearnHTML(_dlpEntry.plan,"k",1,"mon");
  // and the SHARED Foundations report, drawn into the row by the shared renderer
  document.body.innerHTML=`<div>${out.html1}</div>`;
  const key=dlpSentHost(0,sents[0].text);
  _fndRep[key]={heard:"I am responsible for the quality",al:bad,pct:bad.pct};
  _fndTips[fndTipKey("leaves",fndH(key).lang)]={ipa:"livz",say:"LEEVZ",tip:"Say the v, not an f."};
  out.tipLang=fndH(key).lang;
  fndDrawScoreKey(key);
  const box=document.getElementById("dlpRes0");
  out.rep={
    html:box.innerHTML,
    check:!!box.querySelector("details.fnd-check"),
    pct:(box.querySelector(".fnd-overall")||{}).textContent||"",
    said:!!box.querySelector('.fnd-grp[data-g="said"]'),
    target:!!box.querySelector('.fnd-grp[data-g="target"]'),
    fix:!!box.querySelector('.fnd-grp[data-g="fix"]'),
    fixCards:box.querySelectorAll(".fnd-fix").length,
    drills:[...box.querySelectorAll("[data-drill]")].map(b=>b.getAttribute("onclick")),
    again:(box.querySelector(".fnd-again")||{}).getAttribute?box.querySelector(".fnd-again").getAttribute("onclick"):"",
    badWords:[...box.querySelectorAll(".fnd-w.bad")].length,
    ipa:/livz/.test(box.innerHTML),
  };
  // now pass all five
  sents.forEach((s,i)=>{const a=fndAlign(s.text,s.text);L.res[i]={pct:a.pct,heard:s.text,at:Date.now()};L.pass[i]=true});
  L.done=true;
  out.pct_full=fndAlign(sents[0].text,sents[0].text).pct;
  out.html2=dlpLearnHTML(_dlpEntry.plan,"k",1,"mon");
  // offline polish rounds must differ
  const plan=_dlpEntry.plan;
  out.r0=dlpLocalSentences(plan,0).map(x=>x.text);
  out.r1=dlpLocalSentences(plan,1).map(x=>x.text);
  out.r2=dlpLocalSentences(plan,2).map(x=>x.text);
  // a real polish round must not re-emit the set already on screen
  (function(){
    const L=_dlpEntry.stepData.learn;
    L.sentences=dlpLocalSentences(plan,0);L.polished=0;L.pass={};L.res={};L.done=true;
    out.before=L.sentences.map(x=>x.text);
  })();
  return out;
});

const r2=await p.evaluate(async()=>{
  await dlpBuildSentences(_dlpEntry.plan,"k",1,"mon",true);   // offline: no POLISH_API
  const L=_dlpEntry.stepData.learn;
  return {after:L.sentences.map(x=>x.text),polished:L.polished,pass:Object.keys(L.pass||{}).length,done:L.done};
});
r.after=r2.after;r.polished=r2.polished;r.passReset=r2.pass;r.doneKept=r2.done;

const has=(h,s)=>h.includes(s);
const rows=[
 ["name read from profile", r.name==="Hassan"],
 ["you-line names them + role", /Hassan/.test(r.you)&&/welder/i.test(r.you)],
 ["pass bar is 80", r.pass===80],
 ["polish max 3", r.max===3],
 ["fresh: sentence 2 locked", (r.html0.match(/dlp-sent lock/g)||[]).length===4],
 ["fresh: Continue disabled", /class="btn-primary" disabled/.test(r.html0)],
 /* Owner, 8 Nov 2026: "Another version" no longer waits for all five to be mastered — a learner
    who cannot get on with this set must be able to ask for another one. Three remains the cap. */
 ["fresh: Another version is already offered", !/class="btn btn-g" disabled/.test(r.html0)&&r.html0.includes("dlpLearnPolish")],
 ["fresh: skip offered", has(r.html0,"dlp-skip")],
 ["heading carries the name", has(r.html0,"Hassan")],
 ["partial take scores <80", r.pct_partial<80 && r.pct_partial>0],
 ["partial: 2 still locked", (r.html1.match(/dlp-sent lock/g)||[]).length===4],
 ["the row does not repeat the report's %", !has(r.html1,"dlp.sent_pct")&&!/chip" style="color/.test(r.html1)],
 ["step 2 draws the FOUNDATIONS report", r.rep.check===true],
 ["…with the same percentage badge", r.rep.pct===r.pct_partial+"%"],
 ["…What you said", r.rep.said===true],
 ["…The sentence", r.rep.target===true],
 ["…Words to correct", r.rep.fix===true],
 ["…one fix card per wrong word", r.rep.fixCards>0],
 ["…words marked wrong", r.rep.badWords>0],
 ["…IPA and the tip from the shared cache", r.rep.ipa===true],
 ["…Practise this word drives the shared drill", r.rep.drills.length>0&&r.rep.drills.every(x=>/fndDrillKey\("dlp:learn:0"/.test(x))],
 ["…Say it again re-records THIS sentence", /dlpSentRec\(0\)/.test(r.rep.again||"")],
 ["exact take scores 100", r.pct_full===100],
 ["all passed: no locks", !/dlp-sent lock/.test(r.html2)],
 ["all passed: Continue live", !/class="btn-primary" disabled/.test(r.html2)],
 ["all passed: polish live", !/class="btn btn-g" disabled/.test(r.html2)],
 ["all passed: 5 of 5", has(r.html2,"5 of 5")||has(r.html2,"5 sur 5")],
 ["polish r1 differs from r0", r.r0.join("|")!==r.r1.join("|")],
 ["polish r2 differs from r1", r.r1.join("|")!==r.r2.join("|")],
 ["polish r2 differs from r0", r.r0.join("|")!==r.r2.join("|")],
 ["every round has 5", r.r0.length===5&&r.r1.length===5&&r.r2.length===5],
 ["first polish yields a new five", r.before.join("|")!==r.after.join("|")],
 ["first polish counts as 1", r.polished===1],
 ["polish clears the marks", r.passReset===0],
 ["polish keeps the right to continue", r.doneKept===true],
 ["no page errors", errs.length===0],
];
let bad=0;
for(const [n,ok] of rows){ if(!ok)bad++; console.log((ok?"ok  ":"FAIL")+"  "+n); }
console.log("\nyou-line:", r.you);
console.log("round0:\n - "+r.r0.join("\n - "));
console.log("round1:\n - "+r.r1.join("\n - "));
console.log("round2:\n - "+r.r2.join("\n - "));
if(errs.length)console.log("errors:",errs);
console.log("\n"+(rows.length-bad)+"/"+rows.length+" passed");
await b.close();
process.exit(bad?1:0);
