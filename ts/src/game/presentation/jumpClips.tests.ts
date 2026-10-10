import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import type { HeroPose } from "../sim/heroes/hero";
import { characterClips, specialClip } from "./fighterClips";

const ATTACK_POSES: readonly HeroPose[] = [
  "jab", "jab2", "jab3", "forwardTilt", "forwardTiltUp", "forwardTiltDown", "upTilt", "downTilt",
  "forwardSmash", "upSmash", "downSmash", "dashAttack", "neutralAir", "forwardAir", "backAir", "upAir", "downAir",
  "pummel", "throwForward", "throwBack", "throwUp", "throwDown", "getUpAttack", "ledgeAttack",
  "neutralSpecial", "sideSpecial", "upSpecial", "downSpecial", "neutralSpecialAir", "sideSpecialAir", "upSpecialAir", "downSpecialAir",
  "neutralSpecialFollowUp", "sideSpecialFollowUp", "upSpecialFollowUp", "downSpecialFollowUp",
  "neutralSpecialFollowUpAir", "sideSpecialFollowUpAir", "upSpecialFollowUpAir", "downSpecialFollowUpAir", "ultimate",
];
test("roster jumps and falls never share an attack or special sequence [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const table = characterClips(character);
    const actions = character === Character.rifleman
        ? [SpecialAction.riflemanBear, SpecialAction.riflemanBlaster, SpecialAction.riflemanTrap, SpecialAction.riflemanRecovery]
        : character === Character.demonHunter
          ? [SpecialAction.demonHunterManaBurn, SpecialAction.demonHunterFelRush, SpecialAction.demonHunterWingAscent, SpecialAction.demonHunterImmolate]
          : [SpecialAction.heroNeutral, SpecialAction.heroSide, SpecialAction.heroUp, SpecialAction.heroDown];
    for (const movement of ["jump", "doubleJump", "fall"] as const) {
      const moving = table[movement];
      if (moving === undefined) continue;
      for (const attack of ATTACK_POSES) {
        const attacking = table[attack];
        if (attacking !== undefined) assertEquals(moving.index === attacking.index, false, `${fighterName(character)} ${movement}/${attack}`);
      }
      for (const action of actions) for (const grounded of [true, false]) {
        assertEquals(moving.index === specialClip(character, action, grounded, !grounded).index, false, `${fighterName(character)} ${movement}/special ${action}`);
      }
    }
  }
});

