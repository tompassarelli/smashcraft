import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { Character } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { hurtPart, hurtPose } from "../hurtboxes";
import { type FighterSpecials, type SpecialMotion, ROSTER_MANA, frames } from "../heroSpecials";
import { MEDIUM, SHORT, capsule, hit } from "./mountainKingMoves";

// smashcraft:docs/design/roster.md "Mountain King": costs, frames, damage,
// angles and travel are the adopted starting values; geometry and the eased
// travel split are original and provisional.
const H = HERO_REFERENCE_HEIGHT;
const heights = (amount: number) => f32(H * f32(amount));

// Storm Bolt: one straight, reflectable hammer; normal hitstun, no stun status.
const BOLT_SPEED = heights(f32(0.12));
const BOLT_RADIUS = heights(f32(0.18));
const STORM_BOLT = hit(7.0, "LAUNCH", 65);

// Storm Rush: 1.2H of shoulder travel over its six active frames, then a dead stop.
const RUSH_FRAMES = 6;
const RUSH_SPEED = f32(heights(f32(1.2)) / RUSH_FRAMES);
const STORM_RUSH = hit(12.0, "EDGE", 35);
const RUSH: readonly SpecialMotion[] = [{ ...frames(13, 18), velocityX: RUSH_SPEED, velocityZ: 0.0, stopsAtBody: true }, { ...frames(19, 19), velocityX: 0.0, velocityZ: 0.0 }];
const RUSH_BODY = capsule(0.0, 14.0, 12.0, 60.0, 26.0);
// The lowered shoulder is body, so it carries its own hurt volume while it strikes.
const RUSH_HURT = [hurtPose(13, 18, [hurtCapsule(Character.mountainKing), hurtPart(RUSH_BODY.x1, RUSH_BODY.z1, RUSH_BODY.x2, RUSH_BODY.z2, RUSH_BODY.radius)])];

// Thunder Leap: exact rise over f9-28 (20 frames), half of it in the f9-14 hit
// window, then easing so the peak stays at the listed height. Full form 1.8H up
// and 0.7H forward; the free form 1.3H up and 0.5H forward, no attack.
const leap = (rise: number, drift: number): SpecialMotion[] => {
  const segment = (first: number, last: number, share: number): SpecialMotion =>
    ({ ...frames(first, last), velocityX: f32(f32(drift * share) / (last - first + 1)), velocityZ: f32(f32(rise * share) / (last - first + 1)) });
  return [segment(9, 14, 0.5), segment(15, 24, f32(0.46)), segment(25, 28, f32(0.04))];
};
const FULL_LEAP = leap(heights(f32(1.8)), heights(f32(0.7)));
const FREE_LEAP = leap(heights(f32(1.3)), heights(0.5));
const THUNDER_LEAP = hit(8.0, "LAUNCH", 80);
const LEAP_HAMMER = capsule(10.0, 60.0, 30.0, f32(MEDIUM + 20.0), 16.0);

// Thunder Clap: a ground-level ring of 0.85H on both sides; a jump clears it.
const CLAP_REACH = heights(f32(0.85));
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
      hurt: RUSH_HURT,
      motion: RUSH,
    },
    air: {
      cost: 18,
      endFrame: 46,
      regions: [heroRegion(13, 18, RUSH_BODY, STORM_RUSH)],
      hurt: RUSH_HURT,
      motion: RUSH,
      oncePerAirtime: true,
      helpless: true,
    },
  },
  up: {
    ground: {
      cost: 15,
      endFrame: 28,
      regions: [heroRegion(9, 14, LEAP_HAMMER, THUNDER_LEAP)],
      motion: FULL_LEAP,
      oncePerAirtime: true,
      helpless: true,
    },
    free: {
      cost: 0,
      endFrame: 28,
      motion: FREE_LEAP,
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
