import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, HitOrigin } from "../codes";
import { createFighter } from "../fighter";
import { attackStartupFrames, grabContactFrame, isAerialAttack } from "../moves";
import { sourcePassiveContact, resetPassive } from "../passives";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { PEON_MOVES } from "./peonMoves";

const STRIKES = [
  [AttackStyle.jab, 40.0, 0.0, 3.0], [AttackStyle.jab2, 50.0, 0.0, 5.0],
  [AttackStyle.forwardTilt, 80.0, 0.0, 8.0], [AttackStyle.forwardTiltUp, 80.0, 35.0, 8.0],
  [AttackStyle.forwardTiltDown, 80.0, 0.0, 8.0], [AttackStyle.upTilt, 20.0, 80.0, 7.0],
  [AttackStyle.downTilt, 65.0, 0.0, 6.0], [AttackStyle.dashAttack, 65.0, 0.0, 10.0],
  [AttackStyle.forwardSmash, 105.0, 35.0, 19.0], [AttackStyle.upSmash, 20.0, 100.0, 16.0],
  [AttackStyle.downSmash, 85.0, 0.0, 14.0], [AttackStyle.neutralAir, 55.0, 0.0, 8.0],
  [AttackStyle.forwardAir, 85.0, 20.0, 12.0], [AttackStyle.backAir, -70.0, 0.0, 11.0],
  [AttackStyle.upAir, 10.0, 95.0, 9.0], [AttackStyle.downAir, 10.0, -70.0, 13.0],
] as const;

for (const [style, x, z, damage] of STRIKES) {
  test(`Peon normal ${style} hits once on its authored contact frame in both facings`, () => {
    for (const facing of [-1, 1]) {
      const owner = createFighter(Character.peon, 0.0, facing);
      const target = createFighter(Character.archer, x * facing, -facing);
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

test("Peon down air spikes in the air and launches upward from the floor", () => {
  for (const grounded of [false, true]) {
    const owner = createFighter(Character.peon, 0.0, 1);
    owner.motion.grounded = false;
    const target = createFighter(Character.archer, 10.0, -1);
    target.motion.z = -70.0;
    target.motion.grounded = grounded;
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, AttackStyle.downAir, false);
    owner.attack.frame = 13;
    resolveAttacks(world);
    assertEquals(target.status.damage, 13.0);
    if (grounded) assertGreaterThan(target.launch.knockbackZ, 0.0);
    else assertLessThan(target.launch.knockbackZ, 0.0);
  }
});

for (const [action, damage, x, z] of [
  [GrabAction.throwForward, 7.0, 1, 0], [GrabAction.throwBack, 8.0, -1, 0],
  [GrabAction.throwUp, 6.0, 0, 1], [GrabAction.throwDown, 5.0, 0, -1],
] as const) {
  test(`Peon throw ${action} catches a shield and releases once in both facings`, () => {
    for (const facing of [-1, 1]) {
      const owner = createFighter(Character.peon, 0.0, facing);
      const target = createFighter(Character.archer, 45.0 * facing, -facing);
      const world = testWorld(owner, target);
      target.shield.raised = true;
      beginFighterAttack(world, 0, AttackStyle.grab, false);
      owner.attack.frame = 7;
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

test("Peon Pillage restores eight mana on the third distinct tool hit and resets with the stock", () => {
  const owner = createFighter(Character.peon, 0.0, 1);
  owner.mana.points = 20;
  const effect = { damage: 3.0 };
  for (let key = 1; key <= 3; key++) {
    sourcePassiveContact(owner, 1, HitOrigin.melee, true, false, key, effect);
    sourcePassiveContact(owner, 1, HitOrigin.melee, true, false, key, effect);
    assertEquals(owner.mana.points, key === 3 ? 28 : 20);
  }
  sourcePassiveContact(owner, 1, HitOrigin.projectile, false, false, 4, effect);
  assertEquals(owner.passive.stacks, 0);
  for (let key = 5; key <= 7; key++) sourcePassiveContact(owner, 1, HitOrigin.melee, true, key === 7, key, effect);
  assertEquals(owner.mana.points, 28);
  assertEquals(owner.passive.stacks, 0);
  sourcePassiveContact(owner, 1, HitOrigin.melee, true, false, 8, effect);
  resetPassive(owner);
  assertEquals(owner.passive.stacks, 0);
});
