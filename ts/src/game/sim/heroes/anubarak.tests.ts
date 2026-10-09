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
import { advancePlacedObjects } from "../placedObjects";
import { advanceFighter } from "../step";
import { fighterAt, type Controls, type Roster } from "../roster";
import { ANUBARAK_MOVES } from "./anubarakMoves";
import { ANUBARAK_SPECIALS } from "./anubarakSpecials";
import { ROSTER_MANA } from "../mana";


const normalCases = [
  [AttackStyle.jab, 75.0, 0.0], [AttackStyle.jab2, 90.0, 0.0],
  [AttackStyle.forwardTilt, 130.0, 0.0], [AttackStyle.forwardTiltUp, 130.0, 30.0],
  [AttackStyle.forwardTiltDown, 130.0, 0.0], [AttackStyle.upTilt, 15.0, 110.0],
  [AttackStyle.downTilt, 130.0, 0.0], [AttackStyle.dashAttack, 125.0, 0.0],
  [AttackStyle.forwardSmash, 160.0, 0.0], [AttackStyle.upSmash, 0.0, 140.0],
  [AttackStyle.downSmash, 140.0, 0.0], [AttackStyle.neutralAir, 70.0, 0.0],
  [AttackStyle.forwardAir, 140.0, 0.0], [AttackStyle.backAir, -140.0, 0.0],
  [AttackStyle.upAir, 0.0, 130.0], [AttackStyle.downAir, 0.0, -90.0],
  [AttackStyle.getupAttack, -100.0, 0.0], [AttackStyle.ledgeAttack, 120.0, 0.0],
] as const;

function pair(x: number, facing = 1) {
  const owner = createFighter(Character.anubarak, 0.0, facing);
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}

test("Anubarak every normal hits once on its first active frame, both facings [spec #341]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z] of normalCases) {
    const { owner, target, world } = pair(x, facing);
    owner.motion.grounded = !isAerialAttack(style); target.motion.grounded = false; target.motion.z = z;
    const move = ANUBARAK_MOVES.normals[style]; assertTrue(move !== undefined); if (move === undefined) continue;
    const damage = move.regions.find(region => region.firstFrame === move.startupFrames)?.hit.effect.damage ?? -1.0;
    owner.attack.style = style; owner.attack.duration = move.totalFrames; owner.attack.frame = move.startupFrames - 1;
    resolveAttacks(world); assertEquals(target.status.damage, 0.0, `early ${style}`);
    owner.attack.frame++; resolveAttacks(world); assertEquals(target.status.damage, damage, `normal ${style}`);
    assertEquals(target.visuals.manaDrained, 0); assertGreaterThan(owner.mana.points, 40);
    owner.launch.hitlag = 0; target.launch.hitlag = 0; resolveAttacks(world); assertEquals(target.status.damage, damage);
  }
});

test("Anubarak grab catches a shield and every directional throw releases once [spec #341]", () => {
  for (const facing of [-1, 1]) for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const release = ANUBARAK_MOVES.throws[action]?.contactFrame ?? 0, damage = ANUBARAK_MOVES.throws[action]?.effect.damage ?? -1.0;
    const { owner, target, world } = pair(45.0, facing); target.shield.raised = true;
    beginFighterAttack(world, 0, AttackStyle.grab, false); owner.attack.frame = attackStartupFrames(AttackStyle.grab, ANUBARAK_MOVES);
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
  resolveAttacks(world); advanceSpecials(world, 0, 0, rows); updateProjectiles(world); advancePlacedObjects(world); finishDamageContacts(world);
}


test("Anubarak Impale hits the first body along its low line [spec #341]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(180.0, facing);
    owner.mana.points = 0;
    frame(world, controls({ specialPressed: true }));
    for (let tick = 0; tick < 55 && target.status.damage === 0.0; tick++) frame(world);
    assertEquals(target.status.damage, ANUBARAK_SPECIALS.neutral.ground.projectiles?.[0]?.effect.damage);
  }
});

test("Anubarak's ordinary four specials are free and one bar segment buys EX for each [spec #335]", () => {
  for (const [x, z, action] of [[0, 0, SpecialAction.heroNeutral], [1, 0, SpecialAction.heroSide], [0, 1, SpecialAction.heroUp], [0, -1, SpecialAction.heroDown]] as const) {
    for (const ex of [false, true]) {
      const { owner, world } = pair(900.0);
      owner.mana.points = ex ? 100 : 0;
      frame(world, controls({ specialPressed: true, specialX: x, specialZ: z, shield: ex }));
      assertEquals(owner.special.action, action);
      assertEquals(owner.special.ex, ex);
      assertEquals(owner.mana.points, ex ? 100 - ROSTER_MANA.exCost : 0);
    }
  }
});

test("Anubarak Carrion Beetle's nest sends ground beetles and recall clears it [spec #341]", () => {
  const { owner, target, world } = pair(180.0);
  frame(world, controls({ specialPressed: true, specialZ: -1 }));
  for (let tick = 0; tick < 60 && target.status.damage === 0.0; tick++) frame(world);
  assertEquals(target.status.damage, ANUBARAK_SPECIALS.down.ground.placement?.shot?.effect.damage);
  for (let tick = 0; tick < 60; tick++) frame(world);
  frame(world, controls({ specialPressed: true, specialZ: -1 }));
  for (let tick = 0; tick < 30; tick++) frame(world);
  assertEquals(owner.placed.life, 0);
});

test("Anubarak Burrow Hunt waits for emergence and Crypt Eruption launches once [spec #341]", () => {
  for (const facing of [-1, 1]) for (const up of [false, true]) {
    const { owner, target, world } = pair(900.0, facing);
    frame(world, controls({ specialPressed: true, specialX: up ? 0 : facing, specialZ: up ? 1 : 0 }));
    const special = up ? ANUBARAK_SPECIALS.up.ground : ANUBARAK_SPECIALS.side.ground;
    const region = special?.regions?.[0];
    const contact = (region?.firstFrame ?? 0) + 1;
    for (let tick = 2; tick <= contact; tick++) {
      target.motion.x = owner.motion.x;
      target.motion.z = up ? owner.motion.z + 110.0 : 25.0;
      target.motion.grounded = false;
      frame(world);
      if (tick < contact) assertEquals(target.status.damage, 0.0);
    }
    assertEquals(target.status.damage, region?.hit.effect.damage);
  }
});
