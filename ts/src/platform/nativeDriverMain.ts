import { NATIVE_DRIVER_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";
import { installSmashcraftNativeDriver, startSmashcraftNativeDriver } from "./nativeDriver";

export function install(this: void): void {
  installGame(NATIVE_DRIVER_BUILD);
  installSmashcraftNativeDriver();
}

export function start(this: void): void {
  startBuild(NATIVE_DRIVER_BUILD);
  installSmashcraftNativeDriver();
  startSmashcraftNativeDriver();
}
