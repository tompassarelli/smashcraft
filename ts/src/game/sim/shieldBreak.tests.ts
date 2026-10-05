// Shield break: the launch, landing, standing and dizzy phases and what ends them.
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "waygate/src/runtime/testing";
import { max, toInt } from "../../runtime/numbers";
import { f32 } from "waygate/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, DownState, ShieldBreak } from "./codes";
import { canAttack, isIntangible } from "./conditions";
import { type Fighter, SHIELD_MAX, createFighter } from "./fighter";
import { simulationAirDodge, simulationJump } from "./jumpsAndDodges";
import { attackStartupFrames, grabHoldFrames } from "./moves";
import { updateProjectiles } from "./projectiles";
import type { Controls } from "./roster";
import { shieldBreakDizzyFrames } from "./shield";
import { respawnFighter } from "./stocks";
import { advanceSolo, controls, soloWorld, testBeginAttacks, testWorld } from "./testWorld";
import { SHIELD_BREAK_LAND_FRAMES, SHIELD_BREAK_STAND_FRAMES } from "./tuning";

const BREAK_PHASES = [ShieldBreak.air, ShieldBreak.land, ShieldBreak.stand, ShieldBreak.dizzy] as const;

/** A fighter whose held shield drains out on its first frame. */
function shieldBreakTestFighter(character: Character, percent: number): Fighter {
  const fighter = createFighter(character, 0.0, 1);
  fighter.status.damage = percent;
  fighter.shield.raised = true;
  fighter.shield.energy = 0.10000000149011612;
  advanceSolo(fighter, 0, controls({ shield: true }), 0.0);
  return fighter;
}

function landShieldBreakTest(fighter: Fighter, input: Readonly<Controls>): void {
  fighter.motion.z = 1.0;
  fighter.motion.vz = -2.0;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.breakState, ShieldBreak.land);
  assertEquals(fighter.shield.breakFrame, 0);
}

function dizzyShieldBreakTest(fighter: Fighter, input: Readonly<Controls>): void {
  landShieldBreakTest(fighter, input);
  for (let tick = 1; tick <= SHIELD_BREAK_LAND_FRAMES + SHIELD_BREAK_STAND_FRAMES; tick++) advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.breakState, ShieldBreak.dizzy);
  assertEquals(fighter.shield.breakFrame, 0);
}

/** A blaster bolt about to reach a fighter at x = 0. */
function aimShot(shooter: Fighter): void {
  const shot = shooter.projectiles[0]!;
  shot.life = 2;
  shot.x = -30.0;
  shot.z = 45.0;
  shot.direction = 1;
}

test("the retail rig's shield break uses its own animation completion clocks", () => {
  for (const host of [Character.archer, Character.rifleman]) {
    const fighter = shieldBreakTestFighter(host, 100.0);
    const input = controls();
    fighter.tuning.shieldBreak = { landFrames: 26, standFrames: 30 };
    landShieldBreakTest(fighter, input);
    for (let tick = 1; tick <= 25; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.shield.breakState, ShieldBreak.land);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.stand);
    assertEquals(fighter.shield.breakFrame, 0);
    for (let tick = 1; tick <= 29; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.shield.breakState, ShieldBreak.stand);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.dizzy);
    assertEquals(fighter.shield.breakRemaining, 390.0);
  }
});

test("a shield break's dizzy expiry allows a jump on its completion tick", () => {
  for (const host of [Character.archer, Character.rifleman]) {
    const fighter = shieldBreakTestFighter(host, 400.0);
    const input = controls();
    dizzyShieldBreakTest(fighter, input);
    for (let tick = 1; tick <= 89; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.shield.breakState, ShieldBreak.dizzy);
      assertEquals(fighter.jump.squat, 0);
    }
    input.jumpPressed = true;
    input.jumpHeld = true;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.none);
    assertEquals(fighter.jump.squat, fighter.tuning.physics.jumpSquatFrames);
    assertNear(fighter.shield.energy, f32(30.07), f32(0.0001));
  }
});

test("shield-break hitlag keeps regeneration and blast-zone checks active", () => {
  const fighter = shieldBreakTestFighter(Character.archer, 0.0);
  const input = controls();
  fighter.launch.hitlag = 3;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.breakFrame, 0);
  assertNear(fighter.shield.energy, f32(0.14), f32(0.0001));
  fighter.motion.x = 921.0;
  advanceSolo(fighter, 0, input, 0.0);
  assertTrue(fighter.status.out);
  assertEquals(fighter.status.stocks, 2);
});

test("a drain and a projectile break the shield with the same pop and serial", () => {
  const fighter = shieldBreakTestFighter(Character.archer, 0.0);
  assertEquals(fighter.shield.breakState, ShieldBreak.air);
  assertEquals(fighter.shield.breakFrame, 0);
  assertEquals(fighter.shield.breakSerial, 1);
  assertFalse(fighter.shield.raised);
  assertEquals(fighter.launch.hitstun, 0);
  assertEquals(fighter.status.invincible, 0);
  const shooter = createFighter(Character.rifleman, -30.0, 1);
  const target = createFighter(Character.archer, 0.0, -1);
  target.shield.raised = true;
  target.shield.energy = 1.0;
  aimShot(shooter);
  updateProjectiles(testWorld(shooter, target));
  assertEquals(target.shield.breakState, ShieldBreak.air);
  assertEquals(target.shield.breakSerial, 1);
  assertEquals(target.motion.vz, fighter.motion.vz);
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.shield.energy, 30.0);
  assertEquals(target.launch.hitstun, 0);
});

test("the forced shield-break sequence rejects actions and techs for both characters", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = shieldBreakTestFighter(character, 0.0);
    const world = testWorld(fighter, createFighter(character === Character.archer ? Character.rifleman : Character.archer, 100.0, -1));
    const input = controls({
      direction: 1, down: true, shield: true, jumpPressed: true, jumpHeld: true, airDodgePressed: true, dodgeX: 1,
      groundDodgePressed: true, groundDodgeDirection: 1, techPressed: true, lCancelPressed: true, getupAttackPressed: true,
      getupStandPressed: true, getupDirectionPressed: true, getupDirection: 1, attackHeld: true,
    });
    let highest = 0.0;
    let ticks = 0;
    while (fighter.shield.breakState === ShieldBreak.air && ticks < 120) {
      advanceSolo(fighter, 0, input, 0.0);
      testBeginAttacks(world, AttackStyle.shot, undefined);
      assertEquals(fighter.attack.style, undefined);
      assertEquals(fighter.motion.x, 0.0);
      assertEquals(fighter.down.state, DownState.none);
      assertFalse(fighter.shield.raised);
      assertEquals(fighter.jump.serial, 0);
      assertFalse(fighter.dodge.airDodging);
      highest = max(highest, fighter.motion.z);
      ticks++;
    }
    assertGreaterThan(highest, 100.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.land);
    assertEquals(fighter.motion.surface, 0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.tech.window, 0);
    for (let tick = 1; tick <= SHIELD_BREAK_LAND_FRAMES - 1; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.shield.breakState, ShieldBreak.land);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.stand);
    assertEquals(fighter.shield.breakFrame, 0);
    for (let tick = 1; tick <= SHIELD_BREAK_STAND_FRAMES - 1; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.shield.breakState, ShieldBreak.stand);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.dizzy);
    assertNear(fighter.shield.energy, f32(30.07), f32(0.0001));
    const dizzyTicks = toInt(fighter.shield.breakRemaining);
    for (let tick = 1; tick <= dizzyTicks - 1; tick++) {
      simulationJump(fighter, 0);
      simulationAirDodge(fighter, 1, 0);
      testBeginAttacks(world, AttackStyle.grab, undefined);
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.shield.breakState, ShieldBreak.dizzy);
      assertNear(fighter.shield.energy, f32(30.07), f32(0.0001));
      assertEquals(fighter.attack.style, undefined);
      assertEquals(fighter.dodge.groundFrame, 0);
      assertEquals(fighter.jump.squat, 0);
      assertEquals(fighter.status.invincible, 0);
      assertFalse(isIntangible(fighter));
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.none);
    assertEquals(fighter.shield.breakFrame, 0);
    assertEquals(fighter.shield.breakSerial, 1);
    assertNear(fighter.shield.energy, f32(30.07), f32(0.0001));
    assertEquals(fighter.jump.squat, fighter.tuning.physics.jumpSquatFrames);
    assertFalse(canAttack(fighter));
    assertEquals(fighter.status.invincible, 0);
  }
});

test("dizzy length follows percent, and fresh mash edges shorten its exact tick count", () => {
  for (const mode of [0, 1, 2]) {
    const fighter = shieldBreakTestFighter(Character.archer, mode === 0 ? 100.0 : 0.0);
    const input = controls();
    dizzyShieldBreakTest(fighter, input);
    const expected = mode === 0 ? 390 : mode === 1 ? 487 : 123;
    for (let tick = 1; tick <= expected; tick++) {
      input.mashPressed = mode === 2 || (mode === 1 && tick === 1);
      advanceSolo(fighter, 0, input, 0.0);
      assertNear(fighter.shield.energy, f32(30.07), f32(0.0001));
      assertEquals(fighter.shield.breakState, tick === expected ? ShieldBreak.none : ShieldBreak.dizzy);
    }
    input.mashPressed = false;
    advanceSolo(fighter, 0, input, 0.0);
    assertNear(fighter.shield.energy, f32(30.14), f32(0.0001));
  }
  assertEquals(shieldBreakDizzyFrames(100.0), 390.0);
  assertNear(shieldBreakDizzyFrames(100.25), 389.75, f32(0.0001));
  assertEquals(shieldBreakDizzyFrames(400.0), 90.0);
  assertEquals(shieldBreakDizzyFrames(1000.0), 90.0);
  const fractional = shieldBreakTestFighter(Character.archer, 100.25);
  const fractionalInput = controls();
  dizzyShieldBreakTest(fractional, fractionalInput);
  assertNear(fractional.shield.breakRemaining, 389.75, f32(0.0001));
  fractionalInput.mashPressed = true;
  advanceSolo(fractional, 0, fractionalInput, 0.0);
  assertNear(fractional.shield.breakRemaining, 385.75, f32(0.0001));
});

test("shield-break hitlag freezes its motion, phase and mash", () => {
  for (const state of BREAK_PHASES) {
    const fighter = shieldBreakTestFighter(Character.archer, 0.0);
    const input = controls();
    if (state !== ShieldBreak.air) {
      dizzyShieldBreakTest(fighter, input);
      fighter.shield.breakState = state;
    }
    fighter.shield.breakFrame = 5;
    fighter.launch.hitlag = 3;
    const beforeZ = fighter.motion.z;
    const beforeVz = fighter.motion.vz;
    const remaining = fighter.shield.breakRemaining;
    input.mashPressed = true;
    for (let tick = 1; tick <= 2; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.shield.breakFrame, 5);
      assertEquals(fighter.shield.breakRemaining, remaining);
      assertEquals(fighter.motion.z, beforeZ);
      assertEquals(fighter.motion.vz, beforeVz);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.shield.breakFrame, 6);
  }
});

test("flinching damage and grabs interrupt every shield-break phase", () => {
  for (const state of BREAK_PHASES) {
    for (const attack of [AttackStyle.jab, AttackStyle.grab]) {
      const fighter = shieldBreakTestFighter(Character.archer, 0.0);
      dizzyShieldBreakTest(fighter, controls());
      fighter.shield.breakState = state;
      const attacker = createFighter(Character.rifleman, -50.0, 1);
      const world = testWorld(attacker, fighter);
      testBeginAttacks(world, attack, undefined);
      attacker.attack.frame = attackStartupFrames(attack);
      resolveAttacks(world);
      assertEquals(fighter.shield.breakState, ShieldBreak.none);
      assertEquals(fighter.shield.breakFrame, 0);
      assertEquals(fighter.shield.breakRemaining, 0.0);
      assertEquals(fighter.shield.breakSerial, 1);
      if (attack === AttackStyle.jab) {
        assertEquals(fighter.status.damage, 12.0);
        assertGreaterThan(fighter.launch.hitstun, 0);
      } else {
        assertEquals(fighter.grab.grabbedFrames, grabHoldFrames(fighter.status.damage));
      }
    }
  }
});

test("both fighters' basic projectiles interrupt a shield break", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = shieldBreakTestFighter(Character.archer, 0.0);
    dizzyShieldBreakTest(fighter, controls());
    const shooter = createFighter(character, -30.0, 1);
    aimShot(shooter);
    updateProjectiles(testWorld(shooter, fighter));
    assertEquals(fighter.status.damage, 3.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.none);
    assertEquals(fighter.launch.hitstun, 11);
    assertNear(fighter.shield.energy, f32(30.07), f32(0.0001));
  }
});

test("stock loss and respawning clear a shield-break recovery", () => {
  for (const state of BREAK_PHASES) {
    const fighter = shieldBreakTestFighter(Character.archer, 0.0);
    const input = controls();
    fighter.shield.breakState = state;
    fighter.motion.x = 921.0;
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(fighter.status.out);
    assertEquals(fighter.status.stocks, 2);
    assertEquals(fighter.shield.breakState, ShieldBreak.none);
    assertEquals(fighter.shield.breakFrame, 0);
    assertEquals(fighter.shield.breakRemaining, 0.0);
    for (let tick = 1; tick <= 60; tick++) advanceSolo(fighter, 0, input, 0.0);
    assertFalse(fighter.status.out);
    assertEquals(fighter.status.stocks, 2);
    assertEquals(fighter.shield.breakSerial, 0);
    assertEquals(fighter.status.invincible, 90);
    assertEquals(fighter.shield.energy, SHIELD_MAX);
    fighter.shield.breakState = state;
    fighter.shield.breakFrame = 10;
    respawnFighter(soloWorld(fighter), 0, 0.0);
    assertEquals(fighter.shield.breakState, ShieldBreak.none);
    assertEquals(fighter.shield.breakFrame, 0);
  }
});
