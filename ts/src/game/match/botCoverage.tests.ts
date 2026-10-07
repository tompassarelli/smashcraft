import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { fighterCoverage } from "./botCoverage";

for (let index = 0; index < SELECTABLE_CHARACTERS.length; index++) {
  const character = SELECTABLE_CHARACTERS[index];
  test(`roster AI coverage: ${fighterName(character ?? -1)} moves, attacks and uses its kit in eight Wren Expert matches`, () => {
    const report = fighterCoverage(index);
    assertEquals(report.matches, 8);
    assertEquals(report.missing.join(", "), "", report.fighter);
    assertGreaterThan(report.movement, 0);
    assertGreaterThan(report.attacks, 0);
    assertGreaterThan(report.kit, 0);
  });
}
