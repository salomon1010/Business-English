/* Reusable Profile and Progress views backed exclusively by CompetencyEngine. */
(function(global){
  function track(){return global.ProfessionalTrackContext.active()}
  function cfg(){return global.CompetencyEngine.config(track())}
  function bar(label,value){return `<div class="psp-row"><div><b>${global.esc(label)}</b><span>${value}%</span></div><div class="bar"><i style="width:${value}%"></i></div></div>`}
  function stage(){const weeks=global.trackWeeks(),done=global.totalDone(),total=global.trackSessionCount();return {label:weeks.length?`Week ${global.currentPos().w} · ${weeks[global.currentPos().w-1].theme}`:"Not started",value:Math.min(100,Math.round(done/Math.max(1,total)*100))}}
  /* The Passport used to lead with "Career readiness 36%" — a weighted average of
     activity counters. Ticking a session and tapping phrases moved it; speaking
     did not. It also drew bars for QA/QC and Blueprint Reading, which no activity
     can award, so they sat at 0% forever and read as failure.

     It now leads with what the learner has actually said: workshops practised,
     answers recorded, moments where they covered what a competent answer needs.
     The activity counters stay, demoted and labelled as practice rather than
     ability, because they are still a fair record of effort. */
  function render(){
    const s=global.appState(),t=track(),c=cfg();
    const P=global.AnswerEvaluator?global.AnswerEvaluator.portfolio(s):null;
    const competencies=(c.competencies||[]).filter(x=>x.passport!==false);
    const pct=v=>Math.round(v*100);
    const evidence=P&&P.hasEvidence?`
      <div class="psp-ev">
        <div class="psp-ev-n"><b>${P.answers}</b><span>spoken answers recorded</span></div>
        <div class="psp-ev-grid">
          <div><b>${P.workshops}</b><span>workshops practised</span></div>
          <div><b>${P.demonstrated}</b><span>answers that covered what was needed</span></div>
          <div><b>${pct(P.average)}%</b><span>average coverage</span></div>
          <div><b>${pct(P.best)}%</b><span>best workshop</span></div>
        </div>
      </div>`:`
      <div class="psp-ev psp-ev-empty">
        <p>No spoken evidence yet. Complete a workplace conversation and your answers will be scored against what a competent answer needs — that is what fills this page.</p>
      </div>`;
    return `<section class="card psp" aria-label="Professional Skills Passport">
      <div class="psp-head"><div><div class="eyebrow">Professional Skills Passport</div><h2>Your communication evidence</h2></div></div>
      <div class="psp-track"><span>Professional Track</span><b>${global.esc(c.trackLabel||t.id)}</b></div>
      <div class="psp-stage"><span>Current Stage</span><b>${global.esc(stage().label)}</b></div>
      ${evidence}
      <h3 class="psp-sub">Practice activity</h3>
      <p class="psp-note">A record of what you have worked on. These are counts of completed practice, not a measure of how well you weld or speak.</p>
      <div class="psp-grid">${competencies.map(x=>bar(x.label,global.CompetencyEngine.score(s,t,x.id))).join("")}</div>
      <p class="psp-basis">This page records what you have practised and said in English. It is not evidence of welding ability, certification, or eligibility to work — those are proved by test certificates and the awarding body.</p>
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
