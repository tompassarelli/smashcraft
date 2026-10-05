// The development map's entry: the game's entry plus the scene report. The
// playable entry shares main.ts and never compiles this module.
import { CURRENT_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";
import { installSceneReport, startMatchSceneReport } from "./sceneReport";

export function install(this: void): void {
  installGame();
  installSceneReport();
}

export function start(this: void): void {
  startBuild(CURRENT_BUILD);
  startMatchSceneReport();
}
