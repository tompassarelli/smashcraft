import { TECH_WINDOW_FRAMES, TECH_REPEAT_MINIMUM_AGE_FRAMES } from "../physics/techInput";


import { beginFighterAttack, resolveAttacks } from "./attacks";
import { AttackStyle } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import type { Fighter } from "./fighter";
import { advanceGrabs } from "./grabs";
import type { HitEffect } from "./hitRegions";
import { attackDurationFramesForGrounding, attackStartupFrames, characterAttackActiveFrames } from "./moves";
import { updateProjectiles } from "./projectiles";
import type { FighterPhysics } from "./tuning";
import { type Controls, type Roster, createRoster, fighterAt, neutralControls } from "./roster";
import { advanceFighter } from "./step";


export function testWorld(first: Fighter, second: Fighter): Roster {
  return createRoster(3, [first, second]);
}


export function soloWorld(fighter: Fighter): Roster {
  return createRoster(1, [fighter]);
}


export function hitEffect(damage: number, growth: number, base: number, launchX: number, launchZ: number, electric = false): HitEffect {
  return { damage, growth, base, launchX, launchZ, electric };
}


export function withPhysics(fighter: Fighter, changes: Partial<FighterPhysics>): void {
  fighter.tuning.physics = { ...fighter.tuning.physics, ...changes };
}


export function seedTechWindow(fighter: Fighter, frames: number): void {
  fighter.tech.window = frames;
  fighter.tech.pressAge = TECH_WINDOW_FRAMES - frames;
  fighter.tech.previousPressAge = TECH_REPEAT_MINIMUM_AGE_FRAMES;
  fighter.tech.accumulatedPress = false;
}


export function contactBatch(world: Roster, queue: () => void): void {
  beginDamageContacts();
  queue();
  finishDamageContacts(world);
}


export function controls(fields: Partial<Controls> = {}): Controls {
  return { ...neutralControls(), ...fields };
}


export function advanceSolo(fighter: Fighter, stage: number, input: Readonly<Controls>, respawnX: number): void {
  advanceFighter(soloWorld(fighter), 0, stage, input, respawnX);
}

export function testBeginAttacks(world: Roster, firstStyle: AttackStyle | undefined, secondStyle: AttackStyle | undefined, firstCharge = false, secondCharge = false): void {
  beginFighterAttack(world, 0, firstStyle, firstCharge);
  beginFighterAttack(world, 1, secondStyle, secondCharge);
}


export function resolveStartedAttack(world: Roster, style: AttackStyle): void {
  const input = controls();
  testBeginAttacks(world, style, undefined);
  for (let frame = 1; frame <= attackStartupFrames(style, fighterAt(world, 0).tuning.moves); frame++) {
    advanceFighter(world, 0, 0, input, -240.0);
    resolveAttacks(world);
    updateProjectiles(world);
  }
}




export function testGrabFrame(world: Roster, frameControls: readonly Readonly<Controls>[], paused: boolean): void {
  world.grabPaused[0] = paused;
  world.grabPaused[1] = paused;
  advanceGrabs(world, frameControls);
}
