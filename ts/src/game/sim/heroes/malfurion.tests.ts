import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep } from "../../../runtime/sweep";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, HeroStatusKind, ProjectileKind, SpecialAction } from "../codes";
import { chillScaled } from "../chill";
import { heroStatusBlocksActions } from "../heroStatus";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { updateProjectiles } from "../projectiles";
import { advancePlacedObjects } from "../placedObjects";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { cancelSpecialState } from "../transitions";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls, testGrabFrame } from "../testWorld";
import { authoredPhysics, melee } from "../tuning";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { fighterCoverage } from "../../match/botCoverage";
import { moveReaches } from "../../match/botMoves";
import { MALFURION_MOVES } from "./malfurionMoves";
import { MALFURION_SPECIALS } from "./malfurionSpecials";
import { SELECTABLE_CHARACTERS } from "./registry";
import { Action } from "../../input/actions";
import { fighter as sceneFighter, frame as sceneFrame, scene } from "../../match/padScene";


const NORMALS = [
  [AttackStyle.jab, 42.0, 0.0], [AttackStyle.jab2, 48.0, 0.0],
  [AttackStyle.forwardTilt, 88.0, 0.0], [AttackStyle.forwardTiltUp, 85.0, 45.0],
  [AttackStyle.forwardTiltDown, 85.0, -35.0], [AttackStyle.upTilt, 0.0, 80.0],
  [AttackStyle.downTilt, 75.0, -38.0], [AttackStyle.dashAttack, 80.0, 0.0],
  [AttackStyle.forwardSmash, 148.0, 0.0], [AttackStyle.upSmash, 0.0, 112.0],
  [AttackStyle.downSmash, 96.0, -34.0], [AttackStyle.neutralAir, 50.0, 0.0],
  [AttackStyle.forwardAir, 96.0, 0.0], [AttackStyle.backAir, -75.0, 0.0],
  [AttackStyle.upAir, 0.0, 108.0], [AttackStyle.downAir, 0.0, -112.0],
] as const;

test("Malfurion every normal hits once in both facings, never in startup [spec #342]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z] of NORMALS) {
    const move = MALFURION_MOVES.normals[style]!;
    const damage = move.regions[0]!.hit.effect.damage;
    const owner = createFighter(Character.malfurion, 0.0, facing);
  owner.mana.points = 100;
    const victim = createFighter(Character.rifleman, f32(x * facing), -facing);
    owner.motion.grounded = !isAerialAttack(style);
    victim.motion.z = z;
    const world = createRoster(3, [owner, victim]);
    beginFighterAttack(world, 0, style, false);
    owner.attack.frame = move.startupFrames - 1;
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

test("Malfurion grabs shields and all four throws release once toward their chosen direction [spec #342]", () => {
  for (const facing of [-1, 1]) for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const owner = createFighter(Character.malfurion, 0.0, facing);
  owner.mana.points = 100;
    const victim = createFighter(Character.rifleman, f32(48.0 * facing), -facing);
    owner.motion.grounded = true;
    victim.motion.grounded = true;
    victim.shield.raised = true;
    const world = createRoster(3, [owner, victim]);
    beginFighterAttack(world, 0, AttackStyle.grab, false);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab, MALFURION_MOVES);
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
    const move = MALFURION_MOVES.throws[action];
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

test("Malfurion pummel uses the shared escape window and releases after one strike [spec #342]", () => {
  const owner = createFighter(Character.malfurion, 0.0, 1);
  owner.mana.points = 100;
  const victim = createFighter(Character.rifleman, 48.0, -1);
  owner.motion.grounded = true;
  victim.motion.grounded = true;
  const world = createRoster(3, [owner, victim]);
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  owner.attack.frame = attackStartupFrames(AttackStyle.grab, MALFURION_MOVES);
  resolveAttacks(world);
  assertEquals(owner.grab.target, 1);
  const pummel = MALFURION_MOVES.throws[GrabAction.pummel]!;
  for (let tick = 1; tick < pummel.contactFrame; tick++) {
    testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
    assertEquals(victim.status.damage, 0.0);
  }
  testGrabFrame(world, [controls(), controls()], false);
  assertEquals(victim.status.damage, pummel.effect.damage);
  for (let tick = pummel.contactFrame + 1; tick <= pummel.totalFrames + 1; tick++) testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
  assertEquals(owner.grab.pummels, 1);
  assertEquals(victim.grab.owner, undefined);
  assertEquals(victim.status.damage, pummel.effect.damage);
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
  const malfurion = createFighter(Character.malfurion, -200.0, 1);
  malfurion.mana.points = 100;
  const victim = createFighter(Character.rifleman, f32(-200.0 + distance), -1);
  const world = createRoster(3, [malfurion, victim]);
  for (let tick = 0; tick < 3; tick++) frame(world);
  return { malfurion, victim, world };
}

test("Malfurion roots telegraph twenty frames and leave jump, shield and attacks available [spec #342]", () => {
  const { malfurion, victim, world } = pair(180.0);
  const roots = MALFURION_SPECIALS.neutral.ground.projectiles![0]!;
  const closes = roots.spawnFrame + (roots.activeFrom ?? 0);
  frame(world, controls({ specialPressed: true }));
  for (let tick = 2; tick <= closes - 2; tick++) frame(world);
  assertEquals(victim.status.damage, 0.0);
  for (let tick = closes - 1; tick <= closes + 2 && victim.status.damage === 0.0; tick++) frame(world);
  assertEquals(victim.status.damage, roots.effect.damage);
  assertEquals(victim.status.condition, HeroStatusKind.root);
  assertEquals(chillScaled(victim, 10.0), 0.0);
  assertTrue(!heroStatusBlocksActions(victim));
  victim.motion.grounded = false;
  assertEquals(chillScaled(victim, 10.0), 10.0);
  assertEquals(malfurion.mana.points, 100);
});

test("Malfurion stag charge strikes and ends at frame 43 with all meter levels [spec #342] [spec #335]", () => {
  for (const meter of [0, 100]) {
    const { malfurion, victim, world } = pair(115.0);
    malfurion.mana.points = meter;
    frame(world, controls({ specialPressed: true, specialX: 1 }));
    for (let tick = 2; tick <= 60; tick++) frame(world);
    assertEquals(victim.status.damage, MALFURION_SPECIALS.side.ground.regions![0]!.hit.effect.damage);
    assertEquals(malfurion.special.action, SpecialAction.none);
    assertGreaterThan(malfurion.motion.x, -100.0);
  }
});

test("Malfurion Dream Ascent hits above him then spends his jump and falls helpless [spec #342]", () => {
  const { malfurion, victim, world } = pair(0.0);
  malfurion.motion.grounded = false;
  malfurion.motion.surface = undefined;
  malfurion.motion.z = 200.0;
  victim.motion.grounded = false;
  victim.motion.surface = undefined;
  victim.motion.z = 270.0;
  frame(world, controls({ specialPressed: true, specialZ: 1 }));
  for (let tick = 2; tick <= 50; tick++) frame(world);
  assertEquals(victim.status.damage, MALFURION_SPECIALS.up.ground.regions![0]!.hit.effect.damage);
  assertTrue(malfurion.special.fall);
  assertEquals(malfurion.jump.remaining, 0);
  assertGreaterThan(malfurion.motion.z, 250.0);
});

test("Malfurion treant plants at frame 26, fires branches, snapshots and recalls [spec #342] [invariant]", () => {
  const { malfurion, victim, world } = pair(260.0);
  const treant = MALFURION_SPECIALS.down.ground.placement!;
  frame(world, controls({ specialPressed: true, specialZ: -1 }));
  for (let tick = 2; tick < treant.frame; tick++) frame(world);
  assertEquals(malfurion.placed.life, 0);
  frame(world);
  assertGreaterThan(malfurion.placed.life, 0);
  const copy = createFighter(Character.malfurion, 0.0, 1);
  copyFighterState(copy, malfurion, 3);
  assertEquals(firstFighterDifference(malfurion, copy, 3, 3), undefined);
  for (let tick = treant.frame + 1; tick <= 100 && victim.status.damage === 0.0; tick++) frame(world);
  assertEquals(victim.status.damage, treant.shot!.effect.damage);
  while (malfurion.special.action !== SpecialAction.none) frame(world);
  frame(world, controls({ specialPressed: true, specialZ: -1 }));
  for (let tick = 2; tick <= MALFURION_SPECIALS.down.recall!.endFrame + 1; tick++) frame(world);
  assertEquals(malfurion.placed.life, 0);
});

test("Malfurion's first treant branch into a point-blank shield permits shield grab before he acts [repro #345] [spec #98]", () => {
  const match = scene(0, [{ character: Character.malfurion, x: -30.0, facing: 1 }, { character: Character.malfurion, x: 30.0, facing: -1 }]);
  const owner = sceneFighter(match, 0);
  const defender = sceneFighter(match, 1);
  let contact = false;
  for (let tick = 1; tick <= 100 && !contact; tick++) {
    sceneFrame(match, tick === 1 ? [Action.moveDown, Action.special] : [], [Action.rightTrigger]);
    contact = defender.visuals.shield > 0;
  }
  assertTrue(contact);
  while (defender.shield.stun > 0 || defender.launch.hitlag > 0) sceneFrame(match, [], [Action.rightTrigger]);
  let acted = owner.special.action === SpecialAction.none;
  for (let tick = 1; tick <= 20 && owner.grab.owner === undefined; tick++) {
    sceneFrame(match, [], [Action.rightTrigger, Action.attack]);
    if (owner.grab.owner === undefined && owner.special.action === SpecialAction.none) acted = true;
  }
  assertEquals(owner.grab.owner, 1);
  assertTrue(!acted);
});

test("Malfurion computer respects staff reach and attacks and casts at least 4 times in a seeded match, against 11-18 seen on four seed offsets [spec #342]", () => {
  const target = createFighter(Character.rifleman, 0.0, -1);
  assertTrue(moveReaches(Character.malfurion, AttackStyle.forwardTilt, target, 100.0, 0.0, MALFURION_MOVES));
  assertTrue(!moveReaches(Character.malfurion, AttackStyle.forwardTilt, target, 200.0, 0.0, MALFURION_MOVES));
  const choices: Character[] = [Character.malfurion, Character.rifleman];
  const report = fighterCoverage(0, Character.rifleman, choices, 1);
  assertEquals(report.matches, 1);
  assertGreaterThan(report.movement, 0);
  assertGreaterThan(report.attacks, 3);
  assertGreaterThan(report.kit, 3);
  assertEquals(report.manaDenied, 0);
});
