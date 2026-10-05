import { ACTION_ORDER, Action } from "./actions";
import { type DirectionalInput, clearDirections, directionOf, neutralDirections, updateDirections } from "./directionalInput";
import type { Direction } from "./inputRow";
import { KEY_SLOT_COUNT, type KeyBindings, actionFor, keyFor, slotIndex } from "./keyBindings";

const KEY_CODES = 256;
const ALL_SLOTS = (1 << KEY_SLOT_COUNT) - 1;

/**
 * One participant's keys, from synchronized key events and that player's own
 * bindings. An action bound to two keys stays held until both are up.
 */
export interface PlayerKeys {
  /** Whether each Warcraft key code, 0 through 255, is down. */
  readonly down: boolean[];
  /** Bound key slots that are down, one bit per slotIndex. */
  heldSlots: number;
  /** The movement keys read as a stick. */
  readonly directions: DirectionalInput;
}

export function playerKeys(): PlayerKeys {
  return { down: Array.from({ length: KEY_CODES }, () => false), heldSlots: 0, directions: neutralDirections() };
}

const isKeyCode = (key: number) => key >= 0 && key < KEY_CODES;
const bothSlots = (action: Action) => 3 << slotIndex(action, 0);

export function keyDown({ down }: Readonly<PlayerKeys>, key: number): boolean {
  return isKeyCode(key) && down[key] === true;
}

export function actionHeld({ heldSlots }: Readonly<PlayerKeys>, action: Action): boolean {
  return (heldSlots & bothSlots(action)) !== 0;
}

/** The held actions as an input mask. */
export function heldActions({ heldSlots }: Readonly<PlayerKeys>): number {
  let mask = 0;
  for (const action of ACTION_ORDER) {
    if ((heldSlots & bothSlots(action)) !== 0) mask |= 1 << action;
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
  const slot = 1 << slotIndex(action, keyFor(bindings, action, 0) === key ? 0 : 1);
  keys.heldSlots = held ? keys.heldSlots | slot : keys.heldSlots & (ALL_SLOTS ^ slot);
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
  keys.heldSlots = 0;
  clearDirections(keys.directions);
}
