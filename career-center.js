/* ============================================================================
   BE Mastery — Global Career Readiness Center
   --------------------------------------------------------------------------
   Destination guidance is educational. This module reuses professional-track
   evidence, adaptive priorities, existing mentors and simulations; it does not
   assess immigration, licensing, job eligibility, or employer requirements.
   ============================================================================ */
(function(global){
  const DESTINATIONS=[
    {id:"cameroon",short:"Cameroon",name:"Cameroon",interview:"Prepare a concise introduction, practical experience examples, and respectful questions about the role and site.",culture:"Be clear about reliability, teamwork, safety, and willingness to learn. Confirm expectations directly and professionally.",certification:"Use your current training record as a starting point. Ask employers, training providers, and official authorities which credentials they recognise."},
    {id:"nigeria",short:"Nigeria",name:"Nigeria",interview:"Practise describing technical experience, safety awareness, and how you work with supervisors and teams.",culture:"Use direct but respectful updates. Show readiness to coordinate across teams and follow site procedures.",certification:"Keep a clear record of training, experience, and certificates. Verify employer and authority requirements before applying."},
    {id:"south-africa",short:"South Africa",name:"South Africa",interview:"Prepare evidence-led answers about quality, safety, procedures, and workplace communication.",culture:"Use clear, respectful language with colleagues, supervisors, and clients. Ask for clarification when a requirement is unclear.",certification:"Map your existing experience and training, then confirm current recognition or trade-test requirements with official sources and employers."},
    {id:"canada",short:"Canada",name:"Canada",interview:"Practise structured examples: situation, action, safety decision, and result. Prepare questions about scope and standards.",culture:"Use concise, collaborative communication. State what you know, ask when unsure, and avoid overstating qualifications.",certification:"Requirements vary by province, role, employer, and trade. Treat this center as preparation guidance and verify the current official pathway."},
    {id:"united-states",short:"United States",name:"United States",interview:"Prepare short achievement examples, safety decisions, and a confident explanation of your experience and career direction.",culture:"Communicate directly, professionally, and with practical detail. Confirm priorities and document key workplace information.",certification:"Requirements can vary by state, employer, project, and union context. Confirm current requirements through official and employer channels."},
    {id:"united-kingdom",short:"United Kingdom",name:"United Kingdom",interview:"Prepare structured examples with evidence: what the job required, what you did, and how it was checked. Expect questions about execution class and procedure.",culture:"Communicate politely but directly. Raise problems early, confirm instructions in writing where it matters, and expect documented procedures.",certification:"Structural work is executed to EN 1090 and welders qualified to ISO 9606-1. Confirm the execution class and whether UKCA or CE marking applies to the project."},
    {id:"international-contractor",short:"International",name:"International Contractor",interview:"Prepare a portable professional story: scope of experience, safety record, quality standards, availability, and adaptability.",culture:"Make communication explicit across teams and cultures: confirm assumptions, deadlines, standards, and handovers.",certification:"Organise certificates, references, work history, and translations where appropriate. Verify every destination and project requirement directly."}
  ];
  function state(s){s.careerCenter=s.careerCenter||{destination:"international-contractor",resume:""};return s.careerCenter}
  function destination(s){const id=state(s).destination;return DESTINATIONS.find(x=>x.id===id)||DESTINATIONS[DESTINATIONS.length-1]}
  function gaps(s,t){return global.AdaptiveLearningEngine.skills(s,t).slice(0,4)}
  function readiness(s,t){return global.AdaptiveLearningEngine.prediction(s,t)}
  function pack(s,t){const mentors=(global.trackAiMentors&&global.trackAiMentors())||[],sims=(global.trackSimulations&&global.trackSimulations())||[];const r=global.AdaptiveLearningEngine.recommendation(s,t),at=Math.min(sims.length-1,Math.max(0,global.currentPos().w-1));return {mentor:mentors[Math.min(mentors.length-1,Math.max(0,global.currentPos().w-1))]||mentors[0],simulation:t.id==="general-english"?(sims[at]||sims[0]):null,recommendation:r}}
  /* The interview coaches used to be one button at the very bottom of the page:
     whichever mentor matched the current week, with the other eleven unreachable
     from anywhere in the app. The learner could not choose who to be interviewed
     by, could not repeat one, and could not see how any of them had gone.

     All of them are listed now, each carrying its own real history. A coach that
     has never been spoken to says so rather than showing 0%, which reads as a
     failed attempt; the score shown is the best of the recorded evaluations, and
     it comes from what the learner actually said. The stage-appropriate coach
     keeps its prominence as a recommendation instead of as the only door. */
  function practised(m){return (global.rpHistFor&&global.rpHistFor(m.id))||[]}
  function coachCard(m,rec){
    const hist=practised(m),scored=hist.filter(c=>typeof c.overall==="number");
    const best=scored.length?Math.max.apply(null,scored.map(c=>c.overall)):null;
    const ev=hist.length
      ?`<span class="cc-ev">${global.t(hist.length===1?"pro.one_attempt":"pro.n_attempts",{n:hist.length})}${best==null?"":` · ${global.t("pro.best")} <b style="color:${global.rpEvCol(best)}">${best}%</b>`}</span>`
      :`<span class="cc-ev cc-new">${global.t("pro.not_practised_yet")}</span>`;
    return `<button class="cc-card${rec?" cc-rec":""}" onclick="go('roleplay','${global.esc(m.id)}')">
      ${global.rpAvatar?global.rpAvatar(m,52):""}
      <span class="cc-t"><b>${global.esc(m.title)}</b><small>${global.esc(m.persona)} · ${global.esc(m.role)}</small>${ev}</span>
      ${rec?`<span class="cc-chip">${global.t("pro.for_your_stage")}</span>`:""}
    </button>`;
  }
  function coaches(s,t,k){
    const mentors=(global.trackAiMentors&&global.trackAiMentors())||[];
    if(!mentors.length)return "";
    /* Twelve open cards buried the gap analysis and the resume coach below them.
       The one for the learner's stage stays out in the open — that is the answer
       to "what should I do now" — and the rest fold behind a summary that still
       reports how many of them have been practised, so the count is visible
       without the list being. */
    const rec=mentors.filter(m=>k.mentor&&m.id===k.mentor.id)[0]||mentors[0];
    const rest=mentors.filter(m=>m!==rec);
    const done=rest.filter(m=>practised(m).length).length;
    return `<section class="card career-packs"><h2>${global.t("pro.professional_interview_coaches")}</h2>
      <p>Each coach interviews you on one part of your professional story. You speak your answers, and each one is evaluated on what you actually said. Repeat any of them as often as you like.</p>
      <div class="career-coaches">${coachCard(rec,true)}</div>
      ${rest.length?`<details class="career-fold career-more"><summary><h2>${global.t("pro.the_other_n_interviews",{n:rest.length})}</h2><p>${done?global.t("pro.n_practised_n_to_try",{done:done,left:rest.length-done}):global.t("pro.none_practised_yet")}</p></summary>
        <div class="career-coaches">${rest.map(m=>coachCard(m,false)).join("")}</div>
      </details>`:""}
      ${k.simulation?`<div class="career-pack-actions" style="margin-top:12px"><button class="btn btn-g" onclick="go('simulation','${global.esc(k.simulation.id)}')">Simulation: ${global.esc(k.simulation.title)} →</button></div>`:""}
    </section>`;
  }
  function render(s){const t=global.activeProfessionalTrack(),d=destination(s),g=gaps(s,t),p=readiness(s,t),k=pack(s,t),st=state(s);return `<div class="career-center"><div class="eyebrow pg-eyebrow"><button class="back" onclick="careerBack()">‹ ${global.esc(global.careerBackLabel?global.careerBackLabel():"Profile")}</button><span>${global.t("pro.career_center")}</span></div><h1 class="big">${global.t("pro.global_career_readiness_center")}</h1><p class="sub">${global.t("pro.prepare_your_professional_story_workplace_co")}</p>${(()=>{
      /* The trade decides which codes, vocabulary and model answers the whole
         app assesses against, so it belongs beside the destination rather than
         buried in onboarding where it was chosen once and never seen again. */
      if(!global.Trades||!global.isProfessionalJourney||!global.isProfessionalJourney())return "";
      const cur=global.Trades.active(s);
      return `<details class="card career-trade career-fold"><summary><h2>${global.t("pro.your_profession")}</h2><p><span class="cf-now">${global.esc(cur.name)}</span> — tap to change</p></summary>
        <div class="career-select">${global.Trades.all().map(x=>`<button class="chip ${x.id===cur.id?"done":""}" onclick="CareerCenter.trade('${global.esc(x.id)}')">${global.esc(x.name)}</button>`).join("")}</div>
        <p><b>${global.esc(cur.name)}</b> — ${global.esc(cur.focus)}</p>
        <div class="sim-skill-chips">${cur.codes.map(c=>`<span>${global.esc(c)}</span>`).join("")}</div>
        <p class="career-pay">${global.esc(cur.pay)} · ${global.esc(cur.payNote)} Indicative only — not an offer, a quote or a survey.</p>
        <p class="career-pay">Changing this changes the standards you are assessed against, the vocabulary your answers are checked for, and the model answers you shadow.</p>
      </details>`;
    })()}<details class="card career-destination career-fold"><summary><h2>${global.t("pro.career_destination")}</h2><p><span class="cf-now">${global.esc(d.name)}</span> — tap to change</p></summary><div class="career-select">${DESTINATIONS.map(x=>`<button class="chip ${x.id===d.id?"done":""}" onclick="CareerCenter.select('${x.id}')">${global.esc(x.name)}</button>`).join("")}</div><p><b>${global.esc(d.name)}</b> — educational career preparation only. Always confirm current employer, licensing, and legal requirements with official sources.</p>${(()=>{
      /* Say plainly what choosing this destination changes, so the selector is
         not a label the rest of the app ignores. */
      const j=global.Jurisdictions&&global.Jurisdictions.active(s);
      if(!j)return "";
      return `<div class="career-jur"><b>Your workshop reports are assessed against ${global.esc(j.framework)}</b><p>${global.esc(j.verify)}</p></div>`;
    })()}</details><section class="card career-readiness"><div class="eyebrow">${global.t("pro.career_readiness")}</div><div class="career-score"><div><b>${p.career==null?"—":p.career+"%"}</b><span>${global.t("pro.career_readiness")}</span></div><div><b>${p.interview==null?"—":p.interview+"%"}</b><span>${global.t("pro.interview_readiness")}</span></div><div><b>${(()=>{const P=global.AnswerEvaluator&&global.AnswerEvaluator.portfolio(s);return P&&P.hasEvidence?P.answers:"0"})()}</b><span>${global.t("pro.spoken_answers_recorded")}</span></div></div></section>${coaches(s,t,k)}<details class="card career-guidance career-fold"><summary><h2>${global.t("pro.destination_interview_guidance")}</h2><p>What ${global.esc(d.name)} expects, culture, and the certification roadmap.</p></summary><div class="career-guidance-in"><p>${global.esc(d.interview)}</p><h3>${global.t("pro.workplace_communication_and_culture")}</h3><p>${global.esc(d.culture)}</p><h3>${global.t("pro.certification_roadmap")}</h3><p>${global.esc(d.certification)}</p></div></details><section class="card career-resume"><h2 class="career-li-h"><img src="linkedin.png" alt="" width="26" height="26" loading="lazy">${global.t("pro.resume_linkedin_coach")}</h2><p>Write a short professional summary. The coach will return concise, professional rewrites using the existing polishing service when online.</p><textarea id="careerResume" rows="5" placeholder="Example: I am a welder with experience in fabrication...">${global.esc(st.resume||"")}</textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-p" onclick="CareerCenter.polish()">${global.t("pro.improve_summary")}</button><button class="btn btn-g" onclick="go('phrases')">${global.t("pro.open_executive_polish")}</button><a class="btn btn-g career-li" href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer"><img src="linkedin.png" alt="" width="18" height="18" loading="lazy">${global.t("pro.open_linkedin")}</a></div><div id="careerResumeOut"></div></section><section class="card career-gaps"><h2>${global.t("pro.career_gap_analysis")}</h2><p>${global.t("pro.your_current_highest_value_growth_areas")}</p><div class="career-gap-list">${g.map(x=>`<div><span>${global.esc(x.label)}</span><b>${x.score}%</b><i><em style="width:${x.score}%"></em></i></div>`).join("")}</div><button class="btn btn-p" onclick="CareerCenter.openRecommended()">${global.esc(k.recommendation.title)} →</button></section></div>`}
  function select(id){
    const s=global.appState();state(s).destination=id;global.save();
    if(global.applyTrackIdentity)global.applyTrackIdentity();
    if(global.toast)global.toast(destination(s).name+" is now your career destination.");
    global.go('career');
  }
  async function polish(){const s=global.appState(),input=(document.getElementById("careerResume")||{}).value||"",out=document.getElementById("careerResumeOut"),api=typeof POLISH_API!=="undefined"?POLISH_API:"";state(s).resume=input;global.save();if(!input.trim()){if(out)out.textContent="Write a short summary first.";return}if(out)out.textContent="Preparing your professional summary…";try{if(!api||!navigator.onLine)throw new Error("offline");const r=await fetch(api,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text:input.trim(),avoid:[]})});const j=await r.json();if(!r.ok||!Array.isArray(j.versions))throw new Error("unavailable");if(out)out.innerHTML=`<div class="career-polish">${j.versions.slice(0,2).map(v=>`<p><b>${global.esc(v.text)}</b><span>${global.esc(v.learn||"")}</span></p>`).join("")}</div>`}catch(e){if(out)out.innerHTML=`<p class="sub">${global.t("pro.keep_it_focused_role_relevant_experience")}</p>`}}
  function openRecommended(){const s=global.appState(),t=global.activeProfessionalTrack(),r=global.AdaptiveLearningEngine.recommendation(s,t),pos=global.currentPos();global.go(r.go,pos.w,pos.d)}
  function trade(id){
    const st=global.appState();
    if(!global.Trades||!global.Trades.setActive(st,id))return;
    global.save();
    /* The header chip names the trade on every screen. Saving without this left
       it reading Pipefitter while the page underneath said Welder. */
    if(global.applyTrackIdentity)global.applyTrackIdentity();
    if(global.toast)global.toast(global.Trades.get(id).name+" is now your profession.");
    global.go("career");
  }
  global.CareerCenter=Object.freeze({render,select,trade,polish,openRecommended,destination,gaps,readiness,pack,destinations:DESTINATIONS});
})(window);
