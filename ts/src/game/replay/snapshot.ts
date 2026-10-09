import { copyAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type FrameControls, createFrameControls } from "../match/controls";
import { type PacingAndPresentation, copyPacingAndPresentation, createPacingAndPresentation } from "../match/pacingAndPresentation";
import { type MatchState, copyMatchState, createMatchState } from "../match/rules";
import { createFighter } from "../sim/fighter";
import { type Roster, createRoster, fighterAt, isActive } from "../sim/roster";
import { copyFighterState } from "./fighterState";






export interface ReplayState {
  readonly world: Roster;
  readonly match: MatchState;
  readonly controls: FrameControls;
  readonly runtime: PacingAndPresentation;
}


export function createReplaySnapshot(): ReplayState {
  return {
    world: createRoster(3, [createFighter(1, 0.0, 1), createFighter(1, 0.0, -1), createFighter(2, 0.0, 1), createFighter(1, 0.0, -1)]),
    match: createMatchState(),
    controls: createFrameControls(),
    runtime: createPacingAndPresentation(),
  };
}






export function copyReplayState(target: ReplayState, source: Readonly<ReplayState>): void {
  const mask = source.world.mask;
  target.world.mask = mask;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(source.world, slot)) continue;
    copyFighterState(fighterAt(target.world, slot), fighterAt(source.world, slot), mask);
    copyAttackBuffer(target.controls.commands[slot], source.controls.commands[slot]);
  }
  copyMatchState(target.match, source.match);
  copyPacingAndPresentation(target.runtime, source.runtime, source.world);
}


export function captureReplaySnapshot(snapshot: ReplayState, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  copyReplayState(snapshot, { world, match, controls, runtime });
}


export function restoreReplaySnapshot(snapshot: Readonly<ReplayState>, world: Roster, match: MatchState, controls: FrameControls, runtime: PacingAndPresentation): void {
  copyReplayState({ world, match, controls, runtime }, snapshot);
}
