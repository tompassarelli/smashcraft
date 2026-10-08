import { INTEGRITY_BUILD } from "../game/shell/currentBuild";
import { startBuild } from "./main";
import { startMatchFrameMeter } from "./frameMeter";
import { startMatchSceneReport } from "./sceneReport";

export { install } from "./integrityMain";

export function start(this: void): void {
  startBuild({ ...INTEGRITY_BUILD, pausePositionProbe: true });
  startMatchSceneReport();
  startMatchFrameMeter();
}
