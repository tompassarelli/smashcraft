import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { advancePlacedObjects } from "../placedObjects";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster, fighterAt } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls, testGrabFrame } from "../testWorld";
import { clearSpecialOnStock } from "../transitions";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { TINKER_MOVES } from "./tinkerMoves";

function frame(world: Roster, input: Readonly<Controls> = controls()): void {
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, slot === 0 ? input : controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  startFighterSpecial(fighterAt(world, 0), 0, 0, input);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, [input, controls()]);
  updateProjectiles(world, 0, 0);
  advancePlacedObjects(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) advanceHeroStatus(fighterAt(world, slot));
}
function pair(gap = 900.0, facing = 1) {
  const owner = createFighter(Character.tinker, 0.0, facing);
  const target = createFighter(Character.archer, f32(gap * facing), -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { owner, target, world };
}
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

const NORMALS = [
  AttackStyle.jab, AttackStyle.jab2, AttackStyle.jab3, AttackStyle.forwardTilt,
  AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt,
  AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash,
  AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir,
] as const;
for (const style of NORMALS) test(`Tinker normal ${style} hits once in its active window, both facings`, () => {
  const move = TINKER_MOVES.normals[style]!;
  const region = move.regions[0]!;
  const strike = region.hit.strike!;
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(0.0, facing);
    owner.motion.grounded = !isAerialAttack(style);
    target.motion.x = f32(strike.x2 * facing);
    target.motion.z = f32(f32(strike.z1 + strike.z2) * 0.5 - 40.0);
    target.motion.grounded = false;
    beginFighterAttack(world, 0, style, false);
    assertEquals(owner.attack.style, style);
    owner.attack.frame = move.startupFrames - 1;
    resolveAttacks(world);
    assertEquals(target.status.damage, 0.0);
    owner.attack.frame = move.startupFrames;
    resolveAttacks(world);
    assertEquals(target.status.damage, region.hit.effect.damage);
    assertGreaterThan(target.launch.hitstun, 0);
    owner.launch.hitlag = 0;
    owner.attack.frame++;
    resolveAttacks(world);
    assertEquals(target.status.damage, region.hit.effect.damage);
  }
});

test("Tinker grabs a shield and all four throws release once in their authored direction", () => {
  for (const facing of [-1, 1]) for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const { owner, target, world } = pair(40.0, facing);
    target.shield.raised = true;
    beginFighterAttack(world, 0, AttackStyle.grab, false);
    owner.attack.frame = 7;
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
    const move = TINKER_MOVES.throws[action]!;
    const input = controls({ grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0, grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0 });
    for (let tick = 1; tick < move.contactFrame; tick++) {
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, 0.0);
    }
    testGrabFrame(world, [input, controls()], false);
    assertEquals(target.status.damage, move.effect.damage);
    assertEquals(target.grab.owner, undefined);
    assertGreaterThan(target.launch.hitstun, 0);
    assertGreaterThan(target.launch.knockbackX * facing * (action === GrabAction.throwBack ? -1 : 1), 0.0);
    testGrabFrame(world, [input, controls()], false);
    assertEquals(target.status.damage, move.effect.damage);
  }
});

test("Tinker body preserves the named Ultimate ROB weight, run and air speed", () => {
  const f = createFighter(Character.tinker, 0.0, 1);
  const archer = createFighter(Character.archer, 0.0, 1);
  assertNear(f.tuning.physics.weight, 106.0, f32(0.001));
  assertNear(f.tuning.physics.runSpeed / archer.tuning.physics.runSpeed, f32(f32(1.725) / f32(2.2)), f32(0.00001));
  assertNear(f.tuning.physics.airSpeed / archer.tuning.physics.airSpeed, f32(f32(1.134) / f32(0.83)), f32(0.00001));
});

test("Tinker specials spend once, complete their frames and use rockets for an airborne side press", () => {
  for (const [input, action, cost, end] of [[neutral, SpecialAction.heroNeutral, 10, 43], [side, SpecialAction.heroSide, 20, 48], [up, SpecialAction.heroUp, 15, 32], [down, SpecialAction.heroDown, 20, 46]] as const) {
    const { owner, world } = pair();
    frame(world, input);
    assertEquals(owner.special.action, action);
    assertEquals(owner.mana.points, 100 - cost);
    for (let tick = 2; tick <= end; tick++) frame(world);
    assertEquals(owner.special.action, SpecialAction.none);
    assertEquals(owner.mana.points, 100 - cost);
  }
  const airborne = pair();
  airborne.owner.motion.grounded = false;
  airborne.owner.motion.z = 250.0;
  frame(airborne.world, side);
  assertEquals(airborne.owner.special.action, SpecialAction.heroNeutral);
  assertEquals(airborne.owner.placed.life, 0);
  assertEquals(airborne.owner.mana.points, 90);
});

test("Tinker rockets fire three staggered contacts and charge Engineering Upgrade", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(200.0, facing);
    frame(world, neutral);
    for (let tick = 2; tick <= 13; tick++) frame(world);
    assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
    frame(world);
    assertEquals(owner.projectiles.filter(p => p.life > 0).length, 1);
    for (let tick = 15; tick <= 60; tick++) frame(world);
    assertGreaterThan(target.status.damage, 0.0);
    assertGreaterThan(owner.passive.stacks, 0);
    assertLessThan(owner.passive.stacks, 3);
  }
});

test("Tinker factory fires Clockwerk Goblins, recalls and resets with the stock", () => {
  const { owner, world } = pair();
  frame(world, side);
  for (let tick = 2; tick <= 24; tick++) frame(world);
  assertEquals(owner.placed.age, 1);
  assertEquals(owner.placed.life, 239);
  assertEquals(owner.placed.durability, 24.0);
  for (let tick = 25; tick <= 59; tick++) frame(world);
  assertTrue(owner.projectiles.some(p => p.life > 0 && p.spec?.model?.includes("HeroTinkerRobot") === true));
  frame(world, side);
  assertEquals(owner.mana.points, 80);
  for (let tick = 2; tick <= 36; tick++) frame(world);
  assertEquals(owner.placed.life, 0);
  clearSpecialOnStock(owner);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
});

test("Tinker boots steer both ways, have a free recovery and end helpless without an aerial jump", () => {
  for (const points of [100, 0]) for (const direction of [-1, 1]) {
    const { owner, world } = pair();
    owner.mana.points = points;
    frame(world, up);
    for (let tick = 2; tick <= 32; tick++) frame(world, controls({ direction }));
    assertGreaterThan(owner.motion.z, points === 0 ? 170.0 : 235.0);
    assertGreaterThan(owner.motion.x * direction, 30.0);
    assertEquals(owner.jump.remaining, 0);
    assertTrue(owner.special.fall);
    assertEquals(owner.mana.points, points === 0 ? 0 : 85);
    frame(world, up);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("Tinker Robo-Goblin hits once and its running state survives a rollback copy", () => {
  const { owner, target, world } = pair(120.0);
  frame(world, down);
  for (let tick = 2; tick <= 18; tick++) frame(world);
  assertEquals(target.status.damage, 13.0);
  const restored = createFighter(Character.tinker, 0.0, 1);
  copyFighterState(restored, owner, 3);
  assertEquals(firstFighterDifference(owner, restored, 3, 3), undefined);
  for (let tick = 0; tick < 60; tick++) frame(world);
  assertEquals(target.status.damage, 13.0);
});

test("Tinker Robo-Goblin armor takes one light hit and then a second hit interrupts it", () => {
  const { owner, target, world } = pair(45.0);
  frame(world, down);
  for (let tick = 2; tick <= 9; tick++) frame(world);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  target.attack.frame = attackStartupFrames(AttackStyle.jab, target.tuning.moves);
  resolveAttacks(world);
  assertGreaterThan(owner.status.damage, 0.0);
  assertEquals(owner.launch.hitstun, 0);
  assertEquals(owner.status.armorFrames, 0);
  owner.launch.hitlag = 0;
  target.launch.hitlag = 0;
  target.attack.style = undefined;
  target.attack.cooldown = 0;
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  target.attack.frame = attackStartupFrames(AttackStyle.jab, target.tuning.moves);
  resolveAttacks(world);
  assertGreaterThan(owner.launch.hitstun, 0);
  assertEquals(owner.special.action, SpecialAction.none);
});

test("Tinker pummel strikes once and Engineering Upgrade boosts a normal only once", () => {
  const { owner, target, world } = pair(40.0);
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  owner.attack.frame = 7;
  resolveAttacks(world);
  testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
  for (let tick = 0; tick < 80; tick++) testGrabFrame(world, [controls(), controls()], false);
  assertEquals(target.status.damage, 3.0);
  const upgraded = pair(50.0);
  upgraded.owner.passive.stacks = 2;
  upgraded.owner.passive.window = 240;
  beginFighterAttack(upgraded.world, 0, AttackStyle.jab, false);
  upgraded.owner.attack.frame = 3;
  resolveAttacks(upgraded.world);
  assertEquals(upgraded.target.status.damage, 7.0);
  assertEquals(upgraded.owner.passive.stacks, 0);
});
