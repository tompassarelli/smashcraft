// What a hit's element shows on its victim and plays (#144): Melee shows an
// element through the victim's hitlag (its spark, colour program and electric
// shake; docs/design/melee/hit-effects.md); Smashcraft shows a stock Warcraft
// spell effect on the victim's body through hitlag and hitstun, and the
// element's own hit sound. Presentation only: the element never changes an
// outcome. Every model is a classic model in the game's archives and every
// sound a label of its sound tables (ts/test/element-looks.test.ts).
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../sim/codes";

export interface ElementLook {
  /** The stock effect the victim shows on its body; none for normal hits, whose spark is enough. */
  readonly victim: string | undefined;
  readonly victimScale: number;
  /** The sound label a hit of this element plays (CreateSoundFromLabel). */
  readonly sound: string;
  /** The victim's hitlag tint. */
  readonly tint: { readonly red: number; readonly green: number; readonly blue: number };
}

export const ELEMENT_LOOKS: { readonly [element in HitElement]: ElementLook } = {
  [HitElement.normal]: { victim: undefined, victimScale: 1.0, sound: "StampedeHit", tint: { red: 255, green: 230, blue: 180 } },
  [HitElement.slash]: { victim: undefined, victimScale: 1.0, sound: "RelentlessCleave", tint: { red: 255, green: 200, blue: 200 } },
  // Illidan's Immolation burn: the green fel flames Warcraft puts on its victims.
  [HitElement.fire]: { victim: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationDamage.mdx", victimScale: f32(1.2), sound: "Fireball", tint: { red: 255, green: 150, blue: 80 } },
  [HitElement.electric]: { victim: "Abilities\\Spells\\Orc\\Purge\\PurgeBuffTarget.mdx", victimScale: f32(0.8), sound: "LightningBolt", tint: { red: 180, green: 220, blue: 255 } },
  [HitElement.ice]: { victim: "Abilities\\Spells\\Other\\FrostDamage\\FrostDamage.mdx", victimScale: 1.0, sound: "FrostNova", tint: { red: 155, green: 210, blue: 255 } },
  [HitElement.dark]: { victim: "Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx", victimScale: 1.0, sound: "DeathCoil", tint: { red: 150, green: 110, blue: 190 } },
  [HitElement.holy]: { victim: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", victimScale: f32(0.6), sound: "HolyBolt", tint: { red: 255, green: 240, blue: 150 } },
  [HitElement.poison]: { victim: "Abilities\\Weapons\\PoisonSting\\PoisonStingTarget.mdx", victimScale: f32(1.2), sound: "PoisonArrowHit", tint: { red: 150, green: 255, blue: 120 } },
  [HitElement.arcane]: { victim: "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx", victimScale: f32(0.8), sound: "ManaBurn", tint: { red: 200, green: 160, blue: 255 } },
};

/** Every element, in code order. */
export const ELEMENTS: readonly HitElement[] = [
  HitElement.normal, HitElement.fire, HitElement.electric, HitElement.slash, HitElement.ice,
  HitElement.dark, HitElement.holy, HitElement.poison, HitElement.arcane,
];

const BY_CODE: { readonly [code: number]: ElementLook | undefined } = ELEMENT_LOOKS;

/** An element's look; a code the table lacks shows as normal. */
export function elementLook(element: number): ElementLook {
  return BY_CODE[element] ?? ELEMENT_LOOKS[HitElement.normal];
}

/**
 * Illidan's Immolation: Warcraft's own cast sound when it lights, a fire loop
 * while it burns and its decay when it goes out (render/specialEffects.ts).
 */
export const IMMOLATE_SOUNDS = { start: "ImmolationTarget", loop: "LiquidFireLoop", end: "ImmolationDecay" } as const;
