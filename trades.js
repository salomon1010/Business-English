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
      name: "Professional Welder", career: "welding",
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
      name: "Professional Pipefitter", career: "pipefitting",
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
        11: {title:"Pipefitting Interview", scenario:"Answer a hiring panel on layout, drawings and fabrication."}
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
      name: "Professional Boilermaker", career: "boilermaking",
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
        11: {title:"Boilermaker Interview", scenario:"Answer a hiring panel on vessels, rigging and permits."}
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
  /** Codes for a module: trade first, then whatever the caller falls back to. */
  function codesFor(trade, moduleId){
    const own = trade && trade.moduleCodes && trade.moduleCodes[moduleId];
    return own && own.length ? own.slice() : null;
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
    active, setActive, codesFor, benchmarksFor, questionFor, openingFor, closingFor, weekFor, phraseFor, vocabIntroFor, vocabFor, coversModule, scenarioFor,
    DEFAULT_ID
  });
})(window);
