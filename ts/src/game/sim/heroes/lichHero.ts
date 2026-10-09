

import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../codes";
import { LICH_GROUND, jabSlice, strikeClip } from "./groundNormals";
import type { HeroClip, HeroDefinition } from "./hero";
import { LICH_GAMEPLAN } from "./lichGameplan";
import { LICH_MOVES } from "./lichMoves";
import { LICH_SPECIALS } from "./lichSpecials";






const sequence = (index: number, seconds: number): HeroClip => ({ index, seconds });
const STAND_READY = sequence(1, f32(1.5));

const STAND_3 = sequence(3, 3);
const WALK = sequence(4, f32(1.867));

const CHANNEL = sequence(5, f32(1.866));

const ATTACK = sequence(6, 1);

const SPELL = sequence(7, f32(1.5));

const ground = (clip: HeroClip, strike: number, style: AttackStyle, frame?: number): HeroClip => strikeClip(clip, strike, LICH_GROUND, style, frame);

const DEATH = sequence(8, f32(1.667));

const DISSIPATE = sequence(9, 2);

export const LICH_HERO: HeroDefinition = {
  character: Character.lich,
  name: "Lich",
  purpose: "Deliberate projectile placement",
  weakness: "Frail body and slow attacks at close range",
  complete: true,
  moves: LICH_MOVES,
  specials: LICH_SPECIALS,
  jab: { name: "Chilling Touch", description: "A slap, then a freezing palm on a second jab." },
  gameplan: LICH_GAMEPLAN,
  presentation: {
    model: "units\\undead\\HeroLich\\HeroLich.mdl",
    objectId: 0x6d666c63,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroLich.blp",
    clips: {
      idle: STAND_READY, walk: WALK, dash: WALK, run: WALK, crouch: CHANNEL, fall: STAND_READY, landing: STAND_READY,
      shield: CHANNEL, airDodge: CHANNEL, smashCharge: CHANNEL, ko: DISSIPATE, dizzy: STAND_3,
      jab: jabSlice(ATTACK, f32(0.44)), jab2: jabSlice(ATTACK, f32(0.44)), grab: ATTACK, getUpAttack: ATTACK, ledgeAttack: ATTACK, backAir: ATTACK,

      forwardTilt: ground(SPELL, f32(0.48), AttackStyle.forwardTilt), forwardTiltUp: ground(SPELL, f32(0.48), AttackStyle.forwardTiltUp),
      forwardTiltDown: ground(ATTACK, f32(0.64), AttackStyle.forwardTiltDown), upTilt: ground(SPELL, f32(0.72), AttackStyle.upTilt, 10),
      downTilt: ground(ATTACK, f32(0.64), AttackStyle.downTilt), dashAttack: ground(SPELL, f32(0.48), AttackStyle.dashAttack),
      forwardSmash: SPELL, upSmash: SPELL, downSmash: SPELL,
      neutralAir: CHANNEL, forwardAir: SPELL, upAir: SPELL, downAir: SPELL,
      ledgeHang: STAND_READY, ledgeClimb: WALK, ledgeRoll: WALK,
      knockdown: DEATH, downDamage: DEATH, getUp: STAND_READY,
      rollForward: WALK, rollBackward: WALK, spotDodge: CHANNEL,
      jump: STAND_READY, doubleJump: CHANNEL, fallSpecial: CHANNEL,

      wallJump: SPELL, wallTech: ATTACK,
      damageGround: STAND_3, damageAir: STAND_3, damageTumble: STAND_3, damageShield: STAND_3,
      grabHold: CHANNEL, grabbed: STAND_3,
      pummel: ATTACK, throwForward: SPELL, throwBack: CHANNEL, throwUp: SPELL, throwDown: SPELL,
      victimPummel: STAND_3, victimThrowForward: STAND_3, victimThrowBack: STAND_3, victimThrowUp: STAND_3, victimThrowDown: STAND_3,
      neutralSpecial: SPELL, sideSpecial: SPELL, upSpecial: CHANNEL, downSpecial: SPELL,
      neutralSpecialAir: SPELL, sideSpecialAir: SPELL, upSpecialAir: CHANNEL, downSpecialAir: SPELL,
    },
    fallback: STAND_READY,
  },
};
