import { withExKit } from "../exSpecialAuthoring";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, recovery, rise, still } from "../heroSpecials";
import { gromHit } from "./gromMoves";
const cry: AuthoredSpecial = { endFrame: 34, regions: [heroRegion(12, 15, { x1: -44.0, z1: 48.0, x2: 44.0, z2: 48.0, radius: 38.0 }, gromHit(5.695199966430664, 80, 64.64250183105469, 37.79999923706055))] };
const rush = (air: boolean): AuthoredSpecial => ({
  endFrame: 40, oncePerAirtime: air ? true : undefined, helpless: air ? true : undefined,
  motion: [{ ...frames(8, 20), velocityX: 13.0, velocityZ: 0.0, stopsAtShield: true }, still(21, 21)],
  regions: [heroRegion(10, 17, { x1: 24.0, z1: 60.0, x2: 104.0, z2: 48.0, radius: 14.0 }, gromHit(9.763199806213379, 40, 89.50499725341797, 23.399999618530273))],
});
const leap = recovery({
  endFrame: 36, facesStick: true, motion: [...rise(7, 22, 24.0, 13.0), still(23, 23)],
  regions: [heroRegion(7, 14, { x1: 12.0, z1: 54.0, x2: 12.0, z2: 146.0, radius: 16.0 }, gromHit(7.3224005699157715, 80, 84.53250122070312, 27.0))],
});
const bane: AuthoredSpecial = { endFrame: 50, regions: [heroRegion(20, 23, { x1: 24.0, z1: 94.0, x2: 124.0, z2: 20.0, radius: 16.0 }, gromHit(17.899198532104492, 35, 117.35099792480469, 27.0))] };
export const GROM_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Warsong Cry", description: "Roar in their face and launch them upward. Rush after them.", ground: cry, air: { ...cry, landingLag: 20 } }, { damage: 1.25, reach: 1.1500000953674316 }),
  side: withExKit({ name: "Gorehowl Rush", description: "Charge axe-first. A shield stops the rush; a miss leaves you open.", ground: rush(false), air: rush(true) }, { damage: 1.25, travel: 1.25 }),
  up: withExKit({ name: "Blood Leap", description: "Haul Gorehowl upward as you leap, then fall helpless.", ground: leap }, { travel: 1.25 }),
  down: withExKit({ name: "Mannoroth's Bane", description: "Commit to a furious two-handed execution chop.", ground: bane, air: { ...bane, landingLag: 24 } }, { damage: 1.25 }),
};
