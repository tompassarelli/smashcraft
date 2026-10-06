// Warden's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { type HeroClip, type HeroDefinition } from "./hero";
import { WARDEN_MOVES } from "./wardenMoves";
import { WARDEN_SPECIALS } from "./wardenSpecials";

// The classic HeroWarden model's twelve sequences (the test clients run
// hd=0). It has no hit, jump or knockdown clips, so those poses reuse the
// nearest readable sequence; "Stand - 2" (index 1) is the unused fidget.
const sequence = (index: number, _name: string, seconds: number): HeroClip => ({ index, seconds });
const STAND = sequence(0, "Stand - 1", f32(1.334));
const WALK = sequence(2, "Walk", f32(1.166));
const DEATH = sequence(3, "Death", 1.0);
const STAND_READY = sequence(4, "Stand Ready", 1.0);
const ATTACK_2 = sequence(5, "Attack - 2", f32(1.167));
const SPELL_SLAM = sequence(6, "Spell Slam", 1.2);
const SPELL = sequence(7, "Spell", 1.2);
const SPELL_THROW = sequence(8, "Spell Throw", f32(0.333));
const ATTACK_1 = sequence(9, "Attack - 1", f32(0.966));
const DISSIPATE = sequence(10, "Dissipate", f32(2.667));
const STAND_CHANNEL = sequence(11, "Stand Channel", 2.0);

export const WARDEN_HERO: HeroDefinition = {
  character: Character.warden,
  name: "Warden",
  purpose: "Precision mobility and edge pressure",
  weakness: "Light body and punishable teleport endpoints",
  complete: false,
  moves: WARDEN_MOVES,
  specials: WARDEN_SPECIALS,
  presentation: {
    model: "units\\nightelf\\HeroWarden\\HeroWarden.mdl",
    scale: 1.0,
    baseUnit: "Ewar",
    objectId: 0x6d667764,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroWarden.blp",
    projectileModel: "Abilities\\Spells\\NightElf\\shadowstrike\\ShadowStrikeMissile.mdl",
    clips: {
      // Two blade swings, an overhead slam and a two-handed cast carry the normals.
      jab: ATTACK_1, forwardTilt: ATTACK_2, forwardTiltUp: ATTACK_2, forwardTiltDown: ATTACK_1,
      upTilt: SPELL, downTilt: ATTACK_1, dashAttack: ATTACK_2,
      forwardSmash: SPELL_SLAM, upSmash: SPELL, downSmash: ATTACK_2,
      neutralAir: ATTACK_1, forwardAir: ATTACK_2, backAir: ATTACK_1, upAir: SPELL, downAir: SPELL_SLAM,
      getUpAttack: ATTACK_2, ledgeAttack: ATTACK_2,
      grab: ATTACK_1, grabHold: STAND_READY, grabbed: STAND_READY, pummel: ATTACK_1,
      throwForward: ATTACK_2, throwBack: ATTACK_2, throwUp: SPELL, throwDown: SPELL_SLAM,
      victimPummel: STAND_READY, victimThrowForward: STAND_READY, victimThrowBack: STAND_READY,
      victimThrowUp: STAND_READY, victimThrowDown: STAND_READY,
      ledgeHang: STAND_CHANNEL, ledgeClimb: SPELL_SLAM, ledgeRoll: WALK,
      knockdown: DEATH, getUp: STAND_READY, downDamage: DEATH,
      rollForward: WALK, rollBackward: WALK, spotDodge: DISSIPATE,
      jump: STAND_READY, doubleJump: SPELL_THROW, fallSpecial: STAND_CHANNEL,
      damageGround: STAND, damageAir: STAND_READY, damageTumble: DEATH, damageShield: STAND_CHANNEL,
      // Shadow Strike throws; Blink is the model's own dissipate.
      neutralSpecial: SPELL_THROW, sideSpecial: ATTACK_2, upSpecial: DISSIPATE, downSpecial: SPELL,
      neutralSpecialAir: SPELL_THROW, sideSpecialAir: ATTACK_2, upSpecialAir: DISSIPATE, downSpecialAir: SPELL,
    },
    fallback: STAND_READY,
  },
};
