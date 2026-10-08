// Beastmaster's registration: identity, kit and presentation (#122). Set
// `complete` only when the whole base kit works (hero.ts).
import { f32 } from "wisp/src/sim/f32";
import { jabSlice } from "./groundNormals";
import { Character } from "../codes";
import type { HeroClip, HeroDefinition } from "./hero";
import { BEASTMASTER_GAMEPLAN } from "./beastmasterGameplan";
import { BEASTMASTER_MOVES } from "./beastmasterMoves";
import { BEASTMASTER_SPECIALS } from "./beastmasterSpecials";

// The classic BeastMaster model's ten sequences by file index, with their
// lengths. It has two axe attacks, a cast, a slam and a ready stance, and no
// hit, jump or kick clip, so moves share clips by motion.
const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });
const WALK = clip(0, 1.0);
const STAND_1 = clip(1, 3.0);
/** Stand - 2: a looser idle, used while dizzy. */
const STAND_2 = clip(2, 3.0);
/** Spell Slam: both axes driven down. */
const SPELL_SLAM = clip(3, f32(1.667));
/** Attack: a forward axe swing (200 ahead). */
const ATTACK = clip(4, f32(0.967));
/** Spell: an arm thrown forward and up, the hawk and bear calls. */
const SPELL = clip(5, f32(0.967));
/** Attack -2: the second axe, higher (281 up). */
const ATTACK_2 = clip(6, f32(0.967));
const DEATH = clip(7, f32(3.667));
const DISSIPATE = clip(8, 2.0);
const STAND_READY = clip(9, 1.0);

export const BEASTMASTER_HERO: HeroDefinition = {
  character: Character.beastmaster,
  name: "Beastmaster",
  purpose: "Three-animal pack coordination",
  weakness: "Shared resources and punishable pet commands",
  jab: { name: "Twin Axes", description: "Both axe hilts, then a shoulder that shoves, on repeated jabs." },
  complete: true,
  moves: BEASTMASTER_MOVES,
  specials: BEASTMASTER_SPECIALS,
  gameplan: BEASTMASTER_GAMEPLAN,
  presentation: {
    model: "units\\creeps\\BeastMaster\\BeastMaster.mdl",
    objectId: 0x6d666273,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNBeastMaster.blp",
    placedModel: { path: "units\\creeps\\GrizzlyBear\\GrizzlyBear.mdl", height: 137.0, alpha: 255 },
    clips: {
      idle: STAND_READY, walk: WALK, dash: WALK, run: WALK, crouch: STAND_READY, fall: STAND_READY, landing: STAND_READY,
      shield: STAND_READY, airDodge: STAND_READY, smashCharge: STAND_READY, ko: DISSIPATE, dizzy: STAND_2,
      jab: jabSlice(ATTACK, f32(0.31)), jab2: jabSlice(ATTACK, f32(0.31)), jab3: jabSlice(ATTACK, f32(0.31)), grab: ATTACK, forwardTilt: ATTACK, forwardTiltUp: ATTACK_2, forwardTiltDown: ATTACK,
      upTilt: ATTACK_2, downTilt: ATTACK, dashAttack: ATTACK,
      forwardSmash: SPELL_SLAM, upSmash: ATTACK_2, downSmash: SPELL_SLAM,
      neutralAir: ATTACK_2, forwardAir: SPELL_SLAM, backAir: ATTACK, upAir: ATTACK_2, downAir: SPELL_SLAM,
      getUpAttack: ATTACK,
      ledgeHang: STAND_READY, ledgeClimb: WALK, ledgeRoll: WALK, ledgeAttack: ATTACK,
      knockdown: DEATH, getUp: STAND_READY, downDamage: DEATH,
      rollForward: WALK, rollBackward: WALK, spotDodge: STAND_READY,
      jump: STAND_READY, doubleJump: STAND_READY, fallSpecial: STAND_1,
      // Spell Slam's crouch and spring kicks off a wall; a wall tech is the quick Attack -2 swing.
      wallJump: SPELL_SLAM, wallTech: ATTACK_2,
      damageGround: STAND_READY, damageAir: STAND_READY, damageTumble: STAND_READY, damageShield: STAND_READY,
      grabHold: STAND_READY, grabbed: STAND_READY,
      pummel: ATTACK, throwForward: ATTACK, throwBack: ATTACK_2, throwUp: ATTACK_2, throwDown: SPELL_SLAM,
      victimPummel: STAND_READY, victimThrowForward: STAND_READY, victimThrowBack: STAND_READY,
      victimThrowUp: STAND_READY, victimThrowDown: STAND_READY,
      neutralSpecial: ATTACK, sideSpecial: SPELL, upSpecial: SPELL, downSpecial: SPELL,
      neutralSpecialAir: ATTACK, sideSpecialAir: SPELL, upSpecialAir: SPELL, downSpecialAir: SPELL,
    },
    fallback: STAND_1,
  },
};
