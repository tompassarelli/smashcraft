// Floor recovery: recorded tech and missed-tech skids, down damage (jab
// resets), get-up timing and protection.
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, DownState, ProjectileKind } from "./codes";
import {
  DOWN_ATTACK_INTANGIBLE_FRAMES_DOWN,
  DOWN_ATTACK_INTANGIBLE_FRAMES_UP,
  DOWN_RECOVERY_INTANGIBLE_FRAMES,
  DOWN_ROLL_INTANGIBLE_FRAMES_BACK_DOWN,
  DOWN_ROLL_INTANGIBLE_FRAMES_BACK_UP,
  canAttack,
  isIntangible,
} from "./conditions";
import { DOWN_BOUND_FRAMES, DOWN_DAMAGE_FRAMES, DOWN_ROLL_FRAMES, DOWN_STAND_FRAMES, DOWN_WAIT_FRAMES } from "./down";
import { type Fighter, createFighter } from "./fighter";
import { attackStartupFrames } from "./moves";
import { updateProjectiles } from "./projectiles";
import type { Roster } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { advance } from "./step";
import { advanceSolo, controls, testBeginAttacks, testWorld } from "./testWorld";
import { AUTHORED_PHYSICS, type FighterPhysics, melee } from "./tuning";

// Test-only grounded-motion profile; no character or move data enters the roster.
const FLOOR_RECOVERY_REFERENCE_PHYSICS: FighterPhysics = { ...AUTHORED_PHYSICS.archer, traction: melee(0.07999999821186066) };

// Read through a call so an earlier assignment's narrowing doesn't hide the attack's effect.
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
  const fighter = createFighter(character, melee(tech ? -41.93229293823242 : -37.648311614990234), 1);
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

test("recorded floor recovery skids match a tech and a missed tech on both original hosts", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    assertEquals(recordedFloorRecoveryFirstDifference(character, true, 0.0), 0);
    assertEquals(recordedFloorRecoveryFirstDifference(character, false, 0.0), 0);
  }
});

test("the recorded floor recovery detects a wrong knockback on its first frame", () => {
  assertEquals(recordedFloorRecoveryFirstDifference(Character.archer, true, 0.05999999865889549), 204);
  assertEquals(recordedFloorRecoveryFirstDifference(Character.archer, false, 0.05999999865889549), 956);
});

test("a floor recovery's entry preserves residual horizontal knockback", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (let recovery = 0; recovery <= 2; recovery++) {
      const fighter = createFighter(character, 0.0, 1);
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

/** A weak forward-tilt hit on a face-down fighter waiting on the floor. */
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

test("down bound and get-up actions use their own frame counts", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls();
  fighter.motion.surface = 0;
  fighter.motion.grounded = true;
  fighter.down.state = DownState.bound;
  fighter.down.frame = 1;
  for (let tick = 1; tick <= DOWN_BOUND_FRAMES - 1; tick++) {
    advanceSolo(fighter, 0, input, -240.0);
    assertEquals(fighter.down.state, DownState.bound);
  }
  assertEquals(fighter.down.frame, DOWN_BOUND_FRAMES);
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.down.state, DownState.wait);
  assertEquals(fighter.down.waitRemaining, DOWN_WAIT_FRAMES);
  assertEquals(fighter.motion.z, 0.0);
  fighter.down.state = DownState.wait;
  fighter.down.waitRemaining = 1;
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.down.state, DownState.stand);
  assertEquals(fighter.down.frame, 1);
  for (let tick = 1; tick <= DOWN_STAND_FRAMES - 1; tick++) {
    advanceSolo(fighter, 0, input, -240.0);
    assertEquals(fighter.down.state, DownState.stand);
  }
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.down.state, DownState.none);
  fighter.down.state = DownState.roll;
  fighter.down.direction = 1;
  fighter.down.frame = 1;
  fighter.motion.grounded = true;
  for (let tick = 1; tick <= DOWN_ROLL_FRAMES - 1; tick++) {
    advanceSolo(fighter, 0, input, -240.0);
    assertEquals(fighter.down.state, DownState.roll);
  }
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.down.state, DownState.none);
});

test("low damage during either grounded down pose starts down damage, in both facings", () => {
  for (const direction of [-1, 1]) {
    const attacker = createFighter(Character.archer, 0.0, direction);
    const target = createFighter(Character.rifleman, f32(direction * 50.0), -direction);
    weakRecoveryHit(testWorld(attacker, target), direction, attacker, target);
    assertEquals(target.status.damage, 5.0);
    assertEquals(target.down.state, DownState.damage);
    assertEquals(target.down.frame, 1);
    assertTrue(target.motion.grounded);
    assertFalse(target.down.faceUp);
    assertEquals(target.launch.hitlag, 4);
  }
});

test("hitlag freezes down damage, then hitstun returns it to a timed down wait", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 50.0, -1);
  const world = testWorld(attacker, target);
  const input = controls();
  target.status.damage = 80.0;
  weakRecoveryHit(world, 1, attacker, target);
  assertEquals(target.down.state, DownState.damage);
  const damageFrame = target.down.frame;
  for (let tick = 1; tick <= 3; tick++) {
    advance(world, 1, 0, input, -240.0);
    assertEquals(target.down.frame, damageFrame);
    assertTrue(target.motion.grounded);
  }
  while (target.down.state === DownState.damage) advance(world, 1, 0, input, -240.0);
  assertEquals(target.down.state, DownState.wait);
  assertEquals(target.down.waitRemaining, target.launch.hitstun);
  assertGreaterThan(target.down.waitRemaining, 0);
  const remaining = target.down.waitRemaining;
  for (let tick = 1; tick <= remaining; tick++) advance(world, 1, 0, input, -240.0);
  assertEquals(target.down.state, DownState.stand);
});

test("seven damage interrupts a down recovery and doesn't jab reset", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 50.0, -1);
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

test("down damage's completion checks get-up input without waiting another tick", () => {
  for (const host of [Character.archer, Character.rifleman]) {
    const attacker = createFighter(Character.archer, 0.0, 1);
    const target = createFighter(host, 50.0, -1);
    const world = testWorld(attacker, target);
    const input = controls();
    target.status.damage = 80.0;
    weakRecoveryHit(world, 1, attacker, target);
    while (target.launch.hitlag > 1) advance(world, 1, 0, input, -240.0);
    for (let tick = 1; tick <= DOWN_DAMAGE_FRAMES - 1; tick++) {
      advance(world, 1, 0, input, -240.0);
      assertEquals(target.down.state, DownState.damage);
    }
    input.getupAttackPressed = true;
    advance(world, 1, 0, input, -240.0);
    assertEquals(target.down.state, DownState.attack);
  }
});

test("down damage ends in a stand when its hitstun expires during the animation", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
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

test("a prone wait's expiry starts a stand before get-up input", () => {
  for (const remaining of [1, 2]) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    fighter.motion.surface = 0;
    fighter.motion.grounded = true;
    fighter.down.state = DownState.wait;
    fighter.down.waitRemaining = remaining;
    advanceSolo(fighter, 0, controls({ getupAttackPressed: true }), -240.0);
    assertEquals(fighter.down.state, remaining === 1 ? DownState.stand : DownState.attack);
  }
});

test("recovery protection matches the extracted event times", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const { down } = fighter;
  const protectedThrough = (frame: number) => {
    down.frame = frame;
    assertTrue(isIntangible(fighter));
    down.frame = frame + 1;
    assertFalse(isIntangible(fighter));
  };
  down.state = DownState.stand;
  protectedThrough(DOWN_RECOVERY_INTANGIBLE_FRAMES);
  down.state = DownState.roll;
  down.direction = -1;
  down.faceUp = true;
  protectedThrough(DOWN_ROLL_INTANGIBLE_FRAMES_BACK_UP);
  down.faceUp = false;
  protectedThrough(DOWN_ROLL_INTANGIBLE_FRAMES_BACK_DOWN);
  down.direction = fighter.facing;
  protectedThrough(DOWN_RECOVERY_INTANGIBLE_FRAMES);
  down.state = DownState.attack;
  down.faceUp = true;
  protectedThrough(DOWN_ATTACK_INTANGIBLE_FRAMES_UP);
  down.faceUp = false;
  protectedThrough(DOWN_ATTACK_INTANGIBLE_FRAMES_DOWN);
});

test("a grounded rifleman blaster hit keeps the grounding and the impact hitlag", () => {
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.archer, 20.0, -1);
  const shot = owner.projectiles[0]!;
  shot.life = 10;
  shot.kind = ProjectileKind.blaster;
  shot.direction = 1;
  shot.x = 0.0;
  shot.z = 45.0;
  shot.velocityX = 30.0;
  updateProjectiles(testWorld(owner, target));
  assertEquals(target.status.damage, 3.0);
  assertEquals(target.launch.hitlag, 4);
  assertTrue(target.motion.grounded);
});

test("a floor recovery skid leaves the platform without keeping the grounded pose", () => {
  for (const host of [Character.archer, Character.rifleman]) {
    for (const stage of [0, 1]) {
      for (const direction of [-1, 1]) {
        for (let recovery = 0; recovery <= 2; recovery++) {
          const deck = stage === 0 ? 0 : 1;
          const edge = direction < 0 ? surfaceLeft(stage, deck) : surfaceRight(stage, deck);
          const fighter = createFighter(host, f32(edge - direction * 30), direction);
          fighter.tuning.physics = FLOOR_RECOVERY_REFERENCE_PHYSICS;
          fighter.motion.grounded = false;
          fighter.motion.surface = undefined;
          fighter.motion.z = f32(surfaceZ(stage, deck) + 1);
          fighter.motion.vz = -2.0;
          fighter.launch.knockbackX = f32(direction * 18.0);
          fighter.down.state = DownState.tumble;
          fighter.launch.hitstun = 20;
          const input = controls({ techPressed: recovery > 0, direction: recovery === 2 ? direction : 0 });
          advanceSolo(fighter, stage, input, 0.0);
          assertEquals(fighter.down.state, recovery === 0 ? DownState.bound : recovery === 1 ? DownState.tech : DownState.techRoll);
          assertEquals(fighter.motion.surface, deck);
          assertTrue(fighter.motion.grounded);
          input.techPressed = false;
          const contactX = fighter.motion.x;
          const contactZ = fighter.motion.z;
          advanceSolo(fighter, stage, input, 0.0);
          if (recovery === 2) {
            assertEquals(fighter.motion.x, edge);
            assertTrue(fighter.motion.grounded);
            assertEquals(fighter.down.state, DownState.techRoll);
            assertEquals(fighter.motion.surface, deck);
          } else {
            assertTrue((fighter.motion.x - edge) * direction > 0);
            assertFalse(fighter.motion.grounded);
            assertEquals(fighter.down.state, DownState.none);
            assertEquals(fighter.motion.surface, undefined);
            assertEquals(fighter.jump.remaining, 1);
            assertTrue(fighter.launch.knockbackX * direction > 0);
          }
          assertEquals(fighter.motion.deltaX, f32(fighter.motion.x - contactX));
          assertEquals(fighter.motion.z, contactZ);
          advanceSolo(fighter, stage, input, 0.0);
          if (recovery === 2) assertEquals(fighter.motion.z, contactZ);
          else assertTrue(fighter.motion.z < contactZ);
        }
      }
    }
  }
});
