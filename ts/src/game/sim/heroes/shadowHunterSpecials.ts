



import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialPlacement, type SpecialProjectile, CHARGED_AIM_FRAMES, chargedAngleMotion, frames } from "../heroSpecials";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import type { AppliedStatus } from "../heroStatus";
import { hit } from "./shadowHunterMoves";

const H = HERO_REFERENCE_HEIGHT;
const h = (multiple: number): number => f32(H * f32(multiple));


const AIR_SPECIAL_LANDING_LAG = 20;

const CAST_HEIGHT = h(f32(0.45));


const SPIRIT_GLAIVE_SHOT: SpecialProjectile = {
  model: "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx",
  spawnFrame: 18, offsetX: h(f32(0.35)), offsetZ: CAST_HEIGHT,
  velocityX: h(f32(0.12)), velocityZ: 0.0, life: 70, radius: h(f32(0.15)),
  effect: hit(6.0, "POKE", 35), reflectable: true, limit: 1,
  returns: { age: 22, speed: h(f32(0.12)) }, returnEffect: hit(5.0, "POKE", 35),
};

const spiritGlaive = (air: boolean): AuthoredSpecial => ({
  endFrame: 40, projectiles: [SPIRIT_GLAIVE_SHOT],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});








const loaVault = (distance: number): AuthoredSpecial => ({
  endFrame: 26, aimFrames: CHARGED_AIM_FRAMES,
  motion: chargedAngleMotion(h(distance), 16),
  oncePerAirtime: true, helpless: true,
});








const HEX: AppliedStatus = { kind: HeroStatusKind.hex, frames: 50, group: HeroStatusGroup.silence, immunityFrames: 240 };

const HEX_ORB: SpecialProjectile = {
  model: "Abilities\\Weapons\\WitchDoctorMissile\\WitchDoctorMissile.mdx",
  spawnFrame: 24, offsetX: h(f32(0.3)), offsetZ: CAST_HEIGHT,
  velocityX: h(f32(0.07)), velocityZ: 0.0, life: 26, radius: h(f32(0.18)),
  effect: hit(2.0, "POKE", 40, 1.0, HitElement.arcane), reflectable: true, limit: 1, status: HEX,
};

const hex = (air: boolean): AuthoredSpecial => ({
  endFrame: 40, projectiles: [HEX_ORB],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});






const SERPENT_WARD: SpecialPlacement = {
  frame: 26, offsetX: h(f32(0.65)), radius: h(f32(0.18)), height: h(f32(0.6)),
  durability: 26.0, life: 240, fireAges: [45, 85, 125, 165, 205],
  shot: {
    model: "Abilities\\Weapons\\SerpentWardMissile\\SerpentWardMissile.mdx",
    spawnFrame: 0, offsetX: h(f32(0.15)), offsetZ: h(f32(0.4)),
    velocityX: h(f32(0.10)), velocityZ: 0.0, life: 36, radius: h(f32(0.12)),
    effect: hit(7.0, "POKE", 35, 1.0, HitElement.poison), reflectable: true, limit: 3,
  },
};






const SERPENT_WARD_CAST: AuthoredSpecial = { endFrame: 52, groundOnly: true, placement: SERPENT_WARD };
const SERPENT_WARD_RECALL: AuthoredSpecial = { endFrame: 52, groundOnly: true, recall: true };

export const SHADOW_HUNTER_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Spirit Glaive", description: "A glaive that flies out and back, pulling its target toward him on the return.", ground: spiritGlaive(false), air: spiritGlaive(true) }, { damage: 1.25 }),
  side: withExKit({ name: "Serpent Ward", description: "Place a ward that fires on its own; press again to recall it.", ground: SERPENT_WARD_CAST, recall: SERPENT_WARD_RECALL }, { damage: 1.25, recallProtection: 4 }),
  up: withExKit({ name: "Loa Vault", description: "Hold a direction as the spirits gather, then a vault that way and a helpless fall.", ground: loaVault(f32(3.55)) }, { travel: 1.25 }),
  down: withExKit({ name: "Hex", description: "A short orb that stops its target attacking, grabbing or casting until it mashes out.", ground: hex(false), air: hex(true) }, { reach: 1.25 }),
};
