import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { igniteStatus, soakStatus } from "../../sim/soak";
import { type AuthoredSpecial, type FighterSpecials, FollowUpInput, type SpecialCharge, type SpecialFollowUp, frames } from "../../sim/specials/schema";
import { chenCapsule, chenHit } from "./moves";

export const KEG_CHARGE: SpecialCharge = { hold: 10, full: 45, stages: 3, drops: true };
export const KEG_STAGES = [0, 1, 2, 3] as const;
export const KEG_SOAK_FRAMES = [120, 180, 240, 300] as const;
export const KEG_SLOW_FRAMES = [30, 50, 70, 90] as const;
const KEG_DAMAGE = [3.0, 4.0, 5.0, 6.0] as const;
export const IGNITE_DAMAGE = [0.0, 3.0, 5.0, 7.0, 10.0] as const;
export const IGNITE_BURN_FRAMES = [0, 60, 90, 120, 180] as const;
export const IGNITE_BURN_EVERY = 20;

export const chenSoak = (level: number) => soakStatus(level, KEG_SOAK_FRAMES[level - 1] ?? 120, KEG_SLOW_FRAMES[level - 1] ?? 30);

export const CHEN_IGNITE = igniteStatus(IGNITE_DAMAGE, IGNITE_BURN_FRAMES, IGNITE_BURN_EVERY, 1.0);

const electric = (effect: ReturnType<typeof chenHit>): ReturnType<typeof chenHit> => ({ ...effect, electric: true });

const fire = chenHit(6.0, 55.0, 20.0, f32(0.906308), f32(0.422618), HitElement.fire);
export const BREATH_MOUTH = { x: 58.0, groundZ: 96.0, airZ: 92.0 } as const;
const breath = (air: boolean): AuthoredSpecial => {
  const z = air ? BREATH_MOUTH.airZ : BREATH_MOUTH.groundZ;
  return {
    endFrame: 48, landingLag: air ? 20 : undefined, strikeStatus: CHEN_IGNITE,
    regions: [
      heroRegion(18, 28, chenCapsule(BREATH_MOUTH.x, z, 98.0, z - 5.0, 27.0), fire),
      heroRegion(18, 28, chenCapsule(98.0, z - 5.0, 152.0, z - 11.0, 40.0), fire),
      heroRegion(18, 28, chenCapsule(152.0, z - 11.0, 206.0, z - 18.0, 55.0), fire),
      heroRegion(18, 28, chenCapsule(206.0, z - 18.0, 260.0, z - 26.0, 70.0), fire),
    ],
  };
};

export const BODY_SLAM_FIRST = 10;
export const BODY_SLAM_LAST = 24;
const BODY_SLAM_GROWTH = 60.0;
const slam = { ...chenHit(9.0, BODY_SLAM_GROWTH, 50.0, f32(0.173648), f32(0.984808)), damage: f32(9.0 * 1.25), growth: BODY_SLAM_GROWTH };
export const BODY_SLAM_LANDED_END = 14;
const slamLanded = (air: boolean): AuthoredSpecial => ({ name: "Body Slam", endFrame: BODY_SLAM_LANDED_END, landingLag: air ? 10 : undefined,
  motion: [{ ...frames(1, 4), velocityX: 0.0, velocityZ: 0.0 }] });
const bodySlam = (air: boolean): AuthoredSpecial => ({
  endFrame: 50, landingLag: air ? 22 : undefined, oncePerAirtime: air ? true : undefined, facesStick: true,
  motion: [
    { ...frames(1, BODY_SLAM_FIRST - 1), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(BODY_SLAM_FIRST, BODY_SLAM_LAST), velocityX: 9.0, velocityZ: 0.0, stopsAtBody: true, stopsAtShield: true },
  ],
  regions: [heroRegion(BODY_SLAM_FIRST, BODY_SLAM_LAST, chenCapsule(14.0, 46.0, 58.0, 50.0, 26.0), slam)],
  followUps: [{ window: frames(BODY_SLAM_FIRST, BODY_SLAM_LAST + 1), input: FollowUpInput.contact, special: slamLanded(air) }],
});

const kegThrow = (stage: number, air: boolean): AuthoredSpecial => ({
  name: "Keg Toss", endFrame: 24, landingLag: air ? 18 : undefined, spendsCharge: true,
  projectiles: [{ spawnFrame: 6, offsetX: 30.0, offsetZ: 74.0, velocityX: f32(5.0 + 0.5 * stage), velocityZ: 5.5, gravity: f32(0.35),
    life: 70, radius: f32(20.0 + 3.0 * stage), effect: chenHit(KEG_DAMAGE[stage] ?? 3.0, 40.0, 30.0, f32(0.707107), f32(0.707107)), reflectable: true, limit: 1,
    model: "Abilities\\Spells\\Other\\StrongDrink\\BrewmasterMissile.mdx", modelRadius: f32(20.0 + 3.0 * stage), status: chenSoak(stage + 1) }],
});
const KEG_WINDOW = frames(1, KEG_CHARGE.hold + 1);
const keg = (air: boolean): AuthoredSpecial => ({
  name: "Brew Keg", endFrame: KEG_CHARGE.hold + 2, landingLag: air ? 18 : undefined, charge: KEG_CHARGE,
  followUps: KEG_STAGES.map((stage): SpecialFollowUp => ({ window: KEG_WINDOW, chargeStage: stage, special: kegThrow(stage, air) })),
});

const storm = electric(chenHit(7.49616003036499, 80.0, 27.878604888916016, f32(0.34202), f32(0.939693), HitElement.electric));
const stormRise = (height: number, drift: number): AuthoredSpecial => ({
  endFrame: 40, oncePerAirtime: true, parasol: true, facesStick: true,
  motion: [{ ...frames(1, 7), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(8, 29), velocityX: 0.0, velocityZ: f32(f32(HERO_REFERENCE_HEIGHT * height) / 22.0), driftSpeed: f32(f32(HERO_REFERENCE_HEIGHT * drift) / 22.0) }],
  regions: [heroRegion(8, 22, chenCapsule(0.0, 42.0, 0.0, 106.0, 42.0), storm),
    heroRegion(8, 22, chenCapsule(-150.0, 142.0, 140.0, 142.0, 12.0), storm)],
});

export const CHEN_SPECIALS: FighterSpecials = {
  neutral: { name: "Breath of Fire", description: "Breathe a long, fanning cone of flame; a soaked foe takes extra damage and burns.", ground: breath(false), air: breath(true) },
  side: { name: "Body Slam", description: "Belly-charge forward; stop at the first body or shield and pop the foe up. A miss leaves him open.", ground: bodySlam(false), air: bodySlam(true) },
  up: { name: "Storm Rise", description: "Rise in a crackling storm, then open the parasol: float and steer, hold down to close it and up to open it again, and swing one aerial before falling helplessly.", ground: stormRise(f32(3.0), 1.0) },
  down: { name: "Brew Keg", description: "Pour ale into the keg in three glugs, then press special to lob it; a fuller keg slows and soaks longer and feeds Breath of Fire more.", ground: keg(false), air: keg(true) },
};
