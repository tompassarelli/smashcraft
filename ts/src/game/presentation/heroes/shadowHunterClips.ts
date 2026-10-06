// Shadow Hunter (Rokhan) presentation: the stock classic model and the clip
// each move and state plays. Plain data for the shared hero presentation seam.
// Sequence indices, names and lengths are the model's own (14 sequences, file
// order); contact seconds are where the drawn strike peaks in a skinned sample
// of the clip, so a seam can fit the clip's contact to the move's first active
// frame. The model has one attack clip, so moves share clips by motion family.
import { AttackStyle, GrabAction } from "../../sim/codes";

export const SHADOW_HUNTER_MODEL = "units\\orc\\HeroShadowHunter\\HeroShadowHunter.mdl";
/** Stand Ready is 138 units tall at scale 1, against the roster's 1.08H (143). */
export const SHADOW_HUNTER_MODEL_SCALE = 1.0;

export interface StockClip {
  readonly sequence: string;
  readonly index: number;
  readonly seconds: number;
  /** Where the drawn strike, release or cast peaks, from the clip's start. */
  readonly contactSeconds?: number | undefined;
}

const clip = (sequence: string, index: number, seconds: number, contactSeconds?: number): StockClip =>
  contactSeconds === undefined ? { sequence, index, seconds } : { sequence, index, seconds, contactSeconds };

// Every sequence in units\orc\HeroShadowHunter\HeroShadowHunter.mdx.
const WALK = clip("Walk", 0, 0.8);
const STAND_1 = clip("Stand -1", 1, 1.0);
/** Glaive sweeps across the front, then fully behind (x -196 at 0.6). */
const STAND_2_FRONT = clip("Stand -2", 2, 3.233, 0.65);
const STAND_2_REAR = clip("Stand -2", 2, 3.233, 1.94);
/** Wind-up, a low forward lunge (body down to z -62) and an overhand release reaching x 243. */
const SPELL_THROW_LOW = clip("Spell Throw", 3, 3.1, 1.55);
const SPELL_THROW_RELEASE = clip("Spell Throw", 3, 3.1, 2.48);
/** Ends slumped (top z 97) and holds: knockdown. */
const DEATH = clip("Death", 4, 3.766);
const STAND_3 = clip("Stand -3", 5, 4.2);
/** Both arms raised (top z 205): a helpless, open fall. */
const STAND_4 = clip("Stand -4", 6, 6.333);
const STAND_READY = clip("Stand Ready", 7, 1.0);
/** Arms overhead, peak height 198 at 0.79 s, then a forward drop. */
const SPELL = clip("Spell", 8, 1.666, 0.79);
/** A backward sway (x -120 at 0.25 s) and return. */
const STAND_HIT = clip("Stand  Hit", 9, 0.5);
const STAND_HIT_SWAY = clip("Stand  Hit", 9, 0.5, 0.25);
/** Back wind-up, a forward glaive chop reaching x 211 at 0.55 s, and a second sweep at 1.25 s. */
const ATTACK = clip("Attack", 10, 1.567, 0.548);
/** A crouch then a leap: the body leaves the ground at 0.6 s (top z 282). */
const STAND_VICTORY = clip("Stand  Victory", 11, 3.0, 0.6);
/** The spirit rises out of the slumped body (z 97 to 523). */
const DISSIPATE = clip("Dissipate", 12, 1.666);
/** A hopping voodoo stomp: front reach at 0.27 s, rear at 1.08 s. */
const STAND_CHANNEL = clip("Stand Channel", 13, 2.7, 0.27);

export const SHADOW_HUNTER_CLIPS = {
  idle: STAND_READY,
  walk: WALK,
  dash: WALK,
  run: WALK,
  turn: STAND_READY,
  crouch: STAND_READY,
  jumpSquat: STAND_READY,
  jump: STAND_VICTORY,
  doubleJump: STAND_VICTORY,
  fall: STAND_READY,
  helplessFall: STAND_4,
  landing: STAND_READY,
  shield: STAND_READY,
  spotDodge: STAND_HIT_SWAY,
  roll: WALK,
  airDodge: STAND_HIT_SWAY,
  damageGround: STAND_HIT,
  damageAir: STAND_HIT,
  tumble: STAND_HIT,
  damageShield: STAND_HIT,
  knockdown: DEATH,
  downDamage: DEATH,
  getUp: STAND_READY,
  techRoll: WALK,
  dizzy: STAND_3,
  ledgeHang: STAND_READY,
  ledgeClimb: WALK,
  ledgeRoll: WALK,
  ledgeAttack: ATTACK,
  grabHold: STAND_READY,
  grabbed: STAND_HIT,
  ko: DISSIPATE,
  respawn: STAND_1,
  victory: STAND_VICTORY,
  attacks: {
    [AttackStyle.jab]: ATTACK,
    [AttackStyle.forwardTilt]: ATTACK,
    [AttackStyle.forwardTiltUp]: ATTACK,
    [AttackStyle.forwardTiltDown]: ATTACK,
    [AttackStyle.upTilt]: SPELL,
    [AttackStyle.downTilt]: SPELL_THROW_LOW,
    [AttackStyle.dashAttack]: ATTACK,
    [AttackStyle.forwardSmash]: SPELL_THROW_RELEASE,
    [AttackStyle.upSmash]: SPELL,
    [AttackStyle.downSmash]: STAND_CHANNEL,
    [AttackStyle.neutralAir]: STAND_2_FRONT,
    [AttackStyle.forwardAir]: ATTACK,
    // No kick exists in the model: Heel Hook plays the rear sweep.
    [AttackStyle.backAir]: STAND_2_REAR,
    [AttackStyle.upAir]: SPELL,
    [AttackStyle.downAir]: SPELL_THROW_LOW,
    [AttackStyle.grab]: ATTACK,
    [AttackStyle.getupAttack]: ATTACK,
    [AttackStyle.ledgeAttack]: ATTACK,
  } as { readonly [style: number]: StockClip | undefined },
  grabActions: {
    [GrabAction.pummel]: { holder: ATTACK, victim: STAND_HIT },
    [GrabAction.throwForward]: { holder: SPELL_THROW_RELEASE, victim: STAND_HIT },
    [GrabAction.throwBack]: { holder: STAND_2_REAR, victim: STAND_HIT },
    [GrabAction.throwUp]: { holder: SPELL, victim: STAND_HIT },
    [GrabAction.throwDown]: { holder: STAND_CHANNEL, victim: STAND_HIT },
  } as { readonly [action: number]: { readonly holder: StockClip; readonly victim: StockClip } | undefined },
  /** By special slot: neutral, side, up, down; the air forms play the same clips. */
  specials: {
    spiritGlaive: SPELL_THROW_RELEASE,
    serpentWard: STAND_CHANNEL,
    loaVault: STAND_VICTORY,
    hex: SPELL,
  },
} as const;
