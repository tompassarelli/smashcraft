



import type { HeadlessMap } from "wisp/scripts/wisp/headless";
import { PREDICTED_LOCAL_NATIVES, SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { UI_FRAMES } from "./uiFrames";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "./headlessNatives";


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


export const PREDICTED_HEADLESS: HeadlessMap = { ...SMASHCRAFT_HEADLESS, localNatives: PREDICTED_LOCAL_NATIVES };
