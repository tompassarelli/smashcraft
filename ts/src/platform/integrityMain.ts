import { INTEGRITY_BUILD } from "../game/shell/currentBuild";
import { startBuild } from "./main";
export { install } from "./main";

/** Normal production gameplay with the native helper's journal/editbox input. */
export function start(this: void): void {
  startBuild(INTEGRITY_BUILD);
}
