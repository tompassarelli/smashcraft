import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type AdvantageRow } from "../scripts/advantageState";

const rows = (): AdvantageRow[] => readFileSync(join(import.meta.dir, "../../tools/move-data/advantage-state.jsonl"), "utf8").split("\n").filter((line) => line !== "").map((line) => JSON.parse(line));

test("all 78 fighter and target rows meet every advantage-state target [spec #388]", () => {
  const all = rows();
  expect(all).toHaveLength(78);
  expect(all.filter((row) => Object.values(row.targets).some((met) => !met)).map((row) => `${row.fighter} ${row.target}`)).toEqual([]);
});

test("no throw is a true zero-to-death: none takes a stock below 60%, strings stay within two follow-ups and 30% against the escape-optimal DI, and every fighter's tech chase ends in a read [spec #388]", () => {
  const all = rows();
  expect(all.flatMap((row) => row.zeroToDeath.map((problem) => `${row.fighter} ${row.target}: ${problem}`))).toEqual([]);
  const cells = all.flatMap((row) => row.throws.map((cell) => ({ row, cell })));
  expect(cells.filter(({ cell }) => cell.ko && cell.percent < 60).map(({ row, cell }) => `${row.fighter} ${row.target} ${cell.opener} at ${cell.percent}%`)).toEqual([]);
  expect(Math.max(...cells.map(({ cell }) => cell.withDi))).toBeLessThanOrEqual(2);
  expect(Math.max(...cells.filter(({ cell }) => !cell.ko).map(({ cell }) => cell.withDiDamage))).toBeLessThanOrEqual(30);
  expect(all.filter((row) => row.techChase === undefined || row.techChase.covered.some(({ read }) => read === undefined)).map((row) => `${row.fighter} ${row.target}`)).toEqual([]);
});
