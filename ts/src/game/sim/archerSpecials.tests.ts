// Archer's hippogryph ride and call-and-dive through the production special,
// motion and contact path (smashcraft:docs/design/archer-specials.md).
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, HippogryphKind, SpecialAction } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { canAttack } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { applyAttackHit } from "./hits";
import { type Controls, type Roster, createRoster } from "./roster";
import {
  ARCHER_CALL_FRAMES, ARCHER_DIVE_LAUNCH_FRAME, ARCHER_LEAP_RISE, ARCHER_RIDE_FRAMES, ARCHER_RIDE_HOVER_FRAMES, ARCHER_RIDE_LOW_RISE,
  ARCHER_RIDE_MAX_X, ARCHER_RIDE_RISE, ARCHER_SWOOP_FRAMES, advanceSpecials, startFighterSpecial,
} from "./specials";
import { advanceFighter } from "./step";
import { HIPPOGRYPH_DIVE_ARRIVAL } from "./summons";
import { controls } from "./testWorld";

function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, inputs);
  finishDamageContacts(world);
}

function pair(archerX: number, targetX: number): { world: Roster; archer: Fighter; target: Fighter } {
  const archer = createFighter(Character.archer, archerX, 1);
  const target = createFighter(Character.rifleman, targetX, -1);
  const world = createRoster(3, [archer, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, archer, target };
}

/** Archer high in the air, far from the target. */
function airborne(): { world: Roster; archer: Fighter; target: Fighter } {
  const setup = pair(0.0, 550.0);
  const { motion } = setup.archer;
  motion.grounded = false;
  motion.surface = undefined;
  motion.z = 400.0;
  motion.vz = 0.0;
  motion.vx = 0.0;
  setup.archer.jump.remaining = 1;
  return setup;
}

const up = controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 });
const down = controls({ specialPressed: true, specialZ: -1, down: true });

function hitArcher(world: Roster): void {
  beginDamageContacts();
  applyAttackHit(world, 1, 0, AttackStyle.jab, -1, { damage: 4.0, growth: 50.0, base: 30.0, launchX: 0.0, launchZ: 1.0, electric: false }, true, false);
  finishDamageContacts(world);
}

test("archerRideHoversThenRisesSteeredByTheStickAndEndsHelpless", () => {
  const { world, archer } = airborne();
  frame(world, up);
  assertEquals(archer.special.action, SpecialAction.archerRecovery);
  assertEquals(archer.hippogryph.kind, HippogryphKind.mount);
  const hoverStart = archer.motion.z;
  for (let i = 1; i < ARCHER_RIDE_HOVER_FRAMES; i++) frame(world);
  assertTrue(f32(archer.motion.z - hoverStart) < 12.0);
  const rideStart = archer.motion.z;
  const steer = controls({ direction: 1 });
  let riding = 0;
  while (archer.special.action === SpecialAction.archerRecovery) {
    frame(world, steer);
    riding++;
  }
  assertEquals(riding, ARCHER_RIDE_FRAMES - ARCHER_RIDE_HOVER_FRAMES);
  assertTrue(archer.special.fall);
  assertGreaterThan(f32(archer.motion.z - rideStart), f32(ARCHER_RIDE_RISE * 30));
  assertGreaterThan(archer.motion.x, f32(ARCHER_RIDE_MAX_X * 15));
});

test("archerRideLowRouteFliesFlatterThanTheHighRoute", () => {
  const high = airborne();
  const low = airborne();
  frame(high.world, up);
  frame(low.world, up);
  for (let i = 1; i < 30; i++) {
    frame(high.world, controls({ direction: 1 }));
    frame(low.world, controls({ direction: 1, down: true }));
  }
  assertEquals(low.archer.motion.vz, ARCHER_RIDE_LOW_RISE);
  assertGreaterThan(f32(high.archer.motion.z - low.archer.motion.z), 150.0);
  assertEquals(high.archer.motion.x, low.archer.motion.x);
});

test("archerLeapsOffActionableWithoutASecondRideUntilSheLands", () => {
  const { world, archer } = airborne();
  frame(world, up);
  for (let i = 1; i < 10; i++) frame(world);
  frame(world, controls({ jumpPressed: true }));
  assertEquals(archer.special.action, SpecialAction.archerRecovery);
  frame(world, controls({ jumpPressed: true }));
  assertEquals(archer.special.action, SpecialAction.none);
  assertTrue(!archer.special.fall);
  assertEquals(archer.motion.vz, ARCHER_LEAP_RISE);
  assertEquals(archer.hippogryph.kind, HippogryphKind.released);
  frame(world);
  assertTrue(canAttack(archer));
  archer.special.cooldowns[SpecialAction.archerRecovery] = 0;
  frame(world, up);
  assertEquals(archer.special.action, SpecialAction.none);
  for (let i = 0; i < 400 && !archer.motion.grounded; i++) frame(world);
  assertTrue(archer.motion.grounded);
  for (let i = 0; i < 90; i++) frame(world);
  frame(world, up);
  assertEquals(archer.special.action, SpecialAction.archerRecovery);
});

test("archerLeapOffLeavesTheHippogryphStrikingUpward", () => {
  const { world, archer, target } = airborne();
  frame(world, up);
  for (let i = 1; i < 14; i++) frame(world);
  target.motion.x = archer.motion.x;
  target.motion.z = f32(archer.motion.z + 120.0);
  target.motion.grounded = false;
  target.motion.surface = undefined;
  frame(world, controls({ jumpPressed: true }));
  for (let i = 0; i < 6 && target.status.damage === 0; i++) frame(world);
  assertEquals(target.status.damage, 6.0);
  assertGreaterThan(target.launch.knockbackZ, 0.0);
});

test("archerHitDuringTheRideHoverKnocksHerOffTheMount", () => {
  const { world, archer } = airborne();
  frame(world, up);
  frame(world);
  hitArcher(world);
  assertEquals(archer.special.action, SpecialAction.none);
  assertEquals(archer.hippogryph.life, 0);
  assertTrue(!archer.special.fall);
});

test("archerCallSwoopsThroughTheGapThenPerches", () => {
  const { world, archer, target } = pair(0.0, 200.0);
  frame(world, down);
  assertEquals(archer.special.action, SpecialAction.archerDisengage);
  assertTrue(archer.motion.grounded);
  for (let i = 1; i < ARCHER_SWOOP_FRAMES && archer.hippogryph.kind === HippogryphKind.strike; i++) frame(world);
  assertEquals(target.status.damage, 8.0);
  assertEquals(archer.hippogryph.kind, HippogryphKind.perch);
  assertGreaterThan(archer.hippogryph.x, 300.0);
  assertTrue(archer.motion.grounded);
  for (let i = 0; i < ARCHER_CALL_FRAMES; i++) frame(world);
  assertEquals(archer.hippogryph.kind, HippogryphKind.perch);
});

test("archerCallWithASideFacesItAndHopsBackFromIt", () => {
  for (const side of [1, -1]) {
    const { world, archer } = pair(0.0, 550.0);
    frame(world, controls({ specialPressed: true, specialZ: -1, specialX: side, down: true, direction: side }));
    assertEquals(archer.facing, side);
    assertTrue(!archer.motion.grounded);
    assertTrue(f32(archer.motion.vx * side) < 0);
    assertEquals(archer.hippogryph.kind, HippogryphKind.strike);
    assertGreaterThan(f32(archer.hippogryph.velocityX * side), 0.0);
  }
});

/** A perched hippogryph ahead of a grounded archer at the origin, the target far away. */
function perched(): { world: Roster; archer: Fighter; target: Fighter } {
  const setup = pair(0.0, 550.0);
  frame(setup.world, down);
  while (setup.archer.hippogryph.kind !== HippogryphKind.perch) frame(setup.world);
  while (setup.archer.special.action !== SpecialAction.none) frame(setup.world);
  return setup;
}

function dive(world: Roster, archer: Fighter): void {
  archer.special.cooldowns[SpecialAction.archerDisengage] = 0;
  frame(world, down);
  assertEquals(archer.special.action, SpecialAction.archerDisengage);
  for (let i = 1; i < ARCHER_DIVE_LAUNCH_FRAME + HIPPOGRYPH_DIVE_ARRIVAL + 8; i++) frame(world);
}

test("archerDiveStrikesAFighterBetweenThePerchAndHer", () => {
  const { world, archer, target } = perched();
  target.motion.x = 180.0;
  dive(world, archer);
  assertEquals(target.status.damage, 9.0);
  assertTrue(target.launch.knockbackX < 0);
  assertEquals(archer.hippogryph.kind, HippogryphKind.none);
});

test("archerDiveMissesAFighterOffItsLine", () => {
  const { world, archer, target } = perched();
  target.motion.x = -400.0;
  dive(world, archer);
  assertEquals(target.status.damage, 0.0);
});

test("archerDiveIsBlockedByAShield", () => {
  const { world, archer, target } = perched();
  target.motion.x = 180.0;
  for (let i = 0; i < 10; i++) frame(world, controls(), controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 }));
  const energy = target.shield.energy;
  archer.special.cooldowns[SpecialAction.archerDisengage] = 0;
  frame(world, down, controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 }));
  for (let i = 1; i < ARCHER_DIVE_LAUNCH_FRAME + HIPPOGRYPH_DIVE_ARRIVAL + 8; i++) {
    frame(world, controls(), controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 }));
  }
  assertEquals(target.status.damage, 0.0);
  assertTrue(target.shield.energy < f32(energy - 2.0));
});

test("archerHitScaresTheHippogryphOffItsPerch", () => {
  const { world, archer } = perched();
  hitArcher(world);
  frame(world);
  assertEquals(archer.hippogryph.life, 0);
  assertEquals(archer.hippogryph.kind, HippogryphKind.none);
});

test("archerRideSpendsThePerch", () => {
  const { world, archer } = perched();
  frame(world, up);
  assertEquals(archer.special.action, SpecialAction.archerRecovery);
  assertEquals(archer.hippogryph.kind, HippogryphKind.mount);
});
