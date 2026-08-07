/* ============================================================================
   BE Mastery — Trade profiles inside the Welding track
   --------------------------------------------------------------------------
   A welder, a pipefitter and a boilermaker share a workshop, a supervisor and a
   permit system. They do not share codes, vocabulary, or what a good answer
   sounds like. A pipefitter asked about a weld defect is being assessed on
   somebody else's trade, and a boilermaker who never mentions blinding a line
   before entering a steam drum has missed the thing that would kill him.

   So the trade is an OVERLAY, not a fork:

     • the twelve workshops, the characters, the mission structure and the
       evaluation engine stay shared — one thing to maintain, one thing to fix;
     • the trade supplies its own governing codes, its own vocabulary, its own
       extra benchmarks, and its own model answers where the trade genuinely
       changes the answer.

   That is the same shape as jurisdictions.js: universal behaviour, swapped
   specifics. It is also what makes a fourth trade a data exercise rather than a
   second application.

   Pay ranges are indicative figures supplied for guidance and are not offers,
   quotes or a survey. They vary by region, employer, certification and overtime,
   and the app says so wherever it shows them.

   NOTE: the technical content here is written from published codes and industry
   practice. It has not been reviewed by a qualified welding professional, and it
   must be before it informs anyone's hiring decision.
   ============================================================================ */
(function(global){

  const TRADES = [
    {
      id: "welder",
      name: "Professional Welder",
      tagline: "The fusion specialist",
      focus: "Metallurgical bonding, arc physics and code-compliant deposit integrity.",
      pay: "$35–$55+ per hour",
      payNote: "Depends heavily on process certifications, field tracking and travel premiums.",
      codes: ["AWS D1.1 — Structural Steel", "ASME BPVC Section IX — Pressure Vessels", "ISO 9606-1 — Welder Qualification"],
      does: [
        "Deposit sound, defect-free welds using SMAW, GTAW, GMAW and FCAW on structural materials.",
        "Manage heat input strictly to the qualified Welding Procedure Specification.",
        "Control the puddle in every position, including the 6G fixed pipe test.",
        "Dress beads and clear slag so a joint is ready for visual or volumetric inspection."
      ],
      /* What the evaluation listens for that the base welding pack does not. */
      vocab: ["undercut","porosity","lack of fusion","slag inclusion","toe of the weld","root pass",
              "cap pass","travel speed","heat input","interpass temperature","WPS","6G","amperage","rod angle"],
      /* Per-module code overrides — keyed the same way jurisdictions are. */
      moduleCodes: {
        6:  ["ASME BPVC Section IX — Welding procedure and performance qualification", "ISO 15614-1"],
        9:  ["AWS D1.1 — Inspection and acceptance criteria", "ISO 5817 — Quality levels for imperfections"],
        11: ["ISO 9606-1", "ASME BPVC Section IX", "AWS D1.1 — Welder Qualification"]
      },
      /* Extra benchmarks the trade adds to a module, on top of the shared ones. */
      moduleBenchmarks: {
        9: [{id:"trade_defect",must:"Name the defect in standard terms and give its cause and the code-compliant repair",
             cues:["undercut","porosity","lack of fusion","slag","crater","travel speed","rod angle","grind","re-deposit","wps","cap"],critical:true}]
      },
      /* Model answers the trade genuinely changes. */
      answers: {
        9: "I noted an undercut flaw along the toe of the weld bead, caused by excessive travel speed and an incorrect rod angle. I'll grind the target zone clean and re-deposit a cap according to the WPS variables."
      },
      goals: [
        {id:"weld-cert",  label:"Pass a coded welding test",      why:"Explain your processes, positions and qualification range clearly."},
        {id:"weld-defect",label:"Report defects properly",        why:"Name a discontinuity, its cause and the repair in standard terms."},
        {id:"weld-wps",   label:"Work confidently to a WPS",      why:"Read back parameters and ask when a variable is unclear."},
        {id:"weld-job",   label:"Get hired abroad",               why:"Tell your experience so a foreign employer can act on it."}
      ],
      winLine: "I noted undercut along the toe of the weld — I'll grind it out and re-run the cap to the procedure.",
      welcome: "Your workshops, vocabulary and assessments are now set for welding — deposits, procedures and inspection."
    },
    {
      id: "pipefitter",
      name: "Professional Pipefitter",
      tagline: "The geometry and layout specialist",
      focus: "Precision blueprint mathematics, isometric interpretation and pipe line assembly.",
      pay: "$32–$48 per hour",
      payNote: "Varies by industrial scale, commercial mechanical work or pipeline setups.",
      codes: ["ASME B31.1 — Power Piping", "ASME B31.3 — Process Piping"],
      does: [
        "Read isometric piping drawings, take off bills of material and calculate offsets.",
        "Work rolling offsets, take-outs and travel angles for fitting layout.",
        "Cut, bevel and align carbon steel, stainless and alloy pipe with torches, bevellers and clamps.",
        "Rig and position heavy spools, verifying pitch, alignment and root opening for the welder."
      ],
      vocab: ["isometric","rolling offset","take-out","centre-to-centre","spool","bevel","root opening",
              "pitch","alignment","travel angle","bill of material","fit-up","45-degree fitting","hi-lo"],
      moduleCodes: {
        4:  ["ASME B31.3 — Materials and fabrication", "EN 10204 — Inspection documents"],
        6:  ["ASME B31.1 / B31.3 — Fabrication and assembly requirements"],
        7:  ["ASME B31.3 — Drawings and dimensional requirements", "ISO 6708 — Nominal size"],
        9:  ["ASME B31.3 — Examination and acceptance"]
      },
      moduleBenchmarks: {
        7: [{id:"trade_iso",must:"Name the missing dimension on the isometric and who resolves it before cutting",
             cues:["isometric","centre-to-centre","center-to-center","take-out","rolling offset","offset","dimension","layout engineer","before cutting","spool"],critical:true}],
        4: [{id:"trade_fitup",must:"State the alignment tolerance you are working to — pitch, root opening, hi-lo",
             cues:["pitch","root opening","hi-lo","alignment","tolerance","centre","level","plumb"],critical:false}]
      },
      answers: {
        7: "The isometric doesn't clarify the centre-to-centre dimension for the rolling offset. I'll hold assembly and contact the layout engineer to confirm the exact take-out for this 45-degree fitting before cutting the spool piece.",
        4: "I check the spool against the isometric first — material, size and schedule — then set the root opening and check pitch and alignment before anything is tacked."
      },
      goals: [
        {id:"pipe-iso",  label:"Read isometrics with confidence", why:"Ask precise questions about dimensions and take-outs."},
        {id:"pipe-math", label:"Explain layout calculations",     why:"Talk through offsets and travel angles out loud."},
        {id:"pipe-rig",  label:"Coordinate rigging safely",       why:"Direct a lift and confirm what everyone is doing."},
        {id:"pipe-job",  label:"Get hired abroad",                why:"Tell your experience so a foreign employer can act on it."}
      ],
      winLine: "The isometric doesn't give me the centre-to-centre, so I'll hold the spool until the layout engineer confirms the take-out.",
      welcome: "Your workshops, vocabulary and assessments are now set for pipefitting — isometrics, layout and fit-up."
    },
    {
      id: "boilermaker",
      name: "Professional Boilermaker",
      tagline: "The heavy vessel and rigging specialist",
      focus: "High-pressure vessel fabrication, heavy rigging, tank repair and tube replacement.",
      pay: "$36–$52 per hour",
      payNote: "Often driven by maintenance turnarounds and refinery or nuclear outages.",
      codes: ["ASME BPVC Section I — Power Boilers", "ASME BPVC Section VIII — Pressure Vessels", "National Board Inspection Code (NBIC)"],
      does: [
        "Assemble, install and maintain high-pressure boilers, tanks, vats and reactor vessels.",
        "Rig heavy plate and vessel components with cranes, chain falls and shackles.",
        "Roll, expand and seal tubes into tube sheets to pressure tolerance.",
        "Work inside high-risk confined spaces under strict permit control."
      ],
      vocab: ["steam drum","tube sheet","rolling","expanding","blinded","blind flange","LOTO",
              "confined space permit","multi-gas","hydrotest","shackle","chain fall","turnaround","NBIC"],
      moduleCodes: {
        4:  ["ASME BPVC Section II — Materials", "NBIC — Repairs and alterations"],
        6:  ["ASME BPVC Section I — Power Boilers", "ASME BPVC Section VIII"],
        9:  ["NBIC — Inspection", "ASME BPVC Section VIII — Acceptance"],
        10: ["OSHA 29 CFR 1910.146 — Permit-required confined spaces", "OSHA 29 CFR 1910.147 — Lockout/Tagout", "NBIC — Pressure testing"]
      },
      moduleBenchmarks: {
        10: [{id:"trade_blind",must:"State that the lines are blinded and isolated before entry, not just permitted",
              /* "valve" and "isolat" are already covered by the shared Lockout/Tagout
                benchmark, and leaving them here let "locked out the valves" satisfy a
                check that is specifically about physically blinding the line. A
                boilermaker who does not say it has not said the thing that matters. */
             cues:["blind","blinded","blanked","blank flange","line break","double block","spade","spectacle"],critical:true}],
        8: [{id:"trade_rig",must:"State the rigging plan — load, gear and who is directing the lift",
             cues:["rig","crane","shackle","chain fall","sling","load","weight","signal","banksman","tag line"],critical:false}]
      },
      answers: {
        10: "Before entering the boiler steam drum I verify the lines are blinded off, Lockout/Tagout is executed on all valves, a valid confined space permit is posted, and continuous multi-gas atmospheric testing reads normal.",
        8:  "I confirm the lift weight and the gear rating first, then who is directing — one signaller, tag lines on, and nobody under the load."
      },
      goals: [
        {id:"boil-permit", label:"Master permit and entry talk", why:"Say every control out loud before you cross the threshold."},
        {id:"boil-rig",    label:"Direct a lift clearly",        why:"Give and confirm rigging instructions without ambiguity."},
        {id:"boil-tube",   label:"Explain vessel and tube work", why:"Describe repairs in the terms an inspector expects."},
        {id:"boil-job",    label:"Get hired abroad",             why:"Tell your experience so a foreign employer can act on it."}
      ],
      winLine: "Before I enter the steam drum I need the lines blinded, LOTO on the valves, a posted permit and a live gas test.",
      welcome: "Your workshops, vocabulary and assessments are now set for boilermaking — vessels, rigging and permit-controlled entry."
    }
  ];

  const BY_ID = new Map(TRADES.map(t => [t.id, t]));
  const DEFAULT_ID = "welder";

  function active(state){
    const id = state && state.professionalTracks && state.professionalTracks.tradeId;
    return BY_ID.get(id) || BY_ID.get(DEFAULT_ID);
  }
  function setActive(state, id){
    if (!BY_ID.has(id)) return false;
    state.professionalTracks = state.professionalTracks || {};
    state.professionalTracks.tradeId = id;
    return true;
  }

  /** Codes for a module: trade first, then whatever the caller falls back to. */
  function codesFor(trade, moduleId){
    const own = trade && trade.moduleCodes && trade.moduleCodes[moduleId];
    return own && own.length ? own.slice() : null;
  }
  /** Extra benchmarks this trade adds to a module. */
  function benchmarksFor(trade, moduleId){
    return (trade && trade.moduleBenchmarks && trade.moduleBenchmarks[moduleId]) || [];
  }
  /** The model answer, when the trade changes what a good answer is. */
  function answerFor(trade, moduleId){
    return (trade && trade.answers && trade.answers[moduleId]) || "";
  }
  function vocabFor(trade){ return (trade && trade.vocab) ? trade.vocab.slice() : []; }

  global.Trades = Object.freeze({
    all: () => TRADES.slice(),
    get: id => BY_ID.get(id) || null,
    active, setActive, codesFor, benchmarksFor, answerFor, vocabFor,
    DEFAULT_ID
  });
})(window);
