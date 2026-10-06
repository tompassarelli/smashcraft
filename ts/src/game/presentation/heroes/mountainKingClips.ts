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
// readable sequence, often only its opening.

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

/** A pose's sequence; a shorter `seconds` plays only that opening of it over the pose. */
export interface MountainKingClip {
  readonly index: number;
  readonly seconds: number;
}

const play = (sequence: MountainKingSequence, seconds?: number): MountainKingClip => {
  const { index, seconds: length } = MOUNTAIN_KING_SEQUENCES[sequence];
  return { index, seconds: seconds ?? length };
};

/** Idle, walking and every pose without its own entry. */
export const MOUNTAIN_KING_FALLBACK = play("Stand Ready");

/** Every table-selected pose (the shared hero pose names), hammer for blunt hits and axe for cuts. */
export const MOUNTAIN_KING_CLIPS = {
  jab: play("Attack -1"),
  grab: play("Attack -2"),
  forwardTilt: play("Attack -2"),
  forwardTiltUp: play("Attack -2"),
  forwardTiltDown: play("Attack -2"),
  upTilt: play("Attack -1"),
  downTilt: play("Attack -2"),
  dashAttack: play("Attack -1"),
  forwardSmash: play("Attack Slam"),
  upSmash: play("Attack -1"),
  downSmash: play("Spell Slam"),
  neutralAir: play("Attack -1"),
  forwardAir: play("Attack Slam"),
  backAir: play("Attack -2"),
  upAir: play("Attack -1"),
  downAir: play("Spell Slam"),
  getUpAttack: play("Attack -2"),
  ledgeHang: play("Stand Ready"),
  ledgeClimb: play("Walk"),
  ledgeRoll: play("Walk"),
  ledgeAttack: play("Attack -2"),
  knockdown: play("Death"),
  getUp: play("Stand - 3", 1.0),
  downDamage: play("Death", 0.35),
  rollForward: play("Walk"),
  rollBackward: play("Walk"),
  spotDodge: play("Spell Slam", 0.4),
  jump: play("Stand - 3", 0.6),
  doubleJump: play("Stand - 3", 0.6),
  fallSpecial: play("Death", 0.3),
  damageGround: play("Death", 0.35),
  damageAir: play("Death", 0.35),
  damageTumble: play("Death", 0.8),
  damageShield: play("Stand Ready"),
  grabHold: play("Stand Ready"),
  grabbed: play("Death", 0.2),
  pummel: play("Attack -1", 0.5),
  throwForward: play("Attack -1"),
  throwBack: play("Attack Slam"),
  throwUp: play("Spell Throw"),
  throwDown: play("Spell Slam"),
  victimPummel: play("Death", 0.2),
  victimThrowForward: play("Death", 0.35),
  victimThrowBack: play("Death", 0.35),
  victimThrowUp: play("Death", 0.35),
  victimThrowDown: play("Death", 0.35),
  neutralSpecial: play("Spell Throw"),
  sideSpecial: play("Attack -1"),
  upSpecial: play("Attack Slam"),
  downSpecial: play("Spell Slam"),
  neutralSpecialAir: play("Spell Throw"),
  sideSpecialAir: play("Attack -1"),
  upSpecialAir: play("Attack Slam"),
  downSpecialAir: play("Attack -1"),
} as const satisfies Readonly<Record<string, MountainKingClip>>;
