/* AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Source of truth: tracks/welding/practice.json (the same pack the learner app reads).
 * Regenerate:      npm run build:modules
 */
import type { AssessmentModule } from "./schema";

export const MODULES: readonly AssessmentModule[] = Object.freeze([
  {
    "id": 1,
    "title": "First Day at a Welding Workshop",
    "scenario": "Meet the workshop team and complete onboarding safely.",
    "codes": [
      {
        "code": "OSHA 29 CFR 1910 Subpart Q",
        "title": "Welding, Cutting and Brazing",
        "note": ""
      },
      {
        "code": "HazCom",
        "title": "Hazard Communication, 29 CFR 1910.1200",
        "note": ""
      }
    ],
    "requirement": "Mandatory workshop safety orientation, hazard communication, emergency exit verification, and allocation of flame-resistant PPE.",
    "benchmarks": [
      {
        "id": "emergency",
        "must": "Identify the emergency assembly point, eye-wash station and fire extinguishers",
        "cues": [
          "assembly point",
          "muster",
          "eye wash",
          "eyewash",
          "eye-wash",
          "fire extinguisher",
          "extinguisher",
          "emergency exit",
          "fire point",
          "first aid",
          "emergency"
        ],
        "critical": true
      },
      {
        "id": "ppe",
        "must": "Name the minimum PPE: auto-darkening helmet with correct shade rating, leather gloves, flame-resistant jacket, steel-toe boots",
        "cues": [
          "helmet",
          "auto-darkening",
          "auto darkening",
          "shade",
          "leather glove",
          "gloves",
          "flame-resistant",
          "flame resistant",
          "fire retardant",
          "jacket",
          "steel toe",
          "steel-toe",
          "safety boots",
          "ppe",
          "apron",
          "sleeves"
        ],
        "critical": true
      },
      {
        "id": "rules",
        "must": "Review the workshop-specific safety rules before turning on any machinery",
        "cues": [
          "safety rules",
          "induction",
          "orientation",
          "briefing",
          "site rules",
          "before starting",
          "before using",
          "before i touch",
          "read the",
          "toolbox"
        ],
        "critical": false
      }
    ],
    "vocab": [
      "HazCom",
      "PPE",
      "shade rating",
      "flame-resistant",
      "assembly point",
      "hot work"
    ]
  },
  {
    "id": 2,
    "title": "Shift Handover",
    "scenario": "Give your team a useful handover before the next shift.",
    "codes": [
      {
        "code": "ISO 3834",
        "title": "Quality requirements for fusion welding of metallic materials",
        "note": ""
      }
    ],
    "requirement": "Continuous workflow traceability. Incoming shifts must be briefed on active weld setups, machine state, material trace numbers and production anomalies.",
    "benchmarks": [
      {
        "id": "equipment",
        "must": "State the equipment status: duty cycle limits, machine settings or gas cylinder pressures",
        "cues": [
          "duty cycle",
          "setting",
          "amp",
          "volt",
          "parameter",
          "cylinder",
          "pressure",
          "bar",
          "gas",
          "machine",
          "set at",
          "wire speed"
        ],
        "critical": true
      },
      {
        "id": "jobid",
        "must": "Identify the joint or job ID on the bench and its phase of completion",
        "cues": [
          "joint",
          "job",
          "spool",
          "drawing",
          "weld number",
          "line",
          "mark",
          "section",
          "id",
          "phase",
          "complete",
          "finished",
          "tacked",
          "fitted"
        ],
        "critical": true
      },
      {
        "id": "anomaly",
        "must": "Report anomalies, defect trends, or instructions left by the outgoing supervisor",
        "cues": [
          "anomaly",
          "defect",
          "issue",
          "problem",
          "trouble",
          "trend",
          "instruction",
          "note",
          "fault",
          "short",
          "delay",
          "supervisor said"
        ],
        "critical": false
      }
    ],
    "vocab": [
      "duty cycle",
      "traceability",
      "joint number",
      "handover",
      "nonconformity"
    ]
  },
  {
    "id": 3,
    "title": "Equipment Readiness Check",
    "scenario": "Prepare equipment and report an issue before work starts.",
    "codes": [
      {
        "code": "AWS D1.1 Clause 5",
        "title": "Fabrication requirements",
        "note": "Clause numbering follows AWS D1.1 editions before 2020; the 2020 edition renumbered Fabrication to Clause 7 and Inspection to Clause 8. Confirm against the edition in force on your project."
      },
      {
        "code": "OSHA 29 CFR 1910.332",
        "title": "Electrical safety-related work practices — training",
        "note": ""
      }
    ],
    "requirement": "Inspection of insulation, cable damage, gas delivery systems and ground clamp connections before striking an arc, to prevent shock hazards and porous welds.",
    "benchmarks": [
      {
        "id": "cables",
        "must": "Confirm welding cables are free of exposed copper, deep cuts or faulty splices",
        "cues": [
          "exposed copper",
          "copper",
          "cut",
          "splice",
          "insulation",
          "damaged",
          "fray",
          "lead",
          "cable",
          "nick",
          "tape"
        ],
        "critical": true
      },
      {
        "id": "gas",
        "must": "Check the gas delivery system for leaks and that cylinders are chained securely upright",
        "cues": [
          "leak",
          "cylinder",
          "bottle",
          "chain",
          "upright",
          "secure",
          "strap",
          "regulator",
          "hose",
          "gas delivery",
          "flow"
        ],
        "critical": false
      },
      {
        "id": "ground",
        "must": "Validate ground clamp placement for a stable electrical loop and clean current transmission",
        "cues": [
          "ground clamp",
          "earth clamp",
          "earth",
          "ground",
          "return",
          "clamp",
          "electrical loop",
          "clean metal",
          "bare metal",
          "connection"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "duty cycle",
      "ground clamp",
      "return lead",
      "regulator",
      "open circuit voltage"
    ]
  },
  {
    "id": 4,
    "title": "Material Preparation Briefing",
    "scenario": "Clarify materials and preparation before a job.",
    "codes": [
      {
        "code": "ISO 3834-2",
        "title": "Comprehensive quality requirements",
        "note": ""
      },
      {
        "code": "EN 10204",
        "title": "Inspection documents for metallic products (mill certificates)",
        "note": ""
      }
    ],
    "requirement": "Alignment of joint geometry, base metal cleanliness and mill test report traceability before assembly.",
    "benchmarks": [
      {
        "id": "mtr",
        "must": "Verify the base metal type against the Material Test Report or mill certificate",
        "cues": [
          "material test report",
          "mtr",
          "mill cert",
          "mill certificate",
          "certificate",
          "cert",
          "grade",
          "base metal",
          "material",
          "traceab",
          "heat number",
          "marking",
          "en 10204"
        ],
        "critical": true
      },
      {
        "id": "clean",
        "must": "Remove surface contaminants — rust, oil, scale, moisture — with a dedicated wire brush or grinder to prevent porosity",
        "cues": [
          "rust",
          "oil",
          "scale",
          "moisture",
          "damp",
          "paint",
          "contaminant",
          "wire brush",
          "brush",
          "grind",
          "clean",
          "degrease",
          "porosity",
          "bright metal"
        ],
        "critical": true
      },
      {
        "id": "geometry",
        "must": "Cross-check the bevel angle, root opening and root face against the job specification",
        "cues": [
          "bevel",
          "root opening",
          "root gap",
          "root face",
          "land",
          "angle",
          "geometry",
          "fit-up",
          "fit up",
          "gap",
          "specification",
          "spec",
          "drawing",
          "dimension"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "MTR",
      "mill certificate",
      "bevel angle",
      "root face",
      "root opening",
      "porosity"
    ]
  },
  {
    "id": 5,
    "title": "Safety Stop-Work Conversation",
    "scenario": "Identify a hazard and use calm stop-work communication.",
    "codes": [
      {
        "code": "OSHA General Duty Clause, OSH Act Section 5(a)(1)",
        "title": "Duty to provide a workplace free of recognised hazards",
        "note": ""
      },
      {
        "code": "Stop Work Authority",
        "title": "Site stop-work procedures",
        "note": ""
      }
    ],
    "requirement": "Immediate halting of work when an imminent hazard is identified. Communication must be calm, direct and solutions-oriented.",
    "benchmarks": [
      {
        "id": "assertive",
        "must": "Use assertive, professional, clear language to pause work without hostility or blame",
        "cues": [
          "stop",
          "hold",
          "pause",
          "down tools",
          "not restarting",
          "wait",
          "calm",
          "respect",
          "sorry",
          "i know",
          "understand",
          "let's",
          "we need"
        ],
        "critical": true
      },
      {
        "id": "threat",
        "must": "Pinpoint the concrete threat explicitly — unshielded flammable vapours, inadequate local exhaust ventilation, and similar",
        "cues": [
          "flammable",
          "vapour",
          "vapor",
          "ventilation",
          "exhaust",
          "extraction",
          "fume",
          "unshielded",
          "no screen",
          "spark",
          "gas",
          "bottle",
          "fire",
          "explos",
          "hazard",
          "risk"
        ],
        "critical": true
      },
      {
        "id": "restart",
        "must": "State that work resumes only after an authorised inspector or safety officer clears the zone",
        "cues": [
          "authorised",
          "authorized",
          "inspector",
          "safety officer",
          "safety",
          "cleared",
          "clearance",
          "permit",
          "sign off",
          "until",
          "before we restart",
          "resume"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "stop work authority",
      "imminent hazard",
      "local exhaust ventilation",
      "permit to work"
    ]
  },
  {
    "id": 6,
    "title": "Procedure Briefing",
    "scenario": "Explain a welding procedure and quality checks.",
    "codes": [
      {
        "code": "ISO 15609-1",
        "title": "Specification of welding procedures — arc welding",
        "note": ""
      },
      {
        "code": "ISO 15614-1",
        "title": "Qualification of welding procedures — arc welding of steels",
        "note": ""
      }
    ],
    "requirement": "Reviewing and implementing the essential process variables dictated by an approved Welding Procedure Specification.",
    "benchmarks": [
      {
        "id": "wpsid",
        "must": "Identify the specific WPS document number assigned to the project",
        "cues": [
          "wps",
          "procedure number",
          "procedure no",
          "document number",
          "spec number",
          "specification number",
          "wps number",
          "procedure sheet"
        ],
        "critical": true
      },
      {
        "id": "variables",
        "must": "Reference the essential variables: current type and polarity, amperage/voltage thresholds, travel speed range and shielding gas flow rate",
        "cues": [
          "polarity",
          "dcen",
          "dcep",
          "dc",
          "ac",
          "amperage",
          "amp",
          "voltage",
          "volt",
          "travel speed",
          "speed",
          "gas flow",
          "flow rate",
          "shielding gas",
          "litre",
          "lpm",
          "current",
          "range"
        ],
        "critical": true
      },
      {
        "id": "preheat",
        "must": "Acknowledge the preheat and interpass temperature parameters for the material thickness",
        "cues": [
          "preheat",
          "pre-heat",
          "pre heat",
          "interpass",
          "inter-pass",
          "temperature",
          "degrees",
          "thickness",
          "celsius"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "WPS",
      "essential variables",
      "polarity",
      "interpass temperature",
      "shielding gas flow"
    ]
  },
  {
    "id": 7,
    "title": "Drawing Clarification",
    "scenario": "Check a drawing and request clarification before work.",
    "codes": [
      {
        "code": "AWS A2.4",
        "title": "Standard symbols for welding, brazing and nondestructive examination",
        "note": ""
      }
    ],
    "requirement": "Reading engineering drawings and raising a formal review when weld symbols or dimensional paths are ambiguous.",
    "benchmarks": [
      {
        "id": "symbol",
        "must": "Interpret the components of the standard weld symbol — arrow, reference line, tail and tail notation",
        "cues": [
          "arrow",
          "reference line",
          "tail",
          "symbol",
          "arrow side",
          "other side",
          "both sides",
          "weld symbol",
          "notation",
          "flag"
        ],
        "critical": true
      },
      {
        "id": "omission",
        "must": "Flag omissions in the print: missing weld size, contour symbols or ambiguous field-weld flags",
        "cues": [
          "missing",
          "size",
          "contour",
          "field weld",
          "flag",
          "ambiguous",
          "not clear",
          "unclear",
          "not shown",
          "omitted",
          "blank",
          "two ways"
        ],
        "critical": true
      },
      {
        "id": "loop",
        "must": "Use the proper communication loop — engineering or the supervisor — rather than guessing on the shop floor",
        "cues": [
          "engineer",
          "engineering",
          "supervisor",
          "rfi",
          "request for information",
          "query",
          "not guess",
          "wouldn't guess",
          "formal",
          "clarif",
          "in writing"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "weld symbol",
      "reference line",
      "contour",
      "field weld",
      "RFI"
    ]
  },
  {
    "id": 8,
    "title": "Construction Site Coordination",
    "scenario": "Coordinate welding work with another trade.",
    "codes": [
      {
        "code": "OSHA 29 CFR 1926 Subpart J",
        "title": "Welding and cutting in construction",
        "note": ""
      }
    ],
    "requirement": "Multi-trade deconfliction to prevent fire, structural collapse, or exposure of nearby trades to arc radiation and toxic fumes.",
    "benchmarks": [
      {
        "id": "screens",
        "must": "Coordinate with nearby trades and set flash screens protecting them from UV arc rays",
        "cues": [
          "flash screen",
          "screen",
          "uv",
          "arc ray",
          "arc flash",
          "curtain",
          "shield",
          "radiation",
          "flash",
          "blind",
          "pipefit",
          "electric",
          "painter",
          "trade"
        ],
        "critical": true
      },
      {
        "id": "permit",
        "must": "Verify a valid Hot Work Permit and establish a dedicated Fire Watch",
        "cues": [
          "hot work permit",
          "hot work",
          "permit",
          "fire watch",
          "watch",
          "standby",
          "extinguisher",
          "blanket"
        ],
        "critical": true
      },
      {
        "id": "vertical",
        "must": "Coordinate timing to avoid welding directly above or below another trade without overhead barrier protection",
        "cues": [
          "above",
          "below",
          "overhead",
          "barrier",
          "blanket",
          "cover",
          "timing",
          "sequence",
          "stagger",
          "move them",
          "exclusion"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "hot work permit",
      "fire watch",
      "flash screen",
      "arc eye",
      "exclusion zone"
    ]
  },
  {
    "id": 9,
    "title": "Quality Issue Report",
    "scenario": "Report an inspection concern and agree corrective action.",
    "codes": [
      {
        "code": "ISO 9001 Clause 8.7",
        "title": "Control of nonconforming outputs",
        "note": ""
      },
      {
        "code": "AWS D1.1 Clause 6",
        "title": "Inspection",
        "note": "Clause numbering follows AWS D1.1 editions before 2020; the 2020 edition renumbered Fabrication to Clause 7 and Inspection to Clause 8. Confirm against the edition in force on your project."
      }
    ],
    "requirement": "Formal recording of discontinuities exceeding allowable code limits, followed by a root-cause remediation sequence.",
    "benchmarks": [
      {
        "id": "terminology",
        "must": "Identify the defect using standardised technical labels — undercut, slag inclusion, lack of fusion, crater cracks, porosity",
        "cues": [
          "undercut",
          "porosity",
          "slag inclusion",
          "slag",
          "lack of fusion",
          "incomplete penetration",
          "crater",
          "crack",
          "overlap",
          "spatter",
          "discontinuity",
          "defect"
        ],
        "critical": true
      },
      {
        "id": "isolate",
        "must": "Isolate, mark and tag the piece to stop it moving down the line",
        "cues": [
          "isolate",
          "tag",
          "mark",
          "quarantine",
          "segregate",
          "hold",
          "set aside",
          "stop it",
          "non-conform",
          "nonconform",
          "not ship",
          "separate"
        ],
        "critical": true
      },
      {
        "id": "correct",
        "must": "Propose a code-compliant correction — grinding the defect fully out before re-welding",
        "cues": [
          "grind",
          "excavate",
          "remove",
          "gouge",
          "re-weld",
          "reweld",
          "repair",
          "rework",
          "acceptance criteria",
          "code",
          "procedure",
          "limit"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "undercut",
      "slag inclusion",
      "lack of fusion",
      "nonconformity",
      "acceptance criteria"
    ]
  },
  {
    "id": 10,
    "title": "Controlled Work Readiness",
    "scenario": "Confirm permit, isolation, and communication for industrial work.",
    "codes": [
      {
        "code": "OSHA 29 CFR 1910.146",
        "title": "Permit-required confined spaces",
        "note": ""
      },
      {
        "code": "ISO 3834",
        "title": "Quality planning requirements",
        "note": ""
      }
    ],
    "requirement": "Lockout/Tagout verification, atmospheric testing and safety barrier checks before entering a high-risk environment.",
    "benchmarks": [
      {
        "id": "permit",
        "must": "Verify completion and posting of a formal Confined Space or Hot Work entry permit",
        "cues": [
          "confined space",
          "entry permit",
          "hot work permit",
          "permit",
          "posted",
          "signed",
          "in date",
          "authoris",
          "authoriz"
        ],
        "critical": true
      },
      {
        "id": "loto",
        "must": "Confirm energy isolation points via Lockout/Tagout protocols",
        "cues": [
          "lockout",
          "lock out",
          "tagout",
          "tag out",
          "loto",
          "isolation",
          "isolat",
          "energy",
          "lock",
          "valve",
          "breaker",
          "tag"
        ],
        "critical": true
      },
      {
        "id": "gastest",
        "must": "Require atmospheric gas testing — oxygen, combustible gases and toxic fume levels — before crossing the threshold",
        "cues": [
          "gas test",
          "atmospher",
          "oxygen",
          "combustible",
          "lel",
          "toxic",
          "monitor",
          "reading",
          "sniffer",
          "air test",
          "ppm"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "permit-required confined space",
      "LOTO",
      "atmospheric testing",
      "LEL",
      "fire watch"
    ]
  },
  {
    "id": 11,
    "title": "Welding Interview",
    "scenario": "Present your experience and motivation to a hiring team.",
    "codes": [
      {
        "code": "ISO 9606-1",
        "title": "Qualification testing of welders — fusion welding — steels",
        "note": ""
      },
      {
        "code": "AWS D1.1 Clause 4",
        "title": "Qualification",
        "note": "Clause numbering follows AWS D1.1 editions before 2020; the 2020 edition renumbered Fabrication to Clause 7 and Inspection to Clause 8. Confirm against the edition in force on your project."
      }
    ],
    "requirement": "The candidate must demonstrate mastery of technical processes, essential code variations and behavioural competencies.",
    "benchmarks": [
      {
        "id": "boundaries",
        "must": "State qualified boundaries precisely: processes (SMAW, GMAW, GTAW), materials, positions (3G, 4G, 6G) and thickness range",
        "cues": [
          "smaw",
          "gmaw",
          "gtaw",
          "fcaw",
          "mig",
          "mag",
          "tig",
          "stick",
          "mma",
          "1g",
          "2g",
          "3g",
          "4g",
          "5g",
          "6g",
          "position",
          "thickness",
          "mm",
          "carbon steel",
          "stainless",
          "material",
          "pipe",
          "plate"
        ],
        "critical": true
      },
      {
        "id": "pqrwpq",
        "must": "Explain the difference between a procedure qualification record and an individual welder performance qualification",
        "cues": [
          "pqr",
          "wpq",
          "wpqr",
          "procedure qualification",
          "performance qualification",
          "welder qualification",
          "qualifies the procedure",
          "qualifies the welder",
          "the procedure",
          "the person",
          "difference"
        ],
        "critical": true
      },
      {
        "id": "ownership",
        "must": "Show professional ownership of safety and quality over speed",
        "cues": [
          "quality",
          "safety",
          "not rush",
          "over speed",
          "slow",
          "right first time",
          "standard",
          "procedure",
          "properly",
          "careful",
          "won't"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "SMAW",
      "GMAW",
      "GTAW",
      "PQR",
      "WPQ",
      "range of qualification"
    ]
  },
  {
    "id": 12,
    "title": "Career Ready Final Briefing",
    "scenario": "Present your standards, contribution, and career readiness.",
    "codes": [
      {
        "code": "TWF Africa",
        "title": "The Welding Federation — African federation of welding institutes",
        "note": ""
      },
      {
        "code": "ISO 9606-1",
        "title": "Welder qualification validity and continuity",
        "note": ""
      },
      {
        "code": "AWS / ISO systems",
        "title": "International qualification frameworks",
        "note": ""
      }
    ],
    "requirement": "Articulating structural accountability, professional ethical boundaries and long-term management of individual certifications.",
    "benchmarks": [
      {
        "id": "validity",
        "must": "Show you know a coded welder qualification lapses if the process is not performed within the set interval — typically confirmed every six months",
        "cues": [
          "six month",
          "6 month",
          "six-month",
          "every six",
          "expire",
          "expiry",
          "validity",
          "valid",
          "revalidat",
          "continuity",
          "lapse",
          "renew",
          "keep it current",
          "sign off every"
        ],
        "critical": true
      },
      {
        "id": "trace",
        "must": "Explain trace tracking: your stamped welder ID linked to the joint records you sign off",
        "cues": [
          "stamp",
          "welder id",
          "welder number",
          "identification",
          "trace",
          "traceab",
          "sign off",
          "signed",
          "joint record",
          "log",
          "register",
          "my number"
        ],
        "critical": true
      },
      {
        "id": "updates",
        "must": "Express continuous alignment with international standard updates and site-specific quality guidelines",
        "cues": [
          "standard",
          "update",
          "revision",
          "current",
          "latest",
          "cpd",
          "training",
          "course",
          "keep up",
          "development",
          "learn",
          "new edition"
        ],
        "critical": true
      }
    ],
    "vocab": [
      "coded welder",
      "range of qualification",
      "welder ID stamp",
      "revalidation",
      "TWF"
    ]
  }
] as const) as unknown as readonly AssessmentModule[];

export const MODULE_BY_ID = new Map<number, AssessmentModule>(MODULES.map(m => [m.id, m]));

export const MODULE_IDS = MODULES.map(m => m.id);
