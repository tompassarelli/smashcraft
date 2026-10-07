import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { isIntangible } from "../conditions";
import { createFighter } from "../fighter";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { updateProjectiles } from "../projectiles";
import { advanceFighter } from "../step";
import { fighterAt, type Controls, type Roster } from "../roster";
import { KAELTHAS_MOVES } from "./kaelthasMoves";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { projectedProjectile } from "../../presentation/projectilePose";

const normalCases = [
  [AttackStyle.jab, 45.0, 0.0, 3.0], [AttackStyle.jab2, 50.0, 0.0, 4.0],
  [AttackStyle.forwardTilt, 95.0, 0.0, 8.0], [AttackStyle.forwardTiltUp, 95.0, 50.0, 8.0],
  [AttackStyle.forwardTiltDown, 95.0, -25.0, 8.0], [AttackStyle.upTilt, 10.0, 65.0, 8.0],
  [AttackStyle.downTilt, 85.0, -20.0, 6.0], [AttackStyle.dashAttack, 85.0, 0.0, 9.0],
  [AttackStyle.forwardSmash, 135.0, 0.0, 16.0], [AttackStyle.upSmash, 0.0, 90.0, 15.0],
  [AttackStyle.downSmash, 105.0, -20.0, 14.0], [AttackStyle.neutralAir, 45.0, 0.0, 7.0],
  [AttackStyle.forwardAir, 100.0, 0.0, 10.0], [AttackStyle.backAir, -120.0, 0.0, 11.0],
  [AttackStyle.upAir, 0.0, 85.0, 9.0], [AttackStyle.downAir, 0.0, -120.0, 12.0],
  [AttackStyle.getupAttack, -60.0, -20.0, 7.0], [AttackStyle.ledgeAttack, 80.0, 0.0, 7.0],
] as const;

function pair(x: number, facing = 1) {
  const owner = createFighter(Character.kaelthas, 0.0, facing);
  const target = createFighter(Character.archer, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}

test("Kaelthas every normal starts after its tell, hits once and steals sphere mana in both facings", () => {
  for (const facing of [-1, 1]) for (const [style, x, z, damage] of normalCases) {
    const { owner, target, world } = pair(x, facing);
    owner.motion.grounded = !isAerialAttack(style); target.motion.grounded = false; target.motion.z = z;
    const move = KAELTHAS_MOVES.normals[style]; assertTrue(move !== undefined); if (move === undefined) continue;
    owner.attack.style = style; owner.attack.duration = move.totalFrames; owner.attack.frame = move.startupFrames - 1;
    resolveAttacks(world); assertEquals(target.status.damage, 0.0);
    owner.attack.frame++; resolveAttacks(world); assertEquals(target.status.damage, damage, `normal ${style}`);
    assertEquals(target.visuals.manaDrained, 1); assertGreaterThan(owner.mana.points, 40);
    owner.launch.hitlag = 0; target.launch.hitlag = 0; resolveAttacks(world); assertEquals(target.status.damage, damage);
  }
});

test("Kaelthas grab catches shield and every directional throw releases once", () => {
  for (const facing of [-1, 1]) for (const [action, release, damage] of [
    [GrabAction.throwForward, 14, 7.0], [GrabAction.throwBack, 17, 9.0], [GrabAction.throwUp, 16, 7.0], [GrabAction.throwDown, 18, 6.0],
  ] as const) {
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
  resolveAttacks(world); advanceSpecials(world, 0, 0, rows); updateProjectiles(world); finishDamageContacts(world);
}

test("Kaelthas Flame Strike is delayed, lands one launcher and spends once", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(180.0, facing);
    frame(world, controls({ specialPressed: true })); assertEquals(owner.special.action, SpecialAction.heroNeutral); assertEquals(owner.mana.points, 20);
    for (let tick = 2; tick <= 23; tick++) frame(world); assertEquals(target.status.damage, 0.0);
    for (let tick = 24; tick <= 60; tick++) frame(world); assertEquals(target.status.damage, 10.0); assertEquals(owner.mana.points, 20);
  }
});

test("Kaelthas Flame Strike shows its warning before the live fire pose", () => {
  const { owner, world } = pair(1000.0);
  frame(world, controls({ specialPressed: true }));
  for (let tick = 2; tick <= 8; tick++) frame(world);
  const warning = projectedProjectile(owner, 0, true);
  assertTrue(warning.visible); assertTrue(!warning.armed);
  assertEquals(warning.animationSequence, "birth"); assertEquals(warning.animationSeconds, 0.5);
  for (let tick = 9; tick <= 24; tick++) frame(world);
  const flame = projectedProjectile(owner, 0, true);
  assertTrue(flame.armed); assertEquals(flame.animationSeconds, 1.5);
});

test("Kaelthas Siphon transfers available mana only on body contact and shields stop it", () => {
  for (const facing of [-1, 1]) for (const blocked of [false, true]) {
    const { owner, target, world } = pair(115.0, facing); target.mana.points = 12;
    const defense = controls({ shield: blocked, shieldStrength: 1.0 });
    frame(world, controls({ specialPressed: true, specialX: facing }), defense);
    for (let tick = 2; tick <= 44; tick++) frame(world, controls(), defense);
    assertEquals(target.status.damage, blocked ? 0.0 : 4.0); assertEquals(owner.mana.points, blocked ? 35 : 47);
    assertEquals(target.mana.points, blocked ? 12 : 2);
  }
});

test("Kaelthas Banish protects only its authored window then strikes once", () => {
  const { owner, target, world } = pair(45.0); frame(world, controls({ specialPressed: true, specialZ: -1 }));
  assertEquals(owner.special.action, SpecialAction.heroDown); assertEquals(owner.mana.points, 25);
  for (let tick = 2; tick <= 12; tick++) { frame(world); if (tick >= 5) assertTrue(isIntangible(owner)); }
  for (let tick = 13; tick <= 50; tick++) frame(world); assertEquals(target.status.damage, 5.0); assertTrue(!isIntangible(owner));
});

test("Kaelthas paid and free Phoenix Flight consume the jump and finish helpless with snapshot state", () => {
  for (const mana of [40, 0]) {
    const { owner, world } = pair(1000.0); owner.mana.points = mana; owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 250.0;
    frame(world, controls({ specialPressed: true, specialZ: 1 })); assertEquals(owner.special.action, SpecialAction.heroUp);
    for (let tick = 2; tick <= 20; tick++) frame(world);
    const restored = createFighter(Character.kaelthas, 0.0, 1); copyFighterState(restored, owner, 3); assertEquals(firstFighterDifference(owner, restored, 3, 3), undefined);
    for (let tick = 21; tick <= 40; tick++) frame(world);
    assertEquals(owner.mana.points, mana === 0 ? 0 : 25); assertTrue(owner.motion.z > 300.0); assertTrue(owner.special.fall);
    assertEquals(owner.jump.remaining, 0);
  }
});

test("Kaelthas body converts the named Ultimate Mewtwo counterpart", () => {
  const fighter = createFighter(Character.kaelthas, 0.0, 1);
  assertNear(fighter.tuning.physics.weight, 79.0, f32(0.0001)); assertNear(fighter.tuning.physics.runSpeed, f32(13.53), f32(0.0001));
  assertNear(fighter.tuning.physics.airSpeed, f32(7.878), f32(0.0001));
});
