// Key event triggers. Start (Y) always has its own trigger; every other key
// is registered only while keys drive menus or a callback match. A rollback
// match polls the keyboard instead, so its triggers are removed for combat.
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase, humanActive } from "../../game/match/rules";
import { trampoline } from "waygate/src/platform/dispatch";
import { type ShellState, activeRollback } from "./state";

export const KEY_DOWN = "shell.keyDown";
export const KEY_UP = "shell.keyUp";

/** Warcraft OS key codes the shell reads by name. */
export const Key = {
  escape: 0x1b, g: 0x47, h: 0x48, j: 0x4a, n: 0x4e, r: 0x52, t: 0x54, u: 0x55, w: 0x57, y: 0x59, f1: 0x70,
} as const;

/** Registers the key, with no modifier, for every human. */
export function registerKey(s: Readonly<ShellState>, trigger: trigger, key: number, down: boolean): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(s.game, slot)) BlzTriggerRegisterPlayerKeyEvent(trigger, Player(slot), ConvertOsKeyType(key), 0, down);
  }
}

function registerAllKeys(s: ShellState): void {
  const { keyEvents } = s;
  if (keyEvents.down !== undefined || keyEvents.up !== undefined) return;
  const down = CreateTrigger();
  const up = CreateTrigger();
  for (let key = 1; key <= 255; key++) {
    if (key === Key.y) continue;
    registerKey(s, down, key, true);
    registerKey(s, up, key, false);
  }
  TriggerAddAction(down, trampoline(KEY_DOWN));
  TriggerAddAction(up, trampoline(KEY_UP));
  keyEvents.down = down;
  keyEvents.up = up;
}

export function removeKeyEvents(s: ShellState): void {
  const { keyEvents } = s;
  if (keyEvents.down !== undefined) DestroyTrigger(keyEvents.down);
  if (keyEvents.up !== undefined) DestroyTrigger(keyEvents.up);
  keyEvents.down = undefined;
  keyEvents.up = undefined;
}

/** Called after anything that changes the phase or the rollback session. */
export function syncKeyEvents(s: ShellState): void {
  if (activeRollback(s) !== undefined && s.game.phase === Phase.match) removeKeyEvents(s);
  else registerAllKeys(s);
}
