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
import { MEDIVH_MOVES } from "./medivhMoves";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";

import { cancelSpecialState } from "../transitions";

const normalCases = [
  [AttackStyle.jab, 45.0, 0.0, 3.0], [AttackStyle.jab2, 50.0, 0.0, 4.0],
  [AttackStyle.forwardTilt, 85.0, 0.0, 7.0], [AttackStyle.forwardTiltUp, 85.0, 50.0, 7.0],
  [AttackStyle.forwardTiltDown, 85.0, -25.0, 7.0], [AttackStyle.upTilt, 10.0, 65.0, 7.0],
  [AttackStyle.downTilt, 85.0, -20.0, 6.0], [AttackStyle.dashAttack, 80.0, 0.0, 8.0],
  [AttackStyle.forwardSmash, 120.0, 0.0, 15.0], [AttackStyle.upSmash, 0.0, 90.0, 14.0],
  [AttackStyle.downSmash, 95.0, -20.0, 13.0], [AttackStyle.neutralAir, 45.0, 0.0, 6.0],
  [AttackStyle.forwardAir, 90.0, 0.0, 9.0], [AttackStyle.backAir, -105.0, 0.0, 10.0],
  [AttackStyle.upAir, 0.0, 80.0, 8.0], [AttackStyle.downAir, 0.0, -110.0, 11.0],
  [AttackStyle.getupAttack, -60.0, -20.0, 7.0], [AttackStyle.ledgeAttack, 80.0, 0.0, 7.0],
] as const;

function pair(x: number, facing = 1) {
  const owner = createFighter(Character.medivh, 0.0, facing);
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}

test("Medivh every normal starts after its tell, hits once in both facings [spec #343]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z, damage] of normalCases) {
    const { owner, target, world } = pair(x, facing);
    owner.motion.grounded = !isAerialAttack(style); target.motion.grounded = false; target.motion.z = z;
    const move = MEDIVH_MOVES.normals[style]; assertTrue(move !== undefined); if (move === undefined) continue;
    owner.attack.style = style; owner.attack.duration = move.totalFrames; owner.attack.frame = move.startupFrames - 1;
    resolveAttacks(world); assertEquals(target.status.damage, 0.0);
    owner.attack.frame++; resolveAttacks(world); assertEquals(target.status.damage, damage, `normal ${style}`);
    assertEquals(target.visuals.manaDrained, 0); assertGreaterThan(owner.mana.points, 40);
    owner.launch.hitlag = 0; target.launch.hitlag = 0; resolveAttacks(world); assertEquals(target.status.damage, damage);
  }
});

test("Medivh grab catches shield and every directional throw releases once [spec #343]", () => {
  for (const facing of [-1, 1]) for (const [action, release, damage] of [
    [GrabAction.throwForward, 14, 7.0], [GrabAction.throwBack, 17, 9.0], [GrabAction.throwUp, 16, 7.0], [GrabAction.throwDown, 18, 6.0],
  ] as const) {
    const { owner, target, world } = pair(55.0, facing); target.shield.raised = true;
    beginFighterAttack(world, 0, AttackStyle.grab, false); owner.attack.frame = attackStartupFrames(AttackStyle.grab, MEDIVH_MOVES);
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

test("Medivh four free specials preserve the bar and every EX spends one full bar [spec #335] [spec #343]", () => {
 for (const direction of [[0,0],[1,0],[0,1],[0,-1]] as const) for(const ex of [false,true]) {
  const {owner}=pair(1000.0); owner.mana.points=ex?100:28;
  startFighterSpecial(owner,0,0,controls({specialPressed:true,specialX:direction[0],specialZ:direction[1],shield:ex}));
  assertTrue(owner.special.action!==SpecialAction.none); assertEquals(owner.special.ex,ex); assertEquals(owner.mana.points,ex?0:28);
  const copy=createFighter(Character.medivh,0.0,1);copyFighterState(copy,owner,3);assertEquals(firstFighterDifference(copy,owner,3,3),undefined);
 }
});

test("Medivh forward and retreat blinks move once in both facings and expose the endpoint [spec #343]", () => {
 for(const facing of [-1,1]) for(const retreat of [false,true]) {
  const {owner,world}=pair(1000.0,facing); frame(world,controls({specialPressed:true,specialX:retreat?0:facing,specialZ:retreat?-1:0}));
  for(let tick=2;tick<=9;tick++) frame(world); assertEquals(owner.motion.x,0.0); assertTrue(isIntangible(owner));
  frame(world); assertEquals(owner.motion.x,0.0);
  frame(world); assertEquals(owner.motion.x,f32((retreat?-120.0:180.0)*facing)); assertTrue(!isIntangible(owner)); const endpoint=owner.motion.x;
  for(let tick=12;tick<=38;tick++)frame(world);assertEquals(owner.motion.x,endpoint);assertEquals(owner.special.action,SpecialAction.none);
 }
});

test("Medivh raven flight consumes the aerial jump and ends helpless [spec #343]", () => {
 const {owner,world}=pair(1000.0);owner.motion.grounded=false;owner.motion.z=100.0;
 frame(world,controls({specialPressed:true,specialZ:1}));
 for(let tick=2;tick<=36;tick++)frame(world);
 assertTrue(owner.motion.z>300.0);assertTrue(owner.special.fall);assertEquals(owner.jump.remaining,0);
});

test("Medivh all four free specials make real contact and keep the victims bar [spec #343]", () => {
 for(const [x,z,specialX,specialZ,damage] of [[120.0,0.0,0,0,8.0],[240.0,0.0,1,0,7.0],[-120.0,0.0,0,-1,5.0],[0.0,70.0,0,1,5.0]] as const){
  const {owner,target,world}=pair(x);target.motion.z=z;
  frame(world,controls({specialPressed:true,specialX,specialZ}));
  for(let tick=2;tick<=30;tick++)frame(world);
  assertEquals(target.status.damage,damage,`special ${specialX}/${specialZ}`);assertEquals(target.visuals.manaDrained,0);
 }
});
