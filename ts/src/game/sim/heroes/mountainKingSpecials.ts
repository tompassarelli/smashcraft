import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { Character, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, type MoveRegion, heroRegion } from "../heroMoves";
import { hurtPart, hurtPose } from "../hurtboxes";
import { type AuthoredSpecial, type FighterSpecials, type SpecialKit, type SpecialMotion, type SpecialProjectile, CHARGED_AIM_FRAMES, FollowUpInput, chargedAngleMotion, frames } from "../heroSpecials";
import { MEDIUM, SHORT, capsule, hit } from "./mountainKingMoves";




const H = HERO_REFERENCE_HEIGHT;
const heights = (amount: number) => f32(H * f32(amount));




const BOLT_SPEED = heights(f32(0.12));
const BOLT_RETURN = { age: 45, speed: heights(f32(0.14)) };

const BOLT_RECALL: AuthoredSpecial = { endFrame: 10, recallsProjectiles: true, landingLag: 10 };
const BOLT_RADIUS = heights(f32(0.18));
const STORM_BOLT = hit(5.403449535369873, "LAUNCH", 65, false, HitElement.electric);


const RUSH_FRAMES = 6;
const RUSH_SPEED = f32(heights(f32(1.2)) / RUSH_FRAMES);
const STORM_RUSH = { ...hit(12.968278884887695, "EDGE", 35), growth: f32(88.4) };
const RUSH: readonly SpecialMotion[] = [{ ...frames(13, 18), velocityX: RUSH_SPEED, velocityZ: 0.0, stopsAtBody: true }, { ...frames(19, 19), velocityX: 0.0, velocityZ: 0.0 }];
const RUSH_BODY = capsule(0.0, 14.0, 12.0, 60.0, 26.0);

const RUSH_HURT = [hurtPose(13, 18, [hurtCapsule(Character.mountainKing), hurtPart(RUSH_BODY.x1, RUSH_BODY.z1, RUSH_BODY.x2, RUSH_BODY.z2, RUSH_BODY.radius)])];





const leap = (distance: number): readonly SpecialMotion[] => chargedAngleMotion(distance, 16);
const FULL_LEAP = leap(heights(f32(2.7)));
const THUNDER_LEAP = hit(8.645519256591797, "LAUNCH", 80, false, HitElement.electric);
const LEAP_HAMMER = capsule(10.0, 60.0, 30.0, f32(MEDIUM + 20.0), 16.0);





const PLUNGE = heights(f32(0.16));
const HAMMERFALL: AuthoredSpecial = {
  name: "Hammerfall",

  endFrame: 70,
  motion: [{ ...frames(1, 3), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(4, 70), velocityX: 0.0, velocityZ: -PLUNGE }],
  regions: [heroRegion(4, 70, capsule(4.0, 10.0, 4.0, -24.0, 20.0), hit(12.968278884887695, "SPIKE", 270, false, HitElement.electric), hit(10.806899070739746, "LAUNCH", 55, false, HitElement.electric))],
  landingLag: 24,
  helpless: true,
};







const CLAP_REACH = heights(f32(0.85));
const ring = (first: number, damage: number): readonly MoveRegion[] => [
  heroRegion(first, first + 3, capsule(0.0, 14.0, f32(CLAP_REACH - 16.0), 14.0, 16.0), hit(damage, "LAUNCH", 70, false, HitElement.electric)),
  heroRegion(first, first + 3, capsule(0.0, 14.0, -f32(CLAP_REACH - 16.0), 14.0, 16.0), hit(damage, "LAUNCH", 70, true, HitElement.electric)),
];
const WAVE_SPEED = heights(f32(0.10));
const wave = (spawnFrame: number, sign: number): SpecialProjectile => ({
  model: "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx",
  spawnFrame, offsetX: f32(sign * CLAP_REACH), offsetZ: 14.0, velocityX: f32(sign * WAVE_SPEED), velocityZ: 0.0, activeFrom: 6,
  life: 24, radius: 16.0, effect: hit(7.5648298263549805, "LAUNCH", 75, false, HitElement.electric), reflectable: true, limit: 1,
});
const WAVES = (spawnFrame: number) => [wave(spawnFrame, 1), wave(spawnFrame, -1)];

const CLAP: AuthoredSpecial = { name: "Small Clap", endFrame: 28, regions: ring(4, 9.72620964050293) };

const THUNDER_CLAP: AuthoredSpecial = { endFrame: 32, regions: ring(4, 12.968278884887695), projectiles: WAVES(4) };

const HOLD: AuthoredSpecial = { endFrame: 1 };
const CHARGED_CLAP: AuthoredSpecial = {
  endFrame: 81,
  regions: ring(53, 12.968278884887695),
  projectiles: WAVES(53),
  followUps: [
    { window: frames(10, 29), special: CLAP },
    { window: frames(30, 49), special: THUNDER_CLAP },
    { window: frames(10, 49), input: FollowUpInput.shield, special: HOLD },
  ],
};

const AIR_CLAP = hit(10.806899070739746, "LAUNCH", 70, false, HitElement.electric);


function withHammerfallEx(kit: SpecialKit): SpecialKit {
  const upgraded = withExKit(kit, { travel: 1.25 });
  const ex = upgraded.ground.ex;
  if (ex === undefined) return upgraded;
  return { ...upgraded, ground: { ...upgraded.ground, ex: { ...ex,
    followUps: ex.followUps?.map(branch => ({ ...branch,
      special: withExKit({ ...kit, ground: branch.special }, { damage: 1.25 }).ground.ex ?? branch.special,
    })),
  } } };
}

export const MOUNTAIN_KING_SPECIALS: FighterSpecials = {
  neutral: withExKit({
    name: "Storm Bolt",
    description: "A hammer that flies out and back, hitting toward him on the return; press again to call it back.",
    ground: {
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
  }, { damage: 1.25 }),
  side: withExKit({
    name: "Storm Rush",
    description: "A shoulder charge that stops dead at a body or shield.",
    ground: {
      endFrame: 46,
      regions: [heroRegion(13, 18, RUSH_BODY, STORM_RUSH)],
      hurt: RUSH_HURT,
      motion: RUSH,
    },
    air: {
      endFrame: 46,
      regions: [heroRegion(13, 18, RUSH_BODY, STORM_RUSH)],
      hurt: RUSH_HURT,
      motion: RUSH,
      oncePerAirtime: true,
      helpless: true,
    },
  }, { damage: 1.25 }),
  up: withHammerfallEx({
    name: "Thunder Leap",
    description: "Hold a direction as he crouches, then a hammer leap that way; press special at the top to plunge down as Hammerfall.",
    ground: {
      endFrame: 28,
      regions: [heroRegion(9, 14, LEAP_HAMMER, THUNDER_LEAP)],
      aimFrames: CHARGED_AIM_FRAMES,
      motion: FULL_LEAP,
      facesStick: true,
      oncePerAirtime: true,
      helpless: true,
      followUps: [{ window: frames(16, 28), special: HAMMERFALL }],
    },

  }),
  down: withExKit({
    name: "Thunder Clap",
    description: "Raise the hammer and slam: early for a small clap, late for a ring with shockwaves. Shield drops the charge.",
    ground: CHARGED_CLAP,
    air: {
      endFrame: 53,
      regions: [heroRegion(18, 21, capsule(10.0, 10.0, f32(SHORT - 14.0), -20.0, 14.0), AIR_CLAP)],
      landingLag: 20,
    },
  }, { reach: 1.25 }),
};
