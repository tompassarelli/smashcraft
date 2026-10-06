// Blademaster's four specials (smashcraft:docs/design/roster.md, "Blademaster",
// "B specials"), as data for sim/heroSpecials.ts. Brief frame numbering: the
// entry tick is frame 1 and windows are inclusive.
import { f32 } from "wisp/src/sim/f32";
import { type AuthoredSpecial, type FighterSpecials, ROSTER_MANA, frames } from "../heroSpecials";
import { hurtPose } from "../hurtboxes";
import { BLADE_RADIUS, L, M, capsule, cut, hit, length, path, reach } from "./blademasterMoves";

// The sword arm reaches toward each strike, from just before it into early
// recovery, as the normals' bodies do; the blade past the hand stays disjoint.
const LOW_CUT_ARM = reach(46.0, 56.0);

// Non-mobility specials used in the air end on landing with the roster's default lag.
const AIR_LANDING_LAG = 20;

/** Wind Cutter: one short reflectable blade wave; free. Spawn f18, end f40. */
const windCutter: AuthoredSpecial = {
  cost: 0,
  endFrame: 40,
  hurt: [hurtPose(16, 24, LOW_CUT_ARM)],
  projectiles: [{
    spawnFrame: 18,
    offsetX: 40.0,
    offsetZ: 45.0,
    velocityX: length(f32(0.14)),
    velocityZ: 0.0,
    life: 24,
    radius: length(f32(0.16)),
    effect: hit(6.0, "POKE", 35),
    reflectable: true,
    limit: 1,
  }],
};

const WIND_WALK_DASH_FRAMES = 10;
const windWalkMotion = [{ ...frames(10, 19), velocityX: f32(length(f32(1.4)) / WIND_WALK_DASH_FRAMES), velocityZ: 0.0, stopsAtBody: true }];
const windWalkSlash = cut(20, [52.0, 45.0, 38.0], L, hit(11.0, "EDGE", 40));

/** Wind Walk Strike: a visible 1.4H dash f10-19, then a slash f20-22 and 26 recovery; 18 mana. */
const windWalkStrike: AuthoredSpecial = { cost: 18, endFrame: 48, motion: windWalkMotion, regions: windWalkSlash, hurt: [hurtPose(18, 26, LOW_CUT_ARM)] };
/** In the air it travels once per airtime and ends helpless, even on hit. */
const windWalkStrikeAir: AuthoredSpecial = { ...windWalkStrike, oncePerAirtime: true, helpless: true };

// Rising Blade sets its velocity f7-25; gravity still applies each frame and
// the climb coasts on after f25. These speeds are calibrated so the
// unobstructed peak and drift match the row (blademasterSpecials.tests.ts).
const RISE_SPEED_FULL = f32(13.0);
const DRIFT_SPEED_FULL = f32(3.6);
const RISE_SPEED_FREE = f32(9.93);
const DRIFT_SPEED_FREE = f32(2.56);
const rise = (velocityZ: number, velocityX: number) => [{ ...frames(7, 25), velocityX, velocityZ }];
const BLADE_TOP = f32(M - BLADE_RADIUS);

/** Rising Blade: 2.0H up and 0.5H forward, one 9-damage hit f7-12, then helpless; 15 mana; no intangibility. */
const risingBlade: AuthoredSpecial = {
  cost: 15,
  endFrame: 25,
  motion: rise(RISE_SPEED_FULL, DRIFT_SPEED_FULL),
  regions: path(7, [
    capsule(40.0, 30.0, 70.0, 70.0),
    capsule(30.0, 40.0, 55.0, 90.0),
    capsule(20.0, 50.0, 35.0, BLADE_TOP),
    capsule(10.0, 55.0, 15.0, BLADE_TOP),
    capsule(5.0, 60.0, 5.0, BLADE_TOP),
    capsule(0.0, 60.0, 0.0, BLADE_TOP),
  ], hit(9.0, "LAUNCH", 80)),
  hurt: [hurtPose(5, 14, reach(18.0, 128.0))],
  oncePerAirtime: true,
  helpless: true,
};

/** The zero-mana recovery: 1.4H of the same path and no attack. */
const risingBladeFree: AuthoredSpecial = {
  cost: 0,
  endFrame: 25,
  motion: rise(RISE_SPEED_FREE, DRIFT_SPEED_FREE),
  oncePerAirtime: true,
  helpless: true,
};

// Four frames of back step, then a stop; calibrated against ground traction to 0.5H.
const FEINT_STEP_SPEED = f32(-17.0);

/**
 * Mirror Feint's real forward slash: a second special press within 12 frames of the
 * departure (f8-19). Frame 1 is the press tick; active 9 frames later for 3,
 * then 25 recovery; it spends nothing more.
 */
const feintSlash: AuthoredSpecial = { cost: 0, endFrame: 37, hurt: [hurtPose(8, 16, LOW_CUT_ARM)], motion: [{ ...frames(1, 1), velocityX: 0.0, velocityZ: 0.0 }], regions: cut(10, [52.0, 45.0, 38.0], L, hit(10.0, "EDGE", 40)) };

/**
 * Mirror Feint: a visible tell, then a 0.5H back step from f8, ending f24; 15
 * mana and no intangibility. The afterimage is presentation only.
 */
const mirrorFeint: AuthoredSpecial = {
  cost: 15,
  endFrame: 24,
  motion: [
    { ...frames(8, 11), velocityX: FEINT_STEP_SPEED, velocityZ: 0.0 },
    { ...frames(12, 12), velocityX: 0.0, velocityZ: 0.0 },
  ],
  followUp: { window: frames(8, 19), special: feintSlash },
};

const inAir = (special: AuthoredSpecial): AuthoredSpecial => ({
  ...special,
  landingLag: AIR_LANDING_LAG,
  followUp: special.followUp === undefined ? undefined : { ...special.followUp, special: inAir(special.followUp.special) },
});

export const BLADEMASTER_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: windCutter, air: inAir(windCutter) },
  side: { ground: windWalkStrike, air: windWalkStrikeAir },
  up: { ground: risingBlade, free: risingBladeFree },
  down: { ground: mirrorFeint, air: inAir(mirrorFeint) },
};

