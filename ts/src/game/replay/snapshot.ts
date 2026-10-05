import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { copyAttackBuffer } from "../input/attackBuffer";
import { createFrameControls, type FrameControls } from "../match/controls";
import { copyMatchState, createMatchState, type MatchState } from "../match/rules";
import { copyReplayRuntimeState, createReplayRuntimeState, type ReplayRuntimeState } from "../match/runtime";
import { createFighter, type Fighter } from "../sim/fighter";
import { type Roster, createRoster, fighterAt, isActive } from "../sim/roster";
import { copyFighterState } from "./fighterState";

/** Detached state immediately before one recorded frame executes. */
export interface ReplaySnapshot {
  readonly world: Roster;
  readonly match: MatchState;
  readonly controls: FrameControls;
  readonly runtime: ReplayRuntimeState;
}

function retainReference(slot: number | undefined, mask: number): number | undefined {
  return slot !== undefined && participantActive(mask, slot) ? slot : undefined;
}

function remapFighterReferences(fighter: ReturnType<typeof fighterAt>, mask: number): void {
  for (let index = 0; index < fighter.hits.entries.length; index++) {
    const entry = fighter.hits.entries[index];
    if (entry === undefined) throw new Error(`missing replay hit slot ${index}`);
    entry.attacker = retainReference(entry.attacker, mask);
  }
  fighter.hits.lastAttacker = retainReference(fighter.hits.lastAttacker, mask);
  for (let index = 0; index < PARTICIPANT_CAPACITY; index++) {
    fighter.special.hitTargets[index] = retainReference(fighter.special.hitTargets[index], mask);
  }
  fighter.grab.owner = retainReference(fighter.grab.owner, mask);
  fighter.grab.target = retainReference(fighter.grab.target, mask);
}

function copyReplayCommands(target: FrameControls, source: Readonly<FrameControls>): void {
  for (const slot of PARTICIPANT_SLOTS) copyAttackBuffer(target.commands[slot], source.commands[slot]);
}

/** Allocate reusable snapshot storage; inactive fighters still have stable slots for references. */
export function createReplaySnapshot(): ReplaySnapshot {
  const fighters: Fighter[] = [
    createFighter(0, 0.0, 1),
    createFighter(1, 0.0, -1),
    createFighter(2, 0.0, 1),
    createFighter(0, 0.0, -1),
  ];
  return {
    world: createRoster(3, fighters),
    match: createMatchState(),
    controls: createFrameControls(),
    runtime: createReplayRuntimeState(),
  };
}

/** Capture before the row executes, retaining no mutable aliases to live state. */
export function captureReplaySnapshot(
  snapshot: ReplaySnapshot,
  world: Readonly<Roster>,
  match: Readonly<MatchState>,
  controls: Readonly<FrameControls>,
  runtime: Readonly<ReplayRuntimeState>,
): void {
  snapshot.world.mask = world.mask;
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(world, slot)) {
      const fighter = fighterAt(snapshot.world, slot);
      copyFighterState(fighter, fighterAt(world, slot));
      remapFighterReferences(fighter, world.mask);
    }
  }
  copyMatchState(snapshot.match, match);
  copyReplayCommands(snapshot.controls, controls);
  copyReplayRuntimeState(snapshot.runtime, runtime, world, snapshot.world);
}

/** Restore a detached before-frame snapshot into its live match slots. */
export function restoreReplaySnapshot(
  snapshot: Readonly<ReplaySnapshot>,
  world: Roster,
  match: MatchState,
  controls: FrameControls,
  runtime: ReplayRuntimeState,
): void {
  world.mask = snapshot.world.mask;
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(snapshot.world, slot)) {
      const fighter = fighterAt(world, slot);
      copyFighterState(fighter, fighterAt(snapshot.world, slot));
      remapFighterReferences(fighter, snapshot.world.mask);
    }
  }
  copyMatchState(match, snapshot.match);
  copyReplayCommands(controls, snapshot.controls);
  copyReplayRuntimeState(runtime, snapshot.runtime, snapshot.world, world);
}

/** Copy a snapshot into existing storage without replacing any owned record. */
export function copyReplaySnapshot(target: ReplaySnapshot, source: Readonly<ReplaySnapshot>): void {
  target.world.mask = source.world.mask;
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(source.world, slot)) {
      const fighter = fighterAt(target.world, slot);
      copyFighterState(fighter, fighterAt(source.world, slot));
      remapFighterReferences(fighter, source.world.mask);
    }
  }
  copyMatchState(target.match, source.match);
  copyReplayCommands(target.controls, source.controls);
  copyReplayRuntimeState(target.runtime, source.runtime, source.world, target.world);
}

export function cloneReplaySnapshot(source: Readonly<ReplaySnapshot>): ReplaySnapshot {
  const copy = createReplaySnapshot();
  copyReplaySnapshot(copy, source);
  return copy;
}
