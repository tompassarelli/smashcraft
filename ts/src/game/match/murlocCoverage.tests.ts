import { assertEquals, assertGreaterThan } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { fighterCoverage } from "./botCoverage";

sweep("Murloc CPU uses all four specials in eight seeded Wren Expert matches; fewest of one seen 3 on four seed offsets [spec #262]", () => {
  const choices: Character[] = SELECTABLE_CHARACTERS.filter(character => character !== Character.murloc);
  choices.push(Character.murloc);
  const report = fighterCoverage(choices.length - 1, undefined, choices);
  assertEquals(report.matches, 8);
  assertEquals(report.missing.join(", "), "");
  assertGreaterThan(report.specials.neutral, 0);
  assertGreaterThan(report.specials.side, 0);
  assertGreaterThan(report.specials.up, 0);
  assertGreaterThan(report.specials.down, 0);
});
