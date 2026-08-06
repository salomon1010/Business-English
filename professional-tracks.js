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
      const seen=new Set();
      while(track&&!seen.has(track.id)){
        if(global.CurriculumProvider){
          const curriculum=global.CurriculumProvider.forTrack(track);
          if(curriculum)return curriculum;
        }
        if(track.curriculum)return track.curriculum;
        seen.add(track.id);
        track=track.inheritsFrom?tracks.get(track.inheritsFrom):null;
      }
      return null;
    },
    isFoundation(id){
      const track=tracks.get(id||activeId);
      return !!track&&track.status==="foundation";
    }
  };

  global.ProfessionalTrack=ProfessionalTrack;
  global.ProfessionalTrackContext=ProfessionalTrackContext;
})(window);
