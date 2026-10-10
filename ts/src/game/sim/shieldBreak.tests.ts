
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { max, toInt } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, DownState, ShieldBreak } from "./codes";
import { canAttack, isIntangible } from "./conditions";
import { type Fighter } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { beginAirDodge, beginJump } from "./jumpsAndDodges";
import { attackStartupFrames, GRAB_HOLD_FRAMES } from "./moves";
import type { Controls } from "./roster";
import { shieldBreakDizzyFrames } from "./shield";
import { advanceSolo, controls, testBeginAttacks, testWorld } from "./testWorld";
import { SHIELD_BREAK_LAND_FRAMES, SHIELD_BREAK_STAND_FRAMES } from "./tuning";

const BREAK_PHASES = [ShieldBreak.air, ShieldBreak.land, ShieldBreak.stand, ShieldBreak.dizzy] as const;

function shieldBreakTestFighter(character: Character, percent: number): Fighter {
  const fighter = createReferenceFighter(character, 0.0, 1);
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

test("the forced shield-break sequence rejects actions and techs for both characters [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const fighter = shieldBreakTestFighter(character, 0.0);
    const world = testWorld(fighter, createReferenceFighter(character === Character.sylvanas ? Character.rifleman : Character.sylvanas, 100.0, -1));
    const input = controls({
      direction: 1, down: true, shield: true, jumpPressed: true, jumpHeld: true, airDodgePressed: true, dodgeX: 1,
      groundDodgePressed: true, groundDodgeDirection: 1, techPressed: true, getupAttackPressed: true,
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
      beginJump(fighter, 0);
      beginAirDodge(fighter, 1, 0);
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

test("dizzy length follows percent, and fresh mash edges shorten its exact tick count [reference]", () => {
  for (const mode of [0, 1, 2]) {
    const fighter = shieldBreakTestFighter(Character.sylvanas, mode === 0 ? 100.0 : 0.0);
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
  const fractional = shieldBreakTestFighter(Character.sylvanas, 100.25);
  const fractionalInput = controls();
  dizzyShieldBreakTest(fractional, fractionalInput);
  assertNear(fractional.shield.breakRemaining, 389.75, f32(0.0001));
  fractionalInput.mashPressed = true;
  advanceSolo(fractional, 0, fractionalInput, 0.0);
  assertNear(fractional.shield.breakRemaining, 385.75, f32(0.0001));
});

test("flinching damage and grabs interrupt every shield-break phase [reference]", () => {
  for (const state of BREAK_PHASES) {
    for (const attack of [AttackStyle.jab, AttackStyle.grab]) {
      const fighter = shieldBreakTestFighter(Character.sylvanas, 0.0);
      dizzyShieldBreakTest(fighter, controls());
      fighter.shield.breakState = state;
      const attacker = createReferenceFighter(Character.sylvanas, -50.0, 1);
      const world = testWorld(attacker, fighter);
      testBeginAttacks(world, attack, undefined);
      attacker.attack.frame = attackStartupFrames(attack);
      resolveAttacks(world);
      assertEquals(fighter.shield.breakState, ShieldBreak.none);
      assertEquals(fighter.shield.breakFrame, 0);
      assertEquals(fighter.shield.breakRemaining, 0.0);
      assertEquals(fighter.shield.breakSerial, 1);
      if (attack === AttackStyle.jab) {
        assertGreaterThan(fighter.launch.hitstun, 0);
      } else {
        assertEquals(fighter.grab.grabbedFrames, GRAB_HOLD_FRAMES);
      }
    }
  }
});
