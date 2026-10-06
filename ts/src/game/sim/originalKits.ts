// The original fighters' move names: their specials run as code (specials.ts),
// so their names and one-line descriptions live in this record, shaped like a
// hero's (SpecialKit.name, HeroDefinition.passive and ultimate).
import { SpecialAction } from "./codes";
import type { NamedMove } from "./heroes/hero";
import { ARCHER_DIVE_FORM, DEMONHUNTER_GLIDE_FORM, DEMONHUNTER_GLIDE_SLASH_FORM, RIFLEMAN_SECOND_SHOT_FORM } from "./specials";

export interface OriginalSpecial extends NamedMove {
  readonly action: SpecialAction;
  /** Forms the design names on their own, by the running special's form code. */
  readonly forms?: readonly { readonly form: number; readonly name: string }[] | undefined;
}

export interface OriginalKit {
  /** Neutral, side, up and down. */
  readonly specials: readonly [OriginalSpecial, OriginalSpecial, OriginalSpecial, OriginalSpecial];
  /** Absent for a fighter the design gives no passive; `trait` then says what its hits do instead. */
  readonly passive?: NamedMove | undefined;
  readonly trait?: string | undefined;
  readonly ultimate?: NamedMove | undefined;
  /** Docs only: what a normal draws on, by AttackStyle (a hero's is AuthoredMove.inspiredBy). */
  readonly inspiredBy?: { readonly [style: number]: string | undefined } | undefined;
}

/** By Character code: Archer, Rifleman, Illidan. */
export const ORIGINAL_KITS: readonly OriginalKit[] = [
  {
    specials: [
      { action: SpecialAction.archerArrow, name: "Swift Arrow", description: "A quick arrow you can cancel with a jump." },
      { action: SpecialAction.archerHomingArrow, name: "Seeking Arrow", description: "An arrow that curves toward the nearest opponent." },
      { action: SpecialAction.archerRecovery, name: "Hippogryph Ride", description: "Ride a hippogryph and steer it; jump off to act again." },
      {
        action: SpecialAction.archerDisengage, name: "Hippogryph Call", description: "Send the hippogryph swooping to a perch; press again and it dives at her through anyone in the way.",
        forms: [{ form: ARCHER_DIVE_FORM, name: "Hippogryph Dive" }],
      },
    ],
    passive: { name: "Trueshot Aura", description: "Every third arrow that lands in a short time deals double damage; the ready arrow glows." },
  },
  {
    specials: [
      { action: SpecialAction.riflemanBlaster, name: "Blaster", description: "A fast shot that makes its target flinch." },
      { action: SpecialAction.riflemanBear, name: "Summon Bear", description: "Call a bear that fights beside him until it is beaten." },
      {
        action: SpecialAction.riflemanRecovery, name: "Recoil Shot", description: "Fire away from where you want to fly; press again for a second shot and a new direction.",
        forms: [{ form: RIFLEMAN_SECOND_SHOT_FORM, name: "Second Shot" }],
      },
      { action: SpecialAction.riflemanTrap, name: "Frost Trap", description: "Set a trap that freezes the first opponent to step on it; mash to break free." },
    ],
    passive: { name: "Long Rifles", description: "Every fourth blaster shot flies farther and launches." },
  },
  {
    specials: [
      { action: SpecialAction.demonHunterManaBurn, name: "Mana Burn", description: "A slow orb that stuns; the more damage the target has, the longer the stun." },
      { action: SpecialAction.demonHunterParryStep, name: "Parry Step", description: "A side step that stops an attack caught early in it and leaves the attacker stunned." },
      {
        action: SpecialAction.demonHunterWingAscent, name: "Wing Ascent", description: "Rise on his wings; jump near the top to glide, attack in the glide to slash.",
        forms: [{ form: DEMONHUNTER_GLIDE_FORM, name: "Glide" }, { form: DEMONHUNTER_GLIDE_SLASH_FORM, name: "Wing Slash" }],
      },
      { action: SpecialAction.demonHunterImmolate, name: "Immolate", description: "A burst of flame around him that a jump can cancel." },
    ],
    trait: "Every hit he lands drains the target's mana; bigger hits drain more.",
    ultimate: { name: "Metamorphosis", description: "He becomes a demon for a while: heavier, with a fast bolt and a draining aura." },
  },
];
