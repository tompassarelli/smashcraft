import { ACTION_ORDER, Action } from "./actions";
import { type DirectionalInput, clearDirections, directionOf, neutralDirections, updateDirections } from "./directionalInput";
import type { Direction } from "./inputRow";
import { type KeyBindings, actionFor, keyFor } from "./keyBindings";

const KEY_CODES = 256;

/**
 * One participant's keys, from synchronized key events and that player's own
 * bindings. An action bound to two keys stays held until both are up.
 */
export interface PlayerKeys {
  /** Whether each Warcraft key code, 0 through 255, is down. */
  readonly down: boolean[];
  /** Action bits held by each binding slot; each mask fits Lua's 32-bit integer. */
  heldFirst: number;
  heldSecond: number;
  /** The movement keys read as a stick. */
  readonly directions: DirectionalInput;
}

export function playerKeys(): PlayerKeys {
  return { down: Array.from({ length: KEY_CODES }, () => false), heldFirst: 0, heldSecond: 0, directions: neutralDirections() };
}

const isKeyCode = (key: number) => key >= 0 && key < KEY_CODES;

export function keyDown({ down }: Readonly<PlayerKeys>, key: number): boolean {
  return isKeyCode(key) && down[key] === true;
}

export function actionHeld({ heldFirst, heldSecond }: Readonly<PlayerKeys>, action: Action): boolean {
  return ((heldFirst | heldSecond) & (1 << action)) !== 0;
}

/** The held actions as an input mask. */
export function heldActions(keys: Readonly<PlayerKeys>): number {
  let mask = 0;
  for (const action of ACTION_ORDER) {
    if (actionHeld(keys, action)) mask |= 1 << action;
  }
  return mask;
}

export function directionX(keys: Readonly<PlayerKeys>): Direction {
  return directionOf(heldActions(keys), Action.moveRight, Action.moveLeft);
}

export function directionZ(keys: Readonly<PlayerKeys>): Direction {
  return directionOf(heldActions(keys), Action.moveUp, Action.moveDown);
}

function holdSlot(keys: PlayerKeys, key: number, bindings: Readonly<KeyBindings>, held: boolean): Action | undefined {
  const action = actionFor(bindings, key);
  if (action === undefined) return undefined;
  const slot = 1 << action;
  if (keyFor(bindings, action, 0) === key) keys.heldFirst = held ? keys.heldFirst | slot : keys.heldFirst & ~slot;
  else keys.heldSecond = held ? keys.heldSecond | slot : keys.heldSecond & ~slot;
  updateDirections(keys.directions, directionX(keys), directionZ(keys));
  return action;
}

/** A key went down: the action it holds, or undefined for an unbound key or a repeat of a key already down. */
export function pressKey(keys: PlayerKeys, key: number, bindings: Readonly<KeyBindings>): Action | undefined {
  if (!isKeyCode(key) || keys.down[key] === true) return undefined;
  keys.down[key] = true;
  return holdSlot(keys, key, bindings, true);
}

/** A key went up: the action it held, or undefined for an unbound key or one not down. */
export function releaseKey(keys: PlayerKeys, key: number, bindings: Readonly<KeyBindings>): Action | undefined {
  if (!isKeyCode(key) || keys.down[key] !== true) return undefined;
  keys.down[key] = false;
  return holdSlot(keys, key, bindings, false);
}

export function clearKeys(keys: PlayerKeys): void {
  keys.down.fill(false);
  keys.heldFirst = 0;
  keys.heldSecond = 0;
  clearDirections(keys.directions);
}
