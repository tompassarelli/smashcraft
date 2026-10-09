import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction } from "../codes";
import { createFighter } from "../fighter";
import { attackStartupFrames, grabContactFrame, isAerialAttack } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { authoredPhysics, melee } from "../tuning";
import { CHEN_MOVES } from "./chenMoves";

const CASES = [
  [AttackStyle.jab, 45.0, 0.0], [AttackStyle.jab2, 55.0, 0.0], [AttackStyle.jab3, 50.0, 0.0],
  [AttackStyle.forwardTilt, 90.0, 0.0], [AttackStyle.forwardTiltUp, 80.0, 0.0], [AttackStyle.forwardTiltDown, 80.0, 0.0],
  [AttackStyle.upTilt, 26.0, 60.0], [AttackStyle.downTilt, 65.0, 0.0], [AttackStyle.dashAttack, 55.0, 0.0],
  [AttackStyle.forwardSmash, 95.0, 0.0], [AttackStyle.upSmash, 10.0, 80.0], [AttackStyle.downSmash, 80.0, 0.0],
  [AttackStyle.neutralAir, 45.0, 0.0], [AttackStyle.forwardAir, 72.0, 0.0], [AttackStyle.backAir, -70.0, 0.0],
  [AttackStyle.upAir, 10.0, 80.0], [AttackStyle.downAir, 12.0, -95.0],
] as const;

test("Chen's authored normals connect once in both facings and miss outside their reach [spec docs/design/chen.md]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z] of CASES) {
    const damage = CHEN_MOVES.normals[style]!.regions[0]!.hit.effect.damage;
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
  for (const facing of [-1, 1]) for (const [action, x, z] of [
    [GrabAction.throwForward, facing, 0], [GrabAction.throwBack, -facing, 0],
    [GrabAction.throwUp, 0, 1], [GrabAction.throwDown, 0, -1],
  ] as const) {
    const damage = CHEN_MOVES.throws[action]!.effect.damage;
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
