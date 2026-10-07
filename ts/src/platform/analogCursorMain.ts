import { PLAYABLE_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";
import type { MapBuild } from "../game/shell/build";

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-analog-cursor", analogPad: "cursor", responseProbe: true, devConsole: true };

export function install(this: void): void { installGame(BUILD); }
export function start(this: void): void { startBuild(BUILD); }
