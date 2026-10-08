// Which stock Warcraft missile each projectile draws: per move, so every
// spell reads as its own Warcraft ability. A hero projectile names its model
// on its authored record (SpecialProjectile.model), which the simulation never
// reads. Every path is a classic model in the game's own archives
// (ts/test/projectile-art.test.ts checks each against the extracted model facts).
import { Character, ProjectileKind } from "../sim/codes";
import type { Projectile } from "../sim/fighter";
import { HERO_ROSTER, heroDefinition } from "../sim/heroes/registry";
import type { AuthoredSpecial, FighterSpecials, SpecialProjectile } from "../sim/heroSpecials";

/** The original fighters' projectiles, one stock missile per kind. */
export const ORIGINAL_PROJECTILE_MODELS = {
  /** the reference body's arrow. */
  /** the reference body's homing arrow: the Priestess of the Moon's glowing arrow. */
  /** Rifleman's blaster: the gyrocopter's tracer. */
  [ProjectileKind.blaster]: "Abilities\\Weapons\\GyroCopter\\GyroCopterMissile.mdx",
  /** Rifleman's recoil shot: a dwarven mortar shell blasting downward. */
  [ProjectileKind.recoil]: "Abilities\\Weapons\\Mortar\\MortarMissile.mdx",
  /** Illidan's Mana Burn: his own fel missile. */
  [ProjectileKind.manaBurn]: "Abilities\\Weapons\\DemonHunterMissile\\DemonHunterMissile.mdx",
} as const satisfies Record<Exclude<ProjectileKind, typeof ProjectileKind.hero>, string>;

/** Each original fighter's projectile kinds, its most common first. */
const ORIGINAL_KINDS: { readonly [character: number]: readonly Exclude<ProjectileKind, typeof ProjectileKind.hero>[] } = {
  [Character.rifleman]: [ProjectileKind.blaster, ProjectileKind.recoil],
  [Character.demonHunter]: [ProjectileKind.manaBurn],
};

/** The special inputs, in kit order. */
export const SPECIAL_SLOTS = ["neutral", "side", "up", "down"] as const;
export type SpecialSlot = (typeof SPECIAL_SLOTS)[number];

/** Every projectile one form can put in play: fired, placed objects' shots, bursts, and its follow-ups'. */
function formProjectiles(special: AuthoredSpecial | undefined, into: SpecialProjectile[]): void {
  if (special === undefined) return;
  for (const projectile of special.projectiles ?? []) into.push(projectile);
  if (special.placement?.shot !== undefined) into.push(special.placement.shot);
  if (special.burst !== undefined) into.push(special.burst.from, special.burst.into);
  for (const followUp of special.followUps ?? []) formProjectiles(followUp.special, into);
}

/** One authored projectile and the special input whose forms put it in play. */
export interface HeroProjectileArt {
  readonly slot: SpecialSlot;
  readonly spec: SpecialProjectile;
}

/** Every distinct projectile a hero kit can put in play, by special input. */
export function heroProjectileArt(specials: Readonly<FighterSpecials>): HeroProjectileArt[] {
  const art: HeroProjectileArt[] = [];
  for (const slot of SPECIAL_SLOTS) {
    const kit = specials[slot];
    const specs: SpecialProjectile[] = [];
    const forms = [kit.ground, kit.air, kit.recall, kit.marked?.special];
    // A fixed count: the list holds undefined forms, which Lua iteration would stop at.
    for (let form = 0; form < 5; form++) formProjectiles(forms[form], specs);
    for (const spec of specs) if (!art.some((known) => known.spec === spec)) art.push({ slot, spec });
  }
  return art;
}

/** The model a live projectile draws; undefined for a hero projectile that names none. */
export function projectileModelOf(projectile: Readonly<Projectile>): string | undefined {
  return projectile.kind === ProjectileKind.hero ? projectile.spec?.model : ORIGINAL_PROJECTILE_MODELS[projectile.kind];
}

/** The distinct models a fighter's own projectiles draw, its kit's first first. */
export function fighterProjectileModels(character: Character): readonly string[] {
  const specials = heroDefinition(character)?.specials;
  if (specials === undefined) return (ORIGINAL_KINDS[character] ?? [ProjectileKind.blaster]).map((kind) => ORIGINAL_PROJECTILE_MODELS[kind]);
  const models: string[] = [];
  for (const { spec } of heroProjectileArt(specials)) if (spec.model !== undefined && !models.includes(spec.model)) models.push(spec.model);
  return models;
}

/** Every projectile model a match can draw. */
export function allProjectileModels(): readonly string[] {
  const models: string[] = Object.values(ORIGINAL_PROJECTILE_MODELS);
  for (const hero of HERO_ROSTER) for (const model of fighterProjectileModels(hero.character)) if (!models.includes(model)) models.push(model);
  return models;
}
