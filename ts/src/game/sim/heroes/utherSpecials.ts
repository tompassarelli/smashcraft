// Uther's four specials and mana (smashcraft:docs/design/roster.md, "Uther").
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

// Holy Light (#131, docs/design/kit-review-2.md): 0.11H a frame out for 26
// frames, then back toward Uther at the same speed, 80 frames in all, 0.17H
// radius; holding up aims it 30 degrees up. Outbound 7%, returning 5% toward
// Uther; reaching him untouched restores 3%, at most 9 a stock.
const BOLT_SPEED = heights(f32(0.11));
const BOLT_UP_X = f32(BOLT_SPEED * f32(0.8660254037844387));
const BOLT_UP_Z = f32(BOLT_SPEED * f32(0.5));
const holyLight = (landingLag: number | undefined): AuthoredSpecial => ({
  cost: 10,
  endFrame: 44,
  projectiles: [{
    model: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltMissile.mdx",
    spawnFrame: 20,
    offsetX: 30.0,
    offsetZ: 62.0,
    velocityX: BOLT_SPEED,
    velocityZ: 0.0,
    upVelocityX: BOLT_UP_X,
    upVelocityZ: BOLT_UP_Z,
    life: 80,
    radius: heights(f32(0.17)),
    effect: hit(7.0, "POKE", 40, false, HitElement.holy),
    returns: { age: 26, speed: BOLT_SPEED },
    returnEffect: hit(5.0, "POKE", 40, false, HitElement.holy),
    catchHeal: { heal: 3.0, capPerStock: 9.0 },
    reflectable: true,
    limit: 1,
  }],
  landingLag,
  hurt: [hurtPose(16, 26, utherReach(40.0, 70.0))],
});

// Crusader Rush: 0.9H over f12-17 with the hammer leading, stopping on f18.
// Only the grounded form carries armor; the airborne form holds its height,
// cannot repeat in one airtime and ends helpless.
const RUSH_SPEED = perFrame(heights(f32(0.9)), 12, 17);
const RUSH = hit(11.0, "LAUNCH", 45, false, HitElement.holy);
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
  neutral: { name: "Holy Light", description: "An orb of light that flies out and back; it heals Uther if it returns untouched.", ground: holyLight(undefined), air: holyLight(20) },
  side: { name: "Crusader Rush", description: "An armored hammer charge on the ground; in the air it ends helpless.", ground: CRUSADER_RUSH, air: CRUSADER_RUSH_AIR },
  up: { name: "Ascension", description: "A rising hammer strike, then a helpless fall.", ground: ascension(15, f32(1.9), true), free: ascension(0, f32(1.3), false) },
  down: { name: "Divine Shield", description: "A guard: read an attack and become untouchable until you act. Grabs still catch him.", ground: DIVINE_SHIELD },
};
