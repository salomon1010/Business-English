/* Workshop conversations — who speaks is the scenario's decision.

   Runs the real engine, orchestrator, trades and the welding pack in Node with
   a faked Worker, and asserts the properties that are ours to guarantee
   without a model or a network:

     - every character has a stable id, its own voice, and that voice is one
       the Worker accepts
     - the speaker of every turn is the pack's turn order, its scheduled
       interruptions and its closing — never whatever the model claims
     - the client hears the speaker (onCharacter) before the first sentence,
       every turn, with the engine's id
     - the prompt names that person and carries the turn they must get said;
       it no longer invites the model to "switch"
     - a hand-over does not touch earlier messages; a persisted run replays
       with the same speakers; the offline path follows the same order
     - the General English pack has no workshops at all

   Run: node sim-identity.test.mjs   (from tests/) */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = process.env.ROOT ? process.env.ROOT.replace(/\/?$/, "/") : new URL("..", import.meta.url).pathname;
const read = f => readFileSync(ROOT + f, "utf8");
const pack = JSON.parse(read("tracks/welding/practice.json"));
const general = JSON.parse(read("tracks/general/practice.json"));
const workerVoices = JSON.parse(/const TTS_VOICES = (\[[^\]]*\])/.exec(read("backend/polish-worker.js"))[1]);

let failures = 0, passes = 0;
const ok = (name, cond, why) => { if (cond) { passes++; console.log(`  PASS  ${name}`); } else { failures++; console.log(`  FAIL  ${name}${why ? " — " + why : ""}`); } };

/* A fresh app context per scenario, with a Worker that always claims to be
   Maya (hr) — both in a leading {c:…} line and in the finished object — and
   streams two sentences. If any of that leaked into the run, the tests below
   would see "hr" where the pack says otherwise. */
function app({ online = true, workerOk = true, claim = "hr", onFetch } = {}) {
  const ctx = { console, Blob, TextDecoder, TextEncoder };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  ctx.save = () => {};
  ctx.appState = () => ({ professionalTracks: { activeId: "welding", tradeId: "pipefitter" } });
  ctx.navigator = { onLine: online };
  ctx.POLISH_API = "https://worker.test";
  ctx.activeCurriculum = () => pack;
  ctx.isProfessionalJourney = () => true;
  ctx.fetch = async (url, opts) => {
    const req = JSON.parse(opts.body).chat;
    if (onFetch) onFetch(req);
    if (!workerOk) return { ok: false, status: 502, body: null, json: async () => ({}) };
    const nd = [{ c: claim }, { s: "Right, good to have you." }, { s: "What size pipe are you used to?" },
      { done: true, characterId: claim, reply: "Right, good to have you. What size pipe are you used to?", covered: [] }]
      .map(o => JSON.stringify(o)).join("\n") + "\n";
    return { ok: true, status: 200, body: new Blob([nd]).stream(), json: async () => ({ characterId: claim, reply: "Right. What size pipe?", covered: [] }) };
  };
  vm.runInContext(read("trades.js"), ctx);
  vm.runInContext(read("professional-simulation-engine.js"), ctx);
  vm.runInContext(read("conversation-orchestrator.js"), ctx);
  return ctx;
}

/* What the pack says the order is: starter, then each scheduled turn, with
   the interruption slotted in the learner turn after `afterTurn`, then the
   closing. This is derived from the data alone, not from the engine. */
function expectedOrder(sc, starter) {
  const out = [starter];
  const events = (sc.unexpectedEvents || []).slice();
  let turn = 0, beat = 0;
  while (true) {
    turn++;
    const ev = events.find(e => turn >= e.afterTurn);
    if (ev) { events.splice(events.indexOf(ev), 1); out.push(ev.characterId); continue; }
    if (beat < (sc.turns || []).length) { out.push(sc.turns[beat++].characterId); continue; }
    out.push((sc.closing || {}).characterId); break;
  }
  return out;
}

console.log("workshop speaker identity\n");

/* ---- A. character model ---- */
{
  const cast = pack.simulationCharacters;
  const ids = cast.map(c => c.id), voices = cast.map(c => c.voice);
  ok("A1 every character has a stable id, a name, a role, a gender and a voice",
    cast.every(c => c.id && c.name && c.role && (c.g === "m" || c.g === "f") && c.voice));
  ok("A2 character ids are unique", new Set(ids).size === ids.length);
  ok("A3 voices are unique — no two people share one", new Set(voices).size === voices.length, voices.join(","));
  ok("A4 every voice is one the Worker accepts", voices.every(v => workerVoices.includes(v)), voices.filter(v => !workerVoices.includes(v)).join(","));
  const ctx = app();
  const E = ctx.ProfessionalSimulationEngine;
  const sc = pack.simulations[0];
  ok("A5 speakerId 'supervisor' resolves to Daniel and Daniel's own voice",
    E.character(sc, "supervisor").name === "Daniel" && E.character(sc, "supervisor").voice === cast.find(c => c.id === "supervisor").voice);
  ok("A6 every scenario turn, event and closing names a real character",
    pack.simulations.every(s => [...(s.turns || []), ...(s.unexpectedEvents || []), s.closing || {}].every(t => ids.includes(t.characterId))));
  ok("A7 every scenario has an opening line for every character", pack.simulations.every(s => ids.every(id => (s.openings || {})[id])));
}

/* ---- B. the same person keeps the same voice, however often they speak ---- */
{
  const ctx = app();
  const E = ctx.ProfessionalSimulationEngine;
  const sc = pack.simulations[0];
  const v = new Set();
  for (let i = 0; i < 5; i++) v.add(E.character(sc, "supervisor").voice);
  ok("B1 Daniel five times → one voice", v.size === 1);
}

/* ---- D. progression + speaker identity, live path, every scenario ---- */
for (const sc of pack.simulations) {
  const ctx = app();
  const E = ctx.ProfessionalSimulationEngine, O = ctx.ConversationOrchestrator;
  const starter = sc.lead;
  let sim = E.start(sc.id, starter);
  sim.lastSpeakerId = starter;
  const heard = [], prompts = [];
  let announcedBeforeSentence = true, announced = [];
  for (let guard = 0; guard < 12 && !sim.finished; guard++) {
    let firstThisTurn = null;
    const r = await O.respond(sim, "I'm a pipefitter with six years on process piping. I always check my PPE.", {
      onCharacter: id => { if (firstThisTurn === null) firstThisTurn = "c"; announced.push(id); },
      onSentence: () => { if (firstThisTurn === null) { firstThisTurn = "s"; announcedBeforeSentence = false; } },
    });
    sim = r.simulation;
    heard.push(sim.messages[sim.messages.length - 1].characterId);
    if (firstThisTurn !== "c") announcedBeforeSentence = false;
  }
  const spoken = [starter, ...heard];
  const expected = expectedOrder(sc, starter);
  ok(`D ${sc.id}: speakers follow the pack — ${expected.join(" → ")}`,
    JSON.stringify(spoken) === JSON.stringify(expected), `got ${spoken.join(" → ")}`);
  ok(`D ${sc.id}: the model's claim to be 'hr' never became the speaker`, heard.every((id, i) => id === expected[i + 1]));
  ok(`D ${sc.id}: onCharacter fires before the first sentence on every turn, with the engine's id`,
    announcedBeforeSentence && JSON.stringify(announced) === JSON.stringify(heard));
  ok(`D ${sc.id}: the run finishes on the closing`, sim.finished === true);
}

/* ---- prompt contract ---- */
{
  const seen = [];
  const ctx = app({ onFetch: req => seen.push(req) });
  const E = ctx.ProfessionalSimulationEngine, O = ctx.ConversationOrchestrator;
  const sc = pack.simulations[0];
  let sim = E.start(sc.id, "hr"); sim.lastSpeakerId = "hr";
  const r = await O.respond(sim, "Hello, I'm new here.", { onSentence: () => {}, onCharacter: () => {} });
  const sys = seen[0].system;
  const first = sc.turns[0];
  ok("P1 the prompt names the engine's speaker, not the last one", /You are Daniel, Supervisor \(supervisor\)/.test(sys) && !/You are currently hr/.test(sys));
  ok("P2 the prompt carries the turn the pack wants asked", sys.includes(first.text.slice(0, 40)) || /THIS TURN/.test(sys));
  ok("P3 the model is not invited to switch character", !/Stay as|step in now|say who you are as you do/.test(sys));
  ok("P4 the JSON contract no longer has a characterId for the model to fill", !/"characterId"/.test(sys));
  ok("P5 the model's words are used, the engine's speaker kept", r.reply.text.startsWith("Right, good to have you") && r.reply.characterId === "supervisor");
  ok("P6 the system prompt fits the Worker's 4000-char cap", sys.length <= 4000, `${sys.length} chars`);
}

/* ---- E. a hand-over does not touch earlier messages ---- */
{
  const ctx = app();
  const E = ctx.ProfessionalSimulationEngine, O = ctx.ConversationOrchestrator;
  const sc = pack.simulations[0];
  let sim = E.start(sc.id, "hr"); sim.lastSpeakerId = "hr";
  const mayaLine = JSON.stringify(sim.messages[0]);
  sim = (await O.respond(sim, "Hi, I'm Sam.", { onSentence: () => {}, onCharacter: () => {} })).simulation;
  sim = (await O.respond(sim, "Six years.", { onSentence: () => {}, onCharacter: () => {} })).simulation;
  ok("E1 Maya's opening is byte-identical after two hand-overs", JSON.stringify(sim.messages[0]) === mayaLine);
  ok("E2 every character message still carries its own characterId", sim.messages.filter(m => m.role === "character").every(m => m.characterId));
}

/* ---- H. persisted run replays with the same speakers ---- */
{
  const ctx = app();
  const E = ctx.ProfessionalSimulationEngine, O = ctx.ConversationOrchestrator;
  const sc = pack.simulations[0];
  let sim = E.start(sc.id, "hr"); sim.lastSpeakerId = "hr";
  sim = (await O.respond(sim, "Hi.", { onSentence: () => {}, onCharacter: () => {} })).simulation;
  const S = {}; O.remember(S, sim);
  const back = JSON.parse(JSON.stringify(O.active(S)))[sc.id];
  ok("H1 the stored run keeps every speaker id and the last speaker",
    back.messages.map(m => m.characterId || "-").join(",") === sim.messages.map(m => m.characterId || "-").join(",") && back.lastSpeakerId === "supervisor");
  const ctx2 = app();
  const E2 = ctx2.ProfessionalSimulationEngine;
  ok("H2 after a reload the speakers resolve to the same people and voices",
    back.messages.filter(m => m.role === "character").every(m => E2.character(sc, m.characterId).voice === E.character(sc, m.characterId).voice));
}

/* ---- offline / Worker-down path follows the same order ---- */
{
  const ctx = app({ workerOk: false });
  const E = ctx.ProfessionalSimulationEngine, O = ctx.ConversationOrchestrator;
  const sc = pack.simulations[0];
  let sim = E.start(sc.id, "hr"); sim.lastSpeakerId = "hr";
  const heard = [];
  for (let g = 0; g < 12 && !sim.finished; g++) { sim = (await O.respond(sim, "Yes, I have.", { onSentence: () => {}, onCharacter: () => {} })).simulation; heard.push(sim.messages[sim.messages.length - 1].characterId); }
  ok("F1 with the Worker down the scripted turn order still runs to the closing",
    JSON.stringify(["hr", ...heard]) === JSON.stringify(expectedOrder(sc, "hr")) && sim.finished);
}

/* ---- J. General English has no workshops ---- */
ok("J1 the General English pack defines no simulations and no cast",
  !(general.simulations || []).length && !(general.simulationCharacters || []).length);

console.log(`\n${passes} pass, ${failures} fail`);
process.exit(failures ? 1 : 0);
