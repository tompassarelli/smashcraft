import { expect, test } from "bun:test";
import { suiteProblems } from "wisp/scripts/wisp/accept";
import { SMASHCRAFT_ACCEPT } from "../scripts/wisp/acceptChecks";

test("Smashcraft's declared native checks name known maps, clients and readings [spec wisp:docs/accept.md]", () => {
  expect(suiteProblems(SMASHCRAFT_ACCEPT, ["a", "b"])).toEqual([]);
});
