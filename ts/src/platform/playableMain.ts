import { PLAYABLE_BUILD } from "../game/shell/currentBuild";
import { startBuild } from "./main";
export { install } from "./main";

export function start(this: void): void {
  startBuild(PLAYABLE_BUILD);
}
