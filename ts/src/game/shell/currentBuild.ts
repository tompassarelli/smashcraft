// The build this map runs. The checked-in value is the development loop's:
// key events, unit animation, and the dev console for
// `-dev quick`. Native integrity runs (#26) use INTEGRITY_BUILD with the
// companion helper's journal. The playable build reads Warcraft's own
// synchronized key events, as the development build does, so it plays with
// nothing but Warcraft and a keyboard; a controller helper, when one runs,
// presses the same keys (#166).
import type { MapBuild } from "./build";

export const INTEGRITY_BUILD: MapBuild = {
  id: "typescript-integrity",
  inputProfile: "shadow-d0-r24",
  input: { kind: "journal", ingress: "editbox", delay: 0, rollback: 24 },
  presentation: "pool-predicted",
  scenario: "normal",
  responseProbe: true,
  devConsole: true,
  errorsOnScreen: true,
  hotReload: true,
};

export const PLAYABLE_BUILD: MapBuild = {
  id: "playable-0047",
  inputProfile: "callback",
  input: { kind: "callback" },
  presentation: "pool-confirmed",
  scenario: "normal",
  responseProbe: false,
  devConsole: false,
  errorsOnScreen: false,
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
  errorsOnScreen: true,
  hotReload: true,
};
