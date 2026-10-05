// The stack-trace diagnostic profile: the development build plus a deliberate
// failure (`-dev stack-demo`), compiled with Waygate's stack plugin.
import { CURRENT_BUILD } from "../game/shell/currentBuild";
import type { MapBuild } from "../game/shell/build";
import { install as installMap, startBuild } from "./main";
import { installStackDemo, startStackDemo } from "./stackDemo";

const STACK_TRACE_BUILD: MapBuild = { ...CURRENT_BUILD, id: "typescript-stack-trace" };

export function install(this: void): void {
  installMap();
  installStackDemo(STACK_TRACE_BUILD);
}

export function start(this: void): void {
  startBuild(STACK_TRACE_BUILD);
  installStackDemo(STACK_TRACE_BUILD);
  startStackDemo(STACK_TRACE_BUILD);
}
