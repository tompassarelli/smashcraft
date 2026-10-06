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
