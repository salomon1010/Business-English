/* ============================================================================
   BE Mastery — Professional Track foundation
   --------------------------------------------------------------------------
   A track describes curriculum ownership and availability. It intentionally
   contains no Welding curriculum in Sprint 1: the Welding foundation resolves
   to General English until a dedicated, versioned curriculum pack is supplied.
   ============================================================================ */
(function(global){
  class ProfessionalTrack {
    constructor(config){
      if(!config||!config.id)throw new Error("ProfessionalTrack requires an id");
      if(!config.nameKey)throw new Error("ProfessionalTrack requires a nameKey");
      this.id=config.id;
      this.nameKey=config.nameKey;
      this.descriptionKey=config.descriptionKey||"";
      this.status=config.status||"available";
      this.sourceId=config.sourceId||config.id;
      this.curriculum=config.curriculum||null;
      this.inheritsFrom=config.inheritsFrom||null;
      /* A semantic theme id lets each profession have a clear visual identity
         without duplicating screens or the learning engine. */
      this.themeId=config.themeId||"general";
      this.themeLabel=config.themeLabel||config.id;
      this.homeWelcome=config.homeWelcome||"";
      this.homeWelcomeNamed=config.homeWelcomeNamed||"";
      this.version=config.version||"1";
      Object.freeze(this);
    }
  }

  const tracks=new Map();
  let activeId="general-english";

  /* A track that declares inheritsFrom used to take the FIRST curriculum it
     found and stop there, so every field its own pack left empty stayed empty.
     That is not how the welding pack is written: it carries the trade — its
     weeks, phrases and words — and deliberately leaves the English-language
     machinery to its parent. With no merge, the learner lost the stop-word
     list, the CEFR levels, the synonyms, the grammar rules and the grammar
     drills. Practice offered "eight questions at a time" with no questions
     behind it, and the word extractor, having no stop words, saved "was" and
     "responsibilities" as professional vocabulary.

     Only an empty field inherits. Anything the child pack actually defines
     wins, so no general-English content can displace trade content. The merge
     goes one level into a section object (vocabulary, practice) and no deeper:
     that is where the gaps are, and a deep merge would start blending week and
     day tables that are meant to belong to one track or the other. */
  const empty=v=>v==null||v===""||(Array.isArray(v)?!v.length:typeof v==="object"?!Object.keys(v).length:false);
  const plain=v=>!!v&&typeof v==="object"&&!Array.isArray(v);
  const fill=(child,parent,depth)=>{
    const out={};
    new Set(Object.keys(parent).concat(Object.keys(child))).forEach(k=>{
      const c=child[k],p=parent[k];
      out[k]=empty(c)?p:(depth&&plain(c)&&plain(p)?fill(c,p,depth-1):c);
    });
    return Object.freeze(out);
  };
  /* resolveCurriculum runs on every curriculum read, so the merged pack is
     cached against the exact pair it was built from. Both packs are immutable
     once hydrated; a reload replaces the objects, which misses the cache and
     rebuilds, as it should. */
  const merged=new WeakMap();
  function inherit(child,parent){
    if(!parent||child===parent)return child;
    let byParent=merged.get(child);
    if(!byParent)merged.set(child,byParent=new WeakMap());
    let out=byParent.get(parent);
    if(!out)byParent.set(parent,out=fill(child,parent,1));
    return out;
  }

  const ProfessionalTrackContext={
    register(track){
      if(!(track instanceof ProfessionalTrack))throw new Error("Expected ProfessionalTrack");
      tracks.set(track.id,track);
      return track;
    },
    all(){return Array.from(tracks.values());},
    get(id){return tracks.get(id)||null;},
    setActive(id){
      if(!tracks.has(id))return false;
      activeId=id;
      return true;
    },
    active(){return tracks.get(activeId)||tracks.get("general-english")||null;},
    resolveCurriculum(id){
      let track=tracks.get(id||activeId);
      const seen=new Set(),chain=[];
      while(track&&!seen.has(track.id)){
        const own=(global.CurriculumProvider&&global.CurriculumProvider.forTrack(track))||track.curriculum||null;
        if(own&&chain[chain.length-1]!==own)chain.push(own);
        seen.add(track.id);
        track=track.inheritsFrom?tracks.get(track.inheritsFrom):null;
      }
      if(!chain.length)return null;
      return chain.reduce(inherit);
    },
    isFoundation(id){
      const track=tracks.get(id||activeId);
      return !!track&&track.status==="foundation";
    }
  };

  global.ProfessionalTrack=ProfessionalTrack;
  global.ProfessionalTrackContext=ProfessionalTrackContext;
})(window);
