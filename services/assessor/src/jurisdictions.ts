/* ============================================================================
   Jurisdiction overlays.

   Candidates from this programme apply in Cameroon, Nigeria and across Africa, in
   Canada and the United States, and into international oil, gas and industrial
   consortia. The regulation they will be held to differs in every one of those
   places — but the BEHAVIOUR does not. Everywhere in the world, a welder entering
   a confined space is expected to say the atmosphere was tested, the permit is
   posted and the energy is isolated. What changes is which document says so.

   So the benchmarks stay universal and only the CITATIONS are swapped. That keeps
   one assessment standard, avoids twelve forks of the same checklist, and lets a
   candidate be assessed for Canada on Monday and for an offshore consortium on
   Tuesday without re-authoring anything.

   Two honesty rules hold throughout:
     • Where a jurisdiction's requirement is genuinely different rather than merely
       differently named, it is stated in `emphasis` rather than hidden.
     • None of this is legal advice. Regulations are amended, provinces and states
       differ, and a project specification can be stricter than the law. Every
       report says so.
   ============================================================================ */

export type JurisdictionId =
  | "international" | "us" | "canada" | "uk_eu" | "africa" | "oil_gas";

export interface Jurisdiction {
  id: JurisdictionId;
  label: string;
  /** Framework named in the report so a reader knows what was applied. */
  framework: string;
  /** Per-module citation overrides, keyed by module id. Missing ids fall back
   *  to the module's own default codes from the track pack. */
  codes: Record<number, string[]>;
  /** Where the expectation itself differs, not just its name. */
  emphasis: Record<number, string>;
  /** Verification wording appended to interviewer notes. */
  verify: string;
}

const J: Jurisdiction[] = [
  {
    id: "international",
    label: "International / ISO baseline",
    framework: "ISO and IIW international standards",
    codes: {
      2: ["ISO 3834 — Quality requirements for fusion welding"],
      4: ["ISO 3834-2 — Comprehensive quality requirements", "EN 10204 — Inspection documents"],
      6: ["ISO 15609-1 — Welding procedure specification", "ISO 15614-1 — Procedure qualification"],
      9: ["ISO 9001 Clause 8.7 — Control of nonconforming outputs"],
      11: ["ISO 9606-1 — Qualification testing of welders"],
      12: ["ISO 9606-1 — Validity and continuity of welder qualification"],
    },
    emphasis: {},
    verify: "Confirm the standard and edition named in the project specification before relying on any citation.",
  },
  {
    id: "us",
    label: "United States",
    framework: "OSHA 29 CFR and AWS standards",
    codes: {
      1: ["OSHA 29 CFR 1910 Subpart Q — Welding, Cutting and Brazing", "OSHA 29 CFR 1910.1200 — Hazard Communication"],
      3: ["AWS D1.1 — Structural Welding Code, Steel", "OSHA 29 CFR 1910.332 — Electrical safety training"],
      5: ["OSH Act Section 5(a)(1) — General Duty Clause"],
      8: ["OSHA 29 CFR 1926 Subpart J — Welding and Cutting (Construction)"],
      9: ["AWS D1.1 — Inspection", "ISO 9001 Clause 8.7"],
      10: ["OSHA 29 CFR 1910.146 — Permit-Required Confined Spaces", "OSHA 29 CFR 1910.147 — Lockout/Tagout"],
      11: ["AWS D1.1 — Welder Qualification", "ASME BPVC Section IX — Welding Qualifications"],
    },
    emphasis: {
      11: "US employers commonly ask for AWS or ASME Section IX qualification rather than ISO 9606. Be ready to state which system your test was to.",
    },
    verify: "OSHA is federal; some states run their own approved plans with stricter rules. AWS D1.1 clause numbers changed in the 2020 edition. Confirm the edition and the state plan in force.",
  },
  {
    id: "canada",
    label: "Canada",
    framework: "CSA standards and provincial OH&S regulation",
    codes: {
      1: ["Provincial OH&S regulation (varies by province)", "CSA Z94.3 — Eye and face protectors"],
      3: ["CSA W117.2 — Safety in welding, cutting and allied processes"],
      5: ["Provincial OH&S — work refusal and imminent-danger provisions"],
      8: ["CSA W117.2 — Hot work and fire watch", "Provincial construction safety regulation"],
      9: ["CSA W59 — Welded steel construction", "CSA W178.2 — Certification of welding inspectors"],
      10: ["Provincial confined-space regulation", "CSA Z1006 — Management of work in confined spaces"],
      11: ["CSA W47.1 — Certification of companies for fusion welding of steel", "CSA W59 — Welded steel construction"],
    },
    emphasis: {
      5: "Canadian provincial law gives workers an explicit right to refuse unsafe work. Saying you stopped and why is a legal protection, not only good practice.",
      11: "Canada certifies COMPANIES under CSA W47.1, with welders tested within a certified employer. Expect to be re-tested on arrival even with overseas qualifications.",
      12: "Canadian employers frequently require re-testing regardless of foreign certification. Present overseas tickets as evidence of experience, not as an automatic transfer.",
    },
    verify: "Occupational health and safety in Canada is provincial, not federal — Ontario, Alberta, BC and Quebec differ materially. Confirm the province and whether the employer holds CSA W47.1 certification.",
  },
  {
    id: "uk_eu",
    label: "United Kingdom / Europe",
    framework: "ISO/EN standards and UK or EU safety law",
    codes: {
      1: ["Health and Safety at Work etc. Act 1974", "PPE at Work Regulations"],
      4: ["EN 10204 — Inspection documents", "ISO 3834-2"],
      6: ["ISO 15609-1", "ISO 15614-1"],
      8: ["EN 1090 — Execution of steel structures", "Hot work permit procedures"],
      10: ["Confined Spaces Regulations 1997 (UK)", "ISO 3834 planning requirements"],
      11: ["ISO 9606-1 — Qualification testing of welders", "EN 1090 — Execution requirements"],
    },
    emphasis: {
      11: "EN 1090 execution class drives what qualification is acceptable for structural work in Europe. Know the execution class you have worked to.",
    },
    verify: "Post-Brexit UK and EU requirements are diverging in places. Confirm whether UKCA or CE marking and which execution class applies.",
  },
  {
    id: "africa",
    label: "Africa (Cameroon, Nigeria and regional)",
    framework: "TWF/IIW frameworks with national occupational safety law",
    codes: {
      1: ["National occupational health and safety legislation", "Employer safety induction procedure"],
      6: ["ISO 15609-1 / ISO 15614-1 as adopted by the project"],
      11: ["ISO 9606-1 via IIW/TWF authorised national bodies"],
      12: ["The Welding Federation (TWF) — regional qualification frameworks", "ISO 9606-1 continuity rules"],
    },
    emphasis: {
      11: "Many African projects are run by international contractors to ISO, AWS or client specifications rather than to national codes. Ask which standard the project works to before you are tested.",
      12: "An IIW/TWF-routed qualification through an authorised national body travels internationally far better than an uncertified in-house test. It is worth the cost.",
    },
    verify: "National OH&S legislation varies widely across the region and enforcement differs from the written rule. On contractor-run projects the client specification usually governs. Verify with the employer and the relevant national welding body.",
  },
  {
    id: "oil_gas",
    label: "Oil, gas and industrial consortia",
    framework: "API, ASME and client consortium specifications",
    codes: {
      4: ["ASME BPVC Section II — Materials", "EN 10204 3.1/3.2 certificates"],
      5: ["IOGP Life-Saving Rules — Work Authorisation and Line of Fire"],
      6: ["ASME BPVC Section IX", "API 1104 — Welding of Pipelines and Related Facilities"],
      8: ["Client hot work permit system", "IOGP Life-Saving Rules"],
      9: ["API 1104 — Acceptance standards", "ASME BPVC Section IX"],
      10: ["IOGP Life-Saving Rules — Confined Space", "Client permit-to-work system"],
      11: ["ASME BPVC Section IX", "API 1104", "ISO 9606-1"],
    },
    emphasis: {
      5: "On oil and gas sites, stop-work authority is usually a formal, named right that everyone on site holds. Using it correctly is expected, not tolerated.",
      10: "Confined-space and permit rules on operating plant are typically stricter than national law, and breaching them is normally a dismissal offence.",
      11: "Pipeline work is usually qualified to API 1104 and pressure work to ASME Section IX. Naming the correct system for the work is itself part of the assessment.",
    },
    verify: "Consortium and client specifications routinely exceed national regulation and override it contractually. Always work to the project specification issued for the job.",
  },
];

export const JURISDICTIONS = new Map<JurisdictionId, Jurisdiction>(J.map((x) => [x.id, x]));
export const JURISDICTION_IDS = J.map((x) => x.id) as [JurisdictionId, ...JurisdictionId[]];
export const DEFAULT_JURISDICTION: JurisdictionId = "international";

/** Citations to apply for a module, with the module's own codes as the fallback. */
export function codesFor(
  jurisdiction: JurisdictionId,
  moduleId: number,
  fallback: { code: string; title: string; note: string }[]
): string[] {
  const j = JURISDICTIONS.get(jurisdiction);
  const override = j?.codes[moduleId];
  if (override?.length) return override;
  return fallback.map((c) => `${c.code} — ${c.title}`);
}

export function emphasisFor(jurisdiction: JurisdictionId, moduleId: number): string {
  return JURISDICTIONS.get(jurisdiction)?.emphasis[moduleId] ?? "";
}
