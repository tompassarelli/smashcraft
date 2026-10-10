


import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase, humanActive } from "../../game/match/rules";
import { trampoline } from "wisp/src/platform/dispatch";
import { type ShellState, activeRollback } from "./state";

import { pauseCameraKey } from "./pauseCamera";

export const KEY_DOWN = "shell.keyDown";
export const KEY_UP = "shell.keyUp";


export const Key = {
  enter: 0x0d, escape: 0x1b, g: 0x47, h: 0x48, j: 0x4a, k: 0x4b, n: 0x4e, r: 0x52, t: 0x54, u: 0x55, w: 0x57, y: 0x59, f1: 0x70, f2: 0x71,
} as const;


export function registerKey(s: Readonly<ShellState>, trigger: trigger, key: number, down: boolean, meta: number = 0): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(s.game, slot)) BlzTriggerRegisterPlayerKeyEvent(trigger, Player(slot), ConvertOsKeyType(key), meta, down);
  }
}

function registerKeys(s: ShellState, escapeOnly: boolean): void {
  const { keyEvents } = s;
  if (keyEvents.down !== undefined || keyEvents.up !== undefined) {
    if (keyEvents.escapeOnly === escapeOnly) return;
    removeKeyEvents(s);
  }
  const down = CreateTrigger();
  const up = CreateTrigger();
  for (let key = 1; key <= 255; key++) {

    const pauseKey = pauseCameraKey(key) || key === Key.escape || key === Key.f2 || key === 0x26 || key === 0x28 || key === 32 || key === 69 || key === Key.n || key === Key.u;
    if (key === Key.y || key === Key.enter || (escapeOnly && !pauseKey)) continue;
    registerKey(s, down, key, true);
    registerKey(s, up, key, false);
    if (key === 0xbb) {
      registerKey(s, down, key, true, 1);
      registerKey(s, up, key, false, 1);
    }
  }
  TriggerAddAction(down, trampoline(KEY_DOWN));
  TriggerAddAction(up, trampoline(KEY_UP));
  keyEvents.down = down;
  keyEvents.up = up;
  keyEvents.escapeOnly = escapeOnly;
}

export function removeKeyEvents(s: ShellState): void {
  const { keyEvents } = s;
  if (keyEvents.down !== undefined) DestroyTrigger(keyEvents.down);
  if (keyEvents.up !== undefined) DestroyTrigger(keyEvents.up);
  keyEvents.down = undefined;
  keyEvents.up = undefined;
}






export function syncKeyEvents(s: ShellState): void {
  const rollbackMatch = activeRollback(s) !== undefined && s.game.phase === Phase.match;
  if (rollbackMatch && !s.session.paused) removeKeyEvents(s);
  else registerKeys(s, s.session.paused || s.pauseMenu?.title === true);
}
