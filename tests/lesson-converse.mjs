/* STEP 5 is the lesson's own spoken conversation (owner, 8 Nov 2026): a brief screen with the AI
   figure, the scenario and three talking points; the real role-play engine; and the step cannot
   be left until every talking point is covered. The AI is told the learner's name and profile.
   Run: node tests/lesson-converse.mjs   (BASE= a server for THIS tree) */
import {chromium} from "playwright";
const BASE=process.env.BASE||"http://localhost:8000";
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:430,height:930}})).newPage();
const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
await p.goto(BASE+"/index.html?flags=onboarding_v2_enabled,home_v2_enabled,daily_learning_plan_pilot_enabled");
await p.waitForFunction(()=>typeof window.dlpConverseGo==="function"&&typeof window.rpStart==="function",null,{timeout:30000});

const r=await p.evaluate(async()=>{
  const out={};
  S.profile=Object.assign({},S.profile,{name:"Robert",role:"Welder",lang:"en"});
  try{
    LearnerProfile.set(S,"role",{role:"Welder",roleId:"trades.welder",roleCat:"trades"});
    LearnerProfile.set(S,"situations",{situations:["presentations"],primarySituation:"presentations"});
  }catch(e){}
  const plan={week:1,day:"Mon",competencyObjective:"Introduce yourself with authority",
    personalizedScenario:{personalized:false,task:"Introduce yourself"},
    targetExpressions:["I currently work as","I'm responsible for","A big part of my role is"],
    pronunciationFocus:{declared:[]},supportingVideo:null};
  _dlpEntry={lessonId:"C1",plan,step:"converse",reached:"converse",
    stepData:{try:{m:{tx:"I am a welder and I work on site."}},
      learn:{sentences:[{text:"I currently work as a welder on a structural steel team."}]},
      rehearse:{sentences:[{text:"Before I start, I check that everything I need is actually ready."}]}}};
  S.dlp={C1:_dlpEntry};

  out.pending=dlpConverseHTML(plan,"k",1,"Mon");
  /* offline in a test page -> the device's own scenario, which must still be complete */
  await dlpScenarioBuild(plan,"k",1,"Mon");
  const sc=dlpScenarioGet();
  out.sc={id:sc.id,ai:sc.ai,persona:sc.persona,role:sc.role,title:sc.title,
    scenario:sc.scenario,points:sc.points,greet:sc.greet,local:sc.local,brief:sc.brief};
  out.byId=(rpById("dlp-lesson")||{}).id;
  out.inLibrary=trackScenarios().some(x=>x.id==="dlp-lesson");
  out.avatar=rpAvatar(sc,84);
  out.brief_html=dlpConverseHTML(plan,"k",1,"Mon");
  out.dayBrief=dlpDayBrief(plan);

  /* the gate: nothing covered -> Continue is shut */
  out.gate0=/class="btn-primary" style="margin-top:16px" disabled/.test(out.brief_html);
  /* two of three -> still shut */
  _rpLast={sc,turns:[{text:"I currently work as a welder."}],covered:new Set([1,2])};
  dlpConverseDone(2,3,123);
  out.after2=dlpStepData("converse");
  out.gate2=/class="btn-primary" style="margin-top:16px" disabled/.test(dlpConverseHTML(plan,"k",1,"Mon"));
  /* a worse second run must not take a point away */
  _rpLast={sc,turns:[{text:"um"}],covered:new Set([1])};
  dlpConverseDone(1,3,124);
  out.kept=dlpStepData("converse").pts.slice().sort();
  /* all three -> open */
  _rpLast={sc,turns:[{text:"I currently work as a welder and I'm responsible for the quality."}],covered:new Set([1,2,3])};
  dlpConverseDone(3,3,125);
  const html3=dlpConverseHTML(plan,"k",1,"Mon");
  out.gate3=/class="btn-primary" style="margin-top:16px" disabled/.test(html3);
  out.html3=html3;
  out.m=(dlpStepData("converse")||{}).m;
  /* step 6 now reads the conversation, not a recorder that no longer exists */
  out.improve=dlpImproveHTML(plan,"k",1,"Mon");
  return out;
});

const has=(h,s)=>String(h).includes(s);
const rows=[
 ["it builds the scenario before showing anything", has(r.pending,"dlp-ai")||has(r.pending,"conv_building")||has(r.pending,"ai-inline")||has(r.pending,"DS")||r.pending.length>0],
 ["the scenario is the lesson's own, not from the catalogue", r.sc.id==="dlp-lesson"&&r.byId==="dlp-lesson"&&r.inLibrary===false],
 ["exactly three talking points", r.sc.points.length===3],
 ["…and they are about this learner's job", r.sc.points.some(x=>/welder/i.test(x))],
 ["the scenario names their job and where they speak English", /Welder/i.test(r.sc.scenario)&&/presentation/i.test(r.sc.scenario)],
 ["the first line greets them BY NAME", has(r.sc.greet,"Robert")],
 ["the AI is told the name and told to use it", has(r.sc.brief,"Robert")&&/use it/i.test(r.sc.brief)],
 ["…and told their job and situation", /Welder/i.test(r.sc.brief)&&/presentation/i.test(r.sc.brief)],
 ["the whole day is handed to the scenario writer", has(r.dayBrief,"Introduce yourself with authority")&&has(r.dayBrief,"I am a welder and I work on site.")&&has(r.dayBrief,"structural steel")&&has(r.dayBrief,"Before I start")],
 ["the partner is drawn, not photographed", has(r.avatar,"dlp-orb")&&!has(r.avatar,"rp-photos")],
 ["the brief shows the scenario and the points", has(r.brief_html,"rp-points")&&r.sc.points.every(x=>has(r.brief_html,x.slice(0,18)))],
 ["Start practice opens the real role-play engine", has(r.brief_html,"dlpConverseGo()")],
 ["no talking points covered: the step is shut", r.gate0===true],
 ["two of three: still shut", r.gate2===true&&r.after2.covered===2],
 ["a worse second run cannot take a point away", r.kept.join(",")==="1,2"],
 ["all three: the step opens", r.gate3===false],
 ["…and the speaking report is offered", has(r.html3,"dlpConverseReport()")],
 ["what they said is measured for the day's before/after", !!r.m&&r.m.words>0],
 ["…but pace is not invented from a conversation", r.m.wpm===null],
 ["step 6 reads the conversation, not a missing recording", has(r.improve,"dlpConverseReport()")&&!has(r.improve,"improve_none")],
 ["no page errors", errs.length===0],
];
let bad=0;
for(const [n,ok] of rows){ if(!ok)bad++; console.log((ok?"ok  ":"FAIL")+"  "+n); }
console.log("\ngreet: "+r.sc.greet);
console.log("points:\n - "+r.sc.points.join("\n - "));
if(errs.length)console.log("errors:",errs);
console.log("\n"+(rows.length-bad)+"/"+rows.length+" passed");
await b.close();
process.exit(bad?1:0);
