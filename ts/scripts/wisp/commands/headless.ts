// `wisp headless [quick-match|desync] [--clients N]`: plays a journey in
// simulated clients of the development build, whose entry starts the scene
// recorder, and prints a desync, error reports, a hot reload that didn't run
// and what a player would see wrong (wisp:docs/headless.md).
import { makeHeadless } from "wisp/scripts/wisp/commands/headless";

export const headless = makeHeadless(async () => (await import("../journeys")).SMASHCRAFT_JOURNEYS);
