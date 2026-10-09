

import { f32 } from "wisp/src/sim/f32";
import { jabSlice } from "./groundNormals";
import { Character } from "../codes";
import type { HeroClip, HeroDefinition } from "./hero";
import { PIT_LORD_GAMEPLAN } from "./pitLordGameplan";
import { PIT_LORD_MOVES } from "./pitLordMoves";
import { PIT_LORD_SPECIALS } from "./pitLordSpecials";
import { PIT_LORD_SPECIAL_CLIPS } from "../../presentation/heroes/pitLordClipInfo";






const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });
const STAND_3 = clip(0, f32(2.833));
const WALK = clip(1, f32(1.333));
const STAND = clip(2, f32(2.667));
const WALK_FAST = clip(3, f32(0.467));

const STAND_2 = clip(4, f32(1.167));

const ATTACK_SLAM_1 = clip(5, 1.5);

const SPELL_SLAM = clip(6, 1.5);

const ATTACK = clip(7, 1.5);
const DEATH = clip(8, f32(2.667));
const DISSIPATE = clip(9, 2.0);

const ATTACK_SLAM_2 = clip(13, f32(1.667));

const SPELL = clip(14, 1.5);
const ATTACK_2 = clip(15, f32(1.667));
const ATTACK_3 = clip(16, 1.5);

export const PIT_LORD_HERO: HeroDefinition = {
  character: Character.pitLord,
  name: "Pit Lord",
  purpose: "Siege heavyweight: falling fire and long cleaves",
  weakness: "Very large target and slow recovery",
  jab: { name: "Haft and Chop", description: "A haft check, then a short cleaver chop on a second jab." },
  complete: true,
  moves: PIT_LORD_MOVES,
  specials: PIT_LORD_SPECIALS,
  gameplan: PIT_LORD_GAMEPLAN,
  presentation: {
    model: "units\\demon\\HeroPitLord\\HeroPitLord.mdl",
    objectId: 0x6d66706c,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNPitLord.blp",
    clips: {
      idle: STAND, walk: WALK, dash: WALK_FAST, run: WALK_FAST, crouch: STAND_2, fall: STAND, landing: STAND_2,
      shield: STAND_2, airDodge: STAND_2, smashCharge: STAND_2, ko: DISSIPATE, dizzy: STAND_3,
      jab: jabSlice(ATTACK, f32(0.68)), jab2: jabSlice(ATTACK, f32(0.71)), grab: ATTACK, forwardTilt: ATTACK, forwardTiltUp: ATTACK_SLAM_1, forwardTiltDown: ATTACK_3,
      upTilt: SPELL, downTilt: ATTACK_3, dashAttack: ATTACK_SLAM_2,
      forwardSmash: ATTACK_SLAM_1, upSmash: SPELL_SLAM, downSmash: ATTACK_2,
      neutralAir: ATTACK_SLAM_2, forwardAir: ATTACK_SLAM_1, backAir: ATTACK_2, upAir: SPELL, downAir: ATTACK_3,
      getUpAttack: ATTACK_2,
      ledgeHang: STAND, ledgeClimb: WALK, ledgeRoll: WALK_FAST, ledgeAttack: ATTACK,
      knockdown: DEATH, getUp: STAND_2, downDamage: DEATH,
      rollForward: WALK_FAST, rollBackward: WALK_FAST, spotDodge: STAND_2,
      jump: STAND_2, doubleJump: STAND_2, fallSpecial: STAND_3,

      wallJump: ATTACK_SLAM_1, wallTech: SPELL_SLAM,
      damageGround: STAND_2, damageAir: STAND_2, damageTumble: STAND_2, damageShield: STAND_2,
      grabHold: STAND, grabbed: STAND_2,
      pummel: ATTACK, throwForward: ATTACK_3, throwBack: ATTACK_2, throwUp: SPELL_SLAM, throwDown: ATTACK_SLAM_1,
      victimPummel: STAND_2, victimThrowForward: STAND_2, victimThrowBack: STAND_2,
      victimThrowUp: STAND_2, victimThrowDown: STAND_2,
      ...PIT_LORD_SPECIAL_CLIPS,
    },
    fallback: STAND,
  },
};
