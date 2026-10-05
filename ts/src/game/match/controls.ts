import { type AttackBuffer, attackBuffer, copyAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS, type Slots, isParticipantSlot } from "../input/participants";
import { type Controls, copyControls, neutralControls } from "../sim/roster";
import { Phase } from "./rules";

/** Preallocated: rollback replays fill each participant's records every frame. */
export interface FrameControls {
  readonly inputs: Slots<Controls>;
  readonly commands: Slots<AttackBuffer>;
}

export function createFrameControls(): FrameControls {
  return {
    inputs: [neutralControls(), neutralControls(), neutralControls(), neutralControls()],
    commands: [attackBuffer(0), attackBuffer(0), attackBuffer(0), attackBuffer(0)],
  };
}

export function copyFrameControls(target: FrameControls, source: Readonly<FrameControls>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    copyControls(target.inputs[slot], source.inputs[slot]);
    copyAttackBuffer(target.commands[slot], source.commands[slot]);
  }
}

/** Session controls are outside replay state: rollback must not undo a pause. */
export interface MatchControls {
  paused: boolean;
  readonly startHeld: Slots<boolean>;
}

export type StartAction = "confirm" | "togglePause" | undefined;

export function createMatchControls(): MatchControls {
  return { paused: false, startHeld: [false, false, false, false] };
}

/** Deferred journal callers commit the pause only after the helper acknowledges its boundary. */
export function startKeyDown(controls: MatchControls, slot: number, phase: Phase, settingsOpen: boolean, deferred = false): StartAction {
  if (!isParticipantSlot(slot) || controls.startHeld[slot]) return undefined;
  controls.startHeld[slot] = true;
  if (phase !== Phase.result && PARTICIPANT_SLOTS.some(other => other !== slot && controls.startHeld[other])) return undefined;
  if (settingsOpen) return undefined;
  if (phase === Phase.match) {
    if (!deferred) controls.paused = !controls.paused;
    return "togglePause";
  }
  return "confirm";
}

export function startKeyUp(controls: MatchControls, slot: number): void {
  if (isParticipantSlot(slot)) controls.startHeld[slot] = false;
}
