import { assertGreaterThan, assertEquals, test } from "wisp/src/runtime/testing";
import { fighterCoverage } from "../../match/botCoverage";
import { Character } from "../codes";
import { SELECTABLE_CHARACTERS } from "./registry";

test("Chen's computer uses fire, haze, Storm recovery and Earth branches over eight seeded matches", () => {
  const choices: Character[] = SELECTABLE_CHARACTERS.filter(character => character !== Character.chen);
  choices.push(Character.chen);
  const coverage = fighterCoverage(choices.length - 1, undefined, choices);
  assertEquals(coverage.matches, 8);
  assertEquals(coverage.missing.length, 0);
  assertGreaterThan(coverage.specials.neutral, 0);
  assertGreaterThan(coverage.specials.side, 0);
  assertGreaterThan(coverage.specials.up, 0);
  assertGreaterThan(coverage.specials.down, 0);
});
