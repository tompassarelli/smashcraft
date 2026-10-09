import { f32 } from "wisp/src/sim/f32";





import { Character, ProjectileKind } from "../sim/codes";
import type { Projectile } from "../sim/fighter";
import { HERO_ROSTER, heroDefinition } from "../sim/heroes/registry";
import { FIGHTER_ULTIMATES } from "../sim/ultimates";
import type { AuthoredSpecial, FighterSpecials, SpecialProjectile } from "../sim/heroSpecials";


export const ORIGINAL_PROJECTILE_MODELS = {



  [ProjectileKind.blaster]: "Abilities\\Weapons\\GyroCopter\\GyroCopterMissile.mdx",

  [ProjectileKind.recoil]: "Abilities\\Weapons\\Mortar\\MortarMissile.mdx",

  [ProjectileKind.manaBurn]: "Abilities\\Weapons\\DemonHunterMissile\\DemonHunterMissile.mdx",
} as const satisfies Record<Exclude<ProjectileKind, typeof ProjectileKind.hero>, string>;


const ORIGINAL_KINDS: { readonly [character: number]: readonly Exclude<ProjectileKind, typeof ProjectileKind.hero>[] } = {
  [Character.rifleman]: [ProjectileKind.blaster, ProjectileKind.recoil],
  [Character.demonHunter]: [ProjectileKind.manaBurn],
};


export const SPECIAL_SLOTS = ["neutral", "side", "up", "down"] as const;
export type SpecialSlot = (typeof SPECIAL_SLOTS)[number];


function formProjectiles(special: AuthoredSpecial | undefined, into: SpecialProjectile[]): void {
  if (special === undefined) return;
  for (const projectile of special.projectiles ?? []) {
    into.push(projectile);
    if (projectile.expiresInto !== undefined) into.push(projectile.expiresInto);
  }
  if (special.placement?.shot !== undefined) into.push(special.placement.shot);
  if (special.burst !== undefined) into.push(special.burst.from, special.burst.into);
  for (const followUp of special.followUps ?? []) formProjectiles(followUp.special, into);
}


export interface HeroProjectileArt {
  readonly slot: SpecialSlot;
  readonly spec: SpecialProjectile;
}


export function heroProjectileArt(specials: Readonly<FighterSpecials>): HeroProjectileArt[] {
  const art: HeroProjectileArt[] = [];
  for (const slot of SPECIAL_SLOTS) {
    const kit = specials[slot];
    const specs: SpecialProjectile[] = [];
    const forms = [kit.ground, kit.air, kit.recall, kit.marked?.special];
    // Use the fixed count because Lua iteration stops at undefined forms.
    for (let form = 0; form < 5; form++) formProjectiles(forms[form], specs);
    for (const spec of specs) if (!art.some((known) => known.spec === spec)) art.push({ slot, spec });
  }
  return art;
}


export function projectileModelOf(projectile: Readonly<Projectile>): string | undefined {
  return projectile.kind === ProjectileKind.hero ? projectile.spec?.model : ORIGINAL_PROJECTILE_MODELS[projectile.kind];
}


export function fighterProjectileModels(character: Character): readonly string[] {
  const specials = heroDefinition(character)?.specials;
  const models: string[] = specials === undefined ? (ORIGINAL_KINDS[character] ?? [ProjectileKind.blaster]).map((kind) => ORIGINAL_PROJECTILE_MODELS[kind]) : [];
  if (specials !== undefined) for (const { spec } of heroProjectileArt(specials)) if (spec.model !== undefined && !models.includes(spec.model)) models.push(spec.model);
  for (const spec of ultimateProjectiles(character)) if (spec.model !== undefined && !models.includes(spec.model)) models.push(spec.model);
  return models;
}


export function ultimateProjectiles(character: Character): readonly SpecialProjectile[] {
  const specs: SpecialProjectile[] = [];
  formProjectiles(FIGHTER_ULTIMATES[character], specs);
  return specs;
}

export function allProjectileModels(): readonly string[] {
  const models: string[] = Object.values(ORIGINAL_PROJECTILE_MODELS);
  for (const character of [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)]) {
    for (const model of fighterProjectileModels(character)) if (!models.includes(model)) models.push(model);
  }
  return models;
}

export const PROJECTILE_DRAW_SCALES: { readonly [model: string]: number | undefined } = {
  "Abilities\\Weapons\\QuillSprayMissile\\QuillSprayMissile.mdx": 1.5,
  "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx": 1.5,
  "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx": 0.5,
  "Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmMissile.mdx": f32(0.85),
  "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx": f32(0.6),
};
