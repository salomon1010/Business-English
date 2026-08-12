/* ============================================================================
   BE Mastery — Learning Coach
   --------------------------------------------------------------------------
   A local-first coaching layer. It turns the evidence already retained by the
   Competency Engine into clear, specific next steps. No learner speech, notes,
   or profile data is sent anywhere to create these coaching messages.
   ============================================================================ */
(function(global){
  const MAX_SUMMARIES=100;
  const LABELS={communication:"Communication",vocabulary:"Vocabulary",pronunciation:"Pronunciation",confidence:"Confidence",professionalism:"Professional communication",interview:"Interview readiness",technicalKnowledge:"Technical knowledge",safety:"Safety",qaqc:"QA/QC",blueprintReading:"Blueprint reading"};
  const ACTIONS={
    communication:{title:"Practise a live introduction",body:"Use one clear opening, one example, and one confident closing.",go:"shadow"},
    vocabulary:{title:"Strengthen your professional vocabulary",body:"Review a few saved words, then use one in a complete sentence.",go:"practice"},
    pronunciation:{title:"Sharpen one spoken phrase",body:"Shadow a short clip and record one focused repetition.",go:"shadow"},
    confidence:{title:"Build confidence through repetition",body:"Say one Phrase Lab sentence aloud three times before moving on.",go:"phrases"},
    professionalism:{title:"Complete your guided session",body:"Use today’s plan to practise a clear, professional message.",go:"session"},
    interview:{title:"Rehearse an interview response",body:"Say your experience aloud and have every word scored for clarity.",go:"shadow"},
    technicalKnowledge:{title:"Complete today’s professional session",body:"Connect your English practice to the work you do.",go:"session"},
    safety:{title:"Reinforce safety language",body:"Choose a Phrase Lab sentence and say it with a calm, clear delivery.",go:"phrases"}
  };
  function state(s){
    s.coach=s.coach||{summaries:[],memory:{}};
    s.coach.summaries=Array.isArray(s.coach.summaries)?s.coach.summaries:[];
    s.coach.memory=s.coach.memory||{};
    return s.coach;
  }
  function track(){return global.ProfessionalTrackContext.active()}
  function config(t){return global.CompetencyEngine.config(t)}
  function label(id,cfg){const found=(cfg.competencies||[]).find(x=>x.id===id);return (found&&found.label)||LABELS[id]||id}
  function weakest(s,t){
    const cfg=config(t),fields=(cfg.competencies||[]).filter(x=>x.id!=="professionalism"||true);
    if(!fields.length)return "communication";
    return fields.slice().sort((a,b)=>global.CompetencyEngine.score(s,t,a.id)-global.CompetencyEngine.score(s,t,b.id))[0].id;
  }
  function grammarSignal(s){
    const runs=Object.values(global.aMap?global.aMap("gram"):(s.gram||{})).reduce((n,x)=>n+Number((x&&x.runs)||0),0);
    return runs?"Grammar practice is in motion—keep applying the correction notes you receive.":"No grammar signal yet—notice one sentence pattern in your next practice.";
  }
  function mission(s,t){
    if(global.AdaptiveLearningEngine){
      const adaptive=global.AdaptiveLearningEngine.recommendation(s,t);
      return {title:adaptive.title,body:adaptive.reason||adaptive.body,go:adaptive.go,focus:adaptive.skill||"Professional growth"};
    }
    const logs=global.CompetencyEngine.recent(s,t,1),focus=weakest(s,t),a=ACTIONS[focus]||ACTIONS.communication;
    if(!logs.length){
      const pos=global.currentPos(),wk=global.trackWeeks()[pos.w-1],day=wk&&wk.days[pos.d];
      return {title:"Start today’s guided session",body:day?day.task:"Complete one focused speaking activity.",go:"session",focus:"Communication"};
    }
    return {title:a.title,body:a.body,go:a.go,focus:label(focus,config(t))};
  }
  function narrative(s,t){
    const logs=global.CompetencyEngine.recent(s,t,8),cfg=config(t);
    if(!logs.length)return "Your professional story starts with one completed activity. The coach will turn each piece of evidence into a focused next step.";
    const totals=global.CompetencyEngine.totals(s,t);
    const strongest=Object.keys(totals).sort((a,b)=>totals[b]-totals[a])[0];
    const focus=weakest(s,t);
    const name=(s.profile&&s.profile.name)?s.profile.name+", ":"";
    return `${name}you have completed ${logs.length} recent professional learning activities. ${label(strongest,cfg)} is your strongest evidence so far; your next growth opportunity is ${label(focus,cfg).toLowerCase()}. Keep building on what is already working.`;
  }
  function summary(s,input,result){
    const t=input.track||track(),cfg=config(t),awarded=result.awarded||{};
    if(!Object.keys(awarded).length)return null;
    const focus=weakest(s,t),gained=Object.keys(awarded).map(id=>label(id,cfg));
    const message={
      id:Date.now()+"-"+Math.random().toString(36).slice(2,7),date:new Date().toISOString(),track:t.id,
      activityType:input.activityType,lesson:input.lesson||"Practice activity",awarded,
      didWell:`You added evidence in ${gained.join(" and ")}.`,
      communication:awarded.communication?"You practised communicating a clear professional message.":"Keep building clear messages through short, focused speaking turns.",
      vocabulary:awarded.vocabulary?"You used a vocabulary-building activity.":"Choose one professional phrase to use aloud next.",
      grammar:grammarSignal(s),
      confidence:awarded.confidence?"You took an active confidence-building step.":"Confidence grows when you repeat one message until it feels natural.",
      professional:awarded.professionalism||awarded.interview||awarded.technicalKnowledge?"This activity added evidence toward your professional readiness.":"Connect your next English activity to a real professional situation.",
      improvement:`Focus next on ${label(focus,cfg).toLowerCase()}.`,
      recommendation:mission(s,t)
    };
    const st=state(s);st.summaries.push(message);if(st.summaries.length>MAX_SUMMARIES)st.summaries=st.summaries.slice(-MAX_SUMMARIES);
    st.memory[t.id]={lastFocus:focus,lastActivity:input.activityType,lastSummaryId:message.id,updatedAt:Date.now()};
    return message;
  }
  function recentSummary(s,t){return state(s).summaries.filter(x=>x.track===t.id).slice(-1)[0]||null}
  function weeklyReview(s,t){
    const since=Date.now()-6*864e5,cfg=config(t),logs=global.CompetencyEngine.state(s).logs.filter(x=>x.track===t.id&&new Date(x.date).getTime()>=since);
    const achieved=global.CompetencyEngine.earned(s,t).map(x=>x.title);
    const totals=global.CompetencyEngine.totals(s,t),strong=Object.keys(totals).sort((a,b)=>totals[b]-totals[a])[0]||"communication",focus=weakest(s,t);
    const points=logs.reduce((n,x)=>n+Object.values(x.competenciesAwarded||{}).reduce((a,b)=>a+Number(b||0),0),0);
    /* Not rendered anywhere today, but it would report the old participation
       counter the moment it was, so it reads the same evidence as every other
       surface. */
    const ev=global.AnswerEvaluator?global.AnswerEvaluator.readiness(s,(global.trackSimulations&&global.trackSimulations())||[]):{pct:null};
    const readiness=ev.pct,previous=state(s).memory[t.id]&&state(s).memory[t.id].lastReadiness;
    state(s).memory[t.id]=Object.assign({},state(s).memory[t.id],{lastReadiness:readiness});
    const change=readiness==null?"No demonstrated answers yet, so there is no readiness figure to report.":previous==null?"Your first readiness baseline is now established.":readiness>previous?`Career readiness increased by ${readiness-previous} point${readiness-previous===1?"":"s"}.`:"Career readiness is steady; the next focused activity can move it forward.";
    return {achievements:achieved.length?achieved:["No achievement unlocked yet"],strength:label(strong,cfg),weakness:label(focus,cfg),focus:(ACTIONS[focus]||ACTIONS.communication).title,readiness,change,points};
  }
  function coachCard(s){
    const t=track(),m=mission(s,t);
    const trackName=global.esc(t.themeLabel||t.id);
    return `<section class="card coach-card" aria-label="${trackName} AI Coach"><div class="eyebrow">${trackName} AI Coach</div><h2>${global.t("pro.your_daily_mission")}</h2><p class="coach-focus">Focus: <b>${global.esc(m.focus)}</b></p><b>${global.esc(m.title)}</b><p>${global.esc(m.body)}</p><button class="btn btn-p coach-cta" onclick="LearningCoach.openMission()">${global.t("pro.start_recommended_activity")}</button></section>`;
  }
  function weeklyCard(s){const r=weeklyReview(s,track());return `<section class="card coach-week"><div class="eyebrow">${global.t("pro.weekly_ai_review")}</div><h2>${global.t("pro.your_professional_week")}</h2><div class="coach-review-grid"><div><span>${global.t("pro.achievements")}</span><b>${global.esc(r.achievements.join(" · "))}</b></div><div><span>Strength</span><b>${global.esc(r.strength)}</b></div><div><span>${global.t("pro.growth_area")}</span><b>${global.esc(r.weakness)}</b></div><div><span>${global.t("pro.career_readiness")}</span><b>${r.readiness}%</b></div></div><p><b>${global.t("pro.recommended_focus")}</b> ${global.esc(r.focus)}<br><span>${global.esc(r.change)} ${r.points?`${r.points} competency points this week.`:""}</span></p></section>`}
  function narrativeCard(s){return `<section class="card coach-narrative"><div class="eyebrow">${global.t("pro.professional_growth_story")}</div><p>${global.esc(narrative(s,track()))}</p></section>`}
  function present(item){
    if(!item||!global.document)return;const old=document.getElementById("coachSummary");if(old)old.remove();
    const el=document.createElement("div");el.id="coachSummary";el.className="coach-modal-ov";
    const scenarioReturn=item.activityType==="professional_simulation"?`<button class="btn btn-g" id="coachScenarioReturn">${global.t("pro.choose_another_interviewer")}</button>`:"";
    el.innerHTML=`<section class="coach-modal" role="dialog" aria-modal="true" aria-label="AI Learning Coach summary"><button class="coach-close" aria-label="Close coaching summary">×</button><div class="eyebrow">${global.t("pro.ai_learning_coach")}</div><h2>${global.t("pro.what_you_did_well")}</h2><p>${global.esc(item.didWell)}</p><div class="coach-summary-grid"><div><b>${global.t("pro.communication")}</b><span>${global.esc(item.communication)}</span></div><div><b>${global.t("pro.vocabulary")}</b><span>${global.esc(item.vocabulary)}</span></div><div><b>Grammar</b><span>${global.esc(item.grammar)}</span></div><div><b>${global.t("pro.confidence")}</b><span>${global.esc(item.confidence)}</span></div><div><b>${global.t("pro.professional_communication")}</b><span>${global.esc(item.professional)}</span></div></div><div class="coach-next"><b>${global.t("pro.recommended_improvement")}</b><p>${global.esc(item.improvement)}</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-p" id="coachNext">${global.esc(item.recommendation.title)} →</button><button class="btn btn-g" id="coachAnalysis">${global.t("pro.your_performance_analysis")}</button>${scenarioReturn}</div></div></section>`;
    document.body.appendChild(el);const close=()=>el.remove();el.querySelector(".coach-close").onclick=close;el.addEventListener("click",e=>{if(e.target===el)close()});el.querySelector("#coachNext").onclick=()=>{close();openMission(item.recommendation)};
    /* The modal says what you did well and what to do next, but never showed the
       evidence behind either. This opens the page that holds it: what you have
       actually said, workshop by workshop, and how clearly you said it. */
    el.querySelector("#coachAnalysis").onclick=()=>{
      close();
      /* Straight to the report for the take just recorded, when there is one:
         the audio, the word-by-word scoring and the terms the answer should have
         carried are all already on the page behind this modal. Only when there
         is no such report does this fall back to the Progress page. */
      const slot=global._shLastReport&&document.getElementById(global._shLastReport);
      const report=slot&&slot.querySelector(".sh-line-report");
      if(report){
        report.open=true;
        report.scrollIntoView({behavior:"smooth",block:"center"});
        report.classList.add("sh-line-report-flash");
        setTimeout(()=>report.classList.remove("sh-line-report-flash"),1600);
        return;
      }
      global.go("review");
    };const returnButton=el.querySelector("#coachScenarioReturn");if(returnButton)returnButton.onclick=()=>{close();if(typeof global.simChooseAnother==="function")global.simChooseAnother();else global.go("simulation")};
  }
  function openMission(m){const next=m||mission(global.appState(),track()),pos=global.currentPos();global.go(next.go,pos.w,pos.d)}
  global.LearningCoach=Object.freeze({state,summary,recentSummary,mission,narrative,weeklyReview,coachCard,weeklyCard,narrativeCard,present,openMission});
})(window);
