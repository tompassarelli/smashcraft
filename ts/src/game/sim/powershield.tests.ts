import { mutableProjectile } from "./fighterProjectiles";



import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, ContactKind, ProjectileKind } from "./codes";
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
  capsuleCircleIntersects,
  shieldContactPushback,
} from "./shield";
import { surfaceZ } from "./stage";
import { respawnFighter } from "./stocks";
import { advanceSolo, contactBatch, controls, hitEffect, testWorld } from "./testWorld";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";

test("pressure to a full press honors the two-frame input window [k4 reference melee]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const input = controls({ shieldTriggerActive: true });
  advanceSolo(fighter, 0, input, 0.0);
  input.shield = true;
  input.shieldPressed = true;
  input.shieldStrength = 1.0;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.reflectFrames, SHIELD_REFLECTOR_ACTIVE_FRAMES);
  const late = createFighter(Character.rifleman, 0.0, 1);
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

test("the reflector uses the authored circle and transfers a scaled projectile [k4 reference melee]", () => {
  const shooter = createFighter(Character.rifleman, -30.0, 1);
  const defender = createFighter(Character.rifleman, 0.0, -1);
  const shot = mutableProjectile(shooter, 0)!;
  shot.x = -50.0;
  shot.z = 45.0;
  shot.velocityX = 60.0;
  shot.velocityZ = 0.0;
  shot.direction = 1;
  shot.kind = ProjectileKind.blaster;
  shot.visualFamily = Character.rifleman;
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
  assertEquals(reflected.visualFamily, Character.rifleman);
  assertEquals(reflected.x, 10.0);
  assertEquals(defender.visuals.shieldReflect, reflectSerial + 1);
  assertEquals(defender.visuals.shield, shieldSerial);
  defender.shield.raised = false;
  defender.shield.reflectFrames = 0;
  updateProjectiles(testWorld(shooter, defender));
  const baselineShooter = createFighter(Character.rifleman, -30.0, 1);
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

test("perfect-shield pushback matches the original contact observations [k4 reference melee]", () => {
  assertEquals(shieldContactPushback(3.0, 0.4000000059604645, true), f32(1.0210000276565552 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(10.0, 0.4000000059604645, true), f32(2.0 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(30.0, 0.4000000059604645, true), f32(2.0 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(3.0, 1.0, true), f32(0.6700000166893005 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(10.0, 1.0, true), f32(1.3000000715255737 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(shieldContactPushback(30.0, 1.0, true), f32(2.0 * WORLD_UNITS_PER_MELEE_UNIT));
});


const queueHitOf = (world: Roster, damage: number) => (): void =>
  queueDamageContact(world, 0, 1, hitEffect(damage, 100.0, 20.0, 1.0, 1.0), 1, ContactKind.launch, true, undefined);


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


function untilLastFreezeFrame(f: Fighter, input: Readonly<Controls>): void {
  while (f.launch.hitlag > 1) {
    assertFalse(canAttack(f));
    advanceSolo(f, 0, input, 0.0);
  }
}

test("a parried hit takes no shield damage or shieldstun; an ordinary block takes both [k3 measure #102]", () => {
  const attacker = createFighter(Character.rifleman, -100.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(attacker, target);
  target.shield.raised = true;
  target.shield.perfectFrames = 1;
  contactBatch(world, queueHitOf(world, 10.0));
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.shield.energy, SHIELD_MAX);
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

test("a red parry, a re-press in shieldstun on the next hit's frame or the one before, parries it [k3 measure #102]", () => {
  const world = testWorld(createFighter(Character.rifleman, -100.0, 1), createFighter(Character.rifleman, 0.0, -1));
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

test("original stationary capsule shield boundaries [k4 reference melee]", () => {
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

test("original swept capsule shield boundaries [k4 reference melee]", () => {
  assertEquals(capsuleCircleIntersects(-5.0, 0.0, 5.0, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(5.0, 0.0, -5.0, 0.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(-5.0, 3.0, 5.0, 3.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(5.0, 3.0, -5.0, 3.0, 1.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(-5.0, 3.000000238418579, 5.0, 3.000000238418579, 1.0, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(5.0, 3.000000238418579, -5.0, 3.000000238418579, 1.0, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(-5.0, 4.0, 5.0, 4.0, 1.0, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(5.0, 4.0, -5.0, 4.0, 1.0, 0.0, 0.0, 2.0, 1.0), false);
});

test("original scaled capsule shield boundaries [k4 reference melee]", () => {
  assertEquals(capsuleCircleIntersects(2.5, 0.0, 2.5, 0.0, 0.5, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(3.0, 0.0, 3.0, 0.0, 0.5, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(4.0, 0.0, 4.0, 0.0, 0.5, 0.0, 0.0, 2.0, 1.0), false);
  assertEquals(capsuleCircleIntersects(2.5, 0.0, 2.5, 0.0, 2.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(3.0, 0.0, 3.0, 0.0, 2.0, 0.0, 0.0, 2.0, 1.0), true);
  assertEquals(capsuleCircleIntersects(4.0, 0.0, 4.0, 0.0, 2.0, 0.0, 0.0, 2.0, 1.0), true);
});

test("original asymmetric capsule rounding and radius conversion [k4 reference melee]", () => {
  assertEquals(capsuleCircleIntersects(0.2273183912038803, 1.8602772951126099, 2.7224481105804443, 7.7711381912231445, 0.0, 0.0, 0.0, 1.8741145133972168, 1.0), true);
  assertEquals(capsuleCircleIntersects(9.86154556274414, -6.86391019821167, -5.6012959480285645, 7.704383373260498, 0.0, 0.0, 0.0, 1.7665791511535645, 1.0), true);
  assertEquals(capsuleCircleIntersects(8.760266304016113, 6.5879974365234375, -8.983579635620117, -8.832010269165039, 0.0, 0.0, 0.0, 0.7736536860466003, 1.0), false);
  assertEquals(capsuleCircleIntersects(-6.00670051574707, 1.2787494659423828, -4.775786399841309, 9.034687042236328, 0.0, 0.0, 0.0, 6.1413068771362305, 1.0), false);
  assertEquals(capsuleCircleIntersects(-3.236114978790283, -9.718732833862305, -8.34358024597168, 7.590638637542725, 0.0, 0.0, 0.0, 5.854279518127441, 1.0), false);
  assertEquals(capsuleCircleIntersects(0.822984516620636, 3.0610923767089844, 9.638368606567383, 9.857255935668945, 0.0, 0.0, 0.0, 3.1697933673858643, 1.0), true);
});

test("an original scaled shield keeps its local radius separate from the joint scale [k4 reference melee]", () => {
  assertEquals(
    capsuleCircleIntersects(3.7672877311706543, 3.8061885833740234, -1.257254958152771, -5.283233642578125, 0.3639150559902191, 0.0, 0.0, 1.8986871242523193, 0.5750000476837158),
    true,
  );
  assertEquals(
    capsuleCircleIntersects(-1.7744019031524658, 2.6443862915039062, -6.72720193862915, 4.344293594360352, 0.7961344718933105, 0.0, 0.0, 2.737424850463867, 0.8725000619888306),
    false,
  );
});

test("an original scaled shield's translation rounds matrix products before adding the translation [k4 reference melee]", () => {
  assertEquals(
    capsuleCircleIntersects(81.35445404052734, -22.855464935302734, 83.38614654541016, -24.975975036621094, 0.38011103868484497, 80.125, -23.75, 1.9831877946853638, 0.5750000476837158),
    false,
  );
  assertEquals(
    capsuleCircleIntersects(-36.908451080322266, 116.18476867675781, -47.4307861328125, 113.92276000976562, 1.2565581798553467, -40.75, 120.5, 4.32054328918457, 0.8725000619888306),
    true,
  );
});
