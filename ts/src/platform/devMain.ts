// The development map's entry: the game's entry plus the scene report and the
// frame meter. The playable entry shares main.ts and never compiles this module.
import { CURRENT_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";
import { installFrameMeter, startMatchFrameMeter } from "./frameMeter";
import { installSceneReport, startMatchSceneReport } from "./sceneReport";

export function install(this: void): void {
  installGame();
  installSceneReport();
  installFrameMeter();
}

export function start(this: void): void {
  startBuild(CURRENT_BUILD);
  startMatchSceneReport();
  startMatchFrameMeter();
}
