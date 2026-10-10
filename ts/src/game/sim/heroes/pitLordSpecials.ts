


import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { Character, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile, frames, recovery, still } from "../heroSpecials";
import { hurtPart, hurtPose } from "../hurtboxes";
import { capsule, hit } from "./pitLordMoves";

const H = HERO_REFERENCE_HEIGHT;
const h = (multiple: number): number => f32(H * f32(multiple));
const perFrame = (distance: number, first: number, last: number): number => f32(distance / (last - first + 1));


const AIR_SPECIAL_LANDING_LAG = 24;

const meteor = (spawnFrame: number, offset: number): SpecialProjectile => ({
  spawnFrame, offsetX: h(offset), offsetZ: h(f32(2.8)),
  velocityX: 0.0, velocityZ: -h(f32(0.16)),
  life: 24, radius: h(f32(0.22)),
  effect: hit(5.275000095367432, "POKE", 70, 1.0, HitElement.fire), reflectable: true, limit: 1,
  model: "Abilities\\Weapons\\DemolisherFireMissile\\DemolisherFireMissile.mdx",
});

const RAIN_OF_FIRE = [meteor(25, f32(1.8)), meteor(31, f32(2.2)), meteor(37, f32(2.6))] as const;
const rain = (air: boolean): AuthoredSpecial => ({
  endFrame: 60, projectiles: RAIN_OF_FIRE,
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});





const CHARGE = hit(15.824999809265137, "EDGE", 35, 1.0, HitElement.normal);
const CHARGE_BODY = capsule(10.0, 30.0, 40.0, 80.0, 40.0);
const CHARGE_HURT = [hurtPose(16, 30, [hurtCapsule(Character.pitLord), hurtPart(10.0, 30.0, 40.0, 80.0, 40.0)])];
const chargeMotion = (distance: number): readonly SpecialMotion[] => [
  { ...frames(19, 26), velocityX: perFrame(distance, 19, 26), velocityZ: 0.0, stopsAtBody: true },
  still(27, 27),
];
const RUIN_CHARGE: AuthoredSpecial = {
  endFrame: 64,
  regions: [heroRegion(19, 26, CHARGE_BODY, CHARGE)],
  hurt: CHARGE_HURT,
  motion: chargeMotion(h(f32(1.5))),
  armor: { ...frames(19, 24), maxDamage: 6.0 },
};
const RUIN_CHARGE_AIR = recovery({
  endFrame: 64,
  regions: [heroRegion(19, 26, CHARGE_BODY, CHARGE)],
  hurt: CHARGE_HURT,
  motion: chargeMotion(h(f32(0.8))),
});





const leap = (rise: number, drift: number, steer: number): SpecialMotion[] => {
  const segment = (first: number, last: number, share: number): SpecialMotion =>
    ({
      ...frames(first, last), velocityX: f32(f32(drift * share) / (last - first + 1)), velocityZ: f32(f32(rise * share) / (last - first + 1)),
      driftSpeed: f32(f32(steer * share) / (last - first + 1)),
    });
  return [segment(13, 18, 0.5), segment(19, 28, f32(0.46)), segment(29, 32, f32(0.04))];
};
const LEAP_HOOF = capsule(10.0, 0.0, 40.0, 40.0, 22.0);
const abyssalLeap = (rise: number, drift: number, steer: number): AuthoredSpecial => recovery({
  endFrame: 32,
  regions: [heroRegion(13, 18, LEAP_HOOF, hit(10.550000190734863, "LAUNCH", 80, 1.0, HitElement.normal))],
  motion: leap(rise, drift, steer),
  facesStick: true,
});



const HOWL_REACH = h(1.0);
const HOWL_RADIUS = h(f32(0.5));
const HOWL_HEIGHT = h(f32(0.6));
const howl = (air: boolean): AuthoredSpecial => ({
  endFrame: 46,
  regions: [
    heroRegion(15, 18, capsule(0.0, HOWL_HEIGHT, f32(HOWL_REACH - HOWL_RADIUS), HOWL_HEIGHT, HOWL_RADIUS), hit(7.385000228881836, "POKE", 35, 1.0, HitElement.normal)),
    heroRegion(15, 18, capsule(0.0, HOWL_HEIGHT, -f32(HOWL_REACH - HOWL_RADIUS), HOWL_HEIGHT, HOWL_RADIUS), hit(7.385000228881836, "POKE", 35, -1.0, HitElement.normal)),
  ],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

export const PIT_LORD_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Howl of Terror", description: "A close roar pushes enemies away on both sides; a shield stops it.", ground: howl(false), air: howl(true) }, { reach: 1.25 }),
  side: withExKit({ name: "Ruin Charge", description: "A slow charge whose armor shrugs off one light hit; it stops at a shield.", ground: RUIN_CHARGE, air: RUIN_CHARGE_AIR }, { damage: 1.25 }),
  up: withExKit({ name: "Abyssal Leap", description: "A slow arcing leap you steer, with a hoof strike, then a helpless fall.", ground: abyssalLeap(h(f32(3.5)), h(f32(0.5)), h(f32(1.15))) }, { travel: 1.25 }),
  down: withExKit({ name: "Rain of Fire", description: "Three waves of fire fall ahead; rush underneath or tilt your shield up.", ground: rain(false), air: rain(true) }, { damage: 1.25 }),
};
