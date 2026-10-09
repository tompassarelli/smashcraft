import { writeFileSync } from "node:fs";
import { join } from "node:path";

const STEPS = 256;
const table = (value: (index: number) => number): string => {
  const rows: string[] = [];
  for (let index = 0; index <= STEPS; index++) rows.push(`  ${Math.fround(value(index))},`);
  return rows.join("\n");
};

const text = [
  `export const TABLE_STEPS = ${STEPS};`,
  "",
  "export const SINE_QUARTER_TURN: readonly number[] = [",
  table((index) => Math.sin(index / STEPS * Math.PI / 2)),
  "];",
  "",
  "export const ARCTANGENT_DEGREES: readonly number[] = [",
  table((index) => Math.atan(index / STEPS) * 180 / Math.PI),
  "];",
  "",
].join("\n");

writeFileSync(join(import.meta.dir, "../src/game/sim/mathTableData.ts"), text);
