// Native keyboard timing uses the playable input and presentation. The probe
// records callback rows and a rendered marker; its overhead is diagnostic.
import type { MapBuild } from "../game/shell/build";
import { PLAYABLE_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";

const NATIVE_INPUT_BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-native-input", responseProbe: true, devConsole: true };

export function install(this: void): void {
  installGame(NATIVE_INPUT_BUILD);
}

export function start(this: void): void {
  startBuild(NATIVE_INPUT_BUILD);
}
