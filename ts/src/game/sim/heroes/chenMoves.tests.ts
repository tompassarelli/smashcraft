import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction } from "../codes";
import { createFighter } from "../fighter";
import { attackStartupFrames, grabContactFrame, isAerialAttack } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { authoredPhysics, melee } from "../tuning";

const CASES = [
  [AttackStyle.jab, 45.0, 0.0, 3.75], [AttackStyle.jab2, 55.0, 0.0, 3.75], [AttackStyle.jab3, 50.0, 0.0, 6.25],
  [AttackStyle.forwardTilt, 90.0, 0.0, 11.25], [AttackStyle.forwardTiltUp, 80.0, 0.0, 11.25], [AttackStyle.forwardTiltDown, 80.0, 0.0, 11.25],
  [AttackStyle.upTilt, 26.0, 60.0, 8.75], [AttackStyle.downTilt, 65.0, 0.0, 7.5], [AttackStyle.dashAttack, 55.0, 0.0, 12.5],
  [AttackStyle.forwardSmash, 95.0, 0.0, 22.5], [AttackStyle.upSmash, 10.0, 80.0, 20.0], [AttackStyle.downSmash, 80.0, 0.0, 17.5],
  [AttackStyle.neutralAir, 45.0, 0.0, 10.0], [AttackStyle.forwardAir, 72.0, 0.0, 15.0], [AttackStyle.backAir, -70.0, 0.0, 13.75],
  [AttackStyle.upAir, 10.0, 80.0, 10.0], [AttackStyle.downAir, 12.0, -95.0, 15.0],
] as const;

test("Chen's authored normals connect once in both facings and miss outside their reach [spec docs/design/chen.md]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z, damage] of CASES) {
    const owner = createFighter(Character.chen, 0.0, facing);
    const target = createFighter(Character.rifleman, f32(x * facing), -facing);
    const world = testWorld(owner, target);
    owner.motion.grounded = !isAerialAttack(style);
    target.motion.z = z;
    beginFighterAttack(world, 0, style, false);
    owner.attack.frame = attackStartupFrames(style, owner.tuning.moves);
    resolveAttacks(world);
    assertEquals(target.status.damage, damage, `style ${style} facing ${facing}`);
    resolveAttacks(world);
    assertEquals(target.status.damage, damage);
    const far = createFighter(Character.rifleman, 400.0 * facing, -facing);
    const farWorld = testWorld(createFighter(Character.chen, 0.0, facing), far);
    beginFighterAttack(farWorld, 0, style, false);
    farWorld.fighters[0]!.attack.frame = attackStartupFrames(style, owner.tuning.moves);
    resolveAttacks(farWorld);
    assertEquals(far.status.damage, 0.0);
  }
});

test("Chen's grab and all four throws release with their authored damage and direction [spec docs/design/chen.md]", () => {
  for (const facing of [-1, 1]) for (const [action, x, z, damage] of [
    [GrabAction.throwForward, facing, 0, 10.0], [GrabAction.throwBack, -facing, 0, 11.25],
    [GrabAction.throwUp, 0, 1, 8.75], [GrabAction.throwDown, 0, -1, 7.5],
  ] as const) {
    const owner = createFighter(Character.chen, 0.0, facing);
    const target = createFighter(Character.rifleman, 50.0 * facing, -facing);
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, AttackStyle.grab, false);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab, owner.tuning.moves);
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
    testGrabFrame(world, [controls({ grabThrowX: x, grabThrowZ: z }), controls()], false);
    assertEquals(owner.grab.action, action);
    for (let frame = 2; frame <= grabContactFrame(action, owner.tuning.moves); frame++) testGrabFrame(world, [controls(), controls()], false);
    assertEquals(target.grab.owner, undefined);
    assertEquals(target.status.damage, damage);
    assertTrue(target.launch.throwHitstun);
    if (action === GrabAction.throwBack) assertGreaterThan(-f32(target.launch.knockbackX * facing), 0.0);
    else if (action === GrabAction.throwUp) assertGreaterThan(target.launch.knockbackZ, 0.0);
    else assertGreaterThan(f32(target.launch.knockbackX * facing), 0.0);
  }
});

test("Chen takes his measured body from Ultimate Ryu [reference] [spec docs/design/chen.md]", () => {
  const body = authoredPhysics(Character.chen);
  assertEquals(body.weight, 103.0);
  assertTrue(Math.abs(body.runSpeed - melee(f32(1.6))) < f32(0.00001));
  assertEquals(body.airSpeed, melee(f32(1.12)));
});
