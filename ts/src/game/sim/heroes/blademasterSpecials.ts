// Blademaster's four specials (smashcraft:docs/design/roster.md, "Blademaster",
// "B specials"), as data for sim/heroSpecials.ts. Brief frame numbering: the
// entry tick is frame 1 and windows are inclusive.
import { f32 } from "wisp/src/sim/f32";
import { type AuthoredSpecial, type FighterSpecials, ROSTER_MANA, frames } from "../heroSpecials";
import { BLADE_RADIUS, L, M, capsule, cut, hit, length, path } from "./blademasterMoves";

// Non-mobility specials used in the air end on landing with the roster's default lag.
const AIR_LANDING_LAG = 20;

/** Wind Cutter: one short reflectable blade wave; free. Spawn f18, end f40. */
const windCutter: AuthoredSpecial = {
  cost: 0,
  endFrame: 40,
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
const windWalkMotion = [{ ...frames(10, 19), velocityX: f32(length(f32(1.4)) / WIND_WALK_DASH_FRAMES), velocityZ: 0.0 }];
const windWalkSlash = cut(20, [52.0, 45.0, 38.0], L, hit(11.0, "EDGE", 40));

/** Wind Walk Strike: a visible 1.4H dash f10-19, then a slash f20-22 and 26 recovery; 18 mana. */
const windWalkStrike: AuthoredSpecial = { cost: 18, endFrame: 48, motion: windWalkMotion, regions: windWalkSlash };
/** In the air it travels once per airtime and ends helpless, even on hit. */
const windWalkStrikeAir: AuthoredSpecial = { ...windWalkStrike, oncePerAirtime: true, helpless: true };

// Rising Blade travels f7-25; ascent and drift are spread evenly over that window.
const RISE_FRAMES = 19;
const rise = (ascent: number, drift: number) => [{
  ...frames(7, 25),
  velocityX: f32(length(drift) / RISE_FRAMES),
  velocityZ: f32(length(ascent) / RISE_FRAMES),
}];
const BLADE_TOP = f32(M - BLADE_RADIUS);

/** Rising Blade: 2.0H up and 0.5H forward, one 9-damage hit f7-12, then helpless; 15 mana; no intangibility. */
const risingBlade: AuthoredSpecial = {
  cost: 15,
  endFrame: 25,
  motion: rise(f32(2.0), f32(0.5)),
  regions: path(7, [
    capsule(40.0, 30.0, 70.0, 70.0),
    capsule(30.0, 40.0, 55.0, 90.0),
    capsule(20.0, 50.0, 35.0, BLADE_TOP),
    capsule(10.0, 55.0, 15.0, BLADE_TOP),
    capsule(5.0, 60.0, 5.0, BLADE_TOP),
    capsule(0.0, 60.0, 0.0, BLADE_TOP),
  ], hit(9.0, "LAUNCH", 80)),
  oncePerAirtime: true,
  helpless: true,
};

/** The zero-mana recovery: 1.4H of the same path and no attack. */
const risingBladeFree: AuthoredSpecial = {
  cost: 0,
  endFrame: 25,
  motion: rise(f32(1.4), f32(0.35)),
  oncePerAirtime: true,
  helpless: true,
};

const FEINT_STEP_FRAMES = 4;

/**
 * Mirror Feint: a visible tell, then a 0.5H back step from f8, ending f24; 15
 * mana and no intangibility. The afterimage is presentation only.
 */
const mirrorFeint: AuthoredSpecial = {
  cost: 15,
  endFrame: 24,
  motion: [{ ...frames(8, 11), velocityX: f32(-f32(length(f32(0.5)) / FEINT_STEP_FRAMES)), velocityZ: 0.0 }],
};

/**
 * The real forward slash a second special press requests within 12 frames of
 * the departure (f8-19). Its frame 1 is the press tick: active 9 frames later
 * for 3, then 25 recovery; it spends nothing more. It waits on the framework's
 * follow-up seam (roster-infra), so nothing runs it yet.
 */
export const MIRROR_FEINT_FOLLOW_UP = {
  window: frames(8, 19),
  special: {
    cost: 0,
    endFrame: 37,
    regions: cut(10, [52.0, 45.0, 38.0], L, hit(10.0, "EDGE", 40)),
    landingLag: AIR_LANDING_LAG,
  } satisfies AuthoredSpecial,
} as const;

const inAir = (special: AuthoredSpecial): AuthoredSpecial => ({ ...special, landingLag: AIR_LANDING_LAG });

export const BLADEMASTER_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: windCutter, air: inAir(windCutter) },
  side: { ground: windWalkStrike, air: windWalkStrikeAir },
  up: { ground: risingBlade, free: risingBladeFree },
  down: { ground: mirrorFeint, air: inAir(mirrorFeint) },
};

