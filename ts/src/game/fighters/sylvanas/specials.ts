import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { type AuthoredSpecial, type FighterSpecials, frames } from "../../sim/specials/schema";
import { hurtPose } from "../../sim/hurtboxes";
import { sylvanasHit, sylvanasReach, sylvanasStrike } from "./moves";

const BLACK_ARROW: AuthoredSpecial = {
  endFrame: 34, cooldownFrames: 52,
  projectiles: [{
    model: "Abilities\\Spells\\Other\\BlackArrow\\BlackArrowMissile.mdl",
    spawnFrame: 10, offsetX: 44.0, offsetZ: 60.0, velocityX: 17.0, velocityZ: 0.0, upVelocityX: 17.0, upVelocityZ: 5.0,
    life: 36, radius: 10.0, effect: sylvanasHit(8.748000144958496, 35, 72.16999816894531, 16.0), reflectable: true, limit: 1,
  }],
  hurt: [hurtPose(6, 16, sylvanasReach(44.0, 60.0))],
};
const SILENCE: AuthoredSpecial = {
  endFrame: 48,
  regions: [heroRegion(18, 20, sylvanasStrike(28.0, 68.0, 143.0, 68.0, 12.0), sylvanasHit(3.888000011444092, 60, 46.39500045776367, 20.0))],
  strikeStatus: { kind: HeroStatusKind.silence, frames: 90, group: HeroStatusGroup.silence, immunityFrames: 180 },
  hurt: [hurtPose(14, 24, sylvanasReach(48.0, 68.0))],
};
const flight = (rise: number, across: number): AuthoredSpecial => ({
  endFrame: 31,
  motion: [{ ...frames(1, 7), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(8, 31), velocityX: 0.0, velocityZ: f32(f32(HERO_REFERENCE_HEIGHT * rise) / 24.0), driftSpeed: f32(f32(HERO_REFERENCE_HEIGHT * across) / 24.0) }],
  oncePerAirtime: true, helpless: true,
});
const LIFE_DRAIN: AuthoredSpecial = {
  endFrame: 52, groundOnly: true,
  commandGrab: { ...frames(16, 18), strike: sylvanasStrike(18.0, 54.0, 68.0, 54.0, 12.0), holdFrames: 16, effect: sylvanasHit(8.748000144958496, 50, 92.79000091552734, 24.0), recovery: 28, heal: { heal: 3.0 } },
  hurt: [hurtPose(13, 35, sylvanasReach(48.0, 54.0))],
};

export const SYLVANAS_SPECIALS: FighterSpecials = {
  neutral: { name: "Black Arrow", description: "A dark arrow that charges her next bow strike. It leaves on frame 10 of 34, on the ground or in the air, so a short hop fires it before she lands, and she can fire again 52 frames after the last cast. Hold up to fire upward.", ground: BLACK_ARROW, air: { ...BLACK_ARROW, landingLag: 16 } },
  side: { name: "Silence", description: "A short curse that stops offensive specials. Movement, attacks and recovery still work.", ground: SILENCE, air: { ...SILENCE, landingLag: 20 } },
  up: { name: "Banshee Flight", description: "Rise as a spirit, steering toward the stage, then fall helpless.", ground: flight(f32(2.6), f32(2.6)) },
  down: { name: "Life Drain", description: "Catch a nearby foe through their shield and drain a little life. A missed reach leaves her open.", ground: LIFE_DRAIN, air: { ...LIFE_DRAIN, groundOnly: false } },
};
