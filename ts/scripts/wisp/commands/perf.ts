// `bun wisp perf [RUN] [--frames N] [--samples] [--out FILE]`: one of
// Smashcraft's runs in 32-bit Lua with every frame measured and its native
// cost predicted: quick-match, the development build's quick match; bot and
// bot-four, the native bot session's match with the integrity build
// (scripts/wisp/botMatch.ts); bot-NAME, that match against one computer of
// any selectable fighter (bot-forsaken-paladin); playable-bot-four, bot-four with the playable build. `bun wisp perf compare A B` holds run B to run A
// (wisp:docs/frame-cost.md#headless). `bun wisp perf census` is the spike census (../perfCensus.ts); `perf budget` holds
// a run to the frame budget (../perfBudget.ts); `perf profile RUN` names what its
// worst frames spend (../perfCensus.ts).
import { join } from "node:path";
import { type PerfProject, makePerf } from "wisp/scripts/wisp/commands/perf";
import { buildProject, tsDirectory } from "../project";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../../../src/game/sim/heroes/registry";
import { census, profile } from "../perfCensus";
import { budget } from "../perfBudget";

const main = buildProject("main");
const integrity = buildProject("integrity");
const integrityMap = { config: integrity.configPath, bundle: integrity.bundlePath };
const playable = buildProject("playable");
const playableMap = { config: playable.configPath, bundle: playable.bundlePath };

/** The perf program and the maps its runs measure; `wisp headless --cost` plays its quick-match too. */
export const SMASHCRAFT_PERF: PerfProject = {
  map: { config: main.configPath, bundle: main.bundlePath },
  program: { config: join(tsDirectory, "tsconfig.perf.json"), bundle: join(tsDirectory, "build/perf.lua") },
  defaultRun: "quick-match",
  runs: { bot: integrityMap, "bot-four": integrityMap, "playable-bot-four": playableMap, ...Object.fromEntries(SELECTABLE_CHARACTERS.map((character) => [`bot-${fighterSlug(character)}`, integrityMap])) },
};

const measure = makePerf(SMASHCRAFT_PERF);
const spikeCensus = census({ map: playableMap, program: SMASHCRAFT_PERF.program });

const runProfile = profile(SMASHCRAFT_PERF);

export const perf: typeof measure = (args) =>
  args[0] === "census" ? spikeCensus(args.slice(1)) : args[0] === "budget" ? budget(args.slice(1)) : args[0] === "profile" ? runProfile(args.slice(1)) : measure(args);
