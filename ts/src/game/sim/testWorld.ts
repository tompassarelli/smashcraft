import { TECH_WINDOW_FRAMES, TECH_REPEAT_MINIMUM_AGE_FRAMES } from "../physics/techInput";
// Test fixtures only: rosters and controls for simulation tests. Every rule
// still runs through the production functions.
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { AttackStyle } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import type { Fighter } from "./fighter";
import { advanceGrabs } from "./grabs";
import type { HitEffect } from "./hitRegions";
import { attackActiveFrames, attackDurationFramesForGrounding, attackStartupFrames } from "./moves";
import { updateProjectiles } from "./projectiles";
import type { FighterPhysics } from "./tuning";
import { type Controls, type Roster, createRoster, neutralControls } from "./roster";
import { advanceFighter } from "./step";

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

/** Gives the fighter an open tech window of the given frames from a fresh, eligible press. */
export function seedTechWindow(fighter: Fighter, frames: number): void {
  fighter.tech.window = frames;
  fighter.tech.pressAge = TECH_WINDOW_FRAMES - frames;
  fighter.tech.previousPressAge = TECH_REPEAT_MINIMUM_AGE_FRAMES;
  fighter.tech.accumulatedPress = false;
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
  advanceFighter(soloWorld(fighter), 0, stage, input, respawnX);
}

export function testBeginAttacks(world: Roster, firstStyle: AttackStyle | undefined, secondStyle: AttackStyle | undefined, firstCharge = false, secondCharge = false): void {
  beginFighterAttack(world, 0, firstStyle, firstCharge);
  beginFighterAttack(world, 1, secondStyle, secondCharge);
}

/** Starts slot 0's attack and runs it through its first active frame, resolving contacts and projectiles each frame. */
export function resolveStartedAttack(world: Roster, style: AttackStyle): void {
  const input = controls();
  testBeginAttacks(world, style, undefined);
  for (let frame = 1; frame <= attackStartupFrames(style); frame++) {
    advanceFighter(world, 0, 0, input, -240.0);
    resolveAttacks(world);
    updateProjectiles(world);
  }
}

/** Puts a fighter in an attack's recovery with the given cooldown left. */
export function setRecovery(fighter: Fighter, cooldown: number): void {
  fighter.attack.style = AttackStyle.jab;
  fighter.attack.frame = attackStartupFrames(AttackStyle.jab) + attackActiveFrames(AttackStyle.jab);
  fighter.attack.duration = attackDurationFramesForGrounding(AttackStyle.jab, fighter.motion.grounded);
  fighter.attack.hit = true;
  fighter.attack.cooldown = cooldown;
}

/** One grab frame for slots 0 and 1, with both pauses set as given. */
export function testGrabFrame(world: Roster, frameControls: readonly Readonly<Controls>[], paused: boolean): void {
  world.grabPaused[0] = paused;
  world.grabPaused[1] = paused;
  advanceGrabs(world, frameControls);
}
