import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep } from "../../../runtime/sweep";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { updateProjectiles } from "../projectiles";
import { advancePlacedObjects } from "../placedObjects";
import { regenerateMana } from "../mana";
import { isAerialAttack } from "../moves";
import { cancelSpecialState } from "../transitions";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls, testGrabFrame } from "../testWorld";
import { authoredPhysics, melee } from "../tuning";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { fighterCoverage } from "../../match/botCoverage";
import { JAINA_MOVES } from "./jainaMoves";
import { SELECTABLE_CHARACTERS } from "./registry";

test("Jaina body takes weight, run speed and air speed from Melee Zelda", () => {
  const body = authoredPhysics(Character.jaina);
  assertNear(body.weight, 90.0, f32(0.0001));
  assertNear(body.runSpeed, melee(f32(1.1)), f32(0.0001));
  assertNear(body.airSpeed, melee(f32(0.95)), f32(0.0001));
});

const NORMALS = [
  [AttackStyle.jab, 5, 42.0, 0.0, 3.0], [AttackStyle.jab2, 5, 48.0, 0.0, 4.0],
  [AttackStyle.forwardTilt, 9, 88.0, 0.0, 8.0], [AttackStyle.forwardTiltUp, 9, 85.0, 45.0, 8.0],
  [AttackStyle.forwardTiltDown, 9, 85.0, -35.0, 8.0], [AttackStyle.upTilt, 8, 0.0, 80.0, 7.0],
  [AttackStyle.downTilt, 7, 75.0, -38.0, 6.0], [AttackStyle.dashAttack, 11, 80.0, 0.0, 10.0],
  [AttackStyle.forwardSmash, 19, 148.0, 0.0, 17.0], [AttackStyle.upSmash, 18, 0.0, 112.0, 16.0],
  [AttackStyle.downSmash, 17, 96.0, -34.0, 13.0], [AttackStyle.neutralAir, 8, 50.0, 0.0, 8.0],
  [AttackStyle.forwardAir, 12, 96.0, 0.0, 12.0], [AttackStyle.backAir, 9, -75.0, 0.0, 11.0],
  [AttackStyle.upAir, 10, 0.0, 108.0, 11.0], [AttackStyle.downAir, 16, 0.0, -112.0, 12.0],
] as const;

test("Jaina every normal hits once in both facings, never in startup", () => {
  for (const facing of [-1, 1]) for (const [style, first, x, z, damage] of NORMALS) {
    const owner = createFighter(Character.jaina, 0.0, facing);
    const victim = createFighter(Character.rifleman, f32(x * facing), -facing);
    owner.motion.grounded = !isAerialAttack(style);
    victim.motion.z = z;
    const world = createRoster(3, [owner, victim]);
    beginFighterAttack(world, 0, style, false);
    owner.attack.frame = first - 2;
    resolveAttacks(world);
    assertEquals(victim.status.damage, 0.0, `startup ${style}`);
    owner.attack.frame++;
    resolveAttacks(world);
    assertEquals(victim.status.damage, damage, `contact ${style}`);
    owner.launch.hitlag = 0;
    owner.attack.frame++;
    resolveAttacks(world);
    assertEquals(victim.status.damage, damage, `one hit ${style}`);
  }
});

test("Jaina grabs shields and all four throws release once toward their chosen direction", () => {
  for (const facing of [-1, 1]) for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const owner = createFighter(Character.jaina, 0.0, facing);
    const victim = createFighter(Character.rifleman, f32(48.0 * facing), -facing);
    owner.motion.grounded = true;
    victim.motion.grounded = true;
    victim.shield.raised = true;
    const world = createRoster(3, [owner, victim]);
    beginFighterAttack(world, 0, AttackStyle.grab, false);
    owner.attack.frame = 8;
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
    const move = JAINA_MOVES.throws[action];
    assertTrue(move !== undefined);
    if (move === undefined) return;
    const input = controls({ grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0,
      grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0 });
    for (let tick = 1; tick < move.contactFrame; tick++) {
      testGrabFrame(world, [input, controls()], false);
      assertEquals(victim.status.damage, 0.0);
    }
    testGrabFrame(world, [input, controls()], false);
    assertEquals(victim.status.damage, move.effect.damage);
    assertEquals(victim.grab.owner, undefined);
    assertTrue(victim.launch.throwHitstun);
    assertGreaterThan(victim.launch.knockbackZ, 0.0);
    if (action === GrabAction.throwBack) assertLessThan(victim.launch.knockbackX * facing, 0.0);
    else if (action === GrabAction.throwUp) assertEquals(victim.launch.knockbackX, 0.0);
    else assertGreaterThan(victim.launch.knockbackX * facing, 0.0);
  }
});

test("Jaina pummel uses the shared escape window and releases after one strike", () => {
  const owner = createFighter(Character.jaina, 0.0, 1);
  const victim = createFighter(Character.rifleman, 48.0, -1);
  owner.motion.grounded = true;
  victim.motion.grounded = true;
  const world = createRoster(3, [owner, victim]);
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  owner.attack.frame = 8;
  resolveAttacks(world);
  assertEquals(owner.grab.target, 1);
  for (let tick = 1; tick < 60; tick++) {
    testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
    assertEquals(victim.status.damage, 0.0);
  }
  testGrabFrame(world, [controls(), controls()], false);
  assertEquals(victim.status.damage, 3.0);
  for (let tick = 61; tick <= 69; tick++) testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
  assertEquals(owner.grab.pummels, 1);
  assertEquals(victim.grab.owner, undefined);
  assertEquals(victim.status.damage, 3.0);
});

function frame(world: Roster, input: Controls = controls()): void {
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, slot === 0 ? input : controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  startFighterSpecial(world.fighters[0]!, 0, 0, input);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, [input, controls()]);
  updateProjectiles(world);
  advancePlacedObjects(world);
  finishDamageContacts(world);
}
function pair(distance: number) {
  const jaina = createFighter(Character.jaina, -200.0, 1);
  const victim = createFighter(Character.rifleman, f32(-200.0 + distance), -1);
  const world = createRoster(3, [jaina, victim]);
  for (let tick = 0; tick < 3; tick++) frame(world);
  return { jaina, victim, world };
}

test("Jaina Frostbolt spends six mana, spawns on frame 17 and hits a distant body once", () => {
  const { jaina, victim, world } = pair(350.0);
  frame(world, controls({ specialPressed: true }));
  assertEquals(jaina.special.action, SpecialAction.heroNeutral);
  assertEquals(jaina.mana.points, 94);
  for (let tick = 2; tick < 17; tick++) frame(world);
  assertEquals(jaina.projectiles.filter(p => p.life > 0).length, 0);
  frame(world);
  assertEquals(jaina.projectiles.filter(p => p.life > 0).length, 1);
  for (let tick = 18; tick < 60 && victim.status.damage === 0.0; tick++) frame(world);
  assertEquals(victim.status.damage, 7.0);
});

test("Jaina Blizzard telegraphs twenty frames, hits its patch and vanishes when interrupted", () => {
  const { jaina, victim, world } = pair(f32(HERO_REFERENCE_HEIGHT * f32(1.6)));
  frame(world, controls({ specialPressed: true, specialX: 1 }));
  assertEquals(jaina.mana.points, 82);
  for (let tick = 2; tick <= 27; tick++) frame(world);
  assertEquals(victim.status.damage, 0.0);
  frame(world);
  assertEquals(victim.status.damage, 5.0);
  const interrupted = pair(700.0);
  frame(interrupted.world, controls({ specialPressed: true, specialX: 1 }));
  for (let tick = 2; tick <= 8; tick++) frame(interrupted.world);
  assertEquals(interrupted.jaina.projectiles.filter(p => p.life > 0).length, 2);
  cancelSpecialState(interrupted.jaina);
  interrupted.jaina.launch.hitstun = 20;
  frame(interrupted.world);
  assertEquals(interrupted.jaina.projectiles.filter(p => p.life > 0).length, 0);
});

test("Jaina Blink gives paid and empty-mana aimed recovery then helpless fall", () => {
  for (const mana of [100, 0]) for (const direction of [-1, 1]) {
    const { jaina, world } = pair(800.0);
    jaina.motion.grounded = false;
    jaina.motion.surface = undefined;
    jaina.motion.z = 350.0;
    jaina.mana.points = mana;
    frame(world, controls({ specialPressed: true, specialX: direction, specialZ: 1 }));
    assertEquals(jaina.special.action, SpecialAction.heroUp);
    for (let tick = 2; tick < 14; tick++) frame(world, controls({ direction, verticalDirection: 1 }));
    const before = jaina.motion.x;
    frame(world, controls({ direction, verticalDirection: 1 }));
    frame(world, controls({ direction, verticalDirection: 1 }));
    assertGreaterThan(f32(f32(jaina.motion.x - before) * direction), mana === 0 ? 120.0 : 190.0);
    for (let tick = 16; tick <= 36; tick++) frame(world);
    assertTrue(jaina.special.fall);
    assertEquals(jaina.jump.remaining, 0);
  }
});

test("Jaina Water Elemental is placed on frame 27, fires, restores in snapshots and recalls", () => {
  const { jaina, victim, world } = pair(360.0);
  frame(world, controls({ specialPressed: true, specialZ: -1 }));
  assertEquals(jaina.mana.points, 76);
  for (let tick = 2; tick < 27; tick++) frame(world);
  assertEquals(jaina.placed.life, 0);
  frame(world);
  assertGreaterThan(jaina.placed.life, 0);
  const copy = createFighter(Character.jaina, 0.0, 1);
  copyFighterState(copy, jaina, 3);
  assertEquals(firstFighterDifference(jaina, copy, 3, 3), undefined);
  for (let tick = 28; tick <= 95 && victim.status.damage === 0.0; tick++) frame(world);
  assertEquals(victim.status.damage, 5.0);
  assertTrue(jaina.projectiles.every(p => p.life === 0 || p.kind === ProjectileKind.hero));
  frame(world, controls({ specialPressed: true, specialZ: -1 }));
  for (let tick = 2; tick <= 27; tick++) frame(world);
  assertEquals(jaina.placed.life, 0);
});

test("Jaina Brilliance regenerates six grounded and two aerial mana per second but stops during casting", () => {
  for (const grounded of [true, false]) {
    const jaina = createFighter(Character.jaina, 0.0, 1);
    jaina.motion.grounded = grounded;
    jaina.mana.points = 40;
    for (let tick = 0; tick < 60; tick++) regenerateMana(jaina);
    assertEquals(jaina.mana.points, grounded ? 46 : 42);
    jaina.special.action = SpecialAction.heroNeutral;
    for (let tick = 0; tick < 60; tick++) regenerateMana(jaina);
    assertEquals(jaina.mana.points, grounded ? 46 : 42);
  }
});

sweep("Jaina computer uses all four spells in eight Wren Expert matches before roster publication", () => {
  const choices: Character[] = SELECTABLE_CHARACTERS.filter(character => character !== Character.jaina);
  choices.push(Character.jaina);
  const report = fighterCoverage(choices.length - 1, undefined, choices);
  assertEquals(report.matches, 8);
  assertEquals(report.missing.join(", "), "", report.fighter);
  assertGreaterThan(report.movement, 0);
  assertGreaterThan(report.attacks, 0);
  assertGreaterThan(report.specials.neutral, 0);
  assertGreaterThan(report.specials.side, 0);
  assertGreaterThan(report.specials.up, 0);
  assertGreaterThan(report.specials.down, 0);
  assertEquals(report.manaDenied, 0);
});
