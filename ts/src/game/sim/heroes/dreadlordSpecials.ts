// Dreadlord's four specials (smashcraft:docs/design/roster.md "Dreadlord"),
// run by sim/heroSpecialRules.ts. The brief's speeds and reaches are in H, the
// hero reference height; frames count the entry frame as one.
import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, type StrikeCapsule, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, ROSTER_MANA, frames } from "../heroSpecials";
import { hurtPart, hurtPose } from "../hurtboxes";
import { DREADLORD_STAND, dreadlordHit, dreadlordLimbPoses } from "./dreadlordMoves";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));
const perFrame = (distance: number, frameCount: number): number => f32(distance / frameCount);
/** Non-mobility specials used in the air end on landing with this lag (roster "Action defaults"). */
const AIR_LANDING_LAG = 20;

// Neutral B, Carrion Swarm: one short reflectable bat cloud.
const CARRION_SWARM: AuthoredSpecial = {
  cost: 5,
  endFrame: 45,
  projectiles: [{
    spawnFrame: 20, offsetX: 40.0, offsetZ: 60.0, velocityX: h(0.09), velocityZ: 0.0, life: 32, radius: h(0.25),
    effect: dreadlordHit(7.0, "POKE", 40), reflectable: true, limit: 1,
  }],
};

// Down B, Sleep Orb: a slow orb whose body hit sleeps the target for 20 frames,
// then leaves it immune to sleep for 180; a shield stops it.
const SLEEP_ORB: AuthoredSpecial = {
  cost: 25,
  endFrame: 58,
  projectiles: [{
    spawnFrame: 26, offsetX: 40.0, offsetZ: 60.0, velocityX: h(0.06), velocityZ: 0.0, life: 35, radius: h(0.18),
    effect: { damage: 2.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.normal },
    reflectable: true, limit: 1,
    status: { kind: HeroStatusKind.sleep, frames: 20, group: HeroStatusGroup.sleep, immunityFrames: 180 },
  }],
};

// Side B, Night Pounce. Grounded: a 0.8H approach that stops at a body or
// shield, then a 0.45H command grab on frames 17-19; a catch bites and
// releases 16 frames later, then recovers for 28. Airborne: a claw strike,
// once per airtime, ending helpless.
const POUNCE_GRAB: StrikeCapsule = { x1: 14.0, z1: 40.0, x2: f32(h(0.45) - 12.0), z2: 40.0, radius: 12.0 };
const POUNCE_BITE = dreadlordHit(9.0, "EDGE", 40);
const POUNCE_CLAW = [heroRegion(17, 19, { x1: 18.0, z1: 46.0, x2: f32(h(0.8) - 10.0), z2: 40.0, radius: 10.0 }, POUNCE_BITE)];
const NIGHT_POUNCE: AuthoredSpecial = {
  cost: 20,
  endFrame: 53,
  motion: [{ ...frames(1, 16), velocityX: perFrame(h(0.8), 16), velocityZ: 0.0, stopsAtBody: true }],
  commandGrab: { ...frames(17, 19), strike: POUNCE_GRAB, holdFrames: 16, effect: POUNCE_BITE, recovery: 28 },
  hurt: dreadlordLimbPoses([heroRegion(17, 19, POUNCE_GRAB, POUNCE_BITE)], 53, 1),
};
const NIGHT_POUNCE_AIR: AuthoredSpecial = {
  cost: 20,
  endFrame: 53,
  regions: POUNCE_CLAW,
  oncePerAirtime: true,
  helpless: true,
  landingLag: AIR_LANDING_LAG,
  hurt: dreadlordLimbPoses(POUNCE_CLAW, 53, 1),
};

// Up B, Bat Ascension: a steerable rise with no hitbox, wings spread as part
// of his body throughout and no intangibility; helpless after. The free form
// rises 1.4H and steers 0.3H instead of 2.0H and 0.8H.
const SPREAD_WINGS = [hurtPose(9, 32, [
  ...DREADLORD_STAND,
  hurtPart(-14.0, 85.0, -60.0, 125.0, 16.0),
  hurtPart(14.0, 85.0, 44.0, 125.0, 14.0),
])];
function batAscension(cost: number, rise: number, across: number): AuthoredSpecial {
  return {
    cost,
    endFrame: 32,
    motion: [{ ...frames(9, 32), velocityX: 0.0, velocityZ: perFrame(h(rise), 24), steerX: perFrame(h(across), 24) }],
    oncePerAirtime: true,
    helpless: true,
    hurt: SPREAD_WINGS,
  };
}

export const DREADLORD_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: CARRION_SWARM, air: { ...CARRION_SWARM, landingLag: AIR_LANDING_LAG } },
  side: { ground: NIGHT_POUNCE, air: NIGHT_POUNCE_AIR },
  up: { ground: batAscension(15, 2.0, 0.8), free: batAscension(0, 1.4, 0.3) },
  down: { ground: SLEEP_ORB, air: { ...SLEEP_ORB, landingLag: AIR_LANDING_LAG } },
};
