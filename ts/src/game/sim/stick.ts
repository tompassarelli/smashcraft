


import { f32 } from "wisp/src/sim/f32";
import { DIAGONAL_UNIT } from "./knockback";
import type { Controls } from "./roster";

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1);

/** Tilt while shielding stays below tap jump 0.6625 and rolls/spot dodge 0.7 (companion/README.md, common +0x314/+0x31C). */
export const SHIELD_TILT_STICK_CAP = 0.6499999761581421;

function shieldStick(value: number, input: Readonly<Controls>): number {
  return input.walking && input.shield ? Math.max(-SHIELD_TILT_STICK_CAP, Math.min(SHIELD_TILT_STICK_CAP, value)) : value;
}

function analogStick(input: Readonly<Controls>): boolean {
  return input.diStickValid && (input.diStickX !== 0 || input.diStickZ !== 0);
}

function digitalScale(input: Readonly<Controls>): number {
  return input.direction !== 0 && input.verticalDirection !== 0 ? DIAGONAL_UNIT : 1.0;
}

export function stickX(input: Readonly<Controls>): number {
  return shieldStick(analogStick(input) ? input.diStickX : f32(sign(input.direction) * digitalScale(input)), input);
}

export function stickZ(input: Readonly<Controls>): number {
  return shieldStick(analogStick(input) ? input.diStickZ : f32(sign(input.verticalDirection) * digitalScale(input)), input);
}
