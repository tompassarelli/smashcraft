import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "../codes";
import { attackPhase } from "../conditions";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackLandingLag, attackRecoveryFrames, attackStartupFrames, grabActionDuration, grabContactFrame, isAerialAttack, smashDamageMultiplier } from "../moves";
import { advanceFighter } from "../step";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { HurtContact, fighterHurtParts, strikeHurtContact } from "../hurtboxes";
import { WARDEN_BODY, WARDEN_MOVES } from "./wardenMoves";

const NORMALS = [
  [AttackStyle.jab, 3, 2, 13, 0],
  [AttackStyle.forwardTilt, 7, 3, 18, 0],
  [AttackStyle.forwardTiltUp, 7, 3, 18, 0],
  [AttackStyle.forwardTiltDown, 7, 3, 18, 0],
  [AttackStyle.upTilt, 6, 4, 18, 0],
  [AttackStyle.downTilt, 5, 2, 17, 0],
  [AttackStyle.dashAttack, 8, 4, 24, 0],
  [AttackStyle.forwardSmash, 15, 3, 30, 0],
  [AttackStyle.upSmash, 13, 4, 27, 0],
  [AttackStyle.downSmash, 12, 5, 28, 0],
  [AttackStyle.neutralAir, 5, 5, 18, 10],
  [AttackStyle.forwardAir, 8, 3, 20, 12],
  [AttackStyle.backAir, 7, 3, 22, 12],
  [AttackStyle.upAir, 5, 3, 17, 10],
  [AttackStyle.downAir, 12, 3, 27, 19],
  [AttackStyle.grab, 6, 2, 22, 0],
] as const;

function pair(style: AttackStyle, frame: number, x: number, z = 0.0, facing = 1, groundedTarget = true, ownerZ = 0.0) {
  const owner = createFighter(Character.archer, 0.0, facing);
  owner.tuning.moves = WARDEN_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  owner.motion.z = ownerZ;
  const target = createFighter(Character.archer, f32(x * facing), -facing);
  target.motion.z = z;
  target.motion.grounded = groundedTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  assertEquals(owner.attack.style, style);
  owner.attack.frame = frame;
  owner.attack.cooldown = owner.attack.duration - frame;
  return { owner, target, world };
}

test("Warden roster phases final landings and single-contact paths reach production", () => {
  const out = emptyHitRegion();
  for (const [style, first, active, recovery, landing] of NORMALS) {
    const { owner } = pair(style, 0, 1000.0);
    assertEquals(owner.attack.duration, first - 1 + active + recovery);
    assertEquals(attackStartupFrames(style, WARDEN_MOVES), first - 1);
    assertEquals(attackRecoveryFrames(owner.character, style, owner.motion.grounded, WARDEN_MOVES), recovery);
    assertEquals(attackLandingLag(style, WARDEN_MOVES), landing);
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
        authoredHitRegion(out, Character.archer, style, frame, 0, index, WARDEN_MOVES);
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

test("Warden Judgment Edge rewards blade-end spacing and keeps moderate tilt reach", () => {
  for (const facing of [-1, 1]) {
    for (const [style, frame, x, damage] of [
      [AttackStyle.forwardSmash, 15, 60.0, 12.0],
      [AttackStyle.forwardSmash, 15, 140.0, 16.0],
      [AttackStyle.forwardTilt, 6, 80.0, 8.0],
      [AttackStyle.forwardTilt, 6, 145.0, 0.0],
      [AttackStyle.backAir, 6, -90.0, 11.0],
      [AttackStyle.backAir, 6, 90.0, 0.0],
    ] as const) {
      const { target, world } = pair(style, frame, x, 0.0, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
    }
  }
  assertEquals(smashDamageMultiplier(0, WARDEN_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(45, WARDEN_MOVES), 1.25);
  assertEquals(smashDamageMultiplier(90, WARDEN_MOVES), 1.25);
});

test("Warden angled slices and narrow vertical blades leave honest gaps", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, z, damage] of [
      [AttackStyle.forwardTiltUp, 105.0, 90.0, 8.0],
      [AttackStyle.forwardTiltDown, 105.0, 90.0, 0.0],
      [AttackStyle.forwardTiltDown, 105.0, -100.0, 8.0],
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

test("Warden Execution Point spikes airborne targets and lifts grounded targets without a dive", () => {
  for (const facing of [-1, 1]) {
    for (const grounded of [false, true]) {
      const { owner, target, world } = pair(AttackStyle.downAir, 11, 0.0, 0.0, facing, grounded, 150.0);
      const velocity = owner.motion.vz;
      resolveAttacks(world);
      assertEquals(target.status.damage, 11.0);
      assertEquals(target.launch.knockbackZ > 0.0, grounded);
      assertEquals(owner.motion.vz, velocity);
    }
    const gap = pair(AttackStyle.downAir, 11, 70.0, 0.0, facing, false, 150.0);
    resolveAttacks(gap.world);
    assertEquals(gap.target.status.damage, 0.0);
  }
});

test("Warden Twin Crescent hits once across front and rear blades", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(AttackStyle.downSmash, 11, 80.0, 0.0, facing);
    resolveAttacks(world);
    assertEquals(target.status.damage, 12.0);
    owner.launch.hitlag = 0;
    target.launch.hitlag = 0;
    owner.attack.frame = 14;
    target.motion.x = f32(-80.0 * facing);
    resolveAttacks(world);
    assertEquals(target.status.damage, 12.0);
    const rear = pair(AttackStyle.downSmash, 14, -80.0, 0.0, facing);
    resolveAttacks(rear.world);
    assertEquals(rear.target.status.damage, 12.0);
    assertLessThan(f32(rear.target.launch.knockbackX * facing), 0.0);
  }
});

test("Warden Pursuit Cut travels six tenths H during startup in both facings", () => {
  for (const facing of [-1, 1]) {
    const { owner, world } = pair(AttackStyle.dashAttack, 0, 1000.0, 0.0, facing);
    for (let tick = 0; tick < 7; tick++) advanceFighter(world, 0, 0, controls(), 0.0);
    assertNear(f32(owner.motion.x * facing), f32(HERO_REFERENCE_HEIGHT * f32(0.60)), f32(0.0001));
  }
});

test("Warden standing and dash grabs retain exact reach on both active frames", () => {
  const reach = f32(HERO_REFERENCE_HEIGHT * f32(0.48));
  for (const facing of [-1, 1]) {
    for (const dash of [false, true]) {
      for (const frame of [5, 6]) {
        for (const caught of [true, false]) {
          const { owner, target, world } = pair(AttackStyle.grab, 0, caught ? reach : f32(reach + 1.0), 0.0, facing);
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

test("Warden throws hold through adopted release then launch once in both facings", () => {
  for (const facing of [-1, 1]) {
    for (const [action, release, recovery, damage] of [
      [GrabAction.throwForward, 10, 18, 6.0],
      [GrabAction.throwBack, 14, 21, 7.0],
      [GrabAction.throwUp, 11, 16, 5.0],
      [GrabAction.throwDown, 14, 20, 4.0],
    ] as const) {
      const { owner, target, world } = pair(AttackStyle.grab, 5, 40.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(grabContactFrame(action, WARDEN_MOVES), release);
      assertEquals(grabActionDuration(action, WARDEN_MOVES), release + recovery);
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

test("Warden's blades are disjoint while the arm and Heel Blade leg stay hittable", () => {
  const probe = (target: ReturnType<typeof createFighter>, x: number, z: number) =>
    strikeHurtContact({ x1: x, z1: z, x2: x, z2: z, radius: 1.0 }, target);
  for (const facing of [-1, 1]) {
    const warden = createFighter(Character.archer, 0.0, facing);
    warden.tuning.moves = WARDEN_MOVES;
    // At rest the hand is inside the body.
    assertEquals(probe(warden, f32(26.0 * facing), 70.0), HurtContact.none);
    for (const style of [AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown,
      AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.downSmash, AttackStyle.forwardAir]) {
      const move = WARDEN_MOVES.normals[style];
      assertTrue(move !== undefined);
      if (move === undefined) continue;
      warden.attack.style = style;
      for (const region of move.regions) {
        warden.attack.frame = region.firstFrame;
        // The arm reaches its hand; the farthest blade end of the frame is the disjoint tip.
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

test("Warden's attack bodies are held at least 3 frames, never overlap and end within the move", () => {
  for (let style = 0; style <= AttackStyle.dashAttack; style++) {
    const move = WARDEN_MOVES.normals[style];
    const poses = WARDEN_MOVES.hurtboxes?.attacks[style];
    if (move === undefined) continue;
    assertTrue(poses !== undefined && poses.length > 0);
    let previousEnd = -1;
    for (const pose of poses ?? []) {
      assertGreaterThan(pose.lastFrame - pose.firstFrame + 1, 2);
      assertGreaterThan(pose.firstFrame, previousEnd);
      assertLessThan(pose.lastFrame, move.totalFrames);
      previousEnd = pose.lastFrame;
    }
  }
});
