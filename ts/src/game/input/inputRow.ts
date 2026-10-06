import { at } from "wisp/src/runtime/lookup";
import { ALL_ACTIONS, Action, has } from "./actions";

export type Direction = -1 | 0 | 1;

/**
 * One participant's controls for one frame. Both edges may be set for a tap
 * completed inside one capture interval, independently of the final held mask.
 */
export interface InputRow {
  held: number;
  pressed: number;
  released: number;
  /** Stick axes in [-127, 127]. */
  axisX: number;
  axisZ: number;
  /** Trigger pressure in [0, 255]. */
  triggerLeft: number;
  triggerRight: number;
  /** Press-time vectors; they survive later releases within the row. */
  specialX: Direction;
  specialZ: Direction;
  dodgeX: Direction;
  dodgeZ: Direction;
  /** A smash-DI pulse always carries a nonzero vector. */
  sdi: boolean;
  sdiX: Direction;
  sdiZ: Direction;
  ledgeVertical: Direction;
  /** Accumulated throw-direction taps in [-127, 127]. */
  throwX: number;
  throwZ: number;
}

export const THROW_CONTRIBUTION_LIMIT = 127;

const FIELDS = [
  "held", "pressed", "released", "axisX", "axisZ", "triggerLeft", "triggerRight",
  "specialX", "specialZ", "dodgeX", "dodgeZ", "sdi", "sdiX", "sdiZ", "ledgeVertical", "throwX", "throwZ",
] as const satisfies readonly (keyof InputRow)[];

export function emptyInput(): InputRow {
  return {
    held: 0, pressed: 0, released: 0, axisX: 0, axisZ: 0, triggerLeft: 0, triggerRight: 0,
    specialX: 0, specialZ: 0, dodgeX: 0, dodgeZ: 0, sdi: false, sdiX: 0, sdiZ: 0, ledgeVertical: 0,
    throwX: 0, throwZ: 0,
  };
}

/** Row fields as a decoder or controller supplies them: directions are plain numbers until validated. */
export type RowFields = { [K in keyof InputRow]?: InputRow[K] extends Direction ? number : InputRow[K] };

const inRange = (value: number, low: number, high: number) => value >= low && value <= high;
const isMask = (value: number) => inRange(value, 0, ALL_ACTIONS);
const isDirection = (value: number) => value === -1 || value === 0 || value === 1;
const sign = (positive: boolean, negative: boolean) => (positive ? 1 : 0) - (negative ? 1 : 0);

/** Throw taps implied by this row's presses, used when the caller supplies none. */
function pressedThrows(pressed: number): Pick<InputRow, "throwX" | "throwZ"> {
  return {
    throwX: sign(has(pressed, Action.moveRight), has(pressed, Action.moveLeft))
      + sign(has(pressed, Action.smashRight), has(pressed, Action.smashLeft)),
    throwZ: sign(has(pressed, Action.moveUp), has(pressed, Action.moveDown))
      + sign(has(pressed, Action.smashUp), has(pressed, Action.smashDown)),
  };
}

/** Everything a controller can send: values in range, press vectors only with the press that sets them. */
function isInputRow(row: Required<RowFields>): row is InputRow {
  return isMask(row.held) && isMask(row.pressed) && isMask(row.released)
    && inRange(row.axisX, -127, 127) && inRange(row.axisZ, -127, 127)
    && inRange(row.triggerLeft, 0, 255) && inRange(row.triggerRight, 0, 255)
    && isDirection(row.specialX) && isDirection(row.specialZ) && isDirection(row.dodgeX) && isDirection(row.dodgeZ)
    && isDirection(row.sdiX) && isDirection(row.sdiZ) && isDirection(row.ledgeVertical)
    && inRange(row.throwX, -THROW_CONTRIBUTION_LIMIT, THROW_CONTRIBUTION_LIMIT)
    && inRange(row.throwZ, -THROW_CONTRIBUTION_LIMIT, THROW_CONTRIBUTION_LIMIT)
    && (has(row.pressed, Action.special) || (row.specialX === 0 && row.specialZ === 0))
    && (has(row.pressed, Action.leftTrigger) || has(row.pressed, Action.rightTrigger) || (row.dodgeX === 0 && row.dodgeZ === 0))
    && row.sdi === (row.sdiX !== 0 || row.sdiZ !== 0)
    && (row.ledgeVertical === 0 || has(row.pressed, Action.moveUp) || has(row.pressed, Action.moveDown));
}

/**
 * Builds a validated row; omitted fields are neutral and omitted throw taps
 * follow the presses. Returns undefined for anything a controller can't send.
 */
export function inputRow(fields: RowFields = {}): InputRow | undefined {
  const row: Required<RowFields> = { ...emptyInput(), ...pressedThrows(fields.pressed ?? 0), ...fields };
  return isInputRow(row) ? row : undefined;
}

/** Field by field: rollback copies rows every frame, and Lua's Object.assign allocates. */
export function copyInput(target: InputRow, source: Readonly<InputRow>): void {
  target.held = source.held;
  target.pressed = source.pressed;
  target.released = source.released;
  target.axisX = source.axisX;
  target.axisZ = source.axisZ;
  target.triggerLeft = source.triggerLeft;
  target.triggerRight = source.triggerRight;
  target.specialX = source.specialX;
  target.specialZ = source.specialZ;
  target.dodgeX = source.dodgeX;
  target.dodgeZ = source.dodgeZ;
  target.sdi = source.sdi;
  target.sdiX = source.sdiX;
  target.sdiZ = source.sdiZ;
  target.ledgeVertical = source.ledgeVertical;
  target.throwX = source.throwX;
  target.throwZ = source.throwZ;
}

/** Numbers per row in storeInputNumbers' layout. */
export const INPUT_ROW_NUMBERS = FIELDS.length;

/** Stores a row as INPUT_ROW_NUMBERS numbers in FIELDS order from `base`, sdi as 0 or 1: a ring of rows without a table per row. */
export function storeInputNumbers(target: number[], base: number, row: Readonly<InputRow>): void {
  target[base] = row.held;
  target[base + 1] = row.pressed;
  target[base + 2] = row.released;
  target[base + 3] = row.axisX;
  target[base + 4] = row.axisZ;
  target[base + 5] = row.triggerLeft;
  target[base + 6] = row.triggerRight;
  target[base + 7] = row.specialX;
  target[base + 8] = row.specialZ;
  target[base + 9] = row.dodgeX;
  target[base + 10] = row.dodgeZ;
  target[base + 11] = row.sdi ? 1 : 0;
  target[base + 12] = row.sdiX;
  target[base + 13] = row.sdiZ;
  target[base + 14] = row.ledgeVertical;
  target[base + 15] = row.throwX;
  target[base + 16] = row.throwZ;
}

/** The row storeInputNumbers stored from `base`; undefined for numbers no controller sends. */
export function loadInputNumbers(source: readonly number[], base: number): InputRow | undefined {
  const sdi = at(source, base + 11);
  if (sdi !== 0 && sdi !== 1) return undefined;
  return inputRow({
    held: at(source, base), pressed: at(source, base + 1), released: at(source, base + 2),
    axisX: at(source, base + 3), axisZ: at(source, base + 4), triggerLeft: at(source, base + 5), triggerRight: at(source, base + 6),
    specialX: at(source, base + 7), specialZ: at(source, base + 8), dodgeX: at(source, base + 9), dodgeZ: at(source, base + 10),
    sdi: sdi === 1, sdiX: at(source, base + 12), sdiZ: at(source, base + 13), ledgeVertical: at(source, base + 14),
    throwX: at(source, base + 15), throwZ: at(source, base + 16),
  });
}

export function sameInput(a: Readonly<InputRow>, b: Readonly<InputRow>): boolean {
  for (const field of FIELDS) if (a[field] !== b[field]) return false;
  return true;
}

/**
 * Conservative prediction of a late remote row: holds, stick and triggers
 * continue; edges, press vectors and throw taps are never repeated. Target may
 * be the source. No allocation: rollback replays predict every frame.
 */
export function predictInto(target: InputRow, source: Readonly<InputRow>): void {
  target.held = source.held;
  target.axisX = source.axisX;
  target.axisZ = source.axisZ;
  target.triggerLeft = source.triggerLeft;
  target.triggerRight = source.triggerRight;
  target.pressed = 0;
  target.released = 0;
  target.specialX = 0;
  target.specialZ = 0;
  target.dodgeX = 0;
  target.dodgeZ = 0;
  target.sdi = false;
  target.sdiX = 0;
  target.sdiZ = 0;
  target.ledgeVertical = 0;
  target.throwX = 0;
  target.throwZ = 0;
}
