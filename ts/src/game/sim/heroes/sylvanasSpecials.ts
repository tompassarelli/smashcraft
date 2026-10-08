import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, frames } from "../heroSpecials";
import { hurtPose } from "../hurtboxes";
import { sylvanasHit, sylvanasReach, sylvanasStrike } from "./sylvanasMoves";

const BLACK_ARROW: AuthoredSpecial = {
  endFrame: 40,
  projectiles: [{
    model: "Abilities\\Spells\\Other\\BlackArrow\\BlackArrowMissile.mdl",
    spawnFrame: 16, offsetX: 44.0, offsetZ: 60.0, velocityX: 17.0, velocityZ: 0.0, upVelocityZ: 5.0,
    life: 36, radius: 10.0, effect: sylvanasHit(9.0, 35, 70.0, 16.0), reflectable: true, limit: 1,
  }],
  hurt: [hurtPose(12, 22, sylvanasReach(44.0, 60.0))],
};
const SILENCE: AuthoredSpecial = {
  endFrame: 48,
  regions: [heroRegion(18, 20, sylvanasStrike(28.0, 68.0, 143.0, 68.0, 12.0), sylvanasHit(4.0, 60, 45.0, 20.0))],
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
  commandGrab: { ...frames(16, 18), strike: sylvanasStrike(18.0, 54.0, 68.0, 54.0, 12.0), holdFrames: 16, effect: sylvanasHit(9.0, 50, 90.0, 24.0), recovery: 28, heal: { heal: 3.0 } },
  hurt: [hurtPose(13, 35, sylvanasReach(48.0, 54.0))],
};

export const SYLVANAS_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Black Arrow", description: "A dark arrow that charges her next bow strike. Hold up to fire upward.", ground: BLACK_ARROW, air: { ...BLACK_ARROW, landingLag: 16 } }, { damage: 1.25 }),
  side: withExKit({ name: "Silence", description: "A short curse that stops offensive specials. Movement, attacks and recovery still work.", ground: SILENCE, air: { ...SILENCE, landingLag: 20 } }, { reach: 1.25 }),
  up: withExKit({ name: "Banshee Flight", description: "Rise as a spirit, steering toward the stage, then fall helpless.", ground: flight(f32(2.6), f32(2.6)) }, { travel: 1.25 }),
  down: withExKit({ name: "Life Drain", description: "Catch a nearby foe through their shield and drain a little life. A missed reach leaves her open.", ground: LIFE_DRAIN }, { damage: 1.25 }),
};
