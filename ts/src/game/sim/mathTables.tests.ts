import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { arctangentDegrees, cosineTurns, sineTurns } from "./mathTables";

const LIMBS = 5;
const SCALE = 1099511627776.0;

function fold(hash: number, value: number): number {
  let rest = Math.floor(value * SCALE);
  let folded = hash;
  for (let limb = 0; limb < LIMBS; limb++) {
    const high = Math.floor(rest * 0.000244140625);
    folded = floorMod(folded * 131 + (rest - high * 4096.0), 65521);
    rest = high;
  }
  return folded;
}

function sineDigest(): number {
  let hash = 1;
  for (let k = -2048; k < 16384; k++) hash = fold(hash, sineTurns(f32(k / 16384.0)));
  for (const turns of [f32(1.0e-9), f32(-1.0e-9), 123456.0, f32(-77777.7), 0.25, 0.5, 0.75, 1.0, -1.0]) hash = fold(hash, sineTurns(f32(turns)));
  return hash;
}

function cosineDigest(): number {
  let hash = 1;
  for (let k = 0; k < 8192; k++) hash = fold(hash, cosineTurns(f32(k / 8192.0)));
  return hash;
}

function arctangentDigest(): number {
  let hash = 1;
  for (let k = -1024; k < 8192; k++) hash = fold(hash, arctangentDegrees(f32(k / 2048.0)));
  let power = 1.0;
  for (let exponent = 0; exponent <= 40; exponent++) {
    hash = fold(hash, arctangentDegrees(power));
    hash = fold(hash, arctangentDegrees(f32(1.0 / power)));
    power = f32(power * 2.0);
  }
  hash = fold(hash, arctangentDegrees(Infinity));
  return hash;
}

test("sine, cosine and arctangent tables return the same bits in Bun and 32-bit Lua over every table segment, its 16 sub-steps, wraps and extremes [invariant]", () => {
  assertEquals(sineDigest(), 27902);
  assertEquals(cosineDigest(), 4804);
  assertEquals(arctangentDigest(), 20513);
});

test("table sine, cosine and arctangent are exact at the quarter turns and at 45 degrees [invariant]", () => {
  assertNear(sineTurns(0.25), 1.0, 0.0);
  assertNear(sineTurns(0.5), 0.0, 0.0);
  assertNear(sineTurns(0.75), -1.0, 0.0);
  assertNear(cosineTurns(0.0), 1.0, 0.0);
  assertNear(arctangentDegrees(1.0), 45.0, 0.0);
  assertNear(arctangentDegrees(0.0), 0.0, 0.0);
  assertNear(arctangentDegrees(-1.0), -45.0, 0.0);
});
