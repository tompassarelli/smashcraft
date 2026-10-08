import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, DownState, GrabAction, SpecialAction } from "../codes";
import { createFighter } from "../fighter";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { beginAttack, beginDownState } from "../transitions";
import { isAerialAttack } from "../moves";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { GROM_MOVES } from "./gromMoves";
import { GROM_SPECIALS } from "./gromSpecials";

test("Grom's axe hits once at each authored contact, misses outside its reach, and preserves the startup window in both facings [spec #340]", () => {
  for (const style of [AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.getupAttack, AttackStyle.ledgeAttack]) {
    const move = GROM_MOVES.normals[style]; assertTrue(move !== undefined); if (move === undefined) continue;
    const region = move.regions[0], strike = region?.hit.strike; assertTrue(region !== undefined && strike !== undefined); if (region === undefined || strike === undefined) continue;
    for (const facing of [-1, 1]) for (const near of [true, false]) {
      const owner = createFighter(Character.grom, 0.0, facing), target = createFighter(Character.rifleman, f32((near ? strike.x2 : 1000.0) * facing), -facing);
      owner.motion.grounded = !isAerialAttack(style); target.motion.z = f32(strike.z2 - 60.0);
      const world = testWorld(owner, target);
      if (style === AttackStyle.getupAttack) beginDownState(owner, DownState.attack, 0); else if (style === AttackStyle.ledgeAttack) beginAttack(owner, style, false); else beginFighterAttack(world, 0, style, false);
      owner.attack.frame = region.firstFrame - 1; resolveAttacks(world); assertEquals(target.status.damage, 0.0, `early ${style}`);
      owner.attack.frame++; resolveAttacks(world); assertEquals(target.status.damage > 0.0, near, `reach ${style}`);
      const damage = target.status.damage; resolveAttacks(world); assertEquals(target.status.damage, damage, `repeat ${style}`);
    }
  }
});

test("Grom grabs a shield and releases all four throws once in both facings [spec #340]", () => {
  for (const facing of [-1, 1]) for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const spec = GROM_MOVES.throws[action]; assertTrue(spec !== undefined); if (spec === undefined) continue;
    const owner = createFighter(Character.grom, 0.0, facing), target = createFighter(Character.rifleman, 52.0 * facing, -facing); target.shield.raised = true;
    const world = testWorld(owner, target); beginFighterAttack(world, 0, AttackStyle.grab, false); owner.attack.frame = 7; resolveAttacks(world); assertEquals(owner.grab.target, 1);
    const input = controls({ grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0, grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0 });
    for (let frame = 1; frame <= spec.contactFrame; frame++) testGrabFrame(world, [input, controls()], false);
    assertEquals(target.status.damage, spec.effect.damage); assertEquals(target.grab.owner, undefined); assertGreaterThan(target.launch.knockbackZ, 0.0);
    if (action === GrabAction.throwBack) assertLessThan(f32(target.launch.knockbackX * facing), 0.0);
  }
});

test("Grom starts all four free specials with an empty bar and every EX spends one full universal bar [spec #335]", () => {
  for (const [x, z, action, kit] of [[0, 0, SpecialAction.heroNeutral, GROM_SPECIALS.neutral], [1, 0, SpecialAction.heroSide, GROM_SPECIALS.side], [0, 1, SpecialAction.heroUp, GROM_SPECIALS.up], [0, -1, SpecialAction.heroDown, GROM_SPECIALS.down]] as const) {
    assertTrue(kit !== undefined); if (kit === undefined) continue;
    for (const ex of [false, true]) {
      const owner = createFighter(Character.grom, 0.0, 1); owner.motion.grounded = true; owner.motion.surface = 0; owner.mana.points = ex ? 100 : 0;
      const input = controls({ specialPressed: true, specialX: x, specialZ: z, shield: ex });
      startFighterSpecial(owner, 0, 0, input); assertEquals(owner.special.action, action); assertEquals(owner.mana.points, 0); assertEquals(owner.special.ex, ex);
    }
  }
});

test("Grom's rush stops at shields and Blood Leap ends helpless with the aerial jump spent [spec #340]", () => {
  const owner = createFighter(Character.grom, 0.0, 1), target = createFighter(Character.rifleman, 140.0, -1);
  owner.motion.grounded = true; owner.motion.surface = 0; target.shield.raised = true;
  const world = testWorld(owner, target); startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialX: 1 }));
  for (let tick = 0; tick < 39; tick++) advanceSpecials(world, 0, 0, [controls(), controls({ shield: true })]);
  assertEquals(target.status.damage, 0.0); assertLessThan(owner.motion.x, target.motion.x);
  const recovering = createFighter(Character.grom, 0.0, 1); recovering.motion.z = 500.0; recovering.motion.grounded = false;
  const recoveryWorld = testWorld(recovering, target);
  startFighterSpecial(recovering, 0, 0, controls({ specialPressed: true, specialZ: 1 })); assertEquals(recovering.special.action, SpecialAction.heroUp);
  for (let tick = 0; tick < 36; tick++) advanceSpecials(recoveryWorld, 0, 0, [controls(), controls()]);
  assertTrue(recovering.special.fall); assertEquals(recovering.jump.remaining, 0);
});

test("Grom's four specials hit at their authored contacts in ground and air, both facings [spec #340]", () => {
  for (const facing of [-1, 1]) for (const air of [false, true]) for (const [x, z, targetX, targetZ, damage, contact] of [
    [0, 0, 44.0, 0.0, 6.300000190734863, 12], [1, 0, 104.0, 0.0, 10.800000190734863, 10], [0, 1, 12.0, 96.0, 8.100000381469727, 7], [0, -1, 124.0, 0.0, 19.799999237060547, 20],
  ] as const) {
    const owner = createFighter(Character.grom, 0.0, facing), target = createFighter(Character.rifleman, targetX * facing, -facing);
    owner.motion.grounded = !air; owner.motion.surface = 0; target.motion.grounded = false; target.motion.z = targetZ;
    const world = testWorld(owner, target);
    startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialX: x * facing, specialZ: z }));
    for (let frame = 1; frame < contact; frame++) advanceSpecials(world, 0, 0, [controls(), controls()]);
    assertEquals(target.status.damage, 0.0);
    advanceSpecials(world, 0, 0, [controls(), controls()]); assertEquals(target.status.damage, damage);
    owner.launch.hitlag = 0; target.launch.hitlag = 0; advanceSpecials(world, 0, 0, [controls(), controls()]); assertEquals(target.status.damage, damage);
  }
});
