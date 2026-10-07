// Smashcraft's map in Wisp's headless runtime (wisp:docs/headless.md), for
// the desync guard, visual-lifecycle, player-view and stack-trace tests and
// `bun wisp headless` (commands/headless.ts). It imports nothing heavier than
// types, so each test process stays fast.
import type { HeadlessMap } from "wisp/scripts/wisp/headless";
import { PREDICTED_LOCAL_NATIVES, SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { UI_FRAMES } from "./uiFrames";

export const SMASHCRAFT_HEADLESS: HeadlessMap = {
  filePrefix: "smashcraft",
  globalPrefixes: ["__smashcraft"],
  localNatives: SMASHCRAFT_LOCAL_NATIVES,
  frames: UI_FRAMES.map(({ definition }) => definition),
};

/** Smashcraft's map with predicted presentation, whose confirmed state and handle lifetimes still match on every client. */
export const PREDICTED_HEADLESS: HeadlessMap = { ...SMASHCRAFT_HEADLESS, localNatives: PREDICTED_LOCAL_NATIVES };
