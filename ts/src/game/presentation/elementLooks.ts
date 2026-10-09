







import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

export interface ElementLook {

  readonly victim: string | undefined;
  readonly victimScale: number;





  readonly sound: string | undefined;

  readonly tint: { readonly red: number; readonly green: number; readonly blue: number };
}

export const ELEMENT_LOOKS: { readonly [element in HitElement]: ElementLook } = {
  [HitElement.normal]: { victim: undefined, victimScale: 1.0, sound: undefined, tint: { red: 255, green: 185, blue: 150 } },
  [HitElement.slash]: { victim: undefined, victimScale: 1.0, sound: undefined, tint: { red: 255, green: 165, blue: 180 } },

  [HitElement.fire]: { victim: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationDamage.mdx", victimScale: f32(1.2), sound: "Fireball", tint: { red: 255, green: 150, blue: 80 } },
  [HitElement.electric]: { victim: "Abilities\\Spells\\Orc\\Purge\\PurgeBuffTarget.mdx", victimScale: f32(0.8), sound: "LightningBolt", tint: { red: 180, green: 220, blue: 255 } },
  [HitElement.ice]: { victim: "Abilities\\Spells\\Other\\FrostDamage\\FrostDamage.mdx", victimScale: 1.0, sound: "FrostNova", tint: { red: 155, green: 210, blue: 255 } },
  [HitElement.dark]: { victim: "Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx", victimScale: 1.0, sound: "DeathCoil", tint: { red: 150, green: 110, blue: 190 } },
  [HitElement.holy]: { victim: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", victimScale: f32(0.6), sound: "HolyBolt", tint: { red: 255, green: 240, blue: 150 } },
  [HitElement.poison]: { victim: "Abilities\\Weapons\\PoisonSting\\PoisonStingTarget.mdx", victimScale: f32(1.2), sound: "PoisonArrowHit", tint: { red: 150, green: 255, blue: 120 } },
  [HitElement.arcane]: { victim: "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx", victimScale: f32(0.8), sound: "ManaBurn", tint: { red: 200, green: 160, blue: 255 } },
};


export const ELEMENTS: readonly HitElement[] = [
  HitElement.normal, HitElement.fire, HitElement.electric, HitElement.slash, HitElement.ice,
  HitElement.dark, HitElement.holy, HitElement.poison, HitElement.arcane,
];

const BY_CODE: { readonly [code: number]: ElementLook | undefined } = ELEMENT_LOOKS;


export function elementLook(element: number): ElementLook {
  return BY_CODE[element] ?? ELEMENT_LOOKS[HitElement.normal];
}





export const IMMOLATE_SOUNDS = { start: "ImmolationTarget", loop: "LiquidFireLoop", end: "ImmolationDecay" } as const;







export const MANA_DRAIN_LOOK = {
  model: "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx",
  sequence: "birth",
  seconds: f32(0.3),
  scale: f32(0.6),

  z: 125.0,
} as const;


export interface DrainSeen {
  drains: number;
  hit: number;
}

export const drainSeen = (): DrainSeen => ({ drains: 0, hit: -1 });


export function advanceDrainSeen(seen: DrainSeen, fighter: Readonly<Fighter>): boolean {
  const { visuals, launch } = fighter;
  if (visuals.manaDrained !== seen.drains) {
    seen.drains = visuals.manaDrained;
    seen.hit = visuals.hit;
  }
  return !fighter.status.out && (launch.hitlag > 0 || launch.hitstun > 0) && seen.hit === visuals.hit;
}
