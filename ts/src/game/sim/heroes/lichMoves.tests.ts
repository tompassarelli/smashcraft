import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "../codes";
import { attackPhase } from "../conditions";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { fighterHurtParts } from "../hurtboxes";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackLandingLag, attackRecoveryFrames, attackStartupFrames, grabActionDuration, grabContactFrame, isAerialAttack, smashDamageMultiplier } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { LICH_MOVES } from "./lichMoves";

// Adopted Lich rows from smashcraft:docs/design/roster.md, including final L.
const NORMALS = [
  [AttackStyle.jab, 6, 2, 16, 0],
  [AttackStyle.forwardTilt, 10, 3, 23, 0],
  [AttackStyle.forwardTiltUp, 10, 3, 23, 0],
  [AttackStyle.forwardTiltDown, 10, 3, 23, 0],
  [AttackStyle.upTilt, 9, 4, 23, 0],
  [AttackStyle.downTilt, 8, 3, 20, 0],
  [AttackStyle.dashAttack, 12, 5, 29, 0],
  [AttackStyle.forwardSmash, 22, 3, 36, 0],
  [AttackStyle.upSmash, 20, 5, 34, 0],
  [AttackStyle.downSmash, 19, 5, 35, 0],
  [AttackStyle.neutralAir, 9, 6, 23, 16],
  [AttackStyle.forwardAir, 12, 3, 27, 17],
  [AttackStyle.backAir, 10, 3, 25, 15],
  [AttackStyle.upAir, 8, 4, 23, 14],
  [AttackStyle.downAir, 16, 4, 31, 22],
  [AttackStyle.grab, 10, 2, 28, 0],
] as const;

// Existing actors exercise the production move seam without depending on
// the parent's character-selection and presentation integration.
function attackPair(style: AttackStyle, x: number, z = 0.0, facing = 1, targetGrounded = true) {
  const owner = createFighter(Character.archer, 0.0, facing);
  owner.tuning.moves = LICH_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  const target = createFighter(Character.archer, f32(x * facing), -facing);
  target.motion.z = z;
  target.motion.grounded = targetGrounded;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  assertEquals(owner.attack.style, style);
  owner.attack.frame = attackStartupFrames(style, LICH_MOVES);
  return { owner, target, world };
}

test("Lich normal phases contact windows and final landing lag match the adopted roster", () => {
  const out = emptyHitRegion();
  for (const [style, first, active, recovery, landing] of NORMALS) {
    const { owner } = attackPair(style, 1000.0);
    assertEquals(owner.attack.duration, first - 1 + active + recovery);
    assertEquals(attackStartupFrames(style, LICH_MOVES), first - 1);
    assertEquals(attackRecoveryFrames(owner.character, style, owner.motion.grounded, LICH_MOVES), recovery);
    assertEquals(attackLandingLag(style, LICH_MOVES), landing);
    owner.attack.frame = first - 2;
    assertEquals(attackPhase(owner), AttackPhase.startup);
    owner.attack.frame++;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame = first + active - 2;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame++;
    assertEquals(attackPhase(owner), AttackPhase.recovery);
    const count = authoredHitRegionCount(style, LICH_MOVES);
    assertGreaterThan(count, 0);
    for (let tick = 0; tick < owner.attack.duration; tick++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, owner.character, style, tick, 0, index, LICH_MOVES);
        if (out.window <= 0) continue;
        live++;
        assertEquals(out.window, 1);
        assertTrue(out.strike !== undefined);
      }
      assertEquals(live > 0, tick >= first - 1 && tick < first - 1 + active);
    }
  }
});

test("Lich normals deal their adopted damage only after startup in both facings", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, z, damage] of [
      [AttackStyle.jab, 50.0, 0.0, 3.0],
      [AttackStyle.forwardTilt, 80.0, 0.0, 8.0],
      [AttackStyle.upTilt, 35.0, 0.0, 8.0],
      [AttackStyle.downTilt, 90.0, 0.0, 6.0],
      [AttackStyle.dashAttack, 35.0, 0.0, 10.0],
      [AttackStyle.forwardSmash, 170.0, 0.0, 18.0],
      [AttackStyle.upSmash, 0.0, 0.0, 17.0],
      [AttackStyle.downSmash, 130.0, 0.0, 14.0],
      [AttackStyle.neutralAir, 95.0, 0.0, 8.0],
      [AttackStyle.forwardAir, 130.0, 0.0, 11.0],
      [AttackStyle.backAir, -90.0, 0.0, 12.0],
      [AttackStyle.upAir, 0.0, 0.0, 9.0],
      [AttackStyle.downAir, 0.0, -120.0, 12.0],
    ] as const) {
      const { owner, target, world } = attackPair(style, x, z, facing, !isAerialAttack(style));
      owner.attack.frame--;
      resolveAttacks(world);
      assertEquals(target.status.damage, 0.0);
      owner.attack.frame++;
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      if (style === AttackStyle.backAir) assertLessThan(f32(target.launch.knockbackX * facing), 0.0);
    }
  }
});

test("Lich thin spear crown star and angled palms retain punishable gaps", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, z] of [
      [AttackStyle.jab, 110.0, 0.0],
      [AttackStyle.forwardSmash, 150.0, 90.0],
      [AttackStyle.upTilt, 20.0, -100.0],
      [AttackStyle.upSmash, 70.0, 0.0],
      [AttackStyle.upAir, 60.0, 0.0],
      [AttackStyle.backAir, 90.0, 0.0],
    ] as const) {
      const pair = attackPair(style, x, z, facing);
      resolveAttacks(pair.world);
      assertEquals(pair.target.status.damage, 0.0);
    }
    const high = attackPair(AttackStyle.forwardTiltUp, 95.0, 60.0, facing);
    resolveAttacks(high.world);
    assertEquals(high.target.status.damage, 8.0);
    const lowMiss = attackPair(AttackStyle.forwardTiltDown, 95.0, 60.0, facing);
    resolveAttacks(lowMiss.world);
    assertEquals(lowMiss.target.status.damage, 0.0);
    const low = attackPair(AttackStyle.forwardTiltDown, 95.0, -90.0, facing);
    resolveAttacks(low.world);
    assertEquals(low.target.status.damage, 8.0);
    const highMiss = attackPair(AttackStyle.forwardTiltUp, 95.0, -90.0, facing);
    resolveAttacks(highMiss.world);
    assertEquals(highMiss.target.status.damage, 0.0);
  }
});

test("Lich attached falling crystal spikes airborne targets and lifts grounded targets", () => {
  for (const facing of [-1, 1]) {
    for (const grounded of [false, true]) {
      const { target, world } = attackPair(AttackStyle.downAir, 0.0, -120.0, facing, grounded);
      resolveAttacks(world);
      assertEquals(target.status.damage, 12.0);
      if (grounded) {
        assertGreaterThan(target.launch.knockbackZ, 0.0);
        assertNear(f32(target.launch.knockbackZ / f32(target.launch.knockbackX * facing)), f32(f32(0.819152044) / f32(0.573576436)), f32(0.00001));
      } else {
        assertEquals(target.launch.knockbackX, 0.0);
        assertLessThan(target.launch.knockbackZ, 0.0);
      }
    }
  }
});

test("Lich Grave Frost hits once across both floor bursts and sends the rear hit backward", () => {
  for (const facing of [-1, 1]) {
    const pair = attackPair(AttackStyle.downSmash, 100.0, 0.0, facing);
    resolveAttacks(pair.world);
    assertEquals(pair.target.status.damage, 14.0);
    pair.owner.launch.hitlag = 0;
    pair.target.launch.hitlag = 0;
    pair.target.motion.x = f32(-100.0 * facing);
    pair.target.motion.z = 0.0;
    pair.owner.attack.frame++;
    resolveAttacks(pair.world);
    assertEquals(pair.target.status.damage, 14.0);
    const rear = attackPair(AttackStyle.downSmash, -100.0, 0.0, facing);
    resolveAttacks(rear.world);
    assertEquals(rear.target.status.damage, 14.0);
    assertLessThan(f32(rear.target.launch.knockbackX * facing), 0.0);
  }
});

test("Lich dash attack selects Cold Drift and smash charge caps at 45 frames", () => {
  const owner = createFighter(Character.archer, 0.0, 1);
  owner.tuning.moves = LICH_MOVES;
  owner.ground.dashFrame = 1;
  beginFighterAttack(testWorld(owner, createFighter(Character.archer, 1000.0, -1)), 0, AttackStyle.jab, false);
  assertEquals(owner.attack.style, AttackStyle.dashAttack);
  assertEquals(owner.attack.duration, 45);
  assertEquals(LICH_MOVES.normals[AttackStyle.dashAttack]?.startupTravelX, f32(HERO_REFERENCE_HEIGHT * f32(0.45)));
  assertEquals(smashDamageMultiplier(0, LICH_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(45, LICH_MOVES), 1.25);
  assertEquals(smashDamageMultiplier(90, LICH_MOVES), 1.25);
  const out = emptyHitRegion();
  authoredHitRegion(out, Character.archer, AttackStyle.forwardSmash, 21, 45, 0, LICH_MOVES);
  assertEquals(out.effect.damage, 22.5);
});

test("Lich spectral grab catches shield on either active tick at its adopted reach", () => {
  const reach = f32(HERO_REFERENCE_HEIGHT * f32(0.70));
  for (const facing of [-1, 1]) {
    for (const tick of [9, 10]) {
      for (const [x, caught] of [[reach, true], [f32(reach + 1.0), false]] as const) {
        const pair = attackPair(AttackStyle.grab, x, 0.0, facing);
        pair.target.shield.raised = true;
        pair.owner.attack.frame = tick;
        resolveAttacks(pair.world);
        assertEquals(pair.owner.grab.target !== undefined, caught);
        assertEquals(pair.target.grab.owner !== undefined, caught);
        assertEquals(pair.target.status.damage, 0.0);
      }
    }
    const owner = createFighter(Character.archer, 0.0, facing);
    owner.tuning.moves = LICH_MOVES;
    owner.ground.dashFrame = 1;
    const target = createFighter(Character.archer, f32(reach * facing), -facing);
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, DASH_GRAB_REQUEST, false);
    assertTrue(owner.attack.dashGrab);
    assertEquals(owner.attack.duration, 50);
    owner.attack.frame = 11;
    resolveAttacks(world);
    assertEquals(owner.grab.target, undefined);
    owner.attack.frame++;
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
  }
});

test("Lich throws release once on their adopted frames with facing-relative directions", () => {
  for (const facing of [-1, 1]) {
    for (const [action, release, recovery, damage, x, z] of [
      [GrabAction.throwForward, 14, 23, 7.0, f32(0.819152044), f32(0.573576436)],
      [GrabAction.throwBack, 18, 26, 8.0, -f32(0.766044443), f32(0.642787610)],
      [GrabAction.throwUp, 17, 25, 7.0, 0.0, 1.0],
      [GrabAction.throwDown, 19, 26, 6.0, f32(0.258819045), f32(0.965925826)],
    ] as const) {
      const { owner, target, world } = attackPair(AttackStyle.grab, 60.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(grabContactFrame(action, LICH_MOVES), release);
      assertEquals(grabActionDuration(action, LICH_MOVES), release + recovery);
      const effect = LICH_MOVES.throws[action]?.effect;
      assertTrue(effect !== undefined);
      if (effect === undefined) continue;
      assertEquals(effect.damage, damage);
      assertNear(effect.launchX, x, f32(0.000001));
      assertNear(effect.launchZ, z, f32(0.000001));
      const input = controls({
        grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0,
        grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0,
      });
      for (let tick = 1; tick <= release; tick++) {
        testGrabFrame(world, [input, controls()], false);
        assertEquals(owner.grab.action, action);
        assertEquals(target.status.damage, tick < release ? 0.0 : damage);
        assertEquals(target.grab.owner, tick < release ? 0 : undefined);
      }
      assertEquals(owner.grab.target, undefined);
      assertTrue(target.launch.throwHitstun);
      assertGreaterThan(target.launch.hitstun, 0);
      assertGreaterThan(target.launch.knockbackZ, 0.0);
      const outward = f32(target.launch.knockbackX * facing);
      if (action === GrabAction.throwUp) assertEquals(outward, 0.0);
      else if (action === GrabAction.throwBack) assertLessThan(outward, 0.0);
      else assertGreaterThan(outward, 0.0);
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, damage);
    }
  }
});

test("Lich's casting arm extends the body while the conjured frost beyond the hand stays disjoint", () => {
  // A rifleman jab (slot 0) against Lich's forward smash on its first active frame.
  const challenge = (x: number, lichFrame: number): number => {
    const attacker = createFighter(Character.rifleman, 0.0, 1);
    const lich = createFighter(Character.archer, x, -1);
    lich.tuning.moves = LICH_MOVES;
    const world = testWorld(attacker, lich);
    beginFighterAttack(world, 0, AttackStyle.jab, false);
    attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
    lich.attack.style = AttackStyle.forwardSmash;
    lich.attack.frame = lichFrame;
    lich.attack.duration = 60;
    resolveAttacks(world);
    return lich.status.damage;
  };
  const standing = (): number => {
    for (let x = 60.0; x < 400.0; x += 2.0) if (challenge(x, 40) === 0.0) return x;
    return 400.0;
  };
  const extended = (): number => {
    for (let x = 60.0; x < 400.0; x += 2.0) if (challenge(x, 21) === 0.0) return x;
    return 400.0;
  };
  // The arm adds reach for the challenger, but far less than the spear's XL tip.
  assertGreaterThan(extended(), standing());
  assertLessThan(f32(extended() - standing()), f32(HERO_REFERENCE_HEIGHT * f32(0.5)));
  assertEquals(fighterHurtParts(createFighter(Character.archer, 0.0, 1)).length, 1);
  const lich = createFighter(Character.archer, 0.0, 1);
  lich.tuning.moves = LICH_MOVES;
  for (const style of [AttackStyle.forwardTilt, AttackStyle.forwardSmash, AttackStyle.forwardAir, AttackStyle.grab]) {
    lich.attack.style = style;
    lich.attack.frame = attackStartupFrames(style, LICH_MOVES);
    let bodyFront = 0.0;
    for (const part of fighterHurtParts(lich)) bodyFront = Math.max(bodyFront, part.x1 + part.radius, part.x2 + part.radius);
    const out = emptyHitRegion();
    let strikeFront = 0.0;
    for (let index = 0; index < authoredHitRegionCount(style, LICH_MOVES); index++) {
      authoredHitRegion(out, lich.character, style, lich.attack.frame, 0, index, LICH_MOVES);
      if (out.window > 0) strikeFront = Math.max(strikeFront, out.maxX);
    }
    assertGreaterThan(strikeFront, f32(bodyFront + 10.0));
  }
});
