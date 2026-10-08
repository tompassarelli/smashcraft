import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { originalClipCount } from "../assets/fighterOriginalClipInfo";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { clipFor } from "./fighterClips";
import { advanceFighterPose, createFighterPose } from "./fighterPose";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { soloWorld } from "../sim/testWorld";

for (const character of SELECTABLE_CHARACTERS) {
  const forward = clipFor(character, "rollForward");
  const backward = clipFor(character, "rollBackward");
  test(`${fighterName(character)} rolls with Roll Forward #${forward.index} / Roll Backward #${backward.index} [spec #171]`, () => {
    for (const facing of [-1, 1]) {
      for (const direction of [-1, 1]) {
        const fighter = createFighter(character, 0.0, facing);
        fighter.dodge.groundFrame = 16;
        fighter.dodge.groundEntryFacing = facing;
        fighter.dodge.groundDirection = direction;
        const pose = createFighterPose();
        advanceFighterPose(pose, fighter, soloWorld(fighter), neutralControls(), false, false, false, false);
        const roll = direction === facing ? forward : backward;
        assertEquals(pose.clipIndex, roll.index);
        assertTrue(roll.index !== clipFor(character, "getUp").index);
        assertTrue(roll.index !== clipFor(character, "idle").index);
        assertTrue(roll.index >= 0 && roll.index < originalClipCount(character));
      }
    }
  });
}

