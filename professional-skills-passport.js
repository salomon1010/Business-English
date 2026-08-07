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
      <div class="psp-track"><span>Professional Track</span><b>${global.esc((global.Trades&&global.isProfessionalJourney&&global.isProfessionalJourney()?global.Trades.active(global.S).name:null)||c.trackLabel||t.id)}</b></div>
      <div class="psp-stage"><span>Current Stage</span><b>${global.esc(stage().label)}</b></div>
      ${evidence}
      <h3 class="psp-sub">Practice activity</h3>
      <p class="psp-note">A record of what you have worked on. These are counts of completed practice, not a measure of how well you weld or speak.</p>
      <div class="psp-grid">${competencies.map(x=>bar(x.label,global.CompetencyEngine.score(s,t,x.id))).join("")}</div>
      <p class="psp-basis">This page records what you have practised and said in English. It is not evidence of welding ability, certification, or eligibility to work — those are proved by test certificates and the awarding body.</p>
    </section>`;
  }
  /* Progress carried three panels that each printed a career-readiness figure
     from the same activity counters — the number appeared three times on one
     screen and none of the three came from anything the learner said.

     One panel now, scoped to the trade: which of THEIR workshops they have
     practised, how completely they covered what those answers need, their
     trade's vocabulary, and the standards they are being held to. Everything on
     it is derived from recorded speech, so an empty state is honest rather than
     a manufactured percentage. */
  function growth(){
    const s=global.appState(),t=track();
    const tr=global.Trades&&global.isProfessionalJourney&&global.isProfessionalJourney()?global.Trades.active(s):null;
    const P=global.AnswerEvaluator?global.AnswerEvaluator.portfolio(s):null;
    const sims=(global.trackSimulations&&global.trackSimulations())||[];
    const attempts=(s.simulations&&s.simulations.attempts)||{};
    const pct=v=>Math.round(v*100);

    const rows=sims.map(sc=>{
      const runs=(attempts[sc.id]||[]).filter(a=>a&&a.answered>0);
      const best=runs.length?Math.max(...runs.map(a=>Number(a.coverage)||0)):0;
      return {title:(global.simTitle?global.simTitle(sc):sc.title),runs:runs.length,best};
    });
    const done=rows.filter(r=>r.runs).length;
    const band=v=>v>=0.7?"good":v>=0.5?"fair":"poor";

    const vocab=tr?global.Trades.vocabFor(tr):[];
    const used=new Set((P&&P.answers?[]:[]));
    /* Which of the trade's terms have actually been spoken, taken from the
       stored per-question evidence rather than from a counter. */
    Object.keys(attempts).forEach(id=>(attempts[id]||[]).forEach(a=>
      (a.answers||[]).forEach(q=>(q.vocabUsed||[]).forEach(v=>used.add(v)))));
    const vocabUsed=vocab.filter(v=>used.has(v));

    return `<section class="card pg-growth">
      <div class="eyebrow">${global.esc(tr?tr.name:(cfg().trackLabel||t.id))}</div>
      <h2>Your professional evidence</h2>
      ${tr?`<div class="sim-skill-chips pg-codes">${tr.codes.map(c=>`<span>${global.esc(c)}</span>`).join("")}</div>`:""}
      ${P&&P.hasEvidence?`
        <div class="pg-ev">
          <div><b>${P.answers}</b><span>answers spoken</span></div>
          <div><b>${done}/${rows.length}</b><span>workshops practised</span></div>
          <div><b>${pct(P.average)}%</b><span>average coverage</span></div>
          <div><b>${P.demonstrated}</b><span>answers that met the mark</span></div>
        </div>`:`
        <p class="pg-empty">Nothing recorded yet. Speak your way through one workshop and this fills with what you actually said — no scores are invented from activity.</p>`}
      <h3 class="pg-h">Your workshops</h3>
      <div class="pg-work">${rows.map(r=>`
        <div class="pg-work-row ${r.runs?"":"todo"}">
          <span class="pg-work-t">${global.esc(r.title)}</span>
          ${r.runs?`<span class="pg-work-n">${r.runs}×</span><b class="pg-work-b ${band(r.best)}">${pct(r.best)}%</b>`
                  :`<span class="pg-work-todo">not yet</span>`}
        </div>`).join("")}</div>
      ${vocab.length?`<h3 class="pg-h">Trade vocabulary</h3>
        <p class="pg-note">${vocabUsed.length} of ${vocab.length} used in something you said.</p>
        <div class="sim-skill-chips">${vocab.map(v=>`<span class="${vocabUsed.includes(v)?"ok":""}">${vocabUsed.includes(v)?"✓ ":""}${global.esc(v)}</span>`).join("")}</div>`:""}
      <p class="psp-basis">This is a record of what you have practised and said in English for this trade. It is not evidence of your ability to do the work, a certification, or eligibility to be employed.</p>
    </section>`;
  }
  global.ProfessionalSkillsPassport=Object.freeze({render,growth});
})(window);
