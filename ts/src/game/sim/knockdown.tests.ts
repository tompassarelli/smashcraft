
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { collectDamageContact } from "./contacts";
import { AttackPhase, AttackStyle, Character, ContactKind, DownState } from "./codes";
import { DOWN_RECOVERY_INTANGIBLE_FRAMES, attackPhase, canAttack, isIntangible, isTumbling } from "./conditions";
import { DOWN_BOUND_FRAMES, DOWN_WAIT_FRAMES } from "./down";
import { type Fighter, createFighter } from "./fighter";
import { DIAGONAL_UNIT } from "./knockback";
import { DOWN_ATTACK_DAMAGE, DOWN_ATTACK_FRAMES, DOWN_ATTACK_STARTUP_FRAMES, attackStartupFrames } from "./moves";
import { totalVelocityZ } from "./motion";
import type { Controls, Roster } from "./roster";
import { advanceFighter } from "./step";
import { advanceSolo, contactBatch, controls, hitEffect, resolveStartedAttack, seedTechWindow, testBeginAttacks, testWorld } from "./testWorld";

test("tumble blocks actions until hitstun ends [spec docs/physics.md]", () => {
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

test("tumble can be air dodged after hitstun but not during it [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
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

test("a tumble landing runs bound and wait, then fresh recovery choices [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
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

test("a held recovery starts at the bound's end without another press [spec docs/physics.md]", () => {
  for (const direction of [-1, 0, 1]) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
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

test("a recovery attack on the bound transition isn't discarded [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  fighter.down.state = DownState.bound;
  fighter.down.frame = DOWN_BOUND_FRAMES;
  advanceSolo(fighter, 0, controls({ getupAttackPressed: true, verticalDirection: 1 }), 0.0);
  assertEquals(fighter.down.state, DownState.attack);
});


function landTumbling(fighter: Fighter, input: Readonly<Controls>): void {
  fighter.motion.grounded = false;
  fighter.motion.z = 1.0;
  fighter.motion.vz = -2.0;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 1;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.down.state, DownState.bound);
}


// DownBound accepts get-up attacks pressed fewer than common +0x24C = 60 frames ago (ftCo_DownBound_Anim, ftCo_80098400).

const MELEE_BOUND_ATTACK_PRESS_AGE_LIMIT = 60;

test("a get-up attack pressed during the bound starts as it ends, ahead of a held roll [reference]", () => {
  assertGreaterThan(MELEE_BOUND_ATTACK_PRESS_AGE_LIMIT, DOWN_BOUND_FRAMES);
  for (const pressFrame of [1, DOWN_BOUND_FRAMES - 1]) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    landTumbling(fighter, controls({ getupAttackPressed: true }));
    for (let frame = 1; frame < DOWN_BOUND_FRAMES; frame++) {
      advanceSolo(fighter, 0, controls({ getupAttackPressed: frame === pressFrame, direction: frame === DOWN_BOUND_FRAMES - 1 ? -1 : 0 }), 0.0);
      assertEquals(fighter.down.state, DownState.bound);
    }
    advanceSolo(fighter, 0, controls({ direction: -1 }), 0.0);
    assertEquals(fighter.down.state, DownState.attack);
  }
  const landingPressOnly = createFighter(Character.rifleman, 0.0, 1);
  landTumbling(landingPressOnly, controls({ getupAttackPressed: true }));
  for (let frame = 1; frame <= DOWN_BOUND_FRAMES; frame++) advanceSolo(landingPressOnly, 0, controls(), 0.0);
  assertEquals(landingPressOnly.down.state, DownState.wait);
});

test("a held roll at the bound's end beats an attack pressed on that frame [reference]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  fighter.down.state = DownState.bound;
  fighter.down.frame = DOWN_BOUND_FRAMES;
  advanceSolo(fighter, 0, controls({ getupAttackPressed: true, direction: -1, verticalDirection: 1 }), 0.0);
  assertEquals(fighter.down.state, DownState.roll);
  assertEquals(fighter.down.direction, -1);
});

const analog = (x: number, z: number) => controls({ diStickValid: true, diStickX: x, diStickZ: z });

test("get-up rolls and stands follow Melee's stick tilt and angle [reference]", () => {
  // Common +0x248/+0x244 = 0.2 tilt, +0x020 = 50 degrees above horizontal (ftCo_Down.c ftCo_Down_CheckInput, ftCo_DownStand.c).
  const cases: readonly (readonly [number, number, DownState, number])[] = [
    [0.19999998807907104, 0.0, DownState.wait, 0],
    [0.20000000298023224, 0.0, DownState.roll, 1],
    [-0.5, -0.5, DownState.roll, -1],
    [0.6560590267181396, 0.7547096014022827, DownState.roll, 1],
    [-0.6293203830718994, 0.7771459817886353, DownState.stand, 0],
    [0.0, 0.20000000298023224, DownState.stand, 0],
    [0.0, 0.19999998807907104, DownState.wait, 0],
    [0.0, -1.0, DownState.wait, 0],
  ];
  for (const [x, z, state, direction] of cases) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    fighter.down.state = DownState.wait;
    fighter.down.waitRemaining = DOWN_WAIT_FRAMES;
    advanceSolo(fighter, 0, analog(x, z), 0.0);
    assertEquals(fighter.down.state, state);
    assertEquals(fighter.down.direction, direction);
  }
});

test("a floor tech rolls only past Melee's sideways tilt [reference]", () => {
  // Common +0x254 = 0.2 (ftCo_PassiveStand.c ftCo_80098928).
  for (const [x, state] of [[0.19999998807907104, DownState.tech], [-0.20000000298023224, DownState.techRoll]] as const) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    seedTechWindow(fighter, 10);
    fighter.motion.grounded = false;
    fighter.motion.z = 1.0;
    fighter.motion.vz = -2.0;
    fighter.down.state = DownState.tumble;
    advanceSolo(fighter, 0, analog(x, 0.0), 0.0);
    assertEquals(fighter.down.state, state);
  }
});

test("tumble ends only on a fresh sideways flick past Melee's threshold [reference]", () => {
  // Common +0x210 = 0.8 on the frame the stick crosses +0x008 = 0.25 (+0x214 = 1; ftCo_DamageFall.c ftCo_DamageFall_IASA).
  const sequences: readonly (readonly [readonly Controls[], boolean])[] = [
    [[analog(0.0, 0.0), analog(-0.800000011920929, 0.0)], true],
    [[analog(0.0, 0.0), analog(0.7999999523162842, 0.0)], false],
    [[analog(0.30000001192092896, 0.0), analog(0.8999999761581421, 0.0)], false],
    [[controls(), controls({ direction: -1, verticalDirection: 1 })], false],
    [[controls(), controls({ direction: 1 })], true],
  ];
  for (const [inputs, exits] of sequences) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.surface = undefined;
    fighter.motion.z = 400.0;
    fighter.down.state = DownState.tumble;
    for (const input of inputs) advanceSolo(fighter, 0, input, 0.0);
    assertEquals(isTumbling(fighter), !exits);
  }
});

test("a jab reset compares the damage summed over the frame's contacts [reference]", () => {
  // melee:src/melee/ft/kinds/ftCommon/ftCo_DownDamage.c:290 tests the frame's summed percentTemp (ftcoll.c:370) against +0x428 = 7.
  for (const [contacts, reset] of [[1, true], [2, false]] as const) {
    const attacker = createFighter(Character.rifleman, 0.0, 1);
    const lying = createFighter(Character.rifleman, 60.0, -1);
    lying.down.state = DownState.wait;
    lying.down.waitRemaining = DOWN_WAIT_FRAMES;
    const world = testWorld(attacker, lying);
    const weak = hitEffect(4.0, 100.0, 20.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
    contactBatch(world, () => {
      for (let index = 0; index < contacts; index++) collectDamageContact(world, 0, 1, weak, 1, ContactKind.launch, true, undefined, false);
    });
    assertEquals(lying.down.state, reset ? DownState.damage : DownState.none);
  }
});

test("hitlag still pauses a held knockdown recovery [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
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

test("a down wait autostands, and a press starts the get-up attack [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
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
});


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

const opposite = (character: Character) => (character === Character.rifleman ? Character.rifleman : Character.rifleman);

test("a clean low-percent get-up attack gives the attacker time before the wake-up attack, for both characters and sides [provisional]", () => {
  for (const character of [Character.demonHunter, Character.rifleman]) {
    for (const direction of [-1, 1]) {
      const attacker = createFighter(character, 0.0, direction);
      const target = createFighter(opposite(character), 0.0, -direction);
      const world = testWorld(attacker, target);
      runGetupAttackToContact(world, attacker, target, direction, 100.0);
      assertEquals(target.status.damage, DOWN_ATTACK_DAMAGE);
      assertEquals(target.down.state, DownState.tumble);
      const hitstunAtContact = target.launch.hitstun;
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
      assertEquals(attackerActiveFrame, attackerReadyFrame + attackStartupFrames(AttackStyle.jab, attacker.tuning.moves));
      assertEquals(victimWakeupActiveFrame, 67);
    }
  }
});

test("a clean get-up attack recovers before a successful tech, for both characters and sides [provisional]", () => {
  for (const character of [Character.demonHunter, Character.rifleman]) {
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

test("a get-up attack on a shield doesn't grant the clean hit's frame advantage [provisional]", () => {
  const attacker = createFighter(Character.rifleman, 0.0, 1);
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

test("a down wait is vulnerable, but early get-up recovery is intangible [spec docs/physics.md]", () => {
  const waiting = createFighter(Character.rifleman, 100.0, -1);
  waiting.down.state = DownState.wait;
  resolveStartedAttack(testWorld(createFighter(Character.rifleman, 0.0, 1), waiting), AttackStyle.jab);
  assertGreaterThan(waiting.status.damage, 0.0);
  const standing = createFighter(Character.rifleman, 100.0, -1);
  standing.down.state = DownState.stand;
  standing.down.frame = 1;
  assertTrue(isIntangible(standing));
  resolveStartedAttack(testWorld(createFighter(Character.rifleman, 0.0, 1), standing), AttackStyle.jab);
  assertEquals(standing.status.damage, 0.0);
  standing.down.frame = DOWN_RECOVERY_INTANGIBLE_FRAMES + 1;
  assertFalse(isIntangible(standing));
  resolveStartedAttack(testWorld(createFighter(Character.rifleman, 0.0, 1), standing), AttackStyle.jab);
  assertGreaterThan(standing.status.damage, 0.0);
  standing.down.state = DownState.roll;
  standing.down.frame = 1;
  assertTrue(isIntangible(standing));
  standing.down.state = DownState.attack;
  standing.down.frame = DOWN_ATTACK_STARTUP_FRAMES;
  assertTrue(isIntangible(standing));
});
