import { assertEquals, assertFalse, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { max } from "../../runtime/numbers";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { canAttack, canShieldGrab, canStartAttackStyle } from "./conditions";
import { createReferenceFighter } from "./referenceRig";
import { beginAirDodge } from "./jumpsAndDodges";
import { attackStartupFrames } from "./moves";
import { SHIELD_MIN_HOLD_FRAMES, SHIELD_RELEASE_LAG_FRAMES } from "./shield";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { melee } from "./tuning";

test("every fighter's dropped shield blocks attacks for Ultimate's 11 frames, then frees them [k3 measure #100]", () => {
  assertEquals(SHIELD_RELEASE_LAG_FRAMES, 11);
  for (const character of Object.values(Character)) {
    const fighter = createReferenceFighter(character, 0.0, 1);
    const input = controls({ shield: true });
    for (let i = 0; i < SHIELD_MIN_HOLD_FRAMES; i++) advanceSolo(fighter, 0, input, -240.0);
    input.shield = false;
    advanceSolo(fighter, 0, input, -240.0);
    assertFalse(fighter.shield.raised);
    assertEquals(fighter.shield.releaseLag, SHIELD_RELEASE_LAG_FRAMES);
    for (let frame = 1; frame < SHIELD_RELEASE_LAG_FRAMES; frame++) {
      assertFalse(canAttack(fighter));
      advanceSolo(fighter, 0, input, -240.0);
    }
    assertEquals(fighter.shield.releaseLag, 1);
    advanceSolo(fighter, 0, input, -240.0);
    assertEquals(fighter.shield.releaseLag, 0);
    assertTrue(canAttack(fighter));
  }
});

test("a shield grab requires an unstunned, grounded, active shield and keeps other attacks locked [k3 measure docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  fighter.shield.raised = true;
  assertFalse(canAttack(fighter));
  assertTrue(canShieldGrab(fighter));
  assertTrue(canStartAttackStyle(fighter, AttackStyle.grab));
  assertFalse(canStartAttackStyle(fighter, AttackStyle.jab));
  const blockers: (readonly [() => void, () => void])[] = [
    [() => (fighter.shield.stun = 1), () => (fighter.shield.stun = 0)],
    [() => (fighter.launch.hitlag = 1), () => (fighter.launch.hitlag = 0)],
    [() => (fighter.launch.hitstun = 1), () => (fighter.launch.hitstun = 0)],
    [() => (fighter.shield.releaseLag = 1), () => (fighter.shield.releaseLag = 0)],
    [() => (fighter.landing.lag = 1), () => (fighter.landing.lag = 0)],
    [() => (fighter.attack.cooldown = 1), () => (fighter.attack.cooldown = 0)],
    [() => (fighter.jump.squat = 1), () => (fighter.jump.squat = 0)],
    [() => (fighter.grab.grabbedFrames = 1), () => (fighter.grab.grabbedFrames = 0)],
    [() => (fighter.motion.grounded = false), () => (fighter.motion.grounded = true)],
    [() => (fighter.status.out = true), () => (fighter.status.out = false)],
  ];
  for (const [block, unblock] of blockers) {
    block();
    assertFalse(canShieldGrab(fighter));
    unblock();
  }
  fighter.shield.energy = 0.0;
  assertTrue(canShieldGrab(fighter));
  fighter.shield.raised = false;
  assertFalse(canShieldGrab(fighter));
});

test("an air dodge protects only frames four through twenty-nine [k4 reference melee]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (let frame = 1; frame <= 30; frame++) {
      const fighter = createReferenceFighter(character, 100.0, -1);
      fighter.motion.z = 300.0;
      fighter.motion.grounded = false;
      beginAirDodge(fighter, 0, 0);
      const input = controls();
      for (let tick = 1; tick <= frame; tick++) advanceSolo(fighter, 0, input, -240.0);
      const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
      attacker.motion.z = fighter.motion.z;
      attacker.attack.style = AttackStyle.jab;
      attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
      resolveAttacks(testWorld(attacker, fighter));
      assertEquals(fighter.status.damage, frame >= 4 && frame <= 29 ? 0.0 : 5.0);
    }
  }
});

function groundJumpApex(character: Character, holdJump: boolean): number {
  const fighter = createReferenceFighter(character, 0.0, 1);
  const input = controls({ jumpPressed: true, jumpHeld: holdJump });
  let apex = 0.0;
  for (let frame = 1; frame <= 120; frame++) {
    advanceSolo(fighter, 0, input, -240.0);
    input.jumpPressed = false;
    apex = max(apex, fighter.motion.z);
  }
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.jump.remaining, 2);
  return apex;
}

function airJumpApex(character: Character): number {
  const fighter = createReferenceFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 100.0;
  fighter.motion.vz = -5.0;
  fighter.jump.remaining = 1;
  const input = controls({ jumpPressed: true, jumpHeld: true });
  let apex = fighter.motion.z;
  for (let frame = 1; frame <= 120; frame++) {
    advanceSolo(fighter, 0, input, -240.0);
    input.jumpPressed = false;
    apex = max(apex, fighter.motion.z);
  }
  assertTrue(fighter.motion.grounded);
  return apex - 100;
}

test("complete jump trajectories match the reference heights [k4 reference melee]", () => {
  assertNear(groundJumpApex(Character.sylvanas, true), melee(31.280000686645508), 0.019999999552965164);
  assertNear(groundJumpApex(Character.sylvanas, false), melee(10.649999618530273), 0.019999999552965164);
  assertNear(airJumpApex(Character.sylvanas), melee(40.20399856567383), 0.019999999552965164);
  assertNear(groundJumpApex(Character.rifleman, true), melee(51.5), 0.019999999552965164);
  assertNear(groundJumpApex(Character.rifleman, false), melee(11.579999923706055), 0.019999999552965164);
  assertNear(airJumpApex(Character.rifleman), melee(41.77799987792969), 0.019999999552965164);
});

