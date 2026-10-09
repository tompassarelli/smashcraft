


import { on, trampoline } from "wisp/src/platform/dispatch";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import type { MapBuild } from "../game/shell/build";

export const STACK_DEMO_COMMAND = "-dev stack-demo";
export const STACK_DEMO_HANDLER = "stackDemo.command";

function failInnermost(label: string): never {
  throw new Error(`stack demo failure: ${label}`);
}

function runMiddle(label: string): void {
  failInnermost(label);
}

function runOuter(label: string): void {
  runMiddle(label);
}

function stackDemoCommand(): void {
  runOuter(GetEventPlayerChatString());
}


export function installStackDemo(build: Readonly<MapBuild>): void {
  if (build.devConsole) on(STACK_DEMO_HANDLER, stackDemoCommand);
}

export function startStackDemo(build: Readonly<MapBuild>): void {
  if (!build.devConsole) return;
  const chat = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) TriggerRegisterPlayerChatEvent(chat, Player(slot), STACK_DEMO_COMMAND, false);
  TriggerAddAction(chat, trampoline(STACK_DEMO_HANDLER));
}
