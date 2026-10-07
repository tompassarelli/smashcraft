// What a hit's element shows on its victim and plays (#144): Melee shows an
// element through the victim's hitlag (its spark, colour program and electric
// shake; docs/design/melee/hit-effects.md); Smashcraft shows a stock Warcraft
// spell effect on the victim's body through hitlag and hitstun, and the
// element's own hit sound. Presentation only: the element never changes an
// outcome. Every model is a classic model in the game's archives and every
// sound a label of its sound tables (ts/test/element-looks.test.ts).
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

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
  [HitElement.slash]: { victim: undefined, victimScale: 1.0, sound: "CriticalStrike", tint: { red: 255, green: 200, blue: 200 } },
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

/**
 * A hit that drained its victim's mana (Illidan's kit, #147): Mana Burn's
 * purple burst over the victim's head, any fighter. Its only sequence, Birth,
 * draws nothing before 0.23 s and holds 0.3-0.8 s (read from its keys), so
 * a drain starts it at 0.3 s.
 */
export const MANA_DRAIN_LOOK = {
  model: "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx",
  sequence: "birth",
  seconds: f32(0.3),
  scale: f32(0.6),
  /** Over the head, in the fighter's model scale. */
  z: 125.0,
} as const;

/** What a renderer last saw of one fighter's drains: its drain count and the hit serial the last drain came with (-1 for none). */
export interface DrainSeen {
  drains: number;
  hit: number;
}

export const drainSeen = (): DrainSeen => ({ drains: 0, hit: -1 });

/** Whether the fighter shows its drain this frame: it is reeling from the hit that drained it. */
export function advanceDrainSeen(seen: DrainSeen, fighter: Readonly<Fighter>): boolean {
  const { visuals, launch } = fighter;
  if (visuals.manaDrained !== seen.drains) {
    seen.drains = visuals.manaDrained;
    seen.hit = visuals.hit;
  }
  return !fighter.status.out && (launch.hitlag > 0 || launch.hitstun > 0) && seen.hit === visuals.hit;
}
