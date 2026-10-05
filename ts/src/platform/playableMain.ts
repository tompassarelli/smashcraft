import { PLAYABLE_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";

export function install(this: void): void {
  installGame(PLAYABLE_BUILD);
}

export function start(this: void): void {
  startBuild(PLAYABLE_BUILD);
}
