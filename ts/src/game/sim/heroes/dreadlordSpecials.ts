// Dreadlord's four specials (smashcraft:docs/design/roster.md "Dreadlord"),
// run by sim/heroSpecialRules.ts. The brief's speeds and reaches are in H, the
// hero reference height; frames count the entry frame as one.
import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, type StrikeCapsule, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, frames } from "../heroSpecials";
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
    model: "Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmMissile.mdx",
    spawnFrame: 20, offsetX: 40.0, offsetZ: 60.0, velocityX: h(f32(0.09)), velocityZ: 0.0, life: 32, radius: h(f32(0.25)),
    effect: dreadlordHit(6.335000038146973, "POKE", 40, 1.0, HitElement.dark), reflectable: true, limit: 1,
  }],
};

// Down B, Sleep (#132, docs/design/kit-review-2.md): a slow orb whose body hit
// sleeps a grounded target 100 frames, an airborne one 24. The sleeper mashes
// out (never before frame 24, sim/heroStatus.ts), any damaging hit wakes it,
// and then it is immune to sleep for 240; a shield stops it.
const SLEEP_ORB: AuthoredSpecial = {
  cost: 25,
  endFrame: 58,
  projectiles: [{
    model: "Abilities\\Weapons\\VoidWalkerMissile\\VoidWalkerMissile.mdx",
    spawnFrame: 26, offsetX: 40.0, offsetZ: 60.0, velocityX: h(f32(0.06)), velocityZ: 0.0, life: 50, radius: h(f32(0.18)),
    effect: { damage: 1.8100000619888306, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.dark },
    reflectable: true, limit: 1,
    status: { kind: HeroStatusKind.sleep, frames: 100, airFrames: 24, group: HeroStatusGroup.sleep, immunityFrames: 240 },
  }],
};

// Side B, Vampiric Pounce (#132). Grounded: a 0.8H approach that stops at a
// body or shield, then a 0.45H command grab on frames 17-19; a catch bites and
// releases 16 frames later, healing him 4% (at most 12 a stock), then
// recovers for 28. Side special again on approach frames 3-12 feints: a free
// bat-hop 0.7H back over its frames 1-10, ending on frame 18. Airborne: a claw
// strike, once per airtime, ending helpless.
const POUNCE_GRAB: StrikeCapsule = { x1: 14.0, z1: 40.0, x2: f32(h(f32(0.45)) - 12.0), z2: 40.0, radius: 12.0 };
const POUNCE_BITE = dreadlordHit(11.765000343322754, "EDGE", 40);
const POUNCE_CLAW = [heroRegion(17, 19, { x1: 18.0, z1: 46.0, x2: f32(h(f32(0.8)) - 10.0), z2: 40.0, radius: 10.0 }, POUNCE_BITE)];
/** The feint's hop spreads his wings, which stay his body. */
const SPREAD_WINGS_FEINT = [hurtPose(1, 18, [
  ...DREADLORD_STAND,
  hurtPart(-14.0, 85.0, -60.0, 125.0, 16.0),
  hurtPart(14.0, 85.0, 44.0, 125.0, 14.0),
])];
const POUNCE_FEINT: AuthoredSpecial = {
  cost: 0,
  endFrame: 18,
  motion: [{ ...frames(1, 10), velocityX: -perFrame(h(f32(0.7)), 10), velocityZ: 0.0 }, { ...frames(11, 11), velocityX: 0.0, velocityZ: 0.0 }],
  hurt: SPREAD_WINGS_FEINT,
};
const NIGHT_POUNCE: AuthoredSpecial = {
  cost: 20,
  endFrame: 53,
  motion: [{ ...frames(1, 16), velocityX: perFrame(h(f32(0.8)), 16), velocityZ: 0.0, stopsAtBody: true }],
  commandGrab: { ...frames(17, 19), strike: POUNCE_GRAB, holdFrames: 16, effect: POUNCE_BITE, recovery: 28, heal: { heal: 4.0, capPerStock: 12.0 } },
  followUps: [{ window: frames(3, 12), special: POUNCE_FEINT }],
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
    motion: [{ ...frames(9, 32), velocityX: 0.0, velocityZ: perFrame(h(rise), 24), driftSpeed: perFrame(h(across), 24) }],
    oncePerAirtime: true,
    helpless: true,
    hurt: SPREAD_WINGS,
  };
}

export const DREADLORD_SPECIALS: FighterSpecials = {
  neutral: { name: "Carrion Swarm", description: "A short, slow cloud of bats.", ground: CARRION_SWARM, air: { ...CARRION_SWARM, landingLag: AIR_LANDING_LAG } },
  side: { name: "Vampiric Pounce", description: "Lunge and grab with a healing bite; press again early to hop back instead.", ground: NIGHT_POUNCE, air: NIGHT_POUNCE_AIR },
  up: { name: "Bat Ascension", description: "A steerable rise on bat wings, then a helpless fall.", ground: batAscension(15, 2.0, f32(0.8)), free: batAscension(0, f32(1.4), f32(0.3)) },
  down: { name: "Sleep", description: "A slow orb that puts a grounded target to sleep until it mashes out or is hit.", ground: SLEEP_ORB, air: { ...SLEEP_ORB, landingLag: AIR_LANDING_LAG } },
};
