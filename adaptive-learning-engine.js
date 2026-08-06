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
    communication:{title:"AI Conversation",body:"Practise a clear professional response with an AI partner.",go:"roleplay"},
    vocabulary:{title:"Vocabulary Practice",body:"Review professional words that are due, then use one aloud.",go:"practice"},
    pronunciation:{title:"Shadow Session",body:"Record a short phrase and focus on clarity and rhythm.",go:"shadow"},
    confidence:{title:"Phrase Lab",body:"Repeat one professional phrase until it feels natural.",go:"phrases"},
    professionalism:{title:"Guided Session",body:"Complete today’s professional practice plan.",go:"session"},
    interview:{title:"AI Conversation",body:"Rehearse a concise career response with an AI partner.",go:"roleplay"},
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
  function milestone(readiness){let current=MILESTONES[0],next=MILESTONES[MILESTONES.length-1];for(const m of MILESTONES){if(readiness>=m.at)current=m;else{next=m;break}}return {current,next:current===MILESTONES[MILESTONES.length-1]?null:next}}
  function recommendation(s,t){
    const r=retention(s),p=pronunciation(s),ss=skills(s,t),history=(s.simulations&&s.simulations.history||[]).filter(x=>x.id&&global.trackSimulations&&global.trackSimulations().some(q=>q.id===x.id));
    if(r.due)return Object.assign({reason:`${r.due} saved word${r.due===1?" is":"s are"} ready for review.`},ACTIONS.vocabulary);
    if(global.trackSimulations&&global.trackSimulations().length&&!history.length)return Object.assign({reason:"A first workplace simulation will add evidence across several professional skills."},ACTIONS.safety);
    if(p!=null&&p<75)return Object.assign({reason:`Recent pronunciation evidence is ${p}%, so clarity is the highest-value next step.`},ACTIONS.pronunciation);
    const weak=ss[0]||{id:"communication",label:"Communication"};return Object.assign({reason:`${weak.label} is the clearest current growth opportunity.`},ACTIONS[weak.id]||ACTIONS.communication,{skill:weak.label});
  }
  function weekly(s,t){
    const now=Date.now(),recent=logs(s,t).filter(x=>now-new Date(x.date).getTime()<7*864e5),previous=logs(s,t).filter(x=>{const age=now-new Date(x.date).getTime();return age>=7*864e5&&age<14*864e5});
    const sum=arr=>arr.reduce((o,x)=>{Object.entries(x.competenciesAwarded||{}).forEach(([k,v])=>o[k]=(o[k]||0)+Number(v||0));return o},{});
    const a=sum(recent),b=sum(previous);return (cfg(t).competencies||[]).slice(0,6).map(c=>({label:c.label,value:Math.round((a[c.id]||0)/Math.max(1,c.max||100)*100),change:Math.round(((a[c.id]||0)-(b[c.id]||0))/Math.max(1,c.max||100)*100)}));
  }
  function prediction(s,t){
    const ready=global.CompetencyEngine.readiness(s,t),ss=skills(s,t),interview=global.CompetencyEngine.score(s,t,"interview")||Math.round((global.CompetencyEngine.score(s,t,"communication")+global.CompetencyEngine.score(s,t,"confidence"))/2),m=milestone(ready),week=weekly(s,t),rate=Math.max(1,week.reduce((n,x)=>n+Math.max(0,x.change),0));
    const remaining=m.next?m.next.at-ready:0;/* The old estimate divided points remaining by the sum of positive weekly
     changes. With little history the denominator is 1, so it printed "points
     remaining, in weeks" and called it a forecast. Removed rather than tuned:
     there is no honest way to predict this from the data available. */
    const estimate="";
    return {career:ready,interview,estimate};
  }
  function heatmap(s,t){const out={},since=Date.now()-83*864e5;logs(s,t).forEach(x=>{const d=new Date(x.date).getTime();if(d>=since){const k=dateKey(x.date);out[k]=(out[k]||0)+1}});return out}
  function roadmapCard(s){const t=track(),ready=global.CompetencyEngine.readiness(s,t),m=milestone(ready),missing=skills(s,t).slice(0,3),rec=recommendation(s,t),pred=prediction(s,t);return `<section class="card adaptive-roadmap"><div class="eyebrow">Career Readiness Roadmap</div><h2>${global.esc(m.current.title)}</h2><p>${global.esc(m.current.description)}</p><div class="adaptive-grid"><div><span>Current Position</span><b>${global.esc(m.current.title)}</b></div><div><span>Next Milestone</span><b>${global.esc(m.next?m.next.title:"Interview Ready")}</b></div><div><span>Spoken evidence</span><b>${(()=>{const P=global.AnswerEvaluator&&global.AnswerEvaluator.portfolio(s);return P&&P.hasEvidence?P.answers+" answers":"none yet"})()}</b></div></div><h3>Skills Missing</h3><div class="adaptive-chips">${missing.map(x=>`<span>${global.esc(x.label)} <b>${x.score}%</b></span>`).join("")}</div><h3>Recommended Activity</h3><p><b>${global.esc(rec.title)}</b> — ${global.esc(rec.reason)}</p><button class="btn btn-p" onclick="AdaptiveLearningEngine.openRecommended()">${global.esc(rec.title)} →</button></section>`}
  function growthCard(s){const t=track(),rows=weekly(s,t),p=prediction(s,t);return `<section class="card adaptive-growth"><div class="eyebrow">Weekly Growth Dashboard</div><h2>Professional growth this week</h2><div class="adaptive-grid"><div><span>Career readiness</span><b>${p.career}%</b></div><div><span>Interview readiness</span><b>${p.interview}%</b></div><div><span>Vocabulary retention</span><b>${retention(s).percent}%</b></div></div><div class="adaptive-bars">${rows.map(x=>`<div><span>${global.esc(x.label)} <b>${x.change>0?"+":""}${x.change}%</b></span><i><em style="width:${Math.min(100,Math.max(2,x.value))}%"></em></i></div>`).join("")}</div></section>`}
  function heatmapCard(s){const t=track(),map=heatmap(s,t),today=new Date(),cells=[];for(let i=83;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);const k=dateKey(d),n=map[k]||0;cells.push(`<span data-level="${Math.min(4,n)}" title="${k}: ${n} professional activit${n===1?"y":"ies"}"></span>`)}return `<section class="card adaptive-heat"><div class="eyebrow">Professional Activity Calendar</div><h2>Learning heatmap</h2><p>Each square shows professional activity recorded through the active track.</p><div class="adaptive-heat-grid">${cells.join("")}</div></section>`}
  function openRecommended(){const r=recommendation(global.appState(),track()),pos=global.currentPos();global.go(r.go,pos.w,pos.d)}
  global.AdaptiveLearningEngine=Object.freeze({retention,skills,milestone,recommendation,weekly,prediction,heatmap,roadmapCard,growthCard,heatmapCard,openRecommended});
})(window);
