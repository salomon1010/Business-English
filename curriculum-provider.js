/* ============================================================================
   BE Mastery — Dynamic curriculum provider
   --------------------------------------------------------------------------
   Curriculum packs are static JSON so the offline-first PWA can load a single
   active-track view without changing any page layout. A pack is considered
   ready only when it has a non-empty weeks collection; until then a track uses
   the General English pack as its safe fallback.
   ============================================================================ */
(function(global){
  const SECTIONS=["weeks","shadow","phrases","vocabulary","practice","progress"];
  /* Sections a track MAY carry. A missing file is not an error — General
     English has no Foundations stage and must keep loading without one.

     missions — the V2 competency missions. General English has them; Welding
     deliberately has no missions.json, and professional-tracks.js lists the
     section in NEVER_INHERIT so the absent file resolves to null rather than
     quietly inheriting General English's. */
  const OPTIONAL=["foundations","missions"];
  const packs=new Map();
  const loading=new Map();

  function sourceId(track){
    if(typeof track==="string")return track==="general-english"?"general":track;
    return (track&&track.sourceId)||"general";
  }
  function validateSection(name,data){
    if(!data||data.schemaVersion!=="1")throw new Error("Invalid curriculum schema: "+name);
    return data;
  }
  function hydrate(id,sections){
    return Object.freeze({
      id:id+"-v1",
      days:sections.weeks.days||[],
      dayMeta:sections.weeks.dayMeta||{},
      sessionLinks:sections.weeks.sessionLinks||{},
      templates:sections.weeks.templates||{},
      weeks:sections.weeks.weeks||[],
      phases:sections.weeks.phases||{},
      resources:sections.shadow.resources||[],
      starters:sections.shadow.starters||[],
      phrases:sections.phrases.phrases||[],
      vocabulary:sections.vocabulary,
      practice:sections.practice,
      aiMentors:sections.practice.aiMentors||[],
      roleplayCategories:sections.practice.roleplayCategories||[],
      simulations:sections.practice.simulations||[],
      simulationCharacters:sections.practice.simulationCharacters||[],
      competencyConfig:sections.progress.competencyConfig||{},
      reviewAxes:sections.progress.reviewAxes||[],
      monthMetrics:sections.progress.monthMetrics||{},
      reviewCheckpoints:sections.progress.reviewCheckpoints||[],
      /* Stage 0: A1-A2 listen-and-repeat with a French gloss, and the
         three-sentence placement check. null when the track has none. */
      foundations:sections.foundations||null,
      /* V2 competency missions. null for any track that ships no missions.json. */
      missions:sections.missions||null
    });
  }
  /* One file, up to three tries. A phone on a flaky connection — or one that
     opened the app in the seconds a deploy was still settling — used to lose
     the whole app to a single failed fetch out of sixteen: boot gave up, Home
     showed one line, and every tab after that drew against a null curriculum
     ("This page could not be drawn", 2026-09-19). Retrying the file is the
     cheap half of the fix; the boot's own retry button is the other half. */
  const TRIES=3,BACKOFF_MS=[0,600,1500];
  async function fetchSection(id,name){
    let last=null;
    for(let i=0;i<TRIES;i++){
      if(BACKOFF_MS[i])await new Promise(r=>setTimeout(r,BACKOFF_MS[i]));
      try{
        const response=await fetch("tracks/"+encodeURIComponent(id)+"/"+name+".json",i?{cache:"reload"}:undefined);
        if(response.ok)return response;
        last=new Error("Could not load curriculum section: "+id+"/"+name+" ("+response.status+")");
        if(response.status===404&&i)break;             // a real 404 will not change on the third try
      }catch(e){last=e}
    }
    throw last||new Error("Could not load curriculum section: "+id+"/"+name);
  }
  async function load(id){
    if(packs.has(id))return packs.get(id);
    if(loading.has(id))return loading.get(id);
    const request=Promise.all(SECTIONS.map(async name=>{
      const response=await fetchSection(id,name);
      return [name,validateSection(name,await response.json())];
    }).concat(OPTIONAL.map(async name=>{
      try{
        const response=await fetch("tracks/"+encodeURIComponent(id)+"/"+name+".json");
        if(!response.ok)return [name,null];
        return [name,validateSection(name,await response.json())];
      }catch(e){return [name,null]}
    }))).then(entries=>{
      const sections=Object.fromEntries(entries);
      const pack=hydrate(id,sections);
      packs.set(id,pack);
      return pack;
    }).finally(()=>loading.delete(id));
    loading.set(id,request);
    return request;
  }
  function isReady(pack){return !!(pack&&Array.isArray(pack.weeks)&&pack.weeks.length);}
  function forTrack(track){
    const requested=packs.get(sourceId(track));
    return isReady(requested)?requested:(packs.get("general")||null);
  }

  function has(id){return packs.has(id)}
  global.CurriculumProvider=Object.freeze({load,forTrack,isReady,has,sections:()=>SECTIONS.slice(),optional:()=>OPTIONAL.slice()});
})(window);
