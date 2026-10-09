






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


export const NATIVE_DRIVER_BUILD: MapBuild = { ...CURRENT_BUILD, id: "typescript-native-driver", inputProfile: "native-driver", hotReload: false };
