// Training's synchronized state (#120): partner settings and the readout.
// Rollback copies it, the replay difference compares it and the checksum folds it while training is on.
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";

/** What the partner does when it can act. Codes are in the checksum. */
export const PartnerBehaviour = { stand: 0, shield: 1, crouch: 2, jump: 3, attack: 4, fight: 5 } as const;
export type PartnerBehaviour = (typeof PartnerBehaviour)[keyof typeof PartnerBehaviour];
export const PARTNER_BEHAVIOURS = 6;
/** How the partner holds the stick as a hit launches it. */
export const PartnerEscape = { none: 0, toward: 1, away: 2, random: 3 } as const;
export type PartnerEscape = (typeof PartnerEscape)[keyof typeof PartnerEscape];
export const PARTNER_ESCAPES = 4;
/** How the partner techs a tumbling landing. */
export const PartnerTech = { none: 0, inPlace: 1, toward: 2, away: 3, random: 4 } as const;
export type PartnerTech = (typeof PartnerTech)[keyof typeof PartnerTech];
export const PARTNER_TECHS = 5;
export const PARTNER_DAMAGE_STEP = 10;
export const PARTNER_DAMAGE_MAX = 300;
/** The readout's last result. */
export const Advantage = { none: 0, hit: 1, shield: 2 } as const;
export type Advantage = (typeof Advantage)[keyof typeof Advantage];

/** Speeds: the match advances one frame in every SPEEDS[i] input frames. */
export const TRAINING_SPEEDS: readonly number[] = [1, 2, 4];

/**
 * Presses made on input frames slow motion skips, kept for the next frame the
 * match runs: a bit per press (training.ts PRESS_FIELDS) and the values those
 * presses carry.
 */
export interface LatchedPresses {
  mask: number;
  specialX: number;
  specialZ: number;
  dodgeX: number;
  dodgeZ: number;
  groundDodgeDirection: number;
  getupDirection: number;
  sdiX: number;
  sdiZ: number;
  cStickSideFlick: number;
  ledgeVerticalPressed: number;
}

export const LATCH_FIELDS = [
  "mask", "specialX", "specialZ", "dodgeX", "dodgeZ", "groundDodgeDirection", "getupDirection", "sdiX", "sdiZ", "cStickSideFlick", "ledgeVerticalPressed",
] as const;

export function emptyLatchedPresses(): LatchedPresses {
  return { mask: 0, specialX: 0, specialZ: 0, dodgeX: 0, dodgeZ: 0, groundDodgeDirection: 0, getupDirection: 0, sdiX: 0, sdiZ: 0, cStickSideFlick: 0, ledgeVerticalPressed: 0 };
}

export interface TrainingState {
  /** Input frames per match frame: 1, 2 or 4. */
  speed: number;
  /** Input frames since the match last ran, below speed. */
  speedPhase: number;
  readonly latches: Slots<LatchedPresses>;
  /** PartnerBehaviour, PartnerEscape and PartnerTech codes. */
  behaviour: number;
  escape: number;
  tech: number;
  /** The partner's damage at the start and after every reset or knockout. */
  damage: number;
  showHitAreas: boolean;
  /** The last move a player's fighter started: its style (-1 none), first active frame, active frames and total length. */
  moveStyle: number;
  /** Or the last special it started or branched into: its SpecialAction (-1 none), form and fighter. */
  moveSpecial: number;
  moveForm: number;
  moveCharacter: number;
  moveSlot: number;
  moveStartup: number;
  moveActive: number;
  moveTotal: number;
  /** Frames since the contact being measured; -1 while none is. */
  measureFrames: number;
  measureAttacker: number;
  measureDefender: number;
  measureKind: number;
  attackerReady: number;
  defenderReady: number;
  /** The last finished measurement: positive when the attacker acts first. */
  advantage: number;
  /** An Advantage code. */
  advantageKind: number;
  comboDefender: number;
  /** Whether the combo's defender has not yet been able to act since its last hit. */
  comboOpen: boolean;
  comboHits: number;
  comboDamage: number;
}

export function createTrainingState(): TrainingState {
  return {
    speed: 1, speedPhase: 0, latches: [emptyLatchedPresses(), emptyLatchedPresses(), emptyLatchedPresses(), emptyLatchedPresses()],
    behaviour: PartnerBehaviour.stand, escape: PartnerEscape.none, tech: PartnerTech.none, damage: 0, showHitAreas: false,
    moveStyle: -1, moveSpecial: -1, moveForm: 0, moveCharacter: 0, moveSlot: -1, moveStartup: 0, moveActive: 0, moveTotal: 0,
    measureFrames: -1, measureAttacker: -1, measureDefender: -1, measureKind: Advantage.none, attackerReady: -1, defenderReady: -1,
    advantage: 0, advantageKind: Advantage.none, comboDefender: -1, comboOpen: false, comboHits: 0, comboDamage: 0.0,
  };
}

const INT_FIELDS = [
  "speed", "speedPhase", "behaviour", "escape", "tech", "damage", "moveStyle", "moveSpecial", "moveForm", "moveCharacter", "moveSlot", "moveStartup", "moveActive", "moveTotal",
  "measureFrames", "measureAttacker", "measureDefender", "measureKind", "attackerReady", "defenderReady",
  "advantage", "advantageKind", "comboDefender", "comboHits",
] as const;

export function copyTrainingState(target: TrainingState, source: Readonly<TrainingState>): void {
  target.speed = source.speed;
  target.speedPhase = source.speedPhase;
  for (const slot of PARTICIPANT_SLOTS) for (const key of LATCH_FIELDS) target.latches[slot][key] = source.latches[slot][key];
  target.behaviour = source.behaviour;
  target.escape = source.escape;
  target.tech = source.tech;
  target.damage = source.damage;
  target.showHitAreas = source.showHitAreas;
  target.moveStyle = source.moveStyle;
  target.moveSpecial = source.moveSpecial;
  target.moveForm = source.moveForm;
  target.moveCharacter = source.moveCharacter;
  target.moveSlot = source.moveSlot;
  target.moveStartup = source.moveStartup;
  target.moveActive = source.moveActive;
  target.moveTotal = source.moveTotal;
  target.measureFrames = source.measureFrames;
  target.measureAttacker = source.measureAttacker;
  target.measureDefender = source.measureDefender;
  target.measureKind = source.measureKind;
  target.attackerReady = source.attackerReady;
  target.defenderReady = source.defenderReady;
  target.advantage = source.advantage;
  target.advantageKind = source.advantageKind;
  target.comboDefender = source.comboDefender;
  target.comboOpen = source.comboOpen;
  target.comboHits = source.comboHits;
  target.comboDamage = source.comboDamage;
}

/** Writes every field through the checksum's writers, in a fixed order. */
export function writeTrainingState(state: Readonly<TrainingState>, int: (name: string, value: number) => void, bool: (name: string, value: boolean) => void, real: (name: string, value: number) => void): void {
  for (const key of INT_FIELDS) int(`match.trainer.${key}`, state[key]);
  bool("match.trainer.showHitAreas", state.showHitAreas);
  bool("match.trainer.comboOpen", state.comboOpen);
  real("match.trainer.comboDamage", state.comboDamage);
  for (const slot of PARTICIPANT_SLOTS) for (const key of LATCH_FIELDS) int(`match.trainer.latch${slot}.${key}`, state.latches[slot][key]);
}

export function firstTrainingDifference(expected: Readonly<TrainingState>, actual: Readonly<TrainingState>): string | undefined {
  for (const key of INT_FIELDS) if (expected[key] !== actual[key]) return `match.trainer.${key}`;
  if (expected.showHitAreas !== actual.showHitAreas) return "match.trainer.showHitAreas";
  if (expected.comboOpen !== actual.comboOpen) return "match.trainer.comboOpen";
  if (expected.comboDamage !== actual.comboDamage) return "match.trainer.comboDamage";
  for (const slot of PARTICIPANT_SLOTS) for (const key of LATCH_FIELDS) if (expected.latches[slot][key] !== actual.latches[slot][key]) return `match.trainer.latch${slot}.${key}`;
  return undefined;
}

/** Clears the readout, slow motion's phase and kept presses for a new match; the settings stay. */
export function clearTrainingReadout(state: TrainingState): void {
  state.speedPhase = 0;
  for (const slot of PARTICIPANT_SLOTS) for (const key of LATCH_FIELDS) state.latches[slot][key] = 0;
  state.moveStyle = -1;
  state.moveSpecial = -1;
  state.moveForm = 0;
  state.moveCharacter = 0;
  state.moveSlot = -1;
  state.moveStartup = 0;
  state.moveActive = 0;
  state.moveTotal = 0;
  state.measureFrames = -1;
  state.measureAttacker = -1;
  state.measureDefender = -1;
  state.measureKind = Advantage.none;
  state.attackerReady = -1;
  state.defenderReady = -1;
  state.advantage = 0;
  state.advantageKind = Advantage.none;
  state.comboDefender = -1;
  state.comboOpen = false;
  state.comboHits = 0;
  state.comboDamage = 0.0;
}

