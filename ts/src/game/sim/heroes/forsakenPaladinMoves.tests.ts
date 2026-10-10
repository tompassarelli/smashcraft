import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack } from "../attacks";
import { AttackPhase, AttackStyle, Character } from "../codes";
import { attackPhase } from "../conditions";
import { createFighter } from "../fighter";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { testWorld } from "../testWorld";
import { FORSAKEN_PALADIN_MOVES } from "./forsakenPaladinMoves";

const NORMAL_TIMINGS = [
  AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.neutralAir, AttackStyle.forwardAir,
  AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.grab,
] as const;
const startup = (style: AttackStyle) => attackStartupFrames(style, FORSAKEN_PALADIN_MOVES);

function attackPair(style: AttackStyle, frame: number, targetX: number, targetZ = 0.0, facing = 1, groundedTarget = true) {
  const owner = createFighter(Character.rifleman, 0.0, facing);
  owner.tuning.moves = FORSAKEN_PALADIN_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  const target = createFighter(Character.rifleman, f32(targetX * facing), -facing);
  target.motion.z = targetZ;
  target.motion.grounded = groundedTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  assertEquals(owner.attack.style, style);
  owner.attack.frame = frame;
  owner.attack.cooldown = owner.attack.duration - frame;
  return { owner, target, world };
}

test("Forsaken Paladin contact paths and attack phase agree on the authored active frames with one shared hit window [spec #96]", () => {
  const region = emptyHitRegion();
  for (const style of NORMAL_TIMINGS) {
    const count = authoredHitRegionCount(style, FORSAKEN_PALADIN_MOVES);
    assertGreaterThan(count, 0);
    const { owner } = attackPair(style, 0, 1000.0);
    for (let actionFrame = 0; actionFrame < owner.attack.duration; actionFrame++) {
      let contacts = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(region, Character.rifleman, style, actionFrame, 0, index, FORSAKEN_PALADIN_MOVES);
        if (region.window > 0) {
          contacts++;
          assertEquals(region.window, 1);
          assertTrue(style === AttackStyle.grab ? region.maxX === SHARED_GRAB_REGION.maxX && region.strike === undefined : region.strike !== undefined);
        }
      }
      owner.attack.frame = actionFrame;
      assertEquals(attackPhase(owner), contacts > 0 ? AttackPhase.active : actionFrame < startup(style) ? AttackPhase.startup : AttackPhase.recovery);
    }
  }
});
