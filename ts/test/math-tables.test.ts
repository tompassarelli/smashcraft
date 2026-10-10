import { expect, test } from "bun:test";
import { ARCTANGENT_DEGREES, SINE_QUARTER_TURN, TABLE_STEPS } from "../src/game/sim/mathTableData";

test("the checked-in tables are the binary32 roundings of Math.sin and Math.atan at every node [k4 reference math]", () => {
  expect(SINE_QUARTER_TURN.length).toBe(TABLE_STEPS + 1);
  expect(ARCTANGENT_DEGREES.length).toBe(TABLE_STEPS + 1);
  for (let index = 0; index <= TABLE_STEPS; index++) {
    expect(SINE_QUARTER_TURN[index]).toBe(Math.fround(Math.sin(index / TABLE_STEPS * Math.PI / 2)));
    expect(ARCTANGENT_DEGREES[index]).toBe(Math.fround(Math.atan(index / TABLE_STEPS) * 180 / Math.PI));
  }
});
