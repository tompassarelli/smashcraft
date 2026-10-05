// The map's TypeScript entry. The map's main() calls start() once; every hot
// reload calls the new bundle's install(), which registers every handler
// again, so the reloader and error reporting reload too.
import { CURRENT_BUILD } from "../game/shell/currentBuild";
import type { MapBuild } from "../game/shell/build";
import { replayHistoryPlayback } from "../game/shell/rollbackPlayback";
import { configureRuntime } from "wisp/src/runtime/config";
import { installDispatch } from "wisp/src/platform/dispatch";
import { installHotReload, startHotReload } from "wisp/src/platform/hotReload";
import { installShell, startShell } from "./shell/shell";
import { installObjectData } from "./shell/objectData";

export function install(this: void): void {
  configureRuntime({ filePrefix: "smashcraft", globalPrefix: "__smashcraft", readyPrefix: "SC_HRR" });
  installDispatch();
  installShell();
  installObjectData();
  installHotReload();
}

/** Both native input profiles share the same shell and reload lifecycle. */
export function startBuild(this: void, build: MapBuild): void {
  install();
  startShell(build, replayHistoryPlayback());
  startHotReload();
}

export function start(this: void): void {
  startBuild(CURRENT_BUILD);
}
