











import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import { MOUNTAIN_KING_GROUND, jabSlice, strikeClip } from "../../sim/heroes/groundNormals";
import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";

interface StockSequence {
  readonly index: number;
  readonly seconds: number;
  readonly looping: boolean;
}


const MOUNTAIN_KING_SEQUENCES = {
  "Stand - 1": { index: 0, seconds: 1.5, looping: true },
  "Stand Ready": { index: 1, seconds: 1.5, looping: true },
  "Stand - 2": { index: 2, seconds: f32(2.3), looping: true },
  "Stand - 3": { index: 3, seconds: f32(3.167), looping: true },
  "Stand - 4": { index: 4, seconds: f32(5.367), looping: true },
  "Attack -1": { index: 5, seconds: 1.0, looping: false },
  "Attack -2": { index: 6, seconds: 1.0, looping: false },
  "Walk": { index: 7, seconds: f32(0.834), looping: true },
  "Death": { index: 8, seconds: 2.5, looping: false },
  "Spell Throw": { index: 9, seconds: f32(1.366), looping: false },
  "Spell Slam": { index: 10, seconds: f32(0.9), looping: false },
  "Dissipate": { index: 11, seconds: 2.0, looping: false },
  "Attack Slam": { index: 12, seconds: 1.0, looping: false },
  "Attack Slam Alternate": { index: 25, seconds: 1.0, looping: false },
} as const satisfies Readonly<Record<string, StockSequence>>;

type MountainKingSequence = keyof typeof MOUNTAIN_KING_SEQUENCES;


const play = (sequence: MountainKingSequence, seconds?: number): HeroClip => {
  const { index, seconds: length } = MOUNTAIN_KING_SEQUENCES[sequence];
  return { index, seconds: f32(seconds ?? length) };
};


const ground = (sequence: MountainKingSequence, strike: number, style: AttackStyle, frame?: number): HeroClip =>
  strikeClip(MOUNTAIN_KING_SEQUENCES[sequence], strike, MOUNTAIN_KING_GROUND, style, frame);


export const MOUNTAIN_KING_FALLBACK = play("Stand Ready");


export const MOUNTAIN_KING_CLIPS = {
  idle: play("Stand Ready"),
  walk: play("Walk"),
  dash: play("Walk"),
  run: play("Walk"),
  crouch: play("Spell Slam", 0.25),
  fall: play("Stand Ready"),
  landing: play("Spell Slam", f32(0.3)),
  shield: play("Stand Ready"),
  airDodge: play("Stand - 3", f32(0.6)),
  smashCharge: play("Attack Slam", f32(0.3)),
  ko: play("Dissipate"),
  dizzy: play("Stand - 4"),
  jab: jabSlice(MOUNTAIN_KING_SEQUENCES["Attack -1"], f32(0.36)),
  jab2: jabSlice(MOUNTAIN_KING_SEQUENCES["Attack -1"], f32(0.36)),
  grab: play("Attack -2"),

  forwardTilt: ground("Attack -2", f32(0.48), AttackStyle.forwardTilt),
  forwardTiltUp: ground("Spell Throw", f32(0.52), AttackStyle.forwardTiltUp),
  forwardTiltDown: ground("Attack -2", f32(0.48), AttackStyle.forwardTiltDown),

  upTilt: ground("Attack -1", f32(0.44), AttackStyle.upTilt, 9),

  downTilt: ground("Attack Slam Alternate", f32(0.57), AttackStyle.downTilt),

  dashAttack: ground("Attack Slam", f32(0.48), AttackStyle.dashAttack),
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
  downDamage: play("Death", f32(0.35)),
  rollForward: play("Walk"),
  rollBackward: play("Walk"),
  spotDodge: play("Spell Slam", f32(0.4)),
  jump: play("Stand - 3", f32(0.6)),
  doubleJump: play("Stand - 3", f32(0.6)),

  wallJump: play("Attack Slam"),
  wallTech: play("Spell Slam", f32(0.5)),
  fallSpecial: play("Death", f32(0.3)),
  damageGround: play("Death", f32(0.35)),
  damageAir: play("Death", f32(0.35)),
  damageTumble: play("Death", f32(0.8)),
  damageShield: play("Stand Ready"),
  grabHold: play("Stand Ready"),
  grabbed: play("Death", f32(0.2)),
  pummel: play("Attack -1", 0.5),
  throwForward: play("Attack -1"),
  throwBack: play("Attack Slam"),
  throwUp: play("Spell Throw"),
  throwDown: play("Spell Slam"),
  victimPummel: play("Death", f32(0.2)),
  victimThrowForward: play("Death", f32(0.35)),
  victimThrowBack: play("Death", f32(0.35)),
  victimThrowUp: play("Death", f32(0.35)),
  victimThrowDown: play("Death", f32(0.35)),
  neutralSpecial: play("Spell Throw"),
  sideSpecial: play("Attack -1"),
  upSpecial: play("Attack Slam"),
  downSpecial: play("Spell Slam"),
  neutralSpecialAir: play("Spell Throw"),
  sideSpecialAir: play("Attack -1"),
  upSpecialAir: play("Attack Slam"),
  downSpecialAir: play("Attack -1"),
} as const satisfies HeroClipTable;
