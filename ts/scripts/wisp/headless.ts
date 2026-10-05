// Smashcraft's map in Wisp's headless runtime (wisp:docs/headless.md), for
// the desync guard, visual-lifecycle, player-view and stack-trace tests and
// `bun wisp headless` (commands/headless.ts). It imports nothing heavier than
// types, so each test process stays fast.
import type { HeadlessMap } from "wisp/scripts/wisp/headless";

/**
 * Natives Smashcraft calls on one client only, beyond the ones Wisp's runtime
 * does: they read or show local state and create, destroy or change nothing
 * synchronized.
 */
const SMASHCRAFT_LOCAL_NATIVES = {
  BlzGetLocalClientWidth: "local screen size, for layout",
  BlzGetLocalClientHeight: "local screen size, for layout",
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
};

export const SMASHCRAFT_HEADLESS: HeadlessMap = {
  filePrefix: "smashcraft",
  globalPrefixes: ["__smashcraft"],
  localNatives: SMASHCRAFT_LOCAL_NATIVES,
};
