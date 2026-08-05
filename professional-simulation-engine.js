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
  function start(id){
    const sc=find(id);if(!sc)return null;
    const first=character(sc,"hr");
    return {id:sc.id,startedAt:Date.now(),turn:0,facts:{},completed:[],eventIds:[],messages:[{role:"character",characterId:first.id,text:`Welcome to the workshop. I’m ${first.name}, the ${first.role}. Could you introduce yourself and tell me about your welding background?`}],finished:false};
  }
  function words(text){return String(text||"").toLowerCase()}
  function phrase(text){return String(text||"").replace(/\s+/g," ").trim().slice(0,160)}
  function capture(sim,text){
    const low=words(text);
    if(!sim.facts.name){const m=low.match(/(?:i am|my name is|i'm)\s+([a-z'-]+)/i);if(m)sim.facts.name=m[1]}
    if(/experience|worked|year|mig|tig|stick|fabricat/.test(low))sim.facts.experience=phrase(text);
    if(/safety|ppe|helmet|gloves|procedure|inspect/.test(low))sim.facts.safety=phrase(text);
    return low;
  }
  function objectives(sc,sim,text){
    const low=words(text);(sc.objectives||[]).forEach(o=>{
      if(sim.completed.includes(o.id))return;
      if((o.keywords||[]).some(k=>low.includes(k)))sim.completed.push(o.id);
    });
  }
  function reply(sc,sim,text){
    const t=sim.turn,exp=sim.facts.experience?` You mentioned ${sim.facts.experience}; that gives the team useful context.`:"";
    if(t===1){const c=character(sc,"supervisor");return {characterId:c.id,text:`Thanks${sim.facts.name?", "+sim.facts.name:""}.${exp} I’m ${c.name}, your supervisor. What type of welding work are you comfortable supporting today?`};}
    const event=(sc.unexpectedEvents||[]).find(e=>!sim.eventIds.includes(e.id)&&t>=e.afterTurn);
    if(event){sim.eventIds.push(event.id);return {characterId:event.characterId,text:event.message,event:true};}
    if(!sim.completed.includes("safety")){const c=character(sc,"safety");return {characterId:c.id,text:`I’m ${c.name}, the ${c.role}. Before you begin, tell me how you would prepare the area and your PPE for safe work.`};}
    if(!sim.completed.includes("onboarding")){
      if(sim.completed.includes("safety")&&!sim.safetyAcknowledged){sim.safetyAcknowledged=true;const c=character(sc,"safety");return {characterId:c.id,text:`Good safety thinking. I’ve noted that you understand the PPE and work-area checks. Please confirm that you are ready to complete onboarding with the team.`};}
      const c=character(sc,"qa");return {characterId:c.id,text:`I’m ${c.name}, the ${c.role}. Clear communication and checking quality matter here. Are you ready to complete onboarding and join the team?`};
    }
    const c=character(sc,"qa");return {characterId:c.id,text:`Welcome aboard. You have completed the first-day conversation; let’s review how that went.` ,complete:true};
  }
  function send(sim,text){
    const sc=find(sim&&sim.id);if(!sc||!sim||sim.finished||!phrase(text))return {simulation:sim};
    const clean=phrase(text);capture(sim,clean);objectives(sc,sim,clean);sim.turn++;sim.messages.push({role:"learner",text:clean});
    const next=reply(sc,sim,clean);sim.messages.push({role:"character",characterId:next.characterId,text:next.text,event:!!next.event});
    if(next.complete)sim.finished=true;
    return {simulation:sim,complete:!!next.complete};
  }
  function debrief(sim){
    const sc=find(sim.id),done=sim.completed.length,total=(sc.objectives||[]).length,score=Math.round(done/Math.max(1,total)*100),learner=sim.messages.filter(x=>x.role==="learner"),all=learner.map(x=>words(x.text)).join(" ");
    const metric=(base,bonus)=>Math.min(100,Math.round(base+bonus));
    const scores={communication:metric(score*.75,learner.length*5),professionalism:metric(score*.7,/thank|please|team|ready/.test(all)?20:8),confidence:metric(score*.65,/i can|i will|comfortable|ready/.test(all)?24:10),vocabulary:metric(score*.55,(all.match(/weld|safety|ppe|helmet|gloves|quality|procedure/g)||[]).length*8),grammar:metric(45,learner.filter(x=>/[.!?]$/.test(x.text)).length*12),industryReadiness:metric(score*.8,sim.completed.includes("safety")?18:0)};
    const missing=(sc.objectives||[]).filter(o=>!sim.completed.includes(o.id)).map(o=>o.label),strengths=(sc.objectives||[]).filter(o=>sim.completed.includes(o.id)).map(o=>o.label);
    return {id:sim.id,completedAt:Date.now(),objectivesCompleted:done,totalObjectives:total,scores,strengths,weaknesses:missing.length?missing:["All stated onboarding objectives were covered"],recommendedNextSimulation:(sc.debrief&&sc.debrief.recommendedNextSimulation)||"Repeat this simulation to strengthen your next objective."};
  }
  function save(s,debrief){const st=state(s);st.history.push(debrief);if(st.history.length>50)st.history=st.history.slice(-50)}
  global.ProfessionalSimulationEngine=Object.freeze({simulations,find,state,start,send,debrief,save,character});
})(window);
