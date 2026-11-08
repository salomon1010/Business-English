/* STEP 3 — the lesson's shadows, and walking back through the lesson.
   Owner, 7 Nov 2026: the shadow gets the SAME report as steps 1 and 2 (the Foundations report,
   through the shared host), one highlighted button moves to the next shadow, the last one offers
   the next step, and every finished step is a way back.
   Run: node tests/lesson-shadow.mjs   (BASE= a server for THIS tree) */
import {chromium} from "playwright";
const BASE=process.env.BASE||"http://localhost:8000";
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:430,height:930}});
const p=await c.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
await p.goto(BASE+"/index.html?flags=onboarding_v2_enabled,home_v2_enabled,daily_learning_plan_pilot_enabled");
await p.waitForFunction(()=>typeof window.dlpShNext==="function"&&typeof window.fndAlign==="function",null,{timeout:30000});
await p.waitForFunction(()=>{try{return dlpPassages(1,2).length===2}catch(e){return false}},null,{timeout:30000});

const r=await p.evaluate(async()=>{
  const out={};
  S.profile=Object.assign({},S.profile,{name:"Hassan",role:"Welder",lang:"fr"});
  /* the Learning profile lives in S.lp, written through LearnerProfile.set — the same door
     onboarding uses, so the report context is built from a real answer, not a stub */
  try{
    LearnerProfile.set(S,"role",{role:"Welder",roleId:"trades.welder",roleCat:"trades"});
    LearnerProfile.set(S,"situations",{situations:["presentations"],primarySituation:"presentations"});
    LearnerProfile.set(S,"priorities",{priorities:["accent"]});
    LearnerProfile.set(S,"goal",{goalId:"accent"});
  }catch(e){out.lpErr=String(e)}
  const plan={week:1,day:"Mon",competencyObjective:"Introduce yourself with authority",
    personalizedScenario:{personalized:false,task:"Introduce yourself to a new client"},
    targetExpressions:["I work as","I am responsible for","My focus is on"],
    pronunciationFocus:{declared:[]},supportingVideo:null};
  const entry={lessonId:"L1",plan,step:"listen",stepData:{try:{recorded:true},learn:{done:true}},reached:"listen",startedAt:Date.now(),completedAt:null,attempt:1};
  S.dlp={L1:entry};_dlpEntry=entry;
  const ps=dlpPassages(1,2);
  out.passages=ps.length;

  /* ---------- the stage is armed only by the lesson, and lives only in the studio ---------- */
  _dlpSh=null;svMode="watch";
  out.liveWithoutStage=dlpShLive();
  out.onDoneWithoutStage=dlpShOnDone();
  out.listen0=dlpListenHTML(plan,"k",1,"Mon");

  dlpShArm(1,"Mon",0);
  out.armed={ix:_dlpSh.ix,total:_dlpSh.total,vid:_dlpSh.vid,para:_dlpSh.para};
  out.liveInWatch=dlpShLive();                      /* armed, but not in Shadow mode */

  /* ---------- the workspace, in Shadow mode, on the lesson's own clip ---------- */
  const para=["David and I.","So today we are going to study the reduction of the word and.","You will have smooth and connected speech."];
  svAsset={level:"word",segments:para.map((txt,i)=>({id:"s"+i,text:txt,startMs:i*4000,endMs:i*4000+4000}))};
  shClip.vid=_dlpSh.vid;shClip.start=0;shClip.end=12;
  svMode="shadow";svShPinned=true;svShPara=0;
  document.body.insertAdjacentHTML("beforeend",`<div class="card dlp-sh-card" id="dlpShCard" data-sv-keep="1" hidden></div>`);
  out.live=dlpShLive();
  out.onDone=typeof dlpShOnDone();
  const seg=svShSeg();out.segText=seg.text;out.segFrom=seg.from;

  const card=()=>document.getElementById("dlpShCard");
  dlpShSync();
  out.fresh={hidden:card().hidden,html:card().innerHTML};
  out.skipBefore={may:dlpShMaySkip(1),inCard:card().innerHTML.includes("dlpShSkip"),
    listen:dlpListenHTML(plan,"k",1,"Mon").includes("dlpShSkip")};

  /* ---------- Stop: the card says it is working, and pins the paragraph that was said ---------- */
  const heard="David and I so today we are going to study the reduction of the word and you will have smooth and connect speech";
  dlpShBusy();
  out.busy={html:card().innerHTML,pend:JSON.parse(JSON.stringify(_dlpSh.pend||{}))};
  /* the learner steps on to the next paragraph while Whisper is still running */
  svShPara=2;
  await dlpShGraded(heard,{seconds:14});
  svShPara=0;dlpShSync();
  const box=()=>document.getElementById("dlpShRes");
  out.one={
    hidden:card().hidden,
    html:card().innerHTML,
    rep:!!box().querySelector("details.fnd-check"),
    pct:(box().querySelector(".fnd-overall")||{}).textContent||"",
    said:!!box().querySelector('.fnd-grp[data-g="said"]'),
    target:!!box().querySelector('.fnd-grp[data-g="target"]'),
    fix:!!box().querySelector('.fnd-grp[data-g="fix"]'),
    drills:[...box().querySelectorAll("[data-drill]")].map(x=>x.getAttribute("onclick")),
    next:(document.getElementById("dlpShGo")||{}).getAttribute?document.getElementById("dlpShGo").getAttribute("onclick"):"",
    stored:JSON.parse(JSON.stringify(dlpShRec(0)||{})),
    count:dlpShCount(1),all:dlpShAllDone(1),
  };
  out.alignPct=fndAlign(seg.text,heard).pct;
  out.listen1=dlpListenHTML(plan,"k",1,"Mon");

  /* ---------- a second take on the same shadow does not count twice ---------- */
  await dlpShGraded(heard,{seconds:14});
  out.two={n:(dlpShRec(0)||{}).n,count:dlpShCount(1)};

  /* ---------- the report survives being left and come back to ---------- */
  Object.keys(_fndRep).forEach(k=>{if(k.indexOf("dlp:shadow:")===0)delete _fndRep[k]});
  dlpShSync();
  out.rebuilt={rep:!!box().querySelector("details.fnd-check"),pct:(box().querySelector(".fnd-overall")||{}).textContent||""};

  /* ---------- the take plays back, and the day's credit running out ---------- */
  out.hear={
    btns:[...card().querySelectorAll(".dlp-sh-hear .btn")].map(x=>x.getAttribute("onclick")),
    ctx:(dlpShRec(0)||{}).ctx||"",
  };
  /* no gate in force today -> no notice is invented */
  try{localStorage.removeItem("be_ai_allow")}catch(e){}
  out.allowFree={out:aiAllowOut(),card:dlpShAllowHTML(),coachAi:dlpShCoachAi()};
  /* the day's verdicts are spent */
  try{localStorage.setItem("be_ai_allow",JSON.stringify({used:3,limit:3,resetAt:Date.now()+3600000,plan:"free",at:Date.now()}))}catch(e){}
  dlpShSync();
  out.spent={
    out:aiAllowOut(),coachAi:dlpShCoachAi(),gated:entGated(),
    html:card().innerHTML,
    lock:!!card().querySelector(".prem-lock[data-cap=\"ai_coach\"]"),
    offer:(card().querySelector(".prem-lock-go")||{}).getAttribute?card().querySelector(".prem-lock-go").getAttribute("onclick"):"",
    rep:!!card().querySelector("details.fnd-check"),
    hear:card().querySelectorAll(".dlp-sh-hear .btn").length,
    coach:!!card().querySelector("#dlpCchBtn"),
    go:!!document.getElementById("dlpShGo"),
  };
  try{localStorage.removeItem("be_ai_allow")}catch(e){}
  dlpShSync();

  /* ---------- the coach, the method, and who the report is for ---------- */
  out.coach={
    html:card().innerHTML,
    lines:[...card().querySelectorAll("#dlpCchScript p")].map(x=>x.textContent),
    btn:(document.getElementById("dlpCchBtn")||{}).getAttribute?document.getElementById("dlpCchBtn").getAttribute("onclick"):"",
    method:!!card().querySelector(".dlp-how"),
    methodSecs:card().querySelectorAll(".dlp-how-sec").length,
    methodItems:card().querySelectorAll(".dlp-how-sec li").length,
  };
  out.persona=dlpProfileLine();
  out.locRole=dlpRoleLoc();out.locSit=dlpSitLoc();
  out.taskFit={
    short:dlpFitTask("Introduce yourself to a new client.",dlpProfileLine(),300),
    tiny:dlpFitTask("A task.","One. Two. Three.",14),
  };
  /* an AI script replaces the assembled one, and is spoken instead */
  const R0=dlpShRec(0);
  R0.ai={read:"Hassan, three words slipped on this pass.",tips:["Read it aloud five times first.","Stay half a word behind."]};
  out.coachAi=dlpShCoachLines(R0);
  delete R0.ai;
  out.coachPlan=dlpEvalPlan().shadowCoach;

  /* ---------- shadow 2: the same card, the next passage, then the next STEP ---------- */
  dlpShArm(1,"Mon",1);
  shClip.vid=_dlpSh.vid;                             /* shClipGo does this for real */
  svShPara=0;dlpShSync();
  out.sh2fresh={html:card().innerHTML,go:!!document.getElementById("dlpShGo")};
  await dlpShGraded(heard,{seconds:14});
  out.both={
    html:card().innerHTML,
    go:(document.getElementById("dlpShGo")||{}).getAttribute?document.getElementById("dlpShGo").getAttribute("onclick"):"",
    count:dlpShCount(1),all:dlpShAllDone(1),
  };
  out.listen2=dlpListenHTML(plan,"k",1,"Mon");

  /* ---------- skipping the second one settles it, and says so ---------- */
  (function(){
    /* unpick shadow 2 so there is something left to skip */
    delete dlpShState()["1"];
    dlpShSync();
    out.skipAfter={may:dlpShMaySkip(1),inCard:card().innerHTML.includes("dlpShSkip"),listen:dlpListenHTML(plan,"k",1,"Mon")};
    dlpShSkipRest(1);
    const r1=dlpShRec(1);
    out.skipped={rec:JSON.parse(JSON.stringify(r1||{})),settled:dlpShSettled(1),hasRec:dlpShHasRec(1),
      count:dlpShCount(1),all:dlpShAllDone(1),may:dlpShMaySkip(1),listen:dlpListenHTML(plan,"k",1,"Mon")};
  })();

  /* ---------- a learner's own clip never shows the lesson card ---------- */
  shClip.vid="someoneElsesVideo";
  dlpShSync();
  out.foreign={hidden:card().hidden,html:card().innerHTML,live:dlpShLive(),onDone:dlpShOnDone()};
  shClip.vid=_dlpSh.vid;

  /* ---------- a day already done is free to walk back through ---------- */
  (function(){
    const pl={week:1,day:"Mon",competencyObjective:"X",personalizedScenario:{personalized:false,task:"t"},
      targetExpressions:["I work as"],pronunciationFocus:{declared:[]},supportingVideo:null};
    const fr={lessonId:"F1",plan:pl,step:"listen",reached:"listen",stepData:{}};
    S.dlp.F1=fr;_dlpEntry=fr;
    out.free={atFrontier:dlpStepFree("listen"),listenShut:/style="margin-top:16px" disabled/.test(dlpListenHTML(pl,"k",1,"Mon"))};
    fr.reached="finish";                              /* they went past it once */
    out.free.behind=dlpStepFree("listen");
    out.free.listenOpen=!/style="margin-top:16px" disabled/.test(dlpListenHTML(pl,"k",1,"Mon"));
    /* and a finished lesson is free everywhere, even at its own frontier */
    const done={lessonId:"F2",plan:pl,step:"listen",reached:"listen",completedAt:Date.now(),stepData:{}};
    S.dlp.F2=done;_dlpEntry=done;
    out.free.completed=dlpStepFree("listen");
    out.free.scoreEmpty=dlpDayScore(pl).pct;
  })();

  /* ---------- the day's own percentage, counted from evidence only ---------- */
  (function(){
    const pl={week:1,day:"Mon",competencyObjective:"X",personalizedScenario:{personalized:false,task:"t"},
      targetExpressions:["I work as"],pronunciationFocus:{declared:[]},supportingVideo:null};
    const e2={lessonId:"S1",plan:pl,step:"finish",reached:"finish",stepData:{
      try:{recorded:true},
      learn:{sentences:[1,2,3,4,5].map(i=>({text:"s"+i})),pass:{0:true,1:true,2:true,3:true,4:true}},
      rehearse:{sentences:[1,2,3,4,5].map(i=>({text:"r"+i})),pass:{0:true}},
      converse:{sc:{points:["a","b","c"]},covered:3,at:1},
      listen:{sh:{"0":{at:1,heard:"x"}}}}};
    S.dlp.S1=e2;_dlpEntry=e2;
    const sc=dlpDayScore(pl);
    out.score={pct:sc.pct,rows:sc.rows.map(r=>r.k+":"+r.done+"/"+r.of)};
    out.scoreHTML=dlpDayScoreHTML(pl);
    /* a SKIPPED shadow is not accomplishment */
    e2.stepData.listen.sh["1"]={skipped:true,at:1};
    out.scoreSkip=dlpDayScore(pl).rows.find(r=>r.k==="listen");
  })();

  /* ---------- every spoken report opens with their name ---------- */
  out.coach={
    withAi:exCoachLines({ai:{coach_script:"You sounded calm. Try again."},m:{}}),
    noAi:exCoachLines({ai:null,m:{wpm:100,fillers:1,words:50}}),
    alreadyNamed:exCoachLines({ai:{coach_script:"Hassan, you sounded calm. Try again."},m:{}}),
  };
  const keepName=S.profile.name;S.profile.name="";
  out.coach.noName=exCoachLines({ai:{coach_script:"You sounded calm."},m:{}});
  S.profile.name=keepName;

  /* ---------- the engine's step history ---------- */
  const e2={lessonId:"L2",plan,step:"improve",stepData:{},reached:"improve"};
  S.dlp.L2=e2;
  out.reached=DailyPlan.reached(e2);
  DailyPlan.goStep(S,"L2","try");
  out.afterBack={step:e2.step,reached:DailyPlan.reached(e2)};
  DailyPlan.goStep(S,"L2","finish");                 /* past the mark: refused */
  out.refusedForward=e2.step;
  DailyPlan.setStep(S,"L2","try",{recorded:true});   /* Continue from a revisited step */
  out.afterContinue={step:e2.step,reached:DailyPlan.reached(e2)};
  const old={lessonId:"L3",plan,step:"rehearse",stepData:{}};   /* an entry from before `reached` */
  S.dlp.L3=old;out.legacyReached=DailyPlan.reached(old);

  /* ---------- the step nav on screen ---------- */
  _dlpEntry=e2;e2.step="listen";e2.reached="improve";
  const el=document.getElementById("v-journey");
  dlpRenderStep(el,1,"Mon","wk1-Mon");
  out.nav={
    html:el.innerHTML,
    dots:[...el.querySelectorAll(".dlp-steps > *")].map(x=>x.tagName.toLowerCase()+":"+(x.getAttribute("onclick")||"")),
    navBtns:[...el.querySelectorAll(".dlp-nav-b")].map(x=>x.getAttribute("onclick")),
    rev:!!el.querySelector(".dlp-rev"),
    revGo:(el.querySelector(".dlp-rev .btn")||{}).getAttribute?el.querySelector(".dlp-rev .btn").getAttribute("onclick"):"",
  };
  /* the dots are tappable, so their 44px targets must stay inside their own row.
     The onboarding wrapper sits over the whole app in this fixture; it is removed so the hit test
     measures the lesson's own stacking, not onboarding's. */
  document.querySelectorAll(".ob-wrap,.obx-wrap").forEach(n=>n.remove());
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("on"));el.classList.add("on");
  el.scrollIntoView();
  const dotRow=el.querySelector(".dlp-steps"),chip=el.querySelector(".chip"),h1=el.querySelector("h1.big"),back=el.querySelector(".sess-back");
  const mid=n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2))};
  out.hit={
    rowH:Math.round(dotRow.getBoundingClientRect().height),
    chipReached:chip?chip.contains(mid(chip))||mid(chip)===chip:false,
    h1Reached:h1?h1.contains(mid(h1))||mid(h1)===h1:false,
    backReached:back?back.contains(mid(back))||mid(back)===back:false,
    dotReached:(()=>{const b=el.querySelector("button.dlp-dot");if(!b)return false;const r=b.getBoundingClientRect();
      return document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2))===b})(),
  };
  e2.step="try";dlpRenderStep(el,1,"Mon","wk1-Mon");
  out.navTry={dots:[...el.querySelectorAll(".dlp-steps > *")].map(x=>x.tagName.toLowerCase()),
    navBtns:[...el.querySelectorAll(".dlp-nav-b")].map(x=>x.getAttribute("onclick")),rev:!!el.querySelector(".dlp-rev")};
  e2.step="finish";e2.reached="finish";dlpRenderStep(el,1,"Mon","wk1-Mon");
  out.navEnd={navBtns:[...el.querySelectorAll(".dlp-nav-b")].map(x=>x.getAttribute("onclick")),rev:!!el.querySelector(".dlp-rev")};

  /* ---------- step 2's report, rebuilt from what was actually heard ---------- */
  const sent="I am responsible for the quality of the work that leaves my hands.";
  _dlpEntry={lessonId:"L4",plan,step:"learn",stepData:{learn:{sentences:[{text:sent}],res:{0:{pct:62,heard:"I am responsible for the quality",at:Date.now()}},pass:{},takes:{}}}};
  S.dlp.L4=_dlpEntry;
  delete _fndRep["dlp:learn:0"];
  document.body.insertAdjacentHTML("beforeend",`<div id="dlpRes0"></div>`);
  dlpSentReports();
  const lb=document.getElementById("dlpRes0");
  out.learnRebuilt={rep:!!lb.querySelector("details.fnd-check"),pct:(lb.querySelector(".fnd-overall")||{}).textContent||""};
  return out;
});

const has=(h,s)=>String(h).includes(s);
const rows=[
 ["week 1 has two curriculum passages", r.passages===2],
 ["no stage armed: the studio is untouched", r.liveWithoutStage===false&&r.onDoneWithoutStage===null],
 ["armed on passage 1 of 2", r.armed.ix===0&&r.armed.total===2&&!!r.armed.vid],
 ["armed but in Watch: still no card", r.liveInWatch===false],
 ["Shadow mode on the lesson's clip: live", r.live===true],
 ["the studio recorder is handed to the lesson", r.onDone==="function"],
 ["the target is the paragraph on screen", r.segText.startsWith("David and I")],

 ["before a take: the card explains what to do", r.fresh.hidden===false&&has(r.fresh.html,"Record")],
 ["before a take: no next button yet", !has(r.fresh.html,"dlpShGo")],
 ["Stop shows the card working, not an empty slot", has(r.busy.html,"dlpShRes")&&r.busy.pend.from===0&&r.busy.pend.text.startsWith("David and I")],
 ["a paragraph change mid-transcription cannot move the target", r.one.stored.segFrom===0&&r.one.stored.target.startsWith("David and I")],

 ["after a take: the FOUNDATIONS report is drawn", r.one.rep===true],
 ["…with the same percentage the aligner computed", r.one.pct===r.alignPct+"%"],
 ["…What you said", r.one.said===true],
 ["…The sentence", r.one.target===true],
 ["…Words to correct", r.one.fix===true],
 ["…Practise this word drives the shared drill", r.one.drills.length>0&&r.one.drills.every(x=>/fndDrillKey\("dlp:shadow:0:0"/.test(x))],
 ["the speaker's pace is reported beside the learner's", has(r.one.html,"dlp-sh-pace")&&(r.one.html.match(/a minute|à la minute/g)||[]).length>=2],
 ["the shadow is recorded on the lesson", r.one.stored.at>0&&r.one.stored.pct===r.alignPct&&r.one.stored.segFrom===0],
 ["one of two shadowed", r.one.count.done===1&&r.one.count.total===2&&r.one.all===false],
 ["the highlighted button goes to the NEXT shadow", /dlpShNext\(1\)/.test(r.one.next)],
 ["a second take on the same shadow is not a second shadow", r.two.n===2&&r.two.count.done===1],
 ["the report is rebuilt from the kept transcript", r.rebuilt.rep===true&&r.rebuilt.pct===r.one.pct],

 ["shadow 2 starts with no button of its own", r.sh2fresh.go===false],
 ["both done: the button goes to the next STEP", /dlpShFinish\(\)/.test(r.both.go)],
 ["both done: two of two", r.both.count.done===2&&r.both.all===true],

 ["somebody else's clip shows no lesson card", r.foreign.hidden===true&&r.foreign.html===""&&r.foreign.live===false&&r.foreign.onDone===null],

 ["step 3 is gated: Continue disabled with nothing shadowed", /class="btn-primary" style="margin-top:16px" disabled/.test(r.listen0)],
 ["step 3 is gated: Continue still disabled after one", /class="btn-primary" style="margin-top:16px" disabled/.test(r.listen1)],
 ["step 3 opens once both are shadowed", !/class="btn-primary" style="margin-top:16px" disabled/.test(r.listen2)],
 ["the row says it was shadowed, with its score", has(r.listen1,"dlp-pass-done")&&has(r.listen1,r.alignPct+"")],
 ["the row then offers Shadow again", has(r.listen1,"dlp.sh_again")===false&&(r.listen1.match(/dlpShadowGo/g)||[]).length===2],
 ["progress is stated on the step", has(r.listen1,"1")&&has(r.listen1,"2")],

 ["engine: reached is the furthest step", r.reached===5],
 ["engine: walking back keeps the mark", r.afterBack.step==="try"&&r.afterBack.reached===5],
 ["engine: a step past the mark is refused", r.refusedForward==="try"],
 ["engine: Continue from a revisited step advances one, mark unmoved", r.afterContinue.step==="learn"&&r.afterContinue.reached===5],
 ["engine: an older entry reads its open step as the mark", r.legacyReached===3],

 ["nav: every reached dot but the open one is a button", r.nav.dots.length===7&&r.nav.dots.filter(x=>x.startsWith("button")).length===5&&r.nav.dots[2]==="span:"&&r.nav.dots[6]==="span:"],
 ["nav: a dot goes straight to its step", r.nav.dots.some(x=>/dlpStepGo\('try'\)/.test(x))],
 ["nav: previous and next are both offered mid-lesson", r.nav.navBtns.length===2&&/dlpStepGo\('learn'\)/.test(r.nav.navBtns[0])&&/dlpStepGo\('rehearse'\)/.test(r.nav.navBtns[1])],
 ["nav: the look-back strip offers the way to their place", r.nav.rev===true&&/dlpStepGo\('improve'\)/.test(r.nav.revGo)],
 ["nav: on step 1 there is no previous", r.navTry.navBtns.length===1&&/dlpStepGo\('learn'\)/.test(r.navTry.navBtns[0])],
 ["nav: at the furthest step there is no forward and no strip", r.navEnd.navBtns.length===1&&r.navEnd.rev===false],
 ["nav: a dot's 44px target stays in its own row \u2014 chip, title and Back are all still tappable", r.hit.rowH>=44&&r.hit.chipReached&&r.hit.h1Reached&&r.hit.backReached&&r.hit.dotReached],

 ["step 2's report also survives a reload", r.learnRebuilt.rep===true&&r.learnRebuilt.pct==="62%"],

 ["the take plays straight back, beside the speaker's", r.hear.btns.length===2&&/svShReplay\(\)/.test(r.hear.btns[0])&&/dlpShPlayMine\(0\)/.test(r.hear.btns[1])],
 ["…and the report remembers which recording it belongs to", /shadow/i.test(r.hear.ctx)||r.hear.ctx.length>0],
 ["credit left: no notice is invented", r.allowFree.out===false&&r.allowFree.card===""],
 ["credit spent: the app's own gate card says so, with the Premium offer", r.spent.out===true&&r.spent.lock===true&&/premiumOpen/.test(r.spent.offer)],
 ["credit spent: the shadow still works \u2014 report, playback and the way on all stay", r.spent.rep===true&&r.spent.hear===2&&r.spent.go===true],
 ["credit spent: the coaching is still spoken, just not AI-written", r.spent.coach===true&&r.spent.coachAi===false],
 ["credit spent: it says plainly that only the AI part is paused", /only the AI coaching is paused|coaching IA/i.test(r.spent.html)],

 ["the coach card is drawn after the report, with a Play button", r.coach.btn==="dlpShCoach()"&&r.coach.lines.length>=3],
 ["the coach opens with the learner's name", /Hassan/.test(r.coach.lines[0]||"")],
 ["the coach says which words were skipped or swapped", r.coach.lines.some(l=>/skipped|connect/i.test(l))],
 ["the coach gives a technique step, not just a score", r.coach.lines.some(l=>/pass|rhythm|beats|aloud|behind|0\.75|eyes/i.test(l))],
 ["the coach ends on what this buys a Welder at work", /Welder/i.test(r.coach.lines[r.coach.lines.length-1]||"")&&/presentation/i.test(r.coach.lines[r.coach.lines.length-1]||"")],
 ["the learner reads their job in their own language, the model is told it in English", r.locRole==="Welder"&&r.persona.includes("a Welder")],
 ["the method is taught: before / during / after / focus, with its steps", r.coach.method===true&&r.coach.methodSecs===4&&r.coach.methodItems===12],
 ["an AI script replaces the assembled one", r.coachAi[0]==="Hassan, three words slipped on this pass."&&r.coachAi.length===3],
 ["free gets the coach without paying a verdict", r.coachPlan==="device"],

 ["the report context names the learner, their job and where they speak English", /Hassan/.test(r.persona)&&/Welder/.test(r.persona)&&/presentations/i.test(r.persona)],
 ["…and asks for what sharper English buys them in that job", /sharper English lets a Welder/.test(r.persona)],
 ["…and fits the 300 characters the Worker accepts", r.taskFit.short.length<=300&&/Hassan/.test(r.taskFit.short)],
 ["…trimmed by whole sentences, never mid-word", r.taskFit.tiny==="A task. One."],

 ["no skip before the first shadow is done, anywhere", r.skipBefore.may===false&&r.skipBefore.inCard===false&&r.skipBefore.listen===false],
 ["the skip appears once one is done, in the studio and on the step", r.skipAfter.may===true&&r.skipAfter.inCard===true&&r.skipAfter.listen.includes("dlpShSkip")],
 ["skipping settles the rest and records it as skipped, never as shadowed", r.skipped.rec.skipped===true&&!r.skipped.rec.heard&&r.skipped.settled===true&&r.skipped.hasRec===false],
 ["after a skip the step opens, still counting one shadowed of two", r.skipped.all===true&&r.skipped.count.done===1&&r.skipped.count.settled===2],
 ["after a skip the skip is gone and the step says what happened", r.skipped.may===false&&!/class="btn-primary" style="margin-top:16px" disabled/.test(r.skipped.listen)&&r.skipped.listen.includes("dlp-pass")],
 ["a gate holds at the frontier", r.free.atFrontier===false&&r.free.listenShut===true],
 ["…and opens behind it, so a finished day walks back and forth", r.free.behind===true&&r.free.listenOpen===true],
 ["…and a completed lesson is free everywhere", r.free.completed===true],
 ["the day's percentage is the average of the steps' own fractions", r.score.pct===74&&r.score.rows.join(" ")==="try:1/1 learn:5/5 listen:1/2 rehearse:1/5 converse:3/3"],
 ["…drawn as a ring with the rows that add up to it", r.scoreHTML.includes("dlp-score-ring")&&r.scoreHTML.includes("74%")],
 ["…and a SKIPPED shadow is not accomplishment", r.scoreSkip.done===1&&r.scoreSkip.of===2],
 ["an empty day scores nothing rather than something", r.free.scoreEmpty===0],
 ["every spoken report opens with their first name and job", /Hassan/.test(r.coach.withAi[0])&&/Welder/i.test(r.coach.withAi[0])],
 ["…including the one assembled without the AI", /Hassan/.test(r.coach.noAi[0])],
 ["…but never twice when the model already said it", r.coach.alreadyNamed.length===2&&/Hassan/.test(r.coach.alreadyNamed[0])],
 ["…and nothing is addressed to nobody", !/^Right, /.test(r.coach.noName[0]||"")],
 ["no page errors", errs.length===0],
];
let bad=0;
for(const [n,ok] of rows){ if(!ok)bad++; console.log((ok?"ok  ":"FAIL")+"  "+n); }
if(errs.length)console.log("errors:",errs);
console.log("\npersona:",r.persona);
console.log("skipBefore:",JSON.stringify(r.skipBefore));
console.log("skipAfter.may:",r.skipAfter&&r.skipAfter.may,"inCard:",r.skipAfter&&r.skipAfter.inCard);
console.log("skipped:",JSON.stringify(r.skipped&&{rec:r.skipped.rec,count:r.skipped.count,settled:r.skipped.settled,hasRec:r.skipped.hasRec}));
console.log("\n"+(rows.length-bad)+"/"+rows.length+" passed");
await b.close();
process.exit(bad?1:0);
