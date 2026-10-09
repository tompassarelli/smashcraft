import { type Action, has } from "./actions";
import type { Direction } from "./inputRow";


export function directionOf(mask: number, positive: Action, negative: Action): Direction {
  const toward = has(mask, positive);
  if (toward === has(mask, negative)) return 0;
  return toward ? 1 : -1;
}







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

function copyDirections(target: DirectionalInput, source: Readonly<DirectionalInput>): void {
  Object.assign(target, source);
}
