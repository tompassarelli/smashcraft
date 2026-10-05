// One corpus evaluated identically on the host (binary64) and in Warcraft's Lua
// (32-bit integers, binary32 numbers). Inputs are exact binary32 values built
// from integer steps below 2^31; no bitwise operators.
import { addFloat32, divideFloat32, fusedMultiplyAddFloat32, multiplyFloat32, subtractFloat32 } from "../sim/binary32";
import { meleeAtan2, meleeCos, meleeSin } from "../sim/meleeScalarMath";

function powerOfTwo(exponent: number): number {
  let result = 1.0;
  for (let i = 1; i <= Math.abs(exponent); i++) result *= exponent < 0 ? 0.5 : 2.0;
  return result;
}

/** Linear congruential step modulo 2^24; every product stays below 2^31. */
function step(state: number): number {
  return (state * 101 + 7919) % 16777216;
}

/** An exact binary32 value with exponent in [-30, 29] and a random sign. */
function operand(seed: number): number {
  const first = step(seed % 16777216);
  const second = step(first);
  const third = step(second);
  const significand = 8388608 + (first % 8388608);
  const exponent = (second % 60) - 30;
  const sign = third % 2 === 0 ? -1.0 : 1.0;
  return sign * significand * powerOfTwo(exponent - 23);
}

/** An exact binary32 angle with magnitude below 4. */
function angleFor(seed: number): number {
  const first = step(seed % 16777216);
  const second = step(first);
  const significand = 8388608 + (first % 8388608);
  const sign = second % 2 === 0 ? -1.0 : 1.0;
  return sign * significand * powerOfTwo((second % 8) - 29);
}

/** Eight results per case: +, -, *, /, fma, atan2, cos, sin. */
export function evaluateCase(index: number): number[] {
  const a = operand(index * 4 + 1);
  const b = operand(index * 4 + 2);
  const c = operand(index * 4 + 3);
  const angle = angleFor(index * 4 + 4);
  return [
    addFloat32(a, b),
    subtractFloat32(a, b),
    multiplyFloat32(a, b),
    divideFloat32(a, b),
    fusedMultiplyAddFloat32(a, b, c),
    meleeAtan2(a, b),
    meleeCos(angle),
    meleeSin(angle),
  ];
}
