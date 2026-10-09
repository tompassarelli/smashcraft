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
import { JAINA_SPECIALS } from "./jainaSpecials";
import { SELECTABLE_CHARACTERS } from "./registry";

test("Jaina body takes weight, run speed and air speed from Melee Zelda [reference] [spec docs/design/jaina.md]", () => {
  const body = authoredPhysics(Character.jaina);
  assertNear(body.weight, 90.0, f32(0.0001));
  assertNear(body.runSpeed, melee(f32(1.1)), f32(0.0001));
  assertNear(body.airSpeed, melee(f32(0.95)), f32(0.0001));
});

const NORMALS = ([
  [AttackStyle.jab, 42.0, 0.0], [AttackStyle.jab2, 48.0, 0.0],
  [AttackStyle.forwardTilt, 88.0, 0.0], [AttackStyle.forwardTiltUp, 85.0, 45.0],
  [AttackStyle.forwardTiltDown, 85.0, -35.0], [AttackStyle.upTilt, 0.0, 80.0],
  [AttackStyle.downTilt, 75.0, -38.0], [AttackStyle.dashAttack, 80.0, 0.0],
  [AttackStyle.forwardSmash, 148.0, 0.0], [AttackStyle.upSmash, 0.0, 112.0],
  [AttackStyle.downSmash, 96.0, -34.0], [AttackStyle.neutralAir, 50.0, 0.0],
  [AttackStyle.forwardAir, 96.0, 0.0], [AttackStyle.backAir, -75.0, 0.0],
  [AttackStyle.upAir, 0.0, 108.0], [AttackStyle.downAir, 0.0, -112.0],
] as const).map(([style, x, z]) => {
  const move = JAINA_MOVES.normals[style]!;
  return [style, move.startupFrames + 1, x, z, move.regions[0]!.hit.effect.damage] as const;
});

test("Jaina every normal hits once in both facings, never in startup [spec docs/design/jaina.md]", () => {
  for (const facing of [-1, 1]) for (const [style, first, x, z, damage] of NORMALS) {
    const owner = createFighter(Character.jaina, 0.0, facing);
  owner.mana.points = 100;
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

test("Jaina grabs shields and all four throws release once toward their chosen direction [spec docs/design/jaina.md]", () => {
  for (const facing of [-1, 1]) for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const owner = createFighter(Character.jaina, 0.0, facing);
  owner.mana.points = 100;
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
    assertGreaterThan(victim.status.damage, 0.0);
    assertEquals(victim.grab.owner, undefined);
    assertTrue(victim.launch.throwHitstun);
    assertGreaterThan(victim.launch.knockbackZ, 0.0);
    if (action === GrabAction.throwBack) assertLessThan(victim.launch.knockbackX * facing, 0.0);
    else if (action === GrabAction.throwUp) assertEquals(victim.launch.knockbackX, 0.0);
    else assertGreaterThan(victim.launch.knockbackX * facing, 0.0);
  }
});

test("Jaina pummel uses the shared escape window and releases after one strike [spec docs/design/jaina.md]", () => {
  const owner = createFighter(Character.jaina, 0.0, 1);
  owner.mana.points = 100;
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
  const pummel = JAINA_MOVES.throws[GrabAction.pummel]!.effect.damage;
  assertEquals(victim.status.damage, pummel);
  for (let tick = 61; tick <= 69; tick++) testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
  assertEquals(owner.grab.pummels, 1);
  assertEquals(victim.grab.owner, undefined);
  assertEquals(victim.status.damage, pummel);
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
  jaina.mana.points = 100;
  const victim = createFighter(Character.rifleman, f32(-200.0 + distance), -1);
  const world = createRoster(3, [jaina, victim]);
  for (let tick = 0; tick < 3; tick++) frame(world);
  return { jaina, victim, world };
}

test("Jaina Frostbolt preserves the super meter, spawns on frame 17 and hits a distant body once [spec #335]", () => {
  const { jaina, victim, world } = pair(350.0);
  frame(world, controls({ specialPressed: true }));
  assertEquals(jaina.special.action, SpecialAction.heroNeutral);
  assertEquals(jaina.mana.points, 100);
  for (let tick = 2; tick < 17; tick++) frame(world);
  assertEquals(jaina.projectiles.filter(p => p.life > 0).length, 0);
  frame(world);
  assertEquals(jaina.projectiles.filter(p => p.life > 0).length, 1);
  for (let tick = 18; tick < 60 && victim.status.damage === 0.0; tick++) frame(world);
  assertEquals(victim.status.damage, JAINA_SPECIALS.neutral.ground.projectiles![0]!.effect.damage);
});

test("Jaina Blizzard telegraphs twenty frames, hits its patch and vanishes when interrupted [spec docs/design/jaina.md]", () => {
  const { jaina, victim, world } = pair(f32(HERO_REFERENCE_HEIGHT * f32(1.6)));
  frame(world, controls({ specialPressed: true, specialX: 1 }));
  assertEquals(jaina.mana.points, 100);
  for (let tick = 2; tick <= 27; tick++) frame(world);
  assertEquals(victim.status.damage, 0.0);
  frame(world);
  assertEquals(victim.status.damage, JAINA_SPECIALS.side.ground.projectiles![0]!.effect.damage);
  const interrupted = pair(700.0);
  frame(interrupted.world, controls({ specialPressed: true, specialX: 1 }));
  for (let tick = 2; tick <= 8; tick++) frame(interrupted.world);
  assertEquals(interrupted.jaina.projectiles.filter(p => p.life > 0).length, 2);
  cancelSpecialState(interrupted.jaina);
  interrupted.jaina.launch.hitstun = 20;
  frame(interrupted.world);
  assertEquals(interrupted.jaina.projectiles.filter(p => p.life > 0).length, 0);
});

test("Jaina Blink gives full aimed recovery at every meter level then helpless fall [spec #335]", () => {
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
    assertGreaterThan(f32(f32(jaina.motion.x - before) * direction), 190.0);
    for (let tick = 16; tick <= 36; tick++) frame(world);
    assertTrue(jaina.special.fall);
    assertEquals(jaina.jump.remaining, 0);
  }
});

test("Jaina Water Elemental is placed on frame 27, fires, restores in snapshots and recalls [spec docs/design/jaina.md] [invariant]", () => {
  const { jaina, victim, world } = pair(360.0);
  frame(world, controls({ specialPressed: true, specialZ: -1 }));
  assertEquals(jaina.mana.points, 100);
  for (let tick = 2; tick < 27; tick++) frame(world);
  assertEquals(jaina.placed.life, 0);
  frame(world);
  assertGreaterThan(jaina.placed.life, 0);
  const copy = createFighter(Character.jaina, 0.0, 1);
  copyFighterState(copy, jaina, 3);
  assertEquals(firstFighterDifference(jaina, copy, 3, 3), undefined);
  for (let tick = 28; tick <= 95 && victim.status.damage === 0.0; tick++) frame(world);
  assertEquals(victim.status.damage, JAINA_SPECIALS.down.ground.placement!.shot!.effect.damage);
  assertTrue(jaina.projectiles.every(p => p.life === 0 || p.kind === ProjectileKind.hero));
  frame(world, controls({ specialPressed: true, specialZ: -1 }));
  for (let tick = 2; tick <= 27; tick++) frame(world);
  assertEquals(jaina.placed.life, 0);
});

sweep("Jaina computer casts each of her four spells at least twice in eight Wren Expert matches, on three seed offsets; each offset saw 7 or more [spec docs/design/jaina.md]", () => {
  const choices: Character[] = SELECTABLE_CHARACTERS.filter(character => character !== Character.jaina);
  choices.push(Character.jaina);
  for (const seedBase of [0, 1000, 50000]) {
    const report = fighterCoverage(choices.length - 1, undefined, choices, 8, seedBase);
    assertEquals(report.missing.join(", "), "", `${report.fighter} seeds ${seedBase}`);
    assertGreaterThan(report.movement, 0);
    assertGreaterThan(report.attacks, 0);
    const { neutral, side, up, down } = report.specials;
    assertEquals(`${seedBase} ${neutral > 1} ${side > 1} ${up > 1} ${down > 1}`, `${seedBase} true true true true`);
    assertEquals(report.manaDenied, 0);
  }
});
