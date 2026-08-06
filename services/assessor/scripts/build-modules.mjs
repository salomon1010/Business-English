/* Regenerates src/modules.ts from the learner track pack, so the benchmarks the
   candidate is assessed against cannot drift from the ones the app teaches.
   Run from services/assessor:  npm run build:modules */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packPath = resolve(here, "../../../tracks/welding/practice.json");
const pack = JSON.parse(readFileSync(packPath, "utf8"));

const modules = pack.simulations
  .filter((s) => s.regulatory)
  .map((s) => ({
    id: s.regulatory.moduleId, title: s.title, scenario: s.scenario,
    codes: s.regulatory.codes, requirement: s.regulatory.requirement,
    benchmarks: s.regulatory.benchmarks, vocab: s.regulatory.vocab,
  }))
  .sort((a, b) => a.id - b.id);

const out = `/* AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Source of truth: tracks/welding/practice.json (the same pack the learner app reads).
 * Regenerate:      npm run build:modules
 */
import type { AssessmentModule } from "./schema";

export const MODULES: readonly AssessmentModule[] = Object.freeze(${JSON.stringify(modules, null, 2)} as const) as unknown as readonly AssessmentModule[];

export const MODULE_BY_ID = new Map<number, AssessmentModule>(MODULES.map(m => [m.id, m]));

export const MODULE_IDS = MODULES.map(m => m.id);
`;
writeFileSync(resolve(here, "../src/modules.ts"), out);
console.log(`modules.ts regenerated — ${modules.length} modules, ${modules.reduce((n, m) => n + m.benchmarks.length, 0)} benchmarks`);
