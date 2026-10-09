

import type { Fighter } from "./fighter";
import { PARTICIPANT_CAPACITY } from "../input/participants";


export interface Roster {

  mask: number;

  readonly grabPaused: boolean[];
  readonly fighters: (Fighter | undefined)[];
}


export function createRoster(mask: number, fighters: readonly Fighter[] = []): Roster {
  return {
    mask,
    grabPaused: Array.from({ length: PARTICIPANT_CAPACITY }, () => false),
    fighters: Array.from({ length: PARTICIPANT_CAPACITY }, (_, slot) => fighters[slot]),
  };
}


export function isActive(roster: Roster, slot: number): boolean {
  const mask = roster.mask;
  return mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0;
}


export function fighterAt(roster: Roster, slot: number): Fighter {
  const fighter = roster.fighters[slot];
  if (fighter === undefined) throw new Error(`no fighter in slot ${slot}`);
  return fighter;
}

/** One participant's controls for one simulation frame, derived from its input row and commands. */
export interface Controls {
  direction: number;
  verticalDirection: number;
  /** Raw horizontal row axis, before directional influence normalizes diagonals. */
  driftStickX: number | undefined;
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
  /** Attack and Special together with ultimates on (docs/design/ultimates.md). */
  ultimatePressed: boolean;
  specialX: number;
  specialZ: number;
  down: boolean;
  shield: boolean;
  shieldPressed: boolean;
  shieldTriggerActive: boolean;
  shieldStrength: number;
  jumpPressed: boolean;
  shortHopPressed: boolean;
  meter: boolean;
  airDodgePressed: boolean;
  techPressed: boolean;
  mashPressed: boolean;
  attackPressed: boolean;
  grabMashPressed: boolean;
  grabThrowX: number;
  grabThrowZ: number;
  groundDodgePressed: boolean;
  groundDodgeDirection: number;
  getupAttackPressed: boolean;
  ledgeVerticalPressed: number;
  getupStandPressed: boolean;
  getupDirectionPressed: boolean;
  getupDirection: number;
  /** The C-stick crossed Melee's up-flick threshold this frame. */
  cStickUpFlick: boolean;
  /** The C-stick crossed Melee's sideways threshold this frame: -1, 1 or 0. */
  cStickSideFlick: number;
  dodgeX: number;
  dodgeZ: number;
  jumpHeld: boolean;
  walking: boolean;
  attackHeld: boolean;
  /** Training's reset: both shields held as attack is pressed. */
  resetPressed: boolean;
}

export function neutralControls(): Controls {
  return {
    driftStickX: undefined,
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
    ultimatePressed: false,
    specialX: 0,
    specialZ: 0,
    down: false,
    shield: false,
    shieldPressed: false,
    shieldTriggerActive: false,
    shieldStrength: 1.0,
    jumpPressed: false,
    shortHopPressed: false,
    meter: false,
    airDodgePressed: false,
    techPressed: false,
    mashPressed: false,
    attackPressed: false,
    grabMashPressed: false,
    grabThrowX: 0,
    grabThrowZ: 0,
    groundDodgePressed: false,
    groundDodgeDirection: 0,
    getupAttackPressed: false,
    ledgeVerticalPressed: 0,
    getupStandPressed: false,
    getupDirectionPressed: false,
    getupDirection: 0,
    cStickUpFlick: false,
    cStickSideFlick: 0,
    dodgeX: 0,
    dodgeZ: 0,
    jumpHeld: false,
    walking: false,
    attackHeld: false,
    resetPressed: false,
  };
}

/** Field by field: rollback copies these for every fighter on every replayed frame, and Lua's Object.assign allocates. */
export function copyControls(target: Controls, source: Readonly<Controls>): void {
  target.direction = source.direction;
  target.verticalDirection = source.verticalDirection;
  target.driftStickX = source.driftStickX;
  target.diStickValid = source.diStickValid;
  target.diStickX = source.diStickX;
  target.diStickZ = source.diStickZ;
  target.sdiPulse = source.sdiPulse;
  target.sdiX = source.sdiX;
  target.sdiZ = source.sdiZ;
  target.cStickX = source.cStickX;
  target.cStickZ = source.cStickZ;
  target.attackRequested = source.attackRequested;
  target.specialPressed = source.specialPressed;
  target.ultimatePressed = source.ultimatePressed;
  target.specialX = source.specialX;
  target.specialZ = source.specialZ;
  target.down = source.down;
  target.shield = source.shield;
  target.shieldPressed = source.shieldPressed;
  target.shieldTriggerActive = source.shieldTriggerActive;
  target.shieldStrength = source.shieldStrength;
  target.jumpPressed = source.jumpPressed;
  target.shortHopPressed = source.shortHopPressed;
  target.meter = source.meter;
  target.airDodgePressed = source.airDodgePressed;
  target.techPressed = source.techPressed;
  target.mashPressed = source.mashPressed;
  target.attackPressed = source.attackPressed;
  target.grabMashPressed = source.grabMashPressed;
  target.grabThrowX = source.grabThrowX;
  target.grabThrowZ = source.grabThrowZ;
  target.groundDodgePressed = source.groundDodgePressed;
  target.groundDodgeDirection = source.groundDodgeDirection;
  target.getupAttackPressed = source.getupAttackPressed;
  target.ledgeVerticalPressed = source.ledgeVerticalPressed;
  target.getupStandPressed = source.getupStandPressed;
  target.getupDirectionPressed = source.getupDirectionPressed;
  target.getupDirection = source.getupDirection;
  target.cStickUpFlick = source.cStickUpFlick;
  target.cStickSideFlick = source.cStickSideFlick;
  target.dodgeX = source.dodgeX;
  target.dodgeZ = source.dodgeZ;
  target.jumpHeld = source.jumpHeld;
  target.walking = source.walking;
  target.attackHeld = source.attackHeld;
  target.resetPressed = source.resetPressed;
}

/** A frame's controls for a slot the roster has active. */
export function controlsAt(controls: readonly Readonly<Controls>[], slot: number): Readonly<Controls> {
  const row = controls[slot];
  if (row === undefined) throw new Error(`no controls for slot ${slot}`);
  return row;
}

const CONTROL_FIELDS = [
  "driftStickX",
  "direction", "verticalDirection", "diStickValid", "diStickX", "diStickZ", "sdiPulse", "sdiX", "sdiZ", "cStickX", "cStickZ", "attackRequested", "specialPressed", "ultimatePressed", "specialX", "specialZ", "down", "shield", "shieldPressed", "shieldTriggerActive", "shieldStrength", "jumpPressed", "shortHopPressed", "meter", "airDodgePressed", "techPressed", "mashPressed", "attackPressed", "grabMashPressed", "grabThrowX", "grabThrowZ", "groundDodgePressed", "groundDodgeDirection", "getupAttackPressed", "ledgeVerticalPressed", "getupStandPressed", "getupDirectionPressed", "getupDirection", "cStickUpFlick", "cStickSideFlick", "dodgeX", "dodgeZ", "jumpHeld", "walking", "attackHeld", "resetPressed"
] as const satisfies readonly (keyof Controls)[];

export function sameControls(a: Readonly<Controls>, b: Readonly<Controls>): boolean {
  return CONTROL_FIELDS.every(field => a[field] === b[field]);
}
