// Mountain King's presentation on the stock Warcraft III model, as plain data
// for the shared hero clip seam. The sequence table was read from the game's
// archive copy of the model (war3.w3mod:units/human/heromountainking/
// heromountainking.mdx, 286165 bytes) with war3-model; the "Alternate" (Avatar)
// sequences 13-26 are omitted because the ultimate stays off.
//
// Arm-bone rotation over each sequence identifies the weapon: Attack -1 and
// Spell Throw swing the right arm (hammer, about 173 degrees), Attack -2 and
// Attack Slam the left (axe, about 177 degrees, Attack Slam with more root
// travel), and Spell Slam is the two-handed ground slam. The model has no
// jump, hit, dodge, ledge or grab sequences, so those states reuse the nearest
// readable sequence; `seconds` plays only the opening of a longer sequence.

export const MOUNTAIN_KING_MODEL = "Units\\Human\\HeroMountainKing\\HeroMountainKing.mdl";

export interface StockSequence {
  readonly index: number;
  readonly seconds: number;
  readonly looping: boolean;
}

/** Sequence names exactly as the model spells them, with index and length. */
export const MOUNTAIN_KING_SEQUENCES = {
  "Stand - 1": { index: 0, seconds: 1.5, looping: true },
  "Stand Ready": { index: 1, seconds: 1.5, looping: true },
  "Stand - 2": { index: 2, seconds: 2.3, looping: true },
  "Stand - 3": { index: 3, seconds: 3.167, looping: true },
  "Stand - 4": { index: 4, seconds: 5.367, looping: true },
  "Attack -1": { index: 5, seconds: 1.0, looping: false },
  "Attack -2": { index: 6, seconds: 1.0, looping: false },
  "Walk": { index: 7, seconds: 0.834, looping: true },
  "Death": { index: 8, seconds: 2.5, looping: false },
  "Spell Throw": { index: 9, seconds: 1.366, looping: false },
  "Spell Slam": { index: 10, seconds: 0.9, looping: false },
  "Dissipate": { index: 11, seconds: 2.0, looping: false },
  "Attack Slam": { index: 12, seconds: 1.0, looping: false },
} as const satisfies Readonly<Record<string, StockSequence>>;

export type MountainKingSequence = keyof typeof MOUNTAIN_KING_SEQUENCES;

export interface HeroClipBinding {
  readonly sequence: MountainKingSequence;
  /** Plays only this opening part of the sequence over the state; the whole sequence when absent. */
  readonly seconds?: number | undefined;
  /** Holds the clip's last sampled pose instead of advancing (falls, hangs, shield hold). */
  readonly hold?: boolean | undefined;
}

const play = (sequence: MountainKingSequence, seconds?: number, hold?: boolean): HeroClipBinding => ({ sequence, seconds, hold });

/** Every fighter state and move, keyed by the shared clip-table names. */
export const MOUNTAIN_KING_CLIPS = {
  // Movement
  idle: play("Stand Ready"),
  walk: play("Walk"),
  dash: play("Walk"),
  run: play("Walk"),
  turn: play("Stand Ready"),
  stop: play("Stand Ready"),
  crouch: play("Spell Slam", 0.25, true),
  jumpSquat: play("Spell Slam", 0.2),
  jump: play("Stand - 3", 0.6),
  doubleJump: play("Stand - 3", 0.6),
  fall: play("Stand Ready", undefined, true),
  fastFall: play("Stand Ready", undefined, true),
  fallSpecial: play("Death", 0.3, true),
  land: play("Spell Slam", 0.3),
  landSpecial: play("Spell Slam", 0.45),
  // Defense
  shieldRaise: play("Stand Ready"),
  shieldHold: play("Stand Ready", undefined, true),
  shieldRelease: play("Stand Ready"),
  shieldBreak: play("Death", 0.5),
  dizzy: play("Stand - 4"),
  spotDodge: play("Spell Slam", 0.4),
  rollForward: play("Walk"),
  rollBackward: play("Walk"),
  airDodge: play("Stand - 3", 0.6),
  // Damage and recovery
  damageGround: play("Death", 0.35),
  damageAir: play("Death", 0.35),
  damageTumble: play("Death", 0.8),
  damageShield: play("Stand Ready"),
  knockdown: play("Death"),
  downDamage: play("Death", 0.35),
  getUp: play("Stand - 3", 1.0),
  getUpAttack: play("Attack -2"),
  techNeutral: play("Stand - 3", 0.6),
  techRoll: play("Walk"),
  ledgeHang: play("Stand Ready", undefined, true),
  ledgeClimb: play("Walk"),
  ledgeRoll: play("Walk"),
  ledgeAttack: play("Attack -2"),
  ledgeJump: play("Stand - 3", 0.6),
  ko: play("Dissipate"),
  respawn: play("Stand Ready"),
  // Ground attacks: the hammer (right arm) for blunt hits, the axe (left) for cuts
  jab: play("Attack -1"),
  forwardTilt: play("Attack -2"),
  forwardTiltUp: play("Attack -2"),
  forwardTiltDown: play("Attack -2"),
  upTilt: play("Attack -1"),
  downTilt: play("Attack -2"),
  dashAttack: play("Attack -1"),
  forwardSmash: play("Attack Slam"),
  forwardSmashCharge: play("Attack Slam", 0.3, true),
  upSmash: play("Attack -1"),
  upSmashCharge: play("Attack -1", 0.3, true),
  downSmash: play("Spell Slam"),
  downSmashCharge: play("Spell Slam", 0.3, true),
  // Aerials
  neutralAir: play("Attack -1"),
  forwardAir: play("Attack Slam"),
  backAir: play("Attack -2"),
  upAir: play("Attack -1"),
  downAir: play("Spell Slam"),
  // Grabs and throws (holder and victim)
  grab: play("Attack -2"),
  grabHold: play("Stand Ready", undefined, true),
  grabbed: play("Death", 0.2, true),
  pummel: play("Attack -1", 0.5),
  throwForward: play("Attack -1"),
  throwBack: play("Attack Slam"),
  throwUp: play("Spell Throw"),
  throwDown: play("Spell Slam"),
  victimPummel: play("Death", 0.2),
  victimThrow: play("Death", 0.35, true),
  // Specials: grounded and airborne forms share a sequence
  specialNeutral: play("Spell Throw"),
  specialSide: play("Attack -1"),
  specialUp: play("Attack Slam"),
  specialDown: play("Spell Slam"),
} as const satisfies Readonly<Record<string, HeroClipBinding>>;
