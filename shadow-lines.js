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
const SH_LINE_WEAK=80;                 /* below this a word is worth practising */
function shCol(v){return v>=80?"var(--green)":v>=55?"var(--gold)":"var(--red)"}

/* ---- The report has to outlive the session ------------------------------
   Recordings were already kept (IndexedDB, per line context) but the analysis
   over them was not, so coming back to Shadow showed an empty slot under every
   line and the only way to see how you had been doing was to record again. The
   last grading is now kept in state — words and scores only, never audio — and
   replayed on render, so the history is there when you walk back in. */
function shLineStore(){S.shLine=S.shLine||{};return S.shLine}
function shLineRemember(ctx,res,said){
  const st=shLineStore();
  st[ctx]={ts:Date.now(),overall:res.overall,said:said||"",
    words:res.words.slice(0,80).map(w=>({w:String(w.word||""),s:w.score,n:w.note||""}))};
  /* localStorage holds all of S as one blob and it syncs to Firestore as one
     document, so this cannot grow without a ceiling. */
  const keys=Object.keys(st);
  if(keys.length>60)keys.sort((a,b)=>(st[a].ts||0)-(st[b].ts||0)).slice(0,keys.length-60).forEach(k=>delete st[k]);
}
/* "Your performance over time" is the point of shadowing the same line twice,
   so it is always present rather than appearing only once a trend exists —
   below two attempts it says so instead of leaving a hole. */
function shLinePerfHTML(ctx){
  const series=perfSeries("clip",ctx);
  const chart=perfPanel(series,{first:Math.max(1,series.length-4)});
  if(chart)return chart;
  return `<div class="sh-trend"><b class="sh-trend-h">${hIcon("chart",t("sh.trend_title"))}</b>
    <p class="sh-line-perf-one">${esc(t("sh.line_perf_one"))}</p></div>`;
}
/* Worst score wins when the same word was said more than once: the position is
   kept too, because that is what cuts the word back out of your own recording.
   Short function words and the track's stop-words are set aside — the same
   judgement the trouble-word list already makes, since nobody drills "I" — but
   only while something else is left to work on. A list that hid every flagged
   word and then said the delivery was clear would be a lie. */
function shLineWeak(words){
  const best=new Map();
  (words||[]).forEach((w,i)=>{
    const k=String(w.w||"").toLowerCase().replace(/[^a-z']/g,"");
    if(!k||!(w.s<SH_LINE_WEAK))return;
    const prev=best.get(k);
    if(!prev||w.s<prev.score)best.set(k,{word:k,score:w.s,note:w.n||"",widx:i,wcount:words.length,
      minor:k.length<=3||isTrackStopWord(k)});
  });
  const all=[...best.values()].sort((a,b)=>a.score-b.score);
  const worth=all.filter(x=>!x.minor);
  return (worth.length?worth:all).slice(0,12);
}
/* Every word that did not land, with the three things a learner asks for next:
   what it should sound like, what they actually said, and a way to keep it. A
   kept word goes into S.vocab, which is what the study cards, the pop quiz, the
   word puzzles and the grammar drills in Practice already run off. */
function shLineWeakHTML(ctx,weak,graded){
  if(!graded)return "";
  const head=`<b class="sh-line-analyze-h">${hIcon("mic",t("sess.analyze_btn"))}</b>`;
  if(!weak.length)return `<div class="sh-line-analyze">${head}
    <p class="rp-ev-good" style="margin-top:9px">${tIc("fb.pron_all_good","check")}</p></div>`;
  const V=S.vocab||{};
  return `<div class="sh-line-analyze">${head}
    <p class="sh-line-analyze-sub">${esc(t("rp.eval_words_sub"))}</p>
    ${weak.map(w=>{const on=!!V[w.word];return `
      <div class="rp-ev-word">
        <span class="rp-ev-wdot" style="background:${shCol(w.score)}"></span>
        <span class="rp-ev-wtxt"><b>${esc(w.word)}</b>${w.note?`<small>${esc(w.note)}</small>`:""}</span>
        <span class="rp-ev-wpct" style="color:${shCol(w.score)}">${w.score}%</span>
        <span class="sh-line-acts">
          <button class="btn btn-g btn-sm voc-mini" onclick="fbSay('${esc(w.word)}',1)"
            title="${esc(t("voc.hear_title"))}" aria-label="${esc(t("voc.hear_title"))}">${ic("sound")}</button>
          <button class="btn btn-g btn-sm voc-mini" onclick="fbSay('${esc(w.word)}',0.5)"
            title="${esc(t("fb.slow_btn"))}" aria-label="${esc(t("fb.slow_btn"))}">${ic("gauge")}</button>
          <button class="btn btn-g btn-sm voc-mini" onclick="shLineMine('${esc(ctx)}',${w.widx},${w.wcount},'${esc(w.word)}')"
            title="${esc(t("rp.eval_yours"))}" aria-label="${esc(t("rp.eval_yours"))}">${ic("play")}</button>
          <button class="btn btn-sm voc-mini ${on?"btn-p":"btn-g"}" data-shw="${esc(w.word)}"
            onclick="shLineWordSave('${esc(w.word)}')" title="${esc(t("voc.save_title"))}"
            aria-label="${esc(t("voc.save_title"))}">${on?ic("check"):ic("bookmark")}</button>
        </span>
      </div>`}).join("")}
    <button class="btn btn-p btn-sm sh-line-voc-go" onclick="gotoVocab()">${tIc("rp.eval_open_vocab","book")}</button>
  </div>`;
}
window.shLineWordSave=w=>{
  S.vocab=S.vocab||{};
  const on=!S.vocab[w];
  if(on)S.vocab[w]={l:"Shadowing",ts:Date.now()}; else delete S.vocab[w];
  /* The same word can be flagged on several lines at once, so every button for
     it repaints together rather than the two copies disagreeing on screen. */
  document.querySelectorAll("[data-shw]").forEach(b=>{
    if(b.dataset.shw!==w)return;
    b.classList.toggle("btn-p",on);b.classList.toggle("btn-g",!on);
    b.innerHTML=on?ic("check"):ic("bookmark");manIconizeInline(b);
  });
  document.querySelectorAll(".voc-chip").forEach(c=>{if(c.dataset.w===w)vocPickPaint(c,on)});
  save();toast(t(on?"voc.saved_toast":"voc.removed_toast"));
  try{vlRender()}catch(e){}
  try{navBadges()}catch(e){}
};
/* Hear the word as YOU said it, cut out of your own take — the same routine the
   role-play evaluation uses, reading the newest recording kept for this line
   instead of an in-memory turn, so it still works after a reload. Whisper
   timings first, energy bursts second, a length-weighted estimate last. */
const _shMineUrl=new Map();
window.shLineMine=async(ctx,widx,wcount,word)=>{
  let recs=[];try{recs=await getRecs(ctx)}catch(e){}
  const rec=recs&&recs[0];
  if(!rec||!rec.blob)return toast(t("rp.eval_noaudio"));
  let url=_shMineUrl.get(rec.id);
  if(!url){url=URL.createObjectURL(rec.blob);_shMineUrl.set(rec.id,url)}
  const words=await fbWords(rec.blob);
  const seg=words?null:await fbSegments(rec.blob);
  try{speechSynthesis.cancel()}catch(_){}
  fbStopAudio();
  const a=ttsPlayer(); _ttsAudio=a; a.onended=null; a.playbackRate=1;
  const playSpan=d=>{
    let start=null,end=null;
    if(words&&words.length){const o=rpPickWord(words,word,widx,wcount);start=o.start;end=o.end;}
    else if(seg&&seg.segs&&seg.segs.length&&wcount>0){
      let si=seg.segs.length===wcount?widx:Math.round((widx+0.5)/wcount*seg.segs.length-0.5);
      si=Math.max(0,Math.min(seg.segs.length-1,si));
      start=seg.segs[si].start;end=seg.segs[si].end;
    }else{
      const f=fbWordFrac(new Array(Math.max(1,wcount)).fill("word"),widx);
      const pad=0.18;start=Math.max(0,f[0]*d-pad);end=Math.min(d,f[1]*d+pad);
    }
    const st=Math.max(0,start-0.04),en=Math.min(d,end+0.08);
    try{a.currentTime=st}catch(_){}
    a.play().catch(()=>{});
    setTimeout(()=>{if(_ttsAudio===a){try{a.pause()}catch(_){}}},Math.max(320,(en-st)*1000+120));
  };
  const begin=()=>{
    if(isFinite(a.duration)&&a.duration>0)return playSpan(a.duration);
    /* webm from MediaRecorder often reports Infinity until it is seeked */
    a.currentTime=1e10;
    a.onseeked=()=>{a.onseeked=null;playSpan(a.duration)};
  };
  if(a.src===url&&a.readyState>=1)begin();
  else{a.src=url;a.onloadedmetadata=()=>{a.onloadedmetadata=null;begin()}}
};
/* The report is long — takes, waveform, every word scored, vocabulary, trend —
   and it pushes the line you are trying to shadow off the screen. Rather than
   shortening it, it folds: the pieces are rendered exactly as they are and then
   wrapped, so nothing that writes into this slot has to know about the wrapper.
   Open after a recording, because you just asked for it; closed when it is
   history restored on arrival, so the list of lines stays readable. */
function shLineFold(slot,headline,open){
  const box=document.getElementById(slot);
  if(!box||!box.children.length||box.querySelector(".sh-line-report"))return null;
  /* "Your performance analysis" elsewhere in the app means this — the take just
     recorded and the words missed. It is built here and not rebuilt on a
     re-render, so that button comes back to this element rather than navigating. */
  if(open)window._shLastReport=slot;
  const d=document.createElement("details");
  d.className="sh-line-report";d.open=!!open;
  const sum=document.createElement("summary");
  sum.innerHTML=`<span class="sh-line-report-h">${esc(headline)}</span><span class="sh-line-chev" aria-hidden="true">›</span>`;
  const body=document.createElement("div");body.className="sh-line-report-body";
  while(box.firstChild)body.appendChild(box.firstChild);
  d.appendChild(sum);d.appendChild(body);box.appendChild(d);
  return d;
}
/* One builder for both paths: the report you have just earned, and the report
   you left behind last time. Performance over time and the word-by-word
   analysis come first — they are what the learner came back for — with the
   kept takes and the waveform underneath. */
async function shLineRender(id,line,data,open){
  const slot="shfb-"+id,ctx=shLineCtx(id);
  const box=document.getElementById(slot);
  if(!box||!data)return;
  const words=data.words||[],graded=words.length>0;
  const used=(line.vocab||[]).filter(v=>window.AnswerEvaluator&&AnswerEvaluator.hits(data.said||"",v));
  const missed=(line.vocab||[]).filter(v=>used.indexOf(v)<0);
  box.innerHTML=`
    ${graded?`<div class="sh-line-head">
      <div class="sh-line-score" style="--c:${shCol(data.overall)}"><b>${data.overall}%</b>${esc(t("sh.line_yours"))}</div>
      <div class="fb-pw-wrap">${words.map(w=>`<span class="fb-pw" style="--c:${shCol(w.s)}">${esc(w.w)}<b>${w.s}</b></span>`).join("")}</div>
    </div>`:""}
    ${shLinePerfHTML(ctx)}
    ${shLineWeakHTML(ctx,shLineWeak(words),graded)}
    ${(line.vocab||[]).length&&graded?`<div class="sh-line-voc"><b>${esc(t("sh.line_vocab"))}</b>
      <div class="sim-skill-chips">${used.map(v=>`<span class="ok">✓ ${esc(v)}</span>`).join("")}</div>
      ${missed.length?vocPickChips(missed,"Shadowing"):""}</div>`:""}
    <div class="sh-line-extra" id="shfbx-${esc(id)}"></div>
    <div class="sh-line-takes">
      <b>${esc(t("sh.line_takes_h"))}</b>
      <div id="recl-${esc(id)}"></div>
      <div id="wave-${esc(id)}" style="margin-top:12px"></div>
    </div>`;
  manIconizeInline(box);
  const d=shLineFold(slot,t("sh.line_report",{pct:data.overall}),open);
  /* Decoding every take of every line on arrival would freeze the list, so a
     closed report fills itself the first time it is opened. */
  const fill=async()=>{
    try{await renderRecs(ctx,"recl-"+id)}catch(e){}
    try{await waveRender(ctx,"wave-"+id)}catch(e){}
  };
  if(!d||d.open){await fill();return}
  let filled=false;
  d.addEventListener("toggle",()=>{if(d.open&&!filled){filled=true;fill()}});
}
/* Called after the Shadow view renders: every line you have already worked on
   gets its report back, closed, with its score in the summary. */
window.shLinesRestore=()=>{
  const st=S.shLine||{},hist=S.fbV||{};
  shWorkplaceLines().forEach(l=>{
    if(!document.getElementById("shfb-"+l.id))return;
    const ctx=shLineCtx(l.id),d=st[ctx],scores=hist[ctx]||[];
    if(!d&&!scores.length)return;
    shLineRender(l.id,l,d||{overall:scores[scores.length-1],words:[],said:""},false);
  });
};
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
         in the element it is handed, message included. The trend stays too: an
         ungraded take does not erase the attempts before it. */
      shLineFeedback(id,`<span class="sh-line-wait">${esc(t(why))}</span>
        ${shLinePerfHTML(ctx)}
        <div class="sh-line-takes"><b>${esc(t("sh.line_takes_h"))}</b><div id="recl-${esc(id)}"></div>
          <div id="wave-${esc(id)}" style="margin-top:12px"></div></div>`);
      try{manIconizeInline(document.getElementById("shfb-"+id))}catch(e){}
      try{await renderRecs(ctx,"recl-"+id)}catch(e){}
      try{await waveRender(ctx,"wave-"+id)}catch(e){}
      return;
    }
    res.words.forEach(w=>{const k=String(w.word||"").toLowerCase().replace(/[^a-z']/g,"");
      if(k.length>3&&w.score<80&&!isTrackStopWord(k)){S.trouble=S.trouble||{};S.trouble[k]=Math.max(S.trouble[k]||0,100-w.score)}});
    /* Score history per line, so the trend chart is the same component the video
       side uses. */
    S.fbV=S.fbV||{};(S.fbV[ctx]=S.fbV[ctx]||[]).push(res.overall);
    if(S.fbV[ctx].length>20)S.fbV[ctx]=S.fbV[ctx].slice(-20);
    markPracticed();
    awardCompetency({activityType:"shadow_session",lesson:"Workplace line · "+line.scenario,duration:1,dedupeKey:"line:"+id+":"+S.fbV[ctx].length});
    /* Did the answer carry the words it is supposed to carry? Kept with the
       grading so the same judgement is on screen when you come back to it. */
    const spoken=res.words.map(w=>String(w.word||"").toLowerCase()).join(" ");
    shLineRemember(ctx,res,spoken);
    save();
    /* One builder draws the whole report: score, performance over time, the
       word-by-word analysis with playback and save, vocabulary, takes, waveform. */
    const slot="shfb-"+id;
    await shLineRender(id,line,shLineStore()[ctx],true);
    /* Then the Speaking feedback engine's own headline analysis — pace, fillers,
       the fixes ranked worst-first — into the slot the report left for it, so a
       workplace line and a video clip are analysed by exactly the same code.
       Passed "line" rather than "new": it must not push a second, differently
       measured score onto the attempt series this take has already extended. */
    fbCtx={vid:ctx,recCtx:ctx};
    fbT0=rec.t0||Date.now()-8000;
    const heardTxt=(rec.heard&&rec.heard.txt||"").trim();
    if(heardTxt){
      S.notes["shheard:"+ctx]=heardTxt;S.notes["shheardDur:"+ctx]=Date.now()-(rec.t0||Date.now());
      try{fbShowResults(line.text,heardTxt,"line","shfbx-"+id)}catch(e){}
    }
    const rep=document.getElementById(slot);
    if(rep)rep.scrollIntoView({behavior:"smooth",block:"nearest"});
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
