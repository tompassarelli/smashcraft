// The map's TypeScript entry. The map's main() calls start() once; every hot
// reload calls the new bundle's install(), which registers every handler
// again, so the reloader and error reporting reload too.
import { CURRENT_BUILD } from "../game/shell/currentBuild";
import type { MapBuild } from "../game/shell/build";
import { replayHistoryPlayback } from "../game/shell/rollbackPlayback";
import { configureRuntime } from "wisp/src/runtime/config";
import { installDispatch } from "wisp/src/platform/dispatch";
import { installHotReload, startHotReload } from "wisp/src/platform/hotReload";
import { startModelFailures } from "wisp/src/platform/modelFailures";
import { installShell, startShell } from "./shell/shell";
import { installObjectData } from "./shell/objectData";
import { installTuning } from "./shell/tuning";
import { prepareKitDigests } from "../game/replay/canonical";

/** Each reload's install() configures the runtime again, so it names the build's error text too. */
export function install(this: void, build: MapBuild = CURRENT_BUILD): void {
  configureRuntime({ filePrefix: "smashcraft", globalPrefix: "__smashcraft", readyPrefix: "SC_HRR", errorsOnScreen: build.errorsOnScreen });
  installDispatch();
  installShell();
  installObjectData();
  installTuning();
  // Hero kit digests are folded here, at load, so no match frame pays for them.
  prepareKitDigests();
  installHotReload();
}

/** Both native input profiles share the same shell and reload lifecycle. */
export function startBuild(this: void, build: MapBuild): void {
  install(build);
  startModelFailures();
  startShell(build, replayHistoryPlayback());
  if (build.hotReload) startHotReload();
}

export function start(this: void): void {
  startBuild(CURRENT_BUILD);
}
