


import type { MapBuild } from "../game/shell/build";
import { PLAYABLE_BUILD } from "../game/shell/currentBuild";
import { installFrameMeter, startMatchFrameMeter } from "./frameMeter";
import { install as installGame, startBuild } from "./main";

const NATIVE_PERF_BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-native-perf", devConsole: true };

export function install(this: void): void {
  installGame(NATIVE_PERF_BUILD);
  installFrameMeter();
}

export function start(this: void): void {
  startBuild(NATIVE_PERF_BUILD);
  startMatchFrameMeter();
}
