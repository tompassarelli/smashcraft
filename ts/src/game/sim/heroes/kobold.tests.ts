import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
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
import { KOBOLD_MOVES } from "./koboldMoves";
import { runningHeroSpecial } from "../heroSpecialRules";

// [style, target x, target z, damage]
const normalCases = [
  [AttackStyle.jab, 45.0, 0.0, 2.0], [AttackStyle.jab2, 50.0, 0.0, 4.0],
  [AttackStyle.forwardTilt, 70.0, 0.0, 8.0], [AttackStyle.forwardTiltUp, 70.0, 0.0, 8.0],
  [AttackStyle.forwardTiltDown, 70.0, 0.0, 8.0], [AttackStyle.upTilt, 30.0, 60.0, 7.0],
  [AttackStyle.downTilt, 65.0, 0.0, 6.0], [AttackStyle.dashAttack, 70.0, 0.0, 9.0],
  [AttackStyle.forwardSmash, 95.0, 0.0, 16.0], [AttackStyle.upSmash, 0.0, 90.0, 15.0],
  [AttackStyle.downSmash, 80.0, 0.0, 13.0], [AttackStyle.neutralAir, 40.0, 0.0, 8.0],
  [AttackStyle.forwardAir, 80.0, 0.0, 10.0], [AttackStyle.backAir, -80.0, 0.0, 12.0],
  [AttackStyle.upAir, 0.0, 80.0, 9.0], [AttackStyle.downAir, 0.0, -90.0, 11.0],
  [AttackStyle.getupAttack, -50.0, 0.0, 6.0], [AttackStyle.ledgeAttack, 70.0, 0.0, 6.0],
] as const;

function pair(x: number, facing = 1) {
  const owner = createFighter(Character.kobold, 0.0, facing);
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}

test("Kobold every normal hits once on its first active frame, both facings [spec #344]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z, damage] of normalCases) {
    const { owner, target, world } = pair(x, facing);
    owner.motion.grounded = !isAerialAttack(style); target.motion.grounded = false; target.motion.z = z;
    const move = KOBOLD_MOVES.normals[style]; assertTrue(move !== undefined); if (move === undefined) continue;
    owner.attack.style = style; owner.attack.duration = move.totalFrames; owner.attack.frame = move.startupFrames - 1;
    resolveAttacks(world); assertEquals(target.status.damage, 0.0, `early ${style}`);
    owner.attack.frame++; resolveAttacks(world); assertEquals(target.status.damage, damage, `normal ${style}`);
    assertEquals(target.visuals.manaDrained, 0); assertGreaterThan(owner.mana.points, 40);
    owner.launch.hitlag = 0; target.launch.hitlag = 0; resolveAttacks(world); assertEquals(target.status.damage, damage);
  }
});

test("Kobold grab catches a shield and every directional throw releases once [spec #344]", () => {
  for (const facing of [-1, 1]) for (const [action, release, damage] of [
    [GrabAction.throwForward, 12, 7.0], [GrabAction.throwBack, 14, 9.0], [GrabAction.throwUp, 12, 6.0], [GrabAction.throwDown, 16, 5.0],
  ] as const) {
    const { owner, target, world } = pair(45.0, facing); target.shield.raised = true;
    beginFighterAttack(world, 0, AttackStyle.grab, false); owner.attack.frame = attackStartupFrames(AttackStyle.grab, KOBOLD_MOVES);
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

test("Kobold Wick Flick hits the first body it reaches and preserves the super meter [spec #344]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(160.0, facing);
    frame(world, controls({ specialPressed: true })); assertEquals(owner.special.action, SpecialAction.heroNeutral); assertEquals(owner.mana.points, 40);
    for (let tick = 0; tick < 40 && target.status.damage === 0.0; tick++) frame(world);
    assertEquals(target.status.damage, 4.0); assertEquals(target.status.condition, HeroStatusKind.none);
  }
});

test("Kobold Panic Dig stops at a raised shield and deals no damage through it [spec #344]", () => {
  for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(140.0, facing); target.shield.raised = true;
    frame(world, controls({ specialPressed: true, specialX: facing })); assertEquals(owner.special.action, SpecialAction.heroSide);
    for (let tick = 0; tick < 30; tick++) frame(world, controls(), controls({ shield: true }));
    assertEquals(target.status.damage, 0.0); assertLessThan(Math.abs(owner.motion.x), 140.0);
  }
});

test("Kobold Mine sweeps both sides for zero meter on the first contact frame [spec #344]", () => {
  for(const facing of [-1, 1]) for(const side of [-1, 1]) {
    const {owner,target,world}=pair(55.0*side,facing);
    frame(world,controls({specialPressed:true,specialZ:-1}));
    assertEquals(owner.special.action,SpecialAction.heroDown); assertEquals(owner.mana.points,40);
    for(let tick=0;tick<18 && target.status.damage===0.0;tick++) frame(world);
    assertEquals(target.status.damage,7.0);
  }
});

test("Kobold Panic Dig and Candle Escape hit once without spending meter in both facings [spec #344]", () => {
  for (const facing of [-1, 1]) for (const rise of [false, true]) {
    const { owner, target, world } = pair(rise ? 0.0 : 80.0, facing);
    if (rise) { target.motion.z = 80.0; target.motion.grounded = false; }
    frame(world, controls({ specialPressed: true, specialX: rise ? 0 : facing, specialZ: rise ? 1 : 0 }));
    assertEquals(owner.special.action, rise ? SpecialAction.heroUp : SpecialAction.heroSide);
    assertEquals(owner.mana.points, 40);
    for (let tick = 0; tick < 25 && target.status.damage === 0.0; tick++) frame(world);
    assertEquals(target.status.damage, rise ? 5.0 : 8.0);
    if (rise) assertEquals(owner.special.airtimeUses & 4, 4);
  }
});

test("Kobold EX Wick Flick and Panic Dig spend one full bar for 25% more damage in ground and air [spec docs/design/mana.md]", () => {
  for (const facing of [-1, 1]) for (const air of [false, true]) for (const side of [false, true]) {
    const { owner, target, world } = pair(side ? 80.0 : 160.0, facing);
    owner.mana.points = 100;
    if (air) {
      owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 1000.0;
      target.motion.grounded = false; target.motion.surface = undefined; target.motion.z = 1000.0;
    }
    frame(world, controls({ specialPressed: true, specialX: side ? facing : 0, shield: true }));
    assertTrue(owner.special.ex); assertEquals(owner.mana.points, 0);
    for (let tick = 0; tick < 40 && target.status.damage === 0.0; tick++) {
      beginDamageContacts(); advanceSpecials(world, 0, tick); updateProjectiles(world); finishDamageContacts(world);
    }
    assertEquals(target.status.damage, side ? 10.0 : 5.0, `EX facing ${facing}, air ${air}, side ${side}`);
  }
});

test("Kobold EX Candle Escape rises and steers 25% farther on the same helpless timeline [spec docs/design/mana.md]", () => {
  const travel: number[][] = [];
  for (const ex of [false, true]) {
    const { owner, world } = pair(1000.0);
    owner.mana.points = 100;
    owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 1000.0;
    assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialZ: 1, shield: ex }), world));
    assertEquals(owner.mana.points, ex ? 0 : 100);
    const move = runningHeroSpecial(owner);
    let x = 0.0; let z = 0.0;
    for (let tick = 1; tick <= (move?.endFrame ?? 0); tick++) {
      advanceSpecials(world, 0, tick, [controls({ direction: 1 })]);
      if (move?.motion?.some(segment => tick >= segment.first && tick <= segment.last)) {
        x = f32(x + owner.motion.vx); z = f32(z + owner.motion.vz);
      }
    }
    assertTrue(owner.special.fall); travel.push([x, z, move?.endFrame ?? 0]);
  }
  assertNear(travel[1]?.[0] ?? 0.0, f32((travel[0]?.[0] ?? 0.0) * 1.25), f32(0.001));
  assertNear(travel[1]?.[1] ?? 0.0, f32((travel[0]?.[1] ?? 0.0) * 1.25), f32(0.001));
  assertEquals(travel[1]?.[2], travel[0]?.[2]);
});

test("Kobold EX Mine reaches outside the ordinary swipe on both sides [spec docs/design/mana.md]", () => {
  for (const facing of [-1, 1]) for (const side of [-1, 1]) for (const ex of [false, true]) {
    const { owner, target, world } = pair(115.0 * side, facing);
    owner.mana.points = 100;
    frame(world, controls({ specialPressed: true, specialZ: -1, shield: ex }));
    assertEquals(owner.mana.points, ex ? 0 : 100);
    for (let tick = 0; tick < 18 && target.status.damage === 0.0; tick++) frame(world);
    assertEquals(target.status.damage, ex ? 7.0 : 0.0);
  }
});
