import { ACTION_COUNT, ACTION_ORDER, Action } from "./actions";
import { floorDiv } from "wisp/src/sim/intMath";

export type KeySlot = 0 | 1;

/** Two key slots per action. */
export const KEY_SLOT_COUNT = ACTION_COUNT * 2;

/**
 * Warcraft key codes for every action's two slots, at slotIndex(action, slot):
 * the order of the save format and of held-key tracking. 0 is an empty slot, as
 * in the save format, because a Lua array can't hold undefined. A key fills at
 * most one slot.
 */
export interface KeyBindings {
  keys: number[];
}

/** Standard keeps the number-row keys on 7 and 8; the owner's custom layout moves them to 8 and 9. */
export type BindingPreset = "standard" | "custom";

const EMPTY = 0;
const SPACE = 32;
const SEMICOLON = 186;
const SLASH = 191;
/** Letters and digits have their character codes. */
const code = (character: string) => character.charCodeAt(0);

// Menu and developer controls stay available whatever the bindings: Escape,
// Return (Warcraft's chat), Y (start/pause), F1, F5, F6, F7 and K (save a moment).
const RESERVED_KEYS: readonly number[] = [13, 27, 75, 89, 112, 116, 117, 118];

export function slotIndex(action: Action, slot: KeySlot): number {
  return action * 2 + slot;
}

export function presetBindings(preset: BindingPreset): KeyBindings {
  const custom = preset === "custom";
  const keys: number[] = [];
  const bind = (action: Action, first: number, second = EMPTY) => {
    keys[slotIndex(action, 0)] = first;
    keys[slotIndex(action, 1)] = second;
  };
  bind(Action.moveLeft, code("W"));
  bind(Action.moveRight, code("R"));
  bind(Action.moveDown, code("E"));
  bind(Action.moveUp, SPACE);
  bind(Action.jump, code("I"), code(custom ? "9" : "8"));
  bind(Action.attack, code("N"));
  bind(Action.special, code("U"));
  bind(Action.grab, code("O"));
  bind(Action.leftTrigger, code("Q"));
  bind(Action.rightTrigger, code(custom ? "8" : "7"));
  bind(Action.smashLeft, code("B"), SLASH);
  bind(Action.smashRight, code("M"));
  bind(Action.smashUp, code("J"));
  bind(Action.smashDown, code("H"));
  bind(Action.walk, code("P"));
  bind(Action.lightShield, code(custom ? "0" : "9"));
  return { keys };
}

export function keyFor({ keys }: Readonly<KeyBindings>, action: Action, slot: KeySlot): number | undefined {
  const key = keys[slotIndex(action, slot)];
  return key === EMPTY ? undefined : key;
}

export function actionFor({ keys }: Readonly<KeyBindings>, key: number): Action | undefined {
  const index = key === EMPTY ? -1 : keys.indexOf(key);
  return index < 0 ? undefined : ACTION_ORDER[floorDiv(index, 2)];
}

/** Fills or empties one slot; false for a reserved, out-of-range or already bound key. */
function bindSlot(keys: number[], index: number, key: number): boolean {
  if (key !== EMPTY) {
    if (key < 1 || key > 255 || RESERVED_KEYS.includes(key)) return false;
    if (keys.some((bound, other) => other !== index && bound === key)) return false;
  }
  keys[index] = key;
  return true;
}

/** Binds a key to a slot, or empties the slot for undefined. False leaves the bindings unchanged. */
export function rebind(bindings: KeyBindings, action: Action, slot: KeySlot, key: number | undefined): boolean {
  if (key === EMPTY) return false;
  return bindSlot(bindings.keys, slotIndex(action, slot), key ?? EMPTY);
}

// ---------------------------------------------------------------- saves

// A version, then each slot's key code as three decimal digits. K2/K3 saves
// predate light shield; K1 saves also predate the tilt slots.
const CURRENT_SAVE = "K4";
const SAVED_SLOTS: Readonly<Record<string, number>> = { K1: 28, K2: 30, K3: 30, [CURRENT_SAVE]: KEY_SLOT_COUNT };
const DIGITS = "0123456789";

export function encodeBindings({ keys }: Readonly<KeyBindings>): string {
  return CURRENT_SAVE + keys.map((key) => String(key).padStart(3, "0")).join("");
}

function readKey(saved: string, offset: number): number | undefined {
  let value = 0;
  for (let i = offset; i < offset + 3; i++) {
    const digit = DIGITS.indexOf(saved.charAt(i));
    if (digit < 0) return undefined;
    value = value * 10 + digit;
  }
  return value;
}

/** Upgrades an older save's defaults, never displacing a key the player has since bound elsewhere. */
function upgradeDefaults(bindings: KeyBindings, version: string): void {
  const { keys } = bindings;
  const free = (...candidates: number[]) => candidates.every((key) => !keys.includes(key));
  const first = (action: Action) => keyFor(bindings, action, 0);
  if (version === "K1" && free(code("P"))) rebind(bindings, Action.walk, 0, code("P"));
  // Grab moved from L to O, walk from ; to P.
  if (first(Action.grab) === code("L") && free(code("O"))) rebind(bindings, Action.grab, 0, code("O"));
  if (first(Action.walk) === SEMICOLON && free(code("P"))) rebind(bindings, Action.walk, 0, code("P"));
  // Movement moved from S F D with the left trigger on A to W R E with Q, unless any of it was customized.
  if (first(Action.moveLeft) === code("S") && first(Action.moveRight) === code("F") && first(Action.moveDown) === code("D")
    && first(Action.leftTrigger) === code("A") && free(code("Q"), code("W"), code("E"), code("R"))) {
    rebind(bindings, Action.moveLeft, 0, code("W"));
    rebind(bindings, Action.moveRight, 0, code("R"));
    rebind(bindings, Action.moveDown, 0, code("E"));
    rebind(bindings, Action.leftTrigger, 0, code("Q"));
  }
}

/** Reads saved bindings, upgrading older saves; undefined for anything malformed. */
export function decodeBindings(saved: string): KeyBindings | undefined {
  const version = saved.slice(0, 2);
  const slots = SAVED_SLOTS[version];
  if (slots === undefined || saved.length !== 2 + 3 * slots) return undefined;
  const keys: number[] = [];
  for (let index = 0; index < KEY_SLOT_COUNT; index++) keys[index] = EMPTY;
  for (let index = 0; index < slots; index++) {
    const key = readKey(saved, 2 + index * 3);
    if (key === undefined) return undefined;
    // Y became the fixed start/pause key; an older save loses only that binding.
    if (key !== code("Y") && !bindSlot(keys, index, key)) return undefined;
  }
  const bindings = { keys };
  if (version !== CURRENT_SAVE) upgradeDefaults(bindings, version);
  return bindings;
}

// ---------------------------------------------------------------- labels

export const ACTION_LABELS: Readonly<Record<Action, string>> = {
  [Action.moveLeft]: "Move left",
  [Action.moveRight]: "Move right",
  [Action.moveDown]: "Move down",
  [Action.moveUp]: "Move up",
  [Action.jump]: "Jump",
  [Action.attack]: "Attack",
  [Action.special]: "Special",
  [Action.grab]: "Grab",
  [Action.leftTrigger]: "Left trigger",
  [Action.rightTrigger]: "Right trigger",
  [Action.smashLeft]: "C-stick left",
  [Action.smashRight]: "C-stick right",
  [Action.smashUp]: "C-stick up",
  [Action.smashDown]: "C-stick down",
  [Action.walk]: "Tilt",
  [Action.lightShield]: "Light shield",
};

export function keyLabel(key: number | undefined): string {
  if (key === undefined) return "—";
  if (key === SPACE) return "SPACE";
  if (key === SLASH) return "/";
  if (key === SEMICOLON) return ";";
  if ((key >= code("A") && key <= code("Z")) || (key >= code("0") && key <= code("9"))) return String.fromCharCode(key);
  return `KEY ${key}`;
}
