// Uther's four specials and mana (smashcraft:docs/design/roster.md, "Uther").
// Frames follow the brief: entry is frame 1, windows are inclusive. A motion
// window sets velocity exactly (no gravity or drag), so each travel is its
// distance over its frames.
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, ROSTER_MANA, frames } from "../heroSpecials";
import { hurtPose } from "../hurtboxes";
import { MEDIUM, capsule, hit, utherReach } from "./utherMoves";

const H = HERO_REFERENCE_HEIGHT;
const heights = (multiple: number): number => f32(H * f32(multiple));
const perFrame = (distance: number, first: number, last: number): number => f32(distance / (last - first + 1));

// Holy Bolt: 0.12H a frame, 30 frames, 0.17H radius; holding up aims it 30 degrees up.
const BOLT_SPEED = heights(f32(0.12));
const BOLT_UP_X = f32(BOLT_SPEED * f32(0.8660254037844387));
const BOLT_UP_Z = f32(BOLT_SPEED * f32(0.5));
const holyBolt = (landingLag: number | undefined): AuthoredSpecial => ({
  cost: 5,
  endFrame: 47,
  projectiles: [{
    spawnFrame: 22,
    offsetX: 30.0,
    offsetZ: 62.0,
    velocityX: BOLT_SPEED,
    velocityZ: 0.0,
    upVelocityX: BOLT_UP_X,
    upVelocityZ: BOLT_UP_Z,
    life: 30,
    radius: heights(f32(0.17)),
    effect: hit(7.0, "POKE", 40),
    reflectable: true,
    limit: 1,
  }],
  landingLag,
  hurt: [hurtPose(18, 28, utherReach(40.0, 70.0))],
});

// Crusader Rush: 0.9H over f12-17 with the hammer leading, stopping on f18.
// Only the grounded form carries armor; the airborne form holds its height,
// cannot repeat in one airtime and ends helpless.
const RUSH_SPEED = perFrame(heights(f32(0.9)), 12, 17);
const RUSH = hit(11.0, "LAUNCH", 45);
const rushRegions = [heroRegion(12, 17, capsule(20.0, 52.0, f32(MEDIUM - 14.0), 40.0, 14.0), RUSH)];
const CRUSADER_RUSH: AuthoredSpecial = {
  cost: 20,
  endFrame: 47,
  regions: rushRegions,
  hurt: [hurtPose(9, 21, utherReach(44.0, 56.0))],
  motion: [{ ...frames(12, 17), velocityX: RUSH_SPEED, velocityZ: 0.0 }, { ...frames(18, 18), velocityX: 0.0, velocityZ: 0.0 }],
  armor: { ...frames(12, 15), maxDamage: 5.0 },
};
const CRUSADER_RUSH_AIR: AuthoredSpecial = {
  cost: 20,
  endFrame: 47,
  regions: rushRegions,
  hurt: [hurtPose(9, 21, utherReach(44.0, 56.0))],
  motion: [{ ...frames(12, 17), velocityX: RUSH_SPEED, velocityZ: 0.0 }, { ...frames(18, 18), velocityX: 0.0, velocityZ: 0.0 }],
  oncePerAirtime: true,
  helpless: true,
  landingLag: 20,
};

// Ascension: travel f8-29, then helpless. The full form rises 1.9H with one
// hammer hit on f10-15; the free form rises 1.3H with no hit; both drift
// 0.45H, and stop on f29 so the helpless fall starts at the apex.
const ASCENT_FIRST = 8;
const ASCENT_LAST = 29;
const ascension = (cost: number, rise: number, struck: boolean): AuthoredSpecial => ({
  cost,
  endFrame: ASCENT_LAST,
  regions: struck ? [heroRegion(10, 15, capsule(10.0, 70.0, 24.0, f32(MEDIUM + 20.0), 16.0), hit(8.0, "LAUNCH", 80))] : undefined,
  motion: [
    { ...frames(ASCENT_FIRST, ASCENT_LAST - 1), velocityX: perFrame(heights(f32(0.45)), ASCENT_FIRST, ASCENT_LAST - 1), velocityZ: perFrame(heights(rise), ASCENT_FIRST, ASCENT_LAST - 1) },
    { ...frames(ASCENT_LAST, ASCENT_LAST), velocityX: 0.0, velocityZ: 0.0 },
  ],
  hurt: [hurtPose(7, 18, utherReach(10.0, 136.0))],
  oncePerAirtime: true,
  helpless: true,
});

// Divine Guard: grounded stance, intangible f6-9 and vulnerable otherwise, so
// grabs and late hits beat it. A damaging strike or projectile overlapping
// the body on f6-9 restores 3 damage percent, at most 8 a stock. The airborne
// press fails without spending.
const DIVINE_GUARD: AuthoredSpecial = {
  cost: 25,
  endFrame: 36,
  intangible: frames(6, 9),
  guard: { ...frames(6, 9), heal: 3.0, healCapPerStock: 8.0 },
  groundOnly: true,
};

export const UTHER_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: holyBolt(undefined), air: holyBolt(20) },
  side: { ground: CRUSADER_RUSH, air: CRUSADER_RUSH_AIR },
  up: { ground: ascension(15, f32(1.9), true), free: ascension(0, f32(1.3), false) },
  down: { ground: DIVINE_GUARD },
};
