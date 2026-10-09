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
import { authoredThrowEffect } from "../grabs";



const NORMAL_TIMINGS = [
  AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.neutralAir, AttackStyle.forwardAir,
  AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.grab,
] as const;
const startup = (style: AttackStyle) => attackStartupFrames(style, FORSAKEN_PALADIN_MOVES);
const damageOf = (style: AttackStyle, region = 0) => FORSAKEN_PALADIN_MOVES.normals[style]?.regions[region]?.hit.effect.damage ?? -1.0;

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

test("Forsaken Paladin contact paths and attack phase agree on the authored active frames with one shared hit window [spec #96]", () => {
  const region = emptyHitRegion();
  for (const style of NORMAL_TIMINGS) {
    const count = authoredHitRegionCount(style, FORSAKEN_PALADIN_MOVES);
    assertGreaterThan(count, 0);
    const { owner } = attackPair(style, 0, 1000.0);
    for (let actionFrame = 0; actionFrame < owner.attack.duration; actionFrame++) {
      let contacts = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(region, Character.rifleman, style, actionFrame, 0, index, FORSAKEN_PALADIN_MOVES);
        if (region.window > 0) {
          contacts++;
          assertEquals(region.window, 1);
          assertTrue(style === AttackStyle.grab ? region.maxX === SHARED_GRAB_REGION.maxX && region.strike === undefined : region.strike !== undefined);
        }
      }
      owner.attack.frame = actionFrame;
      assertEquals(attackPhase(owner), contacts > 0 ? AttackPhase.active : actionFrame < startup(style) ? AttackPhase.startup : AttackPhase.recovery);
    }
  }
});

test("Forsaken Paladin Final Judgment prioritizes its hammer head and preserves the weaker close handle [spec #96]", () => {
  for (const facing of [1, -1]) {
    assertGreaterThan(damageOf(AttackStyle.forwardSmash, 0), damageOf(AttackStyle.forwardSmash, 3));
    for (const [x, damage] of [[120.0, damageOf(AttackStyle.forwardSmash, 0)], [40.0, damageOf(AttackStyle.forwardSmash, 3)]] as const) {
      const { owner, target, world } = attackPair(AttackStyle.forwardSmash, startup(AttackStyle.forwardSmash) + 1, x, 0.0, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      assertGreaterThan(target.launch.knockbackX * facing, 0.0);
      owner.launch.hitlag = 0;
      owner.attack.frame = startup(AttackStyle.forwardSmash) + 2;
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
    }
  }
});

test("Forsaken Paladin Consecrated Sweep and Hammer Guard hit once across their front and back paths [spec #96]", () => {
  for (const facing of [1, -1]) {
    for (const [style, frontOffset, backOffset] of [[AttackStyle.downSmash, 1, 4], [AttackStyle.neutralAir, 1, 3]] as const) {
      const frontFrame = startup(style) + frontOffset;
      const backFrame = startup(style) + backOffset;
      const damage = damageOf(style);
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
      const { target, world } = attackPair(AttackStyle.downAir, startup(AttackStyle.downAir) + 1, 8.0, -85.0, facing, grounded);
      resolveAttacks(world);
      assertEquals(target.status.damage, damageOf(AttackStyle.downAir));
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
  authoredHitRegion(high, Character.rifleman, AttackStyle.forwardTilt, startup(AttackStyle.forwardTilt), 0, 0, FORSAKEN_PALADIN_MOVES);
  authoredHitRegion(low, Character.rifleman, AttackStyle.forwardTilt, startup(AttackStyle.forwardTilt) + 2, 0, 2, FORSAKEN_PALADIN_MOVES);
  assertGreaterThan(high.maxZ, 140.0);
  assertLessThan(low.minZ, 0.0);
  const gap = attackPair(AttackStyle.upSmash, startup(AttackStyle.upSmash) + 2, 85.0, 0.0);
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
      [AttackStyle.jab, startup(AttackStyle.jab), f32(short + 2.0), 60.0],
      [AttackStyle.grab, startup(AttackStyle.grab), f32(short + 2.0), 40.0],
      [AttackStyle.backAir, startup(AttackStyle.backAir) + 1, -f32(medium + 2.0), 30.0],
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
      const standing = attackPair(AttackStyle.grab, startup(AttackStyle.grab), x, 0.0, facing);
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
  const full = FORSAKEN_PALADIN_MOVES.smashMaxChargeFrames;
  assertEquals(smashDamageMultiplier(0, FORSAKEN_PALADIN_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(full, FORSAKEN_PALADIN_MOVES), FORSAKEN_PALADIN_MOVES.smashMaxDamageMultiplier);
  assertEquals(smashDamageMultiplier(full + 55, FORSAKEN_PALADIN_MOVES), FORSAKEN_PALADIN_MOVES.smashMaxDamageMultiplier);
});

const THROW_ROWS = [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown] as const;

test("Forsaken Paladin throws hold until release and launch once in the adopted facing-relative direction [spec #96]", () => {
  for (const facing of [1, -1]) {
    for (const action of THROW_ROWS) {
      const release = grabContactFrame(action, FORSAKEN_PALADIN_MOVES);
      const damage = authoredThrowEffect(action, FORSAKEN_PALADIN_MOVES).damage;
      const { owner, target, world } = attackPair(AttackStyle.grab, startup(AttackStyle.grab), 40.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
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
      if (action === GrabAction.throwUp) assertEquals(target.launch.knockbackX, 0.0);
      else if (action === GrabAction.throwBack) assertLessThan(target.launch.knockbackX * facing, 0.0);
      else assertGreaterThan(target.launch.knockbackX * facing, 0.0);
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, damage);
    }
  }
});
