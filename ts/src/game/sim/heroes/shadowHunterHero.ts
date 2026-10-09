

import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../codes";
import { SHADOW_HUNTER_GROUND, jabSlice, strikeClip } from "./groundNormals";
import type { HeroClip, HeroDefinition } from "./hero";
import { SHADOW_HUNTER_GAMEPLAN } from "./shadowHunterGameplan";
import { SHADOW_HUNTER_MOVES } from "./shadowHunterMoves";
import { SHADOW_HUNTER_SPECIALS } from "./shadowHunterSpecials";




const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });
const WALK = clip(0, f32(0.8));
const STAND_1 = clip(1, 1.0);

const STAND_3 = clip(5, f32(4.2));

const STAND_2 = clip(2, f32(3.233));

const SPELL_THROW = clip(3, f32(3.1));

const DEATH = clip(4, f32(3.766));

const STAND_4 = clip(6, f32(6.333));
const STAND_READY = clip(7, 1.0);

const SPELL = clip(8, f32(1.666));

const STAND_HIT = clip(9, f32(0.5));

const ATTACK = clip(10, f32(1.567));

const STAND_VICTORY = clip(11, 3.0);

const STAND_CHANNEL = clip(13, f32(2.7));

const DISSIPATE = clip(12, f32(1.666));


const ground = (clip: HeroClip, strike: number, style: AttackStyle, frame?: number): HeroClip =>
  strikeClip(clip, strike, SHADOW_HUNTER_GROUND, style, frame);

export const SHADOW_HUNTER_HERO: HeroDefinition = {
  character: Character.shadowHunter,
  name: "Shadow Hunter",
  purpose: "Totem placement and angles",
  weakness: "Setup can be destroyed or bypassed",
  complete: true,
  moves: SHADOW_HUNTER_MOVES,
  specials: SHADOW_HUNTER_SPECIALS,
  jab: { name: "Glaive Handle", description: "Two jabs of the glaive handle, then a cut of its blade, on repeated jabs." },
  gameplan: SHADOW_HUNTER_GAMEPLAN,
  presentation: {
    model: "units\\orc\\HeroShadowHunter\\HeroShadowHunter.mdl",
    objectId: 0x6d667368,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNShadowHunter.blp",
    clips: {
      idle: STAND_READY, walk: WALK, dash: WALK, run: WALK, crouch: STAND_READY, fall: STAND_READY, landing: STAND_READY,
      shield: STAND_READY, airDodge: STAND_HIT, smashCharge: STAND_READY, ko: DISSIPATE, dizzy: STAND_3,



      jab: jabSlice(ATTACK, f32(0.5)), jab2: jabSlice(ATTACK, f32(0.5)), jab3: jabSlice(ATTACK, f32(0.51)), grab: ATTACK, forwardTilt: ground(ATTACK, f32(0.52), AttackStyle.forwardTilt),
      forwardTiltUp: ground(ATTACK, f32(0.50), AttackStyle.forwardTiltUp), forwardTiltDown: ground(SPELL, f32(1.30), AttackStyle.forwardTiltDown),
      upTilt: ground(ATTACK, f32(0.50), AttackStyle.upTilt, 9), downTilt: ground(SPELL_THROW, f32(1.06), AttackStyle.downTilt),
      dashAttack: ground(ATTACK, f32(0.52), AttackStyle.dashAttack),
      forwardSmash: SPELL_THROW, upSmash: SPELL, downSmash: STAND_CHANNEL,

      neutralAir: STAND_2, forwardAir: ATTACK, backAir: STAND_2, upAir: SPELL, downAir: SPELL_THROW,
      getUpAttack: ATTACK,
      ledgeHang: STAND_READY, ledgeClimb: WALK, ledgeRoll: WALK, ledgeAttack: ATTACK,
      knockdown: DEATH, getUp: STAND_READY, downDamage: DEATH,
      rollForward: WALK, rollBackward: WALK, spotDodge: STAND_HIT,
      jump: STAND_VICTORY, doubleJump: STAND_VICTORY, fallSpecial: STAND_4,

      wallJump: SPELL_THROW, wallTech: STAND_HIT,
      damageGround: STAND_HIT, damageAir: STAND_HIT, damageTumble: STAND_HIT, damageShield: STAND_HIT,
      grabHold: STAND_READY, grabbed: STAND_HIT,
      pummel: ATTACK, throwForward: SPELL_THROW, throwBack: STAND_2, throwUp: SPELL, throwDown: STAND_CHANNEL,
      victimPummel: STAND_HIT, victimThrowForward: STAND_HIT, victimThrowBack: STAND_HIT,
      victimThrowUp: STAND_HIT, victimThrowDown: STAND_HIT,
      neutralSpecial: SPELL_THROW, sideSpecial: STAND_CHANNEL, upSpecial: STAND_VICTORY, downSpecial: SPELL,
      neutralSpecialAir: SPELL_THROW, sideSpecialAir: STAND_CHANNEL, upSpecialAir: STAND_VICTORY, downSpecialAir: SPELL,
    },
    fallback: STAND_1,
  },
};
