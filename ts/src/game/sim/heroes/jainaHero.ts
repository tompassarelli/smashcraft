import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import type { HeroClip, HeroDefinition } from "./hero";
import { JAINA_GAMEPLAN } from "./jainaGameplan";
import { JAINA_MOVES } from "./jainaMoves";
import { JAINA_SPECIALS } from "./jainaSpecials";

const sequence = (index: number, seconds: number): HeroClip => ({ index, seconds });
const STAND = sequence(0, f32(1.334));
const SHIFT = sequence(1, 3.0);
const ATTACK = sequence(3, f32(1.4));
const SPELL = sequence(4, f32(2.733));
const DISSIPATE = sequence(5, 2.0);
const WALK = sequence(6, 2.0);
const DEATH = sequence(7, 3.5);
const CHANNEL = sequence(8, f32(2.733));

export const JAINA_HERO: HeroDefinition = {
  character: Character.jaina, name: "Jaina Proudmoore", purpose: "Frost spells and a Water Elemental control the approach",
  weakness: "Slow on foot and exposed while setting up spells", complete: false,
  moves: JAINA_MOVES, specials: JAINA_SPECIALS, gameplan: JAINA_GAMEPLAN,
  passive: { name: "Brilliance Aura", description: "Recover mana faster while moving or resting between spells." },
  jab: { name: "Staff Check", description: "Two short staff strikes to create space." },
  ultimate: { name: "Mass Teleport", description: "Bring nearby allies to her Water Elemental." },
  presentation: {
    model: "units\\human\\Jaina\\Jaina.mdl", objectId: 0x6d666a61,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNJaina.blp",
    placedModel: { path: "units\\human\\WaterElemental\\WaterElemental.mdl", height: 110.0, alpha: 255 },
    fallback: STAND,
    clips: {
      idle: STAND, walk: WALK, dash: WALK, run: WALK, crouch: CHANNEL, fall: STAND, landing: STAND,
      shield: CHANNEL, airDodge: CHANNEL, smashCharge: CHANNEL, ko: DISSIPATE, dizzy: SHIFT,
      jab: ATTACK, jab2: ATTACK, forwardTilt: ATTACK, forwardTiltUp: ATTACK, forwardTiltDown: ATTACK,
      upTilt: SPELL, downTilt: ATTACK, dashAttack: SPELL,
      forwardSmash: SPELL, upSmash: SPELL, downSmash: SPELL,
      neutralAir: CHANNEL, forwardAir: ATTACK, backAir: ATTACK, upAir: SPELL, downAir: SPELL,
      grab: ATTACK, grabHold: CHANNEL, grabbed: SHIFT, pummel: ATTACK,
      throwForward: SPELL, throwBack: ATTACK, throwUp: SPELL, throwDown: SPELL,
      victimPummel: SHIFT, victimThrowForward: SHIFT, victimThrowBack: SHIFT, victimThrowUp: SHIFT, victimThrowDown: SHIFT,
      getUpAttack: ATTACK, ledgeHang: CHANNEL, ledgeClimb: WALK, ledgeRoll: WALK, ledgeAttack: ATTACK,
      knockdown: DEATH, downDamage: DEATH, getUp: STAND, rollForward: WALK, rollBackward: WALK, spotDodge: CHANNEL,
      jump: STAND, doubleJump: SPELL, fallSpecial: CHANNEL, wallJump: SPELL, wallTech: ATTACK,
      damageGround: SHIFT, damageAir: SHIFT, damageTumble: SHIFT, damageShield: SHIFT,
      neutralSpecial: ATTACK, sideSpecial: CHANNEL, upSpecial: SPELL, downSpecial: SPELL,
      neutralSpecialAir: ATTACK, sideSpecialAir: CHANNEL, upSpecialAir: SPELL, downSpecialAir: SPELL,
    },
  },
};
