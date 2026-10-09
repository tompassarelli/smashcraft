










import { type PerfMeasure, runLuaPerf, runLuaPerfWith } from "wisp/src/headless/luaPerf";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../../src/game/sim/heroes/registry";
import { BOT_FOUR, BOT_THREE, HUMAN_DUEL, HUMAN_FOUR, botMatchAgainst, playBotMatch } from "./botMatch";
import { PREDICTED_LOCAL_NATIVES, SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { PLAYABLE_BUILD } from "../../src/game/shell/currentBuild";
import { QUICK_MATCH } from "./quickMatch";
import { playFighterCensus, playStageCensus } from "./census";
import { profileRun } from "./censusProfile";
import type { LuaHeadlessMap } from "wisp/src/headless/lua";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "./headlessNatives";

declare const arg: Readonly<Record<number, string | undefined>>;

const [bundle, declarations, run = "quick-match", framesText = "1800", samples] = [arg[1], arg[2], arg[3], arg[4], arg[5]];
if (bundle === undefined || declarations === undefined) throw new Error("usage: lua perf.lua MAP_LUA WARCRAFT_D_TS [RUN [FRAMES [samples]]]");
const map = { filePrefix: "smashcraft", localNatives: SMASHCRAFT_LOCAL_NATIVES, intentionalNoops: SMASHCRAFT_NOOPS, natives: smashcraftNativeBehavior };
const options = { samples: samples === "samples" };
const computer = SELECTABLE_CHARACTERS.find((character) => run === `bot-${fighterSlug(character)}`);
const humans = run === "playable-duel" ? HUMAN_DUEL : run === "playable-human-four" ? HUMAN_FOUR : undefined;
const bot = humans ?? (run === "bot" ? BOT_THREE : run === "bot-four" || run === "playable-bot-four" ? BOT_FOUR : computer !== undefined ? botMatchAgainst(computer) : undefined);
const censusFighter = SELECTABLE_CHARACTERS.find((character) => run === `census-${fighterSlug(character)}`);
const censusStage = run.startsWith("census-stage-") ? Number(run.substring("census-stage-".length)) : undefined;

const profileText = os.getenv("PERF_PROFILE_FRAMES");
const measured = (headless: LuaHeadlessMap, play: (this: void, clients: Lockstep, measure: PerfMeasure) => { readonly problems: number; readonly lines: readonly string[] }, delivery?: SyncDelivery) => {
  if (profileText === undefined) return runLuaPerfWith(headless, bundle, declarations, play, delivery === undefined ? options : { ...options, delivery });
  const frames = new Set<number>();
  for (const text of profileText.split(",")) if (text !== "") frames.add(Number(text));
  return profileRun(headless, bundle, declarations, frames, play, delivery, os.getenv("PERF_PROFILE_PHASES") === "1");
};
let problems: number;
if (censusFighter !== undefined || censusStage !== undefined) {

  const census = { ...map, players: [0] };
  const play = (clients: Lockstep, measure: PerfMeasure) => censusFighter !== undefined ? playFighterCensus(clients, measure, censusFighter, fighterSlug(censusFighter)) : playStageCensus(clients, measure, censusStage ?? 0, `${censusStage}`);
  problems = measured(census, play);
} else if (run === "quick-match") problems = runLuaPerf(map, QUICK_MATCH, bundle, declarations, options);
else if (bot !== undefined) {

  const predicted = { ...map, localNatives: PREDICTED_LOCAL_NATIVES, players: run === "playable-human-four" ? [0, 1, 2, 3] : [0, 1] };
  const build = run.startsWith("playable-") ? PLAYABLE_BUILD : undefined;
  problems = measured(predicted, (clients, measure) => playBotMatch(clients, bot, Number(framesText), measure, build), syncDelivery(MEASURED_BATTLE_NET, 7));
} else throw new Error(`no run named ${run}: quick-match, bot, bot-four, playable-bot-four, playable-duel, playable-human-four or bot-FIGHTER`);
if (problems > 0) os.exit(1);
