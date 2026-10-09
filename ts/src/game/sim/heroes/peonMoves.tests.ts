import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction } from "../codes";
import { createFighter } from "../fighter";
import { attackStartupFrames, grabContactFrame, isAerialAttack } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { PEON_MOVES } from "./peonMoves";

const STRIKES = [
  [AttackStyle.jab, 40.0, 0.0], [AttackStyle.jab2, 50.0, 0.0],
  [AttackStyle.forwardTilt, 80.0, 0.0], [AttackStyle.forwardTiltUp, 80.0, 35.0],
  [AttackStyle.forwardTiltDown, 80.0, 0.0], [AttackStyle.upTilt, 20.0, 80.0],
  [AttackStyle.downTilt, 65.0, 0.0], [AttackStyle.dashAttack, 65.0, 0.0],
  [AttackStyle.forwardSmash, 105.0, 35.0], [AttackStyle.upSmash, 20.0, 100.0],
  [AttackStyle.downSmash, 85.0, 0.0], [AttackStyle.neutralAir, 55.0, 0.0],
  [AttackStyle.forwardAir, 85.0, 20.0], [AttackStyle.backAir, -70.0, 0.0],
  [AttackStyle.upAir, 10.0, 95.0], [AttackStyle.downAir, 10.0, -70.0],
] as const;

function firstHitDamage(style: AttackStyle): number {
  const move = PEON_MOVES.normals[style];
  return move?.regions.find(region => region.firstFrame === move.startupFrames)?.hit.effect.damage ?? -1.0;
}

for (const [style, x, z] of STRIKES) {
  const damage = firstHitDamage(style);
  test(`Peon normal ${style} hits once on its authored contact frame in both facings [spec docs/design/peasant.md]`, () => {
    for (const facing of [-1, 1]) {
      const owner = createFighter(Character.peon, 0.0, facing);
      const target = createFighter(Character.rifleman, x * facing, -facing);
      const world = testWorld(owner, target);
      owner.motion.grounded = !isAerialAttack(style);
      target.motion.z = z;
      target.motion.grounded = z === 0.0;
      beginFighterAttack(world, 0, style, false);
      owner.attack.frame = attackStartupFrames(style, PEON_MOVES) - 1;
      resolveAttacks(world);
      assertEquals(target.status.damage, 0.0);
      owner.attack.frame++;
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      assertGreaterThan(target.launch.hitstun, 0);
      owner.launch.hitlag = 0;
      owner.attack.frame++;
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
    }
  });
}

test("Peon down air spikes in the air and launches upward from the floor [spec docs/design/peasant.md]", () => {
  for (const grounded of [false, true]) {
    const owner = createFighter(Character.peon, 0.0, 1);
    owner.motion.grounded = false;
    const target = createFighter(Character.rifleman, 10.0, -1);
    target.motion.z = -70.0;
    target.motion.grounded = grounded;
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, AttackStyle.downAir, false);
    owner.attack.frame = attackStartupFrames(AttackStyle.downAir, PEON_MOVES);
    resolveAttacks(world);
    assertEquals(target.status.damage, firstHitDamage(AttackStyle.downAir));
    if (grounded) assertGreaterThan(target.launch.knockbackZ, 0.0);
    else assertLessThan(target.launch.knockbackZ, 0.0);
  }
});

for (const [action, x, z] of [
  [GrabAction.throwForward, 1, 0], [GrabAction.throwBack, -1, 0],
  [GrabAction.throwUp, 0, 1], [GrabAction.throwDown, 0, -1],
] as const) {
  const damage = PEON_MOVES.throws[action]?.effect.damage ?? -1.0;
  test(`Peon throw ${action} catches a shield and releases once in both facings [spec docs/design/peasant.md]`, () => {
    for (const facing of [-1, 1]) {
      const owner = createFighter(Character.peon, 0.0, facing);
      const target = createFighter(Character.rifleman, 45.0 * facing, -facing);
      const world = testWorld(owner, target);
      target.shield.raised = true;
      beginFighterAttack(world, 0, AttackStyle.grab, false);
      owner.attack.frame = attackStartupFrames(AttackStyle.grab, PEON_MOVES);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      const input = controls({ grabThrowX: x * facing, grabThrowZ: z });
      for (let frame = 1; frame <= grabContactFrame(action, PEON_MOVES); frame++) testGrabFrame(world, [input, controls()], false);
      assertEquals(owner.grab.target, undefined);
      assertEquals(target.grab.owner, undefined);
      assertEquals(target.status.damage, damage);
      assertGreaterThan(target.launch.knockbackZ, 0.0);
      if (action === GrabAction.throwBack) assertLessThan(target.launch.knockbackX * facing, 0.0);
      else assertGreaterThan(target.launch.knockbackX * facing, 0.0);
      testGrabFrame(world, [controls(), controls()], false);
      assertEquals(target.status.damage, damage);
    }
  });
}
