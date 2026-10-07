import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { advanceFighterPose, createFighterPose } from "../../presentation/fighterPose";
import { contactDamageClip } from "../../presentation/damagePose";
import { Character, SpecialAction } from "../codes";
import { createFighter } from "../fighter";
import { FOLLOW_UP_FORM } from "../heroSpecials";
import { neutralControls } from "../roster";
import { soloWorld } from "../testWorld";
import { CHEN_CLIPS, CHEN_DAMAGE_CLIPS } from "./chenClips";

test("Chen draws Fire Palm and Storm Step with distinct clips and all nine authored pain poses", () => {
  for (const grounded of [true, false]) {
    const fighter = createFighter(Character.chen, 0.0, 1);
    fighter.motion.grounded = grounded;
    fighter.special.action = SpecialAction.heroDown;
    fighter.special.frame = 3;
    fighter.special.duration = 32;
    fighter.special.form = FOLLOW_UP_FORM;
    const fire = createFighterPose();
    advanceFighterPose(fire, fighter, soloWorld(fighter), neutralControls(), false, false, false, false);
    assertEquals(fire.clipIndex, (grounded ? CHEN_CLIPS.downSpecialFollowUp : CHEN_CLIPS.downSpecialFollowUpAir).index);
    fighter.special.form = 2 * FOLLOW_UP_FORM;
    const storm = createFighterPose();
    advanceFighterPose(storm, fighter, soloWorld(fighter), neutralControls(), false, false, false, false);
    assertEquals(storm.clipIndex, (grounded ? CHEN_CLIPS.sideSpecialFollowUp : CHEN_CLIPS.sideSpecialFollowUpAir).index);
    assertTrue(storm.clipIndex !== fire.clipIndex);
    for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
      fighter.visuals.hitHeight = height;
      fighter.visuals.hitStrength = strength;
      assertEquals(contactDamageClip(fighter).index, CHEN_DAMAGE_CLIPS[height * 3 + strength]?.index);
    }
  }
});
