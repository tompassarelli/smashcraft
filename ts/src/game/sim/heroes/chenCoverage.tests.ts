import { assertGreaterThan, assertEquals } from "wisp/src/runtime/testing";
import { sweep } from "../../../runtime/sweep";
import { fighterCoverage } from "../../match/botCoverage";
import { Character } from "../codes";
import { SELECTABLE_CHARACTERS } from "./registry";

sweep("Chen's computer uses fire, haze, Storm recovery and Earth at least three times each over 24 seeded matches; fewest seen 7 on four seed offsets [spec docs/design/chen.md] [property #394]", () => {
  const choices: Character[] = SELECTABLE_CHARACTERS.filter(character => character !== Character.chen);
  choices.push(Character.chen);
  const coverage = fighterCoverage(choices.length - 1, undefined, choices, 24);
  assertEquals(coverage.matches, 24);
  assertEquals(coverage.missing.length, 0);
  assertGreaterThan(coverage.specials.neutral, 2);
  assertGreaterThan(coverage.specials.side, 2);
  assertGreaterThan(coverage.specials.up, 2);
  assertGreaterThan(coverage.specials.down, 2);
});
