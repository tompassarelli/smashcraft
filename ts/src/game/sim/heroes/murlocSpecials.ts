import { f32 } from "wisp/src/sim/f32";
import { withExKit } from "../exSpecialAuthoring";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import { CHILL } from "../chill";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import type { AppliedStatus } from "../heroStatus";
import { murlocHit } from "./murlocMoves";

const ensnare = (air: boolean): AuthoredSpecial => ({
  endFrame: 36, landingLag: air ? 18 : undefined,
  projectiles: [{
    model: "Abilities\\Spells\\Orc\\Ensnare\\EnsnareMissile.mdx",
    spawnFrame: 12, offsetX: 32.0, offsetZ: 40.0, velocityX: 8.0, velocityZ: f32(0.6), gravity: f32(0.06),
    life: 40, radius: 18.0, effect: murlocHit(4.291999816894531, 35, 47.79999923706055, 16.0), reflectable: true, limit: 1, status: CHILL,
  }],
});
const tidalRush = (air: boolean): AuthoredSpecial => ({
  endFrame: 32, landingLag: air ? 20 : undefined,
  motion: [{ ...frames(8, 22), velocityX: 11.0, velocityZ: 0.0, stopsAtShield: true }],
  regions: [heroRegion(8, 22, { x1: 10.0, z1: 22.0, x2: 46.0, z2: 22.0, radius: 18.0 }, murlocHit(8.583999633789062, 40, 76.4800033569336, 22.0))],
});
const tideSpout = (speed: number, drift: number): AuthoredSpecial => ({
  endFrame: 34, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 5), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(6, 25), velocityX: 0.0, velocityZ: speed, driftSpeed: drift }],
  regions: [heroRegion(6, 14, { x1: 0.0, z1: 20.0, x2: 0.0, z2: 80.0, radius: 26.0 }, murlocHit(5.364999771118164, 80, 66.91999816894531, 30.0))],
});

const PLAGUE: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 60, damage: 1.0 } };
const DISEASE_CLOUD: AuthoredSpecial = {
  endFrame: 38, cooldownFrames: 150, groundOnly: true,
  projectiles: [{
    model: "Units\\Undead\\PlagueCloud\\PlagueCloud.mdx",
    spawnFrame: 14, offsetX: 40.0, offsetZ: 6.0, velocityX: 0.0, velocityZ: 0.0, life: 150, radius: 50.0,
    effect: { ...murlocHit(2.1459999084472656, 80, 28.68000030517578, 30.0, false, HitElement.poison) },
    reflectable: false, limit: 1, needsLineOfSight: true, status: PLAGUE,
    pool: { every: 50, growth: 0.0, maxRadius: 50.0 },
  }],
};

export const MURLOC_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Ensnare", description: "Throw a net that slows the first enemy it reaches. Shield it or jump it.", ground: ensnare(false), air: ensnare(true) }, { reach: 1.25 }),
  side: withExKit({ name: "Tidal Rush", description: "Belly-slide forward into a hit. A raised shield stops the slide.", ground: tidalRush(false), air: tidalRush(true) }, { damage: 1.25 }),
  up: withExKit({ name: "Tide Spout", description: "Ride a water spout upward and steer it, then fall helpless.", ground: tideSpout(17.0, 6.0) }, { travel: 1.25 }),
  down: withExKit({ name: "Disease Cloud", description: "Leave a small plague cloud that poisons enemies standing in it; jumping clears it.", ground: DISEASE_CLOUD }, { reach: 1.25 }),
};
