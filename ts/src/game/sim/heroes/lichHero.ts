// Lich's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import type { HeroClip, HeroDefinition } from "./hero";
import { LICH_MOVES } from "./lichMoves";
import { LICH_SPECIALS } from "./lichSpecials";

// The stock model (units\undead\HeroLich\HeroLich.mdl). The test clients run
// classic graphics, whose model holds exactly ten sequences; indices and
// lengths were read from its SEQS chunk, and the Reforged model has the same
// ten in the same order. It has no hit, jump or roll clips, so those poses
// reuse the closest standing, channel or collapse clip.
const sequence = (index: number, seconds: number): HeroClip => ({ index, seconds });
const STAND_READY = sequence(1, f32(1.5));
/** "Stand - 3", an idle sway, stands in for every hit reaction. */
const STAND_3 = sequence(3, 3);
const WALK = sequence(4, f32(1.867));
/** Held or sustained magic: Frost Halo, the spectral hand, Spectral Ascent. */
const CHANNEL = sequence(5, f32(1.866));
/** Hand strikes: Bone Knuckle, Bone Spike, grabs and the pummel. */
const ATTACK = sequence(6, 1);
/** Frost casts. */
const SPELL = sequence(7, f32(1.5));
/** "Death", the model's only lying pose. */
const DEATH = sequence(8, f32(1.667));

export const LICH_HERO: HeroDefinition = {
  character: Character.lich,
  name: "Lich",
  purpose: "Deliberate projectile placement",
  weakness: "Frail body and slow attacks at close range",
  complete: true,
  moves: LICH_MOVES,
  specials: LICH_SPECIALS,
  presentation: {
    model: "units\\undead\\HeroLich\\HeroLich.mdl",
    // The stand pose's top (z 177) at the roster's 1.05 height.
    scale: f32(0.8),
    baseUnit: "Ulic",
    objectId: 0x6d666c63,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroLich.blp",
    projectileModel: "Abilities\\Weapons\\LichMissile\\LichMissile.mdl",
    clips: {
      idle: STAND_READY, walk: WALK,
      jab: ATTACK, grab: ATTACK, getUpAttack: ATTACK, ledgeAttack: ATTACK, backAir: ATTACK,
      forwardTilt: SPELL, forwardTiltUp: SPELL, forwardTiltDown: SPELL, upTilt: SPELL, downTilt: SPELL,
      forwardSmash: SPELL, upSmash: SPELL, downSmash: SPELL, dashAttack: SPELL,
      neutralAir: CHANNEL, forwardAir: SPELL, upAir: SPELL, downAir: SPELL,
      ledgeHang: STAND_READY, ledgeClimb: WALK, ledgeRoll: WALK,
      knockdown: DEATH, downDamage: DEATH, getUp: STAND_READY,
      rollForward: WALK, rollBackward: WALK, spotDodge: CHANNEL,
      jump: STAND_READY, doubleJump: CHANNEL, fallSpecial: CHANNEL,
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
