/* Reusable Profile and Progress views backed exclusively by CompetencyEngine. */
(function(global){
  function track(){return global.ProfessionalTrackContext.active()}
  function cfg(){return global.CompetencyEngine.config(track())}
  function bar(label,value){return `<div class="psp-row"><div><b>${global.esc(label)}</b><span>${value}%</span></div><div class="bar"><i style="width:${value}%"></i></div></div>`}
  function stage(){const weeks=global.trackWeeks(),done=global.totalDone(),total=global.trackSessionCount();return {label:weeks.length?`Week ${global.currentPos().w} · ${weeks[global.currentPos().w-1].theme}`:"Not started",value:Math.min(100,Math.round(done/Math.max(1,total)*100))}}
  function render(){
    const s=global.appState(),t=track(),c=cfg(),ready=global.CompetencyEngine.readiness(s,t),st=stage();
    const competencies=(c.competencies||[]).filter(x=>x.passport!==false);
    return `<section class="card psp" aria-label="Professional Skills Passport">
      <div class="psp-head"><div><div class="eyebrow">Professional Skills Passport</div><h2>Career readiness</h2></div><div class="psp-score">${ready}<small>%</small></div></div>
      <div class="psp-track"><span>Professional Track</span><b>${global.esc(c.trackLabel||t.id)}</b></div>
      <div class="psp-stage"><span>Current Stage</span><b>${global.esc(st.label)}</b></div>${bar("Career Readiness",ready)}${bar("Current Stage",st.value)}
      <div class="psp-grid">${competencies.map(x=>bar(x.label,global.CompetencyEngine.score(s,t,x.id))).join("")}</div>
    </section>`;
  }
  function growth(){
    const s=global.appState(),t=track(),c=cfg(),ready=global.CompetencyEngine.readiness(s,t),recent=global.CompetencyEngine.recent(s,t,4),earned=global.CompetencyEngine.earned(s,t);
    const week=new Date(Date.now()-6*864e5),weekly=global.CompetencyEngine.state(s).logs.filter(x=>x.track===t.id&&new Date(x.date)>=week).reduce((n,x)=>n+Object.values(x.competenciesAwarded||{}).reduce((a,b)=>a+b,0),0);
    return `<section class="card pg-growth"><div class="eyebrow">Professional Growth</div><h2>Career readiness</h2>${bar("Career Readiness",ready)}
      <h3>Competency Progress</h3><div class="psp-grid">${(c.competencies||[]).filter(x=>x.passport!==false).slice(0,6).map(x=>bar(x.label,global.CompetencyEngine.score(s,t,x.id))).join("")}</div>
      <h3>Recent Achievements</h3>${earned.length?`<div class="pg-chips">${earned.map(a=>`<span class="chip done">${global.esc(a.title)}</span>`).join("")}</div>`:`<p class="sub">Complete a mapped activity to earn your first achievement.</p>`}
      <h3>Weekly Growth</h3><p class="pg-week"><b>${weekly}</b> competency points earned in the last 7 days.</p>
      ${recent.length?`<div class="pg-recent">${recent.map(x=>`<span>${global.esc(x.lesson||x.activityType)} <b>+${Object.values(x.competenciesAwarded).reduce((a,b)=>a+b,0)}</b></span>`).join("")}</div>`:""}
    </section>`;
  }
  global.ProfessionalSkillsPassport=Object.freeze({render,growth});
})(window);
