import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "../codes";
import { attackPhase } from "../conditions";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackLandingLag, attackRecoveryFrames, attackStartupFrames, grabActionDuration, grabContactFrame, isAerialAttack, smashDamageMultiplier } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { DREADLORD_MOVES } from "./dreadlordMoves";

// Existing actors carry the kit so these fixtures exercise production combat
// independently of selection and asset integration.
const NORMAL_TIMINGS = [
  [AttackStyle.jab, 5, 2, 15, 0],
  [AttackStyle.forwardTilt, 9, 3, 22, 0],
  [AttackStyle.forwardTiltUp, 9, 3, 22, 0],
  [AttackStyle.forwardTiltDown, 9, 3, 22, 0],
  [AttackStyle.upTilt, 8, 4, 22, 0],
  [AttackStyle.downTilt, 7, 3, 20, 0],
  [AttackStyle.dashAttack, 10, 5, 27, 0],
  [AttackStyle.forwardSmash, 18, 4, 34, 0],
  [AttackStyle.upSmash, 16, 5, 31, 0],
  [AttackStyle.downSmash, 15, 6, 32, 0],
  [AttackStyle.neutralAir, 7, 6, 22, 14],
  [AttackStyle.forwardAir, 10, 4, 24, 15],
  [AttackStyle.backAir, 9, 4, 25, 15],
  [AttackStyle.upAir, 7, 3, 21, 12],
  [AttackStyle.downAir, 14, 4, 29, 20],
  [AttackStyle.grab, 7, 3, 26, 0],
] as const;

function attackPair(style: AttackStyle, frame: number, x: number, z = 0.0, facing = 1, groundedTarget = true) {
  const owner = createFighter(Character.archer, 0.0, facing);
  owner.tuning.moves = DREADLORD_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  target.motion.z = z;
  target.motion.grounded = groundedTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  assertEquals(owner.attack.style, style);
  owner.attack.frame = frame;
  owner.attack.cooldown = owner.attack.duration - frame;
  return { owner, target, world };
}

test("Dreadlord production phases and final landing lag match the adopted roster", () => {
  for (const [style, first, active, recovery, landing] of NORMAL_TIMINGS) {
    const { owner } = attackPair(style, 0, 1000.0);
    assertEquals(owner.attack.duration, first - 1 + active + recovery);
    assertEquals(attackStartupFrames(style, owner.tuning.moves), first - 1);
    assertEquals(attackRecoveryFrames(owner.character, style, owner.motion.grounded, owner.tuning.moves), recovery);
    assertEquals(attackLandingLag(style, owner.tuning.moves), landing);
    owner.attack.frame = first - 2;
    assertEquals(attackPhase(owner), AttackPhase.startup);
    owner.attack.frame++;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame = first + active - 2;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame++;
    assertEquals(attackPhase(owner), AttackPhase.recovery);
  }
});

test("Dreadlord paths are narrow capsules active only on adopted contact frames", () => {
  const out = emptyHitRegion();
  for (const [style, first, active, recovery] of NORMAL_TIMINGS) {
    const count = authoredHitRegionCount(style, DREADLORD_MOVES);
    assertGreaterThan(count, 0);
    for (let frame = 0; frame < first + active + recovery; frame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.archer, style, frame, 0, index, DREADLORD_MOVES);
        if (out.window > 0) {
          live++;
          assertEquals(out.window, 1);
          assertTrue(out.strike !== undefined);
          if (out.strike !== undefined) assertTrue(out.strike.radius <= 14.0);
        }
      }
      assertEquals(live > 0, frame >= first - 1 && frame < first - 1 + active);
    }
  }
});

test("Dreadlord twin talons and front-rear wing sweep hit each target once", () => {
  for (const facing of [1, -1]) {
    const talons = attackPair(AttackStyle.forwardSmash, 17, 100.0, 0.0, facing);
    resolveAttacks(talons.world);
    assertEquals(talons.target.status.damage, 18.0);
    for (let frame = 18; frame <= 20; frame++) {
      talons.owner.launch.hitlag = 0;
      talons.owner.attack.frame = frame;
      resolveAttacks(talons.world);
      assertEquals(talons.target.status.damage, 18.0);
    }
    const sweep = attackPair(AttackStyle.downSmash, 14, 100.0, 0.0, facing);
    resolveAttacks(sweep.world);
    assertEquals(sweep.target.status.damage, 14.0);
    sweep.target.motion.x = f32(-100.0 * facing);
    sweep.owner.launch.hitlag = 0;
    sweep.owner.attack.frame = 17;
    resolveAttacks(sweep.world);
    assertEquals(sweep.target.status.damage, 14.0);
    const back = attackPair(AttackStyle.downSmash, 17, -100.0, 0.0, facing);
    resolveAttacks(back.world);
    assertEquals(back.target.status.damage, 14.0);
    assertLessThan(back.target.launch.knockbackX * facing, 0.0);
  }
});

test("Dreadlord wing backhand launches away from facing and talon drop converts grounded spikes", () => {
  for (const facing of [1, -1]) {
    const back = attackPair(AttackStyle.backAir, 8, -100.0, 0.0, facing, false);
    resolveAttacks(back.world);
    assertEquals(back.target.status.damage, 13.0);
    assertLessThan(back.target.launch.knockbackX * facing, 0.0);
    for (const grounded of [false, true]) {
      const drop = attackPair(AttackStyle.downAir, 13, 12.0, -70.0, facing, grounded);
      resolveAttacks(drop.world);
      assertEquals(drop.target.status.damage, 12.0);
      assertEquals(drop.target.launch.knockbackZ > 0.0, grounded);
      if (grounded) assertGreaterThan(drop.target.launch.knockbackX * facing, 0.0);
      else assertEquals(drop.target.launch.knockbackX, 0.0);
    }
  }
});

test("Dreadlord angled claws retain separate paths and horn lift leaves a lateral gap", () => {
  const straight = emptyHitRegion();
  const up = emptyHitRegion();
  const down = emptyHitRegion();
  authoredHitRegion(straight, Character.archer, AttackStyle.forwardTilt, 9, 0, 1, DREADLORD_MOVES);
  authoredHitRegion(up, Character.archer, AttackStyle.forwardTiltUp, 9, 0, 1, DREADLORD_MOVES);
  authoredHitRegion(down, Character.archer, AttackStyle.forwardTiltDown, 9, 0, 1, DREADLORD_MOVES);
  assertGreaterThan(up.maxZ, straight.maxZ);
  assertLessThan(down.minZ, straight.minZ);
  const hornGap = attackPair(AttackStyle.upAir, 6, 72.0, 0.0, 1, false);
  resolveAttacks(hornGap.world);
  assertEquals(hornGap.target.status.damage, 0.0);
  const dash = DREADLORD_MOVES.normals[AttackStyle.dashAttack];
  assertTrue(dash !== undefined);
  if (dash !== undefined) assertEquals(dash.startupTravelX, f32(HERO_REFERENCE_HEIGHT * 0.5));
  assertEquals(smashDamageMultiplier(0, DREADLORD_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(45, DREADLORD_MOVES), 1.25);
  assertEquals(smashDamageMultiplier(100, DREADLORD_MOVES), 1.25);
});

test("Dreadlord shield grab and dash grab retain adopted reach and whiff timing", () => {
  const out = emptyHitRegion();
  authoredHitRegion(out, Character.archer, AttackStyle.grab, 6, 0, 0, DREADLORD_MOVES);
  assertNear(out.maxX, f32(HERO_REFERENCE_HEIGHT * f32(0.65)), f32(0.0001));
  for (const facing of [1, -1]) {
    const standing = attackPair(AttackStyle.grab, 6, 85.0, 0.0, facing);
    standing.target.shield.raised = true;
    resolveAttacks(standing.world);
    assertEquals(standing.owner.grab.target, 1);
    assertEquals(standing.target.status.damage, 0.0);
    const owner = createFighter(Character.archer, 0.0, facing);
    owner.tuning.moves = DREADLORD_MOVES;
    owner.ground.dashFrame = 1;
    const target = createFighter(Character.rifleman, f32(85.0 * facing), -facing);
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, DASH_GRAB_REQUEST, false);
    assertEquals(owner.attack.duration, 46);
    owner.attack.frame = 8;
    resolveAttacks(world);
    assertEquals(owner.grab.target, undefined);
    owner.attack.frame = 9;
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
  }
});

const THROW_ROWS = [
  [GrabAction.throwForward, 12, 20, 8.0],
  [GrabAction.throwBack, 18, 25, 10.0],
  [GrabAction.throwUp, 15, 21, 7.0],
  [GrabAction.throwDown, 19, 25, 6.0],
] as const;

test("Dreadlord throws hold until the adopted release and launch once in both facings", () => {
  for (const facing of [1, -1]) {
    for (const [action, release, recovery, damage] of THROW_ROWS) {
      const { owner, target, world } = attackPair(AttackStyle.grab, 6, 50.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(grabContactFrame(action, owner.tuning.moves), release);
      assertEquals(grabActionDuration(action, owner.tuning.moves), release + recovery);
      const input = controls({
        grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0,
        grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0,
      });
      for (let tick = 1; tick <= release; tick++) {
        testGrabFrame(world, [input, controls()], false);
        assertEquals(target.grab.owner, tick < release ? 0 : undefined);
        assertEquals(target.status.damage, tick < release ? 0.0 : damage);
      }
      assertEquals(owner.grab.target, undefined);
      assertTrue(target.launch.throwHitstun);
      assertGreaterThan(target.launch.hitstun, 0);
      assertGreaterThan(target.launch.knockbackZ, 0.0);
      if (action === GrabAction.throwBack) assertLessThan(target.launch.knockbackX * facing, 0.0);
      else assertGreaterThan(target.launch.knockbackX * facing, 0.0);
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, damage);
    }
  }
});
