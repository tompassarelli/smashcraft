// Tumble, knockdown, getting up and the get-up attack's frame advantage.
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackPhase, AttackStyle, Character, DownState } from "./codes";
import { DOWN_RECOVERY_INTANGIBLE_FRAMES, attackPhase, canAttack, isIntangible, isTumbling } from "./conditions";
import { DOWN_BOUND_FRAMES, DOWN_WAIT_FRAMES } from "./down";
import { type Fighter, createFighter } from "./fighter";
import { ORDINARY_HIT_CONTEXT_SCALE, ORDINARY_HIT_GROWTH_PERCENT, ordinaryHitKnockback, ordinaryHitstunFrames } from "./knockback";
import { DOWN_ATTACK_ACTIVE_FRAMES, DOWN_ATTACK_BASE_KNOCKBACK, DOWN_ATTACK_DAMAGE, DOWN_ATTACK_FRAMES, DOWN_ATTACK_STARTUP_FRAMES } from "./moves";
import { totalVelocityZ } from "./motion";
import type { Roster } from "./roster";
import { advanceFighter } from "./step";
import { advanceSolo, controls, resolveStartedAttack, testBeginAttacks, testWorld } from "./testWorld";

test("tumble blocks actions until hitstun ends", () => {
  const target = createFighter(Character.rifleman, 100.0, -1);
  target.motion.z = 400.0;
  target.down.state = DownState.tumble;
  target.launch.hitstun = 20;
  const input = controls({ jumpPressed: true });
  advanceSolo(target, 0, input, 240.0);
  assertEquals(target.down.state, DownState.tumble);
  assertEquals(target.jump.serial, 0);
  input.jumpPressed = false;
  const remaining = target.launch.hitstun;
  for (let frame = 0; frame <= remaining; frame++) advanceSolo(target, 0, input, 240.0);
  assertEquals(target.launch.hitstun, 0);
  input.jumpPressed = true;
  advanceSolo(target, 0, input, 240.0);
  assertEquals(target.jump.serial, 1);
  assertEquals(target.down.state, DownState.none);
});

test("tumble can be air dodged after hitstun but not during it", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls({ airDodgePressed: true });
  fighter.motion.grounded = false;
  fighter.motion.z = 100.0;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 2;
  advanceSolo(fighter, 0, input, 0.0);
  assertFalse(fighter.dodge.airDodging);
  assertEquals(fighter.launch.hitstun, 1);
  advanceSolo(fighter, 0, input, 0.0);
  assertTrue(fighter.dodge.airDodging);
  assertEquals(fighter.down.state, DownState.none);
});

test("a tumble landing runs bound and wait, then fresh recovery choices", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls();
  fighter.motion.grounded = false;
  fighter.motion.z = 1.0;
  fighter.motion.vz = -2.0;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 1;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.down.state, DownState.bound);
  assertTrue(fighter.motion.grounded);
  for (let frame = 1; frame <= DOWN_BOUND_FRAMES; frame++) advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.down.state, DownState.wait);
  input.getupDirectionPressed = true;
  input.getupDirection = -1;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.down.state, DownState.roll);
  assertEquals(fighter.down.direction, -1);
});

test("a held recovery starts at the bound's end without another press", () => {
  for (const direction of [-1, 0, 1]) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    fighter.down.state = DownState.bound;
    fighter.down.frame = DOWN_BOUND_FRAMES - 1;
    const input = controls({ direction, verticalDirection: direction === 0 ? 1 : 0 });
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.down.state, DownState.bound);
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.down.state, direction === 0 ? DownState.stand : DownState.roll);
    assertEquals(fighter.down.direction, direction);
  }
});

test("a recovery attack on the bound transition isn't discarded", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.down.state = DownState.bound;
  fighter.down.frame = DOWN_BOUND_FRAMES;
  advanceSolo(fighter, 0, controls({ getupAttackPressed: true, direction: -1, verticalDirection: 1 }), 0.0);
  assertEquals(fighter.down.state, DownState.attack);
});

test("hitlag still pauses a held knockdown recovery", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls({ direction: 1 });
  fighter.down.state = DownState.bound;
  fighter.down.frame = DOWN_BOUND_FRAMES;
  fighter.launch.hitlag = 2;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.down.state, DownState.bound);
  assertEquals(fighter.down.frame, DOWN_BOUND_FRAMES);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.launch.hitlag, 0);
  assertEquals(fighter.down.state, DownState.roll);
});

test("a down wait autostands, and the get-up attack has its own hitbox", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const opponent = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(fighter, opponent);
  const input = controls();
  fighter.down.state = DownState.wait;
  fighter.down.frame = DOWN_WAIT_FRAMES - 1;
  fighter.down.waitRemaining = 1;
  advanceFighter(world, 0, 0, input, 0.0);
  assertEquals(fighter.down.state, DownState.stand);
  fighter.down.state = DownState.wait;
  fighter.down.frame = 0;
  fighter.down.waitRemaining = DOWN_WAIT_FRAMES;
  input.getupAttackPressed = true;
  advanceFighter(world, 0, 0, input, 0.0);
  assertEquals(fighter.down.state, DownState.attack);
  assertEquals(attackPhase(fighter), AttackPhase.startup);
  for (let frame = 1; frame <= DOWN_ATTACK_STARTUP_FRAMES; frame++) advanceFighter(world, 0, 0, input, 0.0);
  assertEquals(attackPhase(fighter), AttackPhase.active);
  for (let frame = 1; frame <= DOWN_ATTACK_ACTIVE_FRAMES; frame++) {
    resolveAttacks(world);
    advanceFighter(world, 0, 0, input, 0.0);
  }
  assertEquals(opponent.status.damage, DOWN_ATTACK_DAMAGE);
});

/** Starts slot 0's get-up attack from a down wait and runs both fighters to its contact. */
function runGetupAttackToContact(world: Roster, attacker: Fighter, target: Fighter, direction: number, distance: number): void {
  attacker.facing = direction;
  attacker.motion.grounded = true;
  attacker.motion.surface = 0;
  attacker.down.state = DownState.wait;
  attacker.down.frame = 0;
  attacker.down.waitRemaining = DOWN_WAIT_FRAMES;
  target.facing = -direction;
  target.motion.x = f32(attacker.motion.x + f32(direction * distance));
  target.motion.z = 0.0;
  target.motion.grounded = true;
  target.motion.surface = 0;
  const input = controls({ shield: target.shield.raised, getupAttackPressed: true });
  advanceFighter(world, 0, 0, input, 0.0);
  input.getupAttackPressed = false;
  for (let tick = 1; tick <= DOWN_ATTACK_STARTUP_FRAMES; tick++) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighter(world, 1, 0, input, 0.0);
    resolveAttacks(world);
  }
}

const opposite = (character: Character) => (character === Character.archer ? Character.rifleman : Character.archer);

test("a clean low-percent get-up attack gives the attacker time before the wake-up attack, for both characters and sides", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const direction of [-1, 1]) {
      const attacker = createFighter(character, 0.0, direction);
      const target = createFighter(opposite(character), 0.0, -direction);
      const world = testWorld(attacker, target);
      runGetupAttackToContact(world, attacker, target, direction, 100.0);
      assertEquals(target.status.damage, DOWN_ATTACK_DAMAGE);
      assertEquals(target.down.state, DownState.tumble);
      const hitstunAtContact = target.launch.hitstun;
      const knockback = ordinaryHitKnockback(0.0, DOWN_ATTACK_DAMAGE, character === Character.archer ? 80.0 : 75.0,
        ORDINARY_HIT_GROWTH_PERCENT, DOWN_ATTACK_BASE_KNOCKBACK, ORDINARY_HIT_CONTEXT_SCALE);
      assertEquals(hitstunAtContact, ordinaryHitstunFrames(knockback));
      assertGreaterThan(hitstunAtContact, DOWN_ATTACK_FRAMES - attacker.down.frame);
      let attackerReadyFrame = -1;
      let attackerActiveFrame = -1;
      let victimWakeupActiveFrame = -1;
      const neutral = controls();
      const victimInput = controls();
      for (let frame = 1; frame <= 90; frame++) {
        advanceFighter(world, 0, 0, neutral, 0.0);
        victimInput.getupAttackPressed = target.down.state === DownState.wait;
        advanceFighter(world, 1, 0, victimInput, 0.0);
        if (victimWakeupActiveFrame < 0 && attackPhase(target) === AttackPhase.active) victimWakeupActiveFrame = frame;
        if (attackerReadyFrame < 0 && canAttack(attacker)) {
          attackerReadyFrame = frame;
          testBeginAttacks(world, AttackStyle.jab, undefined);
        }
        if (attackerActiveFrame < 0 && attacker.attack.style === AttackStyle.jab && attackPhase(attacker) === AttackPhase.active) attackerActiveFrame = frame;
      }
      assertGreaterThan(attackerReadyFrame, 0);
      assertGreaterThan(attackerActiveFrame, attackerReadyFrame);
      assertGreaterThan(victimWakeupActiveFrame, attackerActiveFrame);
      assertEquals(attackerReadyFrame, 37);
      assertEquals(attackerActiveFrame, 41);
      assertEquals(victimWakeupActiveFrame, character === Character.archer ? 67 : 63);
    }
  }
});

test("a clean get-up attack recovers before a successful tech, for both characters and sides", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const direction of [-1, 1]) {
      const attacker = createFighter(character, 0.0, direction);
      const target = createFighter(opposite(character), 0.0, -direction);
      const world = testWorld(attacker, target);
      runGetupAttackToContact(world, attacker, target, direction, 100.0);
      const neutral = controls();
      const defender = controls();
      let pressedTech = false;
      let landedTech = false;
      let attackerReady = -1;
      let defenderReady = -1;
      for (let frame = 1; frame <= 100; frame++) {
        defender.techPressed = !pressedTech && target.launch.hitlag === 0 && isTumbling(target) && totalVelocityZ(target) < 0 && target.motion.z < 50;
        pressedTech = pressedTech || defender.techPressed;
        advanceFighter(world, 0, 0, neutral, 0.0);
        advanceFighter(world, 1, 0, defender, 0.0);
        landedTech = landedTech || target.down.state === DownState.tech;
        if (attackerReady < 0 && canAttack(attacker)) attackerReady = frame;
        if (defenderReady < 0 && canAttack(target)) defenderReady = frame;
      }
      assertTrue(landedTech);
      assertEquals(attackerReady, 37);
      assertGreaterThan(defenderReady, attackerReady);
    }
  }
});

test("a get-up attack on a shield doesn't grant the clean hit's frame advantage", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(attacker, target);
  target.shield.raised = true;
  runGetupAttackToContact(world, attacker, target, 1, 100.0);
  assertEquals(target.status.damage, 0.0);
  assertGreaterThan(target.shield.stun, 0);
  assertEquals(target.down.state, DownState.none);
  const neutral = controls();
  let attackerReady = -1;
  let defenderReady = -1;
  for (let frame = 1; frame <= 60; frame++) {
    advanceFighter(world, 0, 0, neutral, 0.0);
    advanceFighter(world, 1, 0, neutral, 0.0);
    if (attackerReady < 0 && canAttack(attacker)) attackerReady = frame;
    if (defenderReady < 0 && canAttack(target)) defenderReady = frame;
  }
  assertGreaterThan(defenderReady, 0);
  assertGreaterThan(attackerReady, defenderReady);
});

test("a get-up attack whiff applies no hitlag or hitstun", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  runGetupAttackToContact(testWorld(attacker, target), attacker, target, 1, 160.0);
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.launch.hitstun, 0);
  assertEquals(target.launch.hitlag, 0);
  assertEquals(attacker.launch.hitlag, 0);
  assertFalse(attacker.attack.hit);
});

test("a down wait is vulnerable, but early get-up recovery is intangible", () => {
  const waiting = createFighter(Character.rifleman, 100.0, -1);
  waiting.down.state = DownState.wait;
  resolveStartedAttack(testWorld(createFighter(Character.archer, 0.0, 1), waiting), AttackStyle.jab);
  assertGreaterThan(waiting.status.damage, 0.0);
  const standing = createFighter(Character.rifleman, 100.0, -1);
  standing.down.state = DownState.stand;
  standing.down.frame = 1;
  assertTrue(isIntangible(standing));
  resolveStartedAttack(testWorld(createFighter(Character.archer, 0.0, 1), standing), AttackStyle.jab);
  assertEquals(standing.status.damage, 0.0);
  standing.down.frame = DOWN_RECOVERY_INTANGIBLE_FRAMES + 1;
  assertFalse(isIntangible(standing));
  resolveStartedAttack(testWorld(createFighter(Character.archer, 0.0, 1), standing), AttackStyle.jab);
  assertGreaterThan(standing.status.damage, 0.0);
  standing.down.state = DownState.roll;
  standing.down.frame = 1;
  assertTrue(isIntangible(standing));
  standing.down.state = DownState.attack;
  standing.down.frame = DOWN_ATTACK_STARTUP_FRAMES;
  assertTrue(isIntangible(standing));
});
