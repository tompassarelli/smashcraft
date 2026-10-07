// The build this map runs. The checked-in value is the development loop's:
// key events, unit animation, and the dev console for
// `-dev quick`. Native integrity runs (#26) use INTEGRITY_BUILD with the
// companion helper's journal. The playable build polls local keys into
// fixed-delay rollback rows, so it plays with
// nothing but Warcraft and a keyboard; a controller helper, when one runs,
// presses the same keys (#166).
import type { MapBuild } from "./build";

export const INTEGRITY_BUILD: MapBuild = {
  id: "typescript-integrity",
  inputProfile: "shadow-d2-r24",
  input: { kind: "journal", ingress: "editbox", delay: 2, rollback: 24 },
  presentation: "pool-predicted",
  scenario: "normal",
  responseProbe: true,
  devConsole: true,
  errorsOnScreen: true,
  hotReload: true,
};

export const PLAYABLE_BUILD: MapBuild = {
  id: "playable-0047",
  inputProfile: "keyboard-d2-r24",
  input: { kind: "keyboard", pairedSends: false, delay: 2, rollback: 24 },
  presentation: "pool-predicted",
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
