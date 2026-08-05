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
      competencyConfig:sections.progress.competencyConfig||{},
      reviewAxes:sections.progress.reviewAxes||[],
      monthMetrics:sections.progress.monthMetrics||{},
      reviewCheckpoints:sections.progress.reviewCheckpoints||[]
    });
  }
  async function load(id){
    if(packs.has(id))return packs.get(id);
    if(loading.has(id))return loading.get(id);
    const request=Promise.all(SECTIONS.map(async name=>{
      const response=await fetch("tracks/"+encodeURIComponent(id)+"/"+name+".json");
      if(!response.ok)throw new Error("Could not load curriculum section: "+id+"/"+name);
      return [name,validateSection(name,await response.json())];
    })).then(entries=>{
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

  global.CurriculumProvider=Object.freeze({load,forTrack,isReady,sections:()=>SECTIONS.slice()});
})(window);
