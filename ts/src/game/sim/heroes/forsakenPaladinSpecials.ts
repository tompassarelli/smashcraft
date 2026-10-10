



import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { CHILL } from "../chill";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, frames } from "../heroSpecials";
import { hurtPose } from "../hurtboxes";
import { MEDIUM, capsule, hit, forsakenPaladinReach } from "./forsakenPaladinMoves";

const H = HERO_REFERENCE_HEIGHT;
const heights = (multiple: number): number => f32(H * f32(multiple));
const perFrame = (distance: number, first: number, last: number): number => f32(distance / (last - first + 1));

const JUSTICE = { ...hit(13.935999870300293, "LAUNCH", 80, false, HitElement.holy), growth: 66.98999786376953, base: 42.0 };
const cleansingHammer = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 38,
  cleanseFrame: 14,
  regions: [
    heroRegion(14, 14, capsule(28.0, 82.0, 108.0, 90.0, 18.0), JUSTICE),
    heroRegion(15, 15, capsule(28.0, 66.0, 122.0, 68.0, 18.0), JUSTICE),
    heroRegion(16, 16, capsule(28.0, 44.0, 110.0, 12.0, 18.0), JUSTICE),
  ],
  landingLag,
  hurt: [hurtPose(10, 22, forsakenPaladinReach(46.0, 70.0))],
});

const FURY_SPEED = perFrame(heights(f32(0.75)), 15, 20);
const FURY = hit(15.008000373840332, "EDGE", 40, false, HitElement.holy);
const furyRegions = [heroRegion(15, 20, capsule(20.0, 58.0, 128.0, 48.0, 18.0), FURY)];
const RIGHTEOUS_FURY: AuthoredSpecial = {
  endFrame: 49,
  cooldownFrames: 240,
  regions: furyRegions,
  strikeStatus: CHILL,
  hurt: [hurtPose(12, 25, forsakenPaladinReach(48.0, 56.0))],
  motion: [{ ...frames(15, 20), velocityX: FURY_SPEED, velocityZ: 0.0, stopsAtBody: true }, { ...frames(21, 21), velocityX: 0.0, velocityZ: 0.0 }],
  armor: { ...frames(15, 18), maxDamage: 5.0 },
};
const RIGHTEOUS_FURY_AIR: AuthoredSpecial = {
  endFrame: RIGHTEOUS_FURY.endFrame,
  cooldownFrames: RIGHTEOUS_FURY.cooldownFrames,
  regions: furyRegions,
  strikeStatus: CHILL,
  hurt: RIGHTEOUS_FURY.hurt,
  motion: RIGHTEOUS_FURY.motion,
  oncePerAirtime: true,
  helpless: true,
  landingLag: 20,
};





const ASCENT_FIRST = 8;
const ASCENT_LAST = 29;
const ascension = (rise: number): AuthoredSpecial => ({
  endFrame: ASCENT_LAST,
  regions: [heroRegion(10, 15, capsule(10.0, 70.0, 24.0, f32(MEDIUM + 20.0), 16.0), hit(8.576000213623047, "LAUNCH", 80, false, HitElement.holy))],
  motion: [
    { ...frames(ASCENT_FIRST, ASCENT_LAST - 1), velocityX: perFrame(heights(f32(0.2)), ASCENT_FIRST, ASCENT_LAST - 1), velocityZ: perFrame(heights(rise), ASCENT_FIRST, ASCENT_LAST - 1), driftSpeed: perFrame(heights(f32(1.6)), ASCENT_FIRST, ASCENT_LAST - 1) },
    { ...frames(ASCENT_LAST, ASCENT_LAST), velocityX: 0.0, velocityZ: 0.0 },
  ],
  hurt: [hurtPose(7, 18, forsakenPaladinReach(10.0, 136.0))],
  oncePerAirtime: true,
  helpless: true,
});

const CONSECRATION: AuthoredSpecial = {
  endFrame: 42,
  cooldownFrames: 150,
  groundOnly: true,
  projectiles: [{
    model: "Abilities\\Spells\\Other\\Consecration\\Consecration.mdx",
    modelRadius: 1202.0,
    spawnFrame: 16, offsetX: 70.0, offsetZ: 6.0,
    velocityX: 0.0, velocityZ: 0.0, life: 120, radius: 60.0,
    effect: { damage: 2.0, growth: 28.709999084472656, base: 30.0, launchX: f32(0.173648178), launchZ: f32(0.984807753), electric: false, element: HitElement.holy },
    reflectable: false, limit: 1, needsLineOfSight: true,
    pool: { every: 45, growth: 0.0, maxRadius: 60.0 },
  }],
};

export const FORSAKEN_PALADIN_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Cleansing Hammer", description: "Bonk upward with the hammer; its holy impact cleanses your poison and movement slow.", ground: cleansingHammer(undefined), air: cleansingHammer(18) }, { damage: 1.25 }),
  side: withExKit({ name: "Righteous Fury", description: "Charge hammer-first. A body hit briefly slows movement; a blocked charge leaves you exposed.", ground: RIGHTEOUS_FURY, air: RIGHTEOUS_FURY_AIR }, { damage: 1.25 }),
  up: withExKit({ name: "Ascension", description: "A rising hammer strike you steer, then a helpless fall.", ground: ascension(f32(2.9)) }, { travel: 1.25 }),
  down: withExKit({ name: "Consecration", description: "Plant the hammer to bless a small patch of ground. It pulses beneath grounded foes; jumping clears it.", ground: CONSECRATION }, { reach: 1.25 }),
};
