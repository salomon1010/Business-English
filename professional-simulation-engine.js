/* ============================================================================
   BE Mastery — Professional Simulation Engine
   --------------------------------------------------------------------------
   Track packs supply workplace scenarios, cast, objectives and events. The
   engine manages a local, adaptive conversation and a consistent debrief so
   future professions can add simulations without adding a new application.
   ============================================================================ */
(function(global){
  function simulations(){return (global.activeCurriculum&&global.activeCurriculum().simulations)||[]}
  function find(id){return simulations().find(x=>x.id===id)}
  function state(s){s.simulations=s.simulations||{history:[]};s.simulations.history=Array.isArray(s.simulations.history)?s.simulations.history:[];return s.simulations}
  function character(sc,id){const cast=sc.characters||(global.activeCurriculum&&global.activeCurriculum().simulationCharacters)||[];return cast.find(x=>x.id===id)||cast[0]}
  /* The first thing the learner hears. It is written per scenario and per
     character in the track pack, because a safety officer opening a stop-work
     conversation and a recruiter opening an interview are not the same moment.
     Deliberately NOT "we're working through <scenario title>": nobody at work
     announces the title of the conversation they are having, and hearing one is
     what made this feel like a questionnaire. */
  /* The trade the learner chose rewrites some of these questions outright: a
     pipefitter is asked about sizes and schedules where a welder is asked about
     positions. The pack stays the fallback, so a trade with no overlay for a
     module keeps the shared workshop exactly as written. */
/* Read through appState(), never global.S. `let S = load()` at the top level of
   a script does NOT create a window property, so global.S is undefined in every
   module file — and Trades.active(undefined) quietly returns the DEFAULT trade.
   A boilermaker was shown "Professional Welder" and heard the welder's questions.
   appState is a function declaration, so it really is on window. */
  function tradeQ(sc,key){
    if(!global.Trades||typeof global.isProfessionalJourney!=="function"||!global.isProfessionalJourney())return null;
    const mid=sc&&sc.regulatory&&sc.regulatory.moduleId;
    return mid?global.Trades.questionFor(global.Trades.active(global.appState?global.appState():{}),mid,key):null;
  }
  function tradeOpening(sc,c){
    if(!global.Trades||typeof global.isProfessionalJourney!=="function"||!global.isProfessionalJourney())return null;
    const mid=sc&&sc.regulatory&&sc.regulatory.moduleId;
    return mid?global.Trades.openingFor(global.Trades.active(global.appState?global.appState():{}),mid,c.id):null;
  }
  function opening(sc,c){
    const tr=tradeOpening(sc,c);
    if(tr)return tr.needsGreeting?`${c.name} here, ${String(c.role||"").toLowerCase()}. ${tr.text}`:tr.text;
    const set=(sc&&sc.openings)||{};
    if(set[c.id])return set[c.id];
    return `${c.name} here, ${String(c.role||"").toLowerCase()}. Tell me about yourself and the work you've done.`;
  }
  function start(id,characterId){
    const sc=find(id);if(!sc)return null;
    const first=character(sc,characterId||sc.lead||"hr");
    return {id:sc.id,starterCharacterId:first.id,startedAt:Date.now(),turn:0,beat:0,completed:[],eventIds:[],answers:[],messages:[{role:"character",characterId:first.id,text:opening(sc,first),q:"open"}],finished:false};
  }
  function words(text){return String(text||"").toLowerCase()}
  function phrase(text){return String(text||"").replace(/\s+/g," ").trim().slice(0,160)}
  /* Objective credit used to be a raw substring test against the spoken text,
     which is why a real conversation came back 0/5.

     Nobody says "I am a welder" out loud — they say "I'm a welder", and "i am"
     does not appear in that string. Same for "I'll wear my helmet" against the
     keyword "will". And the packs name the craft as "welder", so a pipefitter
     who introduced themselves correctly got no credit at all.

     So: expand contractions, drop punctuation, match on word starts with a
     little room for inflection (year/years, work/worked/working), and let the
     learner's own trade stand in wherever the pack says welder. */
  const CONTRACTIONS=[
    [/\bcannot\b/g,"can not"],[/\bcan't\b/g,"can not"],[/\bwon't\b/g,"will not"],
    [/\bi'm\b/g,"i am"],[/\bi've\b/g,"i have"],[/\bi'll\b/g,"i will"],[/\bi'd\b/g,"i would"],
    [/\bwe're\b/g,"we are"],[/\bwe've\b/g,"we have"],[/\bwe'll\b/g,"we will"],
    [/\byou're\b/g,"you are"],[/\byou've\b/g,"you have"],[/\bthey're\b/g,"they are"],
    [/\bit's\b/g,"it is"],[/\bthat's\b/g,"that is"],[/\bthere's\b/g,"there is"],
    [/\bdon't\b/g,"do not"],[/\bdidn't\b/g,"did not"],[/\bdoesn't\b/g,"does not"],
    [/\bisn't\b/g,"is not"],[/\baren't\b/g,"are not"],[/\bwasn't\b/g,"was not"],
    [/\bhaven't\b/g,"have not"],[/\bhasn't\b/g,"has not"],[/\bshouldn't\b/g,"should not"]
  ];
  function normalise(text){
    let s=String(text||"").toLowerCase().replace(/[‘’ʼ`´]/g,"'");
    CONTRACTIONS.forEach(pair=>{s=s.replace(pair[0],pair[1])});
    return " "+s.replace(/[^a-z0-9' ]+/g," ").replace(/\s+/g," ").trim()+" ";
  }
  /* The craft word the learner would actually use about themselves. */
  function craftWords(){
    const out=["welder","welding"];
    const tr=global.Trades&&global.Trades.active&&global.Trades.active(global.appState?global.appState():{});
    if(tr){if(tr.id)out.push(String(tr.id).toLowerCase());if(tr.career)out.push(String(tr.career).toLowerCase());}
    return out;
  }
  function hits(hay,key){
    const k=normalise(key).trim();
    if(!k)return false;
    if(k.indexOf(" ")>-1)return hay.indexOf(" "+k+" ")>-1||hay.indexOf(" "+k)>-1;
    /* a word counts if it starts with the keyword and is barely longer:
       year→years, work→worked/working, safe→safety — but not can→candidate */
    return hay.split(" ").some(w=>w.indexOf(k)===0&&w.length-k.length<=3);
  }
  function matches(text,keys){
    const hay=normalise(text);
    return (keys||[]).some(k=>{
      const key=String(k||"").toLowerCase();
      if(key==="welder"||key==="welding")return craftWords().some(c=>hits(hay,c));
      return hits(hay,key);
    });
  }
  function objectives(sc,sim,text){
    (sc.objectives||[]).forEach(o=>{
      if(sim.completed.includes(o.id))return;
      if(matches(text,o.keywords))sim.completed.push(o.id);
    });
  }
  /* The offline / service-unavailable path.

     This used to be a single hardcoded first-day-at-a-welding-workshop script —
     PPE checks, "are you ready to complete onboarding", "welcome aboard" — and it
     ran for ALL twelve scenarios. A learner practising a stop-work conversation or
     a job interview was welcomed aboard and onboarded, because the live service had
     not answered. The beats now come from the scenario itself, so the fallback is
     always the right workshop with the right people in it. */
  function reply(sc,sim,text){
    const event=(sc.unexpectedEvents||[]).find(e=>!sim.eventIds.includes(e.id)&&sim.turn>=e.afterTurn);
    if(event){sim.eventIds.push(event.id);return {characterId:event.characterId,text:event.message,event:true};}
    const turns=sc.turns||[],i=Number(sim.beat)||0;
    if(i<turns.length){
      sim.beat=i+1;
      const beat=turns[i],c=character(sc,beat.characterId),tq=tradeQ(sc,beat.q);
      return {characterId:c.id,text:(tq&&tq.ask)||beat.text,q:beat.q||null};
    }
    const close=sc.closing||{},c=character(sc,close.characterId);
    let line=close.text||"That's everything for today. Let's look at how it went.";
    if(global.Trades&&typeof global.isProfessionalJourney==="function"&&global.isProfessionalJourney()){
      const mid=sc&&sc.regulatory&&sc.regulatory.moduleId;
      const tc=mid&&global.Trades.closingFor(global.Trades.active(global.appState?global.appState():{}),mid);
      if(tc)line=tc;
    }
    return {characterId:c.id,text:line,complete:true};
  }
  function send(sim,text){
    const sc=find(sim&&sim.id);if(!sc||!sim||sim.finished||!phrase(text))return {simulation:sim};
    const clean=phrase(text);objectives(sc,sim,clean);sim.turn++;sim.messages.push({role:"learner",text:clean});
    const next=reply(sc,sim,clean);sim.messages.push({role:"character",characterId:next.characterId,text:next.text,event:!!next.event,q:next.q||null});
    if(next.complete)sim.finished=true;
    return {simulation:sim,complete:!!next.complete};
  }
  function debrief(sim){
    const sc=find(sim.id),done=sim.completed.length,total=(sc.objectives||[]).length,score=Math.round(done/Math.max(1,total)*100),learner=sim.messages.filter(x=>x.role==="learner"),all=learner.map(x=>words(x.text)).join(" "),hasEvidence=learner.length>0;
    const metric=(base,bonus)=>Math.min(100,Math.round(base+bonus));
    const scores=hasEvidence?{communication:metric(score*.75,learner.length*5),professionalism:metric(score*.7,/thank|please|team|ready/.test(all)?20:8),confidence:metric(score*.65,/i can|i will|comfortable|ready/.test(all)?24:10),vocabulary:metric(score*.55,(all.match(/weld|safety|ppe|helmet|gloves|quality|procedure/g)||[]).length*8),grammar:metric(45,learner.filter(x=>/[.!?]$/.test(x.text)).length*12),industryReadiness:metric(score*.8,sim.completed.includes("safety")?18:0)}:{communication:null,professionalism:null,confidence:null,vocabulary:null,grammar:null,industryReadiness:null};
    const missing=(sc.objectives||[]).filter(o=>!sim.completed.includes(o.id)).map(o=>o.label),strengths=(sc.objectives||[]).filter(o=>sim.completed.includes(o.id)).map(o=>o.label);
    return {id:sim.id,completedAt:Date.now(),objectivesCompleted:done,totalObjectives:total,learnerTurns:learner.length,scores,strengths,weaknesses:missing.length?missing:["All stated onboarding objectives were covered"],recommendedNextSimulation:(sc.debrief&&sc.debrief.recommendedNextSimulation)||"Repeat this simulation to strengthen your next objective."};
  }
  function save(s,debrief){const st=state(s);st.history.push(debrief);if(st.history.length>50)st.history=st.history.slice(-50)}
  global.ProfessionalSimulationEngine=Object.freeze({simulations,find,state,start,send,debrief,save,character,normalise,matches});
})(window);
