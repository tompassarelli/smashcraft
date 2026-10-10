



import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../heroSpecials";
import { CHILL } from "../chill";
import { HitElement } from "../codes";
import { hit, lichCastBody } from "./lichMoves";

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);

const CHEST = h(f32(0.45));
const AIR_LANDING_LAG = 20;


const FROST_NOVA_ORB: SpecialProjectile = {
  model: "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx",
  spawnFrame: 18, offsetX: h(f32(0.40)), offsetZ: CHEST, velocityX: h(f32(0.09)), velocityZ: 0.0,
  life: 80, radius: h(f32(0.16)), effect: hit(11.221104621887207, "POKE", 35), reflectable: true, limit: 1, status: CHILL,
};


const FROST_NOVA_BURST: SpecialProjectile = {
  model: "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx",
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: 9, activeFrom: 7, radius: h(f32(0.7)), effect: hit(12.4678955078125, "LAUNCH", 70), reflectable: false, limit: 1, status: CHILL,
};

const frostNova = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 39,
  landingLag,
  hurt: lichCastBody(14, 24, 28.0, CHEST),
  projectiles: [FROST_NOVA_ORB],
});


const frostNovaBurst = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 14,
  landingLag,
  hurt: lichCastBody(2, 8, 28.0, f32(CHEST + 12.0)),
  burst: { frame: 4, from: FROST_NOVA_ORB, into: FROST_NOVA_BURST },
});








const decayStrike = (activeFrom: number, life: number, damage: number, kind: "POKE" | "LAUNCH", angle: 70 | 80): SpecialProjectile => ({
  model: "Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx",
  spawnFrame: 8, offsetX: h(f32(1.5)), offsetZ: CHEST, velocityX: 0.0, velocityZ: 0.0,
  life, activeFrom, radius: h(f32(0.75)), effect: hit(damage, kind, angle, false, HitElement.dark),
  reflectable: false, limit: 1, cancelOnInterrupt: true, needsLineOfSight: true,
});
const DEATH_AND_DECAY: AuthoredSpecial = {
  endFrame: 50,
  landingLag: AIR_LANDING_LAG,
  hurt: lichCastBody(5, 14, 28.0, f32(CHEST + 12.0)),
  projectiles: [decayStrike(23, 62, 6.23394775390625, "POKE", 80), decayStrike(63, 90, 11.221104621887207, "LAUNCH", 70)],
};

const ASCENT_FRAMES = 25;


function ascent(height: number, steer: number): AuthoredSpecial {
  return {
    endFrame: 34,
    motion: [{ ...frames(10, 34), velocityX: 0.0, velocityZ: f32(h(height) / ASCENT_FRAMES), driftSpeed: f32(h(steer) / ASCENT_FRAMES) }],
    oncePerAirtime: true,
    helpless: true,
  };
}


const FROST_ARMOR: AuthoredSpecial = {
  endFrame: 45,
  landingLag: AIR_LANDING_LAG,
  armor: { ...frames(22, 22 + 240 - 1), maxDamage: 8.0, shell: true, chillsStriker: true },
};


const DARK_RITUAL: AuthoredSpecial = {
  name: "Dark Ritual",

  endFrame: 24,
  landingLag: AIR_LANDING_LAG,
  regions: [heroRegion(6, 8, { x1: -1.0, z1: CHEST, x2: 1.0, z2: CHEST, radius: h(f32(0.6)) }, hit(6.23394775390625, "POKE", 60))],
  ritual: { frame: 6, mana: 30 },
};

export const LICH_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Frost Nova", description: "A slow orb that chills; press again to burst it where it is.", ground: frostNova(undefined), air: frostNova(AIR_LANDING_LAG), recall: frostNovaBurst(undefined), recallWhile: "projectile" }, { reach: 1.25 }),
  side: withExKit({ name: "Death and Decay", description: "A rotting field ahead that strikes twice, small then strong; walk or jump out.", ground: DEATH_AND_DECAY }, { damage: 1.25 }),
  up: withExKit({ name: "Spectral Ascent", description: "A steerable rise, then a helpless fall.", ground: ascent(f32(3.7), f32(1.0)) }, { travel: 1.25 }),
  down: withExKit({ name: "Frost Armor", description: "A shell that takes the knockback of one light hit and chills the attacker; press again for Dark Ritual: shatter it for mana.", ground: FROST_ARMOR, recall: DARK_RITUAL, recallWhile: "armor" }, { armorDamage: 1.25, recallProtection: 4.0 }),
};
