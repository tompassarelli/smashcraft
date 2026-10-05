// Test fixtures only: rosters and controls for simulation tests. Every rule
// still runs through the production functions.
import { beginFighterAttack } from "./attacks";
import type { AttackStyle } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import type { Fighter } from "./fighter";
import { advanceGrabs } from "./grabs";
import type { HitEffect } from "./hitRegions";
import type { FighterPhysics } from "./tuning";
import { type Controls, type Roster, createRoster, neutralControls } from "./roster";
import { advance } from "./step";

/** Two fighters in slots 0 and 1 of a two-participant roster. */
export function testWorld(first: Fighter, second: Fighter): Roster {
  return createRoster(3, [first, second]);
}

/** One fighter alone in slot 0. */
export function soloWorld(fighter: Fighter): Roster {
  return createRoster(1, [fighter]);
}

/** A hit effect in the order the Wurst tuple lists its fields. */
export function hitEffect(damage: number, growth: number, base: number, launchX: number, launchZ: number, electric = false): HitEffect {
  return { damage, growth, base, launchX, launchZ, electric };
}

/** Replaces the fighter's physics record with a copy carrying the given changes. */
export function withPhysics(fighter: Fighter, changes: Partial<FighterPhysics>): void {
  fighter.tuning.physics = { ...fighter.tuning.physics, ...changes };
}

/** Queues contacts from the callback in their own batch and resolves them. */
export function contactBatch(world: Roster, queue: () => void): void {
  beginDamageContacts();
  queue();
  finishDamageContacts(world);
}

/** Neutral controls with the given fields set. */
export function controls(fields: Partial<Controls> = {}): Controls {
  return { ...neutralControls(), ...fields };
}

/** Advances a fighter alone on the stage for one frame, regenerating its shield. */
export function advanceSolo(fighter: Fighter, stage: number, input: Readonly<Controls>, respawnX: number): void {
  advance(soloWorld(fighter), 0, stage, input, respawnX);
}

export function testBeginAttacks(world: Roster, firstStyle: AttackStyle | undefined, secondStyle: AttackStyle | undefined, firstCharge = false, secondCharge = false): void {
  beginFighterAttack(world, 0, firstStyle, firstCharge);
  beginFighterAttack(world, 1, secondStyle, secondCharge);
}

/** One grab frame for slots 0 and 1, with both pauses set as given. */
export function testGrabFrame(world: Roster, frameControls: readonly Readonly<Controls>[], paused: boolean): void {
  world.grabPaused[0] = paused;
  world.grabPaused[1] = paused;
  advanceGrabs(world, frameControls);
}
