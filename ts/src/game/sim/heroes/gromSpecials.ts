import { withExKit } from "../exSpecialAuthoring";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { gromHit } from "./gromMoves";
const cry: AuthoredSpecial = { cost: 0, endFrame: 34, regions: [heroRegion(12, 15, { x1: -44.0, z1: 48.0, x2: 44.0, z2: 48.0, radius: 38.0 }, gromHit(7.0, 80, 65.0, 42.0))] };
const rush = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 40, oncePerAirtime: air ? true : undefined, helpless: air ? true : undefined,
  motion: [{ ...frames(8, 20), velocityX: 13.0, velocityZ: 0.0, stopsAtShield: true }, { ...frames(21, 21), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(10, 17, { x1: 24.0, z1: 60.0, x2: 104.0, z2: 48.0, radius: 14.0 }, gromHit(12.0, 40, 90.0, 26.0))],
});
const leap: AuthoredSpecial = {
  cost: 0, endFrame: 36, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 6), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(7, 22), velocityX: 0.0, velocityZ: 17.5, driftSpeed: 5.0 }, { ...frames(23, 23), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(7, 14, { x1: 12.0, z1: 54.0, x2: 12.0, z2: 146.0, radius: 16.0 }, gromHit(9.0, 80, 85.0, 30.0))],
};
const bane: AuthoredSpecial = { cost: 0, endFrame: 50, regions: [heroRegion(20, 23, { x1: 24.0, z1: 94.0, x2: 124.0, z2: 20.0, radius: 16.0 }, gromHit(22.0, 35, 118.0, 30.0))] };
export const GROM_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Warsong Cry", description: "Roar in their face and launch them upward. Rush after them.", ground: cry, air: { ...cry, landingLag: 20 } }, { damage: 1.25, reach: 1.1500000953674316 }),
  side: withExKit({ name: "Gorehowl Rush", description: "Charge axe-first. A shield stops the rush; a miss leaves you open.", ground: rush(false), air: rush(true) }, { damage: 1.25, travel: 1.25 }),
  up: withExKit({ name: "Blood Leap", description: "Haul Gorehowl upward as you leap, then fall helpless.", ground: leap }, { travel: 1.25 }),
  down: withExKit({ name: "Mannoroth's Bane", description: "Commit to a furious two-handed execution chop.", ground: bane, air: { ...bane, landingLag: 24 } }, { damage: 1.25 }),
};
