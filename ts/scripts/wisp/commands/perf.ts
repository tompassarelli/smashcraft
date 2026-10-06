// `bun wisp perf [--out FILE]`: the development build's quick match in 32-bit
// Lua with every frame measured; `bun wisp perf compare A B` holds run B to
// run A (wisp:docs/frame-cost.md#headless).
import { join } from "node:path";
import { makePerf } from "wisp/scripts/wisp/commands/perf";
import { buildProject, tsDirectory } from "../project";

const main = buildProject("main");

export const perf = makePerf({
  map: { config: main.configPath, bundle: main.bundlePath },
  program: { config: join(tsDirectory, "tsconfig.perf.json"), bundle: join(tsDirectory, "build/perf.lua") },
});
