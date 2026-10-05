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

const NEUTRAL: Readonly<InputRow> = emptyInput();

export function copyInput(target: InputRow, source: Readonly<InputRow>): void {
  Object.assign(target, source);
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
  const { held, axisX, axisZ, triggerLeft, triggerRight } = source;
  Object.assign(target, NEUTRAL);
  target.held = held;
  target.axisX = axisX;
  target.axisZ = axisZ;
  target.triggerLeft = triggerLeft;
  target.triggerRight = triggerRight;
}
