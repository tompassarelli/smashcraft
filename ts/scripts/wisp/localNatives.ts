


import type { LocalNatives } from "wisp/src/headless/client";






export const SMASHCRAFT_LOCAL_NATIVES: LocalNatives = {
  GetLocalizedString: "reads the local graphics mode's cue string; only effect poses depend on it",
  BlzGetLocalClientWidth: "local screen size, for layout",
  BlzGetLocalClientHeight: "local screen size, for layout",
  SetCameraBounds: "frames this client's camera for its screen aspect",
  SetCameraField: "frames this client's camera for its screen aspect",
  SetCameraPosition: "frames this client's camera for its screen aspect",
  PanCameraToTimed: "moves this client's camera during the native smoothing experiment",
  SetCineFilterTexture: "shows the KO flash over this client's screen",
  SetCineFilterBlendMode: "shows the KO flash over this client's screen",
  SetCineFilterTexMapFlags: "shows the KO flash over this client's screen",
  SetCineFilterStartUV: "shows the KO flash over this client's screen",
  SetCineFilterEndUV: "shows the KO flash over this client's screen",
  SetCineFilterStartColor: "shows the KO flash over this client's screen",
  SetCineFilterEndColor: "shows the KO flash over this client's screen",
  SetCineFilterDuration: "shows the KO flash over this client's screen",
  DisplayCineFilter: "shows the KO flash over this client's screen",
  GetCameraField: "reads this client's current camera fields for its response probe",
  GetCameraTargetPositionX: "reads this client's current camera target for its response probe",
  BlzSetSpecialEffectX: "places an existing results pose beside this client's camera",
  BlzGetMouseScreenPosX: "local pointer, sent through sync data when it chooses",
  BlzGetMouseScreenPosY: "local pointer, sent through sync data when it chooses",
  BlzIsMouseButtonPressed: "local pointer, sent through sync data when it chooses",
  BlzEnableCursor: "hides this client's cursor while its painted hand is drawn",
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







const PREDICTED_PRESENTATION: LocalNatives = {
  ...Object.fromEntries([
    "BlzPlaySpecialEffect", "BlzSetSpecialEffectAlpha", "BlzSetSpecialEffectAnimation", "BlzSetSpecialEffectAnimationBlendTime", "BlzSetSpecialEffectColor",
    "BlzSetSpecialEffectColorByPlayer", "BlzSetSpecialEffectMatrixScale", "BlzSetSpecialEffectPitch", "BlzSetSpecialEffectPosition",
    "BlzSetSpecialEffectRoll", "BlzSetSpecialEffectScale", "BlzSetSpecialEffectTime", "BlzSetSpecialEffectTimeScale", "BlzSetSpecialEffectYaw",
  ].map((name) => [name, "poses an existing effect from this client's prediction"])),
  MoveLightningEx: "places training's existing hit-area outlines from this client's prediction",
  SetLightningColor: "shows or hides training's existing hit-area outlines from this client's prediction",
};


export const PREDICTED_LOCAL_NATIVES: LocalNatives = { ...SMASHCRAFT_LOCAL_NATIVES, ...PREDICTED_PRESENTATION };
