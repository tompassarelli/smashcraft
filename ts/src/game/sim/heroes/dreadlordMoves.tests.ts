import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction, HitElement } from "../codes";
import { attackPhase } from "../conditions";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackStartupFrames, grabActionDuration, grabContactFrame, isAerialAttack, smashDamageMultiplier } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { DREADLORD_MOVES } from "./dreadlordMoves";
import { isMultiHit } from "./multiHit";

// Existing actors carry the kit so these fixtures exercise production combat
// independently of selection and asset integration.
const NORMAL_TIMINGS = [
  [AttackStyle.forwardSmash, 18, 4, 34, 0],
  [AttackStyle.upSmash, 16, 5, 31, 0],
  [AttackStyle.downSmash, 15, 6, 20, 0],
  [AttackStyle.neutralAir, 7, 10, 19, 11],
  [AttackStyle.forwardAir, 10, 4, 24, 10],
  [AttackStyle.backAir, 9, 4, 25, 10],
  [AttackStyle.upAir, 7, 3, 21, 12],
  [AttackStyle.downAir, 14, 4, 29, 20],
  [AttackStyle.grab, 7, 3, 26, 0],
] as const;

function attackPair(style: AttackStyle, frame: number, x: number, z = 0.0, facing = 1, groundedTarget = true) {
  const owner = createFighter(Character.rifleman, 0.0, facing);
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

test("Dreadlord production phases match the adopted roster [spec docs/design/roster.md]", () => {
  for (const [style, first, active] of NORMAL_TIMINGS) {
    const { owner } = attackPair(style, 0, 1000.0);
    assertEquals(attackStartupFrames(style, owner.tuning.moves), first - 1);
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

test("Dreadlord paths are narrow capsules active only on adopted contact frames [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  for (const [style, first, active, recovery] of NORMAL_TIMINGS) {
    const count = authoredHitRegionCount(style, DREADLORD_MOVES);
    assertGreaterThan(count, 0);
    for (let frame = 0; frame < first + active + recovery; frame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.rifleman, style, frame, 0, index, DREADLORD_MOVES);
        if (out.window > 0) {
          live++;
          assertTrue(out.window === 1 || (isMultiHit(DREADLORD_MOVES.normals[style]) && out.window > 1));
          assertTrue(style === AttackStyle.grab ? out.maxX === SHARED_GRAB_REGION.maxX && out.strike === undefined : out.strike !== undefined);
        }
      }
      // A multi-hit may pause between its hits; nothing strikes outside its active frames.
      if (live > 0 || !isMultiHit(DREADLORD_MOVES.normals[style])) assertEquals(live > 0, frame >= first - 1 && frame < first - 1 + active);
    }
  }
});

test("Dreadlord twin talons and front-rear wing sweep hit each target once [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const talons = attackPair(AttackStyle.forwardSmash, 17, 100.0, 0.0, facing);
    resolveAttacks(talons.world);
    const talonDamage = talons.target.status.damage;
    assertGreaterThan(talonDamage, 0.0);
    for (let frame = 18; frame <= 20; frame++) {
      talons.owner.launch.hitlag = 0;
      talons.owner.attack.frame = frame;
      resolveAttacks(talons.world);
      assertEquals(talons.target.status.damage, talonDamage);
    }
    const sweep = attackPair(AttackStyle.downSmash, 14, 100.0, 0.0, facing);
    resolveAttacks(sweep.world);
    const sweepDamage = sweep.target.status.damage;
    assertGreaterThan(sweepDamage, 0.0);
    sweep.target.motion.x = f32(-100.0 * facing);
    sweep.owner.launch.hitlag = 0;
    sweep.owner.attack.frame = 17;
    resolveAttacks(sweep.world);
    assertEquals(sweep.target.status.damage, sweepDamage);
    const back = attackPair(AttackStyle.downSmash, 17, -100.0, 0.0, facing);
    resolveAttacks(back.world);
    assertGreaterThan(back.target.status.damage, 0.0);
    assertLessThan(back.target.launch.knockbackX * facing, 0.0);
  }
});

test("Dreadlord wing backhand launches away from facing and talon drop converts grounded spikes [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const back = attackPair(AttackStyle.backAir, 8, -100.0, 0.0, facing, false);
    resolveAttacks(back.world);
    assertGreaterThan(back.target.status.damage, 0.0);
    assertLessThan(back.target.launch.knockbackX * facing, 0.0);
    for (const grounded of [false, true]) {
      const drop = attackPair(AttackStyle.downAir, 13, 12.0, -70.0, facing, grounded);
      resolveAttacks(drop.world);
      assertGreaterThan(drop.target.status.damage, 0.0);
      assertEquals(drop.target.launch.knockbackZ > 0.0, grounded);
      if (grounded) assertGreaterThan(drop.target.launch.knockbackX * facing, 0.0);
      else assertEquals(drop.target.launch.knockbackX, 0.0);
    }
  }
});

test("Dreadlord angled claws retain separate paths and horn lift leaves a lateral gap [spec docs/design/roster.md]", () => {
  const straight = emptyHitRegion();
  const up = emptyHitRegion();
  const down = emptyHitRegion();
  authoredHitRegion(straight, Character.rifleman, AttackStyle.forwardTilt, 8, 0, 1, DREADLORD_MOVES);
  authoredHitRegion(up, Character.rifleman, AttackStyle.forwardTiltUp, 8, 0, 1, DREADLORD_MOVES);
  authoredHitRegion(down, Character.rifleman, AttackStyle.forwardTiltDown, 8, 0, 1, DREADLORD_MOVES);
  assertGreaterThan(up.maxZ, straight.maxZ);
  assertLessThan(down.minZ, straight.minZ);
  assertGreaterThan(up.effect.launchZ, straight.effect.launchZ);
  assertLessThan(down.effect.launchZ, straight.effect.launchZ);
  const hornGap = attackPair(AttackStyle.upAir, 6, 72.0, 0.0, 1, false);
  resolveAttacks(hornGap.world);
  assertEquals(hornGap.target.status.damage, 0.0);
  assertEquals(smashDamageMultiplier(0, DREADLORD_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(45, DREADLORD_MOVES), 1.25);
  assertEquals(smashDamageMultiplier(100, DREADLORD_MOVES), 1.25);
});

test("Dreadlord shield grab and dash grab use scaled reach and whiff timing [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  authoredHitRegion(out, Character.rifleman, AttackStyle.grab, 6, 0, 0, DREADLORD_MOVES);
  assertNear(out.maxX, 96.0, f32(0.0001));
  for (const facing of [1, -1]) {
    const standing = attackPair(AttackStyle.grab, 6, 85.0, 0.0, facing);
    standing.target.shield.raised = true;
    resolveAttacks(standing.world);
    assertEquals(standing.owner.grab.target, 1);
    assertEquals(standing.target.status.damage, 0.0);
    const owner = createFighter(Character.rifleman, 0.0, facing);
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
  [GrabAction.throwForward, 12, 20],
  [GrabAction.throwBack, 18, 25],
  [GrabAction.throwUp, 15, 11],
  [GrabAction.throwDown, 19, 25],
] as const;

test("Dreadlord throws hold until the adopted release and launch once in both facings [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    for (const [action, release, recovery] of THROW_ROWS) {
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
        assertEquals(target.status.damage > 0.0, tick >= release);
      }
      assertEquals(owner.grab.target, undefined);
      assertTrue(target.launch.throwHitstun);
      assertGreaterThan(target.launch.hitstun, 0);
      assertGreaterThan(target.launch.knockbackZ, 0.0);
      if (action === GrabAction.throwBack) assertLessThan(target.launch.knockbackX * facing, 0.0);
      else assertGreaterThan(target.launch.knockbackX * facing, 0.0);
      const thrown = target.status.damage;
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, thrown);
    }
  }
});

/** Damage a Rifleman jab tip deals to a Dreadlord body posed at `style`/`frame`, with its limb pointing toward the jab. */
function jabIntoDreadlord(style: AttackStyle | undefined, frame: number, gap: number, behind = false): number {
  const attacker = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.rifleman, gap, behind ? 1 : -1);
  target.tuning.moves = DREADLORD_MOVES;
  const world = testWorld(attacker, target);
  beginFighterAttack(world, 0, AttackStyle.jab, false);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab, attacker.tuning.moves);
  target.attack.style = style;
  target.attack.frame = frame;
  resolveAttacks(world);
  return target.status.damage;
}

test("Dreadlord's extended arm and wing can be hit where his standing body cannot [spec docs/design/roster.md]", () => {
  // Rifleman's jab reaches past the standing body at this gap but not to it.
  const gap = 150.0;
  assertEquals(jabIntoDreadlord(undefined, 0, gap), 0.0);
  assertGreaterThan(jabIntoDreadlord(AttackStyle.forwardTilt, 8, gap), 0.0);
  assertGreaterThan(jabIntoDreadlord(AttackStyle.forwardAir, 9, gap), 0.0);
  // Well after recovery begins the arm is folded back.
  assertEquals(jabIntoDreadlord(AttackStyle.forwardTilt, 20, gap), 0.0);
  // Back air exposes the wing behind him.
  assertGreaterThan(jabIntoDreadlord(AttackStyle.backAir, 8, gap, true), 0.0);
});

test("an original fighter's throw after Dreadlord's shows its own hit element, not his claws' [repro #96]", () => {
  const throwOnce = (moves: typeof DREADLORD_MOVES | undefined) => {
    const { owner, target, world } = attackPair(AttackStyle.grab, 6, 50.0);
    owner.tuning.moves = moves;
    resolveAttacks(world);
    if (moves === undefined) {
      owner.grab.target = 1;
      target.grab.owner = 0;
      target.grab.grabbedFrames = 200;
    }
    const input = controls({ grabThrowX: 1 });
    for (let tick = 0; tick < 40 && target.grab.owner !== undefined; tick++) testGrabFrame(world, [input, controls()], false);
    return target.visuals.hitElement;
  };
  assertEquals(throwOnce(DREADLORD_MOVES), HitElement.slash);
  assertEquals(throwOnce(undefined), HitElement.normal);
});
