import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { isIntangible } from "../conditions";
import { createFighter } from "../fighter";
import { AUTHORED_PHYSICS } from "../tuning";
import { advanceHeroStatus } from "../heroSpecialRules";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { advancePlacedObjects } from "../placedObjects";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster, fighterAt } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { checkBlastZone } from "../stocks";
import { controls, testGrabFrame } from "../testWorld";
import { clearSpecialOnStock } from "../transitions";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { ROSTER_MANA } from "../mana";
import { TINKER_MOVES } from "./tinkerMoves";
import { TINKER_SPECIALS } from "./tinkerSpecials";

const FACTORY = TINKER_SPECIALS.side.ground.placement!;
const ROBO_DAMAGE = TINKER_SPECIALS.down.ground.regions![0]!.hit.effect.damage;
const EX_MANA_LEFT = ROSTER_MANA.max - ROSTER_MANA.exCost;

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
  owner.mana.points = 100;
  const target = createFighter(Character.rifleman, f32(gap * facing), -facing);
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

test("Tinker forward smash finishes a 100% Rifleman from centre before hitstun ends, both facings [spec docs/design/tinker.md]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(100.0, facing);
    target.status.damage = 100.0;
    beginFighterAttack(world, 0, AttackStyle.forwardSmash, false);
    owner.attack.frame = attackStartupFrames(AttackStyle.forwardSmash, TINKER_MOVES);
    resolveAttacks(world);
    for (let tick = 0; tick < 120 && !target.status.out && target.launch.hitstun > 0; tick++) {
      advanceFighter(world, 1, 0, controls(), f32(240.0 * facing));
      checkBlastZone(world, 1);
    }
    assertTrue(target.status.out);
  }
});

for (const style of NORMALS) test(`Tinker normal ${style} hits once in its active window, both facings [spec docs/design/tinker.md]`, () => {
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
    const hit = target.status.damage;
    assertGreaterThan(hit, 0.0);
    assertGreaterThan(target.launch.hitstun, 0);
    owner.launch.hitlag = 0;
    owner.attack.frame++;
    resolveAttacks(world);
    assertEquals(target.status.damage, hit);
  }
});

test("Tinker grabs a shield and all four throws release once in their authored direction [spec docs/design/tinker.md]", () => {
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
    const thrown = target.status.damage;
    assertGreaterThan(thrown, 0.0);
    assertEquals(target.grab.owner, undefined);
    assertGreaterThan(target.launch.hitstun, 0);
    assertGreaterThan(target.launch.knockbackX * facing * (action === GrabAction.throwBack ? -1 : 1), 0.0);
    testGrabFrame(world, [input, controls()], false);
    assertEquals(target.status.damage, thrown);
  }
});

test("Tinker body preserves the named Ultimate ROB weight, run and air speed [reference] [spec docs/design/tinker.md]", () => {
  const f = createFighter(Character.tinker, 0.0, 1);
  const reference = AUTHORED_PHYSICS.reference;
  assertNear(f.tuning.physics.weight, 106.0, f32(0.001));
  assertNear(f.tuning.physics.runSpeed / reference.runSpeed, f32(f32(1.725) / f32(2.2)), f32(0.00001));
  assertNear(f.tuning.physics.airSpeed / reference.airSpeed, f32(f32(1.134) / f32(0.83)), f32(0.00001));
});

test("Tinker regular specials preserve the super meter, complete their frames and use rockets for an airborne side press [spec #335]", () => {
  for (const [input, action, end] of [[neutral, SpecialAction.heroNeutral, TINKER_SPECIALS.neutral.ground.endFrame], [side, SpecialAction.heroSide, TINKER_SPECIALS.side.ground.endFrame], [up, SpecialAction.heroUp, TINKER_SPECIALS.up.ground.endFrame], [down, SpecialAction.heroDown, TINKER_SPECIALS.down.ground.endFrame]] as const) {
    const { owner, world } = pair();
    frame(world, input);
    assertEquals(owner.special.action, action);
    assertEquals(owner.mana.points, 100);
    for (let tick = 2; tick <= end; tick++) frame(world);
    assertEquals(owner.special.action, SpecialAction.none);
    assertEquals(owner.mana.points, 100);
  }
  const airborne = pair();
  airborne.owner.motion.grounded = false;
  airborne.owner.motion.z = 250.0;
  frame(airborne.world, side);
  assertEquals(airborne.owner.special.action, SpecialAction.heroNeutral);
  assertEquals(airborne.owner.placed.life, 0);
  assertEquals(airborne.owner.mana.points, 100);
});

test("Tinker rockets fire three staggered contacts [spec docs/design/tinker.md]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(200.0, facing);
    frame(world, neutral);
    const firstRocket = TINKER_SPECIALS.neutral.ground.projectiles![0]!.spawnFrame;
    for (let tick = 2; tick < firstRocket; tick++) frame(world);
    assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
    frame(world);
    assertEquals(owner.projectiles.filter(p => p.life > 0).length, 1);
    for (let tick = firstRocket + 1; tick <= 60; tick++) frame(world);
    assertGreaterThan(target.status.damage, 0.0);
  }
});

test("Tinker factory fires Clockwerk Goblins, recalls and resets with the stock [spec docs/design/tinker.md]", () => {
  const { owner, world } = pair();
  frame(world, side);
  for (let tick = 2; tick <= FACTORY.frame; tick++) frame(world);
  assertEquals(owner.placed.age, 1);
  assertEquals(owner.placed.life, FACTORY.life - 1);
  assertEquals(owner.placed.durability, FACTORY.durability);
  for (let tick = 25; tick <= 59; tick++) frame(world);
  assertTrue(owner.projectiles.some(p => p.life > 0 && p.spec?.model?.includes("HeroTinkerRobot") === true));
  frame(world, side);
  assertEquals(owner.mana.points, 100);
  for (let tick = 2; tick <= 36; tick++) frame(world);
  assertEquals(owner.placed.life, 0);
  clearSpecialOnStock(owner);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
});

test("Tinker boots steer both ways, have a free recovery and end helpless without an aerial jump [spec docs/design/tinker.md]", () => {
  for (const points of [100, 0]) for (const direction of [-1, 1]) {
    const { owner, world } = pair();
    owner.mana.points = points;
    frame(world, up);
    for (let tick = 2; tick <= 32; tick++) frame(world, controls({ direction }));
    assertGreaterThan(owner.motion.z, 235.0);
    assertGreaterThan(owner.motion.x * direction, 30.0);
    assertEquals(owner.jump.remaining, 0);
    assertTrue(owner.special.fall);
    assertEquals(owner.mana.points, points);
    frame(world, up);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("Tinker Robo-Goblin hits once and its running state survives a rollback copy [spec docs/design/tinker.md] [invariant]", () => {
  const { owner, target, world } = pair(120.0);
  frame(world, down);
  for (let tick = 2; tick <= 18; tick++) frame(world);
  assertEquals(target.status.damage, ROBO_DAMAGE);
  const restored = createFighter(Character.tinker, 0.0, 1);
  copyFighterState(restored, owner, 3);
  assertEquals(firstFighterDifference(owner, restored, 3, 3), undefined);
  for (let tick = 0; tick < 60; tick++) frame(world);
  assertEquals(target.status.damage, ROBO_DAMAGE);
});

test("Tinker Robo-Goblin armor takes one light hit and then a second hit interrupts it [spec docs/design/tinker.md]", () => {
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

test("Tinker pummel strikes once [spec docs/design/tinker.md]", () => {
  const { owner, target, world } = pair(40.0);
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  owner.attack.frame = 7;
  resolveAttacks(world);
  testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
  for (let tick = 0; tick < 80; tick++) testGrabFrame(world, [controls(), controls()], false);
  assertEquals(target.status.damage, TINKER_MOVES.throws[GrabAction.pummel]!.effect.damage);

});

test("Tinker EX Robo-Goblin deals a quarter more damage in both facings [spec #329]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(120.0, facing);
    frame(world, controls({ specialPressed: true, specialZ: -1, shield: true }));
    assertTrue(owner.special.ex);
    assertEquals(owner.mana.points, EX_MANA_LEFT);
    for (let tick = 2; tick <= 18; tick++) frame(world);
    assertEquals(target.status.damage, f32(ROBO_DAMAGE * 1.25));
  }
});

test("Tinker EX factory retains its extra durability after casting and EX recall protects four entry frames [spec #329]", () => {
  const { owner, world } = pair();
  frame(world, controls({ specialPressed: true, specialX: 1, shield: true }));
  for (let tick = 2; tick <= 48; tick++) frame(world);
  assertEquals(owner.placed.durability, f32(FACTORY.durability * 1.25));
  owner.mana.points = 100;
  frame(world, controls({ specialPressed: true, specialX: 1, shield: true }));
  assertTrue(isIntangible(owner));
  assertEquals(owner.mana.points, EX_MANA_LEFT);
  for (let tick = 2; tick <= 4; tick++) { frame(world); assertTrue(isIntangible(owner)); }
  frame(world);
  assertFalse(isIntangible(owner));
  for (let tick = 6; tick <= 36; tick++) frame(world);
  assertEquals(owner.placed.life, 0);
});
