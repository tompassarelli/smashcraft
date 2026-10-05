import { type Action, has } from "./actions";
import type { Direction } from "./inputRow";

/** 1 for only `positive` in the mask, -1 for only `negative`: opposite keys cancel. */
export function directionOf(mask: number, positive: Action, negative: Action): Direction {
  const toward = has(mask, positive);
  if (toward === has(mask, negative)) return 0;
  return toward ? 1 : -1;
}

/**
 * Keyboard directions read as a stick. Entering a new nonzero direction on
 * either axis latches a pulse of the whole new direction, which survives a
 * release before the next frame. A pulse is pending exactly when its vector
 * is nonzero, as in the input row's smash-DI vector.
 */
export interface DirectionalInput {
  heldX: Direction;
  heldZ: Direction;
  pulseX: Direction;
  pulseZ: Direction;
}

export function neutralDirections(): DirectionalInput {
  return { heldX: 0, heldZ: 0, pulseX: 0, pulseZ: 0 };
}

const NEUTRAL: Readonly<DirectionalInput> = neutralDirections();

const toDirection = (value: number): Direction => (value > 0 ? 1 : value < 0 ? -1 : 0);

/** Samples the held direction; components keep only their sign. */
export function updateDirections(input: DirectionalInput, x: number, z: number): void {
  const nextX = toDirection(x);
  const nextZ = toDirection(z);
  if ((nextX !== 0 && nextX !== input.heldX) || (nextZ !== 0 && nextZ !== input.heldZ)) {
    input.pulseX = nextX;
    input.pulseZ = nextZ;
  }
  input.heldX = nextX;
  input.heldZ = nextZ;
}

export function pulsePending(input: Readonly<DirectionalInput>): boolean {
  return input.pulseX !== 0 || input.pulseZ !== 0;
}

export function clearPulse(input: DirectionalInput): void {
  input.pulseX = 0;
  input.pulseZ = 0;
}

export function clearDirections(input: DirectionalInput): void {
  copyDirections(input, NEUTRAL);
}

export function copyDirections(target: DirectionalInput, source: Readonly<DirectionalInput>): void {
  Object.assign(target, source);
}
