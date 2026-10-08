// Dreadlord's four specials (smashcraft:docs/design/roster.md "Dreadlord"),
// run by sim/heroSpecialRules.ts. The brief's speeds and reaches are in H, the
// hero reference height; frames count the entry frame as one.
import { withExKit } from "../exSpecialAuthoring";
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
  endFrame: 58,
  projectiles: [{
    model: "Abilities\\Weapons\\VoidWalkerMissile\\VoidWalkerMissile.mdx",
    spawnFrame: 26, offsetX: 40.0, offsetZ: 60.0, velocityX: h(f32(0.06)), velocityZ: 0.0, life: 50, radius: h(f32(0.18)),
    effect: { damage: 1.8100000619888306, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.dark },
    reflectable: true, limit: 1,
    status: { kind: HeroStatusKind.sleep, frames: 100, airFrames: 24, group: HeroStatusGroup.sleep, immunityFrames: 240 },
  }],
};

// The corkscrew stops short of bodies so its bite can catch without passing
// through them. On a miss the last 34 frames expose the landing/recovery.
const POUNCE_GRAB: StrikeCapsule = { x1: 14.0, z1: 40.0, x2: f32(h(f32(0.45)) - 12.0), z2: 40.0, radius: 12.0 };
const POUNCE_BITE = dreadlordHit(10.000250816345215, "EDGE", 40);
const NIGHT_POUNCE: AuthoredSpecial = {
  endFrame: 53,
  motion: [{ ...frames(1, 16), velocityX: h(f32(0.14)), velocityZ: 0.0, stopsAtBody: true }, { ...frames(17, 17), velocityX: 0.0, velocityZ: 0.0 }],
  commandGrab: { ...frames(17, 19), strike: POUNCE_GRAB, holdFrames: 16, effect: POUNCE_BITE, recovery: 28, heal: { heal: 4.0 } },
  hurt: dreadlordLimbPoses([heroRegion(17, 19, POUNCE_GRAB, POUNCE_BITE)], 53, 1),
};
const NIGHT_POUNCE_AIR: AuthoredSpecial = {
  ...NIGHT_POUNCE,
  oncePerAirtime: true,
  helpless: true,
  landingLag: AIR_LANDING_LAG,
};

// Up B, Bat Ascension, a guided rise (#189): steered by the held stick,
// with no hitbox, wings spread as part
// of his body throughout and no intangibility; helpless after.
const SPREAD_WINGS = [hurtPose(9, 32, [
  ...DREADLORD_STAND,
  hurtPart(-14.0, 85.0, -60.0, 125.0, 16.0),
  hurtPart(14.0, 85.0, 44.0, 125.0, 14.0),
])];
function batAscension(rise: number, across: number): AuthoredSpecial {
  return {
    endFrame: 32,
    motion: [{ ...frames(9, 32), velocityX: 0.0, velocityZ: perFrame(h(rise), 24), driftSpeed: perFrame(h(across), 24) }],
    oncePerAirtime: true,
    helpless: true,
    hurt: SPREAD_WINGS,
  };
}

export const DREADLORD_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Carrion Swarm", description: "A short, slow cloud of bats.", ground: CARRION_SWARM, air: { ...CARRION_SWARM, landingLag: AIR_LANDING_LAG } }, { reach: 1.25 }),
  side: withExKit({ name: "Vampiric Pounce", description: "Corkscrew forward with trailing bats; bite and heal on a catch, recover on a miss.", ground: NIGHT_POUNCE, air: NIGHT_POUNCE_AIR }, { damage: 1.25 }),
  up: withExKit({ name: "Bat Ascension", description: "A steerable rise on bat wings, then a helpless fall.", ground: batAscension(f32(2.9), f32(2.2)) }, { travel: 1.25 }),
  down: withExKit({ name: "Sleep", description: "A slow orb that puts a grounded target to sleep until it mashes out or is hit.", ground: SLEEP_ORB, air: { ...SLEEP_ORB, landingLag: AIR_LANDING_LAG } }, { reach: 1.25 }),
};
