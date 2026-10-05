// The fighters of a match by participant slot, and the controls each slot
// supplies for one frame.
import type { Fighter } from "./fighter";
import { PARTICIPANT_CAPACITY, participantActive } from "../input/participants";

/** Slot identities are stable for a match epoch, including sparse rosters. */
export interface Roster {
  /** Participant bits by slot. */
  mask: number;
  /** Hitlag captured before grabs advance: a frozen end pauses its grab. */
  readonly grabPaused: boolean[];
  readonly fighters: (Fighter | undefined)[];
}

/** A roster of the given participants, seating fighters from slot zero; a sparse roster seats the rest by slot. */
export function createRoster(mask: number, fighters: readonly Fighter[] = []): Roster {
  return {
    mask,
    grabPaused: Array.from({ length: PARTICIPANT_CAPACITY }, () => false),
    fighters: Array.from({ length: PARTICIPANT_CAPACITY }, (_, slot) => fighters[slot]),
  };
}

export function isActive(roster: Roster, slot: number): boolean {
  return participantActive(roster.mask, slot);
}

/** The fighter in a slot that must be occupied: an active slot, or a slot that fighter state refers to. */
export function fighterAt(roster: Roster, slot: number): Fighter {
  const fighter = roster.fighters[slot];
  if (fighter === undefined) throw new Error(`no fighter in slot ${slot}`);
  return fighter;
}

/** One participant's controls for one simulation frame, derived from its input row and commands. */
export interface Controls {
  direction: number;
  verticalDirection: number;
  /** An analog stick for directional influence; otherwise the digital directions are used. */
  diStickValid: boolean;
  diStickX: number;
  diStickZ: number;
  sdiPulse: boolean;
  sdiX: number;
  sdiZ: number;
  cStickX: number;
  cStickZ: number;
  attackRequested: boolean;
  specialPressed: boolean;
  specialX: number;
  specialZ: number;
  down: boolean;
  shield: boolean;
  shieldPressed: boolean;
  shieldTriggerActive: boolean;
  shieldStrength: number;
  jumpPressed: boolean;
  airDodgePressed: boolean;
  techPressed: boolean;
  mashPressed: boolean;
  attackPressed: boolean;
  grabMashPressed: boolean;
  grabThrowX: number;
  grabThrowZ: number;
  lCancelPressed: boolean;
  groundDodgePressed: boolean;
  groundDodgeDirection: number;
  getupAttackPressed: boolean;
  ledgeVerticalPressed: number;
  getupStandPressed: boolean;
  getupDirectionPressed: boolean;
  getupDirection: number;
  dodgeX: number;
  dodgeZ: number;
  jumpHeld: boolean;
  walking: boolean;
  attackHeld: boolean;
}

export function neutralControls(): Controls {
  return {
    direction: 0,
    verticalDirection: 0,
    diStickValid: false,
    diStickX: 0.0,
    diStickZ: 0.0,
    sdiPulse: false,
    sdiX: 0,
    sdiZ: 0,
    cStickX: 0,
    cStickZ: 0,
    attackRequested: false,
    specialPressed: false,
    specialX: 0,
    specialZ: 0,
    down: false,
    shield: false,
    shieldPressed: false,
    shieldTriggerActive: false,
    shieldStrength: 1.0,
    jumpPressed: false,
    airDodgePressed: false,
    techPressed: false,
    mashPressed: false,
    attackPressed: false,
    grabMashPressed: false,
    grabThrowX: 0,
    grabThrowZ: 0,
    lCancelPressed: false,
    groundDodgePressed: false,
    groundDodgeDirection: 0,
    getupAttackPressed: false,
    ledgeVerticalPressed: 0,
    getupStandPressed: false,
    getupDirectionPressed: false,
    getupDirection: 0,
    dodgeX: 0,
    dodgeZ: 0,
    jumpHeld: false,
    walking: false,
    attackHeld: false,
  };
}

export function copyControls(target: Controls, source: Readonly<Controls>): void {
  Object.assign(target, source);
}

/** A frame's controls for a slot the roster has active. */
export function controlsAt(controls: readonly Readonly<Controls>[], slot: number): Readonly<Controls> {
  const row = controls[slot];
  if (row === undefined) throw new Error(`no controls for slot ${slot}`);
  return row;
}
