import { expect, test } from "bun:test";
import { oracleProblems, runOracle } from "./meleeOracle";

const rows = runOracle();

test("the Melee oracle's mismatches with the decompilation are exactly the known ones [reference]", () => {
  expect(oracleProblems(rows)).toEqual([]);
});
