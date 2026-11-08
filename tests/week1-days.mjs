/* WEEK 1, EVERY DAY (owner, 8 Nov 2026): each day runs the guided flow with the tools its own
   curriculum task calls for — "maybe this one, the Tuesday, this is just 4 steps".
   Loads with domcontentloaded: the page's YouTube thumbnails can hang the `load` event.
   Run: node tests/week1-days.mjs   (BASE= a server for THIS tree) */
import {chromium} from "playwright";
const BASE=process.env.BASE||"http://localhost:8000";
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:430,height:930}})).newPage();
const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
await p.goto(BASE+"/index.html?flags=onboarding_v2_enabled,home_v2_enabled,daily_learning_plan_pilot_enabled",{waitUntil:"domcontentloaded"});
await p.waitForFunction(()=>typeof window.dlpOn==="function"&&typeof window.curriculumOrEmpty==="function"
  &&(curriculumOrEmpty().weeks||[]).length>0,null,{timeout:30000});

const r=await p.evaluate(()=>{
  const out={days:{},errs:[]};
  S.profile=Object.assign({},S.profile,{name:"Hassan",role:"Welder",lang:"en"});
  try{LearnerProfile.set(S,"role",{role:"Welder",roleId:"trades.welder",roleCat:"trades"});
    LearnerProfile.set(S,"situations",{situations:["presentations"],primarySituation:"presentations"});}catch(e){}
  const wk=curriculumOrEmpty().weeks[0];
  out.on={};
  Object.keys(wk.days).forEach(d=>{out.on[d]=dlpOn(1,d)});
  out.offWeek2=dlpOn(2,"Mon");
  const el=document.getElementById("v-journey");
  Object.keys(wk.days).forEach(d=>{
    try{
      S.dlp={};                                   /* a fresh learner for each day */
      const video=DailyPlan.pickSupportingVideo(trackShadowStarters(),dlpVideoKeywords());
      const phrases=trackPhrases().filter(x=>x.w===1&&!x.i).slice(0,5);
      const e=DailyPlan.start(S,{trackId:"general",w:1,day:d,pack:dlpPack(),profile:dlpProfile(),phrases:dlpPool(1,phrases),video});
      if(!e){out.days[d]={fail:"no plan"};return}
      const v=DailyPlan.validate(e.plan);
      _dlpEntry=e;
      document.querySelectorAll(".view").forEach(x=>x.classList.remove("on"));el.classList.add("on");
      dlpRenderStep(el,1,d,dayKey(1,d));
      out.days[d]={shape:e.plan.shape,steps:e.plan.steps,first:e.step,valid:v.valid,
        focus:e.plan.competencyObjective,exprs:(e.plan.targetExpressions||[]).length,
        dots:el.querySelectorAll(".dlp-steps > *").length,
        rendered:(el.querySelector("#dlpBody")||{}).innerHTML?true:false,
        chip:(el.querySelector(".chip")||{}).textContent||"",
        task:(el.querySelector(".dlp-task-b p")||{}).textContent||"",
        exprList:(e.plan.targetExpressions||[]).join("|"),
        score:dlpDayScore(e.plan).rows.map(x=>x.k)};
    }catch(err){out.days[d]={fail:String(err)}}
  });
  return out;
});

const D=r.days, day=k=>D[k]||{};
const EXPECT={Mon:["try","learn","listen","rehearse","converse","improve","finish"],
  Tue:["try","learn","converse","improve","finish"],
  Wed:["learn","rehearse","converse","finish"],
  Thu:["try","learn","converse","improve","finish"],
  Fri:["listen","rehearse","try","improve","finish"],
  Sat:["try","learn","converse","improve","finish"],
  Sun:["converse","finish"]};
const rows=[
 ["every day of week 1 runs the guided flow", Object.keys(r.on).length===7&&Object.values(r.on).every(Boolean)],
 ["week 2 is deliberately still the old page", r.offWeek2===false],
 ["every day builds a valid plan", Object.keys(D).every(k=>D[k].valid===true)],
 ["every day renders without throwing", Object.keys(D).every(k=>D[k].rendered===true)],
 ["every day carries its own focus from the curriculum", new Set(Object.keys(D).map(k=>D[k].focus)).size===7],
 ["every day has target expressions", Object.keys(D).every(k=>D[k].exprs>0)],
 ["Monday keeps the full shadowing loop", day("Mon").shape==="shadow"&&day("Mon").steps.join()===EXPECT.Mon.join()],
 ["Tuesday is the speaking loop, not the rhythm one", day("Tue").shape==="speak"&&day("Tue").steps.join()===EXPECT.Tue.join()],
 ["Wednesday starts in the sentence tools", day("Wed").shape==="vocab"&&day("Wed").steps.join()===EXPECT.Wed.join()&&day("Wed").first==="learn"],
 ["Thursday is the speaking loop", day("Thu").steps.join()===EXPECT.Thu.join()],
 ["Friday puts the redo after the rhythm work", day("Fri").shape==="rhythm"&&day("Fri").steps.join()===EXPECT.Fri.join()&&day("Fri").first==="listen"],
 ["Saturday is the speaking loop", day("Sat").steps.join()===EXPECT.Sat.join()],
 ["Sunday reviews the week and reports", day("Sun").shape==="review"&&day("Sun").steps.join()===EXPECT.Sun.join()&&day("Sun").first==="converse"],
 ["the dots show the day's own steps, not a fixed seven", Object.keys(D).every(k=>D[k].dots===EXPECT[k].length)],
 ["the day's score counts only the steps that day has", Object.keys(D).every(k=>D[k].score.every(s=>EXPECT[k].indexOf(s)>=0))],
 ["each day shows its OWN task from the curriculum", Object.keys(D).every(k=>D[k].task&&D[k].task.length>20)&&new Set(Object.keys(D).map(k=>D[k].task)).size===7],
 ["…and works a different share of the week's language", new Set(Object.keys(D).map(k=>D[k].exprList)).size>=4],
 ["no page errors", errs.length===0],
];
let bad=0;
for(const [n,ok] of rows){ if(!ok)bad++; console.log((ok?"ok  ":"FAIL")+"  "+n); }
console.log("");
Object.keys(D).forEach(k=>console.log(" "+k.padEnd(4)+String(D[k].shape||D[k].fail).padEnd(8)+(D[k].steps||[]).join(" → ")));
if(errs.length)console.log("errors:",errs.slice(0,3));
console.log("\n"+(rows.length-bad)+"/"+rows.length+" passed");
await b.close();
process.exit(bad?1:0);
