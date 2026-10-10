import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { canAttack } from "./conditions";
import { type Fighter } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { attackStartupFrames } from "./moves";
import type { Controls } from "./roster";
import { advanceSolo, controls, testBeginAttacks, testWorld } from "./testWorld";
import { authoredPhysics } from "./tuning";

const jumpSquatFrames = (character: Character) => authoredPhysics(character).jumpSquatFrames;

test("hit regions snapshot different effects before either trade cancels its attack [spec docs/physics.md] [invariant]", () => {
  for (const reverse of [false, true]) {
    const first = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const second = createReferenceFighter(Character.sylvanas, 100.0, -1);
    testBeginAttacks(testWorld(first, second), AttackStyle.forwardTilt, AttackStyle.forwardTilt);
    first.attack.frame = 5;
    second.attack.frame = 6;
    resolveAttacks(reverse ? testWorld(second, first) : testWorld(first, second));
    assertEquals(first.status.damage, 8.0);
    assertEquals(second.status.damage, 10.0);
    assertEquals(first.launch.hitlag, 6);
    assertEquals(second.launch.hitlag, 6);
    assertLessThan(first.launch.knockbackX, 0.0);
    assertGreaterThan(second.launch.knockbackX, 0.0);
    assertEquals(first.attack.style, undefined);
    assertEquals(second.attack.style, undefined);
  }
});

test("an empty landing recovers once, after four ticks [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const fighter = createReferenceFighter(character, 0.0, 1);
    const input = controls();
    fighter.motion.grounded = false;
    fighter.motion.z = 1.0;
    fighter.motion.vz = -2.0;
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.landing.lag, 4);
    assertFalse(canAttack(fighter));
    for (let tick = 1; tick <= 3; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.landing.lag, 4 - tick);
      assertFalse(canAttack(fighter));
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(canAttack(fighter));
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.landing.lag, 0);
  }
});

test("a jump accepts the same landing recovery boundary as attacks [spec docs/physics.md]", () => {
  for (let recovery = 4; recovery <= 18; recovery++) {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const input = controls();
    fighter.landing.lag = recovery;
    for (let tick = 1; tick <= recovery - 1; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertFalse(canAttack(fighter));
    }
    input.jumpPressed = true;
    input.jumpHeld = true;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.landing.lag, 0);
    assertEquals(fighter.jump.squat, jumpSquatFrames(Character.sylvanas));
  }
});

function aerialLandingFighter(character: Character, style: AttackStyle): Fighter {
  const fighter = createReferenceFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 300.0;
  testBeginAttacks(testWorld(fighter, createReferenceFighter(Character.rifleman, 500.0, -1)), style, undefined);
  return fighter;
}

function land(fighter: Fighter, input: Readonly<Controls>): void {
  fighter.motion.z = 1.0;
  fighter.motion.vz = -2.0;
  advanceSolo(fighter, 0, input, 0.0);
}

// Aerial landing lag uses Melee L-cancel division by 2 (PlCo +0x0E8), independent of button input.

const SHORT_AERIAL_LANDING_LAG = [
  [AttackStyle.neutralAir, 5], [AttackStyle.forwardAir, 7], [AttackStyle.backAir, 8], [AttackStyle.upAir, 7], [AttackStyle.downAir, 9],
] as const;

test("every fighter's aerials land with the short lag, pressed shield or not [spec #54]", () => {
  for (const character of [Character.sylvanas, Character.rifleman, Character.demonHunter]) {
    for (const [style, lag] of SHORT_AERIAL_LANDING_LAG) {
      for (const pressed of [false, true]) {
        const fighter = aerialLandingFighter(character, style);
        fighter.attack.frame = attackStartupFrames(style);
        land(fighter, controls(pressed ? { shieldPressed: true, airDodgePressed: true, techPressed: true } : {}));
        assertEquals(fighter.landing.lag, lag);
        assertEquals(fighter.attack.style, undefined);
        assertFalse(fighter.dodge.airDodging);
        const idle = controls();
        for (let tick = 1; tick <= lag - 1; tick++) {
          advanceSolo(fighter, 0, idle, 0.0);
          assertFalse(canAttack(fighter));
        }
        advanceSolo(fighter, 0, idle, 0.0);
        assertTrue(canAttack(fighter));
      }
    }
  }
});

