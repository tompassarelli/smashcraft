// The map's TypeScript entry. The map's main() calls start() once; every hot
// reload calls the new bundle's install(), which registers every handler
// again, so the reloader and error reporting reload too.
import { CURRENT_BUILD } from "../game/shell/currentBuild";
import type { MapBuild } from "../game/shell/build";
import { replayHistoryPlayback } from "../game/shell/rollbackPlayback";
import { configureRuntime } from "waygate/src/runtime/config";
import { installDispatch } from "waygate/src/platform/dispatch";
import { installHotReload, startHotReload } from "waygate/src/platform/hotReload";
import { installShell, startShell } from "./shell/shell";
import { installObjectData } from "./shell/objectData";

export function install(this: void): void {
  configureRuntime({ filePrefix: "smashcraft", globalPrefix: "__smashcraft", announcePrefix: "SC_HR", readyPrefix: "SC_HRR" });
  installDispatch();
  installShell();
  installObjectData();
  installHotReload();
}

/** Both native input profiles share the same shell and reload lifecycle. */
export function startBuild(this: void, build: MapBuild): void {
  install();
  startShell(build, replayHistoryPlayback());
  startHotReload(0, GetPlayerId(GetLocalPlayer()));
}

export function start(this: void): void {
  startBuild(CURRENT_BUILD);
}
