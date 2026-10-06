// The left stick as Melee's fighter code reads it for down states, techs and
// tumble: a frame's analog row, or its digital directions for controls
// without one and for a direction tapped and released within its row.
import { f32 } from "wisp/src/sim/f32";
import { DIAGONAL_UNIT } from "./knockback";
import type { Controls } from "./roster";

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1);

function analogStick(input: Readonly<Controls>): boolean {
  return input.diStickValid && (input.diStickX !== 0 || input.diStickZ !== 0);
}

function digitalScale(input: Readonly<Controls>): number {
  return input.direction !== 0 && input.verticalDirection !== 0 ? DIAGONAL_UNIT : 1.0;
}

export function stickX(input: Readonly<Controls>): number {
  return analogStick(input) ? input.diStickX : f32(sign(input.direction) * digitalScale(input));
}

export function stickZ(input: Readonly<Controls>): number {
  return analogStick(input) ? input.diStickZ : f32(sign(input.verticalDirection) * digitalScale(input));
}
