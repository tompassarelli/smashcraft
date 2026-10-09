import { INTEGRITY_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";
import { installFrameMeter, startMatchFrameMeter } from "./frameMeter";
import { installSceneReport, startMatchSceneReport } from "./sceneReport";

export function install(this: void): void {
  installGame();
  installSceneReport();
  installFrameMeter();
}


export function start(this: void): void {
  startBuild(INTEGRITY_BUILD);
  startMatchSceneReport();
  startMatchFrameMeter();
}
