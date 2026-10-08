import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { originalClipCount, originalClipNamed } from "../assets/fighterOriginalClipInfo";
import { Character } from "../sim/codes";
import type { HeroPose } from "../sim/heroes/hero";
import { STOCK_CLIP_SWAPS } from "./stockClipSwaps";
import { ROSTER_ATTACK_CLIPS } from "./rosterAttackClipInfo";
import { WARDEN_FAN_CLIPS } from "./wardenFanClipInfo";
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


// A gesture generator binds by sequence index; any clip appended to the model before it shifts every later index.
for (const [id, bindings] of Object.entries(ROSTER_ATTACK_CLIPS)) {
  const character = Number(id);
  test(`${fighterName(character)} plays each attack gesture from the sequence named for its move [repro #151]`, () => {
    for (const [pose, binding] of Object.entries(bindings) as [HeroPose, { index: number }][]) {
      const name = `attack gesture ${pose.startsWith("downSpecial") ? "downSpecial" : pose}`.toLowerCase();
      assertEquals(`${pose} #${originalClipNamed(character, name)}`, `${pose} #${binding.index}`);
      if (STOCK_CLIP_SWAPS[character]?.[pose] === undefined) assertEquals(`${pose} #${clipFor(character, pose).index}`, `${pose} #${binding.index}`);
    }
  });
}

test("Warden casts Fan of Knives from the sequences named for it [repro #151]", () => {
  assertEquals(originalClipNamed(Character.warden, "fan of knives ground"), WARDEN_FAN_CLIPS.ground.index);
  assertEquals(originalClipNamed(Character.warden, "fan of knives air"), WARDEN_FAN_CLIPS.air.index);
  assertEquals(clipFor(Character.warden, "downSpecial").index, WARDEN_FAN_CLIPS.ground.index);
  assertEquals(clipFor(Character.warden, "downSpecialAir").index, WARDEN_FAN_CLIPS.air.index);
});
