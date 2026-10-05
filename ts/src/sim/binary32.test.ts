import { describe, expect, test } from "bun:test";
import {
  addFloat32,
  divideFloat32,
  fusedMultiplyAddFloat32,
  multiplyFloat32,
  roundToFloat32,
  subtractFloat32,
} from "./binary32";

const pow2 = (exponent: number) => 2 ** exponent;
const halfUlp = pow2(-24);
const next = 1 + pow2(-23);
const previous = 1 - pow2(-23);
const quantum = pow2(-149);
const maximum = 16777215 * pow2(104);

// Same value, including the sign of zero; NaN matches NaN.
const same = (actual: number, expected: number) => expect(Object.is(actual, expected) || (actual !== actual && expected !== expected)).toBe(true);

describe("roundToFloat32", () => {
  test("ties go to the even significand, carrying into the next exponent", () => {
    same(roundToFloat32(1 + halfUlp), 1);
    same(roundToFloat32(1 + 3 * halfUlp), 1 + 4 * halfUlp);
    same(roundToFloat32(-1 - 3 * halfUlp), -1 - 4 * halfUlp);
    same(roundToFloat32(2 - pow2(-24)), 2);
    same(roundToFloat32(16777216 + 3), 16777220);
  });

  test("subnormals, underflow, overflow and non-finite values", () => {
    same(roundToFloat32(quantum * 1.5), quantum * 2);
    same(roundToFloat32(quantum * 0.5), 0);
    same(roundToFloat32(pow2(-126) - quantum * 0.5), pow2(-126));
    same(roundToFloat32(maximum), maximum);
    same(roundToFloat32(16777215.5 * pow2(104)), Infinity);
    same(roundToFloat32(-16777215.5 * pow2(104)), -Infinity);
    same(roundToFloat32(NaN), NaN);
  });
});

describe("fusedMultiplyAddFloat32 rounds the exact a * b + c once", () => {
  test("keeps cancellation bits a rounded product would lose", () => {
    same(fusedMultiplyAddFloat32(next, previous, -1), -pow2(-46));
    same(fusedMultiplyAddFloat32(next, next, -(1 + pow2(-22))), pow2(-46));
    same(fusedMultiplyAddFloat32(next, next, halfUlp), 1 + 3 * pow2(-23));
    same(fusedMultiplyAddFloat32(1, halfUlp, next), 1 + pow2(-22));
    same(fusedMultiplyAddFloat32(-1, pow2(-100), 1), 1);
  });

  test("the exact product may leave binary32 range before cancellation", () => {
    same(fusedMultiplyAddFloat32(maximum, 2, -maximum), maximum);
    same(fusedMultiplyAddFloat32(quantum, 0.5, quantum), quantum * 2);
    same(fusedMultiplyAddFloat32(quantum, quantum, 0), 0);
    same(fusedMultiplyAddFloat32(maximum, 2, maximum), Infinity);
  });
});

describe("division", () => {
  test("zero divisor is NaN and overflow is infinite", () => {
    same(divideFloat32(1, 0), NaN);
    same(divideFloat32(maximum, 0.5), Infinity);
    same(divideFloat32(3 * quantum, 2), 2 * quantum);
    same(divideFloat32(quantum, 2), 0);
  });
});

// Independent oracle: for binary32 operands, binary64 +, -, * and / followed by
// one rounding to binary32 is correctly rounded (53 >= 2 * 24 + 2).
describe("operations match the binary64 oracle on random binary32 operands", () => {
  let state = 0x2545f491;
  const random = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 4294967296;
  };
  const operand = () => {
    const sign = random() < 0.5 ? -1 : 1;
    return Math.fround(sign * (1 + random()) * 2 ** Math.floor(random() * 80 - 40));
  };
  test("5,000 operand pairs", () => {
    for (let i = 0; i < 5000; i++) {
      const a = operand();
      const b = operand();
      same(addFloat32(a, b), Math.fround(a + b));
      same(subtractFloat32(a, b), Math.fround(a - b));
      same(multiplyFloat32(a, b), Math.fround(a * b));
      same(divideFloat32(a, b), Math.fround(a / b));
      same(roundToFloat32(a * b * 1.000000001), Math.fround(a * b * 1.000000001));
    }
  });
});
