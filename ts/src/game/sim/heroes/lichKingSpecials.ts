// The Lich King's four specials (#167), from the Icecrown Citadel encounter
// and Warcraft III: Howling Blast, Val'kyr Shadowguard, Ascension of the
// Damned and Defile. Frames follow the roster brief (entry tick is frame 1).
import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AppliedStatus } from "../heroStatus";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../heroSpecials";
import { capsule, hit } from "./lichKingMoves";

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);
/** Chest height, where his casts leave the off hand. */
const CHEST = h(f32(0.5));
/** Non-recovery specials used in the air end on landing with this lag (roster "Action defaults"). */
const AIR_LANDING_LAG = 20;

/**
 * Howling Blast: a wide frost gust that travels about 2.9H on frame 16.
 * Reflectable.
 */
const blastProjectile = (radius: number, damage: number, status: AppliedStatus | undefined): SpecialProjectile => ({
  model: "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx",
  spawnFrame: 16, offsetX: 50.0, offsetZ: CHEST, velocityX: h(f32(0.08)), velocityZ: 0.0,
  life: 36, radius, effect: hit(damage, "POKE", 40), reflectable: true, limit: 1, status,
});
const HOWLING_BLAST = blastProjectile(h(f32(0.22)), 6.0, undefined);
const howlingBlast = (projectile: SpecialProjectile, landingLag: number | undefined): AuthoredSpecial => ({
  cost: 15,
  endFrame: 44,
  landingLag,
  projectiles: [projectile],
});

/**
 * Val'kyr Shadowguard's carry (sim/heroStatus.ts, HeroStatusKind.carried):
 * 80 frames at 3 units a frame toward the ledge the Val'kyr flew at, mashed
 * out never before frame 20, dropped by any damaging hit, then 240 frames
 * immune to the sleep group so it can't chain with a stun or another carry.
 */
const CARRIED: AppliedStatus = { kind: HeroStatusKind.carried, frames: 80, group: HeroStatusGroup.sleep, immunityFrames: 240 };

/**
 * Val'kyr Shadowguard: a Val'kyr flies out on frame 14 and seizes the first
 * body it reaches. A shield stops her, and a powershield sends her back.
 */
const valkyrProjectile = (speed: number): SpecialProjectile => ({
  model: "Units\\Undead\\Banshee\\Banshee.mdx",
  spawnFrame: 14, offsetX: 40.0, offsetZ: f32(CHEST + 10.0), velocityX: speed, velocityZ: 0.0,
  life: 40, radius: h(f32(0.2)), effect: { damage: 4.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.dark },
  reflectable: true, limit: 1, status: CARRIED,
});
const VALKYR = valkyrProjectile(5.0);
const shadowguard = (projectile: SpecialProjectile, landingLag: number | undefined): AuthoredSpecial => ({
  cost: 20,
  endFrame: 40,
  landingLag,
  projectiles: [projectile],
});

const ASCENT_FRAMES = 23;

/**
 * Ascension of the Damned, a guided rise (#189): an ice column lifts him over frames 8-30, steered
 * up to `steer` sideways by the held stick, inside a Remorseless Winter vortex that strikes each
 * opponent once; then a helpless fall. The free form rises lower with no vortex.
 */
function ascension(cost: number, height: number, steer: number, vortex: boolean): AuthoredSpecial {
  return {
    cost,
    endFrame: 46,
    facesStick: true,
    motion: [{ ...frames(8, 30), velocityX: 0.0, velocityZ: f32(h(height) / ASCENT_FRAMES), driftSpeed: f32(h(steer) / ASCENT_FRAMES) }],
    regions: vortex ? [heroRegion(8, 30, capsule(0.0, 50.0, 0.0, 110.0, 62.0), hit(9.0, "LAUNCH", 80))] : undefined,
    oncePerAirtime: true,
    helpless: true,
  };
}

/**
 * Defile: a shadow pool 0.6H ahead of him on frame 20, where he can see. From
 * age 18 it strikes a grounded body inside it every 36 frames, and each hit
 * that reaches a body widens it by 6, up to 0.6H; it lasts 180 frames. One at
 * a time, at least 320 frames between casts. Jump over it or stay out.
 */
const DEFILE_POOL: SpecialProjectile = {
  model: "Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx",
  // The stock particles extend to 1222.223 (scripts/wisp/modelFacts.ts); keep them inside the rim.
  modelRadius: 1223.0,
  spawnFrame: 20, offsetX: h(f32(0.6)), offsetZ: 6.0, velocityX: 0.0, velocityZ: 0.0,
  life: 180, activeFrom: 18, radius: h(f32(0.3)),
  effect: { damage: 2.0, growth: 30.0, base: 30.0, launchX: f32(0.173648178), launchZ: f32(0.984807753), electric: false, element: HitElement.dark },
  reflectable: false, limit: 1, needsLineOfSight: true,
  pool: { every: 36, growth: 6.0, maxRadius: h(f32(0.6)) },
};
const DEFILE: AuthoredSpecial = {
  cost: 20,
  endFrame: 50,
  cooldownFrames: 320,
  groundOnly: true,
  projectiles: [DEFILE_POOL],
};

export const LICH_KING_SPECIALS: FighterSpecials = {
  neutral: withExKit({
    name: "Howling Blast",
    description: "A wide frost gust that travels toward the foe.",
    ground: howlingBlast(HOWLING_BLAST, undefined),
    air: howlingBlast(HOWLING_BLAST, AIR_LANDING_LAG),
  }, { damage: 1.25 }),
  side: withExKit({
    name: "Val'kyr Shadowguard",
    description: "A Val'kyr seizes the first foe she reaches and carries them toward the edge; mash to break free.",
    ground: shadowguard(VALKYR, undefined),
    air: shadowguard(VALKYR, AIR_LANDING_LAG),
  }, { damage: 1.25 }),
  up: withExKit({
    name: "Ascension of the Damned",
    description: "An ice column lifts him in a frost vortex, then a helpless fall.",
    ground: ascension(15, f32(2.7), f32(1.15), true),
    free: ascension(0, f32(2.0), f32(0.8), false),
  }, { travel: 1.25 }),
  down: withExKit({
    name: "Defile",
    description: "Plant Frostmourne to spread a shadow pool; hurting a grounded foe grows it and flashes the edge. Jump out; recasts must wait.",
    ground: DEFILE,
  }, { reach: 1.25 }),
};
