// Smashcraft's map in Wisp's headless runtime (wisp:docs/headless.md), for
// the desync guard, visual-lifecycle, player-view and stack-trace tests and
// `bun wisp headless` (commands/headless.ts). It imports nothing heavier than
// types, so each test process stays fast.
import type { HeadlessMap } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";

export const SMASHCRAFT_HEADLESS: HeadlessMap = {
  filePrefix: "smashcraft",
  globalPrefixes: ["__smashcraft"],
  localNatives: SMASHCRAFT_LOCAL_NATIVES,
};

/**
 * The integrity and playable builds' pool-predicted presentation poses
 * existing effects and frames the camera from each client's own prediction,
 * which differs between clients until inputs confirm; creating and
 * destroying effects stays synchronized.
 */
const PREDICTED_PRESENTATION: Readonly<Record<string, string>> = {
  ...Object.fromEntries([
    "BlzSetSpecialEffectAlpha", "BlzSetSpecialEffectAnimation", "BlzSetSpecialEffectAnimationBlendTime", "BlzSetSpecialEffectColor",
    "BlzSetSpecialEffectColorByPlayer", "BlzSetSpecialEffectMatrixScale", "BlzSetSpecialEffectPitch", "BlzSetSpecialEffectPosition",
    "BlzSetSpecialEffectRoll", "BlzSetSpecialEffectScale", "BlzSetSpecialEffectTime", "BlzSetSpecialEffectTimeScale", "BlzSetSpecialEffectYaw",
  ].map((name) => [name, "poses an existing effect from this client's prediction"])),
  ...Object.fromEntries(["SetCameraBounds", "SetCameraField", "SetCameraPosition"].map((name) => [name, "frames this client's camera on its predicted fighters"])),
};

/** Smashcraft's map with predicted presentation, whose confirmed state and handle lifetimes still match on every client. */
export const PREDICTED_HEADLESS: HeadlessMap = { ...SMASHCRAFT_HEADLESS, localNatives: { ...SMASHCRAFT_LOCAL_NATIVES, ...PREDICTED_PRESENTATION } };
