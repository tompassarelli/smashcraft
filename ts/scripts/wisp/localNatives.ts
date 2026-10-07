// The natives Smashcraft's code calls on one client only, for headless runs in
// Bun (headless.ts) and in 32-bit Lua (perfLua.ts). Plain data, so a Lua
// program can import it.
import type { LocalNatives } from "wisp/src/headless/client";

/**
 * Natives Smashcraft calls on one client only, beyond the ones Wisp's runtime
 * does: they read or show local state and create, destroy or change nothing
 * synchronized.
 */
export const SMASHCRAFT_LOCAL_NATIVES: LocalNatives = {
  BlzGetLocalClientWidth: "local screen size, for layout",
  BlzGetLocalClientHeight: "local screen size, for layout",
  SetCameraBounds: "frames this client's camera for its screen aspect",
  SetCameraField: "frames this client's camera for its screen aspect",
  SetCameraPosition: "frames this client's camera for its screen aspect",
  GetCameraField: "reads this client's current camera fields for its response probe",
  GetCameraTargetPositionX: "reads this client's current camera target for its response probe",
  BlzGetMouseScreenPosX: "local pointer, sent through sync data when it chooses",
  BlzGetMouseScreenPosY: "local pointer, sent through sync data when it chooses",
  BlzIsMouseButtonPressed: "local pointer, sent through sync data when it chooses",
  BlzIsKeyPressed: "local keys, sent through sync data as input rows",
  BlzIsLocalClientActive: "local focus, which input polling reads",
  BlzFrameSetVisible: "shows an existing frame on this client",
  BlzFrameSetText: "changes an existing frame's text on this client",
  BlzFrameSetTexture: "changes an existing frame's texture on this client",
  BlzFrameSetAbsPoint: "moves an existing frame on this client",
  BlzFrameSetSize: "sizes an existing frame on this client",
  BlzFrameSetEnable: "enables an existing frame on this client",
  BlzFrameSetFocus: "focuses an existing frame on this client",
  BlzFrameGetText: "reads an existing frame's local text",
  BlzFrameGetEnable: "reads an existing frame's local state",
  BlzFrameIsVisible: "reads an existing frame's local state",
  I2S: "pure conversion",
  R2S: "pure conversion",
  R2I: "pure conversion",
  I2R: "pure conversion",
  S2I: "pure conversion",
  ConvertOsKeyType: "pure conversion, for the local keys the keyboard polls",
};

/**
 * The integrity and playable builds' pool-predicted presentation poses
 * existing effects and frames the camera from each client's own prediction,
 * which differs between clients until inputs confirm; creating and
 * destroying effects stays synchronized.
 */
const PREDICTED_PRESENTATION: LocalNatives = {
  ...Object.fromEntries([
    "BlzPlaySpecialEffect", "BlzSetSpecialEffectAlpha", "BlzSetSpecialEffectAnimation", "BlzSetSpecialEffectAnimationBlendTime", "BlzSetSpecialEffectColor",
    "BlzSetSpecialEffectColorByPlayer", "BlzSetSpecialEffectMatrixScale", "BlzSetSpecialEffectPitch", "BlzSetSpecialEffectPosition",
    "BlzSetSpecialEffectRoll", "BlzSetSpecialEffectScale", "BlzSetSpecialEffectTime", "BlzSetSpecialEffectTimeScale", "BlzSetSpecialEffectYaw",
  ].map((name) => [name, "poses an existing effect from this client's prediction"])),
  MoveLightningEx: "places training's existing hit-area outlines from this client's prediction",
  SetLightningColor: "shows or hides training's existing hit-area outlines from this client's prediction",
};

/** Smashcraft's local natives with predicted presentation, whose confirmed state and handle lifetimes still match on every client. */
export const PREDICTED_LOCAL_NATIVES: LocalNatives = { ...SMASHCRAFT_LOCAL_NATIVES, ...PREDICTED_PRESENTATION };
