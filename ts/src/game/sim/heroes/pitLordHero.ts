// Pit Lord's registration: identity, kit and presentation (#121). Set
// `complete` only when the whole base kit works (hero.ts).
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import type { HeroClip, HeroDefinition } from "./hero";
import { PIT_LORD_GAMEPLAN } from "./pitLordGameplan";
import { PIT_LORD_MOVES } from "./pitLordMoves";
import { PIT_LORD_SPECIALS } from "./pitLordSpecials";

// The classic HeroPitLord model's seventeen sequences by file index, with
// their lengths. Shapes come from each sequence's extents: Attack reaches
// furthest forward at mid height, the Attack Slam pairs swing the cleaver
// overhead and down in front, "attack - 2" sweeps both sides and Spell Slam
// and Spell raise it highest. The model has no hit or ready stance.
const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });
const STAND_3 = clip(0, f32(2.833));
const WALK = clip(1, f32(1.333));
const STAND = clip(2, f32(2.667));
const WALK_FAST = clip(3, f32(0.467));
/** Stand - 2: a short shift of weight, used for flinches. */
const STAND_2 = clip(4, f32(1.167));
/** Attack Slam - 1: the cleaver overhead and down in front (forward 288, up 290). */
const ATTACK_SLAM_1 = clip(5, 1.5);
/** Spell Slam: raised high (339) and driven down. */
const SPELL_SLAM = clip(6, 1.5);
/** Attack: the forward thrust (282 ahead at mid height). */
const ATTACK = clip(7, 1.5);
const DEATH = clip(8, f32(2.667));
const DISSIPATE = clip(9, 2.0);
/** Stand Channel: arms up and roaring. */
const STAND_CHANNEL = clip(12, f32(1.333));
/** Attack Slam - 2: a sweep across both sides (254 each way). */
const ATTACK_SLAM_2 = clip(13, f32(1.667));
/** Spell: arms raised highest (370). */
const SPELL = clip(14, 1.5);
const ATTACK_2 = clip(15, f32(1.667));
const ATTACK_3 = clip(16, 1.5);

export const PIT_LORD_HERO: HeroDefinition = {
  character: Character.pitLord,
  name: "Pit Lord",
  purpose: "Extreme heavy with long cleaves",
  weakness: "Very large target and slow recovery",
  passive: { name: "Cleaving Attack", description: "His cleaver strikes every opponent in its path, and the blade itself can't be hit." },
  complete: true,
  moves: PIT_LORD_MOVES,
  specials: PIT_LORD_SPECIALS,
  gameplan: PIT_LORD_GAMEPLAN,
  presentation: {
    model: "units\\demon\\HeroPitLord\\HeroPitLord.mdl",
    // The bind pose is 187 tall at scale 1 with horns and raised cleaver; the roster's body is 1.35H (179).
    scale: f32(0.95),
    objectId: 0x6d66706c,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNPitLord.blp",
    clips: {
      idle: STAND, walk: WALK, dash: WALK_FAST, run: WALK_FAST, crouch: STAND_2, fall: STAND, landing: STAND_2,
      shield: STAND_2, airDodge: STAND_2, smashCharge: STAND_2, ko: DISSIPATE, dizzy: STAND_3,
      jab: ATTACK, grab: ATTACK, forwardTilt: ATTACK, forwardTiltUp: ATTACK_SLAM_1, forwardTiltDown: ATTACK_3,
      upTilt: SPELL, downTilt: ATTACK_3, dashAttack: ATTACK_SLAM_2,
      forwardSmash: ATTACK_SLAM_1, upSmash: SPELL_SLAM, downSmash: ATTACK_2,
      neutralAir: ATTACK_SLAM_2, forwardAir: ATTACK_SLAM_1, backAir: ATTACK_2, upAir: SPELL, downAir: ATTACK_3,
      getUpAttack: ATTACK_2,
      ledgeHang: STAND, ledgeClimb: WALK, ledgeRoll: WALK_FAST, ledgeAttack: ATTACK,
      knockdown: DEATH, getUp: STAND_2, downDamage: DEATH,
      rollForward: WALK_FAST, rollBackward: WALK_FAST, spotDodge: STAND_2,
      jump: STAND_2, doubleJump: STAND_2, fallSpecial: STAND_3,
      // The Attack Slam's heave shoves him off a wall; a wall tech braces with Spell Slam.
      wallJump: ATTACK_SLAM_1, wallTech: SPELL_SLAM,
      damageGround: STAND_2, damageAir: STAND_2, damageTumble: STAND_2, damageShield: STAND_2,
      grabHold: STAND, grabbed: STAND_2,
      pummel: ATTACK, throwForward: ATTACK_3, throwBack: ATTACK_2, throwUp: SPELL_SLAM, throwDown: ATTACK_SLAM_1,
      victimPummel: STAND_2, victimThrowForward: STAND_2, victimThrowBack: STAND_2,
      victimThrowUp: STAND_2, victimThrowDown: STAND_2,
      neutralSpecial: SPELL, sideSpecial: ATTACK_SLAM_2, upSpecial: SPELL_SLAM, downSpecial: STAND_CHANNEL,
      neutralSpecialAir: SPELL, sideSpecialAir: ATTACK_SLAM_2, upSpecialAir: SPELL_SLAM, downSpecialAir: STAND_CHANNEL,
    },
    fallback: STAND,
  },
};
