// Pit Lord's four specials as authored data (smashcraft:docs/design/roster.md,
// "Pit Lord", B specials). The entry tick is frame 1 and "end fN" is the last
// frame of the action. Distances are in the hero reference height H.
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { Character, HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile, frames } from "../heroSpecials";
import type { AppliedStatus } from "../heroStatus";
import { hurtPart, hurtPose } from "../hurtboxes";
import { capsule, hit } from "./pitLordMoves";

const H = HERO_REFERENCE_HEIGHT;
const h = (multiple: number): number => f32(H * f32(multiple));
const perFrame = (distance: number, first: number, last: number): number => f32(distance / (last - first + 1));

/** Non-mobility specials used in the air end on landing with this lag (roster "Action defaults"). */
const AIR_SPECIAL_LANDING_LAG = 24;

/**
 * Fel Spit: a heavy arcing glob, (0.10H, 0.04H) a frame falling 0.003H a
 * frame each frame, 35 frames, radius 0.22H. One at a time, reflectable.
 */
export const FEL_SPIT: SpecialProjectile = {
  spawnFrame: 25, offsetX: h(f32(0.45)), offsetZ: h(f32(0.45)),
  velocityX: h(f32(0.10)), velocityZ: h(f32(0.04)), gravity: h(f32(0.003)),
  life: 35, radius: h(f32(0.22)),
  effect: hit(8.0, "POKE", 40, 1.0, HitElement.fire), reflectable: true, limit: 1,
  model: "Abilities\\Weapons\\ChimaeraAcidMissile\\ChimaeraAcidMissile.mdx",
};

const felSpit = (air: boolean): AuthoredSpecial => ({
  cost: 5, endFrame: 57, projectiles: [FEL_SPIT],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

// Ruin Charge: 1.5H of travel over f19-26, a dead stop, R38. One hit up to 6
// damage is absorbed on f19-24 only; startup and recovery have no armor. It
// stops short of a raised shield or a body instead of carrying through.
// The airborne form travels 0.8H with no armor, once per airtime, and ends helpless.
const CHARGE = hit(15.0, "EDGE", 35, 1.0, HitElement.normal);
const CHARGE_BODY = capsule(10.0, 30.0, 40.0, 80.0, 40.0);
const CHARGE_HURT = [hurtPose(16, 30, [hurtCapsule(Character.pitLord), hurtPart(10.0, 30.0, 40.0, 80.0, 40.0)])];
const chargeMotion = (distance: number): readonly SpecialMotion[] => [
  { ...frames(19, 26), velocityX: perFrame(distance, 19, 26), velocityZ: 0.0, stopsAtBody: true },
  { ...frames(27, 27), velocityX: 0.0, velocityZ: 0.0 },
];
export const RUIN_CHARGE: AuthoredSpecial = {
  cost: 22, endFrame: 64,
  regions: [heroRegion(19, 26, CHARGE_BODY, CHARGE)],
  hurt: CHARGE_HURT,
  motion: chargeMotion(h(f32(1.5))),
  armor: { ...frames(19, 24), maxDamage: 6.0 },
};
const RUIN_CHARGE_AIR: AuthoredSpecial = {
  cost: 22, endFrame: 64,
  regions: [heroRegion(19, 26, CHARGE_BODY, CHARGE)],
  hurt: CHARGE_HURT,
  motion: chargeMotion(h(f32(0.8))),
  oncePerAirtime: true,
  helpless: true,
};

// Abyssal Leap: a slow arcing leap through f32, half of its rise in the f13-18
// hoof window, then easing so the peak stays at the listed height. Full form
// 1.7H up and 0.7H across; the free form 1.2H and 0.4H with no hit.
const leap = (rise: number, drift: number): SpecialMotion[] => {
  const segment = (first: number, last: number, share: number): SpecialMotion =>
    ({ ...frames(first, last), velocityX: f32(f32(drift * share) / (last - first + 1)), velocityZ: f32(f32(rise * share) / (last - first + 1)) });
  return [segment(13, 18, 0.5), segment(19, 28, f32(0.46)), segment(29, 32, f32(0.04))];
};
const LEAP_HOOF = capsule(10.0, 0.0, 40.0, 40.0, 22.0);
const abyssalLeap = (cost: number, rise: number, drift: number, strikes: boolean): AuthoredSpecial => ({
  cost, endFrame: 32,
  regions: strikes ? [heroRegion(13, 18, LEAP_HOOF, hit(10.0, "LAUNCH", 80, 1.0, HitElement.normal))] : undefined,
  motion: leap(rise, drift),
  facesStick: true, oncePerAirtime: true, helpless: true,
});

/**
 * Terror: for 180 frames every hit the target deals does 10 percent less
 * damage. No knockback or hitstun change, no silence; a shield stops it.
 */
export const TERROR: AppliedStatus = { kind: HeroStatusKind.terror, frames: 180, group: HeroStatusGroup.terror, immunityFrames: 0 };

// Howl of Terror: a 1.0H roar around the body on f23-26, R34. The airborne
// form has the same commitment and holds no height (no stall).
const HOWL_REACH = h(1.0);
const HOWL_RADIUS = h(f32(0.5));
const HOWL_HEIGHT = h(f32(0.6));
const howl = (air: boolean): AuthoredSpecial => ({
  cost: 20, endFrame: 60,
  regions: [
    heroRegion(23, 26, capsule(0.0, HOWL_HEIGHT, f32(HOWL_REACH - HOWL_RADIUS), HOWL_HEIGHT, HOWL_RADIUS), hit(5.0, "POKE", 45, 1.0, HitElement.normal)),
    heroRegion(23, 26, capsule(0.0, HOWL_HEIGHT, -f32(HOWL_REACH - HOWL_RADIUS), HOWL_HEIGHT, HOWL_RADIUS), hit(5.0, "POKE", 45, -1.0, HitElement.normal)),
  ],
  strikeStatus: TERROR,
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

export const PIT_LORD_SPECIALS: FighterSpecials = {
  neutral: { name: "Fel Spit", description: "A heavy glob that arcs up and falls onto an approaching target.", ground: felSpit(false), air: felSpit(true) },
  side: { name: "Ruin Charge", description: "A slow charge whose armor shrugs off one light hit; it stops at a shield.", ground: RUIN_CHARGE, air: RUIN_CHARGE_AIR },
  up: { name: "Abyssal Leap", description: "A slow arcing leap with a hoof strike, then a helpless fall.", ground: abyssalLeap(15, h(f32(1.7)), h(f32(0.7)), true), free: abyssalLeap(0, h(f32(1.2)), h(f32(0.4)), false) },
  down: { name: "Howl of Terror", description: "A roar around him; anyone it hits deals less damage for three seconds.", ground: howl(false), air: howl(true) },
};
