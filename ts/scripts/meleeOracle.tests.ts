import { expect, test } from "bun:test";
import { join } from "node:path";
import { oracleProblems, runOracle } from "./meleeOracle";

const rows = runOracle();

test("the Melee oracle's mismatches with the decompilation are exactly the known ones [reference]", () => {
  expect(oracleProblems(rows)).toEqual([]);
});

test("every oracle departure names a row of gameplay-design.md's deviations table [spec docs/gameplay-design.md]", async () => {
  const design = await Bun.file(join(import.meta.dir, "../../docs/gameplay-design.md")).text();
  const section = design.split("## Deviations from Melee")[1]?.split("\n## ")[0] ?? "";
  const mechanics = new Set(section.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Mechanic"))
    .map((line) => line.split("|")[1]?.trim()));
  const named = new Set(rows.filter((row) => row.outcome === "departure").map((row) => row.cite.split("; departure: ")[1]?.split(":")[0]));
  expect(named.size).toBeGreaterThan(0);
  expect([...named].filter((mechanic) => !mechanics.has(mechanic))).toEqual([]);
});
