// Warden's four specials from smashcraft:docs/design/roster.md ("Warden", B
// specials), in the brief's frame numbering. Starting values, not balance.
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { ROSTER_MANA, frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { HeroStatusGroup, HeroStatusKind } from "../codes";
import type { AppliedStatus } from "../heroStatus";
import { wardenHit } from "./wardenMoves";

const H = HERO_REFERENCE_HEIGHT;
const KNIFE_RADIUS = 7.0;
const blade = (x1: number, z1: number, x2: number, z2: number, radius = KNIFE_RADIUS): StrikeCapsule => ({ x1, z1, x2, z2, radius });

// Shadow Strike: one slow reflectable blade whose body hit poisons for three
// 1-damage ticks over 90 frames, without flinch; a new hit refreshes it.
const POISON: AppliedStatus = { kind: HeroStatusKind.poison, frames: 90, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 30, damage: 1.0 } };
const SHADOW_STRIKE: AuthoredSpecial = {
  cost: 5,
  endFrame: 37,
  projectiles: [{
    spawnFrame: 16, offsetX: 30.0, offsetZ: 50.0, velocityX: f32(H * f32(0.11)), velocityZ: 0.0,
    life: 30, radius: f32(H * f32(0.13)), effect: wardenHit(5.0, "POKE", 35), reflectable: true, limit: 1, status: POISON,
  }],
};

// Pursuit Lunge: 1.0H of travel through the slash, which is active f11-14; the
// dash stops dead after it.
const LUNGE_TRAVEL_FRAMES = 10;
const LUNGE_SPEED = f32(H / f32(LUNGE_TRAVEL_FRAMES));
const lungeRegions = (): readonly MoveRegion[] => [heroRegion(11, 14, blade(16.0, 48.0, f32(f32(H * f32(0.80)) - KNIFE_RADIUS), 44.0), wardenHit(10.0, "EDGE", 35))];
const PURSUIT_LUNGE: AuthoredSpecial = {
  cost: 15, endFrame: 40, regions: lungeRegions(),
  motion: [{ ...frames(5, 14), velocityX: LUNGE_SPEED, velocityZ: 0.0 }, { ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0 }],
};
// Up or down held through entry tilts the air dash 20 degrees; no later steering.
const LUNGE_TILT = { x: f32(0.939692621), z: f32(0.342020143) };
const PURSUIT_LUNGE_AIR: AuthoredSpecial = {
  ...PURSUIT_LUNGE, oncePerAirtime: true, helpless: true, landingLag: 12, aimFrames: 4,
  motion: [{ ...frames(5, 14), velocityX: LUNGE_SPEED, velocityZ: 0.0, aimedTilt: LUNGE_TILT }, { ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0 }],
};

// Blink: one displacement on f9, aimed in eight directions by the stick held
// through f8, intangible f8-10, then a vulnerable endpoint through f30 (on the
// ground as well) and a helpless fall in the air.
const blink = (cost: number, distance: number, aimed: boolean, intangible: boolean): AuthoredSpecial => ({
  cost, endFrame: 30, oncePerAirtime: true, helpless: true, aimFrames: aimed ? 8 : undefined,
  motion: [
    { ...frames(9, 9), velocityX: 0.0, velocityZ: distance, aimedSpeed: aimed ? distance : undefined },
    { ...frames(10, 10), velocityX: 0.0, velocityZ: 0.0 },
  ],
  intangible: intangible ? frames(8, 10) : undefined,
});
const BLINK = blink(20, f32(H * f32(1.70)), true, true);
const BLINK_FREE = blink(0, f32(H * f32(1.10)), false, false);

// Fan of Knives: one radial attack reaching 0.85H, launching 45 degrees outward.
const FAN = f32(f32(H * f32(0.85)) - KNIFE_RADIUS);
const FAN_DIAGONAL = f32(FAN * f32(0.707106781));
const FAN_CENTER = 48.0;
const fanRegions = (): readonly MoveRegion[] => {
  const front = wardenHit(7.0, "POKE", 45);
  const back = wardenHit(7.0, "POKE", 45, -1.0);
  return [
    heroRegion(9, 11, blade(16.0, FAN_CENTER, FAN, FAN_CENTER), front),
    heroRegion(9, 11, blade(12.0, f32(FAN_CENTER + 12.0), FAN_DIAGONAL, f32(FAN_CENTER + FAN_DIAGONAL)), front),
    heroRegion(9, 11, blade(12.0, f32(FAN_CENTER - 12.0), FAN_DIAGONAL, f32(FAN_CENTER - FAN_DIAGONAL)), front),
    heroRegion(9, 11, blade(0.0, f32(FAN_CENTER + 16.0), 0.0, f32(FAN_CENTER + FAN)), front),
    heroRegion(9, 11, blade(-16.0, FAN_CENTER, -FAN, FAN_CENTER), back),
    heroRegion(9, 11, blade(-12.0, f32(FAN_CENTER + 12.0), -FAN_DIAGONAL, f32(FAN_CENTER + FAN_DIAGONAL)), back),
    heroRegion(9, 11, blade(-12.0, f32(FAN_CENTER - 12.0), -FAN_DIAGONAL, f32(FAN_CENTER - FAN_DIAGONAL)), back),
  ];
};
const FAN_OF_KNIVES: AuthoredSpecial = { cost: 18, endFrame: 38, regions: fanRegions() };

export const WARDEN_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: SHADOW_STRIKE },
  side: { ground: PURSUIT_LUNGE, air: PURSUIT_LUNGE_AIR },
  up: { ground: BLINK, free: BLINK_FREE },
  down: { ground: FAN_OF_KNIVES },
};
