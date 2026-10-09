import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, HeroStatusGroup, HeroStatusKind, SpecialAction } from "../codes";
import { chillScaled } from "../chill";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { updateProjectiles } from "../projectiles";
import { advancePlacedObjects } from "../placedObjects";
import { advanceHeroStatus } from "../heroSpecialRules";
import { advanceFighter } from "../step";
import { fighterAt, type Controls, type Roster } from "../roster";
import { KAELTHAS_MOVES } from "./kaelthasMoves";
import { KAELTHAS_SPECIALS } from "./kaelthasSpecials";
import { ROSTER_MANA } from "../mana";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { projectedProjectile } from "../../presentation/projectilePose";

const normalCases = [
  [AttackStyle.jab, 45.0, 0.0], [AttackStyle.jab2, 50.0, 0.0],
  [AttackStyle.forwardTilt, 95.0, 0.0], [AttackStyle.forwardTiltUp, 95.0, 50.0],
  [AttackStyle.forwardTiltDown, 95.0, -25.0], [AttackStyle.upTilt, 10.0, 65.0],
  [AttackStyle.downTilt, 85.0, -20.0], [AttackStyle.dashAttack, 85.0, 0.0],
  [AttackStyle.forwardSmash, 135.0, 0.0], [AttackStyle.upSmash, 0.0, 90.0],
  [AttackStyle.downSmash, 105.0, -20.0], [AttackStyle.neutralAir, 45.0, 0.0],
  [AttackStyle.forwardAir, 100.0, 0.0], [AttackStyle.backAir, -120.0, 0.0],
  [AttackStyle.upAir, 0.0, 85.0], [AttackStyle.downAir, 0.0, -120.0],
  [AttackStyle.getupAttack, -60.0, -20.0], [AttackStyle.ledgeAttack, 80.0, 0.0],
] as const;

function pair(x: number, facing = 1, character: Character = Character.rifleman) {
  const owner = createFighter(Character.kaelthas, 0.0, facing);
  const target = createFighter(character, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}

test("Kaelthas every normal starts after its tell, hits once in both facings [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z] of normalCases) {
    const { owner, target, world } = pair(x, facing);
    owner.motion.grounded = !isAerialAttack(style); target.motion.grounded = false; target.motion.z = z;
    const move = KAELTHAS_MOVES.normals[style]; assertTrue(move !== undefined); if (move === undefined) continue;
    const damage = move.regions.find(region => region.firstFrame === move.startupFrames)?.hit.effect.damage ?? -1.0;
    owner.attack.style = style; owner.attack.duration = move.totalFrames; owner.attack.frame = move.startupFrames - 1;
    resolveAttacks(world); assertEquals(target.status.damage, 0.0);
    owner.attack.frame++; resolveAttacks(world); assertEquals(target.status.damage, damage, `normal ${style}`);
    assertEquals(target.visuals.manaDrained, 0); assertGreaterThan(owner.mana.points, 40);
    owner.launch.hitlag = 0; target.launch.hitlag = 0; resolveAttacks(world); assertEquals(target.status.damage, damage);
  }
});

test("Kaelthas grab catches shield and every directional throw releases once [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const release = KAELTHAS_MOVES.throws[action]?.contactFrame ?? 0, damage = KAELTHAS_MOVES.throws[action]?.effect.damage ?? -1.0;
    const { owner, target, world } = pair(55.0, facing); target.shield.raised = true;
    beginFighterAttack(world, 0, AttackStyle.grab, false); owner.attack.frame = attackStartupFrames(AttackStyle.grab, KAELTHAS_MOVES);
    resolveAttacks(world); assertEquals(owner.grab.target, 1);
    const input = controls({ grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0, grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0 });
    for (let tick = 1; tick <= release; tick++) testGrabFrame(world, [input, controls()], false);
    assertEquals(target.status.damage, damage); assertEquals(target.grab.owner, undefined); assertGreaterThan(target.launch.knockbackZ, 0.0);
    if (action === GrabAction.throwBack) assertLessThan(f32(target.launch.knockbackX * facing), 0.0);
    testGrabFrame(world, [input, controls()], false); assertEquals(target.status.damage, damage);
  }
});

function frame(world: Roster, input: Readonly<Controls> = controls(), targetInput: Readonly<Controls> = controls()): void {
  const rows = [input, targetInput];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, rows[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(fighterAt(world, slot), 0, 0, rows[slot] ?? controls());
  resolveAttacks(world); advanceSpecials(world, 0, 0, rows); updateProjectiles(world); advancePlacedObjects(world); finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) advanceHeroStatus(fighterAt(world, slot));
}

test("Kaelthas Flamestrike's bolt drifts toward the enemy and bursts into a pillar on contact that is gone 12 frames later [spec docs/design/kaelthas.md] [spec #380]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(220.0, facing); target.motion.grounded = false; target.motion.surface = undefined; target.motion.z = 60.0;
    frame(world, controls({ specialPressed: true })); assertEquals(owner.special.action, SpecialAction.heroNeutral);
    for (let tick = 2; tick <= 15; tick++) { frame(world); target.motion.z = 60.0; target.motion.vz = 0.0; }
    assertTrue(!projectedProjectile(owner, 0, true).visible);
    let contact = 0;
    for (let tick = 16; tick <= 50 && contact === 0; tick++) { frame(world); target.motion.z = 60.0; target.motion.vz = 0.0; if (target.status.damage > 0) contact = tick; }
    assertEquals(target.status.damage, 12.0); assertGreaterThan(target.launch.knockbackZ, 0.0);
    const pillar = projectedProjectile(owner, 0, true); assertTrue(pillar.visible);
    for (let tick = 0; tick < 12; tick++) frame(world);
    assertTrue(!projectedProjectile(owner, 0, true).visible); assertEquals(target.status.damage, 12.0);
  }
  const far = pair(1000.0);
  frame(far.world, controls({ specialPressed: true }));
  for (let tick = 2; tick <= 60; tick++) frame(far.world);
  assertEquals(far.target.status.damage, 0.0); assertTrue(!projectedProjectile(far.owner, 0, true).visible);
});

test("Kaelthas Drain Mana grabs through a shield, drains up to 30 meter and releases once; a whiff ends on frame 38 [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) for (const shielding of [false, true]) {
    const { owner, target, world } = pair(110.0, facing); target.mana.points = 45;
    const defense = controls({ shield: shielding, shieldStrength: 1.0 });
    frame(world, controls({ specialPressed: true, specialX: facing }), defense);
    for (let tick = 2; tick <= 13; tick++) frame(world, controls(), defense);
    assertEquals(owner.grab.target, 1); assertEquals(target.grab.owner, 0);
    for (let tick = 14; tick <= 50; tick++) frame(world);
    assertEquals(target.status.damage, 4.0); assertLessThan(target.mana.points, 20); assertGreaterThan(owner.mana.points, 69);
  }
  const whiff = pair(400.0);
  frame(whiff.world, controls({ specialPressed: true, specialX: 1 }));
  for (let tick = 2; tick <= 37; tick++) frame(whiff.world);
  assertEquals(whiff.owner.special.action, SpecialAction.heroSide);
  frame(whiff.world); frame(whiff.world); assertEquals(whiff.owner.special.action, SpecialAction.none);
});

test("Kaelthas Banish leaves the victim slowed, unable to attack but able to cast, and open to more spell damage, once per immunity window [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(90.0, facing, Character.jaina);
    frame(world, controls({ specialPressed: true, specialZ: -1 }));
    assertEquals(owner.special.action, SpecialAction.heroDown);
    for (let tick = 2; tick <= 20; tick++) frame(world);
    assertEquals(target.status.condition, HeroStatusKind.banish); assertEquals(target.status.damage, 3.0);
    target.launch.hitstun = 0; target.launch.hitlag = 0; target.launch.knockbackX = 0.0; target.launch.knockbackZ = 0.0;
    target.motion.grounded = true; target.motion.surface = 0; target.motion.z = 0.0; target.motion.vz = 0.0; target.motion.vx = 0.0;
    frame(world, controls(), controls({ attackPressed: true, attackRequested: true }));
    assertEquals(target.attack.duration, 0);
    frame(world, controls(), controls({ specialPressed: true }));
    assertTrue(target.special.action !== SpecialAction.none);
    for (let tick = 0; tick < 90; tick++) frame(world);
    assertEquals(target.status.condition, HeroStatusKind.none);
    assertGreaterThan(target.status.conditionImmunity[HeroStatusGroup.silence] ?? 0, 0);
  }
  const slowed = createFighter(Character.rifleman, 0.0, 1); const free = createFighter(Character.rifleman, 0.0, 1);
  slowed.status.condition = HeroStatusKind.banish;
  assertLessThan(chillScaled(slowed, 10.0), chillScaled(free, 10.0));
  const cursed = pair(220.0); cursed.target.status.condition = HeroStatusKind.banish; cursed.target.status.conditionFrames = 200;
  cursed.target.motion.grounded = false; cursed.target.motion.surface = undefined;
  frame(cursed.world, controls({ specialPressed: true }));
  for (let tick = 2; tick <= 50; tick++) { frame(cursed.world); cursed.target.motion.z = 60.0; cursed.target.motion.vz = 0.0; }
  assertEquals(cursed.target.status.damage, f32(12.0 * f32(1.3)));
});

test("Kaelthas Phoenix charges 42 frames with four swirl hits, flies the line aimed by frame 14, bends with up or down and ends helpless with snapshot state [spec docs/design/kaelthas.md] [invariant]", () => {
  const heights: number[] = [];
  for (const lift of [0, 1, -1]) {
    const { owner, world } = pair(1000.0); owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 300.0;
    frame(world, controls({ specialPressed: true, specialZ: 1 })); assertEquals(owner.special.action, SpecialAction.heroUp);
    for (let tick = 2; tick <= 14; tick++) frame(world, controls({ direction: 1 }));
    frame(world); assertNear(owner.motion.z, 300.0, 3.0);
    for (let tick = 16; tick <= 42; tick++) frame(world, controls({ direction: -1 }));
    const charged = owner.motion.z; assertLessThan(charged, 300.0);
    const restored = createFighter(Character.kaelthas, 0.0, 1); copyFighterState(restored, owner, 3); assertEquals(firstFighterDifference(owner, restored, 3, 3), undefined);
    for (let tick = 43; tick <= 72; tick++) frame(world, controls({ verticalDirection: lift }));
    heights.push(f32(owner.motion.z - charged));
    assertGreaterThan(owner.motion.x, 250.0);
    for (let tick = 73; tick <= 84; tick++) frame(world);
    assertTrue(owner.special.fall); assertEquals(owner.jump.remaining, 0);
  }
  assertGreaterThan(heights[1] ?? 0.0, heights[0] ?? 0.0); assertLessThan(heights[2] ?? 0.0, heights[0] ?? 0.0);
  assertLessThan(f32((heights[1] ?? 0.0) - (heights[0] ?? 0.0)), 110.0);

  const { owner, target, world } = pair(30.0); target.motion.grounded = false; target.motion.z = 20.0;
  frame(world, controls({ specialPressed: true, specialZ: 1 }));
  for (let tick = 2; tick <= 80 && owner.special.frame < 41; tick++) { frame(world); target.motion.x = f32(owner.motion.x + 30.0); target.motion.z = f32(owner.motion.z + 20.0); target.motion.vx = 0.0; target.motion.vz = 0.0; target.launch.hitstun = 0; }
  assertEquals(target.status.damage, 8.0);
});

test("Kaelthas intentionally adapts Ultimate Mewtwo with the roster air-speed cap [reference] [spec docs/design/kaelthas.md]", () => {
  const fighter = createFighter(Character.kaelthas, 0.0, 1);
  assertNear(fighter.tuning.physics.weight, 79.0, f32(0.0001)); assertNear(fighter.tuning.physics.runSpeed, f32(13.53), f32(0.0001));
  assertNear(fighter.tuning.physics.airSpeed, 7.5, f32(0.0001));
});

test("Kaelthas EX Phoenix leaves a summoned phoenix beside him that burns nearby enemies for three seconds [spec docs/design/kaelthas.md] [spec #335]", () => {
  const { owner, target, world } = pair(1000.0); owner.mana.points = 100;
  owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 300.0;
  frame(world, controls({ specialPressed: true, specialZ: 1, shield: true }));
  assertEquals(owner.mana.points, 100 - ROSTER_MANA.exCost);
  for (let tick = 2; tick <= 74; tick++) frame(world);
  assertGreaterThan(owner.placed.life, 0);
  target.motion.grounded = false; target.motion.surface = undefined;
  for (let tick = 0; tick < 180; tick++) { frame(world); target.motion.x = owner.placed.x; target.motion.z = f32(owner.placed.z - 45.0); target.motion.vz = 0.0; target.motion.vx = 0.0; target.launch.hitstun = 0; }
  assertGreaterThan(target.status.damage, 7.0);
  assertEquals(owner.placed.life, 0);
});
