import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import type { HeroPose } from "../sim/heroes/hero";
import { createRoster, neutralControls } from "../sim/roster";
import { characterClips, clipFor, specialClip } from "./fighterClips";
import { advanceFighterPose, createFighterPose } from "./fighterPose";

const ATTACK_POSES: readonly HeroPose[] = [
  "jab", "jab2", "jab3", "forwardTilt", "forwardTiltUp", "forwardTiltDown", "upTilt", "downTilt",
  "forwardSmash", "upSmash", "downSmash", "dashAttack", "neutralAir", "forwardAir", "backAir", "upAir", "downAir",
  "pummel", "throwForward", "throwBack", "throwUp", "throwDown", "getUpAttack", "ledgeAttack",
  "neutralSpecial", "sideSpecial", "upSpecial", "downSpecial", "neutralSpecialAir", "sideSpecialAir", "upSpecialAir", "downSpecialAir",
  "neutralSpecialFollowUp", "sideSpecialFollowUp", "upSpecialFollowUp", "downSpecialFollowUp",
  "neutralSpecialFollowUpAir", "sideSpecialFollowUpAir", "upSpecialFollowUpAir", "downSpecialFollowUpAir",
];
test("roster jumps and falls never share an attack or special sequence", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const table = characterClips(character);
    const actions = character === Character.archer
      ? [SpecialAction.archerArrow, SpecialAction.archerHomingArrow, SpecialAction.archerDisengage, SpecialAction.archerRecovery]
      : character === Character.rifleman
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

test("Blademaster flip retains thirty presentation frames and leaves Bladestorm alone", () => {
  const fighter = createFighter(Character.blademaster, 0.0, 1);
  fighter.motion.grounded = false; fighter.motion.z = 500.0; fighter.jump.isDouble = true;
  const world = createRoster(1, [fighter]), pose = createFighterPose(), controls = neutralControls();
  const flip = clipFor(Character.blademaster, "doubleJump");
  assertEquals(clipFor(Character.blademaster, "upSpecial").index, 13);
  assertEquals(clipFor(Character.blademaster, "neutralAir").index, 13);
  for (let frame = 0; frame < 30; frame++) {
    advanceFighterPose(pose, fighter, world, controls, false, frame === 0, false, false);
    assertEquals(pose.clipIndex, flip.index);
    assertEquals(pose.jumpAnimationRemaining, 30 - frame);
  }
  assertEquals(fighter.motion.z, 500.0);
  assertEquals(fighter.special.action, SpecialAction.none);
  advanceFighterPose(pose, fighter, world, controls, false, false, false, false);
  assertEquals(pose.jumpAnimationRemaining, 0);
});
