import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackStartupFrames, characterAttackActiveFrames } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { BLADEMASTER_MOVES } from "./blademasterMoves";
import { isMultiHit } from "./multiHit";
import { advanceFighterMotion } from "../step";

// The adopted roster's F/A/R/L rows, rather than shared legacy frame data.
const NORMALS = [
  [AttackStyle.forwardSmash, 17, 3, 32, 0],
  [AttackStyle.upSmash, 15, 4, 30, 0],
  [AttackStyle.downSmash, 14, 6, 19, 0],
  [AttackStyle.neutralAir, 7, 9, 17, 12],
  [AttackStyle.forwardAir, 10, 3, 22, 14],
  [AttackStyle.backAir, 8, 3, 23, 13],
  [AttackStyle.upAir, 6, 3, 19, 11],
  [AttackStyle.downAir, 10, 25, 12, 20],
  [AttackStyle.grab, 7, 3, 21, 0],
] as const;

function fighter(facing = 1): Fighter {
  const owner = createFighter(Character.rifleman, 0.0, facing);
  owner.tuning.moves = BLADEMASTER_MOVES;
  return owner;
}

test("Sword Plunge stops approach drift while startup keeps ordinary gravity [spec docs/design/aerials.md]", () => {
  for (const facing of [-1, 1]) {
    const owner = fighter(facing);
    owner.motion.grounded = false;
    owner.motion.surface = undefined;
    owner.motion.z = 183.0;
    owner.motion.vx = f32(6.0 * facing);
    owner.motion.vz = -1.0;
    const world = testWorld(owner, createFighter(Character.rifleman, 400.0, -facing));
    beginFighterAttack(world, 0, AttackStyle.downAir, false);
    const x = owner.motion.x;
    advanceFighterMotion(world, 0, 0, 1, controls(), 0.0);
    assertEquals(owner.motion.x, x);
    assertEquals(owner.motion.vx, 0.0);
    assertLessThan(owner.motion.vz, -1.0);
    owner.attack.frame = 9;
    advanceFighterMotion(world, 0, 0, 2, controls(), 0.0);
    assertEquals(owner.motion.x, x);
    assertEquals(owner.motion.vz, -1.5);
  }
});

function contact(style: AttackStyle, facing: number, x: number, z = 0.0, airborneOwner = false, airborneTarget = false, ownerZ = 0.0): Fighter {
  const owner = fighter(facing);
  owner.motion.grounded = !airborneOwner;
  owner.motion.z = ownerZ;
  const target = createReferenceContactFighter(f32(x * facing), -facing);
  target.motion.z = z;
  target.motion.grounded = !airborneTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  owner.attack.frame = attackStartupFrames(style, BLADEMASTER_MOVES);
  resolveAttacks(world);
  return target;
}

test("Blademaster startup and active frames reach production APIs [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  for (const [style, first, active] of NORMALS) {
    const startup = attackStartupFrames(style, BLADEMASTER_MOVES);
    assertEquals(startup, first - 1);
    assertEquals(characterAttackActiveFrames(Character.rifleman, style, BLADEMASTER_MOVES), active);
    const count = authoredHitRegionCount(style, BLADEMASTER_MOVES);
    for (let frame = startup - 1; frame <= startup + active; frame++) {
      let activeCount = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.rifleman, style, frame, 0, index, BLADEMASTER_MOVES);
        if (out.window > 0) {
          assertTrue(out.window === 1 || (isMultiHit(BLADEMASTER_MOVES.normals[style]) && out.window > 1));
          assertTrue(style === AttackStyle.grab ? out.maxX === SHARED_GRAB_REGION.maxX && out.strike === undefined : out.strike !== undefined);
          activeCount++;
        }
      }
      // A multi-hit may pause between its hits; nothing strikes outside its active frames.
      if (activeCount > 0 || !isMultiHit(BLADEMASTER_MOVES.normals[style])) assertEquals(activeCount > 0, frame >= startup && frame < startup + active);
    }
  }
});

test("Blademaster blade tips reward spacing in both facings [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    assertGreaterThan(contact(AttackStyle.jab, facing, 60.0).status.damage, 0.0);
    assertEquals(contact(AttackStyle.jab, facing, 110.0).status.damage, 0.0);
    assertLessThan(contact(AttackStyle.forwardTilt, facing, 60.0).status.damage, contact(AttackStyle.forwardTilt, facing, 140.0).status.damage);
    assertLessThan(contact(AttackStyle.forwardSmash, facing, 80.0).status.damage, contact(AttackStyle.forwardSmash, facing, 170.0).status.damage);
    assertLessThan(contact(AttackStyle.forwardAir, facing, 60.0, 0.0, true).status.damage, contact(AttackStyle.forwardAir, facing, 130.0, 0.0, true).status.damage);
    assertGreaterThan(contact(AttackStyle.backAir, facing, -130.0, 0.0, true).status.damage, 0.0);
    assertEquals(contact(AttackStyle.backAir, facing, 130.0, 0.0, true).status.damage, 0.0);
  }
});

test("Blademaster's descending cut is one move for every angle and narrow upward strikes miss the low front [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    assertGreaterThan(contact(AttackStyle.forwardTiltUp, facing, 140.0).status.damage, 0.0);
    assertEquals(contact(AttackStyle.upSmash, facing, 100.0).status.damage, 0.0);
    assertEquals(contact(AttackStyle.upAir, facing, 70.0, 0.0, true).status.damage, 0.0);
    assertGreaterThan(contact(AttackStyle.upAir, facing, 0.0, 30.0, true).status.damage, 0.0);
  }
});

test("Blademaster down smash cannot rehit one target from its later back swing [spec docs/design/roster.md]", () => {
  const owner = fighter();
  const target = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, AttackStyle.downSmash, false);
  owner.attack.frame = 13;
  resolveAttacks(world);
  const first = target.status.damage;
  assertGreaterThan(first, 0.0);
  owner.launch.hitlag = 0;
  target.launch.hitlag = 0;
  target.motion.x = -100.0;
  target.motion.z = 0.0;
  owner.attack.frame = 16;
  resolveAttacks(world);
  assertEquals(target.status.damage, first);
});

test("Blademaster catches shield and releases each throw once on its adopted frame [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const [action, release] of [
      [GrabAction.throwForward, 12],
      [GrabAction.throwBack, 15],
      [GrabAction.throwUp, 13],
      [GrabAction.throwDown, 16],
    ] as const) {
      const owner = fighter(facing);
      const target = createFighter(Character.rifleman, f32(60.0 * facing), -facing);
      target.shield.raised = true;
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, AttackStyle.grab, false);
      owner.attack.frame = 6;
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(target.grab.owner, 0);
      assertEquals(target.status.damage, 0.0);
      const input = controls({
        grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0,
        grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0,
      });
      for (let frame = 1; frame <= release; frame++) {
        testGrabFrame(world, [input, controls()], false);
        assertEquals(owner.grab.action, action);
        assertEquals(target.status.damage > 0.0, frame >= release);
        assertEquals(target.grab.owner, frame < release ? 0 : undefined);
      }
      assertEquals(owner.grab.target, undefined);
      assertGreaterThan(target.launch.hitstun, 0);
      assertEquals(target.launch.throwHitstun, true);
      const outward = f32(target.launch.knockbackX * facing);
      if (action === GrabAction.throwBack) assertLessThan(outward, 0.0);
      else assertGreaterThan(outward, 0.0);
      const thrown = target.status.damage;
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, thrown);
    }
  }
});

test("Blademaster's sword arm is hittable through a whiffed forward smash while the blade stays disjoint [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    const owner = fighter(facing);
    const world = testWorld(owner, createFighter(Character.rifleman, f32(400.0 * facing), -facing));
    beginFighterAttack(world, 0, AttackStyle.forwardSmash, false);
    const probe = (x: number, z: number) => strikeHurtContact({ x1: f32(x * facing), z1: z, x2: f32(x * facing), z2: z, radius: 4.0 }, owner);
    owner.attack.frame = 5;
    assertEquals(probe(62.0, 76.0), HurtContact.none);
    owner.attack.frame = attackStartupFrames(AttackStyle.forwardSmash, BLADEMASTER_MOVES);
    assertEquals(probe(62.0, 76.0), HurtContact.hit);
    assertEquals(probe(110.0, 76.0), HurtContact.none);
    owner.attack.frame = attackStartupFrames(AttackStyle.forwardSmash, BLADEMASTER_MOVES) + 8;
    assertEquals(probe(62.0, 76.0), HurtContact.none);
  }
});
