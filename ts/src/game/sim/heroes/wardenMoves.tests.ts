import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "../codes";
import { attackPhase } from "../conditions";
import { createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackStartupFrames, characterAttackActiveFrames, grabContactFrame, isAerialAttack, smashDamageMultiplier } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { HurtContact, fighterHurtParts, strikeHurtContact } from "../hurtboxes";
import { WARDEN_BODY, WARDEN_MOVES } from "./wardenMoves";
import { isMultiHit } from "./multiHit";

const NORMALS = [AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.neutralAir, AttackStyle.forwardAir,
  AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.grab] as const;

function strongest(style: AttackStyle): number {
  return Math.max(0.0, ...(WARDEN_MOVES.normals[style]?.regions.map(region => region.hit.effect.damage) ?? []));
}

function weakest(style: AttackStyle): number {
  return Math.min(...(WARDEN_MOVES.normals[style]?.regions.map(region => region.hit.effect.damage) ?? [0.0]));
}

function pair(style: AttackStyle, frame: number, x: number, z = 0.0, facing = 1, groundedTarget = true, ownerZ = 0.0) {
  const owner = createFighter(Character.rifleman, 0.0, facing);
  owner.tuning.moves = WARDEN_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  owner.motion.z = ownerZ;
  const target = createReferenceContactFighter(f32(x * facing), -facing);
  target.motion.z = z;
  target.motion.grounded = groundedTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  assertEquals(owner.attack.style, style);
  owner.attack.frame = frame;
  owner.attack.cooldown = owner.attack.duration - frame;
  return { owner, target, world };
}

test("Warden roster phases and single-contact paths reach production [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  for (const style of NORMALS) {
    const { owner } = pair(style, 0, 1000.0);
    const first = attackStartupFrames(style, WARDEN_MOVES) + 1, active = characterAttackActiveFrames(Character.rifleman, style, WARDEN_MOVES);
    owner.attack.frame = first - 2;
    assertEquals(attackPhase(owner), AttackPhase.startup);
    owner.attack.frame++;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame = first + active - 2;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame++;
    assertEquals(attackPhase(owner), AttackPhase.recovery);
    const count = authoredHitRegionCount(style, WARDEN_MOVES);
    assertGreaterThan(count, 0);
    for (let frame = first - 2; frame <= first + active - 1; frame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.rifleman, style, frame, 0, index, WARDEN_MOVES);
        if (out.window > 0) {
          live++;
          assertTrue(out.window === 1 || (isMultiHit(WARDEN_MOVES.normals[style]) && out.window > 1));
          assertTrue(style === AttackStyle.grab ? out.maxX === SHARED_GRAB_REGION.maxX && out.strike === undefined : out.strike !== undefined);
        }
      }

      if (live > 0 || !isMultiHit(WARDEN_MOVES.normals[style])) assertEquals(live > 0, frame >= first - 1 && frame < first - 1 + active);
    }
  }
});

test("Warden Judgment Edge rewards blade-end spacing and keeps moderate tilt reach [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const [style, frame, x, damage] of [
      [AttackStyle.forwardSmash, 15, 60.0, weakest(AttackStyle.forwardSmash)],
      [AttackStyle.forwardSmash, 15, 140.0, strongest(AttackStyle.forwardSmash)],
      [AttackStyle.forwardTilt, 6, 80.0, strongest(AttackStyle.forwardTilt)],
      [AttackStyle.forwardTilt, 6, 145.0, 0.0],
      [AttackStyle.backAir, 6, -90.0, strongest(AttackStyle.backAir)],
      [AttackStyle.backAir, 6, 90.0, 0.0],
    ] as const) {
      const { target, world } = pair(style, frame, x, 0.0, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
    }
  }
  assertEquals(smashDamageMultiplier(0, WARDEN_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(WARDEN_MOVES.smashMaxChargeFrames, WARDEN_MOVES), WARDEN_MOVES.smashMaxDamageMultiplier);
  assertEquals(smashDamageMultiplier(WARDEN_MOVES.smashMaxChargeFrames * 2, WARDEN_MOVES), WARDEN_MOVES.smashMaxDamageMultiplier);
});

test("Warden angled slices and narrow vertical blades leave honest gaps [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, z, damage] of [
      [AttackStyle.forwardTiltUp, 105.0, 90.0, strongest(AttackStyle.forwardTiltUp)],
      [AttackStyle.forwardTiltDown, 105.0, 90.0, 0.0],
      [AttackStyle.forwardTiltDown, 105.0, -100.0, strongest(AttackStyle.forwardTiltDown)],
      [AttackStyle.forwardTiltUp, 105.0, -100.0, 0.0],
      [AttackStyle.upSmash, 90.0, 0.0, 0.0],
      [AttackStyle.upAir, 70.0, 0.0, 0.0],
    ] as const) {
      const { target, world } = pair(style, attackStartupFrames(style, WARDEN_MOVES), x, z, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
    }
  }
});

test("Warden Twin Crescent hits once across front and rear blades [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    const damage = strongest(AttackStyle.downSmash);
    const { owner, target, world } = pair(AttackStyle.downSmash, 11, 80.0, 0.0, facing);
    resolveAttacks(world);
    assertEquals(target.status.damage, damage);
    owner.launch.hitlag = 0;
    target.launch.hitlag = 0;
    owner.attack.frame = 14;
    target.motion.x = f32(-80.0 * facing);
    resolveAttacks(world);
    assertEquals(target.status.damage, damage);
    const rear = pair(AttackStyle.downSmash, 14, -80.0, 0.0, facing);
    resolveAttacks(rear.world);
    assertEquals(rear.target.status.damage, damage);
    assertLessThan(f32(rear.target.launch.knockbackX * facing), 0.0);
  }
});

test("Warden standing and dash grabs use scaled standing and dash reach [spec #337]", () => {
  const reach = 96.0;
  for (const facing of [-1, 1]) {
    for (const dash of [false, true]) {
      for (const frame of [5, 6]) {
        for (const caught of [true, false]) {
          const { owner, target, world } = pair(AttackStyle.grab, 0, caught ? (dash ? 120.0 : reach) : (dash ? 121.0 : f32(reach + 1.0)), 0.0, facing);
          target.shield.raised = true;
          if (dash) {
            owner.attack.cooldown = 0;
            owner.ground.dashFrame = 1;
            beginFighterAttack(world, 0, DASH_GRAB_REQUEST, false);
            assertTrue(owner.attack.dashGrab);
            assertEquals(owner.attack.duration, 40);
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

test("Warden throws hold through adopted release then launch once in both facings [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
      const release = grabContactFrame(action, WARDEN_MOVES), damage = WARDEN_MOVES.throws[action]?.effect.damage ?? -1.0;
      const { owner, target, world } = pair(AttackStyle.grab, 5, 40.0, 0.0, facing);
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

test("Warden's blades are disjoint while the arm and Heel Blade leg stay hittable [spec docs/design/roster.md]", () => {
  const probe = (target: ReturnType<typeof createFighter>, x: number, z: number) =>
    strikeHurtContact({ x1: x, z1: z, x2: x, z2: z, radius: 1.0 }, target);
  for (const facing of [-1, 1]) {
    const warden = createFighter(Character.rifleman, 0.0, facing);
    warden.tuning.moves = WARDEN_MOVES;

    assertEquals(probe(warden, f32(26.0 * facing), 70.0), HurtContact.none);
    for (const style of [AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown,
      AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.downSmash, AttackStyle.forwardAir]) {
      const move = WARDEN_MOVES.normals[style];
      assertTrue(move !== undefined);
      if (move === undefined) continue;
      warden.attack.style = style;
      for (const region of move.regions) {
        warden.attack.frame = region.firstFrame;

        const arm = fighterHurtParts(warden)[1];
        assertTrue(arm !== undefined);
        if (arm === undefined) continue;
        const reach = f32(f32(Math.abs(arm.x2) + arm.radius) - 1.0);
        assertGreaterThan(reach, WARDEN_BODY.radius);
        let tip = { x: 0.0, z: 0.0 };
        for (const other of move.regions) {
          const strike = other.hit.strike;
          if (strike === undefined || other.firstFrame > region.firstFrame || other.lastFrame < region.firstFrame) continue;
          for (const end of [{ x: strike.x1, z: strike.z1 }, { x: strike.x2, z: strike.z2 }]) {
            if (Math.abs(end.x) > Math.abs(tip.x)) tip = end;
          }
        }
        assertEquals(probe(warden, f32(tip.x * facing), tip.z), HurtContact.none);
        assertEquals(probe(warden, f32((arm.x2 < 0.0 ? -reach : reach) * facing), arm.z2), HurtContact.hit);
      }
    }
    warden.attack.style = AttackStyle.backAir;
    warden.attack.frame = 4;
    assertEquals(probe(warden, f32(-30.0 * facing), 40.0), HurtContact.hit);
    warden.attack.frame = 13;
    assertEquals(probe(warden, f32(-30.0 * facing), 40.0), HurtContact.none);
    warden.attack.style = AttackStyle.grab;
    warden.attack.frame = 5;
    assertEquals(probe(warden, f32(50.0 * facing), 47.0), HurtContact.hit);
  }
});
