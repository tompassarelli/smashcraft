import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { Character, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, type MoveRegion, heroRegion } from "../heroMoves";
import { hurtPart, hurtPose } from "../hurtboxes";
import { type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile, CHARGED_AIM_FRAMES, FollowUpInput, chargedAngleMotion, frames } from "../heroSpecials";
import { MEDIUM, SHORT, capsule, hit } from "./mountainKingMoves";

// smashcraft:docs/design/roster.md "Mountain King": costs, frames, damage,
// angles and travel are the adopted starting values; geometry and the eased
// travel split are original and provisional.
const H = HERO_REFERENCE_HEIGHT;
const heights = (amount: number) => f32(H * f32(amount));

// Storm Bolt (#125, smashcraft:docs/design/kit-review-1.md): the hammer flies
// out for 45 frames, then back to his body at 0.14H a frame, launching toward
// him on the way back; neutral special while it flies calls it back at once.
const BOLT_SPEED = heights(f32(0.12));
const BOLT_RETURN = { age: 45, speed: heights(f32(0.14)) };
/** Calling the hammer back: a 10-frame gesture, free. */
const BOLT_RECALL: AuthoredSpecial = { cost: 0, endFrame: 10, recallsProjectiles: true, landingLag: 10 };
const BOLT_RADIUS = heights(f32(0.18));
const STORM_BOLT = hit(5.524999618530273, "LAUNCH", 65, false, HitElement.electric);

// Storm Rush: 1.2H of shoulder travel over its six active frames, then a dead stop.
const RUSH_FRAMES = 6;
const RUSH_SPEED = f32(heights(f32(1.2)) / RUSH_FRAMES);
const STORM_RUSH = hit(13.25999927520752, "EDGE", 35);
const RUSH: readonly SpecialMotion[] = [{ ...frames(13, 18), velocityX: RUSH_SPEED, velocityZ: 0.0, stopsAtBody: true }, { ...frames(19, 19), velocityX: 0.0, velocityZ: 0.0 }];
const RUSH_BODY = capsule(0.0, 14.0, 12.0, 60.0, 26.0);
// The lowered shoulder is body, so it carries its own hurt volume while it strikes.
const RUSH_HURT = [hurtPose(13, 18, [hurtCapsule(Character.mountainKing), hurtPart(RUSH_BODY.x1, RUSH_BODY.z1, RUSH_BODY.x2, RUSH_BODY.z2, RUSH_BODY.radius)])];

// Thunder Leap, the roster's charged-angle rule (#189): he crouches through
// f8 while the stick picks one of eight directions (straight up by default),
// leaps that way evenly over f9-24 and stops on f25. Full form 2.7H, the free
// form 1.9H with no attack; a committed angle suits his limited air drift.
const leap = (distance: number): readonly SpecialMotion[] => chargedAngleMotion(distance, 16);
const FULL_LEAP = leap(heights(f32(2.7)));
const FREE_LEAP = leap(heights(f32(1.9)));
const THUNDER_LEAP = hit(8.839999198913574, "LAUNCH", 80, false, HitElement.electric);
const LEAP_HAMMER = capsule(10.0, 60.0, 30.0, f32(MEDIUM + 20.0), 16.0);

// Hammerfall (#125): a special press in the leap's f16-28 hangs 3 frames, then
// plunges straight down hammer first at 0.16H a frame: a spike against
// airborne targets, 55 degrees against grounded ones. Landing ends it with 24
// frames of lag; ending airborne leaves him helpless.
const PLUNGE = heights(f32(0.16));
const HAMMERFALL: AuthoredSpecial = {
  name: "Hammerfall",
  cost: 0,
  endFrame: 70,
  motion: [{ ...frames(1, 3), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(4, 70), velocityX: 0.0, velocityZ: -PLUNGE }],
  regions: [heroRegion(4, 70, capsule(4.0, 10.0, 4.0, -24.0, 20.0), hit(13.25999927520752, "SPIKE", 270, false, HitElement.electric), hit(11.049999237060547, "LAUNCH", 55, false, HitElement.electric))],
  landingLag: 24,
  helpless: true,
};

// Thunder Clap (#125), charged like Donkey Kong's Giant Punch: he raises the
// hammer over f1-9 and holds the charge f10-49. A special press in f10-29
// slams the small Clap; in f30-49, or by running out to f50, the full Thunder
// Clap, whose ring sends a ground wave each way; a shield press in f10-49
// drops the charge. No armor: a hit stops it. A ground-level ring of 0.85H on
// both sides; a jump clears ring and waves.
const CLAP_REACH = heights(f32(0.85));
const ring = (first: number, damage: number): readonly MoveRegion[] => [
  heroRegion(first, first + 3, capsule(0.0, 14.0, f32(CLAP_REACH - 16.0), 14.0, 16.0), hit(damage, "LAUNCH", 70, false, HitElement.electric)),
  heroRegion(first, first + 3, capsule(0.0, 14.0, -f32(CLAP_REACH - 16.0), 14.0, 16.0), hit(damage, "LAUNCH", 70, true, HitElement.electric)),
];
const WAVE_SPEED = heights(f32(0.10));
const wave = (spawnFrame: number, sign: number): SpecialProjectile => ({
  model: "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx",
  spawnFrame, offsetX: f32(sign * CLAP_REACH), offsetZ: 14.0, velocityX: f32(sign * WAVE_SPEED), velocityZ: 0.0, activeFrom: 6,
  life: 24, radius: 16.0, effect: hit(7.734999656677246, "LAUNCH", 75, false, HitElement.electric), reflectable: true, limit: 1,
});
const WAVES = (spawnFrame: number) => [wave(spawnFrame, 1), wave(spawnFrame, -1)];
/** The small Clap: slam on f4-7 of its press, 9%; ends f28. */
const CLAP: AuthoredSpecial = { name: "Small Clap", cost: 0, endFrame: 28, regions: ring(4, 9.944999694824219) };
/** The full Thunder Clap: slam on f4-7 of its press, 12% and both waves; ends f32. */
const THUNDER_CLAP: AuthoredSpecial = { cost: 0, endFrame: 32, regions: ring(4, 13.25999927520752), projectiles: WAVES(4) };
/** Dropping the charge: the action ends, so a held shield rises next frame. */
const HOLD: AuthoredSpecial = { cost: 0, endFrame: 1 };
const CHARGED_CLAP: AuthoredSpecial = {
  cost: 20,
  endFrame: 81,
  regions: ring(53, 13.25999927520752),
  projectiles: WAVES(53),
  followUps: [
    { window: frames(10, 29), special: CLAP },
    { window: frames(30, 49), special: THUNDER_CLAP },
    { window: frames(10, 49), input: FollowUpInput.shield, special: HOLD },
  ],
};
// Air form: the hammer swings under the body, 0.55H reach, no shockwave.
const AIR_CLAP = hit(11.049999237060547, "LAUNCH", 70, false, HitElement.electric);

export const MOUNTAIN_KING_SPECIALS: FighterSpecials = {
  neutral: {
    name: "Storm Bolt",
    description: "A hammer that flies out and back, hitting toward him on the return; press again to call it back.",
    ground: {
      cost: 8,
      endFrame: 58,
      projectiles: [{
        model: "Abilities\\Spells\\Human\\StormBolt\\StormBoltMissile.mdx",
        spawnFrame: 20, offsetX: 32.0, offsetZ: 56.0, velocityX: BOLT_SPEED, velocityZ: 0.0,
        life: 90, radius: BOLT_RADIUS, effect: STORM_BOLT, reflectable: true, limit: 1, returns: BOLT_RETURN,
      }],
      landingLag: 20,
    },
    recall: BOLT_RECALL,
    recallWhile: "projectile",
  },
  side: {
    name: "Storm Rush",
    description: "A shoulder charge that stops dead at a body or shield.",
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
    name: "Thunder Leap",
    description: "Hold a direction as he crouches, then a hammer leap that way; press special at the top to plunge down as Hammerfall.",
    ground: {
      cost: 15,
      endFrame: 28,
      regions: [heroRegion(9, 14, LEAP_HAMMER, THUNDER_LEAP)],
      aimFrames: CHARGED_AIM_FRAMES,
      motion: FULL_LEAP,
      facesStick: true,
      oncePerAirtime: true,
      helpless: true,
      followUps: [{ window: frames(16, 28), special: HAMMERFALL }],
    },
    free: {
      cost: 0,
      endFrame: 28,
      aimFrames: CHARGED_AIM_FRAMES,
      motion: FREE_LEAP,
      facesStick: true,
      oncePerAirtime: true,
      helpless: true,
    },
  },
  down: {
    name: "Thunder Clap",
    description: "Raise the hammer and slam: early for a small clap, late for a ring with shockwaves. Shield drops the charge.",
    ground: CHARGED_CLAP,
    air: {
      cost: 20,
      endFrame: 53,
      regions: [heroRegion(18, 21, capsule(10.0, 10.0, f32(SHORT - 14.0), -20.0, 14.0), AIR_CLAP)],
      landingLag: 20,
    },
  },
};
