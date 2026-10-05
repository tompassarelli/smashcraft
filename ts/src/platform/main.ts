// The map's TypeScript entry. The map's main() calls start() once; every hot
// reload calls the new bundle's install(), which registers every handler
// again, so the reloader and error reporting reload too.
import { CURRENT_BUILD } from "../game/shell/currentBuild";
import { uncorrectedPlayback } from "../game/shell/uncorrectedPlayback";
import { installDispatch } from "./dispatch";
import { installHotReload, startHotReload } from "./hotReload";
import { installShell, startShell } from "./shell/shell";

export function install(this: void): void {
  installDispatch();
  installShell();
  installHotReload();
}

export function start(this: void): void {
  install();
  startShell(CURRENT_BUILD, uncorrectedPlayback());
  startHotReload(0, GetPlayerId(GetLocalPlayer()));
}
