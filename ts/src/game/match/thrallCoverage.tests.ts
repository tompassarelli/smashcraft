import { assertEquals, assertGreaterThan } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { fighterCoverage } from "./botCoverage";

sweep("Thrall computer uses all four specials in eight seeded matches [spec #56]", () => {
  const choices: Character[] = SELECTABLE_CHARACTERS.filter(character => character !== Character.thrall);
  choices.push(Character.thrall);
  const report = fighterCoverage(choices.length - 1, undefined, choices);
  assertEquals(report.matches, 8);
  assertEquals(report.missing.join(", "), "");
  assertGreaterThan(report.specials.neutral, 0);
  assertGreaterThan(report.specials.side, 0);
  assertGreaterThan(report.specials.up, 0);
  assertGreaterThan(report.specials.down, 0);
});
