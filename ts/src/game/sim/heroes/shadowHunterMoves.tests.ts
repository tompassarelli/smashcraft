import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "../codes";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackDurationFramesForGrounding, attackLandingLag, attackStartupFrames, characterAttackActiveFrames, grabActionDuration, grabContactFrame, isAerialAttack, smashDamageMultiplier } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { SHADOW_HUNTER_MOVES } from "./shadowHunterMoves";

// Adopted F/A/R/L values from smashcraft:docs/design/roster.md.
const NORMALS = [
  [AttackStyle.jab, 5, 2, 14, 0],
  [AttackStyle.forwardTilt, 9, 3, 21, 0],
  [AttackStyle.forwardTiltUp, 9, 3, 21, 0],
  [AttackStyle.forwardTiltDown, 9, 3, 21, 0],
  [AttackStyle.upTilt, 8, 4, 21, 0],
  [AttackStyle.downTilt, 7, 3, 19, 0],
  [AttackStyle.dashAttack, 10, 4, 27, 0],
  [AttackStyle.forwardSmash, 19, 3, 34, 0],
  [AttackStyle.upSmash, 17, 4, 31, 0],
  [AttackStyle.downSmash, 16, 5, 33, 0],
  [AttackStyle.neutralAir, 7, 5, 21, 13],
  [AttackStyle.forwardAir, 10, 3, 25, 15],
  [AttackStyle.backAir, 8, 3, 23, 13],
  [AttackStyle.upAir, 7, 3, 21, 12],
  [AttackStyle.downAir, 14, 4, 29, 20],
  [AttackStyle.grab, 8, 2, 24, 0],
] as const;

function pair(style: AttackStyle, frame: number, x: number, z = 0.0, facing = 1, groundedTarget = true, ownerZ = 0.0) {
  const owner = createFighter(Character.archer, 0.0, facing);
  owner.tuning.moves = SHADOW_HUNTER_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  owner.motion.z = ownerZ;
  const target = createFighter(Character.archer, f32(x * facing), -facing);
  target.motion.z = z;
  target.motion.grounded = groundedTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  owner.attack.frame = frame;
  return { owner, target, world };
}

test("Shadow Hunter adopted phases landings and narrow single-contact regions reach production", () => {
  const out = emptyHitRegion();
  for (const [style, first, active, recovery, landing] of NORMALS) {
    assertEquals(attackStartupFrames(style, SHADOW_HUNTER_MOVES), first - 1);
    assertEquals(characterAttackActiveFrames(Character.archer, style, SHADOW_HUNTER_MOVES), active);
    assertEquals(attackDurationFramesForGrounding(style, !isAerialAttack(style), SHADOW_HUNTER_MOVES), first - 1 + active + recovery);
    assertEquals(attackLandingLag(style, SHADOW_HUNTER_MOVES), landing);
    const count = authoredHitRegionCount(style, SHADOW_HUNTER_MOVES);
    assertGreaterThan(count, 0);
    for (let frame = first - 2; frame <= first + active - 1; frame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.archer, style, frame, 0, index, SHADOW_HUNTER_MOVES);
        if (out.window > 0) {
          live++;
          assertEquals(out.window, 1);
          assertTrue(out.strike !== undefined);
        }
      }
      assertEquals(live > 0, frame >= first - 1 && frame < first - 1 + active);
    }
  }
});

test("Shadow Hunter glaive reach and heel direction are facing relative", () => {
  for (const facing of [-1, 1]) {
    for (const [style, frame, x, damage] of [
      [AttackStyle.jab, 4, 60.0, 3.0],
      [AttackStyle.jab, 4, 120.0, 0.0],
      [AttackStyle.forwardTilt, 8, 130.0, 9.0],
      [AttackStyle.forwardTilt, 8, 185.0, 0.0],
      [AttackStyle.forwardSmash, 18, 130.0, 18.0],
      [AttackStyle.forwardAir, 9, 130.0, 11.0],
      [AttackStyle.backAir, 7, -90.0, 10.0],
      [AttackStyle.backAir, 7, 90.0, 0.0],
    ] as const) {
      const { target, world } = pair(style, frame, x, 0.0, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      if (style === AttackStyle.backAir && damage > 0.0) assertLessThan(f32(target.launch.knockbackX * facing), 0.0);
    }
  }
});

test("Shadow Hunter tilted crescent and vertical outline leave gaps outside their paths", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, z, damage] of [
      [AttackStyle.forwardTiltUp, 130.0, 90.0, 9.0],
      [AttackStyle.forwardTiltDown, 130.0, 90.0, 0.0],
      [AttackStyle.forwardTiltDown, 130.0, -100.0, 9.0],
      [AttackStyle.forwardTiltUp, 130.0, -100.0, 0.0],
      [AttackStyle.upSmash, 90.0, 0.0, 0.0],
      [AttackStyle.upAir, 70.0, 0.0, 0.0],
      [AttackStyle.upAir, 0.0, 30.0, 8.0],
    ] as const) {
      const { target, world } = pair(style, attackStartupFrames(style, SHADOW_HUNTER_MOVES), x, z, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
    }
  }
});

test("Shadow Hunter Totem Point spikes airborne targets and lifts grounded targets", () => {
  for (const facing of [-1, 1]) {
    for (const grounded of [false, true]) {
      const { owner, target, world } = pair(AttackStyle.downAir, 13, 0.0, 0.0, facing, grounded, 160.0);
      const vz = owner.motion.vz;
      resolveAttacks(world);
      assertEquals(target.status.damage, 11.0);
      assertEquals(target.launch.knockbackZ > 0.0, grounded);
      assertEquals(owner.motion.vz, vz);
    }
    const gap = pair(AttackStyle.downAir, 13, 70.0, 0.0, facing, false, 160.0);
    resolveAttacks(gap.world);
    assertEquals(gap.target.status.damage, 0.0);
  }
});

test("Shadow Hunter Twin Totems cannot rehit across their later rear burst", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(AttackStyle.downSmash, 15, 80.0, 0.0, facing);
    resolveAttacks(world);
    assertEquals(target.status.damage, 13.0);
    owner.launch.hitlag = 0;
    target.launch.hitlag = 0;
    target.motion.x = f32(-80.0 * facing);
    target.motion.z = 0.0;
    owner.attack.frame = 18;
    resolveAttacks(world);
    assertEquals(target.status.damage, 13.0);
    const rear = pair(AttackStyle.downSmash, 18, -80.0, 0.0, facing);
    resolveAttacks(rear.world);
    assertEquals(rear.target.status.damage, 13.0);
    assertLessThan(f32(rear.target.launch.knockbackX * facing), 0.0);
  }
});

test("Shadow Hunter Spirit Cleaver caps charge at forty-five frames", () => {
  assertEquals(smashDamageMultiplier(0, SHADOW_HUNTER_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(45, SHADOW_HUNTER_MOVES), 1.25);
  assertEquals(smashDamageMultiplier(90, SHADOW_HUNTER_MOVES), 1.25);
  const out = emptyHitRegion();
  authoredHitRegion(out, Character.archer, AttackStyle.forwardSmash, 18, 45, 0, SHADOW_HUNTER_MOVES);
  assertEquals(out.effect.damage, 22.5);
});

test("Shadow Hunter standing and dash grabs cover both active frames and stop at adopted reach", () => {
  const reach = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
  for (const facing of [-1, 1]) {
    for (const dash of [false, true]) {
      for (const frame of [7, 8]) {
        for (const caught of [true, false]) {
          const { owner, target, world } = pair(AttackStyle.grab, 0, caught ? reach : f32(reach + 1.0), 0.0, facing);
          target.shield.raised = true;
          if (dash) {
            owner.attack.cooldown = 0;
            owner.ground.dashFrame = 1;
            beginFighterAttack(world, 0, DASH_GRAB_REQUEST, false);
            assertTrue(owner.attack.dashGrab);
            assertEquals(owner.attack.duration, 44);
          }
          owner.attack.frame = frame + (dash ? 3 : 0);
          resolveAttacks(world);
          assertEquals(owner.grab.target !== undefined, caught);
          assertEquals(target.status.damage, 0.0);
        }
      }
    }
  }
});

test("Shadow Hunter mask pummels contact on frame five without launch and stop after two", () => {
  const { owner, target, world } = pair(AttackStyle.grab, 7, 50.0);
  resolveAttacks(world);
  assertEquals(owner.grab.target, 1);
  for (let pummel = 0; pummel < 2; pummel++) {
    for (let frame = 1; frame <= 13; frame++) {
      testGrabFrame(world, [controls({ attackPressed: frame === 1 }), controls()], false);
      assertEquals(target.status.damage, pummel + (frame < 5 ? 0 : 1));
      assertEquals(target.launch.knockbackX, 0.0);
      assertEquals(target.launch.knockbackZ, 0.0);
    }
    assertEquals(owner.grab.action, GrabAction.hold);
  }
  testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
  assertEquals(owner.grab.action, GrabAction.hold);
  assertEquals(target.status.damage, 2.0);
});

test("Shadow Hunter throws hold through their adopted release and launch once in both facings", () => {
  for (const facing of [-1, 1]) {
    for (const [action, release, recovery, damage] of [
      [GrabAction.throwForward, 12, 20, 7.0],
      [GrabAction.throwBack, 16, 24, 8.0],
      [GrabAction.throwUp, 14, 20, 6.0],
      [GrabAction.throwDown, 17, 23, 5.0],
    ] as const) {
      const { owner, target, world } = pair(AttackStyle.grab, 7, 50.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(grabContactFrame(action, SHADOW_HUNTER_MOVES), release);
      assertEquals(grabActionDuration(action, SHADOW_HUNTER_MOVES), release + recovery);
      const input = controls({
        grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0,
        grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0,
      });
      for (let frame = 1; frame <= release; frame++) {
        testGrabFrame(world, [input, controls()], false);
        assertEquals(owner.grab.action, action);
        assertEquals(target.grab.owner, frame < release ? 0 : undefined);
        assertEquals(target.status.damage, frame < release ? 0.0 : damage);
      }
      assertEquals(owner.grab.target, undefined);
      assertTrue(target.launch.throwHitstun);
      assertGreaterThan(target.launch.hitstun, 0);
      assertGreaterThan(target.launch.knockbackZ, 0.0);
      if (action === GrabAction.throwBack) assertLessThan(f32(target.launch.knockbackX * facing), 0.0);
      else assertGreaterThan(f32(target.launch.knockbackX * facing), 0.0);
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, damage);
    }
  }
});

test("Shadow Hunter's Heel Hook arm is exposed behind him while the glaive tip stays disjoint", () => {
  // A small probe placed in world space, as a strike from an opponent would be.
  const probe = (x: number, z: number) => ({ x1: x, z1: z, x2: x, z2: z, radius: 4.0 });
  for (const facing of [-1, 1]) {
    const f = createFighter(Character.archer, 0.0, facing);
    f.tuning.moves = SHADOW_HUNTER_MOVES;
    const touches = (style: AttackStyle | undefined, frame: number, x: number, z: number) => {
      f.attack.style = style;
      f.attack.frame = frame;
      return strikeHurtContact(probe(f32(x * facing), z), f) === HurtContact.hit;
    };
    // Behind at 70 units: outside the standing body, inside the hooking arm from two
    // frames before its first active frame (zero-based 7) through two after its last.
    assertTrue(!touches(undefined, 0, -70.0, 41.0));
    assertTrue(!touches(AttackStyle.backAir, 3, -70.0, 41.0));
    for (let frame = 5; frame <= 11; frame++) assertTrue(touches(AttackStyle.backAir, frame, -70.0, 41.0));
    assertTrue(!touches(AttackStyle.backAir, 12, -70.0, 41.0));
    // Forward tilt's blade reaches 145; the arm ends near 67, so the blade's outer half is disjoint.
    assertTrue(touches(AttackStyle.forwardTilt, 8, 60.0, 56.0));
    assertTrue(!touches(AttackStyle.forwardTilt, 8, 110.0, 56.0));
  }
});
