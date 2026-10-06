// Shadow Hunter's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import type { HeroClip, HeroDefinition } from "./hero";
import { SHADOW_HUNTER_GAMEPLAN } from "./shadowHunterGameplan";
import { SHADOW_HUNTER_MOVES } from "./shadowHunterMoves";
import { SHADOW_HUNTER_SPECIALS } from "./shadowHunterSpecials";

// The classic model's fourteen sequences, by file index, name and length. It
// has one attack clip, so moves share clips by motion. Peaks below come from
// skinned samples of each clip: where the drawn strike or cast is furthest out.
const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });
const WALK = clip(0, f32(0.8));
const STAND_1 = clip(1, 1.0);
/** Stand -3: a low, swaying idle with the glaive lowered. */
const STAND_3 = clip(5, f32(4.2));
/** Stand -2: the glaive sweeps the front (0.65 s), then fully behind (x -196 at 1.94 s). */
const STAND_2 = clip(2, f32(3.233));
/** Spell Throw: a low forward lunge (body to z -62 at 1.55 s), then an overhand release reaching x 243 at 2.48 s. */
const SPELL_THROW = clip(3, f32(3.1));
/** Death: ends slumped and holds. */
const DEATH = clip(4, f32(3.766));
/** Stand -4: both arms raised, a helpless open fall. */
const STAND_4 = clip(6, f32(6.333));
const STAND_READY = clip(7, 1.0);
/** Spell: arms overhead, peak height 198 at 0.79 s. */
const SPELL = clip(8, f32(1.666));
/** Stand Hit: a backward sway (x -120 at 0.25 s) and return. */
const STAND_HIT = clip(9, f32(0.5));
/** Attack: back wind-up, a forward glaive chop reaching x 211 at 0.55 s, a second sweep at 1.25 s. */
const ATTACK = clip(10, f32(1.567));
/** Stand Victory: a crouch, then a leap leaving the ground at 0.6 s. */
const STAND_VICTORY = clip(11, 3.0);
/** Stand Channel: a hopping voodoo stomp, front reach at 0.27 s, rear at 1.08 s. */
const STAND_CHANNEL = clip(13, f32(2.7));
/** Dissipate: the spirit rises out of the slumped body. */
const DISSIPATE = clip(12, f32(1.666));

export const SHADOW_HUNTER_HERO: HeroDefinition = {
  character: Character.shadowHunter,
  name: "Shadow Hunter",
  purpose: "Totem placement and angles",
  weakness: "Setup can be destroyed or bypassed",
  complete: true,
  moves: SHADOW_HUNTER_MOVES,
  specials: SHADOW_HUNTER_SPECIALS,
  passive: { name: "Voodoo Crossfire", description: "Glaive and ward hits charge his next melee hit with extra damage." },
  ultimate: { name: "Big Bad Voodoo", description: "A ward zone that makes him take less damage while he stands in it." },
  gameplan: SHADOW_HUNTER_GAMEPLAN,
  presentation: {
    model: "units\\orc\\HeroShadowHunter\\HeroShadowHunter.mdl",
    // Stand Ready is 138 units tall at scale 1, against the roster's 1.08H (143).
    scale: 1.0,
    objectId: 0x6d667368,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNShadowHunter.blp",
    clips: {
      idle: STAND_READY, walk: WALK, dash: WALK, run: WALK, crouch: STAND_READY, fall: STAND_READY, landing: STAND_READY,
      shield: STAND_READY, airDodge: STAND_HIT, smashCharge: STAND_READY, ko: DISSIPATE, dizzy: STAND_3,
      jab: ATTACK, grab: ATTACK, forwardTilt: ATTACK, forwardTiltUp: ATTACK, forwardTiltDown: ATTACK,
      upTilt: SPELL, downTilt: SPELL_THROW, dashAttack: ATTACK,
      forwardSmash: SPELL_THROW, upSmash: SPELL, downSmash: STAND_CHANNEL,
      // No kick exists in the model: Heel Hook plays the rear sweep.
      neutralAir: STAND_2, forwardAir: ATTACK, backAir: STAND_2, upAir: SPELL, downAir: SPELL_THROW,
      getUpAttack: ATTACK,
      ledgeHang: STAND_READY, ledgeClimb: WALK, ledgeRoll: WALK, ledgeAttack: ATTACK,
      knockdown: DEATH, getUp: STAND_READY, downDamage: DEATH,
      rollForward: WALK, rollBackward: WALK, spotDodge: STAND_HIT,
      jump: STAND_VICTORY, doubleJump: STAND_VICTORY, fallSpecial: STAND_4,
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
