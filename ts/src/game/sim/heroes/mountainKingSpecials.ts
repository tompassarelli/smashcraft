import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type FighterSpecials, ROSTER_MANA, frames } from "../heroSpecials";
import { MEDIUM, SHORT, capsule, hit } from "./mountainKingMoves";

// smashcraft:docs/design/roster.md "Mountain King": costs, frames, damage,
// angles and travel are the adopted starting values; geometry and the eased
// travel split are original and provisional.
const H = HERO_REFERENCE_HEIGHT;
const heights = (amount: number) => f32(H * f32(amount));

// Storm Bolt: one straight, reflectable hammer; normal hitstun, no stun status.
const BOLT_SPEED = heights(0.12);
const BOLT_RADIUS = heights(0.18);
const STORM_BOLT = hit(7.0, "LAUNCH", 65);

// Storm Rush: 1.2H of shoulder travel over its six active frames.
const RUSH_FRAMES = 6;
const RUSH_SPEED = f32(heights(1.2) / RUSH_FRAMES);
const STORM_RUSH = hit(12.0, "EDGE", 35);
const RUSH_BODY = capsule(0.0, 14.0, 12.0, 60.0, 26.0);

// Thunder Leap: rise over f9-28 (20 frames), front-loaded into the hit window.
// Full form 1.8H up and 0.7H forward; the free form 1.3H up, no attack.
const LEAP_FAST = 6;
const LEAP_SLOW = 14;
const leapRise = (total: number) => {
  const fast = f32(f32(total * 0.5) / LEAP_FAST);
  const slow = f32(f32(total * 0.5) / LEAP_SLOW);
  return { fast, slow };
};
const FULL_RISE = leapRise(heights(1.8));
const FREE_RISE = leapRise(heights(1.3));
const LEAP_DRIFT = f32(heights(0.7) / (LEAP_FAST + LEAP_SLOW));
const FREE_DRIFT = f32(heights(0.5) / (LEAP_FAST + LEAP_SLOW));
const THUNDER_LEAP = hit(8.0, "LAUNCH", 80);
const LEAP_HAMMER = capsule(10.0, 60.0, 30.0, f32(MEDIUM + 20.0), 16.0);

// Thunder Clap: a ground-level ring of 0.85H on both sides; a jump clears it.
const CLAP_REACH = heights(0.85);
const CLAP_FRONT = hit(10.0, "LAUNCH", 70);
const CLAP_BACK = hit(10.0, "LAUNCH", 70, true);
// Air form: the hammer swings under the body, 0.55H reach, no shockwave.
const AIR_CLAP = hit(10.0, "LAUNCH", 70);

export const MOUNTAIN_KING_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: {
    ground: {
      cost: 8,
      endFrame: 48,
      projectiles: [{
        spawnFrame: 20, offsetX: 32.0, offsetZ: 56.0, velocityX: BOLT_SPEED, velocityZ: 0.0,
        life: 35, radius: BOLT_RADIUS, effect: STORM_BOLT, reflectable: true, limit: 1,
      }],
      landingLag: 20,
    },
  },
  side: {
    ground: {
      cost: 18,
      endFrame: 46,
      regions: [heroRegion(13, 18, RUSH_BODY, STORM_RUSH)],
      motion: [{ ...frames(13, 18), velocityX: RUSH_SPEED, velocityZ: 0.0, stopsAtBody: true }],
    },
    air: {
      cost: 18,
      endFrame: 46,
      regions: [heroRegion(13, 18, RUSH_BODY, STORM_RUSH)],
      motion: [{ ...frames(13, 18), velocityX: RUSH_SPEED, velocityZ: 0.0, stopsAtBody: true }],
      oncePerAirtime: true,
      helpless: true,
    },
  },
  up: {
    ground: {
      cost: 15,
      endFrame: 28,
      regions: [heroRegion(9, 14, LEAP_HAMMER, THUNDER_LEAP)],
      motion: [
        { ...frames(9, 14), velocityX: LEAP_DRIFT, velocityZ: FULL_RISE.fast },
        { ...frames(15, 28), velocityX: LEAP_DRIFT, velocityZ: FULL_RISE.slow },
      ],
      oncePerAirtime: true,
      helpless: true,
    },
    free: {
      cost: 0,
      endFrame: 28,
      motion: [
        { ...frames(9, 14), velocityX: FREE_DRIFT, velocityZ: FREE_RISE.fast },
        { ...frames(15, 28), velocityX: FREE_DRIFT, velocityZ: FREE_RISE.slow },
      ],
      oncePerAirtime: true,
      helpless: true,
    },
  },
  down: {
    ground: {
      cost: 20,
      endFrame: 53,
      regions: [
        heroRegion(18, 21, capsule(0.0, 14.0, f32(CLAP_REACH - 16.0), 14.0, 16.0), CLAP_FRONT),
        heroRegion(18, 21, capsule(0.0, 14.0, -f32(CLAP_REACH - 16.0), 14.0, 16.0), CLAP_BACK),
      ],
    },
    air: {
      cost: 20,
      endFrame: 53,
      regions: [heroRegion(18, 21, capsule(10.0, 10.0, f32(SHORT - 14.0), -20.0, 14.0), AIR_CLAP)],
      landingLag: 20,
    },
  },
};
