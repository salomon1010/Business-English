/* STEP 4 is the SAME page as step 2 (owner, 8 Nov 2026): five complete sentences from the
   learner's own working day, mastered at 80%, rewritten up to three times — never the bare
   patterns ("My focus is on…") the owner rejected.
   Run: node tests/rehearse-sentences.mjs   (BASE= a server for THIS tree) */
import {chromium} from "playwright";
const BASE=process.env.BASE||"http://localhost:8000";
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:430,height:930}})).newPage();
const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
await p.goto(BASE+"/index.html?flags=onboarding_v2_enabled,home_v2_enabled,daily_learning_plan_pilot_enabled");
await p.waitForFunction(()=>typeof window.dlpSentRec==="function"&&typeof window.dlpRehearseHTML==="function",null,{timeout:30000});

const r=await p.evaluate(async()=>{
  const out={};
  S.profile=Object.assign({},S.profile,{name:"Hassan",role:"Welder",lang:"en"});
  try{
    LearnerProfile.set(S,"role",{role:"Welder",roleId:"trades.welder",roleCat:"trades"});
    LearnerProfile.set(S,"situations",{situations:["presentations"],primarySituation:"presentations"});
  }catch(e){}
  const plan={week:1,day:"Mon",competencyObjective:"Pronunciation baseline",
    personalizedScenario:{personalized:false,task:"Introduce yourself"},
    targetExpressions:["I currently work as","My focus is on","I work closely with","I'm responsible for","A big part of my role is"],
    pronunciationFocus:{declared:[]},supportingVideo:null};
  _dlpEntry={lessonId:"R1",plan,step:"rehearse",stepData:{},reached:"rehearse"};
  S.dlp={R1:_dlpEntry};

  /* the page before anything is written: it asks for the sentences, it does not list patterns */
  out.pending=dlpRehearseHTML(plan,"k",1,"Mon");

  /* offline (no account in a test page) -> the device's own five, which must still be SENTENCES */
  await dlpBuildSentences(plan,"k",1,"Mon",false,"rehearse");
  const L=()=>_dlpEntry.stepData.rehearse||{};
  out.r0={sentences:(L().sentences||[]).map(x=>x.text),local:L().local,polished:L().polished};
  out.html=dlpRehearseHTML(plan,"k",1,"Mon");
  out.learnUntouched=JSON.stringify(_dlpEntry.stepData.learn||null);

  /* the rows render, with their own ids, and drive the shared report */
  document.body.insertAdjacentHTML("beforeend",`<div id="hostR">${out.html}</div>`);
  const sx=L().sentences[0];
  const key=dlpSentHost(0,sx.text,"rehearse");
  out.key=key;
  const al=fndAlign(sx.text,sx.text.split(" ").slice(0,4).join(" "));
  _fndRep[key]={heard:sx.text.split(" ").slice(0,4).join(" "),al,pct:al.pct};
  dlpSentReports("rehearse");
  const box=document.getElementById("dlpResr0");
  out.rep={box:!!box,check:!!(box&&box.querySelector("details.fnd-check")),
    drills:box?[...box.querySelectorAll("[data-drill]")].map(x=>x.getAttribute("onclick")):[],
    again:box&&box.querySelector(".fnd-again")?box.querySelector(".fnd-again").getAttribute("onclick"):""};

  /* three rewrites, each a different five, and the cap holds */
  const seen=[out.r0.sentences.join("|")];
  for(let i=0;i<3;i++){await dlpBuildSentences(plan,"k",1,"Mon",true,"rehearse");seen.push((L().sentences||[]).map(x=>x.text).join("|"))}
  out.rounds=seen;out.polished=L().polished;
  out.capMsg="";
  const old=window.toast;window.toast=m=>{out.capMsg=m};
  dlpLearnPolish("k",1,"Mon","rehearse");
  window.toast=old;
  out.afterCap=L().polished;
  return out;
});

const has=(h,s)=>String(h).includes(s);
const STUBS=["I currently work as…","My focus is on…","I work closely with…","I'm responsible for…","A big part of my role is…"];
const rows=[
 ["step 4 no longer lists the bare patterns", !STUBS.some(x=>has(r.html,x))&&!has(r.html,"dlp-expr-list")],
 ["…and never the old per-expression recorder", !has(r.html,"dlpRecord('rehearse'")],
 ["it asks for the sentences before it has them", has(r.pending,"dlpSentWrap")&&!has(r.pending,"dlp-expr-list")],
 ["five sentences", r.r0.sentences.length===5],
 ["every one is a COMPLETE sentence, not a pattern", r.r0.sentences.every(x=>/[.!?]$/.test(x)&&x.split(/\s+/).length>=7&&!/[…]|\.\.\.$/.test(x))],
 ["they are about the working day, not another self-introduction", !r.r0.sentences.some(x=>/^I currently work as\b/i.test(x))],
 ["the learner's own situation is in them", r.r0.sentences.some(x=>/presentation/i.test(x))],
 ["the page names their job", has(r.html,"Welder")&&has(r.html,"Hassan")],
 ["the same 80% rule is stated", has(r.html,"80")],
 ["step 2's set is untouched by step 4", r.learnUntouched==="null"],
 ["step 4 has its own report key", r.key==="dlp:rehearse:0"],
 ["…and its own row id, so the two pages cannot collide", r.rep.box===true&&r.rep.check===true],
 ["…driving the shared drill and re-record", r.rep.drills.every(x=>/fndDrillKey\("dlp:rehearse:0"/.test(x))&&/dlpSentRec\(0,'rehearse'\)/.test(r.rep.again||"")],
 ["Another version is offered from the start", has(r.html,"dlpLearnPolish")&&!/class="btn btn-g" disabled/.test(r.html)],
 ["three rewrites, each a different five", new Set(r.rounds).size===4],
 ["the cap is three", r.polished===3&&r.afterCap===3&&/3/.test(r.capMsg||"")],
 ["no page errors", errs.length===0],
];
let bad=0;
for(const [n,ok] of rows){ if(!ok)bad++; console.log((ok?"ok  ":"FAIL")+"  "+n); }
console.log("\nround 0:\n - "+r.r0.sentences.join("\n - "));
if(errs.length)console.log("errors:",errs);
console.log("\n"+(rows.length-bad)+"/"+rows.length+" passed");
await b.close();
process.exit(bad?1:0);
