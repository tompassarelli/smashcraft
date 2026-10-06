// `bun wisp perf`'s program (commands/perf.ts): the development build's quick
// match in two simulated clients in 32-bit Lua, each frame measured
// (wisp:docs/frame-cost.md#headless).
// Usage: lua build/perf.lua build/map.lua node_modules/wisp/src/natives/warcraft.d.ts
import { runLuaPerf } from "wisp/src/headless/luaPerf";
import { SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { QUICK_MATCH } from "./quickMatch";

declare const arg: Readonly<Record<number, string | undefined>>;

const [bundle, declarations] = [arg[1], arg[2]];
if (bundle === undefined || declarations === undefined) throw new Error("usage: lua perf.lua MAP_LUA WARCRAFT_D_TS");
if (runLuaPerf({ filePrefix: "smashcraft", localNatives: SMASHCRAFT_LOCAL_NATIVES }, QUICK_MATCH, bundle, declarations) > 0) os.exit(1);
