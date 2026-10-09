import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "../codes";
import { heroRegion, type StrikeCapsule } from "../heroMoves";
import { withExKit } from "../exSpecialAuthoring";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialCompanion, type SpecialKit, type SpecialPlacement, type SpecialProjectile } from "../heroSpecials";
import type { AppliedStatus } from "../heroStatus";
import { kaelCastBody, kaelHit } from "./kaelthasMoves";

const AIR_LANDING_LAG = 20;

export const KAEL_PILLAR: SpecialProjectile = {
  model: "Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx", modelRadius: 40.0,
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: 12, activeFrom: 13, radius: 40.0, effect: kaelHit(12.0, 80, 95.0, 30.0),
  reflectable: false, limit: 1,
};
export const KAEL_FLAME_BOLT: SpecialProjectile = {
  model: "Abilities\\Weapons\\PhoenixMissile\\Phoenix_Missile.mdx",
  spawnFrame: 16, offsetX: 40.0, offsetZ: 55.0, velocityX: 9.0, velocityZ: 0.0,
  life: 34, radius: 16.0, effect: KAEL_PILLAR.effect, homing: { turn: f32(0.35), maxRise: 4.0 }, burstInto: KAEL_PILLAR,
  reflectable: true, limit: 1, needsLineOfSight: true,
};
const flamestrike = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 38, cooldownFrames: 40, landingLag, hurt: kaelCastBody(8, 26, 40.0, 66.0), projectiles: [KAEL_FLAME_BOLT],
});

const DRAIN_BEAM: StrikeCapsule = { x1: 30.0, z1: 60.0, x2: 120.0, z2: 60.0, radius: 18.0 };
const drainMana = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 38, landingLag, hurt: kaelCastBody(6, 20, 46.0, 60.0),
  commandGrab: { ...frames(10, 13), strike: DRAIN_BEAM, holdFrames: 18, effect: { ...kaelHit(4.0, 40, 40.0, 40.0), manaSteal: 30 }, recovery: 16 },
});

export const BANISH: AppliedStatus = { kind: HeroStatusKind.banish, frames: 90, group: HeroStatusGroup.silence, immunityFrames: 240 };
const CURSE: StrikeCapsule = { x1: 25.0, z1: 62.0, x2: 110.0, z2: 62.0, radius: 20.0 };
const banish = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 36, landingLag, hurt: kaelCastBody(8, 22, 46.0, 62.0),
  regions: [heroRegion(12, 14, CURSE, kaelHit(3.0, 35, 0.0, 30.0))], strikeStatus: BANISH,
});

export const PHOENIX_CHARGE_FRAMES = 42;
export const PHOENIX_FLIGHT_FRAMES = 30;
export const PHOENIX_SPEED = 16.0;
const SWIRL: StrikeCapsule = { x1: -20.0, z1: 55.0, x2: 20.0, z2: 55.0, radius: 42.0 };
const BIRD: StrikeCapsule = { x1: -24.0, z1: 55.0, x2: 24.0, z2: 55.0, radius: 32.0 };
const swirl = kaelHit(2.0, 80, 0.0, 30.0);
const phoenix = (speed: number): AuthoredSpecial => ({
  endFrame: 84, aimFrames: PHOENIX_CHARGE_FRAMES, rehitFrames: [26, 32, 38, PHOENIX_CHARGE_FRAMES + 1], oncePerAirtime: true, helpless: true, landingLag: 18,
  motion: [
    { ...frames(1, 15), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(16, PHOENIX_CHARGE_FRAMES), velocityX: 0.0, velocityZ: -0.5 },
    { ...frames(PHOENIX_CHARGE_FRAMES + 1, PHOENIX_CHARGE_FRAMES + PHOENIX_FLIGHT_FRAMES), velocityX: 0.0, velocityZ: speed, aimedSpeed: speed, liftSpeed: 3.5 },
  ],
  regions: [
    heroRegion(20, 21, SWIRL, swirl), heroRegion(26, 27, SWIRL, swirl), heroRegion(32, 33, SWIRL, swirl), heroRegion(38, 39, SWIRL, swirl),
    heroRegion(43, 52, BIRD, kaelHit(12.0, 55, 80.0, 40.0)), heroRegion(53, 72, BIRD, kaelHit(6.0, 70, 60.0, 30.0)),
  ],
});

const PHOENIX_AURA: SpecialProjectile = {
  model: "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx",
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: 6, radius: 70.0, effect: kaelHit(4.0, 70, 40.0, 30.0), reflectable: false, limit: 3,
};
const SUMMONED_PHOENIX: SpecialCompanion = {
  behavior: "flying", followSpeed: 9.0, followBehind: -60.0, followHeight: 110.0, returnSpeed: 12.0,
  lungeStartup: 6, lungeActive: 6, lungeRecovery: 20, lungeTravel: 0.0,
  bite: { x1: -20.0, z1: 0.0, x2: 20.0, z2: 0.0, radius: 30.0 }, biteEffect: kaelHit(4.0, 70, 40.0, 30.0),
  stunFrames: 30, leash: 600.0, leashFrames: 60,
};
export const SUMMON_PHOENIX: SpecialPlacement = {
  frame: PHOENIX_CHARGE_FRAMES + PHOENIX_FLIGHT_FRAMES + 1, offsetX: -40.0, offsetZ: 110.0, radius: 30.0, height: 60.0,
  durability: 12.0, life: 180, fireAges: [30, 60, 90, 120, 150, 178], shot: PHOENIX_AURA, companion: SUMMONED_PHOENIX,
  model: { path: "units\\human\\Phoenix\\Phoenix.mdl", height: 110.0, alpha: 255 },
};

function withSummonedPhoenix(kit: SpecialKit): SpecialKit {
  const ex = kit.ground.ex;
  return ex === undefined ? kit : { ...kit, ground: { ...kit.ground, ex: { ...ex, placement: SUMMON_PHOENIX } } };
}

export const KAELTHAS_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Flamestrike", description: "A fire bolt that drifts toward the enemy and bursts into a pillar of flame on contact. Shield or reflect it.",
    ground: flamestrike(undefined), air: flamestrike(AIR_LANDING_LAG) }, { damage: 1.25 }),
  side: withExKit({ name: "Drain Mana", description: "A short tether that grabs through shields and drinks the victim's meter. Jump or dodge it.",
    ground: drainMana(undefined), air: drainMana(AIR_LANDING_LAG) }, { damage: 1.25 }),
  up: withSummonedPhoenix(withExKit({ name: "Phoenix", description: "Charge in swirling flame, then fly as a phoenix the way you aim; up or down bends the flight. Helpless after.",
    ground: phoenix(PHOENIX_SPEED) }, { travel: 1.25 })),
  down: withExKit({ name: "Banish", description: "A close curse: the victim turns ethereal, slowed and unable to attack, and takes more damage from Kael's spells.",
    ground: banish(undefined), air: banish(18) }, { reach: 1.25 }),
};
