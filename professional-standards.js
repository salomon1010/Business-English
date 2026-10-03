/* ============================================================================
   BE Mastery — Professional standards registry
   --------------------------------------------------------------------------
   A learner who has chosen "HSE Officer" and is then told their answer was
   judged against AWS D1.1 has been handed somebody else's job. Worse, a report
   that cites nothing at all reads as one more AI opinion — which is exactly the
   thing this app is not.

   So the standards a profession is held to are DATA, not prose inside a prompt,
   and they live here once. Three files already carried pieces of this:

     • jurisdictions.js — which document applies WHERE (Canada, UK/EU, oil & gas).
       Geography. Untouched by this file and still the authority for it.
     • trades.js        — which document applies to WHOM (welder, pipefitter,
       boilermaker), as `moduleCodes` display strings.
     • the track packs  — the pack's own `regulatory.codes` fallback.

   This file takes over the second of those and gives it structure, because a
   citation string cannot answer "why does this apply to me?". Every standard is
   an object: who publishes it, what it governs, what it expects of a person in
   plain English. `trades.js` now holds only the profession's ids and delegates
   here, so there is one list to correct when a standard is superseded.

   ── The honesty rules, which are the whole point ──────────────────────────
   1. Nothing here is invented. Every entry is a published standard that exists
      under the code given, from the body given.
   2. NO CLAUSE NUMBERS unless the repository already carried that exact clause
      and it is genuinely part of the document (ISO 9001 Clause 8.7 and the OSHA
      29 CFR paragraph numbers below came from jurisdictions.js and are real).
      Where only the standard is known, only the standard is named. A fabricated
      "Clause 7.4.2 requires…" would be worse than no citation at all.
   3. `expects` is a plain-English paraphrase of the standard's subject written
      for an English learner. It is NOT a quotation and must never be presented
      as one. It says what a competent person is expected to be able to explain,
      which is what this app actually assesses.
   4. Editions are deliberately omitted. Standards are amended; the project
      specification governs. Every surface that shows these says so.
   5. `reviewed:false` on the registry as a whole — the mapping is written from
      published scope statements and industry practice and has NOT been reviewed
      by a qualified practitioner in each trade. It must be before it informs
      anyone's hiring decision. Same standing rule as trades.js.

   What this file never does: claim the learner is certified, compliant, or
   qualified. Coverage of a spoken answer is evidence of communication. The
   awarding body issues the ticket.
   ============================================================================ */
(function(global){

  /* ==========================================================================
     The registry. id → the standard itself.
     `topics` are the subjects this standard is being cited FOR in this app —
     they drive the "Professional focus" line under a report, so they are short
     and concrete rather than a table of contents.
     ========================================================================== */
  const STANDARDS = {

    /* ---- Management systems, safety and risk (cross-profession) ---------- */
    "iso-45001": {code:"ISO 45001", org:"ISO", title:"Occupational health and safety management systems", short:"Occupational health and safety",
      topics:["hazard identification","the duty to stop unsafe work","operational control"],
      expects:"Say what the hazard was, what control you put in place, and that you stopped work when the control was not there."},
    "iso-31000": {code:"ISO 31000", org:"ISO", title:"Risk management", short:"Risk management",
      topics:["risk assessment","risk treatment","communicating risk"],
      expects:"Talk through a risk in order: what could happen, how likely and how bad, what control you chose, and how you checked it worked."},
    "iso-14001": {code:"ISO 14001", org:"ISO", title:"Environmental management systems",
      topics:["environmental aspects","spill and waste control","incident response"],
      expects:"Name the environmental effect of the work and the control that keeps it contained."},
    "iso-9001": {code:"ISO 9001", org:"ISO", title:"Quality management systems",
      topics:["control of nonconforming work","corrective action","records"],
      expects:"Describe what was wrong, how it was contained, who was told, and what stops it happening again."},
    "iso-9001-87": {code:"ISO 9001 Clause 8.7", org:"ISO", title:"Control of nonconforming outputs",
      topics:["quarantine","disposition","records of nonconformity"],
      expects:"Say that the nonconforming item was identified and controlled so it could not be used by mistake."},
    "iso-55000": {code:"ISO 55000", org:"ISO", title:"Asset management",
      topics:["asset condition","maintenance planning","value from assets"],
      expects:"Connect what you did on the machine to the condition it is now in and when it should next be looked at."},
    "osha-psm": {code:"OSHA 29 CFR 1910.119", org:"OSHA", title:"Process safety management of highly hazardous chemicals", short:"Process Safety Management",
      topics:["operating procedures","management of change","pre-startup safety review"],
      expects:"Show that the procedure was followed as written, and that any change to it went through the change process before the plant ran."},
    "osha-confined": {code:"OSHA 29 CFR 1910.146", org:"OSHA", title:"Permit-required confined spaces", short:"Permit-required confined spaces",
      topics:["atmospheric testing","entry permit","attendant and rescue"],
      expects:"State the space was tested, the permit is posted and current, and there is an attendant outside before anyone crosses."},
    "osha-loto": {code:"OSHA 29 CFR 1910.147", org:"OSHA", title:"The control of hazardous energy (lockout/tagout)", short:"Lockout/Tagout",
      topics:["energy isolation","locks and tags","verification of zero energy"],
      expects:"Say every energy source was isolated, locked, tagged, and then proved dead — proved, not assumed."},
    "osha-machine-guarding": {code:"OSHA 29 CFR 1910.212", org:"OSHA", title:"General requirements for all machines",
      topics:["machine guarding","point of operation","guard removal and replacement"],
      expects:"State that guards were in place before the machine ran, and that removing one meant the machine was isolated first."},
    "nfpa-51b": {code:"NFPA 51B", org:"NFPA", title:"Fire prevention during welding, cutting and other hot work",
      topics:["hot work permit","fire watch","area preparation"],
      expects:"Say the area was cleared and checked, the permit is in place, and who is holding the fire watch and for how long after."},

    /* ---- Welding -------------------------------------------------------- */
    "aws-d1-1": {code:"AWS D1.1", org:"AWS", title:"Structural Welding Code — Steel", short:"Structural Steel",
      topics:["welder qualification","workmanship","visual acceptance criteria"],
      expects:"Name the acceptance criterion you were working to, not just that the weld 'looked good'."},
    "asme-ix": {code:"ASME BPVC Section IX", org:"ASME", title:"Welding, brazing and fusing qualifications", short:"Pressure Vessels",
      topics:["procedure qualification","performance qualification","essential variables"],
      expects:"Explain which procedure you were welding to and which variables you are not allowed to change on your own."},
    "iso-9606-1": {code:"ISO 9606-1", org:"ISO", title:"Qualification testing of welders — fusion welding of steels", short:"Welder Qualification",
      topics:["qualification range","test position","validity and continuity"],
      expects:"State what your qualification actually covers — process, position, material and thickness — and when it expires."},
    "iso-3834": {code:"ISO 3834", org:"ISO", title:"Quality requirements for fusion welding of metallic materials",
      topics:["welding coordination","inspection before, during and after","records"],
      expects:"Show the checks that happen before the arc is struck, not only the ones after."},
    "iso-5817": {code:"ISO 5817", org:"ISO", title:"Quality levels for imperfections in fusion-welded joints",
      topics:["named imperfections","quality levels","acceptance limits"],
      expects:"Name the imperfection in standard terms — undercut, porosity, lack of fusion — and the level it is judged against."},
    "iso-15614-1": {code:"ISO 15614-1", org:"ISO", title:"Specification and qualification of welding procedures — procedure test",
      topics:["procedure qualification record","range of approval"],
      expects:"Say that the procedure was qualified by test before production welding started."},
    "iso-15609-1": {code:"ISO 15609-1", org:"ISO", title:"Welding procedure specification — arc welding",
      topics:["WPS content","parameters","reading back a procedure"],
      expects:"Read the parameters back from the WPS and ask when one of them is missing or unclear."},
    "iso-2553": {code:"ISO 2553", org:"ISO", title:"Welding and allied processes — symbolic representation on drawings",
      topics:["weld symbols","joint detail on drawings"],
      expects:"Read the weld symbol off the drawing and say what it tells you to make."},

    /* ---- Piping and pressure equipment ----------------------------------- */
    "asme-b31-1": {code:"ASME B31.1", org:"ASME", title:"Power Piping", short:"Power Piping",
      topics:["fabrication and assembly","examination","supports"],
      expects:"Say which piping code the line is built to before you talk about tolerances."},
    "asme-b31-3": {code:"ASME B31.3", org:"ASME", title:"Process Piping", short:"Process Piping",
      topics:["materials and fabrication","alignment and fit-up","examination and acceptance"],
      expects:"State the alignment tolerance you are working to and who checks it before the joint is welded out."},
    "asme-b16-5": {code:"ASME B16.5", org:"ASME", title:"Pipe flanges and flanged fittings", short:"Pipe flanges",
      topics:["flange rating","facing and bolting","gasket seating"],
      expects:"Name the flange rating and that the gasket and bolting match it."},
    "en-10204": {code:"EN 10204", org:"CEN", title:"Metallic products — types of inspection documents",
      topics:["material certificates","traceability"],
      expects:"Say you checked the material certificate against the drawing before cutting."},
    "iso-6708": {code:"ISO 6708", org:"ISO", title:"Pipework components — definition and selection of DN (nominal size)",
      topics:["nominal size","reading sizes off an isometric"],
      expects:"Use the nominal size from the drawing rather than a measured guess."},
    "asme-i": {code:"ASME BPVC Section I", org:"ASME", title:"Rules for construction of power boilers", short:"Power Boilers",
      topics:["pressure parts","tube and drum work","hold points"],
      expects:"Say which hold points the inspector signs before you go past them."},
    "asme-viii": {code:"ASME BPVC Section VIII", org:"ASME", title:"Rules for construction of pressure vessels", short:"Pressure Vessels",
      topics:["vessel fabrication","examination","acceptance"],
      expects:"Describe the repair or the seam in the terms the inspection code uses."},
    "asme-ii": {code:"ASME BPVC Section II", org:"ASME", title:"Materials",
      topics:["material specification","substitution"],
      expects:"Confirm the material is the one the drawing calls for, and stop if it is not."},
    "asme-v": {code:"ASME BPVC Section V", org:"ASME", title:"Nondestructive examination", short:"Nondestructive examination",
      topics:["examination methods","procedures","records of examination"],
      expects:"Name the method and the written procedure you examined to, and what the record says."},
    "nbic": {code:"NBIC (NB-23)", org:"National Board", title:"National Board Inspection Code", short:"National Board Inspection Code",
      topics:["repairs and alterations","in-service inspection","pressure testing"],
      expects:"Say that a repair to a pressure part follows an accepted repair procedure and is inspected, not just welded."},
    "api-510": {code:"API 510", org:"API", title:"Pressure vessel inspection code",
      topics:["in-service inspection","repair and alteration","inspection intervals"],
      expects:"Refer a vessel finding to the inspection programme rather than deciding its fate at the job."},
    "api-570": {code:"API 570", org:"API", title:"Piping inspection code",
      topics:["in-service piping inspection","thickness monitoring","repair"],
      expects:"Report a piping finding against the inspection programme, with where and what you measured."},
    "api-520": {code:"API RP 520", org:"API", title:"Sizing, selection and installation of pressure-relieving devices",
      topics:["relief scenarios","device selection and installation"],
      expects:"Name the relieving scenario the device is there for before discussing its size."},
    "api-521": {code:"API STD 521", org:"API", title:"Pressure-relieving and depressuring systems", short:"Pressure relief and depressuring",
      topics:["overpressure scenarios","flare and disposal systems","depressuring"],
      expects:"Explain which upset the protection is designed for and where the relieved fluid goes."},
    "api-2350": {code:"API STD 2350", org:"API", title:"Overfill protection for storage tanks in petroleum facilities",
      topics:["tank gauging","alarm levels","receipt monitoring"],
      expects:"Say what level you were watching, what the alarm setting is, and what you do when it sounds."},

    /* ---- Process operations and process safety --------------------------- */
    "api-754": {code:"API RP 754", org:"API", title:"Process safety performance indicators for the refining and petrochemical industries", short:"Process safety indicators",
      topics:["process safety events","leading and lagging indicators","reporting"],
      expects:"Report a loss of containment as a process safety event, with what was released and how much."},
    "iec-61511": {code:"IEC 61511", org:"IEC", title:"Functional safety — safety instrumented systems for the process industry", short:"Functional safety (process)",
      topics:["safety instrumented functions","bypasses and overrides","proof testing"],
      expects:"Say that a bypass of a protective function was authorised, time-limited and recorded."},
    "iec-61508": {code:"IEC 61508", org:"IEC", title:"Functional safety of electrical/electronic/programmable electronic safety-related systems",
      topics:["safety lifecycle","integrity levels","proof testing"],
      expects:"Treat a protective loop as safety-related: prove it works rather than assume it does."},
    "iec-60079": {code:"IEC 60079", org:"IEC", title:"Explosive atmospheres — equipment and installation", short:"Explosive atmospheres",
      topics:["hazardous area classification","protection concepts","inspection of Ex equipment"],
      expects:"Say the area is classified and that the equipment and your work method are right for that classification."},
    "isa-5-1": {code:"ANSI/ISA-5.1", org:"ISA", title:"Instrumentation symbols and identification", short:"Instrumentation symbols",
      topics:["P&ID symbols","tag numbers","loop identification"],
      expects:"Use the tag number from the P&ID when you name an instrument, not 'the transmitter over there'."},
    "iso-17025": {code:"ISO/IEC 17025", org:"ISO/IEC", title:"General requirements for the competence of testing and calibration laboratories",
      topics:["measurement traceability","calibration records"],
      expects:"Say the calibration is traceable and in date, and where the record is."},

    /* ---- Electrical ------------------------------------------------------ */
    "nfpa-70": {code:"NFPA 70 (NEC)", org:"NFPA", title:"National Electrical Code", short:"National Electrical Code",
      topics:["installation requirements","conductors and protection","grounding and bonding"],
      expects:"Name the installation requirement you worked to rather than 'the way we usually do it'."},
    "nfpa-70e": {code:"NFPA 70E", org:"NFPA", title:"Standard for electrical safety in the workplace", short:"Electrical safety in the workplace",
      topics:["establishing an electrically safe work condition","arc-flash and shock risk assessment","PPE"],
      expects:"Say you established an electrically safe work condition — tested dead with a proved meter — before touching it."},
    "iec-60364": {code:"IEC 60364", org:"IEC", title:"Low-voltage electrical installations",
      topics:["protection for safety","verification and testing","earthing"],
      expects:"State the test you did to verify the installation, and its result."},
    "ieee-1584": {code:"IEEE 1584", org:"IEEE", title:"Guide for performing arc-flash hazard calculations",
      topics:["incident energy","approach boundaries"],
      expects:"Refer to the arc-flash label on the equipment rather than judging the energy by eye."},
    "osha-subpart-s": {code:"OSHA 29 CFR 1910 Subpart S", org:"OSHA", title:"Electrical",
      topics:["safety-related work practices","de-energised and energised work"],
      expects:"Say why the work was done de-energised, or what authorised it to be done live."},

    /* ---- Inspection and NDT ---------------------------------------------- */
    "iso-9712": {code:"ISO 9712", org:"ISO", title:"Non-destructive testing — qualification and certification of NDT personnel", short:"NDT personnel certification",
      topics:["method and level","scope of certification","validity"],
      expects:"State your method and level, and that the work you signed for is inside that scope."},
    "asnt-snt-tc-1a": {code:"ASNT SNT-TC-1A", org:"ASNT", title:"Recommended practice for personnel qualification and certification in NDT",
      topics:["employer written practice","levels I, II and III"],
      expects:"Say your certification follows the employer's written practice and what level it is."},
    "iso-17636": {code:"ISO 17636", org:"ISO", title:"Non-destructive testing of welds — radiographic testing",
      topics:["technique and class","image quality","interpretation"],
      expects:"Name the technique and the image-quality requirement before discussing what the film shows."},
    "iso-17640": {code:"ISO 17640", org:"ISO", title:"Non-destructive testing of welds — ultrasonic testing",
      topics:["scanning technique","calibration","evaluation levels"],
      expects:"Say the set was calibrated on the reference block before the scan, and to what."},
    "iso-3452": {code:"ISO 3452", org:"ISO", title:"Non-destructive testing — penetrant testing",
      topics:["surface preparation","dwell and development time"],
      expects:"Give the dwell and development times you held, because the result is worthless without them."},
    "iso-9934": {code:"ISO 9934", org:"ISO", title:"Non-destructive testing — magnetic particle testing",
      topics:["magnetisation","field strength verification","demagnetisation"],
      expects:"Say how you verified the field before you accepted the indication."},

    /* ---- Mechanical maintenance and rigging ------------------------------ */
    "iso-20816": {code:"ISO 20816", org:"ISO", title:"Mechanical vibration — measurement and evaluation of machine vibration", short:"Machine vibration",
      topics:["measurement position","evaluation zones","trending"],
      expects:"Report a vibration reading with where it was taken and how it compares with the last one."},
    "iso-21940": {code:"ISO 21940", org:"ISO", title:"Mechanical vibration — rotor balancing",
      topics:["balance quality grades","field balancing"],
      expects:"Say the balance grade the rotor is required to meet, not just that it 'runs smoother'."},
    "asme-b30-5": {code:"ASME B30.5", org:"ASME", title:"Mobile and locomotive cranes",
      topics:["lift planning","load charts","signals"],
      expects:"Name the load, the chart you read it against, and who is directing the lift."},
    "asme-b30-9": {code:"ASME B30.9", org:"ASME", title:"Slings", short:"Slings",
      topics:["sling selection","inspection before use","removal from service"],
      expects:"Say the sling was inspected before the lift and what would take it out of service."},

    /* ---- Employer documents (real, but not published standards) ---------- */
    /* These are kept separate in intent: they are cited as the employer's own
       controlling document, never dressed up as a numbered standard. */
    "employer-permit": {code:"Employer permit-to-work procedure", org:"Employer", title:"Site permit and isolation procedure", short:"Permit to work",
      topics:["permit issue and close-out","isolation","validity"],
      expects:"Say the permit is issued, posted and still valid, and what closes it out.",
      employer:true},
    "employer-induction": {code:"Employer safety induction procedure", org:"Employer", title:"Site induction and onboarding",
      topics:["site rules","reporting lines","emergency arrangements"],
      expects:"Show you know who you report to and what the site expects on day one.",
      employer:true},
    "employer-operating": {code:"Employer operating procedure", org:"Employer", title:"Unit operating and handover procedure", short:"Operating and handover procedure",
      topics:["normal operating limits","shift handover","abnormal conditions"],
      expects:"Hand over against the procedure: state, deviations, outstanding work, and what the next shift must watch.",
      employer:true},
    "employer-maintenance": {code:"Employer maintenance procedure", org:"Employer", title:"Work order and maintenance procedure", short:"Work order procedure",
      topics:["work order","acceptance back into service","records"],
      expects:"Say what the work order asked for, what you found, and on what basis the machine went back into service.",
      employer:true}
  };

  /* ==========================================================================
     Profession → standards. `primary` is the profession's own short list — what
     the profile card shows and what the coach is told the learner works under.
     `modules` maps a workshop number to the standards that workshop is judged
     against for THIS profession, and `focus` is the one-line professional focus
     shown beside them.

     A module with no entry falls through to the jurisdiction and then to the
     pack — the same order the report already used. Silence here is not a gap in
     the data; it means the profession adds nothing to what geography already
     says, which is true for most communication-only workshops.
     ========================================================================== */
  const PROFESSIONS = {

    welder: {
      primary: ["aws-d1-1","asme-ix","iso-9606-1"],
      modules: {
        3:  ["iso-3834"],
        4:  ["iso-3834","en-10204"],
        6:  ["asme-ix","iso-15609-1","iso-15614-1"],
        7:  ["iso-2553"],
        9:  ["aws-d1-1","iso-5817"],
        10: ["employer-permit","nfpa-51b"],
        11: ["iso-9606-1","asme-ix","aws-d1-1"],
        12: ["iso-9606-1"]
      },
      focus: {
        6:  "Welding procedure and qualification requirements",
        9:  "Naming an imperfection and the level it is judged against",
        11: "The range your qualification actually covers",
        12: "Validity and continuity of welder qualification"
      }
    },

    pipefitter: {
      primary: ["asme-b31-3","asme-b31-1","asme-b16-5"],
      modules: {
        4:  ["asme-b31-3","en-10204"],
        6:  ["asme-b31-1","asme-b31-3"],
        7:  ["asme-b31-3","iso-6708"],
        9:  ["asme-b31-3","api-570"],
        10: ["employer-permit","osha-loto"],
        11: ["asme-b31-3"],
        12: ["asme-b31-3"]
      },
      focus: {
        4:  "Material identity and fit-up tolerance before welding",
        7:  "Dimensional requirements and who resolves a missing one",
        9:  "Examination and acceptance of a fabricated joint",
        10: "Line break: isolation proved before the joint is opened",
        11: "The piping code the line is built to, and its tolerances",
        12: "Working to the drawing and the specification, not to habit"
      }
    },

    boilermaker: {
      primary: ["asme-i","asme-viii","nbic"],
      modules: {
        4:  ["asme-ii","nbic"],
        6:  ["asme-i","asme-viii"],
        8:  ["asme-b30-5","asme-b30-9"],
        9:  ["nbic","asme-viii","api-510"],
        10: ["osha-confined","osha-loto","nbic"],
        11: ["asme-i","nbic"],
        12: ["nbic"]
      },
      focus: {
        8:  "Lift planning: load, gear and who directs it",
        9:  "Reporting a pressure-part finding against the inspection code",
        10: "Blinding and isolation proved before entry, not only permitted",
        11: "Code repair procedure and its hold points",
        12: "Repairs to pressure parts follow an accepted procedure and are inspected"
      }
    },

    operator: {
      primary: ["osha-psm","api-754","employer-operating"],
      modules: {
        2:  ["employer-operating"],
        3:  ["employer-operating","iec-61511"],
        5:  ["osha-psm","iso-45001"],
        6:  ["osha-psm","employer-operating"],
        8:  ["employer-permit","osha-psm"],
        9:  ["api-754","iso-9001"],
        10: ["employer-permit","osha-loto","osha-confined"],
        11: ["osha-psm","api-754"],
        12: ["osha-psm"]
      },
      focus: {
        2:  "Shift handover: plant state, deviations and what to watch",
        3:  "Protective functions and the authority to bypass one",
        6:  "Operating to the written procedure, and change control",
        9:  "Reporting a loss of containment as a process safety event",
        10: "Isolation and permit before the unit is opened",
        11: "Operating discipline: procedure, limits and escalation",
        12: "Operating to the written procedure and reporting a deviation early"
      }
    },

    instrumentation: {
      primary: ["isa-5-1","iec-61511","iec-60079"],
      modules: {
        3:  ["iso-17025","isa-5-1"],
        4:  ["isa-5-1"],
        5:  ["iec-60079","osha-loto"],
        6:  ["iec-61511","iec-61508"],
        7:  ["isa-5-1"],
        9:  ["iec-61511","iso-9001"],
        10: ["employer-permit","osha-loto","iec-60079"],
        11: ["iec-61511","isa-5-1"],
        12: ["iec-61511"]
      },
      focus: {
        3:  "Calibration traceability and whether it is in date",
        6:  "Safety instrumented functions, bypasses and proof testing",
        7:  "Naming a loop by its tag number from the P&ID",
        10: "Working on live instrument systems in a classified area",
        11: "Functional safety discipline around a protective loop",
        12: "A bypass is authorised, time-limited and proof-tested out"
      }
    },

    electrician: {
      primary: ["nfpa-70e","nfpa-70","osha-loto"],
      modules: {
        3:  ["nfpa-70e","ieee-1584"],
        5:  ["nfpa-70e","osha-subpart-s"],
        6:  ["nfpa-70","iec-60364"],
        7:  ["nfpa-70"],
        8:  ["employer-permit","osha-subpart-s"],
        9:  ["iec-60364","iso-9001"],
        10: ["osha-loto","nfpa-70e","iec-60079"],
        11: ["nfpa-70e","nfpa-70"],
        12: ["nfpa-70e"]
      },
      focus: {
        3:  "Proving a meter, and the arc-flash label on the panel",
        5:  "Establishing an electrically safe work condition",
        9:  "Verification test results, not an impression",
        10: "Lockout, test dead, and the classified-area method",
        11: "Safe work condition before anything is touched",
        12: "Isolate, lock, test dead, and prove the tester"
      }
    },

    hse: {
      primary: ["iso-45001","iso-31000","osha-psm"],
      modules: {
        1:  ["iso-45001","employer-induction"],
        3:  ["iso-45001"],
        5:  ["iso-45001","iso-31000"],
        6:  ["iso-45001","employer-permit"],
        8:  ["employer-permit","nfpa-51b"],
        9:  ["iso-45001","iso-9001"],
        10: ["osha-confined","osha-loto","employer-permit"],
        11: ["iso-45001","iso-31000"],
        12: ["iso-45001","iso-14001"]
      },
      focus: {
        5:  "Hazard, risk, control, verification — in that order",
        6:  "Permit control: who issues, who accepts, what closes it",
        8:  "Hot work: area preparation and the fire watch",
        9:  "Investigating and reporting rather than blaming",
        10: "Confined space: test, permit, attendant, rescue",
        11: "Risk assessment and the duty to stop unsafe work",
        12: "Controls that can be verified, and environmental effects controlled"
      }
    },

    ndt: {
      primary: ["iso-9712","asme-v","iso-5817"],
      modules: {
        3:  ["iso-17025","asme-v"],
        4:  ["asme-v","en-10204"],
        6:  ["asme-v","iso-17640","iso-17636"],
        7:  ["iso-2553","asme-v"],
        9:  ["iso-5817","asme-v","iso-9001-87"],
        10: ["employer-permit","osha-loto"],
        11: ["iso-9712","asnt-snt-tc-1a"],
        12: ["iso-9712"]
      },
      focus: {
        3:  "Calibration and the reference block before a scan",
        6:  "Examining to a written procedure, named",
        9:  "Naming the indication and the acceptance level",
        11: "Method, level and the scope you are certified for",
        12: "Validity of certification and the employer's written practice"
      }
    },

    process: {
      primary: ["osha-psm","api-521","iec-61511"],
      modules: {
        4:  ["asme-viii","asme-ii"],
        5:  ["osha-psm","iso-31000"],
        6:  ["osha-psm","api-520","api-521"],
        7:  ["isa-5-1"],
        8:  ["osha-psm"],
        9:  ["api-754","iso-9001"],
        10: ["osha-psm","employer-permit"],
        11: ["osha-psm","api-521"],
        12: ["osha-psm","api-754"]
      },
      focus: {
        5:  "Hazard study language: scenario, cause, consequence, safeguard",
        6:  "Relief scenarios and where the relieved fluid goes",
        8:  "Management of change before the plant runs differently",
        9:  "Process safety events and what the indicator is for",
        11: "Design intent, operating limits and the safeguards behind them",
        12: "Change assessed before the plant runs on it"
      }
    },

    millwright: {
      primary: ["osha-loto","iso-20816","asme-b30-9"],
      modules: {
        3:  ["osha-machine-guarding","osha-loto"],
        4:  ["employer-maintenance","iso-21940"],
        6:  ["employer-maintenance","iso-55000"],
        8:  ["asme-b30-5","asme-b30-9"],
        9:  ["iso-20816","iso-9001"],
        10: ["osha-loto","employer-permit","osha-machine-guarding"],
        11: ["osha-loto","iso-20816"],
        12: ["iso-55000"]
      },
      focus: {
        3:  "Guards in place, and isolation before one comes off",
        4:  "Alignment and balance to a stated grade",
        8:  "Rigging: load, gear, and who is directing",
        9:  "Vibration and alignment readings with their reference",
        10: "Zero energy proved before the guard is opened",
        11: "Isolation discipline and condition evidence",
        12: "Machine condition evidence tied to when it should next be looked at"
      }
    }
  };

  /* ==========================================================================
     API
     ========================================================================== */

  function get(id){
    const s = STANDARDS[id];
    return s ? Object.assign({id: id}, s) : null;
  }

  /** The profession's own short list, as full objects. Unknown profession → []. */
  function forProfession(professionId){
    const p = PROFESSIONS[professionId];
    if (!p) return [];
    return (p.primary || []).map(get).filter(Boolean);
  }

  /** The standards this profession's workshop N is judged against. May be []. */
  function forModule(professionId, moduleId){
    const p = PROFESSIONS[professionId];
    const ids = p && p.modules && p.modules[Number(moduleId)];
    return (ids || []).map(get).filter(Boolean);
  }

  /** Display strings, in the shape the report has always rendered.
     Null (not []) means "this profession adds nothing here" so the caller keeps
     its existing fallback to the jurisdiction. */
  function codesFor(professionId, moduleId){
    const list = forModule(professionId, moduleId);
    if (!list.length) return null;
    return list.map(label);
  }

  /** The chip a report prints. `short` exists so a chip stays readable —
     "AWS D1.1 — Structural Steel" rather than the full published title. */
  function label(s){
    if (!s) return "";
    return s.code + " — " + (s.short || s.title);
  }

  /** The profession's own short list as chips. */
  function chipsFor(professionId){
    return forProfession(professionId).map(label);
  }

  /** The one-line professional focus for this profession's workshop N. */
  function focusFor(professionId, moduleId){
    const p = PROFESSIONS[professionId];
    return (p && p.focus && p.focus[Number(moduleId)]) || "";
  }

  /** Everything a report or a coach needs about this moment, in one object.
     `verified` is false when the profession contributes nothing for this module:
     the caller must then say "general professional guidance" rather than
     implying a standard was applied. */
  function context(professionId, moduleId){
    const list = forModule(professionId, moduleId);
    const primary = forProfession(professionId);
    return {
      professionId: professionId || "",
      standards: list,
      primary: primary,
      focus: focusFor(professionId, moduleId),
      verified: list.length > 0
    };
  }

  /** Compact lines for an AI prompt. Names and subjects only — never a clause,
     and never an instruction to the model to produce one. */
  function promptLines(professionId, moduleId){
    const c = context(professionId, moduleId);
    const use = c.standards.length ? c.standards : c.primary;
    return use.map(s => s.code + " (" + s.org + ") — " + s.title + ": " + s.expects);
  }

  function professions(){ return Object.keys(PROFESSIONS); }

  global.ProfessionalStandards = Object.freeze({
    get, forProfession, forModule, codesFor, chipsFor, label, focusFor, context, promptLines, professions,
    /* exposed for tests and for a future editor; do not mutate */
    registry: () => Object.keys(STANDARDS).slice(),
    reviewed: false
  });
})(window);
