// Dreadlord's stock classic model and the sequence each pose plays. Indices,
// names and lengths are those of the classic HeroDreadLord.mdx (the test
// clients run hd=0; the HD model keeps indices 0-10 and differs at 11). The
// model has eleven usable sequences and no hit, jump, dodge or knockdown
// clips, so those poses reuse the nearest readable sequence. Dissipate draws
// no body at all, so no pose plays it: his hurt volumes stay visible.
import { f32 } from "wisp/src/sim/f32";
import type { HeroClipTable } from "../../sim/heroes/hero";

export const DREADLORD_MODEL_FILE = "units\\undead\\HeroDreadLord\\HeroDreadLord.mdl";

interface StockClip {
  readonly index: number;
  readonly name: string;
  readonly seconds: number;
}

const clip = (index: number, name: string, seconds: number): StockClip => ({ index, name, seconds });

/** Every sequence in the classic model, by index ("Cinematic death", 11, repeats Death). */
export const DREADLORD_SEQUENCES = {
  stand: clip(0, "Stand", 1.5),
  standReady: clip(1, "Stand Ready", 1.5),
  wingStretch: clip(2, "Stand - 2", f32(2.933)),
  rearUp: clip(3, "Stand - 3", f32(2.933)),
  spell: clip(4, "Spell", f32(1.833)),
  walk: clip(5, "Walk", 1.0),
  spellSlam: clip(6, "Spell Slam", 2.0),
  death: clip(7, "Death", f32(2.333)),
  dissipate: clip(8, "Dissipate", f32(3.333)),
  attack1: clip(9, "Attack - 1", f32(1.1)),
  attack2: clip(10, "Attack - 2", f32(1.1)),
} as const;

const s = DREADLORD_SEQUENCES;

/** Each pose's sequence; the presentation fits it to the action's frames. */
export const DREADLORD_CLIP_TABLE: HeroClipTable = {
  idle: s.standReady, walk: s.walk, dash: s.walk, run: s.walk, crouch: s.spellSlam, fall: s.standReady,
  landing: s.standReady, shield: s.standReady, airDodge: s.wingStretch, smashCharge: s.standReady, ko: s.death, dizzy: s.stand,
  jump: s.wingStretch, doubleJump: s.wingStretch, fallSpecial: s.standReady,
  spotDodge: s.standReady, rollForward: s.walk, rollBackward: s.walk,
  damageGround: s.standReady, damageAir: s.standReady, damageTumble: s.death, damageShield: s.standReady,
  knockdown: s.death, downDamage: s.death, getUp: s.standReady, getUpAttack: s.attack2,
  ledgeHang: s.standReady, ledgeClimb: s.spellSlam, ledgeRoll: s.walk, ledgeAttack: s.attack2,
  // Claws are the two attack swings; wings and horns the raised spell and rear-up; the slam is the low sweep.
  jab: s.attack1, forwardTilt: s.attack2, forwardTiltUp: s.attack2, forwardTiltDown: s.attack2,
  upTilt: s.spell, downTilt: s.attack1, dashAttack: s.attack2,
  forwardSmash: s.attack2, upSmash: s.rearUp, downSmash: s.spellSlam,
  neutralAir: s.spell, forwardAir: s.attack2, backAir: s.attack1, upAir: s.rearUp, downAir: s.spellSlam,
  grab: s.attack1, grabHold: s.standReady, grabbed: s.standReady, pummel: s.attack1,
  throwForward: s.attack2, throwBack: s.attack1, throwUp: s.spell, throwDown: s.spellSlam,
  victimPummel: s.standReady, victimThrowForward: s.standReady, victimThrowBack: s.standReady,
  victimThrowUp: s.standReady, victimThrowDown: s.death,
  // Carrion Swarm and Sleep are his casting spell; Vampiric Pounce a claw lunge; Bat Ascension a wing spread.
  neutralSpecial: s.spell, sideSpecial: s.attack2, upSpecial: s.wingStretch, downSpecial: s.spell,
  neutralSpecialAir: s.spell, sideSpecialAir: s.attack2, upSpecialAir: s.wingStretch, downSpecialAir: s.spell,
};

export const DREADLORD_FALLBACK_CLIP = s.standReady;
