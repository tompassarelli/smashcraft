// `wisp headless [quick-match|desync] [--clients N] [--cost]`: plays a journey
// in simulated clients of the development build, whose entry starts the scene
// recorder, and prints a desync, error reports, a hot reload that didn't run
// and what a player would see wrong (wisp:docs/headless.md); --cost then
// plays the quick match in 32-bit Lua and prints each client's predicted
// native cost per frame (wisp:docs/frame-cost.md#predicted-native-cost).
import { makeHeadless } from "wisp/scripts/wisp/commands/headless";
import { SMASHCRAFT_PERF } from "./perf";

export const headless = makeHeadless(async () => (await import("../journeys")).SMASHCRAFT_JOURNEYS, SMASHCRAFT_PERF);
