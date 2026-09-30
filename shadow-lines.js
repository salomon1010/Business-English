/* ============================================================================
   BE Mastery — Workplace lines to shadow
   --------------------------------------------------------------------------
   The lines a learner will actually need at work, drawn from their own trade's
   workshops, spoken by the person who asks for them, and — when they say them
   back — the AI speaking report, judged against the question and the person
   asking (owner, 28 Sep 2026; it used to be a word-by-word score).

   Lifted out of index.html unchanged. It is a clean seam: nothing outside
   referenced any of its internals, and it reaches the rest of the app only
   through globals that exist long before a learner can click anything here —
   esc, t, ic, toast, save, addRec, getRecs, the Executive Polish report
   (exHost, exAI, exRenderReport, sessRepGet/Put), simCharacter, simTitle,
   trackSimulations, ttsVoice and friends.

   Function declarations at this file's top level are globals, which is exactly
   how they behaved inside the inline script, so index.html calls them as before.
   The two recorder variables stay file-scoped — they were never reachable from
   outside and should not become so now.
   ============================================================================ */
function shWorkplaceLines(){
  const sims=(typeof trackSimulations==="function"&&trackSimulations())||[];
  if(!sims.length)return [];
  const pos=currentPos(),out=[];
  /* Lead with the learner's current stage, then let earlier stages follow, so
     the top of the list is always the work they are on now. */
  const order=sims.map((sc,i)=>({sc,i})).sort((a,b)=>
    Math.abs(a.i-(pos.w-1))-Math.abs(b.i-(pos.w-1)));
  order.forEach(({sc})=>{
    const qs=sc.questions||{};
    Object.keys(qs).forEach(k=>{
      const q=qs[k];
      if(!q||!q.model)return;
      const _tr=window.Trades&&isProfessionalJourney()?Trades.active(S):null;
      const _mid=sc.regulatory&&sc.regulatory.moduleId;
      const _tq=(_tr&&_mid&&Trades.questionFor(_tr,_mid,k))||null;
      const _model=(_tq&&_tq.model)||q.model;
      const askerId=k==="open"?(sc.lead||"hr"):((sc.turns||[]).find(t=>t.q===k)||{}).characterId;
      const c=(typeof simCharacter==="function"&&simCharacter(sc,askerId))||{};
      out.push({id:sc.id+":"+k,scenario:simTitle(sc),ask:(_tq&&_tq.ask)||q.ask||"",text:_model,
                who:c.name||"",role:c.role||"",voice:c.voice||"",style:c.voiceStyle||"",g:c.g||"f",
                vocab:((_tq&&_tq.vocab)||q.vocab||[]).slice(0,6)});
    });
  });
  return out;
}
let _shLineSpeaking=null;
window.shSayLine=async(id)=>{
  const line=shWorkplaceLines().find(x=>x.id===id);if(!line)return;
  const btn=document.getElementById("shl-"+id);
  if(_shLineSpeaking===id){shStopLine();return}
  shStopLine();
  _shLineSpeaking=id;
  if(btn){btn.classList.add("on");btn.textContent="■"}
  const done=()=>{if(_shLineSpeaking===id)shStopLine()};
  const canNatural=typeof POLISH_API!=="undefined"&&POLISH_API&&navigator.onLine&&fbVoicePref()!=="browser";
  if(canNatural){
    try{await fbSayApi(line.text,1,ttsVoice(line.voice,line.g),line.style);if(_ttsAudio)_ttsAudio.onended=done;else done();return}
    catch(e){/* fall through to the device voice */}
  }
  if(typeof simSpeakBrowser==="function")simSpeakBrowser(line.text,line.g,done);else done();
};
function shStopLine(){
  if(window.speechSynthesis)speechSynthesis.cancel();
  try{fbStopAudio()}catch(e){}
  if(_shLineSpeaking!=null){
    const b=document.getElementById("shl-"+_shLineSpeaking);
    if(b){b.classList.remove("on");b.textContent="▶"}
  }
  _shLineSpeaking=null;
}
/* Listening to a model is half of shadowing. The other half is saying it back and
   being told how it landed. Since 28 Sep 2026 (owner) that is the AI speaking
   report the Road map session draws — "How you came across", the level, the
   coach's spoken feedback and the five steps — not the word-by-word percentage
   chips it used to be. The take goes through the same Executive Polish pipeline
   (transcribe on the Worker, measure on the device, the coach) with the line's
   own context: who asked, what they asked, the model answer the learner was
   copying and the words it should carry. So the coach judges THIS answer to
   THIS person in the workshop, not a minute of free speech.

   One report per line, in S.notes["exrep:shl:<line id>"] like the session's
   (synced with the notes, `tx` stripped on the way out, kept by sessRepPut
   under its own allowance); the previous report on the same line is the
   "previous take" the carry-over score is marked against. The takes are still
   kept in IndexedDB under the line's context, as before. */
let _shRec=null,_shRecFor=null;
const _shLineBusy=new Set(),_shLineUrl=new Map();
const SH_LINE_MIN_S=3;                 /* a workplace line is short — the session's 8 s floor would refuse most of them */
function shLineFeedback(id,html){
  const box=document.getElementById("shst-"+id);
  if(box)box.innerHTML=html;
}
function shLineCtx(id){return "line-"+id}
function shLineRepKey(id){return "shl:"+id}
function shLineWrapId(id){return "shrep-"+id}
/* What the coach is told. The Worker's context block is short (focus 160,
   task 300, outcome 200 characters), so the question is trimmed first and the
   model answer takes whatever room is left. */
function shLineCoachCtx(line){
  const lim=(s,n)=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,Math.max(0,n-1))+"…":s};
  const who=line.who||"a colleague",role=line.role?" ("+line.role+")":"";
  const head=`Shadowing. ${who}${role} asked: "${lim(line.ask,110)}" The learner heard a model answer, then said it back in their own voice. The model answer: "`;
  return {track:isGeneralEnglish()?"general":"welding",
    focus:lim("Shadowing a workplace line · "+(line.scenario||""),160),
    task:head+lim(line.text,Math.max(40,299-head.length))+'"',
    out:lim(`Answer ${who}'s question clearly and naturally, carrying what the model answer says, the way you would on the job`,200),
    phrases:(line.vocab||[]).map(v=>String(v).slice(0,80)).filter(Boolean).slice(0,6)};
}
/* The report's host (see exHost): its own wrap under the line, its own report
   and previous take, and "Say it again" brings the learner back to this line's
   microphone. */
function shLineHost(id,rep,open){
  return {wrapId:shLineWrapId(id),key:shLineRepKey(id),report:rep||null,prev:(rep&&rep.prev)||null,
    url:_shLineUrl.get(id)||null,repOpen:open!==false,again:()=>shLineAgain(id)};
}
function shLineOn(id){return !!exHost&&exHost.wrapId===shLineWrapId(id)&&!!document.getElementById(shLineWrapId(id))}
function shLineAgain(id){
  const b=document.getElementById("shr-"+id);if(!b)return;
  try{b.scrollIntoView({behavior:"smooth",block:"center"})}catch(e){}
  b.classList.add("exd-ring");setTimeout(()=>b.classList.remove("exd-ring"),2400);
}
/* Several lines can carry a report at once, and every button inside a report
   reads the host. Touching a report makes it the host before its button's
   click lands — the same trick the scenario history uses. */
window.shLineFocus=id=>{
  if(exHost&&exHost.wrapId===shLineWrapId(id))return;
  const rep=sessRepGet(shLineRepKey(id));if(!rep)return;
  const d=document.querySelector("#"+CSS.escape(shLineWrapId(id))+" .ex-rep-card");
  exCoachStop();
  exHost=shLineHost(id,rep,!d||d.open);
};
function shLineNote(id,msg,retry){
  const w=document.getElementById(shLineWrapId(id));if(!w)return;
  w.innerHTML=`<p class="ex-note">${esc(msg)}</p>${retry?`<button class="btn-primary sess-rep-btn" onclick="shLineReportLast('${esc(id)}')">${tIc("sess.report_btn","sparkle")}</button>`:""}`;
  manIconizeInline(w);
}
window.shLineReportLast=async id=>{
  let recs=[];try{recs=await getRecs(shLineCtx(id))}catch(e){}
  if(!recs[0])return toast(t("sess.report_none"));
  shLineReport(id,recs[0].blob,0);
};
async function shLineReport(id,blob,secs){
  const line=shWorkplaceLines().find(x=>x.id===id);
  if(!line||_shLineBusy.has(id)||!document.getElementById(shLineWrapId(id)))return;
  if(!POLISH_API||!navigator.onLine){exHost=shLineHost(id,null,true);shLineNote(id,t("sess.report_off"),true);return}
  const key=shLineRepKey(id),area=areaId();
  _shLineBusy.add(id);exCoachStop();
  exHost=shLineHost(id,null,true);exReportShow(exWaitHTML(t("ex.step_stt")),true);
  try{
    let audio=null;
    if(!secs){audio=await exAudioStats(blob);secs=(audio&&audio.dur)||0}   /* an older take: its length is only on the audio */
    if(secs<SH_LINE_MIN_S){shLineNote(id,t("sess.report_short",{n:SH_LINE_MIN_S}));return}
    const [tx,au]=await Promise.all([exTranscribe(blob),audio?Promise.resolve(audio):exAudioStats(blob)]);
    audio=au||{dur:secs,pitch:null,pauses:[]};if(!audio.dur)audio.dur=secs;
    if(!tx||!tx.text){shLineNote(id,t("sess.report_stt"),true);return}
    if(shLineOn(id))exStep(t("ex.step_measure"));
    const m=exTextStats(tx.text,tx.words,audio);
    if(shLineOn(id))exStep(t("ex.step_plan"));
    const ctx=shLineCoachCtx(line);
    const ai=await exAI(tx.text,m,ctx);
    /* the coach could not be reached: nothing is stored, so the retry sends the take again */
    if(!ai){shLineNote(id,t("ex.ai_off"),true);return}
    const prev=sessRepGet(key);
    const rep={at:Date.now(),tk:area,key,kind:"shadowline",line:id,m,ai,tx:tx.text,sttFailed:false,targets:exTargets(ai),ctx};
    if(prev&&prev.m)rep.prev={at:prev.at,m:prev.m,targets:prev.targets||[]};
    sessRepPut(key,rep);
    markPracticed();
    try{awardCompetency({activityType:"shadow_session",lesson:"Workplace line · "+line.scenario,duration:1,dedupeKey:"line:"+id+":"+rep.at})}catch(e){}
    save();
    if(cur&&(cur.v==="shadow"||cur.v==="lines")&&document.getElementById(shLineWrapId(id))){
      exHost=shLineHost(id,rep,true);exRenderReport(rep);
      /* "Your performance analysis" in the coach pop-up opens this report */
      window._shLastReport="shfb-"+id;
    }
  }catch(e){
    try{console.warn("[shadow line] speaking report unavailable",e)}catch(_){}
    shLineNote(id,t("ex.ai_off"),true);
  }finally{_shLineBusy.delete(id)}
}
/* Called after the Shadow view renders: every line you have already worked on
   gets its report back, closed. A line practised before the AI report existed
   (or while the coach was out of reach) still has its takes, so it is offered
   the report on the newest one instead of the old word chips. */
window.shLinesRestore=()=>{
  let drew=false;
  shWorkplaceLines().forEach(l=>{
    const w=document.getElementById(shLineWrapId(l.id));if(!w)return;
    if(_shLineBusy.has(l.id)){w.innerHTML=`<p class="ex-note">${esc(t("sh.line_checking"))}</p>`;return}
    const rep=sessRepGet(shLineRepKey(l.id));
    if(rep){exHost=shLineHost(l.id,rep,false);exRenderReport(rep,true);drew=true;return}
    getRecs(shLineCtx(l.id)).then(recs=>{
      if(!recs||!recs.length||sessRepGet(shLineRepKey(l.id))||w.children.length)return;
      w.innerHTML=`<button class="btn-primary sess-rep-btn" onclick="shLineReportLast('${esc(l.id)}')">${tIc("sess.report_btn","sparkle")}</button>`;
      manIconizeInline(w);
    }).catch(()=>{});
  });
  if(drew)exHost=null;
};
window.shLineRecord=async(id)=>{
  const line=shWorkplaceLines().find(x=>x.id===id);if(!line)return;
  const btn=document.getElementById("shr-"+id),ctx=shLineCtx(id);
  if(_shRec&&_shRecFor===id){
    const rec=_shRec;_shRec=null;
    if(btn){btn.classList.remove("rec");btn.textContent=t("sh.line_rec")}
    shLineFeedback(id,"");
    let blob=null;
    await new Promise(res=>{rec.mr.onstop=()=>{blob=rec.chunks.length?new Blob(rec.chunks,{type:rec.mr.mimeType||"audio/webm"}):null;res()};
      try{rec.mr.stop()}catch(e){res()}; setTimeout(res,1500)});
    try{rec.stream.getTracks().forEach(x=>x.stop())}catch(e){}
    _shRecFor=null;
    if(!blob||blob.size<1200){shLineFeedback(id,`<span class="sh-line-wait">${esc(t("sh.line_nothing"))}</span>`);return}
    /* Keep the take, exactly as a video clip does, so takes can be compared. */
    try{await addRec(ctx,line.who+" — "+line.scenario,blob,Date.now())}catch(e){}
    const old=_shLineUrl.get(id);if(old){try{URL.revokeObjectURL(old)}catch(e){}}
    _shLineUrl.set(id,URL.createObjectURL(blob));    /* "hear yourself" in the report's Listen step */
    await shLineReport(id,blob,(Date.now()-rec.t0)/1000);
    return;
  }
  shStopLine();
  if(_shRec){try{_shRec.stream.getTracks().forEach(x=>x.stop())}catch(e){} _shRec=null;_shRecFor=null}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return toast(t("fb.sr_unavailable"));
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}
  catch(e){return toast(t("rec.mic_denied_toast"))}
  const chunks=[];let mr;
  try{mr=new MediaRecorder(stream)}catch(e){try{stream.getTracks().forEach(x=>x.stop())}catch(_){}; return toast(t("rec.mic_denied_toast"))}
  mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  mr.start();
  _shRec={mr,chunks,stream,t0:Date.now()};_shRecFor=id;
  if(btn){btn.classList.add("rec");btn.textContent=t("sh.line_stop")}
  shLineFeedback(id,`<span class="sh-line-wait">${esc(t("sh.line_listening"))}</span>`);
};
const SH_LINES_SHOWN=6;
function shWorkplaceLinesHTML(){
  const lines=shWorkplaceLines();
  if(!lines.length)return "";
  /* The first line is the way in. Twelve identical rows with twelve identical
     buttons told a learner nothing about where to start, which is the same gap
     the workshop cast had. Only the first, and only ever one. */
  let _first=true;
  /* The play button lives on the speaker row, not in a column of its own: a
     44px gutter down the left of every line, button, and report was empty
     space on a phone. The sentence runs edge to edge. */
  const card=l=>{const lead=_first;_first=false;return `<div class="sh-line">
    <div class="sh-line-t">
      <div class="sh-line-spk">
        <button class="sh-line-play" id="shl-${esc(l.id)}" onclick="shSayLine('${esc(l.id)}')"
          aria-label="Hear this line">▶</button>
        <span class="sh-line-who">${esc(l.who)}${l.role?" · "+esc(l.role):""} <em>${esc(l.scenario)}</em></span>
      </div>
      <p>“${esc(l.text)}”</p>
      ${l.ask?`<small>${esc(t("sh.line_answering",{q:l.ask}))}</small>`:""}
      <button class="btn btn-g btn-sm sh-line-rec ${lead?"cta-lead":""}" id="shr-${esc(l.id)}" onclick="shLineRecord('${esc(l.id)}')">${esc(t("sh.line_rec"))}</button>
      <div class="sh-line-fb" id="shfb-${esc(l.id)}">
        <div class="sh-line-st" id="shst-${esc(l.id)}"></div>
        <div class="sh-line-rep" id="shrep-${esc(l.id)}" onpointerdown="shLineFocus('${esc(l.id)}')" onfocusin="shLineFocus('${esc(l.id)}')"></div>
      </div>
    </div>
  </div>`;};
  return `<div class="card sh-lines">
    <div class="eyebrow">${esc((window.Trades&&isProfessionalJourney()?t("sh.lines_eyebrow_trade",{trade:Trades.active(S).name}):null)||t("sh.lines_eyebrow"))}</div>
    <h2 class="sh-lines-h">${esc(t("sh.lines_title"))}</h2>
    <p class="sh-lines-sub">${esc(t("sh.lines_sub"))}</p>
    <p class="sh-lines-fb"><b>${esc(t("sh.feedback_title"))}</b> <span class="chip p3">${esc(t("sh.feedback_beta_tag"))}</span><br><span>${esc(t("sh.lines_fb_desc"))}</span></p>
    ${lines.slice(0,SH_LINES_SHOWN).map(card).join("")}
    ${lines.length>SH_LINES_SHOWN?`<details class="home-more sh-more">
      <summary><span class="btn-ic">${ic("chat")}</span>${esc(t("sh.lines_more",{n:lines.length-SH_LINES_SHOWN}))}<span class="hm-chev">▶</span></summary>
      <div class="home-more-body">${lines.slice(SH_LINES_SHOWN).map(card).join("")}</div>
    </details>`:""}
  </div>`;
}
