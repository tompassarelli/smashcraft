import { ATTACK_BUFFER_FRAMES, type AttackBuffer, attackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS, type Slots, isParticipantSlot } from "../input/participants";
import { type Controls, neutralControls } from "../sim/roster";
import { Phase } from "./rules";


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


export function createBufferedFrameControls(): FrameControls {
  const controls = createFrameControls();
  for (const slot of PARTICIPANT_SLOTS) controls.commands[slot] = attackBuffer(ATTACK_BUFFER_FRAMES);
  return controls;
}


export interface MatchControls {
  paused: boolean;
  readonly startHeld: Slots<boolean>;
}

type StartAction = "confirm" | "togglePause" | undefined;

export function createMatchControls(): MatchControls {
  return { paused: false, startHeld: [false, false, false, false] };
}


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
