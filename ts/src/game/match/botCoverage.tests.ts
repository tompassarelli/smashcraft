import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { fighterCoverage } from "./botCoverage";
import { Character } from "../sim/codes";
import { sweep } from "../../runtime/sweep";


for (let index = 0; index < SELECTABLE_CHARACTERS.length; index++) {
  test(`roster AI: ${fighterName(SELECTABLE_CHARACTERS[index] ?? -1)} moves and attacks in one seeded Wren Expert match [spec #56]`, () => {
    const report = fighterCoverage(index, undefined, SELECTABLE_CHARACTERS, 1);
    assertEquals(report.matches, 1);
    assertGreaterThan(report.movement, 0);
    assertGreaterThan(report.attacks, 0);
  });
}

for (let index = 0; index < SELECTABLE_CHARACTERS.length; index++) {
  const character = SELECTABLE_CHARACTERS[index];
  if (character !== Character.pitLord && character !== Character.beastmaster && character !== Character.lichKing) continue;
  sweep(`CPU drop roster coverage: ${fighterName(character)} moves, attacks and uses specials against Rifleman for 1800 frames; Pit Lord's fewest of one special seen 4 on four seed offsets [spec #209]`, () => {
    const report = fighterCoverage(index, Character.rifleman);
    assertEquals(report.matches, 8);
    assertEquals(report.missing.join(", "), "", report.fighter);
    assertGreaterThan(report.movement, 0);
    assertGreaterThan(report.attacks, 0);
    assertGreaterThan(report.kit, 0);
    if (character === Character.pitLord) for (const count of Object.values(report.specials)) assertGreaterThan(count, 0);
  });
}

for (let index = 0; index < SELECTABLE_CHARACTERS.length; index++) {
  const character = SELECTABLE_CHARACTERS[index];
  sweep(`roster AI coverage: ${fighterName(character ?? -1)} moves, attacks and uses its kit in eight Wren Expert matches; fewest attacks seen 50 on four seed offsets [spec #56]`, () => {
    const report = fighterCoverage(index);
    assertEquals(report.matches, 8);
    assertEquals(report.missing.join(", "), "", report.fighter);
    assertGreaterThan(report.movement, 0);
    assertGreaterThan(report.attacks, 0);
    assertGreaterThan(report.kit, 0);
    if (character === Character.warden) assertGreaterThan(report.specials.down, 0);
    if (character === Character.forsakenPaladin || character === Character.tinker) {
      assertGreaterThan(report.specials.neutral, 0);
      assertGreaterThan(report.specials.side, 0);
      assertGreaterThan(report.specials.up, 0);
      assertGreaterThan(report.specials.down, 0);
    }
  });
}
