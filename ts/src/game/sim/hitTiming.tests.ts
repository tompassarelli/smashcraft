import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, ProjectileKind } from "./codes";
import { canAttack } from "./conditions";
import { createFighter } from "./fighter";
import { ordinaryHitlagFrames, ordinaryHitstunFrames } from "./knockback";
import { attackStartupFrames } from "./moves";
import { updateProjectiles } from "./projectiles";
import { digitalShieldstunFrames } from "./shield";
import { advanceFighter } from "./step";
import { advanceSolo, controls, testBeginAttacks, testWorld } from "./testWorld";

// Slippi techTester.slp ff815345e641836a331191320c0f6eae21542a5f, frames
// 3432-3445: NTSC recording, disc revision unknown. Only release timing is
// compared here; grounded knockback displacement has its own fixture.
test("recorded grounded damage resumes on hitlag expiry", () => {
  const fighter = createFighter(Character.archer, f32(-11.548782348632812 * 6.0), 1);
  const input = controls({ down: true, verticalDirection: -1 });
  fighter.motion.surface = 0;
  fighter.launch.hitlag = 4;
  fighter.launch.hitstun = 10;
  fighter.launch.knockbackX = f32(0.7562744617462158 * 6.0);
  const contactX = fighter.motion.x;
  for (let frame = 3433; frame <= 3445; frame++) {
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.launch.hitlag, max(0, 3436 - frame));
    assertEquals(fighter.launch.hitstun, frame < 3436 ? 10 : 3445 - frame);
    if (frame < 3436) assertEquals(fighter.motion.x, contactX);
    else if (frame === 3436) assertTrue(fighter.motion.x > contactX);
    assertEquals(canAttack(fighter), frame === 3445);
  }
});

test("hitlag release allows a jump when hitstun expires on that frame", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
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

test("hitstun expiry allows a jump on the same tick as an attack", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
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

test("hitlag and shieldstun respect Melee integer boundaries", () => {
  assertEquals(ordinaryHitlagFrames(0.0), 0);
  assertEquals(ordinaryHitlagFrames(2.999000072479248), 3);
  assertEquals(ordinaryHitlagFrames(3.0), 4);
  assertEquals(ordinaryHitlagFrames(15.0), 8);
  assertEquals(ordinaryHitlagFrames(100.0), 20);
  assertEquals(digitalShieldstunFrames(12.0), 7);
  assertEquals(digitalShieldstunFrames(7.0), 5);
  assertEquals(ordinaryHitstunFrames(100.0), 40);
});

test("a shield contact freezes both bodies before shieldstun counts down", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
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

test("a detached projectile impact does not freeze its shooter", () => {
  for (const shielded of [false, true]) {
    for (const kind of [ProjectileKind.arrow, ProjectileKind.fanArrow, ProjectileKind.recoil]) {
      const shooter = createFighter(Character.archer, 0.0, 1);
      const target = createFighter(Character.rifleman, 100.0, -1);
      target.shield.raised = shielded;
      const projectile = shooter.projectiles[0]!;
      projectile.life = 2;
      projectile.kind = kind;
      projectile.x = 90.0;
      projectile.z = 45.0;
      projectile.velocityX = 20.0;
      projectile.direction = 1;
      updateProjectiles(testWorld(shooter, target));
      assertEquals(shooter.launch.hitlag, 0);
      if (kind === ProjectileKind.recoil) {
        assertGreaterThan(target.launch.hitlag, 0);
      } else {
        assertEquals(target.launch.hitlag, 0);
        assertEquals(target.launch.hitstun, 0);
        assertEquals(target.shield.stun, 0);
      }
    }
  }
});
