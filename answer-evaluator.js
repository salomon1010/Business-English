/* ============================================================================
   BE Mastery — Answer Evaluator
   --------------------------------------------------------------------------
   Every workshop question carries a rubric in the track pack: the points a
   competent professional's answer covers, the vocabulary that belongs in it, a
   model answer, and where the expectation comes from.

   This module compares what the learner actually said against that rubric and
   reports coverage. It is deliberately narrow about what it claims:

     • It measures whether the learner SAID the things the answer needs.
     • It does NOT measure whether the learner can perform the work, and it must
       never be presented as doing so. A spoken answer in English is evidence of
       communication, not of welding competence, certification or eligibility.
     • Every rubric carries a `source`. Where that source is general industry
       practice rather than a published requirement, it says so, and the learner
       is told to verify with their employer or awarding body.

   Deterministic and offline by design: the same answer always produces the same
   review, and nothing here needs a network. An AI pass may refine coverage, but
   only by selecting point ids that already exist in the rubric — it can never
   invent a strength, a gap, or a score.
   ============================================================================ */
(function(global){

  const WORD=/[a-z0-9']+/g;

  function norm(text){return String(text||"").toLowerCase().replace(/[’]/g,"'")}
  function wordsOf(text){return norm(text).match(WORD)||[]}

  /* A cue matches on word boundaries, and on a leading stem so that "report"
     also catches "reported" and "reporting" — but never inside an unrelated word,
     which is what made the old objective matcher fire "can" inside "American". */
  function hits(text,cue){
    const c=norm(cue).trim();
    if(!c)return false;
    if(/\s/.test(c))return norm(text).indexOf(c)>=0;          /* multi-word cue: phrase match */
    const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    /* A trailing silent "e" is dropped before most English endings, so a cue of
       "write" has to reach "writing" and "written", and "isolate" has to reach
       "isolated" and "isolation". Matching the bare cue alone silently failed
       every one of those and marked a good answer as missing the point. */
    const stem=c.length>3&&/e$/.test(c)?c.slice(0,-1):c;
    return new RegExp("\\b"+esc(stem)+"[a-z']{0,5}\\b").test(norm(text));
  }

  function matchedCue(text,cues){
    for(const cue of (cues||[]))if(hits(text,cue))return cue;
    return null;
  }

  /* ---- one question ---- */
  function evaluate(said,rubric){
    const text=String(said||"").trim(),words=wordsOf(text),rb=rubric||{};
    const points=rb.points||[],vocab=rb.vocab||[];
    const base={
      ask:rb.ask||"",model:rb.model||"",why:rb.why||"",source:rb.source||"",
      /* Two words is a real attempt — "the supervisor" answers "who do you tell".
         Dismissing it as "no answer" would be both inaccurate and discouraging;
         it is scored on its merits instead, and will simply cover little. */
      said:text,words:words.length,answered:words.length>=2
    };
    if(!base.answered){
      return Object.assign(base,{
        covered:[],missed:points.map(p=>({id:p.id,label:p.label})),
        vocabUsed:[],vocabMissed:vocab.slice(),coverage:0,
        verdict:"no-answer"
      });
    }
    const covered=[],missed=[];
    points.forEach(p=>{
      const cue=matchedCue(text,p.cues);
      (cue?covered:missed).push({id:p.id,label:p.label,cue:cue||null});
    });
    const vocabUsed=vocab.filter(v=>hits(text,v));
    const coverage=points.length?covered.length/points.length:0;
    return Object.assign(base,{
      covered,missed,
      vocabUsed,vocabMissed:vocab.filter(v=>!vocabUsed.includes(v)),
      coverage,
      /* Bands describe COVERAGE of the model answer, nothing more. They are not
         a mark, a grade, or a statement about the learner's trade ability. */
      verdict:coverage>=0.75?"strong":coverage>=0.4?"partial":"thin"
    });
  }

  /* Apply an AI-reported coverage list on top of the deterministic pass. Only
     point ids that exist in the rubric are honoured, and a point can only be
     ADDED — the model may notice that "I shut it down" covers "say what you did"
     when no cue matched, but it may not take away something the learner said. */
  function applyAssist(result,rubric,coveredIds){
    if(!result||!Array.isArray(coveredIds))return result;
    const valid=new Set((rubric.points||[]).map(p=>p.id));
    let moved=false;
    coveredIds.filter(id=>valid.has(id)).forEach(id=>{
      const i=result.missed.findIndex(m=>m.id===id);
      if(i>=0){result.covered.push(Object.assign({},result.missed[i],{cue:"assisted"}));result.missed.splice(i,1);moved=true}
    });
    if(moved){
      const total=(rubric.points||[]).length;
      result.coverage=total?result.covered.length/total:0;
      result.verdict=result.coverage>=0.75?"strong":result.coverage>=0.4?"partial":"thin";
      result.assisted=true;
    }
    return result;
  }

  /* ---- whole workshop ---- */
  function review(answers){
    const list=(answers||[]).filter(Boolean);
    const spoken=list.filter(a=>a.answered);
    if(!spoken.length){
      return {answered:0,asked:list.length,coverage:0,strengths:[],gaps:[],vocabUsed:[],vocabToLearn:[],evidence:false};
    }
    const gaps=new Map(),vocabToLearn=new Map(),vocabUsed=new Set(),strengths=[];
    spoken.forEach(a=>{
      a.covered.forEach(c=>{if(!strengths.some(s=>s.id===c.id&&s.label===c.label))strengths.push(c)});
      a.missed.forEach(m=>gaps.set(m.id+"|"+m.label,(gaps.get(m.id+"|"+m.label)||0)+1));
      a.vocabUsed.forEach(v=>vocabUsed.add(v));
      a.vocabMissed.forEach(v=>vocabToLearn.set(v,(vocabToLearn.get(v)||0)+1));
    });
    (vocabUsed.size?[...vocabUsed]:[]).forEach(v=>vocabToLearn.delete(v));
    const coverage=spoken.reduce((n,a)=>n+a.coverage,0)/spoken.length;
    return {
      answered:spoken.length,asked:list.length,coverage,evidence:true,
      strengths,
      gaps:[...gaps.entries()].sort((a,b)=>b[1]-a[1]).map(([k,n])=>({label:k.split("|")[1],times:n})),
      vocabUsed:[...vocabUsed],
      vocabToLearn:[...vocabToLearn.entries()].sort((a,b)=>b[1]-a[1]).map(([w])=>w).slice(0,8)
    };
  }

  /* What to practise next, chosen from the learner's own gaps. Returns the
     reason as well as the choice, so the recommendation can always be explained. */
  function nextFocus(rev,scenario,catalogue){
    const list=(catalogue||[]).filter(s=>s&&s.id);
    const here=scenario&&scenario.id;
    if(!rev||!rev.evidence)return {repeat:true,id:here,reason:"You did not record an answer this time, so there is nothing to review yet. Run this workshop again and speak at least one full answer."};
    if(rev.coverage<0.5)return {repeat:true,id:here,reason:`You covered about ${Math.round(rev.coverage*100)}% of what these answers need. Repeat this workshop and aim to add the missing part each time.`};
    const nextIndex=list.findIndex(s=>s.id===here)+1;
    const next=list[nextIndex]||null;
    const gap=rev.gaps[0];
    return {
      repeat:false,id:next?next.id:here,title:next?next.title:(scenario&&scenario.title),
      reason:next
        ?`You covered ${Math.round(rev.coverage*100)}% of these answers.${gap?` Your weakest habit was "${gap.label}" — carry that into the next workshop.`:""}`
        :"You have worked through the available workshops. Repeat the one you found hardest."
    };
  }

  /* ---- Portfolio: what the learner has actually demonstrated ----
     Read from the stored workshop attempts, which hold real spoken answers scored
     against model answers. This is the only place in the product where a number
     comes from what someone said rather than from how many buttons they pressed,
     so it is what the Passport should be built on. */
  function portfolio(s){
    const store=(s&&s.simulations&&s.simulations.attempts)||{};
    let workshops=0,attempts=0,answers=0,demonstrated=0,weighted=0,best=0;
    const perWorkshop=[];
    Object.keys(store).forEach(id=>{
      const runs=(store[id]||[]).filter(a=>a&&a.answered>0);
      if(!runs.length)return;
      workshops++;attempts+=runs.length;
      let bestHere=0;
      runs.forEach(a=>{
        const cov=Number(a.coverage)||0;
        bestHere=Math.max(bestHere,cov);
        answers+=a.answered||0;
        weighted+=cov*(a.answered||0);
        (a.answers||[]).forEach(q=>{if(q&&q.answered&&(Number(q.coverage)||0)>=0.7)demonstrated++});
      });
      best=Math.max(best,bestHere);
      perWorkshop.push({id,attempts:runs.length,best:bestHere});
    });
    return {workshops,attempts,answers,demonstrated,
            average:answers?weighted/answers:0,best,perWorkshop,
            hasEvidence:answers>0};
  }

  /* ==========================================================================
     MODULE GRADING ENGINE

     Grades a whole module transcript against the regulatory benchmarks in the
     track pack and returns the fixed report shape the assessment pipeline
     consumes. Input:  {current_module_id: 1..12, candidate_transcript: "..."}

     Scoring, per the assessment specification:
       PASS  score >= 80 AND every critical safety benchmark covered
       FAIR  score >= 50
       FAIL  score < 50, OR any critical safety benchmark missed
     Score is 80% weighted benchmark coverage + 20% regulatory vocabulary use.

     What `regulatory_compliance_met` means, and does not:
     it is TRUE when the candidate's ANSWER covered the regulatory benchmarks for
     this module. It is a statement about what was said in an interview, never a
     statement that the person is compliant, qualified, certified or legally
     eligible. Those are established by qualification testing, certification
     bodies and employers — never by a spoken answer. `assessment_basis` carries
     that sentence into every report so it cannot be lost downstream.
     ========================================================================== */
  const VERDICT={PASS:"PASS",FAIR:"FAIR",FAIL:"FAIL"};

  function moduleOf(id,catalogue){
    const n=Number(id);
    return (catalogue||[]).find(s=>Number(s.moduleId)===n||s.id==="welding-sim-"+n)||null;
  }

  function gradeTranscript(transcript,reg){
    const text=String(transcript||"").trim(),said=wordsOf(text);
    const bms=(reg&&reg.benchmarks)||[],vocab=(reg&&reg.vocab)||[];
    const met=[],missed=[];
    bms.forEach(b=>{
      const cue=matchedCue(text,b.cues);
      (cue?met:missed).push({id:b.id,must:b.must,critical:!!b.critical,cue:cue||null});
    });
    const vocabUsed=vocab.filter(v=>hits(text,v)),vocabMissed=vocab.filter(v=>!hits(text,v));
    /* Critical benchmarks carry double weight: they are the safety spine of the
       module, not one item among equals. */
    const weight=b=>b.critical?2:1;
    const total=bms.reduce((n,b)=>n+weight(b),0);
    const earned=met.reduce((n,b)=>n+weight(b),0);
    const bScore=total?earned/total:0;
    const vScore=vocab.length?vocabUsed.length/vocab.length:0;
    const score=said.length<2?0:Math.round((bScore*0.8+vScore*0.2)*100);
    const criticalMissed=missed.filter(b=>b.critical);
    /* A missed critical benchmark is a fail whatever the score. Someone who talks
       fluently about a permit but never says the atmosphere must be gas-tested has
       not passed a confined-space assessment, and averaging that away would be the
       one failure mode of this engine that could actually get a person hurt. */
    const verdict=(said.length<2||criticalMissed.length)?VERDICT.FAIL
      :score>=80?VERDICT.PASS:score>=50?VERDICT.FAIR:VERDICT.FAIL;
    return {met,missed,criticalMissed,vocabUsed,vocabMissed,score,verdict,answered:said.length>=2,words:said.length};
  }

  function codeList(reg){return ((reg&&reg.codes)||[]).map(c=>c.code+" ("+c.title+")").join("; ")}

  function evaluateModule(input,catalogue){
    const id=Number(input&&input.current_module_id);
    const transcript=String((input&&input.candidate_transcript)||"");
    const sim=moduleOf(id,catalogue||(global.trackSimulations&&global.trackSimulations())||[]);
    const reg=sim&&sim.regulatory;
    if(!reg){
      return {evaluation:{module_id:id||null,verdict:VERDICT.FAIL,overall_score_percentage:0,
        regulatory_compliance_met:false,
        analysis:{what_was_said_correctly:[],what_is_missing_or_incorrect:["No assessment module is defined for id "+id+"."]},
        feedback_to_candidate:"This module could not be assessed because its benchmarks are not available.",
        interviewer_crosscheck_notes:"No module definition found — do not treat this as a result.",
        assessment_basis:"Not assessed."}};
    }
    const g=gradeTranscript(transcript,reg);
    const correct=g.met.map(b=>b.must+(b.critical?" (core safety benchmark)":""));
    if(g.vocabUsed.length)correct.push("Used correct terminology: "+g.vocabUsed.join(", ")+".");
    const wrong=g.missed.map(b=>(b.critical?"CRITICAL — ":"")+"Did not address: "+b.must+".");
    if(g.vocabMissed.length)wrong.push("Did not use expected terminology: "+g.vocabMissed.join(", ")+".");
    if(!g.answered)wrong.push("No usable spoken answer was recorded for this module.");

    const codes=codeList(reg);
    let feedback;
    if(!g.answered)feedback="You did not give an answer that could be assessed. This module is measured against "+codes+". Record a full spoken answer and it will be assessed properly.";
    else if(g.verdict===VERDICT.PASS)feedback="Pass — "+g.score+"%. You covered every core benchmark for this module under "+codes+"."+(g.vocabMissed.length?" To sharpen it further, work these terms into your answer: "+g.vocabMissed.join(", ")+".":" Your terminology was accurate throughout.");
    else if(g.criticalMissed.length)feedback="Fail — "+g.score+"%. You missed a core safety requirement under "+codes+": "+g.criticalMissed.map(b=>b.must.toLowerCase()).join("; ")+". On a real site this is the part that stops the job or gets someone hurt, so it has to be said out loud every time."+(g.vocabMissed.length?" Terminology to learn: "+g.vocabMissed.join(", ")+".":"");
    else feedback="Fair — "+g.score+"%. You understood the task, but you left out detail an assessor is listening for under "+codes+": "+g.missed.map(b=>b.must.toLowerCase()).join("; ")+"."+(g.vocabMissed.length?" Terminology to learn: "+g.vocabMissed.join(", ")+".":"");

    const notes="Assessed against "+codes+". Requirement: "+reg.requirement+
      " Benchmarks covered "+g.met.length+"/"+(reg.benchmarks||[]).length+
      (g.criticalMissed.length?"; CRITICAL gaps: "+g.criticalMissed.map(b=>b.id).join(", "):"; no critical gaps")+
      ". This records what the candidate SAID. Verify qualification, certification and eligibility independently through test certificates, the awarding body and the employer.";

    return {evaluation:{
      module_id:id,
      verdict:g.verdict,
      overall_score_percentage:g.score,
      regulatory_compliance_met:g.verdict===VERDICT.PASS,
      analysis:{
        what_was_said_correctly:correct,
        what_is_missing_or_incorrect:wrong
      },
      feedback_to_candidate:feedback,
      interviewer_crosscheck_notes:notes,
      assessment_basis:"Communication assessment only. This score reflects whether the candidate stated the required points in English. It is not evidence of welding competence, certification, or legal eligibility to work."
    }};
  }

  global.AnswerEvaluator=Object.freeze({evaluate,applyAssist,review,nextFocus,hits,wordsOf,evaluateModule,gradeTranscript,portfolio});
})(window);
