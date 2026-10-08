import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import { CHILL } from "../chill";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import type { AppliedStatus } from "../heroStatus";
import { murlocHit } from "./murlocMoves";

const ensnare = (air: boolean): AuthoredSpecial => ({
  cost: 10, endFrame: 36, landingLag: air ? 18 : undefined,
  projectiles: [{
    model: "Abilities\\Spells\\Orc\\Ensnare\\EnsnareMissile.mdx",
    spawnFrame: 12, offsetX: 32.0, offsetZ: 40.0, velocityX: 8.0, velocityZ: f32(0.6), gravity: f32(0.06),
    life: 40, radius: 18.0, effect: murlocHit(4.0, 35, 50.0, 16.0), reflectable: true, limit: 1, status: CHILL,
  }],
});
const tidalRush = (air: boolean): AuthoredSpecial => ({
  cost: 10, endFrame: 40, landingLag: air ? 20 : undefined,
  motion: [{ ...frames(8, 22), velocityX: 11.0, velocityZ: 0.0, stopsAtShield: true }],
  regions: [heroRegion(8, 22, { x1: 10.0, z1: 22.0, x2: 46.0, z2: 22.0, radius: 18.0 }, murlocHit(8.0, 40, 80.0, 22.0))],
});
const tideSpout = (cost: number, speed: number, drift: number): AuthoredSpecial => ({
  cost, endFrame: 34, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 5), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(6, 25), velocityX: 0.0, velocityZ: speed, driftSpeed: drift }],
  regions: cost > 0 ? [heroRegion(6, 14, { x1: 0.0, z1: 20.0, x2: 0.0, z2: 80.0, radius: 26.0 }, murlocHit(5.0, 80, 70.0, 30.0))] : undefined,
});
/** Disease Cloud's poison: three 1% ticks over 180 frames, without flinch. */
const PLAGUE: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 60, damage: 1.0 } };
const DISEASE_CLOUD: AuthoredSpecial = {
  cost: 15, endFrame: 38, cooldownFrames: 150, groundOnly: true,
  projectiles: [{
    model: "Units\\Undead\\PlagueCloud\\PlagueCloud.mdx",
    spawnFrame: 14, offsetX: 40.0, offsetZ: 6.0, velocityX: 0.0, velocityZ: 0.0, life: 150, radius: 50.0,
    effect: { ...murlocHit(2.0, 80, 30.0, 30.0, false, HitElement.poison) },
    reflectable: false, limit: 1, needsLineOfSight: true, status: PLAGUE,
    pool: { every: 50, growth: 0.0, maxRadius: 50.0 },
  }],
};

export const MURLOC_SPECIALS: FighterSpecials = {
  neutral: { name: "Ensnare", description: "Throw a net that slows the first enemy it reaches. Shield it or jump it.", ground: ensnare(false), air: ensnare(true) },
  side: { name: "Tidal Rush", description: "Belly-slide forward into a hit. A raised shield stops the slide.", ground: tidalRush(false), air: tidalRush(true) },
  up: { name: "Tide Spout", description: "Ride a water spout upward and steer it, then fall helpless.", ground: tideSpout(15, 17.0, 6.0), free: tideSpout(0, 12.5, 5.0) },
  down: { name: "Disease Cloud", description: "Leave a small plague cloud that poisons enemies standing in it; jumping clears it.", ground: DISEASE_CLOUD },
};
