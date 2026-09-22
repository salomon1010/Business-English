/* The Executive Polish report: five stations, the coach's voice, the
   corrections, the sentence patterns, the word upgrades and the carry-over
   score. Every check here is something the report has to do for a learner who
   spent a minute speaking — run with: cd tests && npm run test:polish

   The AI half is a fixture, not a live call: this asserts the report the app
   builds, not the model's taste. The Worker's own contract is asserted by the
   shapes it is sliced to in backend/polish-worker.js. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
const ROOT=new URL("..", import.meta.url).pathname;
const server=spawn("python3",["-m","http.server","8791"],{cwd:ROOT,stdio:"ignore"});
await sleep(800);
const BASE="http://localhost:8791";
const res=[];const ok=(n,c,d="")=>{res.push(c);console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  — "+d}`)};
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36"});
const page=await ctx.newPage();
const errors=[];page.on("pageerror",e=>errors.push(String(e.message)));
await page.goto(BASE+"/index.html?t="+Date.now(),{waitUntil:"load"});
await page.evaluate(()=>{OB.name="Check";obFinish()});await sleep(700);
await page.evaluate(()=>{try{wcClose()}catch(e){}document.querySelectorAll(".cf-ov,.wc-ov").forEach(e=>e.remove())});
await page.evaluate(()=>go("phrases"));await sleep(500);
ok("Polish page renders",await page.evaluate(()=>!!document.getElementById("exCard")));

const AI={key_message:"We must improve site safety after two incidents last week.",clarity:"fuzzy",
 sharper:"We had two safety incidents last week, so I am asking for a training session in October.",
 level:"B1+",level_note:"Your ideas are clear, but hedging and long sentences hide the ask.",
 structure:["Who I am","The problem","The request"],structure_note:"The ask arrives last, after the listener has stopped listening.",
 answer_directly:"Open with the incident count, not your job title.",
 example:"We had two safety incidents last week.",evidence:"You gave the number but not the cause.",
 credibility:"You said 'I think maybe we can improve', which reads as a suggestion, not a warning.",
 hedges:[{said:"I think maybe",better:"We need to"}],
 corrections:[{said:"we had like two incidents",fix:"we had two incidents",why:"'like' is a filler here; drop it before a number.",kind:"word choice"},
   {said:"the team is not really following the procedure",fix:"the team is not following the procedures",why:"Use the plural for a set of written rules.",kind:"plural"}],
 sentences:[{said:"so I would suggest we do a training session next month",rebuilt:"I am asking for a half-day safety training in October.",pattern:"I am asking for [what] by [when].",pattern_use:"When you want a decision, not a discussion."},
   {said:"because last week we had like two incidents",rebuilt:"Because we had two incidents last week, the risk is now daily.",pattern:"Because [fact], [consequence].",pattern_use:"When the listener needs the reason before the ask."}],
 words:[{said:"do a training",better:"run a training session",meaning:"To deliver a planned session.",example:"We will run a half-day training session in October."},
   {said:"problem",better:"exposure",meaning:"The risk a company carries.",example:"Our exposure doubled after last week."}],
 collocations:[{said:"make a mistake on the procedure",better:"depart from the procedure",why:"Procedures are followed or departed from, not mistaken."}],
 remember_title:"Lead with the number",remember_body:"A number earns attention. Your job title does not. Put the two incidents first.",
 next_recording:"Say the same minute, opening with the incident count and ending with the date you need a decision by.",
 quick_win_title:"Cut the hedges",quick_win_goal:"Say the next minute with zero 'I think' and zero 'maybe'.",
 concept_title:"One idea per sentence",concept_body:"Your middle section held three ideas in one breath.",
 coach_script:"You came across as calm but unsure. The hedging is what costs you. You said 'I think maybe we can improve the safety'. A supervisor says 'We had two incidents last week and I am asking for training in October.' Your grammar slip was the plural: procedures, not procedure. Copy this sentence and say it twice. Then record the same minute again, opening with the number and ending with a date. Sixty seconds, no maybe.",
 versions:[{style:"Clear and direct",text:"I am Sal, the welding supervisor. We had two safety incidents last week. The team is not following the procedures. I am asking for a training session in October.",learn:["safety incidents","asking for"]},
   {style:"Executive polish",text:"I am Sal, welding supervisor. Two safety incidents last week tell me our procedures are not being followed on the floor. I am asking for a half-day training in October before the risk becomes an injury.",learn:["on the floor","before the risk becomes"]}],
 idioms:[{idiom:"get ahead of the problem",meaning:"Act before it grows.",when:"Asking for budget early.",example:"A training in October gets us ahead of the problem."},
   {idiom:"a wake-up call",meaning:"An event that forces action.",when:"Naming an incident.",example:"Last week was a wake-up call for the whole crew."},
   {idiom:"close the gap",meaning:"Fix the distance between rule and practice.",when:"Talking about compliance.",example:"Training closes the gap between the procedure and the floor."},
   {idiom:"on the same page",meaning:"Everyone agrees.",when:"Before a decision.",example:"I want the crew on the same page by November."}]};

const r=await page.evaluate(async AI=>{
  const m={sec:62,words:64,wpm:62,fillers:[{w:"um",n:2},{w:"you know",n:1}],fillerN:3,hedges:[{w:"i think",n:1},{w:"maybe",n:1}],hedgeN:2,sents:3,wps:21,ttr:71,hes:5,hesList:[{t:5,len:1.2},{t:22,len:.9}],semis:1.2,pitch:null};
  const prev={at:Date.now()-86400000,tk:areaId(),m:{...m,fillerN:6,hedgeN:4,wpm:58},ai:null,tx:"old take",targets:["get ahead of the problem","run a training session","a wake-up call","exposure"]};
  const rep={at:Date.now(),tk:areaId(),m,ai:AI,tx:"um so hi my name is Sal I am a welding supervisor and uh I think maybe we can improve the safety on the site because last week we had like two incidents and you know the team is not really following the procedure so I would suggest we do a training session next month",sttFailed:false,targets:exTargets(AI)};
  const L=aList("exRep");L.length=0;L.push(rep,prev);
  ex.report=rep;ex.showReport=true;ex.repOpen=true;
  exRenderReport(rep,true);
  await new Promise(r=>setTimeout(r,300));
  const q=s=>document.querySelector(s);
  return {stations:document.querySelectorAll(".ex-station").length,
    nav:document.querySelectorAll(".ex-navb").length,
    coach:!!q("#exCoachBtn"),level:q(".ex-level-b")?.textContent,
    corr:document.querySelectorAll(".ex-corr").length,
    sents:document.querySelectorAll(".ex-sent").length,
    slots:document.querySelectorAll(".ex-slot").length,
    words:document.querySelectorAll(".ex-word").length,
    colls:document.querySelectorAll(".ex-coll").length,
    idioms:document.querySelectorAll(".ex-idiom").length,
    versions:document.querySelectorAll(".ex-version").length,
    carry:q(".ex-carry-score")?.textContent.trim(),
    used:[...document.querySelectorAll(".ex-tic.ok")].map(e=>e.textContent.trim()),
    saveall:!!q(".ex-saveall"),
    targets:rep.targets,
    text:q(".ex-report").innerText.length};
},AI);
console.log(JSON.stringify(r,null,1));
ok("Five stations render",r.stations===5,String(r.stations));
ok("Station nav has five chips",r.nav===5);
ok("Coach play button present",r.coach);
ok("CEFR level shown",r.level==="B1+");
ok("Corrections rendered",r.corr===2);
ok("Sentence rebuilds with slots",r.sents===2&&r.slots>=4,`${r.sents}/${r.slots}`);
ok("Word upgrades rendered",r.words===2);
ok("Collocation fix rendered",r.colls===1);
ok("Four idioms rendered",r.idioms===4);
ok("Two versions rendered",r.versions===2);
ok("Carry-over scored against last take",/\/4/.test(r.carry||""),r.carry);
ok("Save-all button present",r.saveall);
ok("Report is substantial",r.text>1800,String(r.text));

// coach voice: does the button start and stop without throwing?
const coach=await page.evaluate(async()=>{
  const st=[];window.fbSayLine=async(s,v,style,alive)=>{st.push(s);await new Promise(r=>setTimeout(r,20))};
  exCoach();await new Promise(r=>setTimeout(r,400));
  const on=document.getElementById("exCoachLive").classList.contains("on");
  const nowLine=document.querySelector("#exCoachScript p.now")?.textContent||"";
  exCoachStop();await new Promise(r=>setTimeout(r,120));
  return {spoken:st.length,on,nowLine,stopped:document.getElementById("exCoachLive").classList.contains("stopped")};
});
console.log(JSON.stringify(coach));
ok("Coach speaks the briefing sentence by sentence",coach.spoken>=2&&coach.on&&coach.nowLine.length>10,JSON.stringify(coach));
ok("Stop halts the coach",coach.stopped);

// save all
const saved=await page.evaluate(()=>{const before=Object.keys(S.vocab||{}).length;exSaveAll(document.querySelector(".ex-saveall"));return {added:Object.keys(S.vocab||{}).length-before}});
ok("Save all puts every item in the word bank",saved.added>=7,JSON.stringify(saved));

// jump
await page.evaluate(()=>exJump("upgrade"));await sleep(1500);
ok("Nav jumps to a station",await page.evaluate(()=>document.getElementById("exSt-upgrade").getBoundingClientRect().top<400));

/* Polish it again: one more whole version and two more idioms, appended to the
   report that is already saved — the owner's finale, "this is what you should
   have said", with a button that keeps going. */
const again=await page.evaluate(async()=>{
  const before={v:document.querySelectorAll(".ex-version").length,i:document.querySelectorAll(".ex-idiom").length};
  const realFetch=window.fetch;
  window.fetch=async(url,opt)=>{
    const body=JSON.parse(opt.body);
    if(!body.repolish)throw new Error("wrong route: "+Object.keys(body));
    return {ok:true,json:async()=>({version:{style:"Decisive",text:"Two safety incidents last week put us one step from an injury. I am asking for a half-day training in October.",learn:["one step from","half-day training"]},
      idioms:[{idiom:"draw a line under it",meaning:"m",when:"w",example:"e"},{idiom:"put it on the record",meaning:"m",when:"w",example:"e"}]})};
  };
  const btn=document.querySelector(".ex-repolish");
  await exRepolish(btn);
  await new Promise(r=>setTimeout(r,250));
  window.fetch=realFetch;                       /* setLang() below fetches its own file */
  return {before,after:{v:document.querySelectorAll(".ex-version").length,i:document.querySelectorAll(".ex-idiom").length},
    stored:(ex.report.ai.versions||[]).length,targets:ex.report.targets,
    persisted:(aList("exRep")[0].ai.versions||[]).length};
});
ok("Polish it again appends a version and two idioms, and persists them",
  again.after.v===again.before.v+1&&again.after.i===again.before.i+2&&again.persisted===again.stored,JSON.stringify(again));

/* The recording button has to hold "0:02 / 1:30" on one line while the timer
   runs — it wrapped onto three inside a 44 px button on a real iPhone. */
const row=await page.evaluate(async()=>{
  exStartAgain();await new Promise(r=>setTimeout(r,200));
  const mic=document.getElementById("exRecBtn");const tm=document.getElementById("exTimer");
  tm.textContent="0:02 / 1:30";
  await new Promise(r=>setTimeout(r,60));
  const r=mic.getBoundingClientRect(),t=tm.getBoundingClientRect();
  const pol=document.querySelector(".ex-polish").getBoundingClientRect();
  return {micH:Math.round(r.height),timerH:Math.round(t.height),micW:Math.round(r.width),polW:Math.round(pol.width),
    rowW:Math.round(document.querySelector(".ex-btnrow").getBoundingClientRect().width)};
});
ok("The running timer fits on one line in the mic button",row.timerH<26&&row.micH<=64&&row.micW+row.polW<row.rowW,JSON.stringify(row));

/* "Say it better" on the card itself: a whole better version of the box text,
   with Hear it, pressable again for another register — and the avoid list must
   grow, or press two is press one. */
const quick=await page.evaluate(async()=>{
  exClear();
  const ta=document.getElementById("exIn");
  ta.value="hello everyone um this is Sal I started yesterday in this area and I just wanted to touch base with everyone about what I am seeing so far";
  exDraft(ta);
  const sent=[];const realFetch=window.fetch;
  window.fetch=async(url,opt)=>{
    const body=JSON.parse(opt.body);sent.push(body.repolish);
    return {ok:true,json:async()=>({version:{style:"Version "+sent.length,text:"Good morning. I joined this team yesterday, and I want to share my first read of what I am seeing — call it "+sent.length+".",learn:["share my first read"]},
      idioms:[{idiom:"hit the ground running",meaning:"m",when:"w",example:"e"}]})};
  };
  const btn=document.querySelector(".ex-quickbtn");
  await exQuick(btn);await new Promise(r=>setTimeout(r,120));
  const after1={cards:document.querySelectorAll(".ex-qv").length,btn:btn.innerText.trim()};
  await exQuick(document.querySelector(".ex-quickbtn"));await new Promise(r=>setTimeout(r,120));
  window.fetch=realFetch;
  const cards=[...document.querySelectorAll(".ex-qv")];
  return {after1,cards:cards.length,newestFirst:/call it 2/.test(cards[0].innerText),
    avoidGrew:sent[1].avoid.length===1&&/call it 1/.test(sent[1].avoid[0]),
    hear:!!cards[0].querySelector(".ex-acts .btn"),
    idiom:/hit the ground running/.test(cards[0].innerText),
    transcriptSent:/touch base/.test(sent[0].transcript)};
});
ok("Say it better writes a version, then another, newest first",
  quick.after1.cards===1&&quick.cards===2&&quick.newestFirst&&quick.transcriptSent,JSON.stringify(quick));
ok("The second press avoids the first version and brings its own idiom",quick.avoidGrew&&quick.idiom&&quick.hear,JSON.stringify(quick));
const cleared=await page.evaluate(()=>{exClear();return {q:ex.quick.length,dom:document.querySelectorAll(".ex-qv").length}});
ok("Clear takes the versions with the text",cleared.q===0&&cleared.dom===0,JSON.stringify(cleared));

ok("No page errors",errors.length===0,errors.join(" | "));
/* French is the first language of most of the people using this app, so the
   report is checked in French too: the station names must not fall back to
   English, and the numbers must survive the {{n}} substitution. */
const fr=await page.evaluate(async()=>{
  await setLang("fr");
  exRenderReport(ex.report,true);
  await new Promise(r=>setTimeout(r,200));
  return {nav:[...document.querySelectorAll(".ex-navl")].map(e=>e.textContent),
    station:document.querySelector(".ex-station .ex-eyebrow")?.textContent||"",
    carry:document.querySelector(".ex-carry-score")?.textContent.trim()||"",
    save:document.querySelector(".ex-saveall")?.innerText.trim()||""};
});
ok("The report speaks French end to end",fr.nav.join("|")==="Écouter|Corriger|Construire|Enrichir|Redire"&&!/Hear how/i.test(fr.station)&&fr.station.length>10&&/rapport/i.test(fr.carry),JSON.stringify(fr));
await browser.close();server.kill();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean)?0:1);
