/* ============================================================================
   BE Mastery — Competency Engine
   --------------------------------------------------------------------------
   Track packs own competency definitions, award mappings, career-readiness
   weights and achievement rules. This engine only applies those definitions
   and stores an auditable local activity history.
   ============================================================================ */
(function(global){
  const MAX_LOGS=500;
  function config(track){
    const pack=global.CurriculumProvider&&global.CurriculumProvider.forTrack(track);
    return (pack&&pack.competencyConfig)||{};
  }
  function state(s){
    s.competency=s.competency||{logs:[],achievements:{}};
    s.competency.logs=Array.isArray(s.competency.logs)?s.competency.logs:[];
    s.competency.achievements=s.competency.achievements||{};
    return s.competency;
  }
  function activeTrack(){return global.ProfessionalTrackContext&&global.ProfessionalTrackContext.active()}
  function activityCount(s,trackId,type){return state(s).logs.filter(x=>x.track===trackId&&x.activityType===type).length}
  function totals(s,track){
    const cfg=config(track),out={};
    (cfg.competencies||[]).forEach(c=>out[c.id]=0);
    state(s).logs.filter(x=>x.track===track.id).forEach(log=>{
      Object.entries(log.competenciesAwarded||{}).forEach(([id,n])=>out[id]=(out[id]||0)+Number(n||0));
    });
    return out;
  }
  function score(s,track,id){
    const cfg=config(track),def=(cfg.competencies||[]).find(x=>x.id===id);
    if(id==="consistency")return Math.min(100,(s.dates||[]).length*5);
    if(!def)return 0;
    return Math.min(100,Math.round((totals(s,track)[id]||0)/Math.max(1,def.max||100)*100));
  }
  function readiness(s,track){
    const cfg=config(track),weights=(cfg.careerReadiness&&cfg.careerReadiness.weights)||{};
    const total=Object.values(weights).reduce((n,x)=>n+Number(x||0),0);
    if(!total)return 0;
    const weighted=Math.round(Object.entries(weights).reduce((n,[id,w])=>n+score(s,track,id)*Number(w||0),0)/total);
    const points=Object.values(totals(s,track)).reduce((n,x)=>n+x,0);
    return points?Math.max(1,weighted):0;
  }
  function unlock(s,track){
    const st=state(s),cfg=config(track),earned=[];
    (cfg.achievements||[]).forEach(a=>{
      const key=track.id+":"+a.id;if(st.achievements[key])return;
      const rule=a.when||{};
      if(rule.activity&&activityCount(s,track.id,rule.activity)<(rule.count||1))return;
      if(rule.competency&&score(s,track,rule.competency)<(rule.score||1))return;
      st.achievements[key]={id:a.id,track:track.id,earnedAt:Date.now()};earned.push(a);
    });
    return earned;
  }
  function logActivity(s,input){
    const track=input.track||activeTrack();if(!track)return {awarded:{},achievements:[]};
    const cfg=config(track),mapping=(cfg.activityMappings||{})[input.activityType]||{};
    const st=state(s);
    if(input.dedupeKey&&st.logs.some(x=>x.dedupeKey===track.id+":"+input.dedupeKey))return {awarded:{},achievements:[]};
    const awarded={};Object.entries(mapping).forEach(([id,n])=>{if(Number(n)>0)awarded[id]=Number(n)});
    if(!Object.keys(awarded).length)return {awarded:{},achievements:[]};
    st.logs.push({id:Date.now()+"-"+Math.random().toString(36).slice(2,7),date:new Date().toISOString(),activityType:input.activityType,
      track:track.id,lesson:input.lesson||"",competenciesAwarded:awarded,score:input.score==null?null:Number(input.score),duration:input.duration==null?null:Number(input.duration),dedupeKey:input.dedupeKey?track.id+":"+input.dedupeKey:null});
    if(st.logs.length>MAX_LOGS)st.logs=st.logs.slice(-MAX_LOGS);
    return {awarded,achievements:unlock(s,track)};
  }
  function recent(s,track,limit){return state(s).logs.filter(x=>x.track===track.id).slice(-Math.max(1,limit||5)).reverse()}
  function earned(s,track){
    const cfg=config(track),st=state(s);return (cfg.achievements||[]).filter(a=>st.achievements[track.id+":"+a.id]);
  }
  function merge(a,b){
    const seen=new Set(),logs=[].concat((a&&a.logs)||[],(b&&b.logs)||[]).filter(x=>{const k=x&&x.id;if(!k||seen.has(k))return false;seen.add(k);return true}).sort((x,y)=>String(x.date).localeCompare(String(y.date))).slice(-MAX_LOGS);
    return {logs,achievements:Object.assign({},(b&&b.achievements)||{},(a&&a.achievements)||{})};
  }
  global.CompetencyEngine=Object.freeze({config,state,totals,score,readiness,logActivity,recent,earned,unlock,merge});
})(window);
