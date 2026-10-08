import { HitElement } from "../codes";
import { withExKit } from "../exSpecialAuthoring";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { koboldHit } from "./koboldMoves";

const wick = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 36, landingLag: air ? 18 : undefined,
  projectiles: [{ model: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx",
    spawnFrame: 12, offsetX: 30.0, offsetZ: 32.0, velocityX: 8.0, velocityZ: 0.0,
    life: 30, radius: 14.0, effect: koboldHit(4.0, 35, 65.0, 18.0, false, HitElement.fire), reflectable: true, limit: 1 }],
});
const dig = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 32, landingLag: air ? 20 : undefined,
  motion: [{ ...frames(8, 22), velocityX: 11.0, velocityZ: 0.0, stopsAtShield: true }],
  regions: [heroRegion(8, 22, { x1: 10.0, z1: 18.0, x2: 50.0, z2: 18.0, radius: 16.0 }, koboldHit(8.0, 40, 80.0, 22.0))],
});
const escape: AuthoredSpecial = {
  cost: 0, endFrame: 34, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 5), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(6, 25), velocityX: 0.0, velocityZ: 16.0, driftSpeed: 5.0 }],
  regions: [heroRegion(6, 14, { x1: 0.0, z1: 18.0, x2: 0.0, z2: 74.0, radius: 22.0 }, koboldHit(5.0, 80, 70.0, 30.0))],
};
const mine = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 34, landingLag: air ? 18 : undefined,
  regions: [
    heroRegion(10, 13, { x1: 10.0, z1: 12.0, x2: 64.0, z2: 12.0, radius: 14.0 }, koboldHit(7.0, 70, 80.0, 24.0)),
    heroRegion(10, 13, { x1: -10.0, z1: 12.0, x2: -64.0, z2: 12.0, radius: 14.0 }, koboldHit(7.0, 70, 80.0, 24.0, true)),
  ],
});

export const KOBOLD_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Wick Flick", description: "Flick candle flame forward. Jump or shield it, then punish the recovery.", ground: wick(false), air: wick(true) }, { damage: 1.25 }),
  side: withExKit({ name: "Panic Dig", description: "Scurry forward behind the pick. A raised shield stops the charge.", ground: dig(false), air: dig(true) }, { damage: 1.25 }),
  up: withExKit({ name: "Candle Escape", description: "Spring upward in a panic, steer, then fall helpless.", ground: escape, air: escape }, { travel: 1.25 }),
  down: withExKit({ name: "Mine!", description: "Protect the candle with a two-sided ankle sweep. Jump over the pick.", ground: mine(false), air: mine(true) }, { reach: 1.25 }),
};
