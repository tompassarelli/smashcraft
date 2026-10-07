// Uther's hammer and Light (smashcraft:docs/design/uther.md).
// Frames follow the brief: entry is frame 1, windows are inclusive. A motion
// window sets velocity exactly (no gravity or drag), so each travel is its
// distance over its frames.
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, frames } from "../heroSpecials";
import { hurtPose } from "../hurtboxes";
import { MEDIUM, capsule, hit, utherReach } from "./utherMoves";

const H = HERO_REFERENCE_HEIGHT;
const heights = (multiple: number): number => f32(H * f32(multiple));
const perFrame = (distance: number, first: number, last: number): number => f32(distance / (last - first + 1));

const JUSTICE = { ...hit(13.0, "LAUNCH", 80, false, HitElement.holy), growth: 70.0, base: 42.0 };
const hammerOfJustice = (landingLag: number | undefined): AuthoredSpecial => ({
  cost: 10,
  endFrame: 38,
  regions: [
    heroRegion(14, 14, capsule(28.0, 82.0, 108.0, 90.0, 18.0), JUSTICE),
    heroRegion(15, 15, capsule(28.0, 66.0, 122.0, 68.0, 18.0), JUSTICE),
    heroRegion(16, 16, capsule(28.0, 44.0, 110.0, 12.0, 18.0), JUSTICE),
  ],
  landingLag,
  hurt: [hurtPose(10, 22, utherReach(46.0, 70.0))],
});

const RADIANCE_SPEED = perFrame(heights(f32(0.75)), 15, 20);
const RADIANCE = hit(14.0, "EDGE", 40, false, HitElement.holy);
const radianceRegions = [heroRegion(15, 20, capsule(20.0, 58.0, 128.0, 48.0, 18.0), RADIANCE)];
const radianceWave = [{
  model: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltMissile.mdx",
  spawnFrame: 21, offsetX: 150.0, offsetZ: 48.0,
  velocityX: heights(f32(0.11)), velocityZ: 0.0,
  life: 24, radius: 18.0,
  effect: hit(6.0, "POKE", 40, false, HitElement.holy),
  reflectable: true, limit: 1,
}];
const HOLY_RADIANCE: AuthoredSpecial = {
  cost: 20,
  endFrame: 49,
  regions: radianceRegions,
  projectiles: radianceWave,
  hurt: [hurtPose(12, 25, utherReach(48.0, 56.0))],
  motion: [{ ...frames(15, 20), velocityX: RADIANCE_SPEED, velocityZ: 0.0, stopsAtBody: true }, { ...frames(21, 21), velocityX: 0.0, velocityZ: 0.0 }],
  armor: { ...frames(15, 18), maxDamage: 5.0 },
};
const HOLY_RADIANCE_AIR: AuthoredSpecial = {
  cost: HOLY_RADIANCE.cost,
  endFrame: HOLY_RADIANCE.endFrame,
  regions: radianceRegions,
  projectiles: radianceWave,
  hurt: HOLY_RADIANCE.hurt,
  motion: HOLY_RADIANCE.motion,
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
  regions: struck ? [heroRegion(10, 15, capsule(10.0, 70.0, 24.0, f32(MEDIUM + 20.0), 16.0), hit(8.0, "LAUNCH", 80, false, HitElement.holy))] : undefined,
  motion: [
    { ...frames(ASCENT_FIRST, ASCENT_LAST - 1), velocityX: perFrame(heights(f32(0.45)), ASCENT_FIRST, ASCENT_LAST - 1), velocityZ: perFrame(heights(rise), ASCENT_FIRST, ASCENT_LAST - 1) },
    { ...frames(ASCENT_LAST, ASCENT_LAST), velocityX: 0.0, velocityZ: 0.0 },
  ],
  hurt: [hurtPose(7, 18, utherReach(10.0, 136.0))],
  oncePerAirtime: true,
  helpless: true,
});

// Divine Shield (#131): grounded stance, intangible f6-9 and vulnerable
// otherwise, so grabs and late hits beat it. A damaging strike or projectile
// overlapping the body on f6-9 raises Divine Shield for 45 frames: strikes and
// projectiles pass through him until he attacks, uses a special or grabs, and
// grabs still catch him. The airborne press fails without spending.
const DIVINE_SHIELD: AuthoredSpecial = {
  cost: 25,
  endFrame: 36,
  intangible: frames(6, 9),
  guard: { ...frames(6, 9), heal: 0.0, healCapPerStock: 0.0, shieldFrames: 45 },
  groundOnly: true,
};

export const UTHER_SPECIALS: FighterSpecials = {
  neutral: { name: "Hammer of Justice", description: "A heavy overhead bonk that lifts the opponent for a follow-up.", ground: hammerOfJustice(undefined), air: hammerOfJustice(18) },
  side: { name: "Holy Radiance", description: "Drive the hammer forward, then send light beyond it. Strong up close; unsafe if blocked.", ground: HOLY_RADIANCE, air: HOLY_RADIANCE_AIR },
  up: { name: "Ascension", description: "A rising hammer strike, then a helpless fall.", ground: ascension(15, f32(1.9), true), free: ascension(0, f32(1.3), false) },
  down: { name: "Divine Shield", description: "A guard: read an attack and become untouchable until you act. Grabs still catch him.", ground: DIVINE_SHIELD },
};
