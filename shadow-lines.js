/* ============================================================================
   BE Mastery — Workplace lines to shadow
   --------------------------------------------------------------------------
   The lines a learner will actually need at work, drawn from their own trade's
   workshops, spoken by the person who asks for them, and scored word by word
   when they say them back.

   Lifted out of index.html unchanged. It is a clean seam: nothing outside
   referenced any of its internals, and it reaches the rest of the app only
   through globals that exist long before a learner can click anything here —
   esc, t, ic, toast, save, addRec, fbAssess, fbShowResults, waveRender,
   perfPanel, simCharacter, simTitle, trackSimulations, ttsVoice and friends.

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
   being told how it landed, which the app already does well: fbAssess sends the
   recording to an audio model that grades each word. Reused here rather than
   rebuilt, so a workplace line is practised exactly like a video clip was. */
let _shRec=null,_shRecFor=null;
function shLineFeedback(id,html){
  const box=document.getElementById("shfb-"+id);
  if(box)box.innerHTML=html;
}
/* The report a workplace line produces is the same one a video clip produced:
   takes kept, per-word pronunciation, the waveform of this take against the last
   one with its duration and pause deltas, the vocabulary the answer was supposed
   to carry, and the score trend across attempts. It reuses addRec, getRecs,
   decodePeaks, countPauses, fbAssess and perfPanel rather than reimplementing
   any of them, so both sides of Shadow stay in step. */
function shLineCtx(id){return "line-"+id}
/* The report is long — takes, waveform, every word scored, vocabulary, trend —
   and it pushes the line you are trying to shadow off the screen. Rather than
   shortening it, it folds: the pieces are rendered exactly as they are and then
   wrapped, so nothing that writes into this slot has to know about the wrapper.
   Open after a recording, because you just asked for it; collapsible from then
   on, and it stays collapsed until you look again. */
function shLineFold(slot,headline){
  const box=document.getElementById(slot);
  if(!box||!box.children.length||box.querySelector(".sh-line-report"))return;
  /* The coaching modal opens on top of this a moment later. It offers "Your
     performance analysis", and this is what the learner means by that — the take
     they just recorded, the words they missed. The report is built here and not
     rebuilt on a re-render, so the button has to come back to this element
     rather than navigate anywhere. */
  window._shLastReport=slot;
  const d=document.createElement("details");
  d.className="sh-line-report";d.open=true;
  const sum=document.createElement("summary");
  sum.innerHTML=`<span class="sh-line-report-h">${esc(headline)}</span><span class="sh-line-chev" aria-hidden="true">›</span>`;
  const body=document.createElement("div");body.className="sh-line-report-body";
  while(box.firstChild)body.appendChild(box.firstChild);
  d.appendChild(sum);d.appendChild(body);box.appendChild(d);
}
window.shLineRecord=async(id)=>{
  const line=shWorkplaceLines().find(x=>x.id===id);if(!line)return;
  const btn=document.getElementById("shr-"+id),ctx=shLineCtx(id);
  if(_shRec&&_shRecFor===id){
    const rec=_shRec;_shRec=null;
    if(btn){btn.classList.remove("rec");btn.textContent=t("sh.line_rec")}
    shLineFeedback(id,`<span class="sh-line-wait">${esc(t("sh.line_checking"))}</span>`);
    /* stop live transcription and bank whatever it heard */
    if(rec.sr){try{rec.sr.onend=null;rec.sr.stop()}catch(e){}
      rec.heard.txt=((rec.heard.txt||"")+" "+(rec.heard.cur||"")).trim();}
    let blob=null;
    await new Promise(res=>{rec.mr.onstop=()=>{blob=rec.chunks.length?new Blob(rec.chunks,{type:rec.mr.mimeType||"audio/webm"}):null;res()};
      try{rec.mr.stop()}catch(e){res()}; setTimeout(res,1500)});
    try{rec.stream.getTracks().forEach(x=>x.stop())}catch(e){}
    _shRecFor=null;
    if(!blob||blob.size<1200){shLineFeedback(id,`<span class="sh-line-wait">${esc(t("sh.line_nothing"))}</span>`);return}
    /* Keep the take, exactly as a video clip does, so takes can be compared. */
    try{await addRec(ctx,line.who+" — "+line.scenario,blob,Date.now())}catch(e){}
    let res=null;
    try{res=await fbAssess(blob,line.text)}catch(e){}
    if(!res||!res.words||!res.words.length){
      /* Online but refused is a different problem from offline, and telling the
         learner to check their connection when the connection is fine wastes
         their time. */
      const why=navigator.onLine?"sh.line_blocked":"sh.line_nograde";
      /* The take is kept whether or not it can be graded, so it still has to be
         shown — an ungraded recording that vanishes reads as a lost recording.
         It gets an element of its own because renderRecs writes over everything
         in the element it is handed, message included. */
      shLineFeedback(id,`<span class="sh-line-wait">${esc(t(why))}</span>
        <div class="sh-line-takes"><b>${esc(t("sh.line_takes_h"))}</b><div id="recl-${esc(id)}"></div></div>`);
      try{await renderRecs(ctx,"recl-"+id)}catch(e){}
      return;
    }
    const col=v=>v>=80?"var(--green)":v>=55?"var(--gold)":"var(--red)";
    res.words.forEach(w=>{const k=String(w.word||"").toLowerCase().replace(/[^a-z']/g,"");
      if(k.length>3&&w.score<80&&!isTrackStopWord(k)){S.trouble=S.trouble||{};S.trouble[k]=Math.max(S.trouble[k]||0,100-w.score)}});
    /* Score history per line, so the trend chart is the same component the video
       side uses. */
    S.fbV=S.fbV||{};(S.fbV[ctx]=S.fbV[ctx]||[]).push(res.overall);
    if(S.fbV[ctx].length>20)S.fbV[ctx]=S.fbV[ctx].slice(-20);
    markPracticed();
    awardCompetency({activityType:"shadow_session",lesson:"Workplace line · "+line.scenario,duration:1,dedupeKey:"line:"+id+":"+S.fbV[ctx].length});
    save();
    /* Did the answer carry the words it is supposed to carry? */
    const said=String(res.text||line.text).toLowerCase();
    const spoken=res.words.map(w=>String(w.word||"").toLowerCase()).join(" ");
    const used=(line.vocab||[]).filter(v=>window.AnswerEvaluator&&AnswerEvaluator.hits(spoken,v));
    const missed=(line.vocab||[]).filter(v=>used.indexOf(v)<0);
    /* The Speaking feedback engine owns the headline analysis — word-by-word
       green/yellow against the target, pace, fillers, the lot. It is given this
       line as the target and its own slot to render into, so a workplace line
       and a video clip are analysed by exactly the same code. */
    const slot="shfb-"+id;
    shLineFeedback(id,"");
    fbCtx={vid:ctx,recCtx:ctx};
    fbT0=rec.t0||Date.now()-8000;
    const heardTxt=(rec.heard&&rec.heard.txt||"").trim();
    if(heardTxt){
      S.notes["shheard:"+ctx]=heardTxt;S.notes["shheardDur:"+ctx]=Date.now()-(rec.t0||Date.now());
      try{fbShowResults(line.text,heardTxt,"new",slot)}catch(e){}
    }
    /* Then the extras a line has and a clip does not: the pronunciation grade on
       the audio itself, the words this answer must carry, the waveform against
       the previous take, and the trend. */
    const box=document.getElementById(slot);
    if(box)box.insertAdjacentHTML("afterbegin",`
      <div class="sh-line-takes">
        <b>${esc(t("sh.line_takes_h"))}</b>
        <div id="recl-${esc(id)}"></div>
        <div id="wave-${esc(id)}" style="margin-top:12px"></div>
      </div>`);
    /* The clip workspace's own take list and waveform, rendered into this line's
       slot. Both take an element id now for the same reason fbShowResults does:
       several lines can be open at once. */
    try{await renderRecs(ctx,"recl-"+id)}catch(e){}
    try{await waveRender(ctx,"wave-"+id)}catch(e){}
    if(box)box.insertAdjacentHTML("beforeend",`
      <div class="sh-line-extra">
        <div class="sh-line-score" style="--c:${col(res.overall)}"><b>${res.overall}%</b>${esc(t("sh.line_yours"))}</div>
        <div class="fb-pw-wrap">${res.words.map(w=>`<span class="fb-pw" style="--c:${col(w.score)}">${esc(w.word)}<b>${w.score}</b></span>`).join("")}</div>
        ${(line.vocab||[]).length?`<div class="sh-line-voc"><b>${esc(t("sh.line_vocab"))}</b>
          <div class="sim-skill-chips">${used.map(v=>`<span class="ok">✓ ${esc(v)}</span>`).join("")}</div>
          ${missed.length?vocPickChips(missed,"Shadowing"):""}</div>`:""}
        ${perfPanel(perfSeries("clip",ctx))}
      </div>`);
    shLineFold(slot,t("sh.line_report",{pct:res.overall}));
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
  /* Live transcription runs beside the recorder, exactly as it does for a video
     clip, so the take can be scored by the real Speaking feedback engine rather
     than by a private approximation of it. */
  let sr=null,heard={txt:"",cur:""};
  if(SR){
    try{
      sr=new SR();sr.lang="en-US";sr.continuous=true;sr.interimResults=true;
      sr.onresult=e=>{heard.cur=srText(e.results)};
      sr.onerror=()=>{};
      sr.onend=()=>{heard.txt=((heard.txt||"")+" "+(heard.cur||"")).trim();heard.cur="";
        if(_shRec&&_shRec.sr===sr){try{sr.start()}catch(e){}}};
      sr.start();
    }catch(e){sr=null}
  }
  _shRec={mr,chunks,stream,sr,heard,t0:Date.now()};_shRecFor=id;
  if(btn){btn.classList.add("rec");btn.textContent=t("sh.line_stop")}
  shLineFeedback(id,`<span class="sh-line-wait">${esc(t("sh.line_listening"))}</span>`);
};
const SH_LINES_SHOWN=6;
function shWorkplaceLinesHTML(){
  const lines=shWorkplaceLines();
  if(!lines.length)return "";
  const card=l=>`<div class="sh-line">
    <button class="sh-line-play" id="shl-${esc(l.id)}" onclick="shSayLine('${esc(l.id)}')"
      aria-label="Hear this line">▶</button>
    <div class="sh-line-t">
      <span class="sh-line-who">${esc(l.who)}${l.role?" · "+esc(l.role):""} <em>${esc(l.scenario)}</em></span>
      <p>“${esc(l.text)}”</p>
      ${l.ask?`<small>${esc(t("sh.line_answering",{q:l.ask}))}</small>`:""}
      <button class="btn btn-g btn-sm sh-line-rec" id="shr-${esc(l.id)}" onclick="shLineRecord('${esc(l.id)}')">${esc(t("sh.line_rec"))}</button>
      <div class="sh-line-fb" id="shfb-${esc(l.id)}"></div>
    </div>
  </div>`;
  return `<div class="card sh-lines">
    <div class="eyebrow">${esc((window.Trades&&isProfessionalJourney()?t("sh.lines_eyebrow_trade",{trade:Trades.active(S).name}):null)||t("sh.lines_eyebrow"))}</div>
    <h2 class="sh-lines-h">${esc(t("sh.lines_title"))}</h2>
    <p class="sh-lines-sub">${esc(t("sh.lines_sub"))}</p>
    <p class="sh-lines-fb"><b>${esc(t("sh.feedback_title"))}</b> <span class="chip p3">${esc(t("sh.feedback_beta_tag"))}</span><br><span>${esc(t("sh.feedback_desc"))}</span></p>
    ${lines.slice(0,SH_LINES_SHOWN).map(card).join("")}
    ${lines.length>SH_LINES_SHOWN?`<details class="home-more sh-more">
      <summary><span class="btn-ic">${ic("chat")}</span>${esc(t("sh.lines_more",{n:lines.length-SH_LINES_SHOWN}))}<span class="hm-chev">▶</span></summary>
      <div class="home-more-body">${lines.slice(SH_LINES_SHOWN).map(card).join("")}</div>
    </details>`:""}
  </div>`;
}
