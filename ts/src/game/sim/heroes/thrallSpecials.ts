import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../heroSpecials";
import { capsule, thrallHit } from "./thrallMoves";

const h = (multiple: number) => f32(HERO_REFERENCE_HEIGHT * multiple);
const bolt: SpecialProjectile = {
  spawnFrame: 14, offsetX: 42.0, offsetZ: 70.0, velocityX: 17.0, velocityZ: 0.0,
  life: 30, radius: 17.0, effect: { ...thrallHit(12.0, 40, 80.0, 22.0, false, HitElement.electric), electric: true },
  reflectable: true, limit: 1, model: "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx",
};
const wolf = (spawnFrame: number, air: boolean): SpecialProjectile => ({
  spawnFrame, offsetX: 44.0, offsetZ: 20.0, velocityX: 12.0, velocityZ: air ? -3.0 : 0.0,
  life: 28, radius: 20.0, effect: thrallHit(4.0, 55, 65.0, 28.0), reflectable: false, limit: 2,
  model: "units\\orc\\SpiritWolf\\SpiritWolf.mdx",
});
const wolves = (air: boolean): AuthoredSpecial => ({ endFrame: 44, cooldownFrames: 90, projectiles: [wolf(16, air), wolf(24, air)], landingLag: air ? 20 : undefined });
const sight = (height: number): AuthoredSpecial => ({
  endFrame: 40, facesStick: true, oncePerAirtime: true, helpless: true,
  motion: [{ ...frames(1, 8), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(9, 32), velocityX: 0.0, velocityZ: f32(h(height) / 24.0), driftSpeed: f32(h(f32(1.5)) / 24.0) }],
});
export const THRALL_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Chain Lightning", description: "Cast a quick lightning bolt to cover the hammer's approach.", ground: { endFrame: 44, projectiles: [bolt], landingLag: 18 } }, { damage: 1.25 }),
  side: withExKit({ name: "Feral Spirit", description: "Send two spirit wolves running low, one after the other.", ground: wolves(false), air: wolves(true) }, { damage: 1.25 }),
  up: withExKit({ name: "Far Sight", description: "Let the spirits guide a rising leap; steer toward the ledge, then fall helpless.", ground: sight(f32(3.1)) }, { travel: 1.25 }),
  down: withExKit({ name: "Earthquake", description: "Slam the ground on both sides to launch nearby foes; a jump clears it.", ground: {
    endFrame: 50, cooldownFrames: 90, groundOnly: true,
    regions: [heroRegion(18, 21, capsule(0.0, 12.0, 119.0, 12.0, 16.0), thrallHit(11.0, 75, 70.0, 36.0)), heroRegion(18, 21, capsule(0.0, 12.0, -119.0, 12.0, 16.0), thrallHit(11.0, 75, 70.0, 36.0, true))],
  } }, { reach: 1.25 }),
};
