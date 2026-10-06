// `bun wisp perf`'s program (commands/perf.ts): one of Smashcraft's runs in
// simulated clients in 32-bit Lua, each frame measured
// (wisp:docs/frame-cost.md#headless). quick-match is the development build's
// quick match; bot and bot-four are the native bot session's match with the
// integrity build (botMatch.ts), counted from its first match frame.
// Usage: lua build/perf.lua MAP_LUA WARCRAFT_D_TS [RUN [FRAMES [samples]]]
import { runLuaPerf, runLuaPerfWith } from "wisp/src/headless/luaPerf";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { BOT_FOUR, BOT_THREE, playBotMatch } from "./botMatch";
import { PREDICTED_LOCAL_NATIVES, SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { QUICK_MATCH } from "./quickMatch";

declare const arg: Readonly<Record<number, string | undefined>>;

const [bundle, declarations, run = "quick-match", framesText = "1800", samples] = [arg[1], arg[2], arg[3], arg[4], arg[5]];
if (bundle === undefined || declarations === undefined) throw new Error("usage: lua perf.lua MAP_LUA WARCRAFT_D_TS [RUN [FRAMES [samples]]]");
const map = { filePrefix: "smashcraft", localNatives: SMASHCRAFT_LOCAL_NATIVES };
const options = { samples: samples === "samples" };
const bot = run === "bot" ? BOT_THREE : run === "bot-four" ? BOT_FOUR : undefined;
let problems: number;
if (run === "quick-match") problems = runLuaPerf(map, QUICK_MATCH, bundle, declarations, options);
else if (bot !== undefined) {
  // The integrity build poses effects and frames its camera from each client's own prediction.
  const predicted = { filePrefix: "smashcraft", localNatives: PREDICTED_LOCAL_NATIVES };
  problems = runLuaPerfWith(predicted, bundle, declarations, (clients, measure) => playBotMatch(clients, bot, Number(framesText), measure), { ...options, delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
} else throw new Error(`no run named ${run}: quick-match, bot or bot-four`);
if (problems > 0) os.exit(1);
