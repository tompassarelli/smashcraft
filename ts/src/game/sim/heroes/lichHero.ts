// Lich's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../codes";
import { LICH_GROUND, strikeClip } from "./groundNormals";
import type { HeroClip, HeroDefinition } from "./hero";
import { LICH_GAMEPLAN } from "./lichGameplan";
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
// Strike moments: where the drawn hand or cast reaches farthest or highest.
const ground = (clip: HeroClip, strike: number, style: AttackStyle, frame?: number): HeroClip => strikeClip(clip, strike, LICH_GROUND, style, frame);
/** "Death", the model's only lying pose. */
const DEATH = sequence(8, f32(1.667));
/** "Dissipate", the spirit fading upward. */
const DISSIPATE = sequence(9, 2);

export const LICH_HERO: HeroDefinition = {
  character: Character.lich,
  name: "Lich",
  purpose: "Deliberate projectile placement",
  weakness: "Frail body and slow attacks at close range",
  complete: true,
  moves: LICH_MOVES,
  specials: LICH_SPECIALS,
  passive: { name: "Frost Aura", description: "The third melee hit he takes in a short time chills the attacker." },
  jab: { name: "Chilling Touch", description: "A slap, then a freezing palm on a second jab." },
  ultimate: { name: "Frost Wyrm", description: "He summons a frost wyrm." },
  gameplan: LICH_GAMEPLAN,
  presentation: {
    model: "units\\undead\\HeroLich\\HeroLich.mdl",
    // The stand pose's top (z 177) at the roster's 1.05 height.
    scale: f32(0.8),
    objectId: 0x6d666c63,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroLich.blp",
    clips: {
      idle: STAND_READY, walk: WALK, dash: WALK, run: WALK, crouch: CHANNEL, fall: STAND_READY, landing: STAND_READY,
      shield: CHANNEL, airDodge: CHANNEL, smashCharge: CHANNEL, ko: DISSIPATE, dizzy: STAND_3,
      jab: ground(ATTACK, f32(0.72), AttackStyle.jab), grab: ATTACK, getUpAttack: ATTACK, ledgeAttack: ATTACK, backAir: ATTACK,
      // Ground normals strike on their first active frame (smashcraft:docs/design/tilts.md); the low frost is the hand strike's low reach.
      forwardTilt: ground(SPELL, f32(0.48), AttackStyle.forwardTilt), forwardTiltUp: ground(SPELL, f32(0.48), AttackStyle.forwardTiltUp),
      forwardTiltDown: ground(ATTACK, f32(0.64), AttackStyle.forwardTiltDown), upTilt: ground(SPELL, f32(0.72), AttackStyle.upTilt, 10),
      downTilt: ground(ATTACK, f32(0.64), AttackStyle.downTilt), dashAttack: ground(SPELL, f32(0.48), AttackStyle.dashAttack),
      forwardSmash: SPELL, upSmash: SPELL, downSmash: SPELL,
      neutralAir: CHANNEL, forwardAir: SPELL, upAir: SPELL, downAir: SPELL,
      ledgeHang: STAND_READY, ledgeClimb: WALK, ledgeRoll: WALK,
      knockdown: DEATH, downDamage: DEATH, getUp: STAND_READY,
      rollForward: WALK, rollBackward: WALK, spotDodge: CHANNEL,
      jump: STAND_READY, doubleJump: CHANNEL, fallSpecial: CHANNEL,
      // Spell's raised hands push off a wall; a wall tech is the Attack's quick frost flick.
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
