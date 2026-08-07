/* ============================================================================
   BE Mastery — Adaptive Learning Intelligence
   --------------------------------------------------------------------------
   Turns existing local learning evidence into transparent next-step decisions.
   The engine does not create curriculum; it prioritizes the learner's next
   activity from competency, coach, simulation, vocabulary and speaking data.
   ============================================================================ */
(function(global){
  const MILESTONES=[
    {at:0,title:"Professional Foundation",description:"Build a reliable base of professional English evidence."},
    {at:25,title:"Clear Communicator",description:"Communicate your experience and intent clearly."},
    {at:50,title:"Workplace Contributor",description:"Handle routine professional communication with growing independence."},
    {at:75,title:"Career Ready",description:"Demonstrate consistent workplace communication and readiness."},
    {at:90,title:"Interview Ready",description:"Sustain confident, professional communication in career situations."}
  ];
  const ACTIONS={
    communication:{assessed:true},
    vocabulary:{title:"Vocabulary Practice",body:"Review professional words that are due, then use one aloud.",go:"practice"},
    pronunciation:{title:"Shadow Session",body:"Record a short phrase and focus on clarity and rhythm.",go:"shadow"},
    confidence:{title:"Phrase Lab",body:"Repeat one professional phrase until it feels natural.",go:"phrases"},
    professionalism:{title:"Guided Session",body:"Complete today’s professional practice plan.",go:"session"},
    interview:{assessed:true},
    technicalKnowledge:{title:"Guided Session",body:"Connect your English practice to your professional work.",go:"session"},
    safety:{title:"Professional Simulation",body:"Practise safety communication in a workplace situation.",go:"simulation"}
  };
  function track(){return global.ProfessionalTrackContext.active()}
  function cfg(t){return global.CompetencyEngine.config(t)}
  function logs(s,t){return global.CompetencyEngine.state(s).logs.filter(x=>x.track===t.id)}
  function label(id,t){const c=(cfg(t).competencies||[]).find(x=>x.id===id);return (c&&c.label)||id}
  function dateKey(d){return new Date(d).toISOString().slice(0,10)}
  function retention(s){const all=Object.values(s.vocab||{}),due=all.filter(x=>!x.due||x.due<=Date.now()).length,learned=all.filter(x=>(x.reps||0)>=5).length;return {total:all.length,due,learned,percent:all.length?Math.round(learned/all.length*100):0}}
  function pronunciation(s){const hist=(s.fbHist||[]).filter(x=>x.score!=null);return hist.length?Math.round(hist.slice(-5).reduce((n,x)=>n+x.score,0)/Math.min(5,hist.length)):null}
  function skills(s,t){return (cfg(t).competencies||[]).map(c=>({id:c.id,label:c.label,score:global.CompetencyEngine.score(s,t,c.id)})).sort((a,b)=>a.score-b.score)}
  /* Null readiness means nobody has looked yet, which is not the same as being
     at the bottom of the ladder. It gets its own state rather than defaulting to
     the first milestone, which would congratulate a learner on a foundation they
     have not laid. */
  function milestone(readiness){
    if(readiness==null)return {current:{title:"Not measured yet",description:"Answer one workshop question and this starts reporting what you have shown."},next:MILESTONES[1],unmeasured:true};
    let current=MILESTONES[0],next=MILESTONES[MILESTONES.length-1];for(const m of MILESTONES){if(readiness>=m.at)current=m;else{next=m;break}}return {current,next:current===MILESTONES[MILESTONES.length-1]?null:next}}
  /* AI Conversation is not in the navigation. Browser speech was not good enough
     and the product withdrew it, so recommending it made the most prominent nudge
     in the app a one-way door into a screen nobody can get back from.

     Both recommendations now point at practice that is actually scored. Which one
     depends on the track: the workshops where a track has them, scored shadowing
     where it does not. General English has no workshops at all, so sending it to
     the simulation catalogue would only have swapped one dead end for another. */
  function resolve(a){
    if(!a||!a.assessed)return a;
    return (global.trackSimulations&&global.trackSimulations().length)
      ?{title:"Workplace Workshop",body:"Answer a workplace question and have every point you make scored.",go:"simulation"}
      :{title:"Shadow Session",body:"Record a line and see every word scored for clarity.",go:"shadow"};
  }
  function recommendation(s,t){
    const r=retention(s),p=pronunciation(s),ss=skills(s,t),history=(s.simulations&&s.simulations.history||[]).filter(x=>x.id&&global.trackSimulations&&global.trackSimulations().some(q=>q.id===x.id));
    if(r.due)return Object.assign({reason:`${r.due} saved word${r.due===1?" is":"s are"} ready for review.`},resolve(ACTIONS.vocabulary));
    if(global.trackSimulations&&global.trackSimulations().length&&!history.length)return Object.assign({reason:"A first workplace simulation will add evidence across several professional skills."},resolve(ACTIONS.safety));
    if(p!=null&&p<75)return Object.assign({reason:`Recent pronunciation evidence is ${p}%, so clarity is the highest-value next step.`},resolve(ACTIONS.pronunciation));
    const weak=ss[0]||{id:"communication",label:"Communication"};return Object.assign({reason:`${weak.label} is the clearest current growth opportunity.`},resolve(ACTIONS[weak.id]||ACTIONS.communication),{skill:weak.label});
  }
  function weekly(s,t){
    const now=Date.now(),recent=logs(s,t).filter(x=>now-new Date(x.date).getTime()<7*864e5),previous=logs(s,t).filter(x=>{const age=now-new Date(x.date).getTime();return age>=7*864e5&&age<14*864e5});
    const sum=arr=>arr.reduce((o,x)=>{Object.entries(x.competenciesAwarded||{}).forEach(([k,v])=>o[k]=(o[k]||0)+Number(v||0));return o},{});
    const a=sum(recent),b=sum(previous);return (cfg(t).competencies||[]).slice(0,6).map(c=>({label:c.label,value:Math.round((a[c.id]||0)/Math.max(1,c.max||100)*100),change:Math.round(((a[c.id]||0)-(b[c.id]||0))/Math.max(1,c.max||100)*100)}));
  }
  /* Readiness comes from what the learner has demonstrated, not from how many
     activities they have opened. See AnswerEvaluator.readiness for why. */
  function prediction(s,t){
    const ev=global.AnswerEvaluator
      ?global.AnswerEvaluator.readiness(s,(global.trackSimulations&&global.trackSimulations())||[])
      :{pct:null,interview:null,hasEvidence:false};
    return {career:ev.pct,interview:ev.interview,evidence:ev,estimate:""};
  }
  function heatmap(s,t){const out={},since=Date.now()-83*864e5;logs(s,t).forEach(x=>{const d=new Date(x.date).getTime();if(d>=since){const k=dateKey(x.date);out[k]=(out[k]||0)+1}});return out}
  function roadmapCard(s){
    const p=prediction(s),ev=p.evidence,m=milestone(p.career);
    const pctOr=v=>v==null?"—":v+"%";
    /* "Skills Missing — Communication 40%" was three competency counters wearing
       percentage signs. What is genuinely missing is the workshops where nothing
       has been shown, which the learner can act on. */
    const sims=(global.trackSimulations&&global.trackSimulations())||[];
    const store=(s&&s.simulations&&s.simulations.attempts)||{};
    const notShown=sims.filter(sc=>!((store[sc.id]||[]).some(a=>a&&a.answered>0)))
      .map(sc=>(global.simTitle?global.simTitle(sc):sc.title)).slice(0,3);
    return `<section class="card adaptive-roadmap"><div class="eyebrow">Career Readiness Roadmap</div>
      <h2>${global.esc(m.current.title)}</h2><p>${global.esc(m.current.description)}</p>
      <div class="adaptive-grid">
        <div><span>Answers demonstrated</span><b>${ev.demonstrated}/${ev.total}</b></div>
        <div><span>Readiness</span><b>${pctOr(p.career)}</b></div>
        <div><span>Interview workshop</span><b>${pctOr(p.interview)}</b></div>
      </div>
      ${notShown.length?`<h3>Not shown yet</h3><div class="adaptive-chips">${notShown.map(x=>`<span>${global.esc(x)}</span>`).join("")}</div>`:""}
      <p class="adaptive-basis">Counted from answers you spoke and the app scored — never from activities opened.</p>
      <h3>Recommended Activity</h3>
      <p><b>${global.esc(recommendation(s,track()).title)}</b> — ${global.esc(recommendation(s,track()).reason)}</p>
      <button class="btn btn-p" onclick="AdaptiveLearningEngine.openRecommended()">${global.esc(recommendation(s,track()).title)} →</button></section>`;
  }
  function growthCard(s){const t=track(),rows=weekly(s,t),p=prediction(s,t);return `<section class="card adaptive-growth"><div class="eyebrow">Weekly Growth Dashboard</div><h2>Professional growth this week</h2><div class="adaptive-grid"><div><span>Career readiness</span><b>${p.career}%</b></div><div><span>Interview readiness</span><b>${p.interview}%</b></div><div><span>Vocabulary retention</span><b>${retention(s).percent}%</b></div></div><div class="adaptive-bars">${rows.map(x=>`<div><span>${global.esc(x.label)} <b>${x.change>0?"+":""}${x.change}%</b></span><i><em style="width:${Math.min(100,Math.max(2,x.value))}%"></em></i></div>`).join("")}</div></section>`}
  function heatmapCard(s){const t=track(),map=heatmap(s,t),today=new Date(),cells=[];for(let i=83;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);const k=dateKey(d),n=map[k]||0;cells.push(`<span data-level="${Math.min(4,n)}" title="${k}: ${n} professional activit${n===1?"y":"ies"}"></span>`)}return `<section class="card adaptive-heat"><div class="eyebrow">Professional Activity Calendar</div><h2>Learning heatmap</h2><p>Each square shows professional activity recorded through the active track.</p><div class="adaptive-heat-grid">${cells.join("")}</div></section>`}
  /* Only the session takes a week and a day. Passing them to every destination
     handed the workshop route a week number where it expects a workshop id. */
  function openRecommended(){
    const r=recommendation(global.appState(),track()),pos=global.currentPos();
    return r.go==="session"?global.go(r.go,pos.w,pos.d):global.go(r.go);
  }
  global.AdaptiveLearningEngine=Object.freeze({retention,skills,milestone,recommendation,weekly,prediction,heatmap,roadmapCard,growthCard,heatmapCard,openRecommended});
})(window);
