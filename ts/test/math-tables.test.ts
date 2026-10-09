import { expect, test } from "bun:test";
import { join } from "node:path";
import { ARCTANGENT_DEGREES, SINE_QUARTER_TURN, TABLE_STEPS } from "../src/game/sim/mathTableData";
import { arctangentDegrees, cosineTurns, sineTurns } from "../src/game/sim/mathTables";

test("the checked-in tables are the binary32 roundings of Math.sin and Math.atan at every node [reference]", () => {
  expect(SINE_QUARTER_TURN.length).toBe(TABLE_STEPS + 1);
  expect(ARCTANGENT_DEGREES.length).toBe(TABLE_STEPS + 1);
  for (let index = 0; index <= TABLE_STEPS; index++) {
    expect(SINE_QUARTER_TURN[index]).toBe(Math.fround(Math.sin(index / TABLE_STEPS * Math.PI / 2)));
    expect(ARCTANGENT_DEGREES[index]).toBe(Math.fround(Math.atan(index / TABLE_STEPS) * 180 / Math.PI));
  }
});

test("table sine, cosine and arctangent stay within 5e-6 and 1e-4 degrees of Math over the full domain's grid [reference]", () => {
  let sine = 0;
  let cosine = 0;
  let arctangent = 0;
  for (let k = -16384; k < 32768; k++) {
    const turns = Math.fround(k / 16384);
    sine = Math.max(sine, Math.abs(sineTurns(turns) - Math.sin(turns * 2 * Math.PI)));
    cosine = Math.max(cosine, Math.abs(cosineTurns(turns) - Math.cos(turns * 2 * Math.PI)));
  }
  for (let k = -8192; k < 65536; k++) {
    const value = Math.fround(k / 1024);
    arctangent = Math.max(arctangent, Math.abs(arctangentDegrees(value) - Math.atan(value) * 180 / Math.PI));
  }
  expect(sine).toBeLessThan(5e-6);
  expect(cosine).toBeLessThan(5e-6);
  expect(arctangent).toBeLessThan(1e-4);
});

test("the table generator reproduces the checked-in data [reference]", async () => {
  const before = await Bun.file(join(import.meta.dir, "../src/game/sim/mathTableData.ts")).text();
  const run = Bun.spawnSync([process.execPath, join(import.meta.dir, "../scripts/mathTables.ts")]);
  expect(run.exitCode).toBe(0);
  expect(await Bun.file(join(import.meta.dir, "../src/game/sim/mathTableData.ts")).text()).toBe(before);
});
