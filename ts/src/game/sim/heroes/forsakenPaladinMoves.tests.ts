import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "../codes";
import { attackPhase } from "../conditions";
import { createFighter } from "../fighter";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackLandingLag, attackRecoveryFrames, attackStartupFrames, grabActionDuration, grabContactFrame, isAerialAttack, smashDamageMultiplier } from "../moves";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type HurtPart, HurtContact, HurtState, fighterHurtParts, strikeHurtContact } from "../hurtboxes";
import { emptyCapsule, placeCapsule } from "../../physics/contactGeometry";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { FORSAKEN_PALADIN_MOVES } from "./forsakenPaladinMoves";



const NORMAL_TIMINGS = [
  [AttackStyle.forwardSmash, 21, 3, 36, 0],
  [AttackStyle.upSmash, 18, 4, 33, 0],
  [AttackStyle.neutralAir, 8, 5, 23, 15],
  [AttackStyle.forwardAir, 13, 4, 28, 18],
  [AttackStyle.backAir, 9, 3, 24, 14],
  [AttackStyle.upAir, 8, 4, 23, 14],
  [AttackStyle.downAir, 15, 4, 31, 22],
  [AttackStyle.grab, 8, 3, 24, 0],
] as const;

function attackPair(style: AttackStyle, frame: number, targetX: number, targetZ = 0.0, facing = 1, groundedTarget = true) {
  const owner = createFighter(Character.rifleman, 0.0, facing);
  owner.tuning.moves = FORSAKEN_PALADIN_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  const target = createFighter(Character.rifleman, f32(targetX * facing), -facing);
  target.motion.z = targetZ;
  target.motion.grounded = groundedTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  assertEquals(owner.attack.style, style);
  owner.attack.frame = frame;
  owner.attack.cooldown = owner.attack.duration - frame;
  return { owner, target, world };
}

test("Forsaken Paladin production phases and final aerial landings match the adopted roster [spec #96]", () => {
  for (const [style, first, active, recovery, landing] of NORMAL_TIMINGS) {
    const { owner } = attackPair(style, 0, 1000.0);
    assertEquals(owner.attack.duration, first - 1 + active + recovery);
    assertEquals(attackStartupFrames(style, owner.tuning.moves), first - 1);
    assertEquals(attackRecoveryFrames(owner.character, style, owner.motion.grounded, owner.tuning.moves), recovery);
    assertEquals(attackLandingLag(style, owner.tuning.moves), landing);
    owner.attack.frame = first - 2;
    assertEquals(attackPhase(owner), AttackPhase.startup);
    owner.attack.frame = first - 1;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame = first + active - 2;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame++;
    assertEquals(attackPhase(owner), AttackPhase.recovery);
  }
});

test("Forsaken Paladin contact paths cover only the adopted active frames with one shared hit window [spec #96]", () => {
  const region = emptyHitRegion();
  for (const [style, first, active, recovery] of NORMAL_TIMINGS) {
    const count = authoredHitRegionCount(style, FORSAKEN_PALADIN_MOVES);
    assertGreaterThan(count, 0);
    for (let actionFrame = 0; actionFrame < first + active + recovery; actionFrame++) {
      let contacts = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(region, Character.rifleman, style, actionFrame, 0, index, FORSAKEN_PALADIN_MOVES);
        if (region.window > 0) {
          contacts++;
          assertEquals(region.window, 1);
          assertTrue(style === AttackStyle.grab ? region.maxX === SHARED_GRAB_REGION.maxX && region.strike === undefined : region.strike !== undefined);
        }
      }
      assertEquals(contacts > 0, actionFrame >= first - 1 && actionFrame < first - 1 + active);
    }
  }
});

test("Forsaken Paladin Final Judgment prioritizes its hammer head and preserves the weaker close handle [spec #96]", () => {
  for (const facing of [1, -1]) {
    for (const [x, damage] of [[120.0, 20.0], [40.0, 15.0]] as const) {
      const { owner, target, world } = attackPair(AttackStyle.forwardSmash, 21, x, 0.0, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      assertGreaterThan(target.launch.knockbackX * facing, 0.0);
      owner.launch.hitlag = 0;
      owner.attack.frame = 22;
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
    }
  }
});

test("Forsaken Paladin Consecrated Sweep and Hammer Guard hit once across their front and back paths [spec #96]", () => {
  for (const facing of [1, -1]) {
    for (const [style, frontFrame, backFrame, damage] of [
      [AttackStyle.downSmash, 17, 20, 15.0],
      [AttackStyle.neutralAir, 8, 10, 9.0],
    ] as const) {
      const { owner, target, world } = attackPair(style, frontFrame, 85.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      target.motion.x = f32(-85.0 * facing);
      owner.launch.hitlag = 0;
      owner.attack.frame = backFrame;
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      const back = attackPair(style, backFrame, -85.0, 0.0, facing);
      resolveAttacks(back.world);
      assertEquals(back.target.status.damage, damage);
      assertLessThan(back.target.launch.knockbackX * facing, 0.0);
    }
  }
});

test("Forsaken Paladin Falling Judgment spikes airborne targets and launches grounded targets at 55 degrees [spec #96]", () => {
  for (const facing of [1, -1]) {
    for (const grounded of [false, true]) {
      const { target, world } = attackPair(AttackStyle.downAir, 15, 8.0, -85.0, facing, grounded);
      resolveAttacks(world);
      assertEquals(target.status.damage, 13.0);
      if (grounded) {
        assertGreaterThan(target.launch.knockbackX * facing, 0.0);
        assertGreaterThan(target.launch.knockbackZ, 0.0);
        assertNear(f32(target.launch.knockbackZ / f32(target.launch.knockbackX * facing)), f32(1.4281480067421144), f32(0.0001));
      } else {
        assertEquals(target.launch.knockbackX, 0.0);
        assertLessThan(target.launch.knockbackZ, 0.0);
      }
    }
  }
});

test("Forsaken Paladin's overhead hammer arc is one move for every angle, from above his head to the floor, and leaves gaps [spec #96]", () => {
  const high = emptyHitRegion();
  const low = emptyHitRegion();
  authoredHitRegion(high, Character.rifleman, AttackStyle.forwardTilt, 10, 0, 0, FORSAKEN_PALADIN_MOVES);
  authoredHitRegion(low, Character.rifleman, AttackStyle.forwardTilt, 12, 0, 2, FORSAKEN_PALADIN_MOVES);
  assertGreaterThan(high.maxZ, 140.0);
  assertLessThan(low.minZ, 0.0);
  const gap = attackPair(AttackStyle.upSmash, 19, 85.0, 0.0);
  resolveAttacks(gap.world);
  assertEquals(gap.target.status.damage, 0.0);
});

const segmentDistance = (px: number, pz: number, part: Readonly<HurtPart>): number => {
  const dx = part.x2 - part.x1;
  const dz = part.z2 - part.z1;
  const length = dx * dx + dz * dz;
  const t = length === 0.0 ? 0.0 : Math.max(0.0, Math.min(1.0, ((px - part.x1) * dx + (pz - part.z1) * dz) / length));
  const ex = px - (part.x1 + t * dx);
  const ez = pz - (part.z1 + t * dz);
  return Math.sqrt(ex * ex + ez * ez);
};

test("Forsaken Paladin's gauntlet, boot and grabbing hand strike from inside his own exposed body [spec #96]", () => {
  const region = emptyHitRegion();
  for (const style of [AttackStyle.jab, AttackStyle.backAir, AttackStyle.grab]) {
    const owner = createFighter(Character.rifleman, 0.0, 1);
    owner.tuning.moves = FORSAKEN_PALADIN_MOVES;
    owner.attack.style = style;
    const count = authoredHitRegionCount(style, FORSAKEN_PALADIN_MOVES);
    for (let frame = 0; frame < 40; frame++) {
      owner.attack.frame = frame;
      const parts = fighterHurtParts(owner);
      for (let index = 0; index < count; index++) {
        authoredHitRegion(region, Character.rifleman, style, frame, 0, index, FORSAKEN_PALADIN_MOVES);
        const strike = region.strike;
        if (region.window === 0 || strike === undefined) continue;
        for (const [x, z] of [[strike.x1, strike.z1], [strike.x2, strike.z2]] as const) {
          assertTrue(parts.some((part) => (part.state ?? HurtState.normal) === HurtState.normal && segmentDistance(x, z, part) <= part.radius));
        }
      }
    }
  }
});

test("Forsaken Paladin's extended limbs are hittable at their full reach and gone once he stands [spec #96]", () => {
  const reach = (style: AttackStyle, frame: number, x: number, z: number, facing: number): boolean => {
    const owner = createFighter(Character.rifleman, 0.0, facing);
    owner.tuning.moves = FORSAKEN_PALADIN_MOVES;
    if (frame >= 0) {
      owner.attack.style = style;
      owner.attack.frame = frame;
    }
    return strikeHurtContact(placeCapsule(emptyCapsule(), { x1: x, z1: z, x2: x, z2: z, radius: 4.0 }, 0.0, 0.0, facing), owner) === HurtContact.hit;
  };
  const short = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
  const medium = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
  for (const facing of [1, -1]) {
    for (const [style, frame, x, z] of [
      [AttackStyle.jab, 4, f32(short + 2.0), 60.0],
      [AttackStyle.grab, 7, f32(short + 2.0), 40.0],
      [AttackStyle.backAir, 9, -f32(medium + 2.0), 30.0],
    ] as const) {
      assertTrue(reach(style, frame, x, z, facing));
      assertTrue(!reach(style, -1, x, z, facing));
    }
  }
});

test("Forsaken Paladin standing and dash grabs use scaled standing and dash reach with authored whiff timing [spec #337]", () => {
  const reach = 96.0;
  for (const facing of [1, -1]) {
    for (const [x, caught] of [[reach, true], [f32(reach + 1.0), false]] as const) {
      const standing = attackPair(AttackStyle.grab, 7, x, 0.0, facing);
      standing.target.shield.raised = true;
      resolveAttacks(standing.world);
      assertEquals(standing.owner.grab.target !== undefined, caught);
      const owner = createFighter(Character.rifleman, 0.0, facing);
      owner.tuning.moves = FORSAKEN_PALADIN_MOVES;
      owner.ground.dashFrame = 1;
      const target = createFighter(Character.rifleman, f32((x === reach ? 120.0 : 121.0) * facing), -facing);
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, DASH_GRAB_REQUEST, false);
      assertEquals(owner.attack.style, AttackStyle.grab);
      assertTrue(owner.attack.dashGrab);
      assertEquals(owner.attack.duration, 45);
      owner.attack.frame = 9;
      assertEquals(attackPhase(owner), AttackPhase.startup);
      resolveAttacks(world);
      assertEquals(owner.grab.target, undefined);
      owner.attack.frame = 10;
      assertEquals(attackPhase(owner), AttackPhase.active);
      resolveAttacks(world);
      assertEquals(owner.grab.target !== undefined, caught);
    }
    const owner = createFighter(Character.rifleman, 0.0, facing);
    owner.tuning.moves = FORSAKEN_PALADIN_MOVES;
    owner.ground.dashFrame = 1;
    beginFighterAttack(testWorld(owner, createFighter(Character.rifleman, 1000.0, -facing)), 0, AttackStyle.jab, false);
    assertEquals(owner.attack.style, AttackStyle.dashAttack);
  }
  assertEquals(smashDamageMultiplier(0, FORSAKEN_PALADIN_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(45, FORSAKEN_PALADIN_MOVES), 1.25);
  assertEquals(smashDamageMultiplier(100, FORSAKEN_PALADIN_MOVES), 1.25);
});

const THROW_ROWS = [
  [GrabAction.throwForward, 14, 23, 8.0, 40],
  [GrabAction.throwBack, 18, 26, 9.0, 40],
  [GrabAction.throwUp, 16, 9, 7.0, 90],
  [GrabAction.throwDown, 20, 26, 6.0, 25],
] as const;

test("Forsaken Paladin throws hold until release and launch once in the adopted facing-relative direction [spec #96]", () => {
  for (const facing of [1, -1]) {
    for (const [action, release, recovery, damage, angle] of THROW_ROWS) {
      const { owner, target, world } = attackPair(AttackStyle.grab, 7, 40.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(grabContactFrame(action, owner.tuning.moves), release);
      assertEquals(grabActionDuration(action, owner.tuning.moves), release + recovery);
      const input = controls({
        grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0,
        grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0,
      });
      for (let tick = 1; tick < release; tick++) {
        testGrabFrame(world, [input, controls()], false);
        assertEquals(owner.grab.action, action);
        assertEquals(target.grab.owner, 0);
        assertEquals(target.status.damage, 0.0);
      }
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.grab.owner, undefined);
      assertEquals(owner.grab.target, undefined);
      assertEquals(target.status.damage, damage);
      assertTrue(target.launch.throwHitstun);
      assertGreaterThan(target.launch.hitstun, 0);
      assertGreaterThan(target.launch.knockbackZ, 0.0);
      if (angle === 90) assertEquals(target.launch.knockbackX, 0.0);
      else if (action === GrabAction.throwBack) assertLessThan(target.launch.knockbackX * facing, 0.0);
      else assertGreaterThan(target.launch.knockbackX * facing, 0.0);
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, damage);
    }
  }
});
