import { createFighter } from "./fighter";
import { stageBounds } from "./stageBounds";

import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { canAttack } from "./conditions";
import { AIR_DODGE_LANDING_LAG } from "./down";
import { type Fighter,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { AIR_DODGE_ANIMATION_FRAMES, beginAirDodge } from "./jumpsAndDodges";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "./knockback";
import { advanceSolo, controls } from "./testWorld";
import { GROUND_TRACTION } from "./tuning";

const ALL_FIGHTERS = Object.values(Character);

test("air-dodge travel stays above Melee without touching ground [spec #347]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 3000.0;
  beginAirDodge(fighter, 1, 1);
  for (let frame = 0; frame < 29; frame++) advanceSolo(fighter, 0, controls(), 0.0);

  assertNear(fighter.motion.x, f32(123.7098896281836), f32(0.001));
  assertNear(fighter.motion.z, f32(3123.7098896281836), f32(0.002));
  assertFalse(fighter.motion.grounded);
});

test("Rifleman's wavedash carries the stronger dodge through landing traction [spec #347]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 1.0;
  beginAirDodge(fighter, 1, 0);
  advanceSolo(fighter, 0, controls(), 0.0);
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
  for (let frame = 1; frame < 10; frame++) advanceSolo(fighter, 0, controls(), 0.0);

  assertNear(fighter.motion.x, f32(153.01399168968203), f32(0.001));
  assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG - 9);
  assertFalse(canAttack(fighter));
});

function airDodgedFighter(character: Character): Fighter {
  const fighter = createReferenceFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 3000.0;
  fighter.jump.remaining = 1;
  advanceSolo(fighter, 0, controls({ airDodgePressed: true, dodgeX: 1, dodgeZ: -1 }), -240.0);
  assertTrue(fighter.dodge.airDodging);
  assertTrue(fighter.dodge.airUsed);
  return fighter;
}

test("every fighter's air dodge ends actionable, spends no jump and allows one per airtime [spec docs/gameplay-design.md]", () => {
  for (const character of ALL_FIGHTERS) {
    const fighter = airDodgedFighter(character);
    assertEquals(fighter.jump.remaining, 1);
    const idle = controls();
    for (let frame = 2; frame < AIR_DODGE_ANIMATION_FRAMES; frame++) {
      advanceSolo(fighter, 0, idle, -240.0);
      assertTrue(fighter.dodge.airDodging);
      assertFalse(canAttack(fighter));
    }
    advanceSolo(fighter, 0, idle, -240.0);
    assertFalse(fighter.motion.grounded);
    assertFalse(fighter.dodge.airDodging);
    assertTrue(canAttack(fighter));

    advanceSolo(fighter, 0, controls({ airDodgePressed: true, dodgeX: -1 }), -240.0);
    assertFalse(fighter.dodge.airDodging);
    advanceSolo(fighter, 0, controls({ jumpPressed: true }), -240.0);
    assertEquals(fighter.jump.remaining, 0);
    assertTrue(fighter.dodge.airUsed);
  }
});

test("a diagonal air dodge displaces both axes with the same decayed vector [reference]", () => {
  for (const direction of [-1, 1]) {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 300.0;
    beginAirDodge(fighter, 1, direction);
    const input = controls();
    let displacement = 12.982479095458984;
    let distance = 0.0;
    for (let frame = 1; frame <= 29; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      distance = f32(distance + displacement);
      assertNear(fighter.motion.x, distance, 0.0010000000474974513);
      assertNear(fighter.motion.z, 300 + direction * distance, 0.0010000000474974513);
      assertNear(fighter.motion.vx, displacement, 0.0010000000474974513);
      assertNear(fighter.motion.vz, direction * displacement, 0.0010000000474974513);
      displacement = f32(displacement * 0.8999999761581421);
    }
  }
});

test("an air dodge landing slides and restores actions after ten ticks [reference] [spec docs/gameplay-design.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const fighter = createReferenceFighter(character, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 1.0;
    beginAirDodge(fighter, 1, -1);
    const input = controls();
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
    assertFalse(canAttack(fighter));
    const landingSpeed = fighter.motion.vx;
    input.direction = -1;
    for (let tick = 1; tick <= 9; tick++) {
      const previousX = fighter.motion.x;
      advanceSolo(fighter, 0, input, 0.0);
      assertGreaterThan(fighter.motion.x, previousX);
      assertNear(fighter.motion.vx, landingSpeed - tick * GROUND_TRACTION, 0.0010000000474974513);
      assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG - tick);
      assertFalse(canAttack(fighter));
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.landing.lag, 0);
    assertTrue(canAttack(fighter));
    assertNear(fighter.motion.vx, -11.399999618530273, 0.0010000000474974513);
    assertEquals(fighter.ground.dashFrame, 1);
  }
});

test("a blast zone removes exactly one stock [spec docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, (stageBounds(0).blast.right - 2.0), 1);
  fighter.motion.vx = 100.0;
  const input = controls({ direction: 1 });
  const step = () => advanceSolo(fighter, 0, input, -240.0);
  step();
  assertTrue(fighter.status.out);
  assertEquals(fighter.status.stocks, 2);
  for (let ticks = 0; ticks < 130; ticks++) step();
  assertEquals(fighter.status.stocks, 2);
  assertFalse(fighter.status.out);
  fighter.motion.x = (stageBounds(0).blast.right + 0.0009765625);
  step();
  assertEquals(fighter.status.stocks, 1);
  while (fighter.status.respawn > 0) step();
  fighter.motion.x = (stageBounds(0).blast.right + 0.0009765625);
  step();
  assertEquals(fighter.status.stocks, 0);
  assertTrue(fighter.status.out);
  const finalX = fighter.motion.x;
  step();
  assertEquals(fighter.motion.x, finalX);
});

test("the top blast zone requires launch knockback rather than jump speed [reference] [spec docs/physics.md]", () => {
  for (const mode of [0, 1, 2]) {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = (stageBounds(0).blast.top + 1.0);
    fighter.motion.vz = 30.0;
    fighter.launch.knockbackZ = mode === 0 ? 0.0 : mode === 1 ? TOP_KO_MINIMUM_UPWARD_KNOCKBACK : f32(TOP_KO_MINIMUM_UPWARD_KNOCKBACK + 0.0010000000474974513);
    advanceSolo(fighter, 0, controls(), 0.0);
    assertEquals(fighter.status.out, mode === 2);
    assertEquals(fighter.status.stocks, mode === 2 ? 2 : 3);
  }
});

