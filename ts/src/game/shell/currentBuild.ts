// The build this map runs. The checked-in value is the development loop's:
// key events, unit animation, and the dev console for
// `-dev quick`. Native integrity runs (#26) use INTEGRITY_BUILD with the
// companion helper.
import type { MapBuild } from "./build";

export const INTEGRITY_BUILD: MapBuild = {
  id: "typescript-integrity",
  inputProfile: "shadow-d0-r24",
  input: { kind: "journal", ingress: "editbox", delay: 0, rollback: 24 },
  presentation: "pool-predicted",
  scenario: "normal",
  responseProbe: true,
  devConsole: true,
  hotReload: true,
};

export const PLAYABLE_BUILD: MapBuild = {
  ...INTEGRITY_BUILD,
  id: "playable-0045",
  responseProbe: false,
  devConsole: false,
  hotReload: false,
};

export const CURRENT_BUILD: MapBuild = {
  id: "typescript-dev",
  inputProfile: "callback",
  input: { kind: "callback" },
  presentation: "native",
  scenario: "normal",
  responseProbe: false,
  devConsole: true,
  hotReload: true,
};
