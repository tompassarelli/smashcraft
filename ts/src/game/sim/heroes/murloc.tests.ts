import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, HeroStatusKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { updateProjectiles } from "../projectiles";
import { advanceFighter } from "../step";
import { fighterAt, type Controls, type Roster } from "../roster";
import { MURLOC_MOVES } from "./murlocMoves";

// [style, target x, target z, damage]
const normalCases = [
  [AttackStyle.jab, 45.0, 0.0, 2.0], [AttackStyle.jab2, 50.0, 0.0, 4.0],
  [AttackStyle.forwardTilt, 70.0, 0.0, 7.0], [AttackStyle.forwardTiltUp, 70.0, 0.0, 7.0],
  [AttackStyle.forwardTiltDown, 70.0, 0.0, 7.0], [AttackStyle.upTilt, 30.0, 60.0, 6.0],
  [AttackStyle.downTilt, 65.0, 0.0, 5.0], [AttackStyle.dashAttack, 70.0, 0.0, 8.0],
  [AttackStyle.forwardSmash, 95.0, 0.0, 15.0], [AttackStyle.upSmash, 0.0, 90.0, 14.0],
  [AttackStyle.downSmash, 80.0, 0.0, 12.0], [AttackStyle.neutralAir, 40.0, 0.0, 7.0],
  [AttackStyle.forwardAir, 80.0, 0.0, 9.0], [AttackStyle.backAir, -80.0, 0.0, 11.0],
  [AttackStyle.upAir, 0.0, 80.0, 8.0], [AttackStyle.downAir, 0.0, -90.0, 10.0],
  [AttackStyle.getupAttack, -50.0, 0.0, 6.0], [AttackStyle.ledgeAttack, 70.0, 0.0, 6.0],
] as const;

function pair(x: number, facing = 1) {
  const owner = createFighter(Character.murloc, 0.0, facing);
  const target = createFighter(Character.archer, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}

test("Murloc every normal hits once on its first active frame and Scavenger takes mana, both facings [spec docs/design/murloc.md]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z, damage] of normalCases) {
    const { owner, target, world } = pair(x, facing);
    owner.motion.grounded = !isAerialAttack(style); target.motion.grounded = false; target.motion.z = z;
    const move = MURLOC_MOVES.normals[style]; assertTrue(move !== undefined); if (move === undefined) continue;
    owner.attack.style = style; owner.attack.duration = move.totalFrames; owner.attack.frame = move.startupFrames - 1;
    resolveAttacks(world); assertEquals(target.status.damage, 0.0, `early ${style}`);
    owner.attack.frame++; resolveAttacks(world); assertEquals(target.status.damage, damage, `normal ${style}`);
    assertEquals(target.visuals.manaDrained, 1); assertGreaterThan(owner.mana.points, 40);
    owner.launch.hitlag = 0; target.launch.hitlag = 0; resolveAttacks(world); assertEquals(target.status.damage, damage);
  }
});

test("Murloc grab catches a shield and every directional throw releases once [spec docs/design/murloc.md]", () => {
  for (const facing of [-1, 1]) for (const [action, release, damage] of [
    [GrabAction.throwForward, 12, 7.0], [GrabAction.throwBack, 14, 9.0], [GrabAction.throwUp, 12, 6.0], [GrabAction.throwDown, 16, 5.0],
  ] as const) {
    const { owner, target, world } = pair(45.0, facing); target.shield.raised = true;
    beginFighterAttack(world, 0, AttackStyle.grab, false); owner.attack.frame = attackStartupFrames(AttackStyle.grab, MURLOC_MOVES);
    resolveAttacks(world); assertEquals(owner.grab.target, 1);
    const input = controls({ grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0, grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0 });
    for (let tick = 1; tick <= release; tick++) testGrabFrame(world, [input, controls()], false);
    assertEquals(target.status.damage, damage); assertEquals(target.grab.owner, undefined); assertGreaterThan(target.launch.knockbackZ, 0.0);
    if (action === GrabAction.throwBack) assertLessThan(f32(target.launch.knockbackX * facing), 0.0);
  }
});

function frame(world: Roster, input: Readonly<Controls> = controls(), targetInput: Readonly<Controls> = controls()): void {
  const rows = [input, targetInput];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, rows[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(fighterAt(world, slot), 0, 0, rows[slot] ?? controls());
  resolveAttacks(world); advanceSpecials(world, 0, 0, rows); updateProjectiles(world); finishDamageContacts(world);
}

test("Murloc Ensnare's net slows the first body it reaches and spends ten mana [spec docs/design/murloc.md]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(160.0, facing);
    frame(world, controls({ specialPressed: true })); assertEquals(owner.special.action, SpecialAction.heroNeutral); assertEquals(owner.mana.points, 30);
    for (let tick = 0; tick < 40 && target.status.damage === 0.0; tick++) frame(world);
    assertEquals(target.status.damage, 4.0); assertEquals(target.status.condition, HeroStatusKind.chill);
  }
});

test("Murloc Tidal Rush stops at a raised shield and deals no damage through it [spec docs/design/murloc.md]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(140.0, facing); target.shield.raised = true;
    frame(world, controls({ specialPressed: true, specialX: facing })); assertEquals(owner.special.action, SpecialAction.heroSide);
    for (let tick = 0; tick < 30; tick++) frame(world, controls(), controls({ shield: true }));
    assertEquals(target.status.damage, 0.0); assertLessThan(Math.abs(owner.motion.x), 140.0);
  }
});

test("Murloc Disease Cloud poisons a grounded foe standing in it [spec docs/design/murloc.md]", () => {
  const { owner, target, world } = pair(50.0);
  frame(world, controls({ specialPressed: true, specialZ: -1 })); assertEquals(owner.special.action, SpecialAction.heroDown);
  for (let tick = 0; tick < 30 && target.status.poisonFrames === 0; tick++) frame(world);
  assertGreaterThan(target.status.poisonFrames, 0); assertGreaterThan(target.status.damage, 0.0);
});
