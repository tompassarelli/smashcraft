// Warden's four specials from smashcraft:docs/design/roster.md ("Warden", B
// specials), in the brief's frame numbering. Starting values, not balance.
import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { CHARGED_AIM_FRAMES, Relocation, frames, type AuthoredSpecial, type FighterSpecials, type SpecialKit } from "../heroSpecials";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import type { AppliedStatus } from "../heroStatus";
import { wardenHit } from "./wardenMoves";

const H = HERO_REFERENCE_HEIGHT;
const KNIFE_RADIUS = 7.0;
const blade = (x1: number, z1: number, x2: number, z2: number, radius = KNIFE_RADIUS): StrikeCapsule => ({ x1, z1, x2, z2, radius });

// The mark (#126, smashcraft:docs/design/kit-review-1.md): Shadow Strike's and
// Fan of Knives' body hits poison for three 1-damage ticks over 180 frames,
// without flinch; a new hit refreshes it. While it lasts the target is marked
// for Shadow Pursuit.
const POISON: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 60, damage: 1.0 } };
const SHADOW_STRIKE: AuthoredSpecial = {
  cost: 5,
  endFrame: 37,
  projectiles: [{
    model: "Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrikeMissile.mdx",
    spawnFrame: 16, offsetX: 30.0, offsetZ: 50.0, velocityX: f32(H * f32(0.11)), velocityZ: 0.0,
    life: 30, radius: f32(H * f32(0.13)), effect: wardenHit(5.0, "POKE", 35, 1.0, HitElement.poison), reflectable: true, limit: 1, status: POISON,
  }],
};

// Pursuit Lunge: 1.0H of travel through the slash, which is active f11-14; the
// dash stops dead after it.
const LUNGE_TRAVEL_FRAMES = 10;
const LUNGE_SPEED = f32(H / f32(LUNGE_TRAVEL_FRAMES));
const lungeRegions = (): readonly MoveRegion[] => [heroRegion(11, 14, blade(16.0, 48.0, f32(f32(H * f32(0.80)) - KNIFE_RADIUS), 44.0), wardenHit(10.0, "EDGE", 35))];
const PURSUIT_LUNGE: AuthoredSpecial = {
  name: "Pursuit Lunge", cost: 15, endFrame: 40, regions: lungeRegions(),
  motion: [{ ...frames(5, 14), velocityX: LUNGE_SPEED, velocityZ: 0.0 }, { ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0 }],
};
// Shadow Pursuit (#126): against a marked opponent within 2.5H, a 14-frame tell
// (the mark flares), then on f15 she appears just behind the target facing
// it, spending the mark, and slashes f18-20; ends f40. No intangibility.
const PURSUIT_REACH = f32(H * f32(2.5));
const SHADOW_PURSUIT: AuthoredSpecial = {
  cost: 15,
  endFrame: 40,
  motion: [{ ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0, relocate: Relocation.behindMark, relocateReach: PURSUIT_REACH }],
  regions: [heroRegion(18, 20, blade(16.0, 48.0, f32(f32(H * f32(0.80)) - KNIFE_RADIUS), 44.0), wardenHit(10.0, "EDGE", 35))],
};

// Up or down held through entry tilts the air dash 20 degrees; no later steering.
const LUNGE_TILT = { x: f32(0.939692621), z: f32(0.342020143) };
const PURSUIT_LUNGE_AIR: AuthoredSpecial = {
  ...PURSUIT_LUNGE, oncePerAirtime: true, helpless: true, landingLag: 12, aimFrames: 4,
  motion: [{ ...frames(5, 14), velocityX: LUNGE_SPEED, velocityZ: 0.0, aimedTilt: LUNGE_TILT }, { ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0 }],
};

// Blink, the roster's charged-angle rule (#189) as a teleport: she hovers
// through f8 while the stick picks one of eight directions, moves at once on
// f9, intangible f8-10 (full form), then holds still at her vulnerable
// endpoint through f30 (on the ground as well) before a helpless fall in the air.
const blink = (cost: number, distance: number, intangible: boolean): AuthoredSpecial => ({
  cost, endFrame: 30, oncePerAirtime: true, helpless: true, aimFrames: CHARGED_AIM_FRAMES,
  motion: [
    { ...frames(1, CHARGED_AIM_FRAMES), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(9, 9), velocityX: 0.0, velocityZ: distance, aimedSpeed: distance, throughEdge: true },
    { ...frames(10, 30), velocityX: 0.0, velocityZ: 0.0 },
  ],
  intangible: intangible ? frames(8, 10) : undefined,
});
const BLINK = blink(20, f32(H * f32(3.5)), true);
const BLINK_FREE = blink(0, f32(H * f32(1.9)), false);

// Fan of Knives reaches 1.30H; shield or bait the committed cast to punish it.
export const WARDEN_FAN_REACH = f32(H * f32(1.30));
const FAN = f32(WARDEN_FAN_REACH - KNIFE_RADIUS);
const FAN_DIAGONAL = f32(FAN * f32(0.707106781));
const FAN_CENTER = 48.0;
const fanRegions = (scale = 1.0): readonly MoveRegion[] => {
  const front = wardenHit(7.0, "POKE", 45);
  const back = wardenHit(7.0, "POKE", 45, -1.0);
  const regions = [
    heroRegion(9, 11, blade(16.0, FAN_CENTER, FAN, FAN_CENTER), front),
    heroRegion(9, 11, blade(12.0, f32(FAN_CENTER + 12.0), FAN_DIAGONAL, f32(FAN_CENTER + FAN_DIAGONAL)), front),
    heroRegion(9, 11, blade(12.0, f32(FAN_CENTER - 12.0), FAN_DIAGONAL, f32(FAN_CENTER - FAN_DIAGONAL)), front),
    heroRegion(9, 11, blade(0.0, f32(FAN_CENTER + 16.0), 0.0, f32(FAN_CENTER + FAN)), front),
    heroRegion(9, 11, blade(-16.0, FAN_CENTER, -FAN, FAN_CENTER), back),
    heroRegion(9, 11, blade(-12.0, f32(FAN_CENTER + 12.0), -FAN_DIAGONAL, f32(FAN_CENTER + FAN_DIAGONAL)), back),
    heroRegion(9, 11, blade(-12.0, f32(FAN_CENTER - 12.0), -FAN_DIAGONAL, f32(FAN_CENTER - FAN_DIAGONAL)), back),
  ];
  if (scale === 1.0) return regions;
  return regions.map(region => {
    const strike = region.hit.strike;
    if (strike === undefined) return region;
    const height = (z: number): number => f32(FAN_CENTER + f32(f32(z - FAN_CENTER) * scale));
    return heroRegion(region.firstFrame + 1, region.lastFrame + 1, blade(
      f32(strike.x1 * scale), height(strike.z1), f32(strike.x2 * scale), height(strike.z2), f32(strike.radius * scale),
    ), region.hit.effect);
  });
};
const FAN_OF_KNIVES: AuthoredSpecial = { cost: 18, endFrame: 38, regions: fanRegions(), strikeStatus: POISON };

// All seven rays expand about the same chest-height center.
function withFanEx(kit: SpecialKit): SpecialKit {
  const upgraded = withExKit(kit, { reach: 1.25 });
  const form = (move: AuthoredSpecial): AuthoredSpecial => ({ ...move,
    ex: move.ex === undefined ? undefined : { ...move.ex, regions: fanRegions(1.25) },
  });
  return { ...upgraded, ground: form(upgraded.ground), air: upgraded.air === undefined ? undefined : form(upgraded.air) };
}

export const WARDEN_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Shadow Strike", description: "A slow dagger that marks and poisons its target.", ground: SHADOW_STRIKE }, { damage: 1.25 }),
  side: withExKit({ name: "Shadow Pursuit", description: "Appear behind a marked opponent and slash; with no mark nearby, a dashing Pursuit Lunge.", ground: PURSUIT_LUNGE, air: PURSUIT_LUNGE_AIR, marked: { special: SHADOW_PURSUIT, range: PURSUIT_REACH } }, { damage: 1.25 }),
  up: withExKit({ name: "Blink", description: "Teleport in any of eight directions; the landing spot is open to a punish.", ground: BLINK, free: BLINK_FREE }, { travel: 1.25 }),
  down: withFanEx({ name: "Fan of Knives", description: "Throw knives outward in a wide burst, marking and poisoning everyone hit.", ground: FAN_OF_KNIVES, air: FAN_OF_KNIVES }),
};
