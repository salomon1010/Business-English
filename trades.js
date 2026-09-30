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
      name: "Professional Welder", career: "welding", group: "mech",
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
      /* The workshops where this trade's own expertise is exercised. A welder is
         not assessed on isometric take-outs or steam-drum entry; those belong to
         the other two. Fewer, sharper reps beat a menu of twelve. */
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        11: {title:"Welding Interview", scenario:"Answer a hiring panel on processes, positions and qualification."}
      },
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
      name: "Professional Pipefitter", career: "pipefitting", group: "mech",
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
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        3: { title: "Torch and Gear Check", scenario: "Check your cutting gear and report a fault before work starts." },
        6: { title: "Specification Briefing", scenario: "Explain a piping specification and its tolerances." },
        10: { title: "Line Break Readiness", scenario: "Prove the line is dead before you open it." },
        1:  {title:"First Day on a Pipe Crew", scenario:"Meet the crew and complete onboarding safely."},
        4:  {title:"Spool Preparation and Fit-Up", scenario:"Check material against the isometric and set the fit-up."},
        7:  {title:"Isometric Clarification", scenario:"Resolve a missing dimension before anything is cut."},
        8:  {title:"Site Coordination and Access", scenario:"Sequence your work around the other trades on site."},
        9:  {title:"Fit-Up Quality Issue", scenario:"Report alignment or tolerance that is outside the drawing."},
        11: {title:"Pipefitting Interview", scenario:"Answer a hiring panel on layout, drawings and fabrication."},
        /* 2, 5 and 12 were left to the pack, so a pipefitter still read
           "Shift Handover" for a welding shift and a welder's final briefing.
           Named for the trade now, like the other nine (30 Sep 2026). */
        2:  {title:"Shift Handover", scenario:"Hand over spools, fit-ups and outstanding drawings."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Identify a hazard on the line and use calm stop-work communication."},
        12: {title:"Career Ready Final Briefing", scenario:"Present your layout standards, contribution, and career readiness."}
      },
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
      name: "Professional Boilermaker", career: "boilermaking", group: "mech",
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
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        4: { title: "Plate and Tube Preparation", scenario: "Check material against the drawing and prepare it." },
        6: { title: "Repair Procedure Briefing", scenario: "Explain a code repair procedure and its hold points." },
        7: { title: "Drawing and Layout Clarification", scenario: "Resolve a tube layout question before anything is pulled." },
        1:  {title:"First Day on a Vessel Job", scenario:"Meet the crew and complete onboarding on an outage."},
        3:  {title:"Rigging and Gear Check", scenario:"Confirm lifting gear and the plan before anything moves."},
        8:  {title:"Lift and Trade Coordination", scenario:"Direct a lift safely around other trades."},
        9:  {title:"Vessel Quality Issue", scenario:"Report a tube or seam defect against the inspection code."},
        10: {title:"Steam Drum Entry Readiness", scenario:"Prove the space is safe to enter before you cross it."},
        11: {title:"Boilermaker Interview", scenario:"Answer a hiring panel on vessels, rigging and permits."},
        2:  {title:"Shift Handover", scenario:"Hand over vessel work, open permits and outstanding inspection."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Identify a hazard on the vessel and use calm stop-work communication."},
        12: {title:"Career Ready Final Briefing", scenario:"Present your code standards, contribution, and career readiness."}
      },
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
      goals: [
        {id:"boil-permit", label:"Master permit and entry talk", why:"Say every control out loud before you cross the threshold."},
        {id:"boil-rig",    label:"Direct a lift clearly",        why:"Give and confirm rigging instructions without ambiguity."},
        {id:"boil-tube",   label:"Explain vessel and tube work", why:"Describe repairs in the terms an inspector expects."},
        {id:"boil-job",    label:"Get hired abroad",             why:"Tell your experience so a foreign employer can act on it."}
      ],
      winLine: "Before I enter the steam drum I need the lines blinded, LOTO on the valves, a posted permit and a live gas test.",
      welcome: "Your workshops, vocabulary and assessments are now set for boilermaking — vessels, rigging and permit-controlled entry."
    },
    {
      id: "operator",
      name: "Refinery Operator", career: "refinery operations", group: "ops",
      tagline: "The plant's steady hand",
      focus: "Running a process unit inside its limits, and handing it over so the next shift knows what you know.",
      does: [
        "Watch and adjust the unit from the board and in the field, inside its normal operating limits.",
        "Start up, shut down and switch equipment to the written operating procedure.",
        "Prepare equipment for maintenance: drain, depressure, purge, isolate and hand over under permit.",
        "Report a deviation or a release early, in the words the process safety system expects."
      ],
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        1:  {title:"First Day on the Unit", scenario:"Meet the shift and complete onboarding on a live process unit."},
        2:  {title:"Shift Handover", scenario:"Hand the unit over: state, deviations and what to watch."},
        3:  {title:"Field Round and Equipment Check", scenario:"Report what your round found before the shift settles."},
        4:  {title:"Line-Up Check", scenario:"Confirm the line-up against the procedure before a transfer."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Identify a process hazard and use calm stop-work communication."},
        6:  {title:"Operating Procedure Briefing", scenario:"Explain a start-up step and the limits it must stay inside."},
        7:  {title:"P&ID Clarification", scenario:"Resolve a valve or line question before anything is opened."},
        8:  {title:"Permit and Trade Coordination", scenario:"Prepare equipment for a maintenance crew and agree the boundary."},
        9:  {title:"Deviation Report", scenario:"Report an off-spec condition or a small release and agree the action."},
        10: {title:"Isolation and Handover for Maintenance", scenario:"Prove the equipment is safe before it is handed over."},
        11: {title:"Refinery Operator Interview", scenario:"Answer a hiring panel on units, procedures and process safety."},
        12: {title:"Career Ready Final Briefing", scenario:"Present your operating discipline and readiness to run a unit."}
      },
      vocab: ["board operator","normal operating limit","feed rate","reflux","overhead","charge pump",
              "depressure","flare","interlock","bypass","permit to work","gas test","handover log",
              "line-up","deviation","loss of containment"],
      moduleBenchmarks: {
        2: [{id:"trade_handover",must:"Hand over the unit's state, any deviation, and what the next shift must watch",
             cues:["handover","shift","state","stable","deviation","watch","outstanding","permit","log","running","rate","level"],critical:true}],
        10:[{id:"trade_isolation",must:"State that the equipment was drained, depressured, purged and isolated before hand-over",
             cues:["drain","depressure","depressurise","purge","isolat","blind","block","vent","zero","gas test","permit"],critical:true}]
      },
      goals: [
        {id:"op-handover", label:"Give a handover they can act on", why:"Say the state, the deviation and the watch item in one clear pass."},
        {id:"op-procedure",label:"Talk through a procedure",         why:"Explain a step and the limit it must stay inside."},
        {id:"op-report",   label:"Report a deviation early",         why:"Use the words the process safety system expects."},
        {id:"op-job",      label:"Get hired abroad",                 why:"Tell your operating experience so a foreign employer can act on it."}
      ],
      winLine: "The tower is stable at rate, but the overhead temperature has been creeping for two hours — I have logged it, told the board, and the next shift needs to watch it.",
      welcome: "Your workshops, vocabulary and assessments are now set for refinery operations — procedures, limits and handover."
    },
    {
      id: "instrumentation",
      name: "Instrumentation Technician", career: "instrumentation and control", group: "ops",
      tagline: "The loop and control specialist",
      focus: "Calibrating, fault-finding and proving the instruments and protective loops a plant relies on.",
      does: [
        "Calibrate transmitters and final elements, and keep the calibration traceable and in date.",
        "Fault-find a control loop from the P&ID and the tag number, not from memory.",
        "Work on equipment in classified areas with the right protection concept and method.",
        "Proof-test safety instrumented functions and control every bypass in writing."
      ],
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        1:  {title:"First Day in the Instrument Shop", scenario:"Meet the team and complete onboarding on a live plant."},
        2:  {title:"Shift Handover", scenario:"Hand over open loops, bypasses and outstanding work."},
        3:  {title:"Calibration and Test Gear Check", scenario:"Confirm your test gear is calibrated before you use it."},
        4:  {title:"Instrument and Spares Check", scenario:"Confirm the instrument matches the tag and the specification."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Identify a hazard on a live loop and stop the work calmly."},
        6:  {title:"Protective Function Briefing", scenario:"Explain a safety loop, its bypass and its proof test."},
        7:  {title:"P&ID and Loop Clarification", scenario:"Resolve a tag or loop question before anything is disturbed."},
        8:  {title:"Permit and Trade Coordination", scenario:"Agree access and isolation with operations and the other trades."},
        9:  {title:"Loop Fault Report", scenario:"Report a loop fault and the corrective action against the record."},
        10: {title:"Work on a Live Protective Loop", scenario:"Prove the authority, the bypass and the controls before you start."},
        11: {title:"Instrumentation Interview", scenario:"Answer a hiring panel on loops, calibration and functional safety."},
        12: {title:"Career Ready Final Briefing", scenario:"Present your calibration and functional-safety discipline."}
      },
      vocab: ["transmitter","loop","tag number","P&ID","calibration","span","zero","four to twenty milliamp",
              "control valve","positioner","interlock","bypass","proof test","intrinsically safe",
              "hazardous area","final element"],
      moduleBenchmarks: {
        6: [{id:"trade_bypass",must:"State that a bypass of a protective function is authorised, time-limited and recorded",
             cues:["bypass","override","inhibit","authoris","authoriz","permit","time","record","log","restore","proof test"],critical:true}],
        3: [{id:"trade_cal",must:"Say the test gear is calibrated, in date and traceable before you trust a reading",
             cues:["calibrat","in date","traceab","certificate","reference","standard","due","label"],critical:false}]
      },
      goals: [
        {id:"ins-loop",  label:"Explain a loop clearly",       why:"Name it by its tag and say what it does."},
        {id:"ins-safety",label:"Talk about protective loops",  why:"Say who authorises a bypass and what restores it."},
        {id:"ins-cal",   label:"Report calibration properly",  why:"Say as-found, as-left and where the record is."},
        {id:"ins-job",   label:"Get hired abroad",             why:"Tell your instrument experience so a foreign employer can act on it."}
      ],
      winLine: "That is a safety loop, so the bypass needs the operations authority in writing, a time limit on it, and a proof test before I hand it back.",
      welcome: "Your workshops, vocabulary and assessments are now set for instrumentation — loops, calibration and protective functions."
    },
    {
      id: "electrician",
      name: "Industrial Electrician", career: "industrial electrical work", group: "elec",
      tagline: "The safe-isolation specialist",
      focus: "Installing, testing and maintaining industrial electrical systems, and proving them dead before touching them.",
      does: [
        "Establish an electrically safe work condition: isolate, lock, test dead with a proved instrument, and prove the tester again.",
        "Install and terminate cables, switchgear and motor circuits to the installation requirements.",
        "Test and verify an installation — insulation resistance, continuity, earthing — and record the results.",
        "Read the arc-flash label and the single-line diagram before deciding how the work is done."
      ],
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        1:  {title:"First Day on an Electrical Crew", scenario:"Meet the crew and complete onboarding on an industrial site."},
        2:  {title:"Shift Handover", scenario:"Hand over isolations, open permits and outstanding tests."},
        3:  {title:"Test Instrument and PPE Check", scenario:"Prove your meter and check your PPE before any work."},
        4:  {title:"Material and Cable Check", scenario:"Confirm cable, gland and protection match the drawing."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Identify an electrical hazard and stop the work calmly."},
        6:  {title:"Installation Method Briefing", scenario:"Explain how the circuit will be installed and to what requirement."},
        7:  {title:"Single-Line Diagram Clarification", scenario:"Resolve a circuit question before anything is energised."},
        8:  {title:"Permit and Trade Coordination", scenario:"Agree isolation boundaries with operations and the other trades."},
        9:  {title:"Test Result Report", scenario:"Report a failed verification test and the corrective action."},
        10: {title:"Safe Isolation Before Work", scenario:"Prove the circuit is dead before anyone touches it."},
        11: {title:"Industrial Electrician Interview", scenario:"Answer a hiring panel on isolation, testing and installations."},
        12: {title:"Career Ready Final Briefing", scenario:"Present your safe-isolation discipline and test evidence."}
      },
      vocab: ["isolation","lockout","test dead","proving unit","arc flash","incident energy","switchgear",
              "breaker","insulation resistance","continuity","earth bond","cable gland","termination",
              "single line diagram","permit","de-energised"],
      moduleBenchmarks: {
        10:[{id:"trade_safe_isolation",must:"State the full safe-isolation sequence — isolate, lock, test dead, and prove the tester",
             cues:["isolat","lock","tag","test dead","proving","prove","proved","voltage indicator","meter","de-energis","de-energiz","dead"],critical:true}],
        9: [{id:"trade_test_result",must:"Give the test, its reading and the value it is judged against",
             cues:["insulation","megohm","resistance","continuity","earth","reading","value","limit","pass","fail","record"],critical:false}]
      },
      goals: [
        {id:"ele-isolate",label:"Explain safe isolation",     why:"Say the full sequence out loud, in order, every time."},
        {id:"ele-test",   label:"Report a test result",       why:"Give the reading and what it is measured against."},
        {id:"ele-install",label:"Describe an installation",   why:"Name the requirement, not the habit."},
        {id:"ele-job",    label:"Get hired abroad",           why:"Tell your electrical experience so a foreign employer can act on it."}
      ],
      winLine: "Before I open that panel it is isolated, locked and tagged, and I test it dead with a meter I have proved before and after.",
      welcome: "Your workshops, vocabulary and assessments are now set for industrial electrical work — isolation, testing and installation."
    },
    {
      id: "hse",
      name: "HSE Officer", career: "health, safety and environment", group: "elec",
      tagline: "The risk and permit specialist",
      focus: "Identifying hazards, controlling risk, running the permit system and making an investigation useful rather than punitive.",
      does: [
        "Run a risk assessment: hazard, who is harmed, existing controls, and what more is needed.",
        "Issue, monitor and close permits to work, including confined space and hot work.",
        "Deliver toolbox talks and inductions that people can actually act on.",
        "Investigate a near miss or incident to root cause and track the corrective action to closure."
      ],
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        1:  {title:"First Day as the Site HSE Officer", scenario:"Meet the site team and set out how you will work with them."},
        2:  {title:"Shift Handover", scenario:"Hand over open permits, open actions and what is still uncontrolled."},
        3:  {title:"Equipment and PPE Inspection", scenario:"Report an inspection finding and get it acted on."},
        4:  {title:"Method Statement Review", scenario:"Check a method statement against the risk assessment."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Stop unsafe work without losing the crew's cooperation."},
        6:  {title:"Toolbox Talk", scenario:"Brief a crew on a control and check they have understood it."},
        7:  {title:"Risk Assessment Clarification", scenario:"Resolve a gap in a risk assessment before work starts."},
        8:  {title:"Permit and Trade Coordination", scenario:"Coordinate simultaneous operations so one crew's work does not endanger another."},
        9:  {title:"Incident and Near-Miss Report", scenario:"Report an incident to root cause and agree corrective action."},
        10: {title:"Confined Space Entry Control", scenario:"Prove the entry controls before anyone crosses the threshold."},
        11: {title:"HSE Officer Interview", scenario:"Answer a hiring panel on risk, permits and incident management."},
        12: {title:"Career Ready Final Briefing", scenario:"Present your safety leadership and how you make controls stick."}
      },
      vocab: ["hazard","risk assessment","control measure","hierarchy of control","permit to work",
              "toolbox talk","near miss","incident report","confined space","gas test","stop work authority",
              "corrective action","root cause","fire watch","method statement"],
      moduleBenchmarks: {
        5: [{id:"trade_hrcv",must:"Work through hazard, risk, control and verification rather than jumping to the action",
             cues:["hazard","risk","likelihood","severity","control","hierarchy","eliminat","substitut","engineer","administrat","ppe","verif","check","monitor"],critical:true}],
        10:[{id:"trade_entry_control",must:"State the atmospheric test, the permit, the attendant and the rescue arrangement",
             cues:["gas test","atmosphere","oxygen","lel","permit","attendant","standby","rescue","retrieval","communication","entry log"],critical:true}]
      },
      goals: [
        {id:"hse-risk",   label:"Talk risk in the right order", why:"Hazard, risk, control, verification — every time."},
        {id:"hse-permit", label:"Run a permit conversation",    why:"Say who issues, who accepts and what closes it."},
        {id:"hse-stop",   label:"Stop work without a fight",    why:"Be firm about the control and easy about the person."},
        {id:"hse-job",    label:"Get hired abroad",             why:"Tell your HSE experience so a foreign employer can act on it."}
      ],
      winLine: "The hazard is the unguarded opening; the risk is a fall to the level below. The control is a hard barrier, not tape, and I will check it is still there after the break.",
      welcome: "Your workshops, vocabulary and assessments are now set for HSE — risk, permits and incident management."
    },
    {
      id: "ndt",
      name: "NDT Technician", career: "non-destructive testing", group: "insp",
      tagline: "The evidence specialist",
      focus: "Examining welds and components to a written procedure, and reporting an indication in terms a code can act on.",
      does: [
        "Examine welds and components by visual, penetrant, magnetic particle, ultrasonic or radiographic methods.",
        "Set up and calibrate on the reference block before the scan, and record what was used.",
        "Evaluate an indication against the acceptance criteria rather than by eye.",
        "Write a report another technician could repeat the examination from."
      ],
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        1:  {title:"First Day in the Inspection Team", scenario:"Meet the team and complete onboarding on an inspection contract."},
        2:  {title:"Shift Handover", scenario:"Hand over outstanding examinations and open indications."},
        3:  {title:"Equipment and Calibration Check", scenario:"Confirm the set and the blocks before any examination."},
        4:  {title:"Material and Surface Preparation", scenario:"Confirm the surface and the material are fit to examine."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Control the hazard of your own method — radiation, chemicals, access."},
        6:  {title:"Examination Procedure Briefing", scenario:"Explain the written procedure you are examining to."},
        7:  {title:"Drawing and Extent Clarification", scenario:"Resolve which joints and what extent before you start."},
        8:  {title:"Access and Trade Coordination", scenario:"Agree access and exclusion with the other trades."},
        9:  {title:"Indication Report", scenario:"Report an indication against the acceptance criteria and agree what follows."},
        10: {title:"Controlled Area Setup", scenario:"Prove the exclusion and the controls before the source is exposed."},
        11: {title:"NDT Technician Interview", scenario:"Answer a hiring panel on methods, levels and acceptance criteria."},
        12: {title:"Career Ready Final Briefing", scenario:"Present your certification scope and your reporting discipline."}
      },
      vocab: ["indication","discontinuity","acceptance criteria","reference block","calibration","couplant",
              "penetrant","developer","dwell time","magnetic particle","radiograph","image quality indicator",
              "ultrasonic","probe angle","written procedure","as-found"],
      moduleBenchmarks: {
        9: [{id:"trade_indication",must:"Name the indication, where it is, and the acceptance criterion it fails or passes",
             cues:["indication","discontinuity","porosity","crack","lack of fusion","undercut","slag","acceptance","criteri","reject","accept","level","location","length","depth"],critical:true}],
        3: [{id:"trade_calibration",must:"Say the set was calibrated on a reference block before the scan, and to what",
             cues:["calibrat","reference block","standard","couplant","sensitivity","verif","check","before","record"],critical:true}]
      },
      goals: [
        {id:"ndt-report", label:"Report an indication clearly", why:"Say what, where, how big, and against which criterion."},
        {id:"ndt-proc",   label:"Talk about your procedure",    why:"Name the written procedure, not just the method."},
        {id:"ndt-scope",  label:"State your certification scope",why:"Method, level, and what you are allowed to sign."},
        {id:"ndt-job",    label:"Get hired abroad",             why:"Tell your NDT experience so a foreign employer can act on it."}
      ],
      winLine: "I have a linear indication 40 mm from the start of the weld, 12 mm long. Against the acceptance criteria in the procedure that is rejectable, so it goes back for excavation and re-examination.",
      welcome: "Your workshops, vocabulary and assessments are now set for NDT — procedures, calibration and acceptance criteria."
    },
    {
      id: "process",
      name: "Process Engineer", career: "process engineering", group: "insp",
      tagline: "The design-intent specialist",
      focus: "Explaining why a plant is built and operated the way it is, and what protects it when the assumptions fail.",
      does: [
        "Explain the design intent of a unit and the operating envelope it must stay inside.",
        "Take part in hazard studies: scenario, cause, consequence, safeguard.",
        "Assess a change before it reaches the plant, through the management-of-change process.",
        "Support operations with troubleshooting grounded in the process, not in guesswork."
      ],
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        1:  {title:"First Day in the Process Team", scenario:"Meet the team and complete onboarding on an operating site."},
        2:  {title:"Shift and Unit Handover", scenario:"Take a handover from operations and say what you will look at."},
        3:  {title:"Data and Instrument Check", scenario:"Confirm the data you are about to reason from is trustworthy."},
        4:  {title:"Equipment and Specification Check", scenario:"Confirm the equipment matches the specification and the duty."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Raise a process hazard clearly and stop work if the safeguard is gone."},
        6:  {title:"Design Intent Briefing", scenario:"Explain what the unit is designed to do and what protects it."},
        7:  {title:"P&ID and Data Clarification", scenario:"Resolve a process question before a recommendation is made."},
        8:  {title:"Management of Change Discussion", scenario:"Take a proposed change through review before the plant runs on it."},
        9:  {title:"Deviation and Performance Report", scenario:"Report a process deviation and what you recommend."},
        10: {title:"Startup Readiness Review", scenario:"Confirm the unit is ready and the safeguards are in service."},
        11: {title:"Process Engineer Interview", scenario:"Answer a hiring panel on design intent, hazards and troubleshooting."},
        12: {title:"Career Ready Final Briefing", scenario:"Present how you reason about a plant and how you argue a recommendation."}
      },
      vocab: ["operating envelope","design intent","mass balance","safeguard","relief valve","set pressure",
              "scenario","hazard study","management of change","interlock","turndown","fouling","upset",
              "deviation","cause and consequence"],
      moduleBenchmarks: {
        6: [{id:"trade_intent",must:"State the design intent and the safeguard that protects it when the assumption fails",
             cues:["design","intent","envelope","limit","safeguard","relief","interlock","protect","scenario","overpressure","assumption"],critical:true}],
        8: [{id:"trade_moc",must:"Say the change goes through management of change before the plant runs on it",
             cues:["management of change","moc","change","review","approv","assess","hazard","before","temporary","permanent"],critical:true}]
      },
      goals: [
        {id:"pro-intent", label:"Explain design intent",        why:"Say what it is for before you say what is wrong."},
        {id:"pro-hazard", label:"Speak hazard-study language",  why:"Scenario, cause, consequence, safeguard."},
        {id:"pro-rec",    label:"Argue a recommendation",       why:"Evidence first, then the option, then the risk of not doing it."},
        {id:"pro-job",    label:"Get hired abroad",             why:"Tell your process experience so a foreign employer can act on it."}
      ],
      winLine: "The column is designed for that feed rate, but the safeguard against overpressure is the relief valve and it is set for a different scenario — so that change does not go to the plant until it has been through management of change.",
      welcome: "Your workshops, vocabulary and assessments are now set for process engineering — design intent, hazards and change control."
    },
    {
      id: "millwright",
      name: "Millwright", career: "industrial mechanical maintenance", group: "mech",
      tagline: "The alignment and rotating-equipment specialist",
      focus: "Installing, aligning and maintaining rotating and mechanical plant, and proving it is safe before it is opened.",
      does: [
        "Install, align and level pumps, gearboxes, fans and drives to a stated tolerance.",
        "Replace bearings, seals and couplings, and set clearances to the manual, not by feel.",
        "Take and interpret vibration and alignment readings, and trend them against the last set.",
        "Isolate, lock and prove zero energy before a guard comes off or a machine is opened."
      ],
      modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scenarios: {
        1:  {title:"First Day on a Maintenance Crew", scenario:"Meet the crew and complete onboarding on an industrial site."},
        2:  {title:"Shift Handover", scenario:"Hand over open work orders, isolations and machines left apart."},
        3:  {title:"Tools and Lifting Gear Check", scenario:"Check your tools, gauges and lifting gear before work starts."},
        4:  {title:"Parts and Clearance Check", scenario:"Confirm the parts and the clearances against the manual."},
        5:  {title:"Safety Stop-Work Conversation", scenario:"Identify a mechanical hazard and stop the work calmly."},
        6:  {title:"Maintenance Procedure Briefing", scenario:"Explain the job, its sequence and its acceptance checks."},
        7:  {title:"Drawing and Tolerance Clarification", scenario:"Resolve a clearance or tolerance question before assembly."},
        8:  {title:"Lift and Trade Coordination", scenario:"Direct a lift safely around other trades."},
        9:  {title:"Condition and Alignment Report", scenario:"Report readings and what you recommend against them."},
        10: {title:"Isolation Before Opening a Machine", scenario:"Prove zero energy before the guard comes off."},
        11: {title:"Millwright Interview", scenario:"Answer a hiring panel on alignment, rotating equipment and isolation."},
        12: {title:"Career Ready Final Briefing", scenario:"Present your alignment discipline and your condition evidence."}
      },
      vocab: ["alignment","dial indicator","laser alignment","soft foot","shim","coupling","bearing",
              "clearance","vibration reading","balance grade","lockout","guard","gearbox","runout",
              "work order","zero energy"],
      moduleBenchmarks: {
        10:[{id:"trade_zero_energy",must:"State that every energy source was isolated, locked and then proved at zero before the guard came off",
             cues:["isolat","lock","tag","zero energy","prove","proved","try","bleed","stored energy","spring","residual","guard"],critical:true}],
        9: [{id:"trade_readings",must:"Give the reading, the tolerance it is judged against, and how it compares with the last one",
             cues:["alignment","offset","angular","vibration","reading","tolerance","spec","limit","trend","previous","last","mm","mil"],critical:false}]
      },
      goals: [
        {id:"mil-align",  label:"Report an alignment properly", why:"Give the reading and the tolerance, not 'it's fine'."},
        {id:"mil-iso",    label:"Explain isolation",            why:"Say zero energy was proved, not assumed."},
        {id:"mil-cond",   label:"Talk about machine condition", why:"Compare today's reading with the last one."},
        {id:"mil-job",    label:"Get hired abroad",             why:"Tell your mechanical experience so a foreign employer can act on it."}
      ],
      winLine: "The alignment is 0.15 mm offset against a 0.05 tolerance, and it has moved since the last check — so I am not putting the guard back until we have looked at the baseplate.",
      welcome: "Your workshops, vocabulary and assessments are now set for millwright work — alignment, rotating equipment and isolation."
    }
  ];

  /* The profession's standards are NOT written here. professional-standards.js
     is the registry — what each document is, who publishes it, what it expects —
     and this file only names the ids. `codes` is derived from it at load so the
     chips on the profile card and the citations in a report can never drift
     apart, which is exactly what happened while both were hand-written.

     A trade keeps whatever `codes` it was given if the registry is missing (the
     passport and the onboarding cards read this field directly, and a missing
     script must not blank them). */
  TRADES.forEach(t => {
    const ps = global.ProfessionalStandards;
    const chips = ps && ps.chipsFor ? ps.chipsFor(t.id) : [];
    if (chips.length) t.codes = chips;
    else if (!t.codes) t.codes = [];
  });

  const BY_ID = new Map(TRADES.map(t => [t.id, t]));
  const DEFAULT_ID = "welder";

  /* The four groups the Shadow library already sorts the same ten professions
     into (catalogue/welding.json). Kept in one order here so the profile picker,
     the onboarding list and the video filter present them identically. */
  const GROUPS = [
    {id:"ops",  cats:["operator","instrumentation"]},
    {id:"elec", cats:["electrician","hse"]},
    {id:"insp", cats:["ndt","process"]},
    {id:"mech", cats:["pipefitter","welder","boilermaker","millwright"]}
  ];

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

  /* ==========================================================================
     What each trade is actually asked, and what a good answer sounds like.
     --------------------------------------------------------------------------
     The track pack is written for a welder. A pipefitter asked "what positions
     are you comfortable in?" and shown "I'm a welder with six years' experience"
     as the model answer is being taught somebody else's job — and the shadowing
     list, which reads these model answers aloud, made that impossible to miss.

     So the questions and their model answers are overlaid PER QUESTION, not per
     module. The previous shape gave one answer for a whole workshop, and the
     shadowing list printed that single sentence five times over — once for each
     question in the module.

     Only the trades that need it carry an overlay. The welder does not appear
     here: the pack IS the welder's content, and duplicating it would create two
     places to keep in step.

     `ask` is used for three things at once — the rubric label, the spoken turn
     and, for `open`, the character's opening line — because in the pack these
     are the same sentence with at most a conversational lead-in.

     Domain note: this is communication practice. The technical content is here
     to make the conversation real, not to teach the trade, and it needs review
     by a qualified tradesperson before it informs any hiring decision.
     ========================================================================== */
  const WORKSHOPS = {

    operator: {
      1: {
        openings: {
          hr:"Good morning — you must be the new operator. I'm Maya from HR. Tell me a little about yourself and the units you've run.",
          supervisor:"Morning. Daniel, shift supervisor. Before I put you on a panel, tell me what you've operated.",
          coworker:"Hey — you're the new one on days? Luis. What kind of unit were you on before this?",
          safety:"Morning. Priya, safety. Everyone gets five minutes with me on day one. Tell me about your experience first.",
          qa:"You're new — I'm Amelia, I look after procedures and records. Tell me where you've worked and what you ran."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm a process operator with six years on refinery units. Most of that is crude and distillation — field work for the first three years, then board. I know start-up and shutdown on my unit, and I've done a lot of preparing equipment for maintenance under permit.",
          vocab:["process operator","unit","distillation","board operator","start-up","permit"]},
        t0:{ask:"What units have you actually run, and on the board or in the field?",
          model:"Crude and vacuum, and a year on the treater. Three years in the field doing rounds and line-ups, three on the board. I'm comfortable on the board for normal operation, and I'd want to be signed off with someone before I take a start-up on my own.",
          vocab:["crude","vacuum","field round","line-up","board","signed off"]},
        t1:{ask:"Before you touch a valve here — walk me through what you check to work safely.",
          model:"My PPE first, then the permit situation on the unit and what is isolated. I check the board and the log before I go out, so I know what has changed. If something in the field doesn't match what the board says, I come back and ask before I move anything.",
          vocab:["PPE","permit","isolation","log","line-up"]},
        t2:{ask:"If you're not sure about a step in a procedure, who do you go to?",
          model:"The shift supervisor, or the board operator if it's on my unit. I don't work a step from memory. The procedure is there because someone learned it the hard way, and asking takes two minutes.",
          vocab:["procedure","shift supervisor","board operator","escalate"]},
        t3:{ask:"Last one — where do you want to be in a couple of years?",
          model:"Signed off on the board for my unit, including start-up and shutdown, and then working towards shift supervisor. I learn a unit by walking it, so I'd like as much field time as you can give me early on.",
          vocab:["signed off","start-up","shutdown","shift supervisor"]}
      },
      2: {
        open:{ask:"You're handing over to me. Tell me what I need to know.",
          model:"The unit is stable at rate, nothing has changed on feed since midnight. One deviation: the overhead temperature has been creeping about two degrees an hour since six. It's logged, the board knows, and it needs watching. There's an open permit on the west pump for the bearing change.",
          vocab:["stable","rate","deviation","overhead","logged","open permit"]},
        t0:{ask:"What would you say if the unit had been upset during your shift?",
          model:"I'd say what upset it, what I did, and whether it's fully back. Not just 'we had a trip' — the trip, the cause if we know it, what's still lined up differently, and whether anything is still bypassed.",
          vocab:["upset","trip","cause","lined up","bypass"]},
        t1:{ask:"How do you make sure the handover actually lands?",
          model:"I walk the board with them rather than talk at them, and I get them to say back the two things that matter. And it goes in the log, because a handover nobody wrote down is a handover that didn't happen.",
          vocab:["handover","log","read back","board"]},
        t2:{ask:"What goes in the log that doesn't get said out loud?",
          model:"Times and numbers. What the rate was, when the temperature started moving, who I told and when. The conversation is for the next operator; the log is for the person who has to work out what happened next week.",
          vocab:["log","record","time","rate","escalation"]},
        t3:{ask:"And what do you want from the shift handing over to you?",
          model:"The same thing: state, deviations, open permits, and anything bypassed or out of service. If they can't tell me what's abnormal, I'll walk it myself before I take it.",
          vocab:["state","deviation","open permit","out of service","bypass"]}
      },
      3: {
        openings: {
          supervisor:"You're on rounds this morning. Tell me how you'd go through the unit.",
          safety:"Priya, safety. Before you go out — talk me through your round.",
          coworker:"Luis here. You're doing the round? How do you work through it?",
          qa:"Amelia. Talk me through what a good field round looks like.",
          hr:"Maya from HR, sitting in today. Tell me how you'd go round the unit."
        },
        open:{ask:"You're on rounds this morning. Tell me how you'd go through the unit.",
          model:"I follow the round sheet rather than my memory, because the sheet catches the things you stop seeing. Pumps first — bearing temperature, vibration by hand, seal and leaks. Then levels and pressures against the board. Anything different from yesterday I write down, even if it's still in range.",
          vocab:["round sheet","bearing","seal","level","pressure","in range"]},
        t0:{ask:"Say a pump is running hot. How would you report that?",
          model:"Straight to the board with the number, not 'it feels hot'. Bearing temperature, what it was on the last round, and whether it's noisy or leaking with it. Then I'd write it up and agree with the supervisor whether we swap to the spare.",
          vocab:["bearing temperature","trend","spare","swap","report"]},
        t1:{ask:"If something out there isn't right, do you carry on with the round or stop?",
          model:"Depends what it is. A leak of hydrocarbon, I stop and call it in from a safe place. Something drifting but contained, I finish the round and report it all together — but I don't sit on it until the end of shift.",
          vocab:["leak","hydrocarbon","contain","report","escalate"]},
        t2:{ask:"How do you make sure it doesn't get forgotten after your shift?",
          model:"It goes in the log and in the handover, and if it needs work it gets a notification raised there and then. A verbal to one person is how things get lost.",
          vocab:["log","handover","notification","work order"]},
        t3:{ask:"Tell me what you'd write down.",
          model:"Equipment tag, what I saw, the number, the time, and what I did about it. Enough that the next operator can find the same pump and see whether it's got worse.",
          vocab:["tag","reading","time","record","trend"]}
      },
      4: {
        open:{ask:"We're transferring product shortly. Tell me how you'd confirm the line-up.",
          model:"I walk it rather than trust the board. Every valve on the route checked in the position the procedure says, the destination tank confirmed with the tank farm, and level and capacity checked before we start. Then I confirm back to the board what's open and what's shut.",
          vocab:["line-up","valve","route","tank farm","capacity","confirm back"]},
        t0:{ask:"What would you do if a valve isn't where the procedure says it should be?",
          model:"Stop and find out why before I move it. A valve out of position usually means somebody else is doing something. I'd check the permit board and ask the supervisor rather than just putting it right.",
          vocab:["position","permit","supervisor","hold"]},
        t1:{ask:"How do you know the receiving tank can take it?",
          model:"I check the level and the ullage myself, and I agree the figure with the tank farm before we start. Overfilling a tank is one of the things this industry has learned about the hard way, so I don't take a number second-hand.",
          vocab:["level","ullage","tank farm","overfill","alarm"]},
        t2:{ask:"And while the transfer is running, what are you watching?",
          model:"Level rising at the rate it should, pressure steady, and nothing moving on the line I didn't expect. If the level isn't going up as fast as the rate says it should, product is going somewhere else and I stop.",
          vocab:["rate","level","pressure","discrepancy","stop"]},
        t3:{ask:"What do you record?",
          model:"Start time, opening and closing levels, the route, and who authorised it. If there was any discrepancy between the meter and the tank, that goes in too rather than being smoothed over.",
          vocab:["record","meter","discrepancy","authorisation","log"]}
      },
      5: {
        open:{ask:"You've spotted something you're not happy with. Talk me through it.",
          model:"There's a hydrocarbon leak on the pump seal and it's making a pool. I'm not comfortable running it. I'd shut it down to the spare, isolate it, get the area taped off, and tell you and the board before I do anything else.",
          vocab:["hydrocarbon","seal","isolate","spare","stop work"]},
        t0:{ask:"How would you say that to a supervisor who's under pressure to keep running?",
          model:"Calmly, and about the hazard rather than about them. 'I've got hydrocarbon on the floor at the west pump — I need to swap to the spare.' It's easier to agree with a fact than with an opinion.",
          vocab:["hazard","fact","swap","stop work authority"]},
        t1:{ask:"What if they tell you to carry on?",
          model:"I'd say plainly that I'm not running it in that condition and ask them to come and look. If it still isn't agreed, it goes up — that's what stop-work authority is for, and nobody gets in trouble for using it on a leak.",
          vocab:["stop work authority","escalate","refuse","leak"]},
        t2:{ask:"Who else needs to know?",
          model:"The board straight away, because they'll see the effect before I've finished talking. Then safety, and the shift supervisor. If it's spreading, it's the emergency number, not a conversation.",
          vocab:["board","safety","shift supervisor","emergency"]},
        t3:{ask:"And afterwards?",
          model:"It gets reported properly, not just fixed. Loss of containment is a process safety event even when it's small, and the small ones are the ones that tell you something before the big one.",
          vocab:["loss of containment","process safety event","report","investigation"]}
      },
      6: {
        open:{ask:"Talk me through the start-up step and the limits it has to stay inside.",
          model:"I work off the written procedure, step by step, signing as I go. On this step I'm bringing the tower up on rate, and the limits are the overhead temperature and the drum level — I stay inside those, and if I can't, I hold and call the supervisor rather than pushing it.",
          vocab:["procedure","step","normal operating limit","hold","escalate"]},
        t0:{ask:"What would you do if the procedure and what the board is telling you disagree?",
          model:"Hold where I am and ask. I don't pick whichever is easier. Usually it means something isn't where we think it is, and that's exactly the moment to stop rather than to carry on.",
          vocab:["hold","discrepancy","procedure","verify"]},
        t1:{ask:"Can you change a step if it clearly isn't working?",
          model:"No, not on my own. A change to how the plant is operated goes through management of change first. I can stop, and I can raise it — but I don't improvise a procedure and leave the next shift running on something nobody reviewed.",
          vocab:["management of change","procedure","improvise","review"]},
        t2:{ask:"How would you explain the step to someone who missed the briefing?",
          model:"What we're doing, the two limits that matter, and what we do if we hit one. Then I'd point them at the procedure on the desk rather than trusting my summary of it.",
          vocab:["briefing","limit","procedure","summary"]},
        t3:{ask:"Anything in it that changes how you protect yourself?",
          model:"Start-up is when things are furthest from steady, so it's more field checks and more talking. I'd keep clear of the relief route and make sure whoever is in the field knows what I'm about to do before I do it.",
          vocab:["start-up","relief","field","communicate"]}
      },
      7: {
        open:{ask:"There's a question on this drawing. What would you check before anything is opened?",
          model:"I'd check the P&ID against what's actually in the field — tag numbers on the valves, which side of the block is the isolation, and whether there's a drain and a vent where the drawing shows one. If the field and the drawing disagree, the drawing doesn't win by itself.",
          vocab:["P&ID","tag number","block","isolation","drain","vent"]},
        t0:{ask:"Who do you go to if the drawing is wrong?",
          model:"The supervisor first, and then it needs raising so the drawing gets corrected. An out-of-date P&ID is a hazard for the next person, so it's not enough that I now know.",
          vocab:["supervisor","raise","out of date","correct"]},
        t1:{ask:"How specific do you need to be?",
          model:"Very. Tag number, line number, and what I actually found versus what's shown. 'The drawing's wrong' helps nobody; 'there's no drain valve on the low point of line 6-P-104' can be acted on.",
          vocab:["tag number","line number","found","shown"]},
        t2:{ask:"What do you do in the meantime?",
          model:"Nothing gets opened. If we can't prove the isolation from the drawing and the field together, we don't have an isolation.",
          vocab:["isolation","prove","hold","open"]},
        t3:{ask:"And once it's resolved?",
          model:"The corrected drawing comes back to the job, and I check the line-up again against it before we go on. I don't work from the version I had in my head from before.",
          vocab:["revised","line-up","verify","current revision"]}
      },
      8: {
        open:{ask:"Maintenance need this pump. Tell me how you'd hand it over to them.",
          model:"I'd shut it down, drain and depressure it, purge it, isolate it and lock the isolations, and then prove it's dead. Only then do I sign the permit over and walk the boundary with the technician so we both agree what's theirs and what's still mine.",
          vocab:["depressure","purge","isolate","lock","permit","boundary"]},
        t0:{ask:"What do you need from them before they start?",
          model:"What exactly they're doing, how long, and whether they need to break into the line. If it's a line break, that's a different permit and a different conversation about blinding.",
          vocab:["scope","duration","line break","blind","permit"]},
        t1:{ask:"How do you keep the rest of the unit safe while they're working?",
          model:"The unit stays on the spare, and I make sure the board knows exactly what's out of service. And I check on them — an isolation you set in the morning and never look at again is an assumption, not a control.",
          vocab:["spare","out of service","isolation","check"]},
        t2:{ask:"What if another crew turns up wanting to work nearby?",
          model:"They go through the permit system, not through me at the fence. Two jobs beside each other is exactly how someone gets hurt, so it needs the permits looked at together before both start.",
          vocab:["permit","simultaneous operations","coordinate","hold"]},
        t3:{ask:"And when they've finished?",
          model:"I walk it with them, check the job is actually complete and nothing is left off, take the locks off in order, and then re-commission it properly before I call it available. The permit is closed on paper, not by someone saying they're done.",
          vocab:["close-out","locks","re-commission","available","permit close"]}
      },
      9: {
        open:{ask:"Something's off-spec. Tell me what you'd report.",
          model:"The overhead product is off-spec on the last two samples, and it started after the reflux dropped at about four. I've logged both results, told the board, and put the rate back to where it was. It needs the lab to confirm before we route it anywhere.",
          vocab:["off-spec","sample","reflux","logged","route","lab"]},
        t0:{ask:"How do you decide whether it's a problem or a blip?",
          model:"Two readings going the same way rather than one, and whether something changed at the same time. One odd sample can be the sample; two, with a cause you can point at, is the plant.",
          vocab:["trend","sample","cause","repeat"]},
        t1:{ask:"What would you do about the product already made?",
          model:"It doesn't go to a spec tank until it's confirmed. Segregate it, mark it, and get the disposition agreed by the people who own the quality — not by me, on shift, wanting the tank.",
          vocab:["segregate","disposition","spec tank","quarantine"]},
        t2:{ask:"And if there'd been a release rather than an off-spec?",
          model:"That's a process safety event and it gets reported as one — what was released, roughly how much, and for how long. Reporting the small ones is the only reason anyone sees the pattern before a big one.",
          vocab:["loss of containment","process safety event","report","estimate"]},
        t3:{ask:"What goes in the report?",
          model:"What, when, how much, what I did, who I told. Facts and times. What I think caused it goes in as what I think, clearly labelled, not mixed in with what I saw.",
          vocab:["report","facts","time","cause","observation"]}
      },
      10: {
        open:{ask:"This is a controlled job. Tell me what you need in place before it starts.",
          model:"Before that vessel is opened I need it drained, depressured, purged and gas-tested, every energy source isolated and locked, blinds in where the procedure calls for them, and a permit posted that says all of it. And I want to see zero on the gauge myself.",
          vocab:["depressure","purge","gas test","isolate","lock","blind","permit"]},
        t0:{ask:"If the permit runs out mid-job, what do you do?",
          model:"Everyone comes out and the job stops. The permit expiring means the conditions it was written against are no longer proved. It gets re-issued before anyone goes back in.",
          vocab:["permit","expiry","re-issue","stop"]},
        t1:{ask:"And what should I be watching for while they're in there?",
          model:"Anything changing on the unit that could reach that isolation — a pump starting, a valve moving, pressure coming back. If the isolation isn't intact any more, I need to hear it from the board immediately, not at the end of the shift.",
          vocab:["isolation","upstream","pressure","board","immediately"]},
        t2:{ask:"Who's responsible for the people inside?",
          model:"The attendant at the entry, and the permit issuer for the conditions. My job is that the isolation stays the way I left it and that the board doesn't do anything that changes it.",
          vocab:["attendant","entry","permit issuer","isolation"]},
        t3:{ask:"What has to happen before it goes back into service?",
          model:"The job signed off, the permit closed, blinds out and counted, everyone and every tool accounted for, and then the line-up checked again before we pressure it up. I say plainly whether it's ready or not.",
          vocab:["permit close-out","blind register","line-up","re-commission"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. I'm Maya. To start — tell me about yourself and your operating experience.",
          supervisor:"Daniel, I run shifts here. Tell me what you've operated and how you were signed off.",
          coworker:"Luis — I'd be on your shift. What units have you run?",
          safety:"Priya, safety. Tell me about your experience, and I'll ask you some process safety questions after.",
          qa:"Amelia, procedures and records. Tell me about your background and how you work to a procedure."
        },
        open:{ask:"Tell me about yourself and your operating experience.",
          model:"Six years on refinery units, crude and vacuum mostly. Three years field, three on the board, and I'm signed off for normal operation and shutdown on my unit. What I'd point to is a shift where the overhead started drifting and I caught it on the trend before it tripped — we pulled rate back and stayed on line.",
          vocab:["unit","field","board","signed off","trend","shutdown"]},
        t0:{ask:"What's the most serious thing that's happened on a shift you were on?",
          model:"A seal failure on a hot pump with a small hydrocarbon release. I shut it down to the spare, isolated it, cleared the area and called it in. It was reported as a process safety event and the investigation found the seal flush had been blocked for a while.",
          vocab:["seal failure","release","isolate","process safety event","investigation"]},
        t1:{ask:"How do you work when a procedure doesn't cover what you're seeing?",
          model:"I stop at the last step I'm sure of and get the supervisor. I don't invent the next step. If it turns out the procedure has a gap, that gets raised so it's fixed for the next person rather than carried in somebody's head.",
          vocab:["procedure","hold","escalate","gap","management of change"]},
        t2:{ask:"What would your last supervisor say about you?",
          model:"That my handovers are worth listening to and that I write things down. I'd rather be the operator who reports the small drift than the one who is reliably relaxed about it.",
          vocab:["handover","record","report","reliable"]},
        t3:{ask:"Where do you want to go from here?",
          model:"Signed off on start-up as well as normal running, then towards shift supervisor. I'd also like to be on the hazard studies for my unit — you learn more about a plant in a day of those than in a month of rounds.",
          vocab:["signed off","start-up","shift supervisor","hazard study"]}
      },
      12: {
        open:{ask:"Last session. Why are you ready to run a unit on this site?",
          model:"Because I operate to the procedure and I say what I see. I know my unit's limits and what protects it, I hand over so the next shift isn't guessing, and I report the small things. That's what makes a plant safe — not being clever on the day it goes wrong.",
          vocab:["procedure","limit","safeguard","handover","report"]},
        t0:{ask:"What's the strongest thing you bring?",
          model:"Discipline about the boring parts. Rounds done properly, logs written, deviations reported when they're still small. Most of what goes wrong on a unit was visible for a while first.",
          vocab:["round","log","deviation","early","discipline"]},
        t1:{ask:"Where do you still need to develop?",
          model:"Start-up and shutdown — I've done them with someone, not led them. I want the reps and the sign-off rather than the confidence without the reps.",
          vocab:["start-up","shutdown","sign-off","experience"]},
        t2:{ask:"How would you describe your safety standard to a new operator?",
          model:"If you can't prove it's isolated, it isn't. If it's drifting, say it now. And if someone tells you to carry on and you're not happy, that's what stop-work is for.",
          vocab:["isolation","prove","stop work authority","report"]},
        t3:{ask:"Anything you want to ask us?",
          model:"How the sign-off programme works here and how long it usually takes to get onto the board. And whether operators sit in on the hazard studies, because I'd want to.",
          vocab:["sign-off","board","hazard study","competency"]}
      }
    },
    instrumentation: {
      1: {
        openings: {
          hr:"Good morning — you're the new instrument tech. I'm Maya from HR. Tell me a little about yourself and the work you've done.",
          supervisor:"Morning. Daniel, I run maintenance. Tell me what instruments and systems you've worked on.",
          coworker:"Hey — new in the instrument shop? Luis. What have you been working on?",
          safety:"Morning. Priya, safety. Everyone gets five minutes with me on day one. Tell me about your experience first.",
          qa:"Amelia — I look after calibration records. Tell me where you've worked and how you keep yours."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm an instrument technician with six years on process plant. Calibration and fault-finding on transmitters, control valves and positioners, loop checking during commissioning, and proof testing on safety loops. The last two years were on a refinery, so a lot of work in classified areas under permit.",
          vocab:["transmitter","control valve","positioner","loop check","proof test","classified area"]},
        t0:{ask:"What kind of instruments and systems are you comfortable with?",
          model:"Pressure, level, flow and temperature transmitters, control valves and positioners, and loop work from the field to the DCS. I've done proof testing on safety instrumented functions with an engineer, and I'd want that supervised until I'm signed off here.",
          vocab:["transmitter","DCS","control valve","safety instrumented function","proof test","signed off"]},
        t1:{ask:"Before you touch anything here — walk me through how you work safely.",
          model:"I check what the loop does before I touch it, because some of them trip the plant. Permit first, agree with the board what's going out of service, isolate the process side and the electrical side, and if it's in a classified area, the right tools and the right method. Nothing gets bypassed without it being written down.",
          vocab:["permit","out of service","isolate","classified area","bypass","board"]},
        t2:{ask:"If you're not sure about a loop, who do you go to?",
          model:"The supervisor, and back to the P&ID and the loop drawing. I don't work out what an instrument does by moving it and watching what happens — on a live plant that's an experiment with somebody else's unit.",
          vocab:["P&ID","loop drawing","supervisor","verify"]},
        t3:{ask:"Where do you want to be in a couple of years?",
          model:"Signed off on the safety instrumented systems work, and stronger on the control side — tuning and DCS configuration rather than only field instruments.",
          vocab:["safety instrumented system","tuning","DCS","configuration"]}
      },
      2: {
        open:{ask:"You're handing over to me. What do I need to know?",
          model:"One bypass still in — the level transmitter on the west drum is bypassed at the DCS with operations' authority, and it expires at six. It needs restoring and proof testing before then or the authority gets extended in writing. Two calibrations done and recorded, one transmitter still off the line in the workshop.",
          vocab:["bypass","authority","restore","proof test","calibration","off the line"]},
        t0:{ask:"What's the most important item on that list?",
          model:"The bypass, and it's the first thing I'd say rather than the last. A protective function that's bypassed is the plant running without a layer of protection, and the clock on it matters.",
          vocab:["bypass","protective function","expiry","priority"]},
        t1:{ask:"How do you make sure it doesn't get forgotten?",
          model:"It's on the bypass register with a time on it, not only in my head and the handover. The register is what operations look at; the handover is what you and I say. It needs both.",
          vocab:["bypass register","record","time limit","handover"]},
        t2:{ask:"What about the instrument still in the shop?",
          model:"The tag it came from, what's wrong with it, and whether there's a spare in. And whether the loop is currently running on a spare or running blind, because those are very different things for the operator.",
          vocab:["tag","spare","loop","blind","out of service"]},
        t3:{ask:"And what do you want from the shift before yours?",
          model:"Open bypasses, anything left disconnected, and anything they've changed in the DCS. A changed range or a changed alarm setting that nobody mentions is the one that catches you.",
          vocab:["bypass","disconnected","range","alarm setting","change"]}
      },
      3: {
        openings: {
          supervisor:"That test gear's yours today. Tell me how you'd check it before you start.",
          safety:"Priya, safety. Before you calibrate anything — talk me through your gear check.",
          coworker:"Luis here. How do you check your calibrator before you use it?",
          qa:"Amelia. Talk me through your test equipment check and what you record.",
          hr:"Maya from HR, sitting in. Tell me how you'd check your equipment."
        },
        open:{ask:"That test gear's yours today. Tell me how you'd check it before you start.",
          model:"Calibration label first — in date, and traceable to a reference. Then the physical condition: leads, fittings, hand pump for leaks, and the battery. A calibrator that's drifted is worse than one that doesn't work, because I'd trust the numbers it gives me and so would everyone reading the record.",
          vocab:["calibration label","in date","traceable","reference","drift","record"]},
        t0:{ask:"Why does traceability matter so much?",
          model:"Because the whole point of the calibration record is that somebody else can rely on it. If my reference isn't traceable, all I've proved is that my instrument agrees with my other instrument.",
          vocab:["traceable","reference","record","rely","standard"]},
        t1:{ask:"If the gear's out of calibration, do you carry on?",
          model:"No. It goes back and I get another one. Calibrating a plant instrument with an out-of-date reference means every record I write that day has to be redone — it's cheaper to stop at eight than to find out at four.",
          vocab:["out of calibration","reference","record","redo","stop"]},
        t2:{ask:"How do you stop someone else picking it up?",
          model:"Out of the rack into quarantine with a tag, and the store told so it goes for recalibration rather than sitting in a cupboard.",
          vocab:["quarantine","tag","store","recalibration"]},
        t3:{ask:"What goes in the record?",
          model:"The reference instrument and its certificate, the as-found and as-left readings at each test point, the ambient conditions if they matter, the date and my name. As-found is the important one — it's what tells you whether the loop has been reading wrong.",
          vocab:["reference","certificate","as-found","as-left","test point","record"]}
      },
      4: {
        open:{ask:"Check the instrument for this job. What are you looking at?",
          model:"Tag number against the P&ID and the datasheet, range and units, process connection and materials for the service, and the certification if it's going into a classified area. A transmitter that's right in every way except its Ex certification cannot go in that location.",
          vocab:["tag number","datasheet","range","process connection","certification","Ex","classified area"]},
        t0:{ask:"What if the replacement's range is different?",
          model:"It doesn't go in until the range is agreed and the DCS is changed to match. A field transmitter ranged differently from the system is a reading that's confidently wrong, which the operator has no way to spot.",
          vocab:["range","DCS","configuration","mismatch","agree"]},
        t1:{ask:"Why does the certification matter?",
          model:"In a classified area the protection concept is what keeps it from being an ignition source. The certificate, the gland and the installation method go together — one wrong element and the concept doesn't hold.",
          vocab:["certification","protection concept","ignition source","gland","installation"]},
        t2:{ask:"What do you record about what you fitted?",
          model:"Serial number against the tag, the range as set, the certificate reference, and the date. So the next person knows what's actually out there instead of what the datasheet says should be.",
          vocab:["serial number","tag","range","certificate","as-installed"]},
        t3:{ask:"Anything that changes how you protect yourself?",
          model:"What's in the line. Breaking into a process connection means knowing what fluid, what pressure and what temperature, and whether it's been isolated and drained. The instrument being small doesn't make the line safe.",
          vocab:["process connection","isolate","drain","pressure","fluid"]}
      },
      5: {
        open:{ask:"You've seen something you're not happy with. Talk me through it.",
          model:"There's a bypass in on a trip function with no authority written against it and nobody can say who put it there or when. The plant is running without a protection it's supposed to have. I'd tell the board and the supervisor straight away, and either we get it authorised properly with a time limit or it comes out now.",
          vocab:["bypass","trip function","authority","protection","time limit"]},
        t0:{ask:"How would you raise it?",
          model:"Factually and quickly. 'There's a bypass in on the high level trip and there's nothing on the register for it.' It isn't an accusation — it's usually somebody who meant to take it out — but it needs saying now rather than at the end of shift.",
          vocab:["factual","register","raise","immediate"]},
        t1:{ask:"What if you're told to leave it because the plant would trip?",
          model:"Then that's a decision for operations management, in writing, with a time limit and a compensating measure — someone watching the level manually. What I won't do is leave it undocumented because taking it out is inconvenient.",
          vocab:["authority","compensating measure","time limit","documented","escalate"]},
        t2:{ask:"Who needs to know?",
          model:"The board operator first, because they're the ones relying on that protection, then the shift supervisor and the instrument supervisor. And it goes on the register whatever the decision is.",
          vocab:["board operator","supervisor","register","record"]},
        t3:{ask:"And afterwards?",
          model:"It gets looked at properly — how a bypass went in without a record. That's a system problem, not one person's mistake, and the fix is in how bypasses are controlled rather than in a reminder.",
          vocab:["root cause","bypass control","system","corrective action"]}
      },
      6: {
        open:{ask:"Talk me through this safety loop and how you'd work on it.",
          model:"It's a protective function — high level trips the feed pump. So before I touch it, operations authorise the bypass in writing with a time limit, it goes on the register, and there's a compensating measure while it's out. When I'm done it gets a proof test, not just a continuity check, and the bypass comes out and is signed off.",
          vocab:["protective function","bypass","authority","time limit","compensating measure","proof test"]},
        t0:{ask:"What's the difference between a loop check and a proof test?",
          model:"A loop check says the signal gets from the field to the system. A proof test says the whole function works end to end — sensor, logic and final element actually shut that pump. You can pass a loop check with a valve that won't move.",
          vocab:["loop check","proof test","sensor","logic solver","final element"]},
        t1:{ask:"Can you extend the bypass if you run over?",
          model:"Only through the same people who authorised it, in writing. I don't extend my own bypass. The time limit exists precisely so that a two-hour job that becomes two days is noticed by somebody other than me.",
          vocab:["bypass","extend","authority","time limit","written"]},
        t2:{ask:"How would you explain the job to the board operator?",
          model:"What protection they're losing, for how long, what to watch instead, and what I need from them to put it back. In their terms: 'you won't get the high level trip on the drum between two and four — watch the level on the trend.'",
          vocab:["protection","compensating measure","trend","restore","brief"]},
        t3:{ask:"Anything that changes how you protect yourself?",
          model:"If the final element is a valve that will move when I test it, then the mechanical hazard is real and whoever is near it needs to know before it strokes.",
          vocab:["final element","stroke","mechanical hazard","warn"]}
      },
      7: {
        open:{ask:"There's a question on this drawing. What do you check before anything is disturbed?",
          model:"The tag number on the P&ID against the tag on the instrument in the field, and the loop drawing for where it terminates. Instruments get replaced and labels get swapped, so I identify it physically as well as on paper before I disconnect anything.",
          vocab:["tag number","P&ID","loop drawing","terminate","identify"]},
        t0:{ask:"Who do you go to if the drawing doesn't match?",
          model:"The supervisor, and it goes for correction. An out-of-date loop drawing is the reason the next person disconnects the wrong instrument at three in the morning.",
          vocab:["supervisor","correction","out of date","revision"]},
        t1:{ask:"How specific do you need to be?",
          model:"Tag numbers, both of them. 'The drawing shows LT-2104 on the east drum but the instrument there is tagged LT-2140' is something someone can act on today.",
          vocab:["tag number","specific","act","discrepancy"]},
        t2:{ask:"What do you do in the meantime?",
          model:"Nothing gets disconnected. If I can't prove which loop I'm on, I don't have a loop — I have a guess with wires attached to it.",
          vocab:["disconnect","prove","identify","hold"]},
        t3:{ask:"And once it's resolved?",
          model:"The drawing is corrected and I work from the current revision, and the as-installed record gets updated too. Otherwise the same question comes back next year.",
          vocab:["revision","as-installed","current","update"]}
      },
      8: {
        open:{ask:"You need a loop out of service that operations are using. How do you sort that?",
          model:"Face to face with the board first. What's going out, for how long, what they lose, and what they watch instead. They decide when the unit can spare it. Then the permit, the bypass authority if it's protective, and I confirm back to them when it's out and again when it's restored.",
          vocab:["out of service","board","bypass authority","permit","restore","confirm"]},
        t0:{ask:"What do you need from them?",
          model:"The equipment in a state where the work is safe, the process side isolated and drained if I'm breaking in, and their agreement on the window. And their confirmation that nobody will change the unit's operation while the loop is out.",
          vocab:["isolate","drain","window","agreement","confirm"]},
        t1:{ask:"What do they need from you?",
          model:"An honest time, a call if it's going to run over, and a clear statement when it's back — proof tested and in service, not 'I've finished'. Those two mean different things to an operator.",
          vocab:["duration","proof test","in service","communicate"]},
        t2:{ask:"What if another trade needs the same equipment?",
          model:"Then it's sequenced through the permit system. Two people working on one loop, one of them stroking a valve, is how somebody's hand gets caught.",
          vocab:["sequence","permit","coordinate","stroke"]},
        t3:{ask:"And putting it back?",
          model:"Proof test where it's protective, bypass out and signed off the register, the board told, and the record written. The bypass register is the last thing to close, and it's the one most often left open.",
          vocab:["proof test","bypass","register","record","close out"]}
      },
      9: {
        open:{ask:"There's a loop fault. What would you report?",
          model:"The tag, what the symptom is and what I found. LT-2104 reading 40 per cent with the drum visibly higher than that — as-found calibration was 6 per cent low across the range, and the impulse line was partly blocked. I've cleared it, recalibrated, and recorded as-found and as-left. It was reading low for an unknown period, so the trend data before today can't be relied on.",
          vocab:["tag","symptom","as-found","as-left","impulse line","calibration","trend"]},
        t0:{ask:"Why does the as-found reading matter so much?",
          model:"Because it's the only evidence of how long the plant was being run on a wrong number. If I only record as-left, the record says the instrument is fine and nobody knows it wasn't.",
          vocab:["as-found","evidence","record","as-left"]},
        t1:{ask:"Who needs to know beyond your supervisor?",
          model:"Operations, because decisions were made on that reading, and process if the data feeds anything. A wrong level that fed a mass balance is now a wrong mass balance.",
          vocab:["operations","process","data","decision","impact"]},
        t2:{ask:"How do you stop it happening again?",
          model:"If the impulse line blocked once it will block again, so it's either a cleaning interval or a design change. Recalibrating it and closing the job means I'll be back doing the same thing next quarter.",
          vocab:["recurrence","interval","design change","root cause"]},
        t3:{ask:"What goes in the record?",
          model:"Tag, reference instrument and its certificate, as-found and as-left at each point, what was found physically, the date and my name. And a plain statement that the loop was reading low, so anyone reading the history sees it.",
          vocab:["tag","reference","as-found","as-left","certificate","history"]}
      },
      10: {
        open:{ask:"This is a controlled job on a live system. What do you need in place?",
          model:"Permit posted, operations' written authority for the bypass with a time limit on it, the bypass on the register, and a compensating measure agreed. Process side isolated and drained where I'm breaking in, electrical isolation where I'm not working live, and the right tools and method for the area classification. And the board knows before I start, not as I start.",
          vocab:["permit","authority","bypass","register","compensating measure","isolate","area classification"]},
        t0:{ask:"If the permit runs out mid-job, what do you do?",
          model:"Stop and leave it safe. And if that means the bypass stays in past its time, that gets raised immediately rather than quietly running on.",
          vocab:["permit","expiry","leave safe","bypass","raise"]},
        t1:{ask:"What should the board be watching while you work?",
          model:"The compensating measure — the level on the trend if I've taken their level trip out — and anything moving that they didn't do. If a valve strokes because I'm testing, they need to know it's me.",
          vocab:["compensating measure","trend","stroke","communicate"]},
        t2:{ask:"What would make you stop?",
          model:"Losing the authority, the permit expiring, the compensating measure not being watched, or finding the isolation isn't what I was told. Any of those and it stops before it's discussed.",
          vocab:["authority","permit","compensating measure","isolation","stop"]},
        t3:{ask:"And restoring it?",
          model:"Proof test the function end to end, bypass out, signed off the register, the board told it's back in service, and the record written. Saying 'it's back' before the proof test is the mistake that matters here.",
          vocab:["proof test","bypass","register","in service","record"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. Maya. To start — tell me about yourself and your instrumentation experience.",
          supervisor:"Daniel, maintenance. Tell me what you've worked on and what you're signed off for.",
          coworker:"Luis — I'd be in the shop with you. What sort of instrument work have you done?",
          safety:"Priya, safety. Tell me about your experience, then I'll ask about bypasses.",
          qa:"Amelia, records. Tell me about your background and how you keep calibration records."
        },
        open:{ask:"Tell me about yourself and your instrumentation experience.",
          model:"Six years on process plant. Calibration and fault-finding on transmitters and control valves, loop checking on commissioning, and proof testing on safety loops with an engineer. What I'd point to is a level transmitter that had been reading six per cent low for months — I found it on the as-found calibration, and it changed how we scheduled that loop.",
          vocab:["calibration","fault-finding","loop check","proof test","as-found"]},
        t0:{ask:"Explain a safety instrumented function to me.",
          model:"Sensor, logic solver, final element. The sensor sees the condition, the logic decides, the final element does something physical — closes a valve or trips a pump. It's a protection layer, so it's tested as a whole function, and it's bypassed only with written authority and a time limit.",
          vocab:["sensor","logic solver","final element","protection layer","proof test","bypass"]},
        t1:{ask:"Tell me about a time you found something serious.",
          model:"A bypass in on a high level trip with nothing on the register — nobody could say when it went in. I told the board straight away. It went to operations management and came out the same shift with a compensating measure while it was still in.",
          vocab:["bypass","register","board","compensating measure","escalate"]},
        t2:{ask:"How do you work in a classified area?",
          model:"The classification decides the equipment and the method, not my preference. Certified equipment, the right glands and seals, and where the work can't suit the classification, it becomes a gas-test-and-permit job rather than a normal one.",
          vocab:["classification","certified","gland","protection concept","permit","gas test"]},
        t3:{ask:"Where do you want to go from here?",
          model:"Signed off on the safety instrumented systems work here, and stronger on the control side — tuning and configuration. Long term I'd want to be involved in the proof-test planning, not just executing it.",
          vocab:["safety instrumented system","tuning","configuration","proof test","development"]}
      },
      12: {
        open:{ask:"Last session. Why are you ready for this work?",
          model:"Because I treat a protective loop as a protective loop. Written authority for a bypass, a time limit, a compensating measure, a proof test before I say it's back. And I record as-found, not just as-left, so the plant knows what it has actually been running on.",
          vocab:["protective loop","bypass","authority","proof test","as-found","record"]},
        t0:{ask:"What's the strongest thing you bring?",
          model:"Records that mean something. As-found readings are inconvenient because they show how long something was wrong — which is exactly why they're the ones worth writing.",
          vocab:["as-found","record","evidence","traceable"]},
        t1:{ask:"Where do you still need to develop?",
          model:"The control and configuration side, and full sign-off on safety instrumented systems. I've done that work supervised and I'd rather say so than imply I'd lead it.",
          vocab:["configuration","safety instrumented system","sign-off","supervised"]},
        t2:{ask:"How would you describe your standard to a trainee?",
          model:"Identify the loop physically, not just on the drawing. Never put a bypass in without a piece of paper and a time. And a loop check is not a proof test — say which one you did.",
          vocab:["identify","bypass","time limit","loop check","proof test"]},
        t3:{ask:"Anything you want to ask us?",
          model:"How bypasses are controlled here and who authorises them, and how proof tests are scheduled. Those two tell me how seriously the site takes its protection layers.",
          vocab:["bypass","authority","proof test","protection layer"]}
      }
    },
    electrician: {
      1: {
        openings: {
          hr:"Good morning — you must be the new sparky. I'm Maya from HR. Tell me a little about yourself and the work you've done.",
          supervisor:"Morning. Daniel, I run this crew. Before I put you on anything live, tell me what you've worked on.",
          coworker:"Hey — new on the electrical crew? Luis. What were you doing before this?",
          safety:"Morning. Priya, safety officer. Everyone gets five minutes with me on day one. Tell me about your experience first.",
          qa:"I'm Amelia — I check test records before anything is energised. Tell me where you've worked."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm an industrial electrician with six years, mostly plant maintenance and installation. Motor circuits, switchgear up to low voltage, cable installation and terminations, and fault-finding on drives. The last two years were on a process site, so a lot of work in classified areas and under permit.",
          vocab:["motor circuit","switchgear","termination","fault-finding","classified area","permit"]},
        t0:{ask:"What voltages and what kind of equipment are you comfortable with?",
          model:"Low voltage installation and maintenance, motor circuits, distribution boards and drives. I've worked around high voltage but I'm not authorised for it, so I'd want that stated clearly rather than assumed either way.",
          vocab:["low voltage","high voltage","authorised","distribution board","drive"]},
        t1:{ask:"Before you touch anything here — walk me through how you work safely.",
          model:"I don't work on anything I haven't proved dead myself. Isolate, lock and tag, test dead with a voltage indicator, and prove that indicator on a known source before and after. My PPE and the arc-flash label on the panel decide how I approach it in the first place.",
          vocab:["isolate","lock","tag","test dead","proving unit","arc flash"]},
        t2:{ask:"If you're not sure about a circuit, who do you go to?",
          model:"The supervisor, and I go back to the single-line diagram. I don't trace a circuit by switching things off and seeing what stops — that's how you take a plant down and still get it wrong.",
          vocab:["single line diagram","supervisor","verify","trace"]},
        t3:{ask:"Where do you want to be in a couple of years?",
          model:"Authorised for high voltage switching, and more on the drives and control side. I'd like to get onto the testing and commissioning work rather than only maintenance.",
          vocab:["authorised","switching","commissioning","testing"]}
      },
      2: {
        open:{ask:"You're handing over to me. What do I need to know?",
          model:"Two isolations still in place — the east conveyor and one motor circuit in the substation, both locked with my lock and both on the permit board. The conveyor is finished and can be restored once operations agree. The motor is still apart, so nothing goes back on that one.",
          vocab:["isolation","lock","permit","restore","apart"]},
        t0:{ask:"What do you do with your own lock at the end of a shift?",
          model:"It stays on until the job is safe to restore. If the job runs over, my lock stays and the handover says so — I don't take my lock off so the next shift can find their own way to make it safe.",
          vocab:["personal lock","lockout","handover","restore"]},
        t1:{ask:"What about outstanding test results?",
          model:"Any circuit tested but not yet recorded gets flagged, and any circuit that failed is called out clearly. A failed insulation test that nobody hands over becomes a circuit someone energises tomorrow.",
          vocab:["insulation resistance","test record","failed","energise"]},
        t2:{ask:"How do you make sure it lands?",
          model:"I walk the permit board with them. Isolations are the one thing I won't hand over by talking — we look at the locks together and I get them to say back which ones are theirs now.",
          vocab:["permit board","walk","read back","isolation"]},
        t3:{ask:"And what do you want from the shift before yours?",
          model:"Live isolations, anything left apart, and any circuit that's been energised that wasn't before. Changes to what's live are the ones that hurt people.",
          vocab:["isolation","energised","change","live"]}
      },
      3: {
        openings: {
          supervisor:"That test kit's yours for the day. Tell me how you'd check it over before you start.",
          safety:"Priya, safety. Before you go near a panel — talk me through your instrument check.",
          coworker:"Luis here. How do you check your meter before you use it?",
          qa:"Amelia. Talk me through how you check your test instruments.",
          hr:"Maya from HR, sitting in today. Tell me how you'd check your gear."
        },
        open:{ask:"That test kit's yours for the day. Tell me how you'd check it over before you start.",
          model:"The voltage indicator first: leads and probes for damage, fuses if it has them, calibration in date, and then prove it on a known live source or a proving unit. Insulation tester and clamp meter the same way. Then my PPE — gloves in date and inspected, face shield, and the arc-flash rating matched to the panel I'm going to.",
          vocab:["voltage indicator","proving unit","calibration","insulation tester","arc flash rating"]},
        t0:{ask:"Say the meter reads zero on a circuit you expect to be live. What then?",
          model:"I don't believe it until I've proved the meter again. A meter that reads zero on everything is exactly what a failed meter looks like, and that is how people get killed working on something they were told was dead.",
          vocab:["prove","known source","failed instrument","test dead"]},
        t1:{ask:"If the gear isn't right, do you carry on or stop?",
          model:"Stop. There's usually another set; if there isn't, we wait. Nothing about electrical work is worth doing with an instrument I don't trust.",
          vocab:["out of service","stop work","trust","instrument"]},
        t2:{ask:"How do you stop someone else using it?",
          model:"It comes off the shelf and goes into quarantine with a tag. A tag alone gets ignored when somebody is in a hurry at seven in the morning.",
          vocab:["quarantine","tag","out of service","store"]},
        t3:{ask:"What do you record?",
          model:"The instrument number, what was wrong, the date and my name, and that it's quarantined and been sent for calibration. Enough that the next person can find it and knows not to look for it.",
          vocab:["instrument number","record","calibration","quarantine"]}
      },
      4: {
        open:{ask:"Check the material for this job. What are you looking at?",
          model:"Cable type, size and rating against the drawing and the schedule — not just that it's the right colour. Then glands matched to the cable and to the area classification, terminations and lugs the right size, and the protective device rating for the circuit. If any one of those doesn't match, nothing gets pulled.",
          vocab:["cable size","rating","gland","area classification","termination","protective device"]},
        t0:{ask:"What if the size on site is different from the drawing?",
          model:"Hold it and ask. A bigger cable isn't automatically fine — it changes the gland, the termination and sometimes the enclosure. That's a question for the engineer, not a decision for me on the job.",
          vocab:["hold","engineer","gland","substitution"]},
        t1:{ask:"Why does the area classification matter here?",
          model:"Because in a classified area the equipment and the method have to suit the protection concept. The wrong gland or an unsealed entry turns a certified enclosure into an ordinary box with a label on it.",
          vocab:["classified area","protection concept","certified","sealed","Ex"]},
        t2:{ask:"How do you record what you've actually used?",
          model:"Against the cable schedule — drum number, length, where it went. Because two years from now, someone fault-finding needs to know what's actually in that duct, not what was specified.",
          vocab:["cable schedule","drum number","as-built","record"]},
        t3:{ask:"Anything about the material that changes how you protect yourself?",
          model:"Weight and drums for the pulling, and where the cable is going in — if it's into a live board, the job isn't a material question any more, it's an isolation question.",
          vocab:["manual handling","live board","isolation","pulling"]}
      },
      5: {
        open:{ask:"You've seen something you're not happy with. Talk me through it.",
          model:"There's a panel door open with exposed live terminals and nobody standing at it. The hazard is direct contact and arc flash, and anyone walking past is exposed. I'd secure it straight away, find out who opened it, and stop any work in that area until it's either closed or properly controlled with a barrier and someone attending it.",
          vocab:["live terminals","arc flash","exposed","barrier","attend","secure"]},
        t0:{ask:"How would you raise it with the person who left it open?",
          model:"Directly but not in front of everyone. 'That board's open and live — I've secured it. Were you coming back to it?' Most of the time they were, and got pulled away. Making it a lecture guarantees the next one gets hidden from me.",
          vocab:["raise","direct","secure","respect"]},
        t1:{ask:"What if you're told to carry on and leave it?",
          model:"I wouldn't. Exposed live parts is a stop, not a discussion, and I'd say so plainly and get the supervisor to come and look. If it still isn't agreed, it goes up.",
          vocab:["stop work authority","escalate","exposed","refuse"]},
        t2:{ask:"Who needs to know?",
          model:"The supervisor and safety, and the area operator if it's their plant. And if anyone could have touched it, that's a near miss and it gets reported even though nothing happened.",
          vocab:["supervisor","near miss","report","operator"]},
        t3:{ask:"What's the fix beyond closing the door?",
          model:"Finding out why it was open and unattended. If the job genuinely needs the board open for an hour, then it needs a barrier and an attendant built into the method — not someone's good intentions.",
          vocab:["root cause","method statement","barrier","attendant"]}
      },
      6: {
        open:{ask:"Talk me through how you'd install this circuit.",
          model:"To the installation requirements and the drawing, not to habit. Cable route and support first, then the gland and termination to suit the area, protective device sized for the load and the cable, and earthing and bonding in. Then it gets tested and the results recorded before anything is energised.",
          vocab:["installation requirement","route","gland","protective device","earthing","bonding","test"]},
        t0:{ask:"What would you do if the drawing and the site conditions disagree?",
          model:"Stop and get it resolved. If the route on the drawing runs through something that's now there, I don't invent a new route — the engineer confirms it and the drawing is updated, otherwise the as-built is a fiction.",
          vocab:["route","engineer","as-built","revision"]},
        t1:{ask:"What tests would you do before it goes live?",
          model:"Continuity of the protective conductor, insulation resistance, and polarity — and the earth arrangement verified. The result is a number I record, not a feeling that it's fine.",
          vocab:["continuity","insulation resistance","polarity","earth","record"]},
        t2:{ask:"How would you explain the job to someone who missed the briefing?",
          model:"What we're installing, the route, where the isolation is, and what's still live nearby. That last one is the part that matters most and the part most briefings leave out.",
          vocab:["brief","route","isolation","live","adjacent"]},
        t3:{ask:"Anything in it that changes how you protect yourself?",
          model:"Working next to live equipment changes everything — that's arc-flash PPE and a barrier, or it's a different isolation so the adjacent gear is dead too. The job being small doesn't make the panel less live.",
          vocab:["arc flash","PPE","barrier","isolation","adjacent"]}
      },
      7: {
        open:{ask:"There's a question on this drawing. What would you check before you begin?",
          model:"The single-line diagram against the board itself — which breaker actually feeds this circuit, what else is on it, and whether there's a second supply. Labels lie more often than drawings do, so I confirm by identification rather than by reading the label and trusting it.",
          vocab:["single line diagram","breaker","supply","identify","label"]},
        t0:{ask:"Who do you go to if the drawing doesn't match?",
          model:"The supervisor, and then it gets raised so the drawing is corrected. An out-of-date single line is a trap for whoever is on the next shift, and they won't know to be suspicious of it.",
          vocab:["supervisor","raise","out of date","correct"]},
        t1:{ask:"How do you make sure you've got the right circuit?",
          model:"Prove it. Isolate, then test dead at the point of work, with a meter I've proved. Identification by drawing plus identification by test — one on its own is a guess.",
          vocab:["identify","isolate","test dead","prove","point of work"]},
        t2:{ask:"What if there's a second supply you didn't expect?",
          model:"Then the isolation isn't complete and the job stops until both are isolated and locked. Back-feeds are the classic one — from a UPS, a standby, or a control supply from another board.",
          vocab:["back-feed","second supply","UPS","isolate","complete"]},
        t3:{ask:"And once it's resolved?",
          model:"The drawing gets marked up and sent for revision, and I work from the current version. Not from the copy in my pocket that I've written on.",
          vocab:["mark-up","revision","current","as-built"]}
      },
      8: {
        open:{ask:"You need to work on gear the operators are using. How do you sort that?",
          model:"Through the permit, and face to face with the operator before anything. I'd say exactly what I need dead, for how long, and what it takes out of service for them. They decide when the plant can lose it; I decide it isn't touched until it is isolated and proved.",
          vocab:["permit","operator","isolate","out of service","boundary"]},
        t0:{ask:"What do you need from them?",
          model:"The equipment shut down and made available, the isolation points agreed, and their confirmation that nothing will be re-started while I'm on it. And I want their lock on it as well as mine.",
          vocab:["available","isolation point","lock","re-start","confirm"]},
        t1:{ask:"What do they need from you?",
          model:"A realistic time, and a call when I'm off it rather than them finding out by trying to run it. And to know straight away if I find something that means it's not going back today.",
          vocab:["duration","communicate","restore","inform"]},
        t2:{ask:"What if another trade is working on the same equipment?",
          model:"Then we're on the same permit or the permits reference each other, and everyone's lock is on. Two trades on one machine with one person's isolation is how someone gets caught by the other's re-start.",
          vocab:["multiple lock","permit","coordinate","isolation"]},
        t3:{ask:"And restoring it?",
          model:"Guards and covers back, tools counted out, tests done and recorded, then locks off in order with the operator there. I tell them plainly whether it's fit to run, and I don't say yes to be helpful.",
          vocab:["restore","test","locks off","fit to run","close-out"]}
      },
      9: {
        open:{ask:"A test has failed. What would you report?",
          model:"The circuit, the test, the reading and the value it's judged against — insulation resistance at 0.3 megohms where the requirement is far higher, on the west conveyor motor circuit. It's not energised and it isn't going to be until the cause is found. My first suspicion is water ingress at the gland, but that's a suspicion, not the report.",
          vocab:["insulation resistance","megohm","requirement","energise","ingress"]},
        t0:{ask:"How do you decide whether it's the cable or the equipment?",
          model:"By splitting it — disconnect at the motor and test each part separately. Otherwise you're replacing a cable because a motor winding is wet, which is expensive and doesn't fix it.",
          vocab:["isolate","disconnect","test separately","winding","diagnose"]},
        t1:{ask:"What would you do about the equipment in the meantime?",
          model:"It stays isolated and locked, and it's clearly marked as failed rather than just 'being looked at'. A circuit that failed a test and isn't obviously out of service will get energised by someone.",
          vocab:["isolated","locked","marked","out of service","failed"]},
        t2:{ask:"Who needs to know?",
          model:"The supervisor and operations, because it's their plant that's now short of a motor. And it goes on the defect record with the number, not just in conversation.",
          vocab:["supervisor","operations","defect record","reading"]},
        t3:{ask:"What goes in the record?",
          model:"Circuit identification, the instrument used and its calibration, the test, the reading, the date, and my name. A test result without the instrument and the date can't be relied on by anybody later.",
          vocab:["identification","instrument","calibration","reading","record"]}
      },
      10: {
        open:{ask:"This is a controlled job. Tell me what you need in place before you start.",
          model:"An electrically safe work condition, proved by me. Identify the circuit from the single line, isolate every source including any back-feed, lock and tag each one, and then test dead at the point of work with a voltage indicator I prove before and after. Permit posted, and the arc-flash rating checked against what I'm wearing.",
          vocab:["electrically safe work condition","isolate","back-feed","lock","test dead","proving unit","arc flash"]},
        t0:{ask:"If the permit runs out mid-job, what do you do?",
          model:"Stop and leave it safe. The permit expiring means the conditions it was written against aren't proved any more — somebody may have been told the plant is coming back. It's re-issued before I go on.",
          vocab:["permit","expiry","re-issue","leave safe"]},
        t1:{ask:"What should I be watching while you're working?",
          model:"That nothing is re-energised and that no one removes a lock. If anything changes on the supply side — a standby starting, a bus transfer — I need to hear it immediately, because my isolation may not be an isolation any more.",
          vocab:["re-energise","lock","supply","bus transfer","immediately"]},
        t2:{ask:"Can you ever work on it live?",
          model:"Only if it genuinely can't be dead, and then only with a specific live-work authorisation, a risk assessment for that task, the right PPE and someone with me. 'It's quicker' is not a justification.",
          vocab:["live work","authorisation","risk assessment","PPE","justification"]},
        t3:{ask:"What has to happen before it goes back?",
          model:"Covers and guards back on, tools accounted for, tests done and recorded, then locks removed in order and the operator told. And I say plainly whether it's fit to energise.",
          vocab:["covers","test","record","locks off","energise","fit"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. Maya. To start — tell me about yourself and your electrical experience.",
          supervisor:"Daniel, maintenance. Tell me what you've worked on and what you're authorised for.",
          coworker:"Luis — I'd be on your crew. What kind of electrical work have you done?",
          safety:"Priya, safety. Tell me about your experience, and then I'll ask you about isolation.",
          qa:"Amelia — I check test records. Tell me about your background and how you record results."
        },
        open:{ask:"Tell me about yourself and your electrical experience.",
          model:"Six years as an industrial electrician, mostly plant maintenance and installation on a process site. Motor circuits, switchgear and drives, cable installation and fault-finding, all under permit. What I'd point to is a recurring trip on a conveyor drive that three people had reset — I tested it properly and found insulation breaking down at a gland that was letting water in.",
          vocab:["maintenance","switchgear","drive","fault-finding","insulation","gland"]},
        t0:{ask:"Talk me through safe isolation.",
          model:"Identify the circuit from the single line and by test. Isolate every source, including back-feeds. Lock and tag each point with my own lock. Test dead at the point of work with a voltage indicator I have proved on a known source before and after. Only then is it an electrically safe work condition.",
          vocab:["identify","isolate","back-feed","lock","test dead","prove","safe work condition"]},
        t1:{ask:"Have you ever found an isolation that wasn't complete?",
          model:"Yes — a control supply fed from a different board that wasn't on the single line. I found it on the test dead, not on the drawing. It went back as a drawing correction as well as a job, because the next person wouldn't have been looking for it either.",
          vocab:["control supply","back-feed","test dead","drawing","correct"]},
        t2:{ask:"What's your view on live working?",
          model:"Avoid it. There are jobs where it genuinely can't be dead, and those get a specific authorisation, a risk assessment and PPE for that task. Everything else goes dead, however inconvenient that is on the day.",
          vocab:["live work","authorisation","risk assessment","PPE","de-energised"]},
        t3:{ask:"Where do you want to go from here?",
          model:"High-voltage authorisation and more testing and commissioning. I'd also like to be involved in the arc-flash study work — I use the labels every day and I'd like to understand what sits behind them.",
          vocab:["authorisation","commissioning","arc flash","development"]}
      },
      12: {
        open:{ask:"Last session. Why are you ready to work on this site?",
          model:"Because I prove things rather than assume them. I don't work on anything I haven't isolated and tested dead myself, I record my results, and I say plainly when something isn't fit to energise. That's the standard, and it doesn't move because a shift is running late.",
          vocab:["prove","isolate","test dead","record","fit to energise"]},
        t0:{ask:"What's the strongest thing you bring?",
          model:"Fault-finding that gets to the cause. Anyone can reset a breaker. Finding out why it tripped, with a test result behind it, is what stops it tripping again next week.",
          vocab:["fault-finding","cause","test result","recurrence"]},
        t1:{ask:"Where do you still need to develop?",
          model:"High voltage — I've worked around it, I'm not authorised for it, and I'm not going to pretend otherwise. I want the training and the authorisation properly rather than the exposure informally.",
          vocab:["high voltage","authorised","training","competence"]},
        t2:{ask:"How would you describe your standard to an apprentice?",
          model:"Prove your meter, prove it again after. Your lock is yours and it comes off when you say the job is safe, not when someone wants the plant back. And if you're not sure it's dead, it's live.",
          vocab:["proving unit","personal lock","test dead","assume live"]},
        t3:{ask:"Anything you want to ask us?",
          model:"How the permit system works here and who authorises live work, and whether there's a route to high-voltage authorisation. Those tell me what the job actually is.",
          vocab:["permit","authorisation","live work","high voltage"]}
      }
    },
    hse: {
      1: {
        openings: {
          hr:"Good morning — you must be our new HSE officer. I'm Maya from HR. Tell me a little about yourself and the sites you've covered.",
          supervisor:"Morning. Daniel, I run the crews here. Tell me about your background — and be straight with me, the lads will be.",
          coworker:"You're the new safety officer? Luis. What kind of sites have you been on?",
          safety:"Priya — I'm handing this site over to you. Tell me about your experience first.",
          qa:"Amelia, quality and records. Tell me where you've worked and how you keep your paperwork."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm an HSE officer with six years on construction and industrial sites. Most of it is permit control, risk assessments and incident investigation. The last two years were on a refinery turnaround, so a lot of confined space and hot work, and a lot of talking to crews who were under time pressure.",
          vocab:["permit control","risk assessment","incident investigation","confined space","hot work"]},
        t0:{ask:"What kind of sites and what size of workforce?",
          model:"Up to about two hundred at peak on the turnaround, across maybe eight contractors. Before that, smaller fabrication sites of thirty or forty. The bigger ones are less about knowing everyone and more about the permit system actually working.",
          vocab:["contractor","workforce","turnaround","permit system"]},
        t1:{ask:"How do you want to work with the crews here?",
          model:"Visible and early, not at the end with a clipboard. I'd rather be in the toolbox talk in the morning than writing someone up in the afternoon. If the first time a crew hears from me is a stop-work, I've already failed.",
          vocab:["toolbox talk","visible","stop work","engage"]},
        t2:{ask:"If a supervisor disagrees with you, what happens?",
          model:"We look at it together on the job rather than arguing about it in an office. Most disagreements are about what the control should be, not about whether there's a hazard. If we still can't agree and it's serious, it goes up — but that's the last step, not the first.",
          vocab:["control","hazard","escalate","agree"]},
        t3:{ask:"What do you need from me in the first week?",
          model:"The risk assessments and method statements that are live, the permit register, and half an hour walking the site with someone who knows where the shortcuts are. The paperwork tells me what should happen; the walk tells me what does.",
          vocab:["risk assessment","method statement","permit register","walk the site"]}
      },
      2: {
        open:{ask:"You're handing over to me. What do I need to know?",
          model:"Three permits open — two hot work in the fabrication bay and one confined space on the vessel, which closes at four. Two actions outstanding from yesterday's inspection, both on edge protection. And one crew I want you to watch: they've been quick to start before the permit is signed.",
          vocab:["permit","hot work","confined space","outstanding action","inspection"]},
        t0:{ask:"What about anything that isn't controlled yet?",
          model:"That's the part I'd say first, not last. If something is uncontrolled, it's the headline of the handover, and if I can't leave it controlled I don't leave it — I stay or I stop the work.",
          vocab:["uncontrolled","control","stop work","priority"]},
        t1:{ask:"How do you hand over an open investigation?",
          model:"Facts gathered so far, who's been spoken to, what's still to do, and what's been agreed with the people involved. And clearly separate what's established from what's still a theory, because theories harden fast once they're written down.",
          vocab:["investigation","facts","interview","theory","established"]},
        t2:{ask:"What do you write down?",
          model:"Permit numbers, action numbers, times, names. The conversation is for you; the record is for the person who asks in six months why a control was changed.",
          vocab:["permit number","action","record","traceable"]},
        t3:{ask:"And what do you want back from the shift handing over to you?",
          model:"Open permits, outstanding actions, anything that nearly went wrong even if nothing happened. The near misses are the ones people don't hand over, and they're the most useful thing on the list.",
          vocab:["near miss","open permit","outstanding action","report"]}
      },
      3: {
        openings: {
          supervisor:"You're inspecting the gear this morning. Tell me how you'd go about it.",
          safety:"Priya. Walk me through how you inspect equipment and PPE on a site like this.",
          coworker:"Luis here. You're checking our gear? How does that work?",
          qa:"Amelia. Talk me through your inspection routine and what you record.",
          hr:"Maya from HR, sitting in. Tell me how you'd inspect the site's equipment."
        },
        open:{ask:"You're inspecting the gear this morning. Tell me how you'd go about it.",
          model:"I'd sample rather than pretend to check everything: lifting gear and its certificates, harnesses and lanyards for damage and date, and the gas monitors for calibration. Then the things people actually touch every day — ladders, leads, grinders. What I find goes on a numbered action with an owner and a date, not a note in my book.",
          vocab:["lifting gear","certificate","harness","gas monitor","calibration","action"]},
        t0:{ask:"Say you find a harness that's out of date. What do you do?",
          model:"It comes out of service there and then — I take it, not tag it and hope. Then I find out how many more are like it, because one out-of-date harness is a mistake and five is a system problem.",
          vocab:["out of service","quarantine","systemic","inspection regime"]},
        t1:{ask:"How do you raise it without making the crew defensive?",
          model:"I take it up with the supervisor and the store, not with the man wearing it. He didn't set the inspection regime. If I make it about him, the next time someone finds a problem they'll put it back on the rack.",
          vocab:["supervisor","blame","report","culture"]},
        t2:{ask:"What if the same thing turns up again next month?",
          model:"Then the corrective action didn't work and that's what I write — not the same finding again. Repeating a finding without changing anything is how a register becomes wallpaper.",
          vocab:["corrective action","recurrence","root cause","register"]},
        t3:{ask:"What goes in the record?",
          model:"What I checked, what I sampled, what I found, the action number, the owner and the date. And the ones I checked that were fine, because an inspection that only records failures can't show a trend.",
          vocab:["record","sample","action","owner","trend"]}
      },
      4: {
        open:{ask:"There's a method statement for tomorrow's job. How would you review it?",
          model:"I read it against the risk assessment rather than on its own. Do the controls in the method actually match the hazards identified? Is the sequence realistic? And does it say who does what — because 'ensure the area is safe' names nobody and controls nothing.",
          vocab:["method statement","risk assessment","control","sequence","responsible person"]},
        t0:{ask:"What's the most common problem you find in one?",
          model:"Generic controls copied from another job. PPE listed as the control for a hazard that should be engineered out, and no mention of the thing that's actually specific about this job — the access, or the other crew working below.",
          vocab:["generic","hierarchy of control","engineered","specific"]},
        t1:{ask:"What would you do if the crew has already started?",
          model:"If the gap is serious, I stop it and we fix the document before they go on. If it's a wording problem rather than a control problem, I let them work and get it corrected — but I don't sign something I think is wrong because the job has begun.",
          vocab:["stop work","gap","control","sign off"]},
        t2:{ask:"How do you make sure the crew actually knows what's in it?",
          model:"I ask them, in their words, at the toolbox talk. Signatures on a briefing sheet prove attendance, not understanding. If two of them can tell me the main control, it's landed.",
          vocab:["toolbox talk","briefing","understanding","signature"]},
        t3:{ask:"And if the job changes on the day?",
          model:"Then the method statement changes before the work does. A changed job on an unchanged document is the most common way a safe job becomes an incident.",
          vocab:["change","review","reissue","brief again"]}
      },
      5: {
        open:{ask:"You've seen something you're not happy with. Talk me through it.",
          model:"There's an unguarded opening in the deck and a crew working next to it. The hazard is the opening; the risk is a fall to the level below. The control needs to be a hard barrier, not tape — tape tells you where the edge is, it doesn't stop you. I'd stop that work, get the barrier in, and check it's still there after the break.",
          vocab:["hazard","risk","control","barrier","verify"]},
        t0:{ask:"How do you stop work without turning it into a fight?",
          model:"Firm about the control, easy about the person. 'Lads, hold up — I need a barrier round that before you carry on.' I explain it once, I don't lecture, and I stay and help sort it rather than walking off having stopped them.",
          vocab:["stop work","control","explain","support"]},
        t1:{ask:"What if the supervisor says there's no time?",
          model:"Then I'd say what the consequence is, not what the rule is. 'If someone steps back, they go through that hole.' And the answer is still no until it's barriered. I'd rather have that conversation now than the other one later.",
          vocab:["consequence","stop work authority","escalate","hold"]},
        t2:{ask:"Where does PPE come in your answer?",
          model:"Last. The hierarchy is eliminate, substitute, engineer, administrate, then PPE. If my first answer to a hazard is a harness, I've skipped four better controls and put the whole risk on one person remembering to clip on.",
          vocab:["hierarchy of control","eliminate","engineer","administrative","PPE"]},
        t3:{ask:"And how do you know the control worked?",
          model:"I go back and look. A control I never verify is a control I hope is there. On something like an opening, I'd check it again after every break, because that's when barriers get moved.",
          vocab:["verify","check","monitor","assurance"]}
      },
      6: {
        open:{ask:"Brief this crew on the control for today's job.",
          model:"Right — hot work in the bay this morning. The risk is ignition of what's around you, so before the first spark: area cleared to ten metres or screened, drains covered, extinguisher and a named fire watch, and the permit on the board. The fire watch stays for a full hour after you finish. Who's on fire watch today?",
          vocab:["hot work","ignition","screen","fire watch","permit"]},
        t0:{ask:"How do you check they've understood rather than just heard you?",
          model:"I ask one of them to tell me back the bit that matters — how long the fire watch stays after the work stops. If the answer is 'until we pack up', we go round again.",
          vocab:["read back","understanding","brief","check"]},
        t1:{ask:"What if someone raises an objection in the talk?",
          model:"Good — that's the point of doing it in a group. I'd rather hear 'that drain's not covered' from a welder than find it myself at eleven. I'd thank them and fix it before anyone starts.",
          vocab:["objection","raise","engage","fix"]},
        t2:{ask:"How do you keep a toolbox talk from becoming a ritual?",
          model:"Make it about today's job, not about safety in general, and keep it short. Five minutes on the specific hazard beats fifteen minutes of reading a policy that nobody hears.",
          vocab:["specific","relevant","short","engagement"]},
        t3:{ask:"What do you record?",
          model:"Who attended, the topic, and anything raised in it with what was done. The thing raised is the useful part of the record — it shows the talk changed something.",
          vocab:["attendance","topic","action","record"]}
      },
      7: {
        open:{ask:"There's a gap in this risk assessment. What would you do?",
          model:"I'd name the gap precisely — the assessment covers working at height but says nothing about the crew working below, and there's no exclusion zone in it. Then I'd get it in front of whoever wrote it and have it revised before the job starts, not annotated on the day by me.",
          vocab:["risk assessment","gap","exclusion zone","revise","author"]},
        t0:{ask:"Can you just add it yourself?",
          model:"I can raise it and I can stop the job, but the assessment belongs to the person competent for that work. If I quietly patch other people's assessments, nobody learns to write a good one and the document stops meaning anything.",
          vocab:["ownership","competent person","revise","raise"]},
        t1:{ask:"What if the job has to go ahead today?",
          model:"Then we control the gap now — exclusion zone in, and someone accountable for it — and the document is corrected properly. Controlling it and correcting it are both needed; doing only one is where sites get caught.",
          vocab:["interim control","exclusion zone","accountable","correct"]},
        t2:{ask:"How do you phrase it so it gets fixed?",
          model:"Specifically. Not 'this RA is weak' — 'there is no control for the crew working underneath; we need an exclusion zone and a sign-off for who maintains it.' A named gap gets closed; a general complaint gets defended.",
          vocab:["specific","named","control","close out"]},
        t3:{ask:"And once it's revised?",
          model:"It gets re-briefed to the crew. A revised assessment that only the author has read has changed a file, not a job.",
          vocab:["revision","brief","communicate","crew"]}
      },
      8: {
        open:{ask:"Two crews want to work in the same area. How do you handle it?",
          model:"I'd look at both permits together before either starts. Hot work above and a paint job below is an ignition source over a flammable — separately fine, together a fire. Either we separate them in time, or we separate them in space, or one of them waits.",
          vocab:["simultaneous operations","permit","ignition source","separate","sequence"]},
        t0:{ask:"Who makes that call?",
          model:"The permit issuer, with the two supervisors in the room. My job is to make sure the conversation happens before both crews are already on the job with their gear out.",
          vocab:["permit issuer","coordinate","supervisor","before"]},
        t1:{ask:"How do you get two supervisors to agree?",
          model:"By making it about sequence rather than about priority. Nobody's job is cancelled — one goes first. That's a much easier conversation than deciding whose work matters more.",
          vocab:["sequence","priority","agree","negotiate"]},
        t2:{ask:"What do you put in place while both are live?",
          model:"A clear boundary, someone who owns it, and both crews briefed on the other's presence. And I'd go back and look, because boundaries get quietly moved when a job runs long.",
          vocab:["boundary","brief","monitor","verify"]},
        t3:{ask:"And if one of them starts anyway?",
          model:"I stop it. Not as a punishment — because the other crew's control depended on them not being there. Then it goes back through the permit conversation properly.",
          vocab:["stop work","permit","control","re-issue"]}
      },
      9: {
        open:{ask:"There's been a near miss. Tell me how you'd handle it.",
          model:"Make the area safe first, then get the facts while they're fresh — what was being done, what happened, who was there. I'd talk to the people involved without blame, because the moment it feels like a disciplinary I stop learning anything. Then root cause, corrective action, owner and date, and it gets shared.",
          vocab:["near miss","facts","blame","root cause","corrective action","share"]},
        t0:{ask:"How do you get to root cause rather than stopping at 'they weren't careful'?",
          model:"By asking why until the answers stop being about the person. He didn't clip on — why? The anchor point was twenty metres away. Why? It wasn't designed into the access. That's a cause you can fix; 'be more careful' isn't.",
          vocab:["root cause","why","systemic","design"]},
        t1:{ask:"What if the person involved is worried about being blamed?",
          model:"I'd say plainly at the start that I'm looking at how it happened, not who to blame, and then I'd behave that way. The first time a near-miss report gets someone in trouble is the last honest near-miss report you get.",
          vocab:["blame-free","reporting culture","trust","investigation"]},
        t2:{ask:"How do you make the corrective action stick?",
          model:"One owner, one date, and something you can actually see afterwards. 'Improve awareness' cannot be checked. 'Fit a second anchor point at the east end by Friday, owner Daniel' can.",
          vocab:["corrective action","owner","date","verifiable","close out"]},
        t3:{ask:"Who hears about it?",
          model:"Everyone who could have the same near miss — including the other contractors. A lesson kept inside one crew is a lesson half-learned.",
          vocab:["share","lessons learned","contractor","communicate"]}
      },
      10: {
        open:{ask:"There's a confined space entry today. What has to be in place?",
          model:"Before anyone crosses: the space isolated and the energy locked, blinds in where the procedure says, the atmosphere tested for oxygen, flammable and toxic, and tested again at intervals — not once at eight in the morning. A permit posted and current, an attendant outside who doesn't leave, and a rescue arrangement that exists in practice, not on paper.",
          vocab:["isolation","blind","gas test","oxygen","permit","attendant","rescue"]},
        t0:{ask:"What does the attendant actually do?",
          model:"Stays there. Keeps the entry log, keeps talking to the person inside, and starts the rescue — by calling it, not by going in. The most common way you get two casualties instead of one is an attendant who goes in after the first.",
          vocab:["attendant","entry log","communication","rescue","never enter"]},
        t1:{ask:"The gas test was fine at the start. Is that enough?",
          model:"No. Conditions change — hot work, a coating, something draining back. It gets re-tested at intervals and continuously monitored where the risk calls for it. A single reading proves a moment, not a shift.",
          vocab:["re-test","continuous monitoring","interval","atmosphere"]},
        t2:{ask:"What would make you stop the entry?",
          model:"A change in the gas reading, the permit expiring, the attendant leaving, communication lost, or anything happening upstream that could reach the isolation. Any one of those and they come out first and we discuss it after.",
          vocab:["stop","alarm","permit expiry","isolation","evacuate"]},
        t3:{ask:"And closing it out?",
          model:"Everyone out and counted, tools out, blinds removed and recorded, the permit signed off, and the space left secured. Counted — because the count is what catches the person who went back in for a torch.",
          vocab:["close-out","headcount","blind register","permit sign-off","secure"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. Maya. To start — tell me about yourself and your HSE experience.",
          supervisor:"Daniel, operations. Tell me about your background — and how you'd get on with crews who think safety slows them down.",
          coworker:"Luis. I'd be one of the supervisors you work with. What's your experience?",
          safety:"Priya, HSE manager. Tell me about your experience, then I'll take you through some scenarios.",
          qa:"Amelia, quality. Tell me about your background and how you handle records and investigations."
        },
        open:{ask:"Tell me about yourself and your HSE experience.",
          model:"Six years in HSE across construction and industrial sites. Permit control, risk assessment and investigation are the core of it, and the last two years were refinery turnarounds with a lot of confined space and hot work. What I'd point to is cutting repeat findings on lifting gear by changing the inspection regime rather than by writing people up.",
          vocab:["permit control","risk assessment","investigation","turnaround","corrective action"]},
        t0:{ask:"Talk me through how you assess a risk.",
          model:"Hazard first — what can cause harm. Then who's harmed and how badly, and how likely. Then the control, working down the hierarchy rather than jumping to PPE. Then verification: how do I know the control is still there next week. It's the last step people skip.",
          vocab:["hazard","risk","hierarchy of control","verification","review"]},
        t1:{ask:"Tell me about a time you stopped work.",
          model:"An unguarded deck opening with a crew beside it. I stopped them, got a hard barrier in, and stayed while it went up. The supervisor wasn't pleased in the moment. It went back to the design of the access rather than to the crew, and the same opening got a permanent guard.",
          vocab:["stop work","barrier","escalate","corrective action"]},
        t2:{ask:"How do you handle a crew that sees you as the obstacle?",
          model:"By being there early and being useful, not just at the point of refusal. If I only appear to say no, I'm scenery. If I've helped them get a permit through quickly twice, the one time I stop them they listen.",
          vocab:["engage","credibility","toolbox talk","relationship"]},
        t3:{ask:"Where do you want to take your career?",
          model:"Towards HSE manager, and I want to be stronger on process safety specifically — the management-of-change side rather than only occupational safety. On a plant, that's where the big ones come from.",
          vocab:["process safety","management of change","occupational safety","development"]}
      },
      12: {
        open:{ask:"Last session. Why are you ready to run safety on this site?",
          model:"Because I work the system rather than police it. I get the risk assessment right before the job, I make the permit mean something, and when something goes wrong I look for the cause rather than the culprit. The crews will tell you I turn up before the problem, not after it.",
          vocab:["risk assessment","permit","root cause","culture","prevention"]},
        t0:{ask:"What's the strongest thing you bring?",
          model:"Making controls verifiable. Anyone can write 'ensure the area is safe'. I write who does it, by when, and what it looks like when it's done — so it can actually be checked.",
          vocab:["verifiable","control","owner","assurance"]},
        t1:{ask:"Where do you still need to develop?",
          model:"Process safety on operating plant — hazard studies and management of change. I'm strong on occupational safety and I don't want to mistake that for the whole job.",
          vocab:["process safety","hazard study","management of change","development"]},
        t2:{ask:"How would you describe your standard to a new starter?",
          model:"If you can't say what the control is, you haven't got one. If it isn't verified, assume it's gone. And if you report something, I will never make you regret it.",
          vocab:["control","verify","reporting culture","stop work"]},
        t3:{ask:"Anything you want to ask us?",
          model:"How near misses are reported here and what happens to them, and whether HSE sits in the management-of-change reviews. Those two tell me more about a site's safety than any statistic.",
          vocab:["near miss","reporting","management of change","culture"]}
      }
    },
    ndt: {
      1: {
        openings: {
          hr:"Good morning — you're the new NDT technician. I'm Maya from HR. Tell me a little about yourself and your methods.",
          supervisor:"Morning. Daniel, I run the inspection contract. Tell me what methods you hold and at what level.",
          coworker:"You're the new tech? Luis. What methods do you shoot?",
          safety:"Morning. Priya, safety. Tell me about your experience — and we'll talk about your source later.",
          qa:"Amelia, quality. Tell me about your certification and the procedures you've worked to."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm an NDT technician with six years, certified Level 2 in ultrasonic, magnetic particle and penetrant. Mostly weld inspection on pressure piping and structural work, examining to the client's written procedure. The last two years were on turnarounds, so a lot of volumetric examination under time pressure.",
          vocab:["Level 2","ultrasonic","magnetic particle","penetrant","written procedure","volumetric"]},
        t0:{ask:"Which methods, and what level are you certified to?",
          model:"Level 2 in UT, MT and PT. I'm not certified for radiography, so I don't interpret film — I'd work with an RT technician rather than pretend otherwise. My certificates are current and I can produce them.",
          vocab:["Level 2","UT","MT","PT","radiography","certificate","current"]},
        t1:{ask:"Before you examine anything here — how do you work safely?",
          model:"My own method is the hazard as much as the plant is. Penetrant and developer are chemicals with ventilation requirements, MT means electrical safety and sometimes prods, and if there's radiography anywhere near, I'm outside the barrier. Plus the usual: permit, access, and what's live around me.",
          vocab:["chemical","ventilation","barrier","radiography","permit","access"]},
        t2:{ask:"If you're unsure about an indication, who do you go to?",
          model:"The Level 3 who owns the procedure. I don't quietly decide a borderline indication is acceptable because it would be inconvenient — that decision belongs to someone with the authority for it.",
          vocab:["Level 3","indication","acceptance","authority","procedure"]},
        t3:{ask:"Where do you want to be in a couple of years?",
          model:"Level 3 in ultrasonic, and I'd like to get into phased array properly rather than having seen it. I'd also take the radiography certification if the work is there.",
          vocab:["Level 3","phased array","certification","radiography"]}
      },
      2: {
        open:{ask:"You're handing over to me. What do I need to know?",
          model:"Twelve joints examined on the north spool run, eight accepted, three still to shoot, and one rejectable — a linear indication on joint 42 that's already been reported and marked. The set is calibrated on block A and the calibration is logged, so you can carry on with it. Sensitivity was checked at ten this morning.",
          vocab:["joint","accepted","rejectable","indication","calibration","sensitivity"]},
        t0:{ask:"What about the one you rejected?",
          model:"Reported, joint marked, and the fabrication supervisor told. It's waiting on excavation. It needs re-examining after repair, and that re-examination goes on a new report, not as a correction to the old one.",
          vocab:["reject","excavation","re-examine","report","repair"]},
        t1:{ask:"Can I use your calibration?",
          model:"Only if you check it yourself first. Calibration carries across a shift on paper, but if the set has moved or the temperature has changed I'd rather you spent two minutes than inherited my settings blind.",
          vocab:["calibration","verify","reference block","settings","check"]},
        t2:{ask:"What do you write down?",
          model:"Joint numbers, what was examined, the result against the criterion, the equipment and block used, and the time. The report has to let someone repeat what I did — that's the whole point of it.",
          vocab:["joint number","result","criterion","equipment","reference block","repeatable"]},
        t3:{ask:"And what do you want from the shift before yours?",
          model:"What's examined, what's outstanding, anything rejected and where it is, and whether the procedure or the extent has changed. A changed extent that nobody mentions means the wrong joints get shot.",
          vocab:["outstanding","rejected","extent","procedure","change"]}
      },
      3: {
        openings: {
          supervisor:"That set's yours today. Tell me how you'd get it ready.",
          safety:"Priya. Before you start — how do you set up and check your equipment?",
          coworker:"Luis here. How do you calibrate before a scan?",
          qa:"Amelia. Talk me through your calibration and how you evidence it.",
          hr:"Maya from HR, sitting in. Tell me how you check your equipment."
        },
        open:{ask:"That set's yours today. Tell me how you'd get it ready.",
          model:"Cables and probe first for damage, then calibrate on the reference block for the range and sensitivity the procedure calls for, with couplant I'll actually use. I check the calibration is in date on the set and the block is the identified one, not just a block. Then I verify sensitivity again during the shift and at the end.",
          vocab:["probe","reference block","range","sensitivity","couplant","calibration"]},
        t0:{ask:"Why does the block have to be the identified one?",
          model:"Because the whole examination is relative to it. An unidentified block with an unknown reflector size makes every reading I take unverifiable, and the report becomes an opinion rather than a measurement.",
          vocab:["identified","reflector","traceable","measurement","verifiable"]},
        t1:{ask:"What if the equipment's calibration has expired?",
          model:"It doesn't get used. A set out of calibration produces numbers that look exactly like good numbers, which is worse than a set that obviously doesn't work.",
          vocab:["calibration","expired","out of service","traceable"]},
        t2:{ask:"How do you stop someone else using it?",
          model:"It comes out of the flight case into quarantine with a tag and the calibration due date on it, and the supervisor is told. Not left in the case for the next person to pick up.",
          vocab:["quarantine","tag","due date","out of service"]},
        t3:{ask:"What goes in the record?",
          model:"Equipment serial, probe, block, the settings, the time of the calibration check, and the sensitivity verification at the end. The end-of-shift check is what tells you the results in between are good.",
          vocab:["serial","probe","settings","verification","record"]}
      },
      4: {
        open:{ask:"Before you examine this weld — what are you checking?",
          model:"Surface condition first: spatter, scale and weld ripple will hide an indication or give me a false one. Then that the material and thickness match what the procedure was written for, and that the joint is the one I've been asked to examine. And the weld needs to be at the right temperature and time since welding.",
          vocab:["surface condition","spatter","scale","thickness","procedure","delay time"]},
        t0:{ask:"What if the surface isn't good enough?",
          model:"It goes back for preparation. I don't examine a surface I can't get a reliable result from and then write 'accepted' — that's a worse outcome than not examining it, because now someone believes it's been checked.",
          vocab:["preparation","grind","reliable","accepted","false"]},
        t1:{ask:"Why does time since welding matter?",
          model:"Some cracking doesn't appear straight away, so the procedure sets a delay before examination on certain materials. Shooting it early because the schedule is tight means you can miss the thing you were looking for.",
          vocab:["delay","cracking","hydrogen","procedure","material"]},
        t2:{ask:"What if the material isn't what the procedure covers?",
          model:"Then the procedure doesn't apply and I stop. A procedure written for carbon steel doesn't transfer to a different material because the geometry looks the same.",
          vocab:["material","procedure","scope","hold","Level 3"]},
        t3:{ask:"What do you record about the condition?",
          model:"Surface condition as found, any preparation done, the material and thickness, and the time since welding. It's the context that makes the result mean something.",
          vocab:["as found","preparation","thickness","context","record"]}
      },
      5: {
        open:{ask:"You've seen something you're not happy with. Talk me through it.",
          model:"A fitter has started grinding inside my exclusion zone while I'm shooting. The hazard is him inside a controlled area and me with a live examination. I'd stop both jobs, get him out, and then find out how he came to be in there — because the barrier clearly didn't tell him anything.",
          vocab:["exclusion zone","controlled area","barrier","stop","hazard"]},
        t0:{ask:"How would you raise it with him?",
          model:"Get him out first, talk after. And not as a telling-off — he probably walked through a gap in a barrier that I put up. The fix is the barrier and the signage, not his attitude.",
          vocab:["remove","barrier","signage","fix","blame"]},
        t1:{ask:"What if the supervisor says the schedule can't take the stop?",
          model:"Then we sequence it — my examination or his grinding, not both. I'm not shooting with someone inside the boundary, and the answer to a schedule problem isn't to shrink the controlled area.",
          vocab:["sequence","boundary","schedule","stop work","controlled area"]},
        t2:{ask:"What hazards does your own work create?",
          model:"Depends on the method. Radiography is a controlled area and a source. Penetrant and developer are chemicals and need ventilation, especially in a vessel. MT can be an ignition source with prods. I brief the people around me rather than assuming they know.",
          vocab:["source","controlled area","ventilation","ignition","brief"]},
        t3:{ask:"And afterwards?",
          model:"It gets reported as a near miss even though nobody was hurt. The next person who walks through that gap might do it while a source is exposed.",
          vocab:["near miss","report","barrier","corrective action"]}
      },
      6: {
        open:{ask:"Talk me through the procedure you're examining to.",
          model:"It's the client's written ultrasonic procedure for this contract, and it names the technique, the probe angles, the reference block, the sensitivity and the scanning pattern. I examine to that, not to the way I learned it. If the procedure doesn't cover what's in front of me, I stop and it goes to Level 3.",
          vocab:["written procedure","technique","probe angle","reference block","sensitivity","scanning"]},
        t0:{ask:"What would you do if the procedure and the drawing disagree?",
          model:"Hold and ask. The two need reconciling by the people who own them. Picking whichever is easier is how a joint gets examined to the wrong extent and signed off.",
          vocab:["hold","reconcile","extent","Level 3","drawing"]},
        t1:{ask:"Can you change the technique if the access is difficult?",
          model:"Not on my own. A technique change is a procedure change and it needs Level 3 approval. Otherwise the report says one thing was done and something else was.",
          vocab:["technique","procedure change","Level 3","approval","report"]},
        t2:{ask:"How would you explain the examination to the fabrication supervisor?",
          model:"Which joints, what method, how long, and what I need from him — access, surface preparation, and the area kept clear. In his terms, not in mine: he needs to know what it costs him in time and space.",
          vocab:["extent","method","access","preparation","clear"]},
        t3:{ask:"Anything in it that changes how you protect yourself?",
          model:"Access mostly — scaffold, confined space if it's inside a vessel, and ventilation for penetrant. And the time in position: a lot of NDT is awkward postures for long stretches, which is its own injury.",
          vocab:["access","scaffold","confined space","ventilation","posture"]}
      },
      7: {
        open:{ask:"There's a question on the drawing. What do you check before starting?",
          model:"Which joints are in scope and to what extent — ten per cent or one hundred, and chosen how. Then the weld detail: a single-vee butt and a set-on branch need different techniques. If the drawing doesn't say the extent, I don't guess it, because the extent is the contract.",
          vocab:["extent","scope","weld detail","butt","branch","technique"]},
        t0:{ask:"Who resolves it?",
          model:"The client's inspection engineer or the Level 3, depending on whether it's a contract question or a technical one. Not the fabrication supervisor, who has an interest in the answer.",
          vocab:["inspection engineer","Level 3","contract","independent"]},
        t1:{ask:"How specific do you need to be when you ask?",
          model:"Joint number, line number, and exactly what's ambiguous. 'The drawing's unclear' costs another day; 'joint 42 on line 6-P-104 doesn't state the extent for the set-on branch' gets an answer the same morning.",
          vocab:["joint number","line number","ambiguous","specific"]},
        t2:{ask:"What do you do in the meantime?",
          model:"Carry on with the joints that are clear and leave that one. I don't examine it 'provisionally' — a report with a provisional extent on it will be read as a finished one.",
          vocab:["hold","provisional","report","extent"]},
        t3:{ask:"And once it's resolved?",
          model:"I work to the revised instruction and the report references it. So anyone reading the report later can see why that joint was examined the way it was.",
          vocab:["revision","instruction","reference","traceable"]}
      },
      8: {
        open:{ask:"You need access to joints other trades are working around. How do you sort it?",
          model:"Agree it in the morning rather than at the joint. I need scaffold in place, the surface prepared, the area clear for my exclusion zone, and a window when nobody is grinding beside me. In exchange I tell them exactly which joints and how long, so they can plan round me.",
          vocab:["access","scaffold","preparation","exclusion zone","window","sequence"]},
        t0:{ask:"What do you need from them?",
          model:"Surface preparation done to the standard, not 'it's near enough'. And notice if a joint has been re-welded, because that changes what I'm examining and when I can examine it.",
          vocab:["preparation","re-weld","notice","delay time"]},
        t1:{ask:"What do they need from you?",
          model:"Speed and honesty. Which joints today, a realistic time, and a result the same day rather than three days later when they've already moved on. And a clear answer — accepted or rejected, not 'probably fine'.",
          vocab:["result","turnaround","clear","accept","reject"]},
        t2:{ask:"What if there's radiography on the job?",
          model:"Then everyone clears the controlled area, which is a much bigger conversation and usually a night shift. That gets planned days ahead, not agreed at the barrier.",
          vocab:["radiography","controlled area","clear","night shift","plan"]},
        t3:{ask:"And if they pressure you for a pass?",
          model:"The result is the result. I'd tell them what I found and what it means for their schedule, and I'd help them plan the repair — but the acceptance criterion isn't negotiable and being unpopular for an afternoon is the job.",
          vocab:["acceptance criteria","independent","pressure","repair","integrity"]}
      },
      9: {
        open:{ask:"You've found something. Tell me what you'd report.",
          model:"A linear indication on joint 42, 40 mm from the start of the weld, 12 mm long, with the amplitude and depth recorded. Against the acceptance criteria in the procedure that is rejectable. I've marked the joint, told the fabrication supervisor, and it needs excavation and re-examination after repair.",
          vocab:["linear indication","location","length","amplitude","acceptance criteria","rejectable","re-examine"]},
        t0:{ask:"How do you describe it without over-claiming?",
          model:"I report what I measured — type of indication, position, length, amplitude — and whether it meets the criterion. Calling it a crack when I've only got an ultrasonic response is over-claiming. The evaluation is against the criterion; the diagnosis usually needs more than one method.",
          vocab:["indication","measure","evaluate","criterion","over-claim"]},
        t1:{ask:"What if it's borderline?",
          model:"It goes to Level 3 with the data, not to my judgement on the day. Borderline is exactly where people get talked into an acceptance, and the way to avoid that is to make it someone else's decision with the numbers in front of them.",
          vocab:["borderline","Level 3","data","decision","record"]},
        t2:{ask:"What happens to the joint in the meantime?",
          model:"Marked and clearly identified as rejected so nobody buries it behind insulation or paint. A rejected joint that gets coated is a joint that quietly becomes accepted.",
          vocab:["mark","identify","reject","coating","quarantine"]},
        t3:{ask:"And the re-examination after repair?",
          model:"Full re-examination of the repaired area and enough either side of it, on a new report referencing the original. The repair is a new weld and it's examined as one.",
          vocab:["re-examination","repair","report","reference","extent"]}
      },
      10: {
        open:{ask:"You're setting up a controlled area. What has to be in place?",
          model:"The boundary established and measured, not paced out — barriers, signs and lights all round, and every access point covered. Everyone inside cleared out and the area checked by walking it. Monitoring equipment on me and working, and the permit in place. And whoever might walk in from the other side briefed before, not after.",
          vocab:["boundary","barrier","signage","access point","monitor","permit","clear"]},
        t0:{ask:"If the permit runs out mid-job, what do you do?",
          model:"Stop and make safe. The permit is what tells everyone else on the site that the area is controlled — when it expires, that assurance has expired with it.",
          vocab:["permit","expiry","make safe","re-issue"]},
        t1:{ask:"What should the site be watching while you work?",
          model:"That nobody crosses the boundary, from any direction including above and below. The floor above is the one people forget — a barrier at your level does nothing for someone on the grating overhead.",
          vocab:["boundary","above","below","grating","access"]},
        t2:{ask:"What would make you stop?",
          model:"Anyone inside the boundary, a monitor alarming or failing, a barrier down, or losing sight of an access point. Any one of those and the job stops first and is discussed after.",
          vocab:["stop","alarm","monitor","barrier","access"]},
        t3:{ask:"And closing it out?",
          model:"Make safe and confirm it, monitor to prove it, then barriers down, permit closed, and the area handed back to whoever owns it — clearly, so they know they can work there again.",
          vocab:["make safe","monitor","confirm","permit close-out","hand back"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. Maya. To start — tell me about yourself and your NDT experience.",
          supervisor:"Daniel, inspection. Tell me your methods and your levels, and what you've mostly examined.",
          coworker:"Luis — I'd be the other tech. What do you shoot, and where have you worked?",
          safety:"Priya, safety. Tell me about your experience, and then about how you control your own hazards.",
          qa:"Amelia, quality. Tell me about your certification and how you write a report."
        },
        open:{ask:"Tell me about yourself and your NDT experience.",
          model:"Six years, Level 2 in ultrasonic, magnetic particle and penetrant. Mostly weld examination on pressure piping and structural steel, working to client written procedures on turnarounds and fabrication contracts. What I'd point to is a run of rejects that turned out to be one welder's technique — I reported the pattern, not just the joints, and it got fixed at source.",
          vocab:["Level 2","ultrasonic","weld examination","written procedure","reject","pattern"]},
        t0:{ask:"What are you actually certified to do?",
          model:"Level 2 UT, MT and PT — so I can set up, examine, evaluate against the criteria and report, within the scope of the written procedure. I'm not Level 3, so I don't approve procedures or make the call on a borderline indication. And I'm not certified in radiography.",
          vocab:["Level 2","scope","evaluate","Level 3","approve","radiography"]},
        t1:{ask:"Talk me through how you'd examine a butt weld.",
          model:"Check the procedure and the extent, check surface and material, calibrate on the identified reference block for range and sensitivity, scan to the pattern the procedure calls for from both sides where access allows, evaluate anything above the recording level against the criteria, then verify sensitivity again before I write it up.",
          vocab:["extent","calibrate","reference block","scan pattern","recording level","verify"]},
        t2:{ask:"Have you ever been pressured over a result?",
          model:"Yes — a rejectable indication late on a Friday with a shipment due. I reported it as I found it and took it to the Level 3. It cost them the weekend. The alternative is a report that isn't worth the paper, and then nobody's report is.",
          vocab:["reject","pressure","Level 3","independent","integrity"]},
        t3:{ask:"Where do you want to take it?",
          model:"Level 3 in ultrasonic, and phased array properly rather than having watched it. Longer term I'd like to be writing procedures, because that's where the quality of the examination is actually decided.",
          vocab:["Level 3","phased array","procedure","development"]}
      },
      12: {
        open:{ask:"Last session. Why are you ready for this work?",
          model:"Because my reports can be relied on. I examine to the written procedure, I calibrate and verify, I report what I measured against the criterion, and I don't move on a result because of a schedule. That's the only thing an inspection contract is buying.",
          vocab:["written procedure","calibrate","verify","criterion","report","independent"]},
        t0:{ask:"What's the strongest thing you bring?",
          model:"Reports that someone else could repeat. Equipment, block, settings, technique, what I found, where. Six months later that report still means something, which is the difference between inspection and a signature.",
          vocab:["repeatable","record","traceable","evidence"]},
        t1:{ask:"Where do you still need to develop?",
          model:"Radiography and phased array. I've worked alongside both and I'm not going to claim more than that. I'd want the certification rather than the familiarity.",
          vocab:["radiography","phased array","certification","competence"]},
        t2:{ask:"How would you describe your standard to a trainee?",
          model:"Calibrate before, verify after, and never write 'accepted' on something you couldn't properly examine. If the surface is wrong or the access is wrong, say so — an honest 'not examined' is worth more than a confident pass.",
          vocab:["calibrate","verify","accepted","not examined","honest"]},
        t3:{ask:"Anything you want to ask us?",
          model:"Who the Level 3 is and how available they are, and whether the client's procedures are current. Those two decide whether the job can be done properly or only quickly.",
          vocab:["Level 3","procedure","current","support"]}
      }
    },
    process: {
      1: {
        openings: {
          hr:"Good morning — you're joining the process team. I'm Maya from HR. Tell me a little about yourself and the units you've worked on.",
          supervisor:"Morning. Daniel, operations. Tell me about your background — and be aware my shift teams will test whether you know the plant or the spreadsheet.",
          coworker:"You're the new process engineer? Luis, I'm a supervisor here. What have you worked on?",
          safety:"Morning. Priya, HSE. Tell me about your experience, and we'll come to hazard studies after.",
          qa:"Amelia, technical records. Tell me about your background and what you've worked on."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm a process engineer with six years on operating refineries. Day-to-day support for two units, troubleshooting, and the technical side of turnaround planning. I've been a scribe and then a participant on hazard studies, and I've taken changes through the management-of-change process from proposal to close-out.",
          vocab:["operating plant","troubleshooting","turnaround","hazard study","management of change"]},
        t0:{ask:"Which units, and what sort of problems did you work on?",
          model:"Crude distillation and a hydrotreater. Mostly performance problems — fouling, off-spec product, and a recurring pressure drop that turned out to be a distributor. Less design, more finding out why the plant isn't doing what the design says it should.",
          vocab:["distillation","hydrotreater","fouling","off-spec","pressure drop","performance"]},
        t1:{ask:"How do you work with the shift teams?",
          model:"I go and ask them first. They've usually seen the problem for weeks before it reaches me, and the trend data will show me what happened but not what they did. If I turn up with a conclusion, I get their politeness and none of their information.",
          vocab:["shift team","trend","observation","listen","operations"]},
        t2:{ask:"If you're not sure about something, what do you do?",
          model:"Say so and go and look. A process engineer who guesses out loud on a live plant is dangerous, because people act on it. I'd rather say 'I don't know yet, I'll have the numbers this afternoon'.",
          vocab:["uncertainty","verify","data","hold"]},
        t3:{ask:"Where do you want to be in a couple of years?",
          model:"Leading hazard studies rather than participating, and stronger on the relief and flare side. That's the part of process safety where the engineering and the consequences meet most directly.",
          vocab:["hazard study","relief","flare","process safety"]}
      },
      2: {
        open:{ask:"Operations are handing the unit to you for a look. What do you want from them?",
          model:"What's changed and when. Not the current numbers — I can read those — but what they did, what they noticed, and what they're working around. Then I'd tell them what I'm going to look at and when they'll hear back, so it doesn't feel like their problem disappeared into an office.",
          vocab:["change","observation","workaround","trend","feedback"]},
        t0:{ask:"What do you give back to them?",
          model:"A plain answer with a number behind it and a recommendation they can act on. 'The reflux is the constraint, here's the evidence, here's what I suggest' — not a report they have to interpret at three in the morning.",
          vocab:["recommendation","evidence","constraint","actionable"]},
        t1:{ask:"How do you make sure the handover is complete?",
          model:"I ask what they think is causing it. Half the time they're right and I'm confirming it with numbers, which is a much better use of both of us than me discovering it independently a week later.",
          vocab:["cause","confirm","collaborate","hypothesis"]},
        t2:{ask:"What do you write down?",
          model:"What was observed, when it started, what changed at the same time, and what I'm going to check. Dated. Because 'it's been like this a while' becomes a real answer when someone can find when 'a while' began.",
          vocab:["observation","timeline","change","record"]},
        t3:{ask:"And if you can't get an answer quickly?",
          model:"I say so rather than going quiet. An honest 'I'm still looking, here's what I've ruled out' keeps the shift teams talking to me. Silence makes them solve it their own way.",
          vocab:["interim","ruled out","communicate","trust"]}
      },
      3: {
        open:{ask:"Before you reason from this data, what do you check?",
          model:"Whether the instruments are telling the truth. Is the transmitter in calibration, is the flow meter reading in a range it's accurate over, does the mass balance close. I've seen a week spent on a fouling theory that turned out to be a level transmitter reading low.",
          vocab:["calibration","flow meter","range","mass balance","instrument","verify"]},
        t0:{ask:"How do you check a number without going into the field?",
          model:"Cross-check it against something independent. If the level is right, the mass balance should close; if the flow is right, the pressure drop should match. When two independent measurements disagree, one of them is an instrument problem, not a process one.",
          vocab:["cross-check","independent","mass balance","pressure drop","consistency"]},
        t1:{ask:"What if the instrument turns out to be wrong?",
          model:"Then everything I concluded from it goes back on the table, and I say so. And the historical data before the recalibration can't be used as if it were right, which people forget.",
          vocab:["recalibrate","historical","invalid","retract"]},
        t2:{ask:"Who do you go to?",
          model:"Instruments, with the tag and what I think it's doing rather than 'the level looks wrong'. And I ask for the as-found reading, because that tells me how long my data has been bad.",
          vocab:["tag","as-found","instrument technician","specific"]},
        t3:{ask:"What do you record?",
          model:"Which data I used, over what period, and any instrument caveats. A conclusion without its data period attached is one somebody will quote back in two years about a different plant condition.",
          vocab:["data period","caveat","record","traceable"]}
      },
      4: {
        open:{ask:"Check this equipment against its duty. What are you looking at?",
          model:"Design conditions against the actual service — pressure, temperature, and the fluid. Materials suitable for what's in it. And whether the duty has drifted from what it was designed for, because plants get pushed and the datasheet doesn't move with them.",
          vocab:["design conditions","duty","service","materials","datasheet","drift"]},
        t0:{ask:"What if the plant is running outside the design condition?",
          model:"Then it stops or it goes through management of change with a proper assessment — not a conversation. Running above design pressure because 'it's been fine' is exactly the reasoning that appears in incident reports.",
          vocab:["design limit","management of change","assessment","incident"]},
        t1:{ask:"How do you check the protection is still right?",
          model:"Go back to what the relief device is sized for. If the duty has changed, the relieving scenario may have changed with it, and a device sized for the old case may be undersized for the new one.",
          vocab:["relief device","scenario","sizing","overpressure","protection"]},
        t2:{ask:"What about materials?",
          model:"Check the specification against the actual service, including what happens on upset. A material that's fine in normal operation can be wrong for the temperature it sees during a trip.",
          vocab:["material specification","upset","temperature","corrosion","service"]},
        t3:{ask:"What do you record?",
          model:"What was checked against what document, and any gap found with its consequence. A gap recorded without its consequence gets prioritised at the bottom of a list forever.",
          vocab:["record","gap","consequence","document","priority"]}
      },
      5: {
        open:{ask:"You've seen something you're not happy with. Talk me through it.",
          model:"The unit is being run above the high limit on tower pressure, and the operators have been told it's acceptable. It isn't — that limit is there because of a relief case. I'd stop that, take it to operations management, and if it needs to run that way it goes through management of change with the relief case reassessed.",
          vocab:["operating limit","relief case","management of change","stop","reassess"]},
        t0:{ask:"How do you raise it without it becoming a fight?",
          model:"Explain what the limit is protecting against rather than quoting the limit. 'That number is where the relief sizing case starts' lands differently from 'you're outside the envelope'. People argue with rules and agree with consequences.",
          vocab:["limit","relief sizing","consequence","explain"]},
        t1:{ask:"What if you're overruled?",
          model:"I'd put my position in writing, with the consequence stated plainly, and send it to the people who can decide. Being overruled is allowed; being overruled quietly and leaving no record is not.",
          vocab:["written","position","escalate","record","decision"]},
        t2:{ask:"Who needs to know?",
          model:"Operations management, HSE, and whoever owns the relief study. And the shift teams, because they're the ones holding the plant there and they should know why it matters.",
          vocab:["operations management","HSE","relief study","shift team"]},
        t3:{ask:"What's the longer-term fix?",
          model:"Find out why the plant needs to run there. If the constraint is real, the answer is a change properly assessed, not an operating limit that everyone has learned to ignore. A limit that's routinely exceeded has stopped being a limit.",
          vocab:["constraint","assess","management of change","limit","normalisation"]}
      },
      6: {
        open:{ask:"Explain this unit's design intent and what protects it.",
          model:"The tower is designed to separate at a given feed rate and composition, and the operating envelope comes from that. The protections are layered: control keeps it in range, alarms tell the operator, the trip acts if they can't, and the relief valve is the last layer for overpressure — sized for a specific scenario, not for anything that might happen.",
          vocab:["design intent","operating envelope","layer of protection","alarm","trip","relief valve","scenario"]},
        t0:{ask:"What would you do if operations want to run outside the envelope?",
          model:"Ask what they're trying to achieve, then assess it properly. Sometimes the envelope is conservative and can be reassessed; sometimes it's there for a relief case and cannot. Either way it's an assessment, not a permission.",
          vocab:["envelope","assess","relief case","management of change","conservative"]},
        t1:{ask:"Can a safeguard be taken out of service?",
          model:"Temporarily, with authority, a time limit and a compensating measure — the same discipline as any bypass. What can't happen is a protection layer quietly not working and the plant carrying on as if it did.",
          vocab:["safeguard","bypass","authority","compensating measure","time limit"]},
        t2:{ask:"How would you explain it to a new operator?",
          model:"What the unit is for, the two or three numbers that must not be exceeded, and what happens if they are. Not the full design basis — the parts that change what they do at three in the morning.",
          vocab:["design basis","limit","consequence","brief","operator"]},
        t3:{ask:"Anything that changes how the plant is protected?",
          model:"Fouling and changed feed. Both move the plant away from what it was designed against, quietly, over months — so the assumptions behind the safeguards need revisiting rather than being treated as permanent.",
          vocab:["fouling","feed change","assumption","revalidate","safeguard"]}
      },
      7: {
        open:{ask:"There's a question on this P&ID. What would you resolve before recommending anything?",
          model:"Whether what's drawn is what's installed. Tag numbers, valve positions, whether the bypass around the exchanger is actually there and whether it's car-sealed. I've seen a recommendation built on a drawing that hadn't been updated since a modification in the nineties.",
          vocab:["P&ID","tag number","bypass","car seal","as-built","modification"]},
        t0:{ask:"How do you check?",
          model:"Walk it with an operator. They know what's there and what's been abandoned, which the drawing doesn't. Then anything that's wrong goes for drawing revision, not just into my notes.",
          vocab:["walk down","operator","abandoned","revision","record"]},
        t1:{ask:"What if the drawing can't be resolved quickly?",
          model:"Then the recommendation waits or is written with the uncertainty stated in it. A recommendation that hides its assumptions is the one that gets implemented and then goes wrong.",
          vocab:["assumption","uncertainty","recommendation","state"]},
        t2:{ask:"How specific do you have to be when you raise it?",
          model:"Tag and line number, and what differs. 'The P&ID is out of date' is a complaint; 'there is no bypass on E-201 despite the P&ID showing one' gets a drawing changed.",
          vocab:["tag","line number","specific","discrepancy"]},
        t3:{ask:"And once it's corrected?",
          model:"The analysis is redone against the current version, and anything else that used the old drawing gets flagged — including the hazard study, if the missing detail was material to it.",
          vocab:["current revision","redo","hazard study","material"]}
      },
      8: {
        open:{ask:"There's a change proposed on the unit. Take me through it.",
          model:"It goes through management of change before it reaches the plant. What's changing, why, what it affects — process, protection, procedures and training. Then the hazard review at the right level, the approvals, and the actions done before start-up, not after. A temporary change gets an expiry date and is tracked to removal.",
          vocab:["management of change","hazard review","approval","pre-startup","temporary","expiry"]},
        t0:{ask:"What's the most commonly missed part?",
          model:"The knock-on effects. People assess the change itself well and miss what it does to something else — a relief case, an operating procedure, or an alarm that now means something different. And procedures: the plant changes and the procedure still describes the old one.",
          vocab:["knock-on","relief case","procedure","alarm","training"]},
        t1:{ask:"What about a temporary change?",
          model:"Temporary is the dangerous word. It gets an expiry date, a register entry and an owner, and it's reviewed when the date arrives. Temporary changes that quietly become permanent are a classic finding in incident reports.",
          vocab:["temporary","expiry","register","review","permanent"]},
        t2:{ask:"Who has to be involved?",
          model:"Operations, maintenance, HSE and the discipline engineers the change touches. And the shift teams, because a change nobody briefed them on is a change that gets operated the old way.",
          vocab:["operations","maintenance","HSE","brief","stakeholder"]},
        t3:{ask:"And before start-up?",
          model:"A pre-startup review: are the actions closed, are the procedures updated, are the people trained, is the protection in service. That review is the last chance to catch what the assessment missed.",
          vocab:["pre-startup review","actions closed","procedure","training","in service"]}
      },
      9: {
        open:{ask:"There's a deviation on the unit. What would you report?",
          model:"What deviated, by how much, since when, and what I think is causing it — labelled as what I think. The tower bottom temperature has been 8 degrees below target since Tuesday, the reboiler duty is down about 10 per cent on the same feed, and the likely cause is fouling on the reboiler. My recommendation is to plan a clean at the next opportunity rather than push the duty.",
          vocab:["deviation","target","duty","fouling","recommendation","evidence"]},
        t0:{ask:"How do you separate what you know from what you think?",
          model:"By writing them in different sentences. The measurements are facts; the mechanism is an interpretation. Mixing them is how a theory becomes a fact by being repeated in three meetings.",
          vocab:["measurement","interpretation","hypothesis","evidence"]},
        t1:{ask:"What if the answer is expensive?",
          model:"I say it anyway, with the cost of not doing it beside it. My job is the honest picture; the decision belongs to the people accountable for the money and the risk together.",
          vocab:["cost","risk","recommendation","decision","accountable"]},
        t2:{ask:"And if it's a process safety event rather than a performance issue?",
          model:"Then it's reported through that route immediately — a release gets reported as a release, with what and roughly how much, and the performance discussion happens afterwards.",
          vocab:["process safety event","loss of containment","report","immediate"]},
        t3:{ask:"What goes in the report?",
          model:"The data and its period, the instruments relied on, what I concluded, what I'm not sure about, and the recommendation with its alternatives. The uncertainty is part of the report, not a weakness in it.",
          vocab:["data period","instrument","conclusion","uncertainty","alternative"]}
      },
      10: {
        open:{ask:"The unit is coming back after a turnaround. What has to be confirmed?",
          model:"Every management-of-change action closed, procedures updated to match what's actually been built, protections back in service and proof tested, relief devices reinstalled and no blinds left in, and the operators briefed on what's different. Then a pre-startup review that says all of that, signed — not assumed because the work is finished.",
          vocab:["management of change","procedure","protection","proof test","blind register","pre-startup review"]},
        t0:{ask:"What's the most dangerous thing at start-up?",
          model:"A protection that isn't back. The plant is furthest from steady and the layers you rely on most are the ones most likely to still be bypassed from the turnaround work.",
          vocab:["protection","bypass","start-up","layer","restore"]},
        t1:{ask:"What about blinds?",
          model:"The blind register is reconciled — every blind in is a blind out, counted and signed. A blind left in a relief line is the classic overpressure incident, and it's found on a register, not by looking.",
          vocab:["blind register","reconcile","relief line","overpressure","count"]},
        t2:{ask:"What would make you say it isn't ready?",
          model:"Open actions that affect safety, a procedure that doesn't match the plant, or protections not proved. I'd say it plainly and in writing. Start-up pressure is exactly when that's hardest and most necessary.",
          vocab:["open action","procedure","proof test","written","hold"]},
        t3:{ask:"And once it's running?",
          model:"Watch it against the expected behaviour, not just against the alarms, and close out the temporary changes made during the turnaround. The week after start-up is when the things nobody assessed show up.",
          vocab:["monitor","expected","temporary change","close out"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. Maya. To start — tell me about yourself and your process engineering experience.",
          supervisor:"Daniel, operations. Tell me what units you've supported and what you actually fixed.",
          coworker:"Luis — I run a shift here. Tell me about your background, and whether you've spent time on plant.",
          safety:"Priya, HSE. Tell me about your experience, then we'll talk hazard studies and change.",
          qa:"Amelia, technical. Tell me about your background and how you document a recommendation."
        },
        open:{ask:"Tell me about yourself and your process engineering experience.",
          model:"Six years supporting operating refinery units — crude and a hydrotreater. Troubleshooting, turnaround technical work, hazard studies and management of change. What I'd point to is a recurring pressure drop everyone treated as fouling: the mass balance didn't support it, and it turned out to be a damaged distributor, which changed the fix entirely.",
          vocab:["operating unit","troubleshooting","hazard study","management of change","mass balance"]},
        t0:{ask:"Take me through how you'd approach a plant problem.",
          model:"Check the data is real before reasoning from it. Then establish what changed and when, because most problems have a start date. Build a picture the numbers support, say which parts are still assumption, and recommend the cheapest test that would prove me wrong.",
          vocab:["data validity","timeline","hypothesis","assumption","test"]},
        t1:{ask:"What's your experience of hazard studies?",
          model:"Scribe first, then participant on several. Deviation, cause, consequence, existing safeguards, and whether they're enough. The value is in the honesty about safeguards — a study that lists a safeguard nobody tests is worse than no study.",
          vocab:["deviation","cause","consequence","safeguard","study"]},
        t2:{ask:"Tell me about a time you had to hold a line.",
          model:"Operations wanted to run above a pressure limit that was tied to a relief case. I explained what the limit protected against, and when that wasn't accepted I put it in writing to management with the consequence stated. It went through management of change properly and the relief case was reassessed.",
          vocab:["operating limit","relief case","written","escalate","management of change"]},
        t3:{ask:"Where do you want to take your career?",
          model:"Leading hazard studies, and stronger on relief and flare systems. That's where process safety engineering has the most direct consequence, and it's the area I'd want to be genuinely expert in rather than adequate.",
          vocab:["hazard study","relief","flare","process safety","development"]}
      },
      12: {
        open:{ask:"Last session. Why are you ready for this role?",
          model:"Because I check the data before I reason from it, I keep what I know separate from what I think, and I take changes through the process rather than round it. Operators talk to me because I go and ask them first, and that's where most of the real information is.",
          vocab:["data","assumption","management of change","operations","evidence"]},
        t0:{ask:"What's the strongest thing you bring?",
          model:"Not being certain too early. Most expensive mistakes on a plant are a plausible theory that nobody tested. I'd rather spend a day proving it than a shutdown assuming it.",
          vocab:["hypothesis","test","evidence","rigour"]},
        t1:{ask:"Where do you still need to develop?",
          model:"Relief and flare systems, and leading a study rather than contributing to one. I've done the work under someone; I haven't carried it.",
          vocab:["relief","flare","lead","development"]},
        t2:{ask:"How would you describe your standard to a graduate?",
          model:"Check the instrument before you blame the process. Write the assumption down where people can see it. And if you disagree with a decision, put it in writing and move on — not in a corridor afterwards.",
          vocab:["instrument","assumption","written","escalate"]},
        t3:{ask:"Anything you want to ask us?",
          model:"How management of change works here in practice, and how temporary changes are tracked. And whether process engineers sit with the shift teams or only with each other.",
          vocab:["management of change","temporary change","operations","culture"]}
      }
    },
    millwright: {
      1: {
        openings: {
          hr:"Good morning — you must be the new millwright. I'm Maya from HR. Tell me a little about yourself and the machines you've worked on.",
          supervisor:"Morning. Daniel, I run this crew. Before I put you on anything, tell me what rotating equipment you've done.",
          coworker:"Hey — new on the maintenance crew? Luis. What were you working on before this?",
          safety:"Morning. Priya, safety officer. Everyone gets five minutes with me on day one. Tell me about your experience first.",
          qa:"I'm Amelia — I check the job records before a machine goes back. Tell me where you've worked."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm a millwright with six years on industrial plant. Pumps, gearboxes, fans and conveyors — bearing and seal changes, coupling alignment, and installation on new equipment. The last two years were in a process plant, so everything under permit and lockout rather than just switching it off at the panel.",
          vocab:["pump","gearbox","bearing","seal","alignment","lockout","permit"]},
        t0:{ask:"What kind of equipment and what sort of work?",
          model:"Centrifugal pumps mostly, some gearboxes and fans. Bearing changes, mechanical seals, coupling alignment with dial indicators and laser. I've installed and grouted baseplates on new pumps, and I'm comfortable taking my own alignment readings rather than waiting for someone else.",
          vocab:["centrifugal pump","mechanical seal","coupling","dial indicator","laser alignment","baseplate"]},
        t1:{ask:"Before you open a machine here — walk me through how you work safely.",
          model:"Nothing comes apart until it's isolated. Every energy source — electrical, process, and stored energy in springs or accumulators — isolated, locked with my own lock, and proved at zero. Then the guard comes off. PPE for the job, and if it's a lift, the gear inspected and the plan agreed before anything moves.",
          vocab:["isolate","lock","stored energy","zero energy","guard","lifting gear"]},
        t2:{ask:"If you're not sure about a clearance, who do you go to?",
          model:"The supervisor, and the manual. I don't set a clearance by feel because I've done a similar machine. The numbers are in the manual for a reason, and a bearing set wrong runs for a month and then fails.",
          vocab:["clearance","manual","tolerance","supervisor","specification"]},
        t3:{ask:"Where do you want to be in a couple of years?",
          model:"Doing more of the precision work — laser alignment and vibration analysis rather than only changing parts. The interesting question is why a machine failed, and that needs the condition side.",
          vocab:["laser alignment","vibration analysis","condition monitoring","precision"]}
      },
      2: {
        open:{ask:"You're handing over to me. What do I need to know?",
          model:"The west pump is apart — bearings out, my lock still on, and it doesn't go back until the new bearing arrives. The conveyor gearbox is finished and aligned, readings recorded, and it's ready for operations to accept. One thing to watch: the coupling guard on the east fan is loose and I've raised a job for it.",
          vocab:["apart","lock","aligned","readings","accept","guard"]},
        t0:{ask:"What do you do with your lock when the shift ends?",
          model:"It stays on while the machine is apart. If the job runs into your shift, your lock goes on and mine comes off with you standing there — not before you arrive so somebody can get at it.",
          vocab:["personal lock","lockout","transfer","apart"]},
        t1:{ask:"What about the machine that's finished?",
          model:"I say plainly whether it's fit to run and what the readings were. 'Finished' isn't the same as 'accepted' — operations need to know the alignment is within tolerance, not that I've stopped working on it.",
          vocab:["fit to run","accepted","alignment","tolerance","readings"]},
        t2:{ask:"How do you make sure it lands?",
          model:"We walk the locks together. Anything isolated gets looked at, not just talked about, because an isolation you inherit by description is one you don't really own.",
          vocab:["lockout","walk","inherit","isolation"]},
        t3:{ask:"And what do you want from the shift before yours?",
          model:"What's apart, what's isolated and whose lock is on it, and anything they found that isn't in the work order. The thing they noticed but didn't have time to raise is usually the useful part.",
          vocab:["apart","isolation","lock","work order","observation"]}
      },
      3: {
        openings: {
          supervisor:"That gear's yours today. Tell me how you'd check it before you start.",
          safety:"Priya, safety. Before you lift anything — talk me through your gear check.",
          coworker:"Luis here. We're lifting this morning. How do you go through the gear?",
          qa:"Amelia. Talk me through how you check tools and lifting equipment.",
          hr:"Maya from HR, sitting in today. Tell me how you'd check the gear over."
        },
        open:{ask:"That gear's yours today. Tell me how you'd check it before you start.",
          model:"Lifting gear first — slings and shackles for damage, the tag legible, and the inspection in date. Then the measuring tools, because a dial indicator that's been dropped will give me a confident wrong number. Then the machine's own guards: if one is missing or damaged, that's a finding before I start, not after.",
          vocab:["sling","shackle","tag","inspection","dial indicator","guard"]},
        t0:{ask:"Say a sling is damaged. What do you do?",
          model:"Out of service and cut, not put back on the rack with a note. A damaged sling that stays in circulation will be used by someone in a hurry, and the whole point of taking it out is that it can't be.",
          vocab:["out of service","destroy","circulation","quarantine"]},
        t1:{ask:"If the gear isn't right, do you carry on or stop?",
          model:"Stop. There's usually another set and if there isn't we wait. Nothing about a lift is worth doing with gear I'm unsure of — the load doesn't care how tight the schedule is.",
          vocab:["stop work","lift","gear","wait"]},
        t2:{ask:"How do you stop someone else using it?",
          model:"It goes off the rack into quarantine with a tag, and the store is told so it's replaced rather than just missing. A gap on a rack gets filled with whatever's nearest.",
          vocab:["quarantine","tag","store","replace"]},
        t3:{ask:"What goes in the record?",
          model:"The gear identification, what was wrong, the date and my name, and that it's quarantined. And if it's a pattern — three slings from the same batch — that gets raised separately, because that's a supply problem not a wear problem.",
          vocab:["identification","record","quarantine","pattern","batch"]}
      },
      4: {
        open:{ask:"Check the parts for this job. What are you looking at?",
          model:"Part numbers against the manual and the machine, not against what was fitted last time — someone may have substituted before me. Bearing numbers and clearance class, seal type and material for the service, and the clearances and torques I'll be working to written down before I start rather than looked up with my hands dirty.",
          vocab:["part number","manual","bearing","clearance class","seal","torque"]},
        t0:{ask:"What if the part on the shelf isn't the one in the manual?",
          model:"Hold it and ask. A bearing with the same bore and a different clearance class will fit perfectly and run hot. Substitutions on rotating equipment are an engineering decision, not a store decision.",
          vocab:["substitution","clearance class","bore","engineering","hold"]},
        t1:{ask:"Why does the balance or alignment tolerance matter here?",
          model:"Because it's what decides how long the bearings last. A coupling out of alignment is a load the bearing was never designed for, and the machine will run — it'll just fail in six months and nobody will connect it back to today.",
          vocab:["alignment","tolerance","balance grade","bearing life","load"]},
        t2:{ask:"How do you protect the parts before they go in?",
          model:"Bearings stay in the packet until the moment they're fitted, seals kept clean and away from heat, and everything covered if the job is open overnight. Most of what ruins a new bearing happens before it turns.",
          vocab:["contamination","packet","clean","cover","handling"]},
        t3:{ask:"What do you record?",
          model:"Part numbers actually fitted, the clearances and torques achieved, and the alignment readings. What was fitted, not what was ordered — they aren't always the same and the next person needs the truth.",
          vocab:["as-fitted","clearance","torque","alignment reading","record"]}
      },
      5: {
        open:{ask:"You've seen something you're not happy with. Talk me through it.",
          model:"The coupling guard is off on a machine that's running, and there's nobody working on it. The hazard is a rotating shaft anyone could contact. I'd stop the machine through operations rather than reaching anywhere near it, get it isolated, and find out how it came to be running with a guard off.",
          vocab:["coupling guard","rotating","contact","isolate","stop","hazard"]},
        t0:{ask:"Would you fit the guard back with it running?",
          model:"No. Fitting a guard to a running machine is doing exactly the thing the guard exists to prevent. It gets stopped and isolated first, even though that costs operations a pump for twenty minutes.",
          vocab:["running","isolate","stop","guard","hazard"]},
        t1:{ask:"What if you're told to leave it and get on with your job?",
          model:"I wouldn't. An exposed rotating shaft is a stop, and I'd say so plainly and ask the supervisor to come and look. If it still isn't agreed, it goes up — that's what stop-work is for.",
          vocab:["stop work authority","escalate","exposed","refuse"]},
        t2:{ask:"Who needs to know?",
          model:"The area operator and the supervisor immediately, and safety. And it gets reported even once it's fixed, because a guard doesn't come off by itself and the reason matters.",
          vocab:["operator","supervisor","report","near miss"]},
        t3:{ask:"And the longer-term fix?",
          model:"Find out why. If the guard is awkward and has to come off every week for greasing, then the answer is a guard designed for that access — not a reminder to put it back.",
          vocab:["root cause","design","access","corrective action"]}
      },
      6: {
        open:{ask:"Talk me through this job, the sequence and how it's checked.",
          model:"Isolate and prove zero energy, guard off, coupling apart, pull the bearings. New bearings fitted to the manual's clearances, seal set, then align the coupling to tolerance with the machine at ambient and check for soft foot before I start. Final readings recorded, guard back, then run it and take a vibration reading against the last one.",
          vocab:["zero energy","coupling","clearance","alignment","soft foot","vibration reading"]},
        t0:{ask:"What would you do if the manual and what you find disagree?",
          model:"Stop and ask. If the manual says a clearance and the housing is worn beyond it, fitting to the number doesn't help — the housing is the problem. That's a conversation with the engineer, not a decision at the machine.",
          vocab:["manual","wear","housing","engineer","hold"]},
        t1:{ask:"Why check soft foot before aligning?",
          model:"Because aligning a machine that's rocking on its feet gives you a set of numbers that change the moment you tighten it down. You'd get a perfect reading and a machine that's still misaligned in service.",
          vocab:["soft foot","shim","baseplate","alignment","reading"]},
        t2:{ask:"How would you explain the job to someone who missed the briefing?",
          model:"What's isolated, what stage we're at, and what still has to be checked before it can run. That last one matters most — someone joining halfway is the person most likely to assume the checks are already done.",
          vocab:["isolation","stage","check","brief","assume"]},
        t3:{ask:"Anything that changes how you protect yourself?",
          model:"The lift on the gearbox, and the stored energy — a coupling under tension or a spring-set brake will move when it's released. And if it's a hot pump, the process side may still be hot even when it's isolated.",
          vocab:["lift","stored energy","tension","brake","residual heat"]}
      },
      7: {
        open:{ask:"There's a question on this drawing. What would you check before assembly?",
          model:"The clearances and the fits — which are interference and which are clearance, and the tolerance on each. And whether the drawing matches the machine in front of me, because equipment gets modified and the drawing often doesn't follow. Assembling to a tolerance that isn't the right one is worse than not having the drawing.",
          vocab:["clearance","interference fit","tolerance","drawing","modified"]},
        t0:{ask:"Who resolves it?",
          model:"The supervisor, or the engineer if it's a design question. Not the vendor's general manual if this machine has been modified — the site's own record should govern, and if it doesn't exist, that's the finding.",
          vocab:["supervisor","engineer","vendor","modified","record"]},
        t1:{ask:"How specific do you need to be?",
          model:"Give the dimension and what I actually measured. 'The drawing calls 0.05 to 0.08 on the bearing housing and I'm measuring 0.14' can be answered today; 'it doesn't look right' can't.",
          vocab:["dimension","measure","specific","tolerance"]},
        t2:{ask:"What do you do in the meantime?",
          model:"It doesn't go together. A machine assembled to a guess will run, which is the problem — nobody finds out it was wrong until it fails.",
          vocab:["hold","assemble","guess","fail"]},
        t3:{ask:"And once it's resolved?",
          model:"I work to the confirmed figure and record what I actually achieved against it. And if the drawing was wrong, that goes back for correction so the next person isn't asking the same question.",
          vocab:["confirmed","achieved","record","correction"]}
      },
      8: {
        open:{ask:"There's a lift today around other trades. How do you handle it?",
          model:"The plan first: the weight, the gear rated for it, the lift points, and who is directing. One person gives signals, and everyone else is clear of the path — not just out of the way, but out from under it. And the other trades are told before the gear is rigged, not as the load leaves the ground.",
          vocab:["lift plan","weight","rated","lift point","signals","exclusion"]},
        t0:{ask:"What do you need from the other trades?",
          model:"The area below and around cleared, and nobody working overhead while we lift. And to know what else is happening nearby, because a lift beside a hot work job is a different conversation.",
          vocab:["clear","overhead","simultaneous","coordinate"]},
        t1:{ask:"What do they need from you?",
          model:"When, for how long, and how much space I actually need. If I tell them the truth about the exclusion zone they'll plan round it; if I understate it to be accommodating, someone will be standing in it.",
          vocab:["exclusion zone","duration","honest","plan"]},
        t2:{ask:"Who's in charge once the lift starts?",
          model:"One person directing, and everyone knows who. The most dangerous lift is the one with two people signalling and a crane driver deciding which to believe.",
          vocab:["signaller","banksman","direct","crane","single point"]},
        t3:{ask:"What would stop the lift?",
          model:"Anyone entering the zone, a signal that isn't clear, wind, or the load not behaving as expected. Anyone can call a stop; only the person directing restarts it.",
          vocab:["stop","signal","wind","restart","authority"]}
      },
      9: {
        open:{ask:"You've taken readings. What would you report?",
          model:"The numbers and what they're judged against. The alignment is 0.15 mm offset where the tolerance is 0.05, and vibration on the drive end is up on the last reading three months ago. The machine will run, but it shouldn't — my recommendation is we don't put the guard back and call it finished; we look at the baseplate.",
          vocab:["alignment","offset","tolerance","vibration","drive end","baseplate","trend"]},
        t0:{ask:"Why give the comparison rather than just the number?",
          model:"Because a number on its own can't be acted on. 'Vibration is 4.5' means nothing to a supervisor; '4.5 against 2.1 three months ago, on the same measurement point' is a decision.",
          vocab:["comparison","trend","measurement point","baseline","actionable"]},
        t1:{ask:"What if you're asked to put it back anyway?",
          model:"I'd say what I expect to happen and when, and I'd put the readings in the record. If the decision is to run it and monitor, that's a legitimate decision — but it should be a decision, taken with the numbers, not an assumption that it's fine.",
          vocab:["record","monitor","decision","consequence","evidence"]},
        t2:{ask:"How do you make sure the reading is trustworthy?",
          model:"Same point, same way, machine in the same condition. A vibration reading taken somewhere else on the housing isn't comparable, and comparing two non-comparable readings is worse than having one.",
          vocab:["measurement point","repeatable","condition","comparable"]},
        t3:{ask:"What goes in the record?",
          model:"The readings, where they were taken, the tolerance, what I found physically, what was fitted, and the recommendation. The physical findings matter — 'bearing outer race pitted' tells the next person more than a vibration number.",
          vocab:["reading","location","tolerance","finding","as-fitted","recommendation"]}
      },
      10: {
        open:{ask:"This is a controlled job. Tell me what you need in place before you start.",
          model:"Before that guard comes off: the machine shut down, every energy source isolated — electrical, process and stored — locked with my lock and tagged, and proved at zero by trying to start it and by releasing any stored energy. Process side drained and depressured if I'm breaking in. A permit posted. And I want to see it dead myself, not be told.",
          vocab:["isolate","stored energy","lock","tag","zero energy","drain","depressure","permit"]},
        t0:{ask:"What counts as stored energy on a machine like this?",
          model:"Springs, accumulators, a raised load, residual pressure, and rotation that hasn't stopped. A vertical pump that's still coasting or a spring-set brake will move after everything is 'off', and that's where people get caught.",
          vocab:["spring","accumulator","residual pressure","coasting","brake"]},
        t1:{ask:"If the permit runs out mid-job, what do you do?",
          model:"Stop and leave it safe with my lock still on. The permit expiring doesn't make the machine safe — it means the conditions nobody has re-checked are no longer proved.",
          vocab:["permit","expiry","leave safe","lock","re-issue"]},
        t2:{ask:"What if someone else needs to work on it too?",
          model:"Their lock goes on as well. One lock per person, and the machine doesn't move until the last one is off. A shared isolation with one person's lock is an isolation that ends when they go home.",
          vocab:["multiple lock","personal lock","isolation","hasp"]},
        t3:{ask:"And before it goes back into service?",
          model:"Guards on, tools counted out, readings taken and recorded, then locks off in order with the operator there. And I say plainly whether it's fit to run — if the alignment is out of tolerance, I say that rather than letting 'it's back together' be heard as 'it's fine'.",
          vocab:["guard","count","readings","locks off","fit to run"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. Maya. To start — tell me about yourself and your millwright experience.",
          supervisor:"Daniel, maintenance. Tell me what rotating equipment you've worked on and how you align.",
          coworker:"Luis — I'd be on your crew. What sort of machines have you done?",
          safety:"Priya, safety. Tell me about your experience, then I'll ask you about isolation.",
          qa:"Amelia — I check job records. Tell me about your background and what you record."
        },
        open:{ask:"Tell me about yourself and your millwright experience.",
          model:"Six years on industrial plant — pumps, gearboxes, fans and conveyors. Bearings, mechanical seals, coupling alignment with dial indicators and laser, and installation work. What I'd point to is a pump that had been through three sets of bearings in a year: the alignment was in tolerance cold, but there was soft foot nobody had checked, and once that was fixed it ran.",
          vocab:["pump","gearbox","bearing","mechanical seal","alignment","soft foot"]},
        t0:{ask:"Talk me through how you align a coupling.",
          model:"Check and correct soft foot first, then take readings — rim and face with indicators, or laser if we have it. Correct vertical with shims, horizontal by moving, and re-check after every move rather than assuming the correction landed. Then record the final numbers against the tolerance, and allow for thermal growth where the machine runs hot.",
          vocab:["soft foot","rim and face","shim","laser","thermal growth","tolerance"]},
        t1:{ask:"Talk me through isolating a machine.",
          model:"Every energy source, not just the electrical one. Electrical isolated, locked and tagged with my own lock. Process side isolated, drained and depressured where I'm breaking in. Stored energy released — springs, accumulators, anything raised. Then prove it: try to start it, and check nothing is still turning.",
          vocab:["energy source","lock","tag","drain","stored energy","prove","zero energy"]},
        t2:{ask:"Tell me about a time something went wrong.",
          model:"A bearing failed a month after I fitted it. I'd fitted it correctly but I hadn't recorded the housing measurement, so we couldn't tell whether the housing had been worn already. Since then I record what I measured, not just what I fitted — and that has settled two arguments since.",
          vocab:["failure","housing","measurement","record","evidence"]},
        t3:{ask:"Where do you want to go from here?",
          model:"Precision alignment and vibration analysis. I want to be the person who says why a machine keeps failing rather than the one who keeps replacing the same bearing.",
          vocab:["precision alignment","vibration analysis","condition monitoring","root cause"]}
      },
      12: {
        open:{ask:"Last session. Why are you ready for this work?",
          model:"Because I work to numbers and I prove isolation rather than assume it. My lock goes on, zero energy gets proved, and the machine goes back with readings recorded against a tolerance — so anyone can see later whether it was right when it left me.",
          vocab:["tolerance","isolation","zero energy","readings","record"]},
        t0:{ask:"What's the strongest thing you bring?",
          model:"Recording what I measured, not just what I fitted. Most repeat failures are an argument about what was there before, and a measurement written down ends that argument.",
          vocab:["measurement","record","repeat failure","evidence"]},
        t1:{ask:"Where do you still need to develop?",
          model:"Vibration analysis properly — I can take a reading and compare it, I can't interpret a spectrum. I'd want the training rather than to be treated as if I already could.",
          vocab:["vibration analysis","spectrum","interpret","training"]},
        t2:{ask:"How would you describe your standard to an apprentice?",
          model:"Your lock is yours and it comes off when you say it's safe. Check soft foot before you align anything. And never say a machine is fine — say what the reading was and what the tolerance is.",
          vocab:["personal lock","soft foot","reading","tolerance"]},
        t3:{ask:"Anything you want to ask us?",
          model:"Whether alignment readings are recorded and kept here, and whether there's a condition-monitoring programme. Those tell me whether the plant is maintained or just repaired.",
          vocab:["alignment record","condition monitoring","planned maintenance","reactive"]}
      }
    },


    pipefitter: {
      3: {
        openings: {
          supervisor:"That gear's yours for the day. Tell me how you'd check it over before you start.",
          safety:"Priya, safety. Before you light up — talk me through your gear check.",
          coworker:"Luis here. We're cutting in an hour. How do you go through the gear?",
          qa:"Amelia. Talk me through how you check your cutting gear.",
          hr:"Maya from HR, sitting in today. Tell me how you'd check the gear over."
        },
        open:{ask:"That gear's yours for the day. Tell me how you'd check it over before you start.",
          model:"Hoses first — cuts, and the fittings tested with soapy water for leaks. Then the gauges and the flashback arrestors. Then the beveller and the grinder: guards on, discs not chipped. Anything that isn't right doesn't get used until it's sorted.",
          vocab:["hose","fitting","gauge","flashback arrestor","beveller","guard"]},
        t0:{ask:"Say the regulator keeps creeping. How would you report that?",
          model:"Out of service and tell you straight away — a creeping regulator is a leak waiting to happen. I'd tag it and write down what it was doing, not just that it was faulty.",
          vocab:["regulator","creep","out of service","tag","leak"]},
        t1:{ask:"If the gear isn't right, what do you do — carry on, or stop?",
          model:"Stop. There's usually another set in the store, and if there isn't we wait. Cutting gear that isn't right is not something you work around.",
          vocab:["stop-work","out of service","gear"]},
        t2:{ask:"And how would you make sure nobody else uses it in the meantime?",
          model:"Tag it and take it off the rack into quarantine. A tag on its own gets ignored when somebody is in a hurry.",
          vocab:["tag","quarantine","rack"]},
        t3:{ask:"Tell me what you'd write in the log.",
          model:"The gear number, what it was doing, the date and my name, and that it's quarantined. Enough for the next person to find it and know why it's out.",
          vocab:["log","record","quarantine"]}
      },
      6: {
        open:{ask:"New spec on this job. Tell me back what you understand by it.",
          model:"It's B31.3 process piping, so the tolerances are tighter than the structural work I've been on — root opening and hi-lo both called out, and every joint checked before it's welded out. I work to the drawing, not to what I'm used to.",
          vocab:["ASME B31.3","tolerance","root opening","hi-lo","fit-up"]},
        t0:{ask:"What would you do if the spec and the drawing disagree?",
          model:"Stop and ask. I don't pick whichever suits me. The spec usually governs, but I want that confirmed by whoever owns the drawing before I cut anything.",
          vocab:["specification","drawing","governs","hold"]},
        t1:{ask:"If you're not certain about a step, what happens next?",
          model:"I ask before I do it, not after. Two minutes now against a cut-out later is not a hard choice.",
          vocab:["hold point","cut-out","clarification"]},
        t2:{ask:"How would you explain it to someone who missed the briefing?",
          model:"Tighter tolerances than usual, every fit-up checked before welding, and the spec governs where the drawing is unclear. Then I'd point them at the copy on the board rather than trusting my summary of it.",
          vocab:["tolerance","fit-up","specification","briefing"]},
        t3:{ask:"Anything in it that changes how you protect yourself?",
          model:"It's hot work in an occupied area, so the permit and the fire watch matter more than usual. And tighter fit-ups mean more grinding, so it's a face shield as well as glasses.",
          vocab:["hot work","permit","fire watch","PPE"]}
      },
      10: {
        open:{ask:"This is a controlled area. Tell me what you need in place before you start.",
          model:"Before I break the flange I need the line drained and depressurised, the valves locked and tagged, a blind in where the spec calls for one, and a permit posted that says all of it. And I want to see the gauge read zero myself.",
          vocab:["line break","depressurise","LOTO","blind","permit"]},
        t0:{ask:"If the permit runs out mid-job, what do you do?",
          model:"Stop and come out. The permit expiring means the conditions it was written against are no longer proved. It gets re-issued before I go back to it.",
          vocab:["permit","expiry","re-issue"]},
        t1:{ask:"And what should I be watching for while you're working?",
          model:"Anything upstream changing — a valve moving, a pump starting, pressure coming back. If the line isn't dead any more I need to hear it from you, not find out the hard way.",
          vocab:["upstream","isolation","valve","pressure"]},
        t2:{ask:"Who do you call if something changes in the area?",
          model:"You first, then the permit issuer and the control room. If it's the isolation that's changed, I'm out before it's discussed.",
          vocab:["permit issuer","control room","isolation"]},
        t3:{ask:"What has to be signed off before you leave?",
          model:"The permit closed, the joint left safe or made up, and the tools counted back out. And I say plainly whether the line is ready to be re-pressurised or not.",
          vocab:["permit close-out","made up","re-pressurise"]}
      },
      1: {
        openings: {
          hr:"Good morning — you must be the new fitter. I'm Maya from HR. Tell me a little about yourself and the work you've done.",
          supervisor:"Morning. Daniel, I run this crew. Before I put you on anything, tell me what pipe you've been fitting.",
          coworker:"Hey — you're the new one, right? I'm Luis. What kind of work were you doing before this?",
          safety:"Morning. Priya, safety officer. Everyone gets five minutes with me on day one. Tell me about your experience first.",
          qa:"You're new — I'm Amelia, I check every fit-up before it's welded. Tell me where you've worked and what you fitted."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm a pipefitter with six years' experience. I work off isometrics on process piping — carbon steel and some stainless, from two inch up to twelve. The last two years I was in a fabrication shop doing spool work, taking off my own bills of material and setting fit-ups for the welders, and I'm looking for site work now.",
          vocab:["isometric","process piping","spool","bill of material","fit-up","schedule"]},
        t0:{ask:"We run a lot of process piping here. What sizes and materials are you comfortable with?",
          model:"Carbon steel from two inch to twelve, schedule 40 and 80. Stainless I've done less of, so I'd want to be paired with someone for the first few spools. I'm happy to do a layout test so you can see how I take off a rolling offset.",
          vocab:["carbon steel","stainless","schedule","rolling offset","take-out","bore"]},
        t1:{ask:"Before you touch a torch — walk me through what you check to work safely.",
          model:"First my PPE — glasses, gloves, boots and hard hat. Then the area: nothing flammable near, and a hot work permit if the site needs one. Then the gear — hoses, gauges and flashback arrestors in good order. If anything doesn't look right I stop and ask the supervisor.",
          vocab:["PPE","hot work permit","flashback arrestor","gauge","isolation"]},
        t2:{ask:"If you're not sure about a dimension, who do you go to? We'd rather you ask.",
          model:"The supervisor, or the layout engineer if it's a dimension on the isometric. I'd rather hold a spool for two minutes than cut it short and scrap the piece. Asking is cheaper than a re-cut.",
          vocab:["layout engineer","isometric","hold point","scrap","re-cut"]},
        t3:{ask:"I check every fit-up before it's welded. If I send one back, how would you want me to tell you?",
          model:"Tell me straight. Show me what's out — hi-lo, root opening, whatever it is — and I'll break it down and re-set it. And give me the measurement you took, so I'm checking the same thing myself next time.",
          vocab:["hi-lo","root opening","alignment","tolerance","re-set"]}
      },
      2: {
        open:{ask:"Before you go — give me the handover. What did you finish today?",
          model:"I finished the two spools off drawing twelve — cut, bevelled and fitted, both tacked and ready for the welder. The third one is cut but not bevelled yet.",
          vocab:["spool","bevel","tack","isometric","fit-up"]},
        t0:{ask:"Anything that gave you trouble? I'd rather hear it now than find it at ten o'clock.",
          model:"The rolling offset on line six didn't come out to the drawing. I got it inside tolerance in the end but it cost me an hour, so if anyone hits the same detail tomorrow they should check the take-out before they cut.",
          vocab:["rolling offset","take-out","tolerance","centre-to-centre"]},
        t1:{ask:"Which fit-ups have I still got to check?",
          model:"Two on the bench — spool four and spool five. Both are tacked and nothing is welded out, so if the alignment is wrong they can still be broken down.",
          vocab:["fit-up","tack","alignment","welded out","hold point"]},
        t2:{ask:"And what do you want the night shift to start with?",
          model:"Bevelling the third spool — it's marked and ready. After that the pipe for line eight is on the rack, but it needs checking against the bill of material first because I haven't verified the schedule.",
          vocab:["bevel","bill of material","schedule","rack"]},
        t3:{ask:"Anything left in the area that could catch someone out?",
          model:"There's a spool on trestles by the door that isn't chocked, so it could roll. I've put a barrier round it, but it needs strapping before anybody works near it.",
          vocab:["trestle","chock","barrier","housekeeping"]}
      },
      4: {
        open:{ask:"Material's on the rack. Tell me how you'd get it ready.",
          model:"I check the spool against the isometric first — material, size and schedule — then mark and cut, bevel to the angle on the drawing and clean the ends back. Then I set the root opening and check pitch and alignment before anything is tacked.",
          vocab:["isometric","schedule","bevel","root opening","pitch","alignment"]},
        t0:{ask:"How would you tell me the fit-up isn't right?",
          model:"I'd give you the number — the hi-lo is a millimetre and a half where the drawing allows one. Which spool, which joint, and whether I can pull it in or it needs re-cutting.",
          vocab:["hi-lo","tolerance","joint","re-cut","alignment"]},
        t1:{ask:"If the material isn't what the job called for, who do you tell?",
          model:"You first, then whoever holds the material certificates. I'd stop and not cut it — once it's cut it's scrap and the traceability is gone. I'd quote the heat number off the pipe so it can be checked.",
          vocab:["material certificate","heat number","traceability","scrap"]},
        t2:{ask:"And if I've prepped it differently to you — how do we sort that out?",
          model:"We go back to the isometric and read the detail together. If it still isn't clear we ask the layout engineer rather than each doing it our own way. Whatever we agree I'd mark on the drawing, so the next shift does the same thing.",
          vocab:["isometric","detail","layout engineer","mark-up"]},
        t3:{ask:"Anything about this prep that could put someone at risk?",
          model:"Cutting and bevelling is hot work, so it needs a permit and a clear area. And the spool has to be chocked on the trestles — if it rolls off it takes somebody's foot with it.",
          vocab:["hot work","permit","chock","trestle","line of fire"]}
      },
      5: {
        open:{ask:"You flagged something on line two. Tell me what you saw.",
          model:"The line wasn't isolated. There was still pressure on the gauge and the valve upstream wasn't locked out, and we were about to break the flange. I stopped the job and nobody has touched it since.",
          vocab:["isolation","lockout","valve","flange","line break"]},
        t0:{ask:"Understood. What do you need from me to make it safe?",
          model:"The line drained and depressurised, the valve locked and tagged, and a permit that says so before we open the flange. Once I can see the tag and the gauge reads zero I'm happy to carry on.",
          vocab:["depressurise","lockout/tagout","permit","drain","blind"]},
        t1:{ask:"The lads want to keep going. How do you tell them no?",
          model:"Plainly — the line isn't isolated, so we're not opening it. Not a discussion about who's right, just what has to be in place first. If they push, it comes to you.",
          vocab:["stop-work","isolation","escalate"]},
        t2:{ask:"Who else needs to know, right now?",
          model:"You, the permit issuer, and the operator who controls that valve. And anyone working downstream of the flange, because if it does let go it won't only be us.",
          vocab:["permit issuer","operator","downstream","line of fire"]},
        t3:{ask:"Does any of the work already done need looking at again?",
          model:"The joints we made on that line yesterday were on the same permit, so I'd want the permit checked. The fit-ups themselves are fine — it's whether the isolation was ever proved that I'm not sure about.",
          vocab:["permit","isolation","verification","review"]}
      },
      7: {
        open:{ask:"You had a question on the isometric. Which detail?",
          model:"The centre-to-centre on the rolling offset between nodes four and five. The drawing gives me both elevations but not the travel, so I can't work the take-out for the forty-five fittings without assuming a dimension.",
          vocab:["centre-to-centre","rolling offset","elevation","travel","take-out"]},
        t0:{ask:"So what do you think it's asking for?",
          model:"I read it as a rolling offset with two forty-fives, and by my calculation the travel comes out around one metre one hundred. But that's my calculation, not the drawing, so I want it confirmed before I cut.",
          vocab:["rolling offset","45-degree fitting","travel","calculation"]},
        t1:{ask:"If I'm not available, who else would you ask?",
          model:"The layout engineer, or the site supervisor if it's urgent. If nobody is available the spool waits — I don't cut pipe on an assumption.",
          vocab:["layout engineer","supervisor","hold"]},
        t2:{ask:"Would you carry on and check later, or wait?",
          model:"Wait. Everything before the cut is reversible and everything after it isn't. I'd move onto another spool so the crew isn't standing about, and pick this one up when I have the dimension.",
          vocab:["hold point","sequence","re-cut","scrap"]},
        t3:{ask:"How would you record the answer so the next person has it?",
          model:"Write it on the drawing with the date and who confirmed it, and get the marked-up copy back to the office so it goes onto the controlled revision. A dimension agreed verbally is gone by the next shift.",
          vocab:["mark-up","revision","controlled drawing","sign-off"]}
      },
      8: {
        closing:"That's the job on site. Half fitting, half talking to people — you did both.",
        open:{ask:"Site's busy today. Tell me what you need from the other trades to get your work done.",
          model:"I need the scaffold up to the pipe rack before I can set the spool, and the electricians out of that bay while I'm doing hot work. With those two I can have the line up by the afternoon.",
          vocab:["scaffold","pipe rack","spool","hot work","access"]},
        t0:{ask:"If someone's working below you, what do you say to them?",
          model:"I tell them what I'm doing above them and how long for, and I ask them to move or I wait. Nothing I drop from that height is small. If they can't move, a barrier and a spotter go in first.",
          vocab:["line of fire","barrier","spotter","dropped object","exclusion zone"]},
        t1:{ask:"The electricians want the area for an hour. What do you tell them?",
          model:"I tell them what's on my permit and when it expires, and I offer them the hour if I can move onto another spool. If I can't, I say so and give them a time I can hand the area over.",
          vocab:["permit","handover","access","sequence"]},
        t2:{ask:"And if that pushes your work back — how do you let me know?",
          model:"Straight away, not at the end of the shift. Which line is affected and how long by, so you can move somebody else onto it if it matters to the programme.",
          vocab:["programme","delay","sequence","escalate"]},
        t3:{ask:"Give me a realistic time for the fit-up to be ready.",
          model:"Two spools by three o'clock if the scaffold is up by eleven. If the scaffold slips it's tomorrow morning — I'd rather tell you that now than promise it and miss it.",
          vocab:["fit-up","schedule","commitment","contingency"]}
      },
      9: {
        openings: {
          qa:"I'm Amelia, I check what leaves this shop. You've found something on the joint — describe it to me.",
          supervisor:"Daniel here. You flagged a fit-up. Talk me through what you found.",
          coworker:"It's Luis. You said the joint at node six isn't right — what's wrong with it?",
          hr:"Maya from HR sitting in on this one. Tell me what you found on the joint.",
          safety:"Priya, safety. Before the quality side of it — describe what you found on the joint."
        },
        open:{ask:"You've found something on the joint. Describe it to me.",
          model:"The hi-lo on the joint at node six is about two millimetres where the spec allows one. It's internal misalignment — the bores don't line up, and the drawing calls that out as a flow line.",
          vocab:["hi-lo","misalignment","bore","tolerance","specification"]},
        t0:{ask:"How did it get past? I'm not blaming anyone, I want to know.",
          model:"The two pipe ends are different wall thicknesses. They're the same nominal size so it looked right from the outside, and nobody checked the bore before it was tacked.",
          vocab:["wall thickness","nominal size","bore","tack","schedule"]},
        t1:{ask:"Alright. What would you want me to do differently?",
          model:"Check the schedule on both ends at fit-up, not just the size. If we'd caught it at the tack it was five minutes. Now it's a cut-out.",
          vocab:["schedule","fit-up","tack","cut-out","hold point"]},
        t2:{ask:"What do we do with the joints already finished?",
          model:"Hold them and check the same detail on each one. I'd start with the ones off the same batch of pipe, because if the wall thickness is wrong on one it'll be wrong on the others.",
          vocab:["hold","batch","traceability","wall thickness","review"]},
        t3:{ask:"And how do we stop it happening on the next batch?",
          model:"Verify the schedule against the bill of material when the pipe comes off the rack, and mark it. One check at the start instead of a cut-out at the end.",
          vocab:["bill of material","schedule","verification","mark-up"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. I'm Maya. Start wherever you like — tell me about yourself.",
          supervisor:"Daniel, I run the crew you'd be joining. Tell me about yourself and the pipe you've fitted.",
          coworker:"I'm Luis, I'd be working alongside you. Tell me a bit about yourself.",
          safety:"Priya, safety officer, sitting in on the panel. Start with your background.",
          qa:"Amelia, quality. I'd be checking your fit-ups. Tell me about yourself."
        },
        open:{ask:"Thanks for coming in. Start wherever you like — tell me about yourself.",
          model:"I'm a pipefitter with six years on process piping. I work off isometrics, take off my own bills of material and set fit-ups to the drawing. Mostly carbon steel, some stainless, and the last two years in fabrication doing spool work.",
          vocab:["process piping","isometric","bill of material","fit-up","spool"]},
        t0:{ask:"Give me an example of a difficult job you finished.",
          model:"A rolling offset in a tight rack where the drawing dimension didn't work on site. I measured what was actually there, worked the travel again and took it to the layout engineer with my numbers. We changed two fittings and it went in the same week.",
          vocab:["rolling offset","travel","layout engineer","dimension"]},
        t1:{ask:"Tell me about a time you raised a safety concern.",
          model:"We were about to break a flange on a line I wasn't sure was isolated. I stopped it and asked for the isolation to be proved. It turned out the valve was passing, so it was the right call — but I'd have stopped it either way.",
          vocab:["flange","isolation","stop-work","valve","permit"]},
        t2:{ask:"How do you handle it when your fit-up is rejected?",
          model:"I ask what the measurement was and where it was taken, then break it down and re-set it. I'm not precious about it — if the hi-lo is out, it's out. What I want is the number, so I'm checking the same thing next time.",
          vocab:["fit-up","hi-lo","rejection","re-set","tolerance"]},
        t3:{ask:"And why this company? What are you looking for next?",
          model:"You do process work to B31.3, which is where I want to be — I've done more structural support work than I'd like. I'm after a crew where the drawings are controlled and the fitters do their own layout.",
          vocab:["ASME B31.3","process piping","layout","controlled drawing"]}
      },
      12: {
        open:{ask:"Last conversation before you go out for roles. Tell me who you are professionally now.",
          model:"I'm a pipefitter who reads the drawing before touching the pipe. I take off my own dimensions, I say when a detail doesn't work, and I don't cut on an assumption. That's the part I'd want an employer to know.",
          vocab:["isometric","dimension","layout","assumption"]},
        t0:{ask:"What work are you aiming for next?",
          model:"Process piping on an operating plant, working to B31.3, with a crew that does its own layout. I'd take shutdown work as well — the pace is hard but you learn a lot in three weeks.",
          vocab:["process piping","ASME B31.3","shutdown","layout"]},
        t1:{ask:"What part of your work do you still want to sharpen?",
          model:"Stainless and alloy. I can fit it, but I'm slower and more careful than I'd like to be, and I've done very little high purity work. I'd want time with somebody who does it every day.",
          vocab:["stainless","alloy","high purity","fit-up"]},
        t2:{ask:"And what would you not compromise on?",
          model:"Isolation before a line break, and cutting on a confirmed dimension. Those two. Everything else is negotiable — hours, pay, who I work with — but I won't open a line I can't see is proved.",
          vocab:["isolation","line break","dimension","permit"]},
        t3:{ask:"Give me your closing line — the one you'd end an interview with.",
          model:"As I'd say it on site: the isometric doesn't give me the centre-to-centre, so I'll hold the spool until the layout engineer confirms the take-out. That's the habit you're hiring.",
          vocab:["isometric","centre-to-centre","take-out","hold"]}
      }
    },

    boilermaker: {
      4: {
        open:{ask:"Material's on the rack. Tell me how you'd get it ready.",
          model:"Check it against the drawing first — grade, thickness and heat number — then mark, cut and prep the edge to the weld prep on the drawing. Tubes get cut square and deburred, and the ends cleaned back before anything goes near the tube sheet.",
          vocab:["heat number","grade","weld prep","deburr","tube sheet"]},
        t0:{ask:"How would you tell me the prep isn't right?",
          model:"I'd give you the measurement — the bevel angle is out, or the tube is a millimetre short of the sheet. Which piece, which dimension, and whether it can be re-prepped or has to be scrapped.",
          vocab:["bevel","dimension","re-prep","scrap"]},
        t1:{ask:"If the material isn't what the job called for, who do you tell?",
          model:"You, and whoever holds the material certificates. On a pressure part the grade isn't a preference, it's the code — so I stop and quote the heat number rather than cut it.",
          vocab:["material certificate","heat number","pressure part","code"]},
        t2:{ask:"And if I've prepped it differently to you — how do we sort that out?",
          model:"Back to the drawing and the procedure, together. If it's still not clear we ask the inspector rather than each of us doing it our own way.",
          vocab:["procedure","drawing","inspector"]},
        t3:{ask:"Anything about this prep that could put someone at risk?",
          model:"Cutting and grinding is hot work, and plate on trestles has to be chocked. And tube ends are sharp until they're deburred — that's how people take the skin off a hand.",
          vocab:["hot work","chock","trestle","deburr"]}
      },
      6: {
        open:{ask:"New procedure on this repair. Tell me back what you understand by it.",
          model:"It's a code repair on a pressure part to Section I, so the weld procedure is fixed and so is the sequence — preheat, fill, and inspection hold points in between. Nothing gets covered up before the inspector has seen it.",
          vocab:["code repair","pressure part","ASME Section I","preheat","hold point"]},
        t0:{ask:"What would you do if the procedure and the drawing disagree?",
          model:"Stop and ask the inspector. On a pressure part I don't choose between two documents — whichever governs, I want it confirmed before an arc is struck.",
          vocab:["procedure","inspector","governs","hold"]},
        t1:{ask:"If you're not certain about a step, what happens next?",
          model:"I ask before it's welded, not after. Once it's covered the only way to check it is to cut it out.",
          vocab:["hold point","cut-out","inspection"]},
        t2:{ask:"How would you explain it to someone who missed the briefing?",
          model:"Code repair, fixed procedure, preheat before you start, and stop at every hold point for the inspector. Then send them to the procedure on the board rather than relying on me.",
          vocab:["code repair","preheat","hold point","procedure"]},
        t3:{ask:"Anything in it that changes how you protect yourself?",
          model:"Preheat means the plate stays hot long after you stop — gloves and sleeves, and mind what you lean on. And if it's inside the vessel, the permit and the gas test apply the whole time, not only at entry.",
          vocab:["preheat","PPE","permit","gas test","confined space"]}
      },
      7: {
        openings: {
          qa:"I'm Amelia, I inspect this vessel. You had a question on the drawing — which detail?",
          supervisor:"Daniel here. You flagged something on the drawing. Which detail?",
          coworker:"Luis. You said the tube layout isn't clear — what's the problem?",
          hr:"Maya from HR, observing. Tell me what your question on the drawing is.",
          safety:"Priya, safety. Before you go in — what's the question on the drawing?"
        },
        open:{ask:"You had a question on the drawing. Which detail?",
          model:"The tube layout on the lower bank. The drawing gives me the pitch but not which holes were plugged in the last repair, and I can't set out the replacements without knowing which ones are live.",
          vocab:["tube layout","pitch","plugged","bank"]},
        t0:{ask:"So what do you think it's asking for?",
          model:"I read it as the full row replaced and the two plugged tubes left alone. But that's my reading — if it's wrong I've either done work nobody asked for or left two tubes that should have come out.",
          vocab:["row","plugged","replacement"]},
        t1:{ask:"If I'm not available, who else would you ask?",
          model:"The inspector, or the outage supervisor if it's urgent. If nobody is available it waits — I don't pull tubes on an assumption.",
          vocab:["inspector","outage supervisor","hold"]},
        t2:{ask:"Would you carry on and check later, or wait?",
          model:"Wait. A tube I've pulled doesn't go back in, so everything before that is reversible and everything after it isn't. I'd move onto the prep work meanwhile.",
          vocab:["pull","reversible","sequence"]},
        t3:{ask:"How would you record the answer so the next person has it?",
          model:"Mark it on the drawing with the date and who confirmed it, and get it into the outage record. On a repair the history matters as much as the work — the next inspector will ask.",
          vocab:["mark-up","outage record","repair history","sign-off"]}
      },
      1: {
        openings: {
          hr:"Good morning — you must be the new boilermaker. I'm Maya from HR. Tell me a little about yourself and the work you've done.",
          supervisor:"Morning. Daniel, I run this outage. Before I put you on anything, tell me what vessels you've worked on.",
          coworker:"Hey — you're the new one, right? I'm Luis. What kind of work were you doing before this?",
          safety:"Morning. Priya, safety officer. Everyone gets five minutes with me on day one. Tell me about your experience first.",
          qa:"You're new — I'm Amelia, I inspect every tube that goes back in. Tell me where you've worked and what you've done."
        },
        open:{ask:"Tell me about yourself and the work you've done.",
          model:"I'm a boilermaker with six years' experience. Most of it on power boilers and pressure vessels — tube replacement, steam drum work and tank repair. The last two years were outage work, so I'm used to turnarounds and to working under a permit.",
          vocab:["power boiler","pressure vessel","steam drum","tube","turnaround","permit"]},
        t0:{ask:"We do a lot of tube work here. What are you comfortable with?",
          model:"Rolling and expanding tubes into a tube sheet, and seal welding on replacements. Big vessel plate work I've done less of, so I'd want pairing up for the first few. I'm happy to do a test roll so you can see.",
          vocab:["rolling","expanding","tube sheet","seal weld","plate"]},
        t1:{ask:"Before you go near a vessel — walk me through what you check to work safely.",
          model:"First my PPE. Then whether it's open work or a confined space, because that changes everything — I want the lines blinded, LOTO on the valves and a posted permit. Then my gear and the atmosphere test. If any of that isn't in place I don't cross the boundary.",
          vocab:["PPE","confined space","blinded","LOTO","permit","multi-gas"]},
        t2:{ask:"If you're not sure about a job, who do you go to? We'd rather you ask.",
          model:"The supervisor, or the inspector if it's a code question. On vessel work a wrong guess isn't rework, it's a pressure part — so I'd rather stop and ask than find out at hydrotest.",
          vocab:["supervisor","inspector","pressure part","hydrotest","hold point"]},
        t3:{ask:"I inspect every tube that goes back in. If I reject one, how would you want me to tell you?",
          model:"Straight, and show me the tube. Whether it's the roll, the expansion or the seal, I want to know which and what the measurement was, so I can pull it and re-do it — and not put the same fault in the next forty.",
          vocab:["roll","expansion","seal","reject","tube sheet"]}
      },
      2: {
        open:{ask:"Before you go — give me the handover. What did you finish today?",
          model:"I finished the tube pulls on the bottom row — twelve out, holes cleaned and gauged. Six new tubes are in and rolled, the other six are staged but not fitted.",
          vocab:["tube pull","gauge","rolled","staged","tube sheet"]},
        t0:{ask:"Anything that gave you trouble? I'd rather hear it now than find it at ten o'clock.",
          model:"Two of the holes in the tube sheet came up oversize once I'd cleaned them. I've marked them and left them empty — they need the inspector before anything goes in, because a standard roll won't hold in them.",
          vocab:["tube sheet","oversize","roll","inspector","hold"]},
        t1:{ask:"Which of them have I still got to inspect?",
          model:"The six that are rolled, and the two marked holes. Nothing is seal welded yet, so anything you reject can still be pulled without cutting.",
          vocab:["rolled","seal weld","reject","pull"]},
        t2:{ask:"And what do you want the night shift to start with?",
          model:"The six staged tubes on the bottom row — they're cut to length and deburred. And leave the two marked holes alone until the inspector has been.",
          vocab:["staged","deburr","tube","inspector"]},
        t3:{ask:"Anything left in the area that could catch someone out?",
          model:"The drum manway is open with the permit still live, and there's a chain fall rigged over the access. I've tagged both, but nobody should be entering on my permit once I'm off site.",
          vocab:["manway","permit","chain fall","tag","confined space"]}
      },
      3: {
        openings: {
          supervisor:"That gear's yours for the lift. Tell me how you'd check it over before you start.",
          safety:"Priya, safety. Before anything moves — tell me how you check the lifting gear.",
          coworker:"Luis here. We're rigging in an hour. How do you go through the gear?",
          qa:"Amelia. Talk me through your gear check before the lift.",
          hr:"Maya from HR, observing today. Tell me how you'd check the lifting gear over."
        },
        open:{ask:"That gear's yours for the lift. Tell me how you'd check it over before you start.",
          model:"Slings and shackles first — the rating, then the condition: no cuts, no distortion, no missing pins, certification tags in date. Then the chain fall, the brake and the hook latch. If a tag is missing or the rating doesn't cover the load, it doesn't get used.",
          vocab:["sling","shackle","rating","chain fall","certification","hook latch"]},
        t0:{ask:"Say a shackle's got no rating tag on it. How would you report that?",
          model:"I take it out of service straight away, tell you, and tag it so nobody picks it up. An untagged shackle is an unknown rating, and I'm not guessing on something holding a vessel head over people.",
          vocab:["shackle","rating","out of service","tag","load"]},
        t1:{ask:"If the gear isn't right, what do you do — carry on, or stop?",
          model:"Stop. The lift doesn't happen until the gear is right. There's usually another set in the store, and if there isn't we wait. A dropped load isn't a delay you recover from.",
          vocab:["stop-work","lift","gear","dropped load"]},
        t2:{ask:"And how would you make sure nobody else uses it in the meantime?",
          model:"Tag it and physically take it off the rack into quarantine. A tag on its own gets ignored when somebody's in a hurry.",
          vocab:["tag","quarantine","out of service","rack"]},
        t3:{ask:"Tell me what you'd write in the log.",
          model:"The gear identification, what I found, the date and my name, and that it's quarantined. Enough that the next person can find the same item and know why it's out.",
          vocab:["log","identification","quarantine","record"]}
      },
      5: {
        open:{ask:"You flagged something on line two. Tell me what you saw.",
          model:"The vessel wasn't isolated. There was a valve still open upstream of the manway and the blind wasn't in, and the crew were ready to enter. I stopped it, and nobody has crossed the boundary since.",
          vocab:["isolation","valve","manway","blind","entry"]},
        t0:{ask:"Understood. What do you need from me to make it safe?",
          model:"The line physically blinded, LOTO on the valves with the locks visible, a posted confined space permit, and a gas test I can see the reading on. Once those four are in place I'll enter.",
          vocab:["blinded","LOTO","confined space permit","multi-gas","entry"]},
        t1:{ask:"The lads want to keep going. How do you tell them no?",
          model:"Plainly — the line isn't blinded, so nobody enters. Not an argument about who's right, just what has to be in place first. If they push it goes to you and to the permit issuer.",
          vocab:["blinded","entry","stop-work","escalate"]},
        t2:{ask:"Who else needs to know, right now?",
          model:"You, the permit issuer and the operator who controls that valve. And the standby attendant, because if anyone had gone in he's the one who'd have had to pull them out.",
          vocab:["permit issuer","operator","standby attendant","rescue"]},
        t3:{ask:"Does any of the work already done need looking at again?",
          model:"The entries on that vessel yesterday were on the same permit, so I'd want the permit and the isolation record checked. The work inside is fine — it's whether the isolation was ever proved that I'm not sure about.",
          vocab:["permit","isolation","record","verification"]}
      },
      8: {
        closing:"That's the job on site. Half rigging, half talking to people — you did both.",
        open:{ask:"Site's busy today. Tell me what you need from the other trades to get your work done.",
          model:"The area under the lift clear and barriered before the head comes off, and the scaffolders finished on the north side so the crane has a clear swing. With those two I can have the head off by midday.",
          vocab:["lift","barrier","exclusion zone","swing","crane"]},
        t0:{ask:"If someone's working below you, what do you say to them?",
          model:"They move. Nobody works under a suspended load. I tell them what's coming over and how long for, and put a barrier and a spotter on it. I'd rather lose ten minutes than drop something on somebody.",
          vocab:["suspended load","line of fire","barrier","spotter","exclusion zone"]},
        t1:{ask:"The electricians want the area for an hour. What do you tell them?",
          model:"I tell them what's rigged and when the lift is planned. If I can hold the lift an hour they can have the area; if the crane is booked I say so, and give them a time it's theirs.",
          vocab:["rigged","lift","crane","access","handover"]},
        t2:{ask:"And if that pushes your work back — how do you let me know?",
          model:"Straight away, not at the end of the shift. Which lift is affected and by how long, so you can put the crane on something else if it matters.",
          vocab:["lift","crane","programme","sequence"]},
        t3:{ask:"Give me a realistic time for the lift.",
          model:"Head off by midday if the area is clear by ten and the crane's on site. If the scaffold slips it's after lunch — I'd rather tell you now than promise midday and miss it.",
          vocab:["lift","crane","schedule","contingency"]}
      },
      9: {
        openings: {
          qa:"I'm Amelia, I inspect this vessel. You've found something — describe it to me.",
          supervisor:"Daniel here. You flagged something on the vessel. Talk me through it.",
          coworker:"It's Luis. You said there's something on the lower course — what have you got?",
          hr:"Maya from HR sitting in. Tell me what you found on the vessel.",
          safety:"Priya, safety. Before the code side of it — describe what you found on the vessel."
        },
        open:{ask:"You've found something on the vessel. Describe it to me.",
          model:"There's a crack in the seam on the lower course, about forty millimetres, running along the toe of the weld. It's a pressure part, so it's a code repair — not something I touch on my own.",
          vocab:["seam","crack","course","pressure part","code repair"]},
        t0:{ask:"How did it get past? I'm not blaming anyone, I want to know.",
          model:"It's under the lagging, so nobody would have seen it until this outage. And it looks like it's been growing — the surface inside the crack is oxidised, so it isn't new.",
          vocab:["lagging","outage","oxidised","crack","inspection"]},
        t1:{ask:"Alright. What would you want me to do differently?",
          model:"Get that course stripped and inspected every outage, not only when something is suspected. Two outages ago this was a small repair. Now it's a section.",
          vocab:["course","outage","strip","inspection","repair"]},
        t2:{ask:"What do we do with the parts already finished?",
          model:"Hold them and check the same seam on the other courses, starting with the ones done to the same procedure. If it's a procedure problem it won't be only this one.",
          vocab:["seam","course","weld procedure","hold","review"]},
        t3:{ask:"And how do we stop it happening on the next one?",
          model:"Put it in the inspection plan under the NBIC so the seam is examined at a set interval, rather than when somebody happens to look. And record this repair, so the history is there for the next inspector.",
          vocab:["NBIC","inspection plan","interval","repair record","traceability"]}
      },
      10: {
        open:{ask:"This is a controlled area. Tell me what you need in place before you start.",
          model:"Before I enter the steam drum I need the lines blinded off, LOTO executed on all the valves, a valid confined space permit posted, and continuous multi-gas testing reading normal. And a standby attendant at the manway who knows I'm in there.",
          vocab:["steam drum","blinded","LOTO","confined space permit","multi-gas","standby attendant"]},
        t0:{ask:"If the permit runs out mid-job, what do you do?",
          model:"I come out. The permit expiring means the conditions it was written against are no longer proved. It gets re-issued and the gas test redone before I go back in.",
          vocab:["permit","expiry","re-issue","gas test","entry"]},
        t1:{ask:"And what should I be watching for while you're working?",
          model:"The gas readings, and me. If the alarm goes, or you can't get an answer out of me, you don't come in — you raise it and get the rescue team. A standby who enters becomes the second casualty.",
          vocab:["standby attendant","gas alarm","rescue","casualty","entry"]},
        t2:{ask:"Who do you call if something changes in the area?",
          model:"You first, then the permit issuer and the control room operator. If anything upstream of my blinds changes, I want to be out before it's discussed.",
          vocab:["permit issuer","operator","blind","isolation","upstream"]},
        t3:{ask:"What has to be signed off before you leave?",
          model:"The permit closed and signed, tools and materials counted back out of the drum, and the entry log completed. Nothing gets boxed up until somebody has confirmed the space is empty.",
          vocab:["permit close-out","entry log","count","confined space"]}
      },
      11: {
        openings: {
          hr:"Thanks for coming in. I'm Maya. Start wherever you like — tell me about yourself.",
          supervisor:"Daniel, I run the outage crew you'd be joining. Tell me about yourself and the vessels you've worked on.",
          coworker:"I'm Luis, I'd be working alongside you. Tell me a bit about yourself.",
          safety:"Priya, safety officer, sitting in on the panel. Start with your background.",
          qa:"Amelia, inspection. I'd be checking your tube work. Tell me about yourself."
        },
        open:{ask:"Thanks for coming in. Start wherever you like — tell me about yourself.",
          model:"I'm a boilermaker with six years on power boilers and pressure vessels. Tube replacement, steam drum work and tank repair, mostly outage work to ASME Section I and the NBIC. I'm used to permits and confined space, and I do my own rigging checks.",
          vocab:["power boiler","pressure vessel","ASME Section I","NBIC","outage","rigging"]},
        t0:{ask:"Give me an example of a difficult job you finished.",
          model:"A drum tube replacement on a short outage where two holes in the tube sheet came up oversize. I stopped, got the inspector, and we agreed an oversize roll rather than guessing at it. It cost half a day and it held at hydrotest.",
          vocab:["tube sheet","oversize","roll","inspector","hydrotest"]},
        t1:{ask:"Tell me about a time you raised a safety concern.",
          model:"A crew were about to enter a vessel where the blind wasn't in — the valve was shut but not blinded. I stopped the entry and asked for the blind. Shut is not isolated, and I'd stop it again.",
          vocab:["blind","isolation","entry","valve","stop-work"]},
        t2:{ask:"How do you handle it when your work is rejected?",
          model:"I ask what the measurement was, then pull it and re-do it. On pressure parts a rejection is the system working — I'd far rather the inspector finds it than the hydrotest does.",
          vocab:["rejection","pressure part","inspector","hydrotest","re-do"]},
        t3:{ask:"And why this company? What are you looking for next?",
          model:"You run your own outages to Section I rather than subbing them out, which is where I want to be. I'm looking for a crew that holds the permit standard properly, because that's the part I'm not willing to be flexible on.",
          vocab:["outage","ASME Section I","permit","standard"]}
      },
      12: {
        open:{ask:"Last conversation before you go out for roles. Tell me who you are professionally now.",
          model:"I'm a boilermaker who proves the space before entering it, and says so out loud. I do my own rigging checks, I work to the code on pressure parts, and I stop a job rather than assume. That's what I'd want an employer to know.",
          vocab:["entry","rigging","pressure part","code","stop-work"]},
        t0:{ask:"What work are you aiming for next?",
          model:"Outage and turnaround work on power boilers, to Section I and the NBIC. I'd take a maintenance position too, but the outage work is where I learn fastest.",
          vocab:["outage","turnaround","power boiler","ASME Section I","NBIC"]},
        t1:{ask:"What part of your work do you still want to sharpen?",
          model:"Big vessel plate work — layout and fit-up on heads and courses. I can do it, but I'm slower than the people who do it every day, and I'd want time on it.",
          vocab:["plate","head","course","layout","fit-up"]},
        t2:{ask:"And what would you not compromise on?",
          model:"Blinded and proved before entry, and rated gear on a lift. Those two. Hours, pay, travel — all negotiable. I won't cross a manway on a permit I can't see.",
          vocab:["blinded","entry","rated gear","lift","manway"]},
        t3:{ask:"Give me your closing line — the one you'd end an interview with.",
          model:"As I'd say it on site: before I enter the steam drum I need the lines blinded, LOTO on the valves, a posted permit and a live gas test. That's the habit you're hiring.",
          vocab:["steam drum","blinded","LOTO","permit","gas test"]}
      }
    }
  };

  /* ==========================================================================
     The rest of the curriculum, in the trade's words.
     --------------------------------------------------------------------------
     The twelve-week plan, the phrase bank and the vocabulary intro were written
     for a welder, so a pipefitter was told to "introduce yourself as a welder in
     60-90 seconds" and given "I'm a welder with experience in fabrication and
     metalwork" to master in the phrase bank.

     Only the strings that name the job are overridden. Everything about how to
     hold a handover or raise a safety concern is the same work in all three
     trades, and duplicating it would create three copies to keep in step.

     Weeks 3, 6 and 10 have no workshop for a pipefitter, and 4, 6 and 7 none for
     a boilermaker — their nine workshops sit inside a twelve-week plan. Those
     weeks keep their communication theme and still carry shadowing, phrases and
     practice; only the wording that assumed welding changes.
     ========================================================================== */
  const CURRICULUM = {
    operator: {
      phrases: {
        0:  "I'm a refinery operator with experience in unit operations and handover.",
        10: "I will follow the approved operating procedure."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a refinery operator in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your operating background"},
                    Sat:{task:"Complete the First Day on the Unit simulation."} } },
        5: { learningObjective:"Use confident safety language before, during, and after unit work.",
             days:{ Sun:{task:"Give a safety briefing for a line-up and transfer."} } },
        6: { stage:"Stage 6 \u2014 Operating Procedures", theme:"Operating Procedures",
             learningObjective:"Explain an operating step, its limits, and the quality expectation.",
             vocabularyFocus:"Procedure, limit, deviation, hold point, and sequence.",
             days:{ Tue:{task:"Describe the order of a start-up step."},
                    Sun:{task:"Explain a safe operating procedure clearly."} } },
        10:{ vocabularyFocus:"Unit, isolation, permit, depressure, and pressure." },
        11:{ mission:"Stage mission: complete a confident refinery operator interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as a refinery operator."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the refinery operations journey."
    },
    instrumentation: {
      phrases: {
        0:  "I'm an instrumentation technician with experience in calibration and loop work.",
        10: "I will follow the approved calibration and bypass procedure."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a instrumentation technician in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your instrumentation background"},
                    Sat:{task:"Complete the First Day in the Instrument Shop simulation."} } },
        5: { learningObjective:"Use confident safety language before, during, and after work on a live loop.",
             days:{ Sun:{task:"Give a safety briefing for work on a protective loop."} } },
        6: { stage:"Stage 6 \u2014 Protective Functions", theme:"Protective Functions",
             learningObjective:"Explain a safety loop, its bypass control, and its proof test.",
             vocabularyFocus:"Loop, bypass, authority, proof test, and sequence.",
             days:{ Tue:{task:"Describe the order of a loop proof test."},
                    Sun:{task:"Explain a safe bypass procedure clearly."} } },
        10:{ vocabularyFocus:"Loop, isolation, permit, bypass, and classification." },
        11:{ mission:"Stage mission: complete a confident instrumentation interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as an instrumentation technician."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the instrumentation journey."
    },
    electrician: {
      phrases: {
        0:  "I'm an industrial electrician with experience in installation and safe isolation.",
        10: "I will follow the approved isolation procedure."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a industrial electrician in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your electrical background"},
                    Sat:{task:"Complete the First Day on an Electrical Crew simulation."} } },
        5: { learningObjective:"Use confident safety language before, during, and after electrical work.",
             days:{ Sun:{task:"Give a safety briefing for a safe isolation."} } },
        6: { stage:"Stage 6 \u2014 Installation Requirements", theme:"Installation Requirements",
             learningObjective:"Explain an installation method, its tests, and the quality expectation.",
             vocabularyFocus:"Circuit, rating, termination, test, and sequence.",
             days:{ Tue:{task:"Describe the order of a safe isolation."},
                    Sun:{task:"Explain a safe installation method clearly."} } },
        10:{ vocabularyFocus:"Circuit, isolation, permit, test dead, and arc flash." },
        11:{ mission:"Stage mission: complete a confident industrial electrician interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as an industrial electrician."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the electrical journey."
    },
    hse: {
      phrases: {
        0:  "I'm an HSE officer with experience in risk assessment and permit control.",
        10: "I will follow the approved permit-to-work procedure."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a HSE officer in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your HSE background"},
                    Sat:{task:"Complete the First Day as the Site HSE Officer simulation."} } },
        5: { learningObjective:"Use confident safety language to stop work and to keep a crew with you.",
             days:{ Sun:{task:"Give a toolbox talk on one control for today's job."} } },
        6: { stage:"Stage 6 \u2014 Permit Control", theme:"Permit Control",
             learningObjective:"Explain a control, who owns it, and how it is verified.",
             vocabularyFocus:"Hazard, control, permit, verification, and sequence.",
             days:{ Tue:{task:"Describe the order of a risk assessment."},
                    Sun:{task:"Explain a permit close-out clearly."} } },
        10:{ vocabularyFocus:"Confined space, isolation, permit, gas test, and rescue." },
        11:{ mission:"Stage mission: complete a confident HSE officer interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as an HSE officer."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the HSE journey."
    },
    ndt: {
      phrases: {
        0:  "I'm an NDT technician with experience in weld examination and reporting.",
        10: "I will follow the approved written examination procedure."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a NDT technician in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your NDT background"},
                    Sat:{task:"Complete the First Day in the Inspection Team simulation."} } },
        5: { learningObjective:"Use confident safety language about your own method's hazards.",
             days:{ Sun:{task:"Give a safety briefing for a controlled examination area."} } },
        6: { stage:"Stage 6 \u2014 Examination Procedures", theme:"Examination Procedures",
             learningObjective:"Explain a written procedure, its calibration, and its acceptance criteria.",
             vocabularyFocus:"Procedure, calibration, sensitivity, criterion, and sequence.",
             days:{ Tue:{task:"Describe the order of a calibration before a scan."},
                    Sun:{task:"Explain an examination procedure clearly."} } },
        10:{ vocabularyFocus:"Controlled area, barrier, permit, monitor, and exclusion." },
        11:{ mission:"Stage mission: complete a confident NDT technician interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as an NDT technician."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the NDT journey."
    },
    process: {
      phrases: {
        0:  "I'm a process engineer with experience in troubleshooting and change control.",
        10: "I will follow the approved management-of-change process."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a process engineer in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your process engineering background"},
                    Sat:{task:"Complete the First Day in the Process Team simulation."} } },
        5: { learningObjective:"Use confident safety language about limits, safeguards, and change.",
             days:{ Sun:{task:"Give a briefing on an operating limit and what it protects."} } },
        6: { stage:"Stage 6 \u2014 Design Intent", theme:"Design Intent",
             learningObjective:"Explain design intent, the operating envelope, and the safeguards behind it.",
             vocabularyFocus:"Intent, envelope, safeguard, scenario, and sequence.",
             days:{ Tue:{task:"Describe the order of a management-of-change review."},
                    Sun:{task:"Explain a design intent clearly."} } },
        10:{ vocabularyFocus:"Unit, safeguard, permit, isolation, and pressure." },
        11:{ mission:"Stage mission: complete a confident process engineer interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as a process engineer."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the process engineering journey."
    },
    millwright: {
      phrases: {
        0:  "I'm a millwright with experience in rotating equipment and alignment.",
        10: "I will follow the approved maintenance procedure."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a millwright in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your millwright background"},
                    Sat:{task:"Complete the First Day on a Maintenance Crew simulation."} } },
        5: { learningObjective:"Use confident safety language before, during, and after machine work.",
             days:{ Sun:{task:"Give a safety briefing for isolating a machine."} } },
        6: { stage:"Stage 6 \u2014 Maintenance Procedures", theme:"Maintenance Procedures",
             learningObjective:"Explain a maintenance job, its sequence, and its acceptance checks.",
             vocabularyFocus:"Procedure, clearance, tolerance, acceptance check, and sequence.",
             days:{ Tue:{task:"Describe the order of a bearing change."},
                    Sun:{task:"Explain a safe isolation clearly."} } },
        10:{ vocabularyFocus:"Machine, isolation, permit, stored energy, and guard." },
        11:{ mission:"Stage mission: complete a confident millwright interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as a millwright."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the millwright journey."
    },
    pipefitter: {
      phrases: {
        0:  "I'm a pipefitter with experience in fabrication and pipe layout.",
        10: "I will follow the approved piping specification."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a pipefitter in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your pipefitting background"},
                    Sat:{task:"Complete the First Day on a Pipe Crew simulation."} } },
        5: { learningObjective:"Use confident safety language before, during, and after pipe work.",
             days:{ Sun:{task:"Give a safety briefing for a pipe-fitting task."} } },
        6: { stage:"Stage 6 \u2014 Piping Specifications", theme:"Piping Specifications",
             learningObjective:"Explain a piping specification, sequence, and quality expectation.",
             vocabularyFocus:"Specification, schedule, rating, tolerance, and sequence.",
             days:{ Tue:{task:"Describe the order of a fitting task."},
                    Sun:{task:"Explain a safe fitting procedure clearly."} } },
        10:{ vocabularyFocus:"Pipeline, joint, permit, isolation, and pressure." },
        11:{ mission:"Stage mission: complete a confident pipefitting interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as a pipefitter."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the pipefitting journey."
    },
    boilermaker: {
      phrases: {
        0:  "I'm a boilermaker with experience in pressure vessels and tube work.",
        10: "I will follow the approved repair procedure."
      },
      weeks: {
        1: { mission:"Stage mission: introduce yourself as a boilermaker in 60\u201390 seconds.",
             days:{ Tue:{focus:"Your boilermaking background"},
                    Sat:{task:"Complete the First Day on a Vessel Job simulation."} } },
        5: { learningObjective:"Use confident safety language before, during, and after vessel work.",
             days:{ Sun:{task:"Give a safety briefing for a vessel entry."} } },
        6: { stage:"Stage 6 \u2014 Vessel Procedures", theme:"Vessel Procedures",
             learningObjective:"Explain a repair procedure, sequence, and quality expectation.",
             vocabularyFocus:"Procedure, pressure part, tolerance, hold point, and sequence.",
             days:{ Tue:{task:"Describe the order of a tube replacement."},
                    Sun:{task:"Explain a safe repair procedure clearly."} } },
        10:{ vocabularyFocus:"Vessel, seam, permit, isolation, and pressure." },
        11:{ mission:"Stage mission: complete a confident boilermaker interview introduction.",
             days:{ Tue:{task:"Answer \u2018Tell me about yourself\u2019 as a boilermaker."} } }
      },
      vocabIntro:"Save the terms that help you communicate clearly through every stage of the boilermaking journey."
    }
  };

  /** One week of the plan in the trade's words. Returns the pack's own week when
     the trade has nothing to say about it, so callers never need to check. */
  function weekFor(trade, week){
    const ov = trade && CURRICULUM[trade.id] && CURRICULUM[trade.id].weeks && CURRICULUM[trade.id].weeks[week && week.n];
    if (!ov) return week;
    const out = Object.assign({}, week, ov);
    if (ov.days){
      out.days = Object.assign({}, week.days);
      Object.keys(ov.days).forEach(d => { out.days[d] = Object.assign({}, out.days[d], ov.days[d]); });
    }
    return out;
  }
  /** One phrase-bank line, where the shared one names the wrong job. */
  function phraseFor(trade, index){
    const ph = trade && CURRICULUM[trade.id] && CURRICULUM[trade.id].phrases;
    return (ph && ph[index]) || null;
  }
  function vocabIntroFor(trade){
    return (trade && CURRICULUM[trade.id] && CURRICULUM[trade.id].vocabIntro) || null;
  }
  /** Codes for a module: the profession's standards first, then whatever the
     caller falls back to (the jurisdiction, then the pack). Null — not [] —
     means this profession adds nothing here, so the caller keeps its fallback.

     `moduleCodes` on a trade object is the pre-registry form and is still
     honoured, because a pack or a future trade may carry citations the registry
     does not model yet. The registry wins where both exist. */
  function codesFor(trade, moduleId){
    const ps = global.ProfessionalStandards;
    const fromRegistry = trade && ps && ps.codesFor ? ps.codesFor(trade.id, moduleId) : null;
    if (fromRegistry && fromRegistry.length) return fromRegistry;
    const own = trade && trade.moduleCodes && trade.moduleCodes[moduleId];
    return own && own.length ? own.slice() : null;
  }
  /** The standards themselves, not their display strings: what the feedback card
     and the AI coach need in order to say WHY a citation applies. */
  function standardsFor(trade, moduleId){
    const ps = global.ProfessionalStandards;
    if (!trade || !ps) return {professionId:"", standards:[], primary:[], focus:"", verified:false};
    return ps.context(trade.id, moduleId);
  }
  /** The ten professions in the four groups the library already uses. */
  function groups(){
    return GROUPS.map(g => ({id:g.id, trades:g.cats.map(id => BY_ID.get(id)).filter(Boolean)}))
                 .filter(g => g.trades.length);
  }
  /** Extra benchmarks this trade adds to a module. */
  function benchmarksFor(trade, moduleId){
    return (trade && trade.moduleBenchmarks && trade.moduleBenchmarks[moduleId]) || [];
  }
  /** What this trade is asked at one question of one workshop, and what a good
     answer to it sounds like. Null means the pack's own version stands. */
  function questionFor(trade, moduleId, key){
    const mod = trade && WORKSHOPS[trade.id] && WORKSHOPS[trade.id][moduleId];
    return (mod && mod[key]) || null;
  }
  /** How this workshop signs off, where the shared wording names the wrong job. */
  function closingFor(trade, moduleId){
    const mod = trade && WORKSHOPS[trade.id] && WORKSHOPS[trade.id][moduleId];
    return (mod && mod.closing) || null;
  }
  /** The line a character opens this workshop with, in the trade's own words. */
  function openingFor(trade, moduleId, characterId){
    const mod = trade && WORKSHOPS[trade.id] && WORKSHOPS[trade.id][moduleId];
    if (mod && mod.openings && mod.openings[characterId])
      return { text: mod.openings[characterId], needsGreeting: false };
    /* No bespoke greeting for this character, but if the trade rewrote the
       question the pack's greeting would still ask the welder's version of it.
       Fall back to the engine's own shape — name, role, question — rather than
       leaving the wrong question in a familiar voice. */
    return (mod && mod.open && mod.open.ask) ? { text: mod.open.ask, needsGreeting: true } : null;
  }
  function vocabFor(trade){ return (trade && trade.vocab) ? trade.vocab.slice() : []; }
  /** Is this workshop part of the trade's set? Unlisted trades keep everything. */
  function coversModule(trade, moduleId){
    if (!trade || !trade.modules || !trade.modules.length) return true;
    return trade.modules.indexOf(Number(moduleId)) >= 0;
  }
  /** The trade's own wording for a workshop, where the generic one is wrong for it. */
  function scenarioFor(trade, moduleId){
    return (trade && trade.scenarios && trade.scenarios[moduleId]) || null;
  }

  global.Trades = Object.freeze({
    all: () => TRADES.slice(),
    get: id => BY_ID.get(id) || null,
    active, setActive, codesFor, standardsFor, groups, benchmarksFor, questionFor, openingFor, closingFor, weekFor, phraseFor, vocabIntroFor, vocabFor, coversModule, scenarioFor,
    DEFAULT_ID
  });
})(window);
