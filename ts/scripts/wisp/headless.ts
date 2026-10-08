// Smashcraft's map in Wisp's headless runtime (wisp:docs/headless.md), for
// the desync guard, visual-lifecycle, player-view and stack-trace tests and
// `bun wisp headless` (commands/headless.ts). It imports nothing heavier than
// types, so each test process stays fast.
import type { HeadlessMap } from "wisp/scripts/wisp/headless";
import { PREDICTED_LOCAL_NATIVES, SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { UI_FRAMES } from "./uiFrames";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "./headlessNatives";

/** tools/selection/art/SmashcraftHUD.fdf's damage text, as Warcraft loads it. */
const SMASHCRAFT_DAMAGE_TEMPLATE = {
  name: "SmashcraftDamage", type: "TEXT", width: 0, height: 0, text: "0.0%", children: [],
  font: { file: "MasterFont", size: 0.036, flags: 1 }, justify: { horizontal: "LEFT", vertical: "MIDDLE" },
} as const;

export const SMASHCRAFT_HEADLESS: HeadlessMap = {
  filePrefix: "smashcraft",
  globalPrefixes: ["__smashcraft"],
  localNatives: SMASHCRAFT_LOCAL_NATIVES,
  intentionalNoops: SMASHCRAFT_NOOPS,
  natives: smashcraftNativeBehavior,
  frames: [...UI_FRAMES.map(({ definition }) => definition), SMASHCRAFT_DAMAGE_TEMPLATE],
};

/** Smashcraft's map with predicted presentation, whose confirmed state and handle lifetimes still match on every client. */
export const PREDICTED_HEADLESS: HeadlessMap = { ...SMASHCRAFT_HEADLESS, localNatives: PREDICTED_LOCAL_NATIVES };
