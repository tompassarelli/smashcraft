import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "../codes";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackStartupFrames, characterAttackActiveFrames, grabActionDuration, grabContactFrame, isAerialAttack } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { SHADOW_HUNTER_MOVES } from "./shadowHunterMoves";
import { isMultiHit } from "./multiHit";
import { authoredThrowEffect } from "../grabs";


const NORMALS = [
  AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.neutralAir, AttackStyle.forwardAir,
  AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.grab,
] as const;
const startup = (style: AttackStyle) => attackStartupFrames(style, SHADOW_HUNTER_MOVES);
const damageOf = (style: AttackStyle) => SHADOW_HUNTER_MOVES.normals[style]?.regions[0]?.hit.effect.damage ?? -1.0;

function pair(style: AttackStyle, frame: number, x: number, z = 0.0, facing = 1, groundedTarget = true, ownerZ = 0.0) {
  const owner = createFighter(Character.rifleman, 0.0, facing);
  owner.tuning.moves = SHADOW_HUNTER_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  owner.motion.z = ownerZ;
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  target.motion.z = z;
  target.motion.grounded = groundedTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  owner.attack.frame = frame;
  return { owner, target, world };
}

test("Shadow Hunter's narrow single-contact regions are live on every authored active frame and none outside [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  for (const style of NORMALS) {
    const first = startup(style) + 1;
    const active = characterAttackActiveFrames(Character.rifleman, style, SHADOW_HUNTER_MOVES);
    const count = authoredHitRegionCount(style, SHADOW_HUNTER_MOVES);
    assertGreaterThan(count, 0);
    for (let frame = first - 2; frame <= first + active - 1; frame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.rifleman, style, frame, 0, index, SHADOW_HUNTER_MOVES);
        if (out.window > 0) {
          live++;
          assertTrue(out.window === 1 || (isMultiHit(SHADOW_HUNTER_MOVES.normals[style]) && out.window > 1));
          assertTrue(style === AttackStyle.grab ? out.maxX === SHARED_GRAB_REGION.maxX && out.strike === undefined : out.strike !== undefined);
        }
      }

      if (live > 0 || !isMultiHit(SHADOW_HUNTER_MOVES.normals[style])) assertEquals(live > 0, frame >= first - 1 && frame < first - 1 + active);
    }
  }
});

test("Shadow Hunter glaive reach and heel direction are facing relative [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, hits] of [
      [AttackStyle.jab, 60.0, true],
      [AttackStyle.jab, 120.0, false],
      [AttackStyle.forwardTilt, 185.0, false],
      [AttackStyle.forwardSmash, 130.0, true],
      [AttackStyle.forwardAir, 130.0, true],
      [AttackStyle.backAir, -90.0, true],
      [AttackStyle.backAir, 90.0, false],
    ] as const) {
      const damage = hits ? damageOf(style) : 0.0;
      const { target, world } = pair(style, startup(style), x, 0.0, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      if (style === AttackStyle.backAir && damage > 0.0) assertLessThan(f32(target.launch.knockbackX * facing), 0.0);
    }
  }
});

test("Shadow Hunter tilted crescent and vertical outline leave gaps outside their paths [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, z, damage] of [
      [AttackStyle.forwardTiltUp, 130.0, 90.0, "hit"],
      [AttackStyle.forwardTiltDown, 130.0, 90.0, 0.0],
      [AttackStyle.forwardTiltDown, 130.0, -100.0, "hit"],
      [AttackStyle.forwardTiltUp, 130.0, -100.0, 0.0],
      [AttackStyle.upSmash, 90.0, 0.0, 0.0],
      [AttackStyle.upAir, 70.0, 0.0, 0.0],
      [AttackStyle.upAir, 0.0, 30.0, damageOf(AttackStyle.upAir)],
    ] as const) {
      const { target, world } = pair(style, attackStartupFrames(style, SHADOW_HUNTER_MOVES), x, z, facing);
      resolveAttacks(world);
      if (damage === "hit") assertGreaterThan(target.status.damage, 0.0);
      else assertEquals(target.status.damage, damage);
    }
  }
});

test("Shadow Hunter Twin Totems cannot rehit across their later rear burst [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    const rearFrame = startup(AttackStyle.downSmash) + 3;
    const once = damageOf(AttackStyle.downSmash);
    const { owner, target, world } = pair(AttackStyle.downSmash, startup(AttackStyle.downSmash), 80.0, 0.0, facing);
    resolveAttacks(world);
    assertEquals(target.status.damage, once);
    owner.launch.hitlag = 0;
    target.launch.hitlag = 0;
    target.motion.x = f32(-80.0 * facing);
    target.motion.z = 0.0;
    owner.attack.frame = rearFrame;
    resolveAttacks(world);
    assertEquals(target.status.damage, once);
    const rear = pair(AttackStyle.downSmash, rearFrame, -80.0, 0.0, facing);
    resolveAttacks(rear.world);
    assertEquals(rear.target.status.damage, once);
    assertLessThan(f32(rear.target.launch.knockbackX * facing), 0.0);
  }
});

test("Shadow Hunter standing and dash grabs cover both active frames and stop at scaled standing and dash reach [spec #337]", () => {
  const reach = 96.0;
  for (const facing of [-1, 1]) {
    for (const dash of [false, true]) {
      for (const frame of [startup(AttackStyle.grab), startup(AttackStyle.grab) + 1]) {
        for (const caught of [true, false]) {
          const { owner, target, world } = pair(AttackStyle.grab, 0, caught ? (dash ? 120.0 : reach) : (dash ? 121.0 : f32(reach + 1.0)), 0.0, facing);
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

test("Shadow Hunter throws hold through their adopted release and launch once in both facings [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
      const release = grabContactFrame(action, SHADOW_HUNTER_MOVES);
      const damage = authoredThrowEffect(action, SHADOW_HUNTER_MOVES).damage;
      const { owner, target, world } = pair(AttackStyle.grab, startup(AttackStyle.grab), 50.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
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

test("Shadow Hunter's Heel Hook arm is exposed behind him while the glaive tip stays disjoint [spec docs/design/roster.md]", () => {

  const probe = (x: number, z: number) => ({ x1: x, z1: z, x2: x, z2: z, radius: 4.0 });
  for (const facing of [-1, 1]) {
    const f = createFighter(Character.rifleman, 0.0, facing);
    f.tuning.moves = SHADOW_HUNTER_MOVES;
    const touches = (style: AttackStyle | undefined, frame: number, x: number, z: number) => {
      f.attack.style = style;
      f.attack.frame = frame;
      return strikeHurtContact(probe(f32(x * facing), z), f) === HurtContact.hit;
    };


    const poses = SHADOW_HUNTER_MOVES.hurtboxes?.attacks[AttackStyle.backAir] ?? [];
    const first = poses[0]?.firstFrame ?? 0;
    const last = poses[poses.length - 1]?.lastFrame ?? -1;
    const hook = poses[1];
    assertTrue(hook !== undefined);
    if (hook === undefined) continue;
    assertTrue(!touches(undefined, 0, -45.0, 41.0));
    assertTrue(!touches(AttackStyle.backAir, first - 1, -45.0, 41.0));
    for (let frame = first; frame <= last; frame++) assertTrue(touches(AttackStyle.backAir, frame, -45.0, 41.0));
    for (let frame = first; frame <= last; frame++) assertEquals(touches(AttackStyle.backAir, frame, -70.0, 41.0), frame >= hook.firstFrame && frame <= hook.lastFrame);
    assertTrue(!touches(AttackStyle.backAir, last + 1, -45.0, 41.0));

    assertTrue(touches(AttackStyle.forwardTilt, startup(AttackStyle.forwardTilt), 60.0, 56.0));
    assertTrue(!touches(AttackStyle.forwardTilt, startup(AttackStyle.forwardTilt), 110.0, 56.0));
  }
});
