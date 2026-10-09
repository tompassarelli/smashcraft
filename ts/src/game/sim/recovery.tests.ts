

import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, DownState } from "./codes";
import {
  canAttack,
} from "./conditions";
import { DOWN_DAMAGE_FRAMES } from "./down";
import { type Fighter,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { attackStartupFrames } from "./moves";
import type { Roster } from "./roster";
import { advanceFighter } from "./step";
import { advanceSolo, controls, testBeginAttacks, testWorld } from "./testWorld";
import { AUTHORED_PHYSICS, type FighterPhysics, melee } from "./tuning";


const FLOOR_RECOVERY_REFERENCE_PHYSICS: FighterPhysics = { ...AUTHORED_PHYSICS.reference, traction: melee(0.07999999821186066) };


function downStateOf(fighter: Fighter): DownState {
  return fighter.down.state;
}

const RECORDED_TECH_POSITION =[-42.34517288208008, -42.67805099487305, -42.930931091308594, -43.10380935668945, -43.196685791015625, -43.209564208984375];
const RECORDED_TECH_KNOCKBACK = [
  -0.41287824511528015, -0.3328782618045807, -0.2528782784938812, -0.17287829518318176, -0.0928783044219017, -0.012878312729299068, 0.0,
];
const RECORDED_MISSED_TECH_POSITION = [-38.086673736572266, -38.44503402709961, -38.72339630126953];
const RECORDED_MISSED_TECH_KNOCKBACK = [-0.4383614957332611, -0.35836151242256165, -0.2783615291118622];

function recordedFloorRecoveryFirstDifference(character: Character, tech: boolean, velocityOffset: number): number {
  const fighter = createReferenceFighter(character, melee(tech ? -41.93229293823242 : -37.648311614990234), 1);
  fighter.tuning.physics = FLOOR_RECOVERY_REFERENCE_PHYSICS;
  fighter.down.state = tech ? DownState.tech : DownState.bound;
  fighter.down.frame = 1;
  fighter.launch.knockbackX = f32(melee(tech ? -0.492878258228302 : -0.5183614492416382) + velocityOffset);
  const damage = tech ? 25.0 : 42.5;
  fighter.status.damage = damage;
  const input = controls({ shield: true, direction: tech ? 0 : -1 });
  const positions = tech ? RECORDED_TECH_POSITION : RECORDED_MISSED_TECH_POSITION;
  const knockbacks = tech ? RECORDED_TECH_KNOCKBACK : RECORDED_MISSED_TECH_KNOCKBACK;
  let firstDifference = 0;
  for (let sample = 1; sample <= (tech ? 7 : 3); sample++) {
    advanceSolo(fighter, 0, input, 0.0);
    const position = positions[Math.min(sample, positions.length) - 1]!;
    if (firstDifference === 0 && (Math.abs(f32(fighter.motion.x - melee(position))) > 0.00009999999747378752
      || Math.abs(f32(fighter.launch.knockbackX - melee(knockbacks[sample - 1]!))) > 0.000009999999747378752
      || !fighter.motion.grounded || fighter.motion.vx !== 0 || fighter.launch.knockbackZ !== 0 || fighter.launch.hitlag !== 0
      || fighter.down.state !== (tech ? DownState.tech : DownState.bound) || fighter.down.frame !== sample + 1
      || fighter.status.damage !== damage || fighter.shield.raised || canAttack(fighter))) {
      firstDifference = (tech ? 203 : 955) + sample;
    }
  }
  return firstDifference;
}

test("recorded floor recovery skids match a tech and a missed tech on both original hosts [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    assertEquals(recordedFloorRecoveryFirstDifference(character, true, 0.0), 0);
    assertEquals(recordedFloorRecoveryFirstDifference(character, false, 0.0), 0);
  }
});

test("a floor recovery's entry preserves residual horizontal knockback [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (let recovery = 0; recovery <= 2; recovery++) {
      const fighter = createReferenceFighter(character, 0.0, 1);
      fighter.tuning.physics = FLOOR_RECOVERY_REFERENCE_PHYSICS;
      fighter.motion.grounded = false;
      fighter.motion.surface = undefined;
      fighter.motion.z = 1.0;
      fighter.motion.vz = -2.0;
      fighter.launch.knockbackX = melee(-0.5);
      fighter.launch.hitstun = 20;
      fighter.down.state = DownState.tumble;
      advanceSolo(fighter, 0, controls({ techPressed: recovery > 0, direction: recovery === 2 ? -1 : 0 }), 0.0);
      assertTrue(fighter.motion.grounded);
      assertEquals(fighter.down.state, recovery === 0 ? DownState.bound : recovery === 1 ? DownState.tech : DownState.techRoll);
      assertNear(fighter.launch.knockbackX, (-0.5 + f32(0.051)) * 6, f32(0.00001));
    }
  }
});


function weakRecoveryHit(world: Roster, direction: number, attacker: Fighter, target: Fighter): void {
  attacker.facing = direction;
  target.facing = -direction;
  target.motion.x = f32(direction * 50.0);
  target.motion.surface = 0;
  target.motion.grounded = true;
  target.down.state = DownState.wait;
  target.down.frame = 20;
  target.down.waitRemaining = 100;
  target.down.faceUp = false;
  testBeginAttacks(world, AttackStyle.forwardTilt, undefined);
  attacker.attack.frame = attackStartupFrames(AttackStyle.forwardTilt) + 1;
  resolveAttacks(world);
}

test("low damage during either grounded down pose starts down damage, in both facings [reference]", () => {
  for (const direction of [-1, 1]) {
    const attacker = createReferenceFighter(Character.sylvanas, 0.0, direction);
    const target = createReferenceFighter(Character.rifleman, f32(direction * 50.0), -direction);
    weakRecoveryHit(testWorld(attacker, target), direction, attacker, target);
    assertEquals(target.down.state, DownState.damage);
    assertEquals(target.down.frame, 1);
    assertTrue(target.motion.grounded);
    assertFalse(target.down.faceUp);
    assertEquals(target.launch.hitlag, 4);
  }
});

test("hitlag freezes down damage, then hitstun returns it to a timed down wait [reference]", () => {
  const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const target = createReferenceFighter(Character.rifleman, 50.0, -1);
  const world = testWorld(attacker, target);
  const input = controls();
  target.status.damage = 80.0;
  weakRecoveryHit(world, 1, attacker, target);
  assertEquals(target.down.state, DownState.damage);
  const damageFrame = target.down.frame;
  for (let tick = 1; tick <= 3; tick++) {
    advanceFighter(world, 1, 0, input, -240.0);
    assertEquals(target.down.frame, damageFrame);
    assertTrue(target.motion.grounded);
  }
  while (target.down.state === DownState.damage) advanceFighter(world, 1, 0, input, -240.0);
  assertEquals(target.down.state, DownState.wait);
  assertEquals(target.down.waitRemaining, target.launch.hitstun);
  assertGreaterThan(target.down.waitRemaining, 0);
  const remaining = target.down.waitRemaining;
  for (let tick = 1; tick <= remaining; tick++) advanceFighter(world, 1, 0, input, -240.0);
  assertEquals(target.down.state, DownState.stand);
});

test("seven damage interrupts a down recovery and doesn't jab reset [reference]", () => {
  const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const target = createReferenceFighter(Character.rifleman, 50.0, -1);
  const world = testWorld(attacker, target);
  target.down.state = DownState.wait;
  target.down.waitRemaining = 100;
  testBeginAttacks(world, AttackStyle.forwardTilt, undefined);
  attacker.attack.frame = attackStartupFrames(AttackStyle.forwardTilt);
  resolveAttacks(world);
  assertEquals(target.status.damage, 7.0);
  assertTrue(downStateOf(target) !== DownState.damage);
  assertFalse(target.motion.grounded);
});

test("down damage's completion checks get-up input without waiting another tick [reference]", () => {
  for (const host of [Character.sylvanas, Character.rifleman]) {
    const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const target = createReferenceFighter(host, 50.0, -1);
    const world = testWorld(attacker, target);
    const input = controls();
    target.status.damage = 80.0;
    weakRecoveryHit(world, 1, attacker, target);
    while (target.launch.hitlag > 1) advanceFighter(world, 1, 0, input, -240.0);
    for (let tick = 1; tick <= DOWN_DAMAGE_FRAMES - 1; tick++) {
      advanceFighter(world, 1, 0, input, -240.0);
      assertEquals(target.down.state, DownState.damage);
    }
    input.getupAttackPressed = true;
    advanceFighter(world, 1, 0, input, -240.0);
    assertEquals(target.down.state, DownState.attack);
  }
});

test("down damage ends in a stand when its hitstun expires during the animation [reference]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const input = controls();
  fighter.motion.surface = 0;
  fighter.motion.grounded = true;
  fighter.down.state = DownState.damage;
  fighter.down.frame = 1;
  fighter.launch.hitstun = 1;
  for (let tick = 1; tick <= DOWN_DAMAGE_FRAMES - 1; tick++) {
    advanceSolo(fighter, 0, input, -240.0);
    assertEquals(fighter.down.state, DownState.damage);
  }
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.down.state, DownState.stand);
  assertEquals(fighter.down.frame, 1);
});

test("a prone wait's expiry starts a stand before get-up input [reference]", () => {
  for (const remaining of [1, 2]) {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    fighter.motion.surface = 0;
    fighter.motion.grounded = true;
    fighter.down.state = DownState.wait;
    fighter.down.waitRemaining = remaining;
    advanceSolo(fighter, 0, controls({ getupAttackPressed: true }), -240.0);
    assertEquals(fighter.down.state, remaining === 1 ? DownState.stand : DownState.attack);
  }
});

