import { mutableProjectile } from "./fighterProjectiles";
// Powershield: the parry and red parry, the shield bubble, reflect and
// perfect-shield windows, projectile reflection, and the original
// capsule-against-shield boundaries.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, ContactKind, ProjectileKind } from "./codes";
import { canAttack } from "./conditions";
import { queueDamageContact } from "./contacts";
import { type Fighter, SHIELD_MAX, createFighter } from "./fighter";
import { projectileActive, updateProjectiles } from "./projectiles";
import { type Controls, type Roster, fighterAt } from "./roster";
import {
  SHIELD_MIN_HOLD_FRAMES,
  SHIELD_PERFECT_ACTIVE_FRAMES,
  SHIELD_PERFECT_POST_CONTACT_FRAMES,
  SHIELD_PROJECTILE_DAMAGE_MULTIPLIER,
  SHIELD_RED_PARRY_FRAMES,
  SHIELD_REFLECTOR_ACTIVE_FRAMES,
  SHIELD_RELEASE_LAG_FRAMES,
  capsuleCircleIntersects,
  shieldCircleIntersects,
  shieldContactPushback,
  shieldSizeMultiplier,
} from "./shield";
import { surfaceZ } from "./stage";
import { respawnFighter } from "./stocks";
import { advanceSolo, contactBatch, controls, hitEffect, testBeginAttacks, testWorld } from "./testWorld";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";

test("projectile shield coverage separates exposed-body and shield-only contacts [spec docs/physics.md]", () => {
  for (let scenario = 0; scenario <= 1; scenario++) {
    const shooter = createFighter(Character.archer, -100.0, 1);
    const defender = createFighter(Character.rifleman, 0.0, -1);
    defender.motion.z = 0.0;
    defender.shield.raised = true;
    defender.tuning.shield = { centerX: 0.0, centerZ: 45.0, radius: scenario === 0 ? 60.0 : 200.0 };
    const projectile = mutableProjectile(shooter, 0)!;
    projectile.x = scenario === 0 ? -20.0 : -80.0;
    projectile.z = scenario === 0 ? 110.0 : 45.0;
    projectile.velocityX = scenario === 0 ? 40.0 : 30.0;
    projectile.direction = 1;
    projectile.kind = ProjectileKind.blaster;
    projectile.life = 3;
    projectile.damageMultiplier = 1.0;
    const energy = defender.shield.energy;
    updateProjectiles(testWorld(shooter, defender));
    assertFalse(projectileActive(shooter, 0));
    if (scenario === 0) {
      assertGreaterThan(defender.status.damage, 0.0);
      assertEquals(defender.shield.energy, energy);
      assertEquals(defender.shield.stun, 0);
    } else {
      assertEquals(defender.status.damage, 0.0);
      assertLessThan(defender.shield.energy, energy);
      assertGreaterThan(defender.shield.stun, 0);
    }
  }
});

test("a full trigger within the observed window starts and expires the reflect state [reference]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls({ shield: true, shieldPressed: true, shieldTriggerActive: true, shieldStrength: 1.0 });
  advanceSolo(fighter, 0, input, 0.0);
  assertTrue(fighter.shield.raised);
  assertEquals(fighter.shield.reflectFrames, SHIELD_REFLECTOR_ACTIVE_FRAMES);
  assertEquals(fighter.shield.perfectFrames, 4);
  input.shieldPressed = false;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.reflectFrames, 1);
  assertEquals(fighter.shield.perfectFrames, 3);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.reflectFrames, 0);
  assertEquals(fighter.shield.perfectFrames, 2);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.perfectFrames, 1);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.perfectFrames, 0);
});

test("pressure to a full press honors the two-frame input window [reference]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls({ shieldTriggerActive: true });
  advanceSolo(fighter, 0, input, 0.0);
  input.shield = true;
  input.shieldPressed = true;
  input.shieldStrength = 1.0;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.reflectFrames, SHIELD_REFLECTOR_ACTIVE_FRAMES);
  const late = createFighter(Character.archer, 0.0, 1);
  input.shield = false;
  input.shieldPressed = false;
  input.shieldStrength = 1.0;
  input.shieldTriggerActive = true;
  advanceSolo(late, 0, input, 0.0);
  advanceSolo(late, 0, input, 0.0);
  advanceSolo(late, 0, input, 0.0);
  input.shield = true;
  input.shieldPressed = true;
  advanceSolo(late, 0, input, 0.0);
  assertTrue(late.shield.raised);
  assertEquals(late.shield.reflectFrames, 0);
});

test("the reflector uses the authored circle and transfers a scaled projectile [reference]", () => {
  const shooter = createFighter(Character.archer, -30.0, 1);
  const defender = createFighter(Character.rifleman, 0.0, -1);
  const shot = mutableProjectile(shooter, 0)!;
  shot.x = -50.0;
  shot.z = 45.0;
  shot.velocityX = 60.0;
  shot.velocityZ = 0.0;
  shot.direction = 1;
  shot.kind = ProjectileKind.blaster;
  shot.visualFamily = Character.archer;
  shot.life = 3;
  shot.damageMultiplier = 1.0;
  defender.shield.raised = true;
  defender.shield.reflectFrames = SHIELD_REFLECTOR_ACTIVE_FRAMES;
  defender.tuning.shield = { centerX: 0.0, centerZ: 45.0, radius: 60.0 };
  const reflectSerial = defender.visuals.shieldReflect;
  const shieldSerial = defender.visuals.shield;
  updateProjectiles(testWorld(shooter, defender));
  assertFalse(projectileActive(shooter, 0));
  assertTrue(projectileActive(defender, 0));
  const reflected = mutableProjectile(defender, 0)!;
  assertEquals(reflected.direction, -1);
  assertEquals(reflected.velocityX, -42.0);
  assertEquals(reflected.damageMultiplier, SHIELD_PROJECTILE_DAMAGE_MULTIPLIER);
  assertEquals(reflected.visualFamily, Character.archer);
  assertEquals(reflected.x, 10.0);
  assertEquals(defender.visuals.shieldReflect, reflectSerial + 1);
  assertEquals(defender.visuals.shield, shieldSerial);
  defender.shield.raised = false;
  defender.shield.reflectFrames = 0;
  updateProjectiles(testWorld(shooter, defender));
  const baselineShooter = createFighter(Character.archer, -30.0, 1);
  const baselineDefender = createFighter(Character.rifleman, 0.0, -1);
  const baseline = mutableProjectile(baselineShooter, 0)!;
  baseline.x = -50.0;
  baseline.z = 45.0;
  baseline.velocityX = 60.0;
  baseline.kind = ProjectileKind.blaster;
  baseline.life = 3;
  updateProjectiles(testWorld(baselineShooter, baselineDefender));
  assertEquals(f32(shooter.status.damage * 2), baselineDefender.status.damage);
});

test("perfect-shield pushback matches the original contact observations [reference]", () => {
  assertEquals(shieldContactPushback(3.0, 0.4000000059604645, true), f32(1.0210000276565552 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(10.0, 0.4000000059604645, true), f32(2.0 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(30.0, 0.4000000059604645, true), f32(2.0 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(3.0, 1.0, true), f32(0.6700000166893005 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(10.0, 1.0, true), f32(1.3000000715255737 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(30.0, 1.0, true), f32(2.0 * WORLD_UNITS_PER_MELEE_UNIT));
});


const queueHitOf = (world: Roster, damage: number) => (): void =>
  queueDamageContact(world, 0, 1, hitEffect(damage, 100.0, 20.0, 1.0, 1.0), 1, ContactKind.launch, true, undefined);

/** Slot 1 standing on the main deck with an ordinary held shield. */
function guarding(world: Roster): Fighter {
  respawnFighter(world, 1, 0.0);
  const target = fighterAt(world, 1);
  target.motion.grounded = true;
  target.motion.z = surfaceZ(0, 0, 0);
  target.shield.raised = true;
  target.shield.heldFrames = SHIELD_MIN_HOLD_FRAMES;
  return target;
}

const held = (): Controls => controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const pressed = (): Controls => controls({ shield: true, shieldPressed: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const released = (): Controls => controls({ shieldStrength: 1.0 });

/** Plays the freeze's frames up to, not including, the last one: the frame the fighter can act again. */
function untilLastFreezeFrame(f: Fighter, input: Readonly<Controls>): void {
  while (f.launch.hitlag > 1) {
    assertFalse(canAttack(f));
    advanceSolo(f, 0, input, 0.0);
  }
}

test("a parried hit takes no shield damage or shieldstun; an ordinary block takes both [reference] [spec #102]", () => {
  const attacker = createFighter(Character.archer, -100.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(attacker, target);
  target.shield.raised = true;
  target.shield.perfectFrames = 1;
  contactBatch(world, queueHitOf(world, 10.0));
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.shield.energy, 60.0);
  assertEquals(target.shield.stun, 0);
  assertGreaterThan(target.launch.hitlag, 0);
  assertEquals(target.shield.pushbackX, f32(1.3000000715255737 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(target.visuals.shieldReflect, 1);
  assertEquals(target.visuals.shield, 0);
  assertEquals(target.shield.perfectActionFrames, SHIELD_PERFECT_POST_CONTACT_FRAMES);
  contactBatch(world, queueHitOf(world, 10.0));
  assertEquals(target.shield.energy, 53.0);
  assertEquals(target.shield.stun, 6);
  assertEquals(target.shield.pushbackX, f32(0.7800000905990601 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(target.visuals.shieldReflect, 1);
  assertEquals(target.visuals.shield, 1);
  assertEquals(target.shield.perfectActionFrames, 0);
});

test("a parry's reward drops the shield with no release lag until holding guard spends it [spec #102]", () => {
  const attacker = createFighter(Character.archer, -100.0, 1);
  const world = testWorld(attacker, createFighter(Character.rifleman, 0.0, -1));
  for (let heldTicks = 0; heldTicks <= SHIELD_PERFECT_POST_CONTACT_FRAMES; heldTicks++) {
    const target = guarding(world);
    target.shield.perfectFrames = 1;
    contactBatch(world, queueHitOf(world, 10.0));
    untilLastFreezeFrame(target, held());
    assertEquals(target.shield.perfectActionFrames, SHIELD_PERFECT_POST_CONTACT_FRAMES);
    // The first held tick is the freeze's last frame, the first the fighter can act on.
    for (let tick = 1; tick <= heldTicks; tick++) advanceSolo(target, 0, held(), 0.0);
    assertEquals(target.shield.perfectActionFrames, SHIELD_PERFECT_POST_CONTACT_FRAMES - heldTicks);
    advanceSolo(target, 0, released(), 0.0);
    assertFalse(target.shield.raised);
    const rewarded = heldTicks < SHIELD_PERFECT_POST_CONTACT_FRAMES;
    assertEquals(target.shield.releaseLag, rewarded ? 0 : SHIELD_RELEASE_LAG_FRAMES);
    assertEquals(canAttack(target), rewarded);
    if (rewarded) {
      testBeginAttacks(testWorld(target, attacker), AttackStyle.forwardTilt, undefined);
      assertEquals(target.attack.style, AttackStyle.forwardTilt);
    }
  }
});

test("each hit of a string needs its own parry, and the reward follows the last [spec #102]", () => {
  const world = testWorld(createFighter(Character.archer, -100.0, 1), createFighter(Character.rifleman, 0.0, -1));
  for (const retimed of [false, true]) {
    const target = guarding(world);
    target.shield.reflectFrames = SHIELD_REFLECTOR_ACTIVE_FRAMES;
    target.shield.perfectFrames = SHIELD_PERFECT_ACTIVE_FRAMES;
    contactBatch(world, queueHitOf(world, 10.0));
    assertEquals(target.visuals.shieldReflect, 1);
    // One press parries one hit, however much of its window is left.
    assertEquals(target.shield.perfectFrames, 0);
    assertEquals(target.shield.reflectFrames, 0);
    untilLastFreezeFrame(target, held());
    if (retimed) {
      advanceSolo(target, 0, released(), 0.0);
      assertEquals(target.shield.releaseLag, 0);
      advanceSolo(target, 0, pressed(), 0.0);
      assertEquals(target.shield.perfectFrames, SHIELD_PERFECT_ACTIVE_FRAMES);
    } else {
      advanceSolo(target, 0, held(), 0.0);
      advanceSolo(target, 0, held(), 0.0);
    }
    contactBatch(world, queueHitOf(world, 10.0));
    if (retimed) {
      assertEquals(target.visuals.shieldReflect, 2);
      assertEquals(target.shield.stun, 0);
      assertEquals(target.shield.energy, 60.0);
      assertEquals(target.shield.perfectActionFrames, SHIELD_PERFECT_POST_CONTACT_FRAMES);
    } else {
      assertEquals(target.visuals.shield, 1);
      assertGreaterThan(target.shield.stun, 0);
      assertLessThan(target.shield.energy, 60.0);
      assertEquals(target.shield.perfectActionFrames, 0);
    }
    target.visuals.shield = 0;
    target.visuals.shieldReflect = 0;
  }
});

/** A shot `distance` left of the defender's shield centre, flying right at 60 a frame. */
function aimShot(shooter: Fighter, defender: Fighter, index: number, distance: number): void {
  const shot = mutableProjectile(shooter, index)!;
  shot.x = f32(defender.motion.x - distance);
  shot.z = 45.0;
  shot.velocityX = 60.0;
  shot.velocityZ = 0.0;
  shot.direction = 1;
  shot.kind = ProjectileKind.blaster;
  shot.visualFamily = Character.archer;
  shot.life = 10;
  shot.damageMultiplier = 1.0;
}

test("each projectile in a stream needs its own parry [spec #102]", () => {
  const shooter = createFighter(Character.archer, -300.0, 1);
  const defender = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(shooter, defender);
  defender.tuning.shield = { centerX: 0.0, centerZ: 45.0, radius: 60.0 };
  defender.shield.raised = true;
  defender.shield.reflectFrames = SHIELD_REFLECTOR_ACTIVE_FRAMES;
  defender.shield.perfectFrames = SHIELD_PERFECT_ACTIVE_FRAMES;
  aimShot(shooter, defender, 0, 50.0);
  aimShot(shooter, defender, 1, 140.0);
  contactBatch(world, () => updateProjectiles(world));
  assertEquals(defender.visuals.shieldReflect, 1);
  assertTrue(projectileActive(defender, 0));
  assertTrue(projectileActive(shooter, 1));
  assertEquals(defender.shield.reflectFrames, 0);
  assertEquals(defender.shield.stun, 0);
  contactBatch(world, () => updateProjectiles(world));
  assertFalse(projectileActive(shooter, 1));
  assertFalse(projectileActive(defender, 1));
  assertEquals(defender.visuals.shieldReflect, 1);
  assertEquals(defender.visuals.shield, 1);
  assertGreaterThan(defender.shield.stun, 0);
});

test("a red parry, a re-press in shieldstun on the next hit's frame or the one before, parries it [spec #102]", () => {
  const world = testWorld(createFighter(Character.archer, -100.0, 1), createFighter(Character.rifleman, 0.0, -1));
  for (let early = 0; early <= SHIELD_RED_PARRY_FRAMES; early++) {
    const target = guarding(world);
    target.visuals.shield = 0;
    target.visuals.shieldReflect = 0;
    contactBatch(world, queueHitOf(world, 20.0));
    assertGreaterThan(target.shield.stun, 4);
    while (target.launch.hitlag > 0) advanceSolo(target, 0, held(), 0.0);
    advanceSolo(target, 0, released(), 0.0);
    assertTrue(target.shield.raised);
    advanceSolo(target, 0, pressed(), 0.0);
    assertTrue(target.shield.redParryTried);
    for (let wait = 0; wait < early; wait++) advanceSolo(target, 0, held(), 0.0);
    const energy = target.shield.energy;
    contactBatch(world, queueHitOf(world, 10.0));
    if (early < SHIELD_RED_PARRY_FRAMES) {
      assertEquals(target.visuals.shieldReflect, 1);
      assertEquals(target.shield.stun, 0);
      assertEquals(target.shield.energy, energy);
      // The same reward as a parry from neutral: act on the freeze's last frame with no release lag.
      untilLastFreezeFrame(target, held());
      advanceSolo(target, 0, released(), 0.0);
      assertEquals(target.shield.releaseLag, 0);
      assertTrue(canAttack(target));
    } else {
      assertEquals(target.visuals.shieldReflect, 0);
      assertGreaterThan(target.shield.stun, 0);
      assertLessThan(target.shield.energy, energy);
      assertFalse(target.shield.redParryTried);
    }
  }
});

test("mashing the shield in shieldstun gets one red parry try per blocked hit [spec #102]", () => {
  const world = testWorld(createFighter(Character.archer, -100.0, 1), createFighter(Character.rifleman, 0.0, -1));
  const target = guarding(world);
  contactBatch(world, queueHitOf(world, 20.0));
  while (target.launch.hitlag > 0) advanceSolo(target, 0, held(), 0.0);
  advanceSolo(target, 0, released(), 0.0);
  advanceSolo(target, 0, pressed(), 0.0);
  advanceSolo(target, 0, released(), 0.0);
  advanceSolo(target, 0, pressed(), 0.0);
  assertTrue(target.shield.stun > 0);
  assertEquals(target.shield.perfectFrames, 0);
  contactBatch(world, queueHitOf(world, 10.0));
  assertEquals(target.visuals.shieldReflect, 0);
  assertGreaterThan(target.shield.stun, 0);
});

test("the shield bubble shrinks as it drains while held, regenerates once released, and can be poked [spec #102]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  advanceSolo(fighter, 0, pressed(), 0.0);
  let previous = fighter.shield.energy;
  for (let frame = 1; frame <= 60; frame++) advanceSolo(fighter, 0, held(), 0.0);
  assertLessThan(shieldSizeMultiplier(fighter.shield.energy, 1.0), shieldSizeMultiplier(SHIELD_MAX, 1.0));
  advanceSolo(fighter, 0, released(), 0.0);
  assertFalse(fighter.shield.raised);
  for (let frame = 1; frame <= 2000 && fighter.shield.energy < SHIELD_MAX; frame++) {
    previous = fighter.shield.energy;
    advanceSolo(fighter, 0, released(), 0.0);
    assertGreaterThan(fighter.shield.energy, previous);
  }
  assertEquals(fighter.shield.energy, SHIELD_MAX);
  // A path 30 above the centre meets a full bubble and passes over a worn one.
  fighter.tuning.shield = { centerX: 0.0, centerZ: 45.0, radius: 60.0 };
  fighter.shield.raised = true;
  assertTrue(shieldCircleIntersects(fighter, -100.0, 75.0, 100.0, 75.0, 1.0));
  fighter.shield.energy = 5.0;
  assertFalse(shieldCircleIntersects(fighter, -100.0, 75.0, 100.0, 75.0, 1.0));
});

test("original stationary capsule shield boundaries [reference]", () => {
  assertEquals(capsuleCircleIntersects(0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(2.0, 0.0, 2.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(2.999999761581421, 0.0, 2.999999761581421, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(3.0, 0.0, 3.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(3.000000238418579, 0.0, 3.000000238418579, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(4.0, 0.0, 4.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(2.0, 0.0, 2.0, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(2.999999761581421, 0.0, 2.999999761581421, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(3.0, 0.0, 3.0, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(3.000000238418579, 0.0, 3.000000238418579, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(4.0, 0.0, 4.0, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), false);
});

test("original swept capsule shield boundaries [reference]", () => {
  assertEquals(capsuleCircleIntersects(-5.0, 0.0, 5.0, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(5.0, 0.0, -5.0, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(-5.0, 3.0, 5.0, 3.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(5.0, 3.0, -5.0, 3.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(-5.0, 3.000000238418579, 5.0, 3.000000238418579, 1.0, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(5.0, 3.000000238418579, -5.0, 3.000000238418579, 1.0, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(-5.0, 4.0, 5.0, 4.0, 1.0, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(5.0, 4.0, -5.0, 4.0, 1.0, 0.0, 0.0, 2.0, 1.0), false);
});

test("original scaled capsule shield boundaries [reference]", () => {
  assertEquals(capsuleCircleIntersects(2.5, 0.0, 2.5, 0.0, 0.5, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(3.0, 0.0, 3.0, 0.0, 0.5, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(4.0, 0.0, 4.0, 0.0, 0.5, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(2.5, 0.0, 2.5, 0.0, 2.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(3.0, 0.0, 3.0, 0.0, 2.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(4.0, 0.0, 4.0, 0.0, 2.0, 0.0, 0.0, 2.0, 1.0), true);
});

test("original asymmetric capsule rounding and radius conversion [reference]", () => {
  assertEquals(capsuleCircleIntersects(0.2273183912038803, 1.8602772951126099, 2.7224481105804443, 7.7711381912231445, 0.0, 0.0, 0.0, 1.8741145133972168, 1.0), true);
  assertEquals(capsuleCircleIntersects(9.86154556274414, -6.86391019821167, -5.6012959480285645, 7.704383373260498, 0.0, 0.0, 0.0, 1.7665791511535645, 1.0), true);
  assertEquals(capsuleCircleIntersects(8.760266304016113, 6.5879974365234375, -8.983579635620117, -8.832010269165039, 0.0, 0.0, 0.0, 0.7736536860466003, 1.0), false);
  assertEquals(capsuleCircleIntersects(-6.00670051574707, 1.2787494659423828, -4.775786399841309, 9.034687042236328, 0.0, 0.0, 0.0, 6.1413068771362305, 1.0), false);
  assertEquals(capsuleCircleIntersects(-3.236114978790283, -9.718732833862305, -8.34358024597168, 7.590638637542725, 0.0, 0.0, 0.0, 5.854279518127441, 1.0), false);
  assertEquals(capsuleCircleIntersects(0.822984516620636, 3.0610923767089844, 9.638368606567383, 9.857255935668945, 0.0, 0.0, 0.0, 3.1697933673858643, 1.0), true);
});

test("an original scaled shield keeps its local radius separate from the joint scale [reference]", () => {
  assertEquals(
    capsuleCircleIntersects(3.7672877311706543, 3.8061885833740234, -1.257254958152771, -5.283233642578125, 0.3639150559902191, 0.0, 0.0, 1.8986871242523193, 0.5750000476837158),
    true,
  );
  assertEquals(
    capsuleCircleIntersects(-1.7744019031524658, 2.6443862915039062, -6.72720193862915, 4.344293594360352, 0.7961344718933105, 0.0, 0.0, 2.737424850463867, 0.8725000619888306),
    false,
  );
});

test("an original scaled shield's translation rounds matrix products before adding the translation [reference]", () => {
  assertEquals(
    capsuleCircleIntersects(81.35445404052734, -22.855464935302734, 83.38614654541016, -24.975975036621094, 0.38011103868484497, 80.125, -23.75, 1.9831877946853638, 0.5750000476837158),
    false,
  );
  assertEquals(
    capsuleCircleIntersects(-36.908451080322266, 116.18476867675781, -47.4307861328125, 113.92276000976562, 1.2565581798553467, -40.75, 120.5, 4.32054328918457, 0.8725000619888306),
    true,
  );
});
