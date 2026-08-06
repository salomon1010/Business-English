/* ============================================================================
   BE Mastery — Live Conversation Orchestrator
   --------------------------------------------------------------------------
   A profession-independent coordinator for voice workplace simulations. Track
   packs supply the cast, objectives, events and vocabulary; this layer keeps
   the scenario state, calls the existing secured conversation service, and
   exposes a small voice-first contract to the simulation view.
   ============================================================================ */
(function(global){
  const VOICES={hr:{rate:.98,pitch:1.08},supervisor:{rate:.9,pitch:.82},coworker:{rate:1.04,pitch:1},safety:{rate:.94,pitch:1.03},qa:{rate:.92,pitch:1.1}};
  const clean=x=>String(x||"").replace(/\s+/g," ").trim().slice(0,340);
  function profile(sc,c){return Object.assign({rate:1,pitch:1},VOICES[c&&c.id]||{});}
  function active(s){s.simulations=s.simulations||{history:[]};s.simulations.live=s.simulations.live||{};return s.simulations.live}
  function remember(s,sim){active(s)[sim.id]=sim;global.save()}
  function abandon(s,id){if(s.simulations&&s.simulations.live)delete s.simulations.live[id];global.save()}
  function opening(sim){return (sim.messages||[]).find(m=>m.role==="character")||null}
  function voiceFor(sc,id){return profile(sc,global.ProfessionalSimulationEngine.character(sc,id))}
  function transcript(sim){return (sim.messages||[]).slice(-10).map(m=>({role:m.role==="learner"?"user":"assistant",content:m.text}));}
  function prompt(sc,sim){
    const cast=(sc.characters||(global.activeCurriculum&&global.activeCurriculum().simulationCharacters)||[]).map(c=>`${c.id}: ${c.name}, ${c.role}; ${c.personality}; ${c.communicationStyle}`).join("\n");
    const remaining=(sc.objectives||[]).filter(o=>!sim.completed.includes(o.id)).map(o=>o.label).join(", ")||"wrap up the scenario";
    return `You orchestrate a live workplace voice simulation. Speak as exactly one member of this team:\n${cast}\n\nScenario: ${sc.scenario}\nLearner objectives still to cover: ${remaining}.\n\nReact specifically to the learner's latest answer. Reference useful earlier details naturally. Keep the next spoken turn to one or two short, warm workplace sentences. You may switch to a different character when it makes the conversation more natural, including an interruption for safety or quality. Do not write the learner's words. Do not call yourself an AI.\n\nReturn JSON only: {"reply":"spoken response","characterId":"one cast id","covered":["objective ids covered by the learner"],"complete":false}. Only set complete true when the learner has naturally covered the remaining objectives.`;
  }
  async function respond(sim,text){
    const engine=global.ProfessionalSimulationEngine,sc=engine.find(sim.id),said=clean(text);
    if(!sc||!said)return {simulation:sim};
    /* Existing objective and fact capture remains the authoritative, portable
       track-pack fallback. The live service then replaces the next spoken turn. */
    const fallback=engine.send(sim,said);sim=fallback.simulation;
    let next=(sim.messages||[])[sim.messages.length-1]||{};
    const api=typeof POLISH_API!=="undefined"?POLISH_API:"";
    if(api&&navigator.onLine){
      try{
        const res=await fetch(api,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat:{system:prompt(sc,sim),messages:transcript(sim)}})});
        const data=await res.json().catch(()=>({}));
        if(res.ok&&data.reply){
          const valid=(sc.characters||(global.activeCurriculum&&global.activeCurriculum().simulationCharacters)||[]).some(c=>c.id===data.characterId);
          next.text=clean(data.reply);next.characterId=valid?data.characterId:next.characterId;
          (data.covered||[]).forEach(id=>{if((sc.objectives||[]).some(o=>o.id===id)&&!sim.completed.includes(id))sim.completed.push(id)});
          /* The model does not get to end the conversation on its own say-so: a
             learner can talk it into "we're done", and finishing awards evidence.
             Objective coverage is the authority; complete only confirms it. */
          if(sim.completed.length>=(sc.objectives||[]).length)sim.finished=true;
          sim.voiceMeta=Object.assign(sim.voiceMeta||{},{live:true});
        }else{
          /* A 429 or a 502 is not an exception, so this branch used to pass in
             silence and the learner simply got the scripted beat with no idea the
             live partner had dropped out. */
          sim.voiceMeta=Object.assign(sim.voiceMeta||{},{live:false,lastServiceError:Date.now()});
        }
      }catch(e){sim.voiceMeta=Object.assign(sim.voiceMeta||{},{live:false,lastServiceError:Date.now()});}
    }
    sim.lastSpeakerId=next.characterId;sim.voiceMeta=Object.assign(sim.voiceMeta||{},{lastTurnAt:Date.now(),turns:(sim.voiceMeta&&sim.voiceMeta.turns||0)+1});
    return {simulation:sim,reply:next,complete:!!sim.finished};
  }
  /* A per-turn feedback() used to derive six metrics from word counts — including
     a constant "pronunciation: 70" from a transcript with no audio. It was stored
     on every turn and synced, and nothing ever displayed it. Removed rather than
     hidden: fabricated evidence must not exist in learner state, and the app
     already has a real, audio-grounded grader in fbAssess. */
  global.ConversationOrchestrator=Object.freeze({active,remember,abandon,opening,voiceFor,respond});
})(window);
