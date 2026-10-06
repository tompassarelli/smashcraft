import { expect, test } from "bun:test";
import { oracleProblems, runOracle } from "./meleeOracle";

test("the Melee oracle's mismatches with the decompilation are exactly the known ones", () => {
  expect(oracleProblems(runOracle())).toEqual([]);
});
