import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { SpecialSlot } from "../sim/heroSpecials";
import { RAIN_OF_FIRE } from "../sim/heroes/pitLordSpecials";
import { HeroSpecialUse, heroSpecialUse } from "./botHeroKit";

test("Pit Lord casts Rain where a target will be when fire falls, in either facing", () => {
  for (const facing of [1, -1]) {
    const owner = createFighter(Character.pitLord, 0, facing);
    const target = createFighter(Character.archer, RAIN_OF_FIRE[0].offsetX * facing, -facing);
    assertEquals(heroSpecialUse(owner, target, 0, SpecialSlot.down), HeroSpecialUse.ranged);
    target.motion.deltaX = -4 * facing;
    assertEquals(heroSpecialUse(owner, target, 0, SpecialSlot.down), HeroSpecialUse.none);
  }
});
