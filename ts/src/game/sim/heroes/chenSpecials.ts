import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, FollowUpInput, frames } from "../heroSpecials";
import { chenCapsule, chenHit } from "./chenMoves";

const fire = chenHit(10.0, 70.0, 24.0, f32(0.906308), f32(0.422618), HitElement.fire);
const breath = (air: boolean): AuthoredSpecial => ({
  cost: 10, endFrame: 42, landingLag: air ? 20 : undefined,
  regions: [heroRegion(12, 22, chenCapsule(36.0, 62.0, 124.0, 62.0, 27.0), fire)],
});
const haze = (air: boolean): AuthoredSpecial => ({
  cost: 12, endFrame: 38, landingLag: air ? 20 : undefined,
  projectiles: [{ spawnFrame: 14, offsetX: 40.0, offsetZ: 60.0, velocityX: 8.0, velocityZ: 0.5, gravity: f32(0.08),
    life: 38, radius: 22.0, effect: chenHit(3.0, 35.0, 16.0, f32(0.819152), f32(0.573576)), reflectable: true, limit: 1,
    model: "Abilities\\Spells\\Other\\DrunkenHaze\\DrunkenHazeMissile.mdx",
    status: { kind: HeroStatusKind.terror, frames: 90, group: HeroStatusGroup.terror, immunityFrames: 120 },
  }],
});
const stormRise = (cost: number, height: number, drift: number): AuthoredSpecial => ({
  cost, endFrame: 40, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 7), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(8, 29), velocityX: 0.0, velocityZ: f32(f32(HERO_REFERENCE_HEIGHT * height) / 22.0), driftSpeed: f32(f32(HERO_REFERENCE_HEIGHT * drift) / 22.0) }],
  regions: cost > 0 ? [heroRegion(8, 22, chenCapsule(0.0, 42.0, 0.0, 106.0, 42.0), chenHit(8.0, 80.0, 26.0, f32(0.34202), f32(0.939693)))] : undefined,
});
const FIRE_PALM: AuthoredSpecial = { name: "Fire Palm", cost: 0, endFrame: 32, landingLag: 20,
  regions: [heroRegion(8, 11, chenCapsule(24.0, 58.0, 94.0, 60.0, 22.0), chenHit(11.0, 90.0, 24.0, f32(0.819152), f32(0.573576), HitElement.fire))] };
const STORM_STEP: AuthoredSpecial = { name: "Storm Step", cost: 0, endFrame: 28, landingLag: 20, facesStick: true,
  motion: [{ ...frames(5, 12), velocityX: 10.0, velocityZ: 0.0, stopsAtShield: true }],
  regions: [heroRegion(5, 12, chenCapsule(20.0, 48.0, 60.0, 56.0, 18.0), chenHit(7.0, 75.0, 22.0, f32(0.642788), f32(0.766044)))] };
const earth = (air: boolean): AuthoredSpecial => ({
  name: "Earth Stance", cost: 10, endFrame: 33, landingLag: air ? 20 : undefined,
  armor: { ...frames(5, 16), maxDamage: 9.0 },
  followUps: [
    { window: frames(10, 22), input: FollowUpInput.attack, special: FIRE_PALM },
    { window: frames(10, 22), input: FollowUpInput.special, facesStick: true, special: STORM_STEP },
  ],
});
export const CHEN_SPECIALS: FighterSpecials = {
  neutral: { name: "Breath of Fire", description: "Breathe a short cone of flame; a jump clears it.", ground: breath(false), air: breath(true) },
  side: { name: "Drunken Haze", description: "Lob a flask that briefly weakens an enemy's attacks.", ground: haze(false), air: haze(true) },
  up: { name: "Storm Rise", description: "Rise with a spinning staff, steer toward safety, then fall helplessly.", ground: stormRise(15, f32(2.1), f32(0.45)), free: stormRise(0, f32(1.45), f32(0.3)) },
  down: { name: "Storm, Earth and Fire", description: "Brace as Earth; press Attack for Fire Palm or Special for Storm Step.", ground: earth(false), air: earth(true) },
};
