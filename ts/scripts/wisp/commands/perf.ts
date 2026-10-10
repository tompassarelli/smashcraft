









import { join } from "node:path";
import { type PerfProject, makePerf } from "wisp/scripts/wisp/commands/perf";
import { buildProject, tsDirectory } from "../project";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../../../src/game/sim/heroes/registry";
import { census, comparePairRuns, profile } from "../perfCensus";
import { budget } from "../perfBudget";

const main = buildProject("main");
const integrity = buildProject("integrity");
const integrityMap = { config: integrity.configPath, bundle: integrity.bundlePath };
const playable = buildProject("playable");
const playableMap = { config: playable.configPath, bundle: playable.bundlePath };


export const SMASHCRAFT_PERF: PerfProject = {
  map: { config: main.configPath, bundle: main.bundlePath },
  program: { config: join(tsDirectory, "tsconfig.perf.json"), bundle: join(tsDirectory, "build/perf.lua") },
  defaultRun: "quick-match",
  runs: { bot: integrityMap, "bot-four": integrityMap, "playable-bot-four": playableMap, "playable-duel": playableMap, "playable-human-four": playableMap, ...Object.fromEntries(SELECTABLE_CHARACTERS.map((character) => [`bot-${fighterSlug(character)}`, integrityMap])) },
};

const measure = makePerf(SMASHCRAFT_PERF);
const spikeCensus = census({ map: playableMap, program: SMASHCRAFT_PERF.program });

const runProfile = profile(SMASHCRAFT_PERF);
const compare = comparePairRuns(measure);

export const perf: typeof measure = (args) =>
  args[0] === "census" ? spikeCensus(args.slice(1)) : args[0] === "compare" ? compare(args.slice(1)) : args[0] === "budget" ? budget(args.slice(1)) : args[0] === "profile" ? runProfile(args.slice(1)) : measure(args);
