import { mutableProjectile } from "./fighterProjectiles";
import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, ProjectileKind } from "./codes";
import { canAttack } from "./conditions";
import { createReferenceFighter } from "./referenceRig";
import { ordinaryHitlagFrames, ordinaryHitstunFrames } from "./knockback";
import { attackStartupFrames } from "./moves";
import { updateProjectiles } from "./projectiles";
import { digitalShieldstunFrames } from "./shield";
import { advanceFighter } from "./step";
import { advanceSolo, controls, testBeginAttacks, testWorld } from "./testWorld";




test("hitlag release allows a jump when hitstun expires on that frame [reference]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const input = controls({ jumpPressed: true, jumpHeld: true });
  fighter.motion.surface = 0;
  fighter.launch.hitlag = 2;
  fighter.launch.hitstun = 1;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.launch.hitlag, 1);
  assertEquals(fighter.launch.hitstun, 1);
  assertEquals(fighter.jump.squat, 0);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.launch.hitlag, 0);
  assertEquals(fighter.launch.hitstun, 0);
  assertGreaterThan(fighter.jump.squat, 0);
});

test("hitstun expiry allows a jump on the same tick as an attack [spec docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const input = controls({ jumpPressed: true, jumpHeld: true });
  fighter.motion.surface = 0;
  fighter.launch.hitstun = 2;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.jump.squat, 0);
  assertEquals(canAttack(fighter), false);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.launch.hitstun, 0);
  assertGreaterThan(fighter.jump.squat, 0);
});

test("hitlag and shieldstun respect Melee integer boundaries [reference] [spec #106]", () => {
  assertEquals(ordinaryHitlagFrames(0.0), 0);
  assertEquals(ordinaryHitlagFrames(2.999000072479248), 3);
  assertEquals(ordinaryHitlagFrames(3.0), 4);
  assertEquals(ordinaryHitlagFrames(5.999000072479248), 4);
  assertEquals(ordinaryHitlagFrames(6.0), 5);
  assertEquals(ordinaryHitlagFrames(15.0), 8);
  assertEquals(ordinaryHitlagFrames(100.0), 20);
  assertEquals(digitalShieldstunFrames(12.0), 7);
  assertEquals(digitalShieldstunFrames(7.0), 5);

  assertEquals(digitalShieldstunFrames(12.0, true), 9);
  assertEquals(digitalShieldstunFrames(7.0, true), 6);
  assertEquals(digitalShieldstunFrames(5.0, true), 4);
  assertEquals(ordinaryHitstunFrames(2.499000072479248), 1);
  assertEquals(ordinaryHitstunFrames(2.5), 1);
  assertEquals(ordinaryHitstunFrames(51.06666564941406), 20);
  assertEquals(ordinaryHitstunFrames(100.0), 40);
});

test("a shield contact freezes both bodies before shieldstun counts down [reference] [spec docs/physics.md]", () => {
  const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const target = createReferenceFighter(Character.sylvanas, 100.0, -1);
  const world = testWorld(attacker, target);
  const input = controls({ shield: true });
  target.shield.raised = true;
  testBeginAttacks(world, AttackStyle.jab, undefined);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(world);
  assertEquals(attacker.launch.hitlag, 4);
  assertEquals(target.launch.hitlag, 4);
  assertEquals(target.shield.stun, 4);
  for (let tick = 1; tick <= 3; tick++) {
    advanceFighter(world, 1, 0, input, 240.0);
    assertEquals(target.shield.stun, 4);
  }
  advanceFighter(world, 1, 0, input, 240.0);
  assertEquals(target.shield.stun, 3);
});

test("a detached projectile impact does not freeze its shooter [spec docs/physics.md]", () => {
  for (const shielded of [false, true]) {
    for (const kind of [ProjectileKind.blaster, ProjectileKind.recoil]) {
      const shooter = createReferenceFighter(Character.sylvanas, 0.0, 1);
      const target = createReferenceFighter(Character.sylvanas, 100.0, -1);
      target.shield.raised = shielded;
      const projectile = mutableProjectile(shooter, 0)!;
      projectile.life = 2;
      projectile.kind = kind;
      projectile.x = 90.0;
      projectile.z = 45.0;
      projectile.velocityX = 20.0;
      projectile.direction = 1;
      updateProjectiles(testWorld(shooter, target));
      assertEquals(shooter.launch.hitlag, 0);
      assertGreaterThan(target.launch.hitlag, 0);
    }
  }
});
