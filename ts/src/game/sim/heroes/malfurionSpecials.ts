import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "../codes";
import { withExKit } from "../exSpecialAuthoring";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../heroSpecials";
import { malfurionCastBody, malfurionHit } from "./malfurionMoves";

const ROOTS: AuthoredSpecial = {
  cost: 0, endFrame: 42, landingLag: 20, hurt: malfurionCastBody(5, 35),
  projectiles: [{
    model: "Abilities\\Spells\\NightElf\\EntanglingRoots\\EntanglingRootsTarget.mdx",
    spawnFrame: 8, offsetX: 180.0, offsetZ: 22.0, velocityX: 0.0, velocityZ: 0.0,
    activeFrom: 20, life: 58, radius: 35.0,
    effect: { ...malfurionHit(8.0, 80), growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0 },
    reflectable: false, limit: 1, needsLineOfSight: true,
    status: { kind: HeroStatusKind.root, frames: 24, group: HeroStatusGroup.chill, immunityFrames: 120 },
  }],
};
const stag = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 43, landingLag: 24, helpless: air,
  motion: [{ ...frames(12, 20), velocityX: 18.0, velocityZ: air ? 2.0 : 0.0, stopsAtShield: true }],
  regions: [heroRegion(12, 20, { x1: 18.0, z1: 35.0, x2: 90.0, z2: 55.0, radius: 16.0 }, malfurionHit(11.0, 40, 90.0, 24.0))],
});
const ASCENT: AuthoredSpecial = {
  cost: 0, endFrame: 40, landingLag: 24, oncePerAirtime: true, helpless: true,
  motion: [{ ...frames(10, 23), velocityX: 5.0, velocityZ: 17.0, driftSpeed: 2.0 }],
  regions: [heroRegion(10, 23, { x1: -20.0, z1: 50.0, x2: 20.0, z2: 125.0, radius: 18.0 }, malfurionHit(7.0, 80, 75.0, 24.0))],
};
const BRANCH: SpecialProjectile = {
  model: "Abilities\\Weapons\\TreantMissile\\TreantMissile.mdx",
  spawnFrame: 0, offsetX: 15.0, offsetZ: 48.0, velocityX: 8.0, velocityZ: 0.0,
  life: 55, radius: 12.0, effect: malfurionHit(5.0, 35, 70.0, 20.0), reflectable: true, limit: 3,
};
const TREANT: AuthoredSpecial = {
  cost: 0, endFrame: 50, groundOnly: true, hurt: malfurionCastBody(18, 34),
  placement: { frame: 26, offsetX: 70.0, radius: 25.0, height: 92.0, durability: 20.0,
    life: 240, fireAges: [36, 84, 132, 180], shot: BRANCH },
};
export const MALFURION_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Entangling Roots", description: "Mark the ground ahead. Jump or shield before the roots close.", ground: ROOTS }, { damage: 1.25, reach: 1.25 }),
  side: withExKit({ name: "Stag Charge", description: "Bound forward with branching antlers. A shield stops the charge.", ground: stag(false), air: stag(true) }, { damage: 1.25, travel: 1.25 }),
  up: withExKit({ name: "Dream Ascent", description: "Rise through the canopy, then fall helpless.", ground: ASCENT }, { travel: 1.25 }),
  down: withExKit({ name: "Force of Nature", description: "Plant a fragile treant that throws four branches. Press again to recall it.", ground: TREANT,
    recall: { cost: 0, endFrame: 26, groundOnly: true, recall: true } }, { damage: 1.25, durability: 1.25, recallProtection: 4 }),
};
