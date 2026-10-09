


import { AttackStyle, SpecialAction } from "./codes";
import type { NamedMove } from "./heroes/hero";
import {
  CHAOS_STRIKE_AIR_FORM, CHAOS_STRIKE_FORM, DEMONHUNTER_GLIDE_FORM, DEMONHUNTER_GLIDE_SLASH_FORM, RIFLEMAN_SECOND_SHOT_FORM,
  FLAME_CRASH_FORM, VENGEFUL_RETREAT_FORM,
} from "./specials";

export interface OriginalSpecial extends NamedMove {
  readonly action: SpecialAction;

  readonly forms?: readonly { readonly form: number; readonly name: string }[] | undefined;
}

export interface OriginalKit {

  readonly specials: readonly [OriginalSpecial, OriginalSpecial, OriginalSpecial, OriginalSpecial];
  readonly trait?: string | undefined;

  readonly jab: NamedMove;
  readonly ultimate?: NamedMove | undefined;

  readonly inspiredBy?: { readonly [style: number]: string | undefined } | undefined;
}


export const ORIGINAL_KITS: Readonly<Record<number, OriginalKit>> = {
  1: {
    specials: [
      { action: SpecialAction.riflemanBlaster, name: "Blaster", description: "A fast shot that makes its target flinch." },
      { action: SpecialAction.riflemanBear, name: "Summon Bear", description: "Call a bear that fights beside him until it is beaten." },
      {
        action: SpecialAction.riflemanRecovery, name: "Recoil Shot", description: "Fire away from where you want to fly; press again for a second shot and a new direction.",
        forms: [{ form: RIFLEMAN_SECOND_SHOT_FORM, name: "Second Shot" }],
      },
      { action: SpecialAction.riflemanTrap, name: "Frost Trap", description: "Set a trap that freezes the first opponent to step on it; mash to break free." },
    ],
    jab: { name: "Rifle Butt", description: "A push of the barrel, then the stock driven in on a second jab." },
  },
  2: {
    specials: [
      { action: SpecialAction.demonHunterManaBurn, name: "Mana Burn", description: "A slow orb that burns mana and stuns; the emptier it leaves the target, the longer the stun." },
      {
        action: SpecialAction.demonHunterFelRush, name: "Fel Rush", description: "Dash through anyone in your path; press special to flip back out, or attack to slash.",
        forms: [{ form: VENGEFUL_RETREAT_FORM, name: "Vengeful Retreat" }, { form: CHAOS_STRIKE_FORM, name: "Chaos Strike" }, { form: CHAOS_STRIKE_AIR_FORM, name: "Aerial Chaos Strike" }],
      },
      {
        action: SpecialAction.demonHunterWingAscent, name: "Wing Ascent", description: "Rise on his wings; jump near the top to glide, attack in the glide to slash.",
        forms: [{ form: DEMONHUNTER_GLIDE_FORM, name: "Glide" }, { form: DEMONHUNTER_GLIDE_SLASH_FORM, name: "Wing Slash" }],
      },
      {
        action: SpecialAction.demonHunterImmolate, name: "Immolate", description: "A burst of flame around him that a jump can cancel; in the air, plunge down in a Flame Crash.",
        forms: [{ form: FLAME_CRASH_FORM, name: "Flame Crash" }],
      },
    ],
    jab: { name: "Warglaive Flurry", description: "Three quick glaive cuts on repeated jabs; the third launches." },
    inspiredBy: {
      [AttackStyle.forwardTilt]: "Shear, from the Black Temple encounter",
      [AttackStyle.downSmash]: "Flames of Azzinoth, from the Black Temple encounter",
      [AttackStyle.forwardSmash]: "Eye Blast, from the Black Temple encounter",
      [AttackStyle.forwardAir]: "His twin warglaives crossing",
    },
    ultimate: { name: "Metamorphosis", description: "He becomes a demon for a while: heavier, with a fast bolt and a draining aura." },
  },
};
