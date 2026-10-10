import { f32 } from "wisp/src/sim/f32";





import { Character, ProjectileKind } from "../sim/codes";
import type { Projectile } from "../sim/fighter";
import { HERO_ROSTER, heroDefinition } from "../sim/heroes/registry";
import { FIGHTER_ULTIMATES } from "../sim/ultimates";
import type { AuthoredSpecial, FighterSpecials, SpecialProjectile } from "../sim/heroSpecials";


export const ORIGINAL_PROJECTILE_MODELS = {



  [ProjectileKind.blaster]: "Abilities\\Weapons\\FlyingMachine\\FlyingMachineMissile.mdx",

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
  "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveMissile.mdx": f32(0.3),
  "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareMissile.mdx": f32(1.2),
  "Abilities\\Weapons\\QuillSprayMissile\\QuillSprayMissile.mdx": 1.5,
  "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx": 1.5,
  "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx": 0.5,
  "Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmMissile.mdx": f32(0.85),
  "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx": f32(0.6),
  "Abilities\\Spells\\Other\\Consecration\\Consecration.mdx": 0.25,
  "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx": 0.5,
  "units\\creeps\\PandarenBrewmaster\\PandarenBrewmaster.mdl": f32(0.6),
  "Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx": f32(0.7),
  "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx": f32(0.7),
  "Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx": 0.5,
};

export const PROJECTILE_DRAW_OFFSETS: { readonly [model: string]: { readonly x: number; readonly z: number; readonly sequence?: string | undefined; readonly seconds?: number | undefined; readonly width?: number | undefined; readonly height?: number | undefined } | undefined } = {
  "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveMissile.mdx": { x: -20.0, z: -33.0, sequence: "stand", seconds: f32(0.2), width: f32(0.75), height: 2.0 },
  "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareMissile.mdx": { x: 0.0, z: 0.0, sequence: "birth", seconds: f32(0.2) },
};


export const DEFINITIVE_ULTIMATE_MODELS: { readonly [character: number]: { readonly [model: string]: string | undefined } | undefined } = {
  [Character.cairne]: { "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveMissile.mdx": "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareMissile.mdx" },
  [Character.demonHunter]: { "Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx": "Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx" },
  [Character.forsakenPaladin]: { "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx": "Abilities\\Weapons\\PriestMissile\\PriestMissile.mdl" },
  [Character.pitLord]: { "Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx": "Abilities\\Weapons\\VoidWalkerMissile\\VoidWalkerMissile.mdx" },
  [Character.sylvanas]: { "Abilities\\Weapons\\BansheeMissile\\BansheeMissile.mdx": "Units\\Undead\\Banshee\\Banshee.mdx" },
  [Character.kaelthas]: { "Abilities\\Spells\\Human\\MassTeleport\\MassTeleportTarget.mdx": "Abilities\\Weapons\\SorceressMissile\\SorceressMissile.mdx" },
  [Character.grom]: { "Abilities\\Spells\\Orc\\Bloodlust\\BloodlustTarget.mdx": "Abilities\\Spells\\Orc\\TrollBerserk\\TrollBeserkerTarget.mdx" },
  [Character.medivh]: { "Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx": "Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx" },
};


export const DEFINITIVE_PROJECTILE_REDRAWS: { readonly [model: string]: string } = {
  "Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Human\\MassTeleport\\MassTeleportTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Human\\StormBolt\\StormBoltMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\NightElf\\EntanglingRoots\\EntanglingRootsTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrikeMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\NightElf\\TargetArtLumber\\TargetArtLumber.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\NightElf\\Tranquility\\TranquilityTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Orc\\AncestralSpirit\\AncestralSpiritCaster.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Orc\\Bloodlust\\BloodlustTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Orc\\EarthQuake\\EarthquakeTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Orc\\Ensnare\\EnsnareMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Orc\\Reincarnation\\ReincarnationTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\BlackArrow\\BlackArrowMissile.mdl": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\BreathOfFrost\\BreathOfFrostTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\Consecration\\Consecration.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\Stampede\\StampedeMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\StrongDrink\\BrewmasterMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Undead\\AnimateDead\\AnimateDeadTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Undead\\Impale\\ImpaleHitTarget.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Spells\\Undead\\Impale\\ImpaleMissTarget.mdl": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\AncientProtectorMissile\\AncientProtectorMissile.mdl": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\Axe\\AxeMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\BansheeMissile\\BansheeMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\DemolisherFireMissile\\DemolisherFireMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\DemonHunterMissile\\DemonHunterMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\HunterMissile\\HunterMissile.mdl": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\KeeperGroveMissile\\KeeperGroveMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\Mortar\\MortarMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\PriestMissile\\PriestMissile.mdl": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\QuillSprayMissile\\QuillSprayMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\RocketMissile\\RocketMissile.mdl": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\SentinelMissile\\SentinelMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\SerpentWardMissile\\SerpentWardMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\SorceressMissile\\SorceressMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\WaterElementalMissile\\WaterElementalMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "Abilities\\Weapons\\WitchDoctorMissile\\WitchDoctorMissile.mdx": "HD redraw, Definitive look not yet reviewed",
  "units\\creeps\\GrizzlyBear\\GrizzlyBear.mdl": "HD redraw, Definitive look not yet reviewed",
  "Units\\Creeps\\HeroTinkerRobot\\HeroTinkerRobot.mdl": "HD redraw, Definitive look not yet reviewed",
  "units\\creeps\\Murloc\\Murloc.mdl": "HD redraw, Definitive look not yet reviewed",
  "units\\creeps\\PandarenBrewmaster\\PandarenBrewmaster.mdl": "HD redraw, Definitive look not yet reviewed",
  "units\\creeps\\QuillBeast\\QuillBeast.mdl": "HD redraw, Definitive look not yet reviewed",
  "units\\creeps\\WarEagle\\WarEagle.mdl": "HD redraw, Definitive look not yet reviewed",
  "units\\nightelf\\Ent\\Ent.mdl": "HD redraw, Definitive look not yet reviewed",
  "units\\orc\\SpiritWolf\\SpiritWolf.mdx": "HD redraw, Definitive look not yet reviewed",
  "Units\\Undead\\Banshee\\Banshee.mdx": "HD redraw, Definitive look not yet reviewed",
  "Units\\Undead\\PlagueCloud\\PlagueCloud.mdx": "HD redraw, Definitive look not yet reviewed",
  "Units\\Undead\\Scarab\\Scarab.mdl": "HD redraw, Definitive look not yet reviewed",
};
