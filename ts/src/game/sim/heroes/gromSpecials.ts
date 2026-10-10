import { withExKit } from "../exSpecialAuthoring";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { gromHit } from "./gromMoves";
const cry: AuthoredSpecial = { endFrame: 34, regions: [heroRegion(12, 15, { x1: -44.0, z1: 48.0, x2: 44.0, z2: 48.0, radius: 38.0 }, gromHit(5.068727970123291, 80, 72.46424102783203, 37.79999923706055))] };
const rush = (air: boolean): AuthoredSpecial => ({
  endFrame: 40, oncePerAirtime: air ? true : undefined, helpless: air ? true : undefined,
  motion: [{ ...frames(8, 20), velocityX: 13.0, velocityZ: 0.0, stopsAtShield: true }, { ...frames(21, 21), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(10, 17, { x1: 24.0, z1: 60.0, x2: 104.0, z2: 48.0, radius: 14.0 }, gromHit(8.689248085021973, 40, 100.33509826660156, 23.399999618530273))],
});
const leap: AuthoredSpecial = {
  endFrame: 36, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 6), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(7, 22), velocityX: 0.0, velocityZ: 24.0, driftSpeed: 13.0 }, { ...frames(23, 23), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(7, 14, { x1: 12.0, z1: 54.0, x2: 12.0, z2: 146.0, radius: 16.0 }, gromHit(6.516936302185059, 80, 94.76093292236328, 27.0))],
};
const bane: AuthoredSpecial = { endFrame: 50, regions: [heroRegion(20, 23, { x1: 24.0, z1: 94.0, x2: 124.0, z2: 20.0, radius: 16.0 }, gromHit(15.930286407470703, 35, 131.55047607421875, 27.0))] };
export const GROM_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Warsong Cry", description: "Roar in their face and launch them upward. Rush after them.", ground: cry, air: { ...cry, landingLag: 20 } }, { damage: 1.25, reach: 1.1500000953674316 }),
  side: withExKit({ name: "Gorehowl Rush", description: "Charge axe-first. A shield stops the rush; a miss leaves you open.", ground: rush(false), air: rush(true) }, { damage: 1.25, travel: 1.25 }),
  up: withExKit({ name: "Blood Leap", description: "Haul Gorehowl upward as you leap, then fall helpless.", ground: leap }, { travel: 1.25 }),
  down: withExKit({ name: "Mannoroth's Bane", description: "Commit to a furious two-handed execution chop.", ground: bane, air: { ...bane, landingLag: 24 } }, { damage: 1.25 }),
};
