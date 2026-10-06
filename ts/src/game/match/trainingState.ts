// Training's synchronized state (#120): partner settings and the readout.
// Rollback copies it, the replay difference compares it and the checksum folds it while training is on.

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

export interface TrainingState {
  /** PartnerBehaviour, PartnerEscape and PartnerTech codes. */
  behaviour: number;
  escape: number;
  tech: number;
  /** The partner's damage at the start and after every reset or knockout. */
  damage: number;
  showHitAreas: boolean;
  /** The last move a player's fighter started: its style (-1 none), first active frame, active frames and total length. */
  moveStyle: number;
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
    behaviour: PartnerBehaviour.stand, escape: PartnerEscape.none, tech: PartnerTech.none, damage: 0, showHitAreas: false,
    moveStyle: -1, moveSlot: -1, moveStartup: 0, moveActive: 0, moveTotal: 0,
    measureFrames: -1, measureAttacker: -1, measureDefender: -1, measureKind: Advantage.none, attackerReady: -1, defenderReady: -1,
    advantage: 0, advantageKind: Advantage.none, comboDefender: -1, comboOpen: false, comboHits: 0, comboDamage: 0.0,
  };
}

const INT_FIELDS = [
  "behaviour", "escape", "tech", "damage", "moveStyle", "moveSlot", "moveStartup", "moveActive", "moveTotal",
  "measureFrames", "measureAttacker", "measureDefender", "measureKind", "attackerReady", "defenderReady",
  "advantage", "advantageKind", "comboDefender", "comboHits",
] as const;

export function copyTrainingState(target: TrainingState, source: Readonly<TrainingState>): void {
  target.behaviour = source.behaviour;
  target.escape = source.escape;
  target.tech = source.tech;
  target.damage = source.damage;
  target.showHitAreas = source.showHitAreas;
  target.moveStyle = source.moveStyle;
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
}

export function firstTrainingDifference(expected: Readonly<TrainingState>, actual: Readonly<TrainingState>): string | undefined {
  for (const key of INT_FIELDS) if (expected[key] !== actual[key]) return `match.trainer.${key}`;
  if (expected.showHitAreas !== actual.showHitAreas) return "match.trainer.showHitAreas";
  if (expected.comboOpen !== actual.comboOpen) return "match.trainer.comboOpen";
  if (expected.comboDamage !== actual.comboDamage) return "match.trainer.comboDamage";
  return undefined;
}

/** Clears the readout for a new match; the partner settings stay. */
export function clearTrainingReadout(state: TrainingState): void {
  state.moveStyle = -1;
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

