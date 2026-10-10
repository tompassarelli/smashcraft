
import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type AuthoredSpecial, CompanionOrder, type FighterSpecials, type SpecialCompanion, type SpecialMotion, type SpecialPlacement, type SpecialProjectile, frames } from "../heroSpecials";
import { capsule, hit } from "./beastmasterMoves";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));
const AIR_SPECIAL_LANDING_LAG = 20;
const axe = (spawnFrame: number, height: number): SpecialProjectile => ({
  spawnFrame, offsetX: h(f32(0.35)), offsetZ: h(height),
  velocityX: h(f32(0.12)), velocityZ: 0.0, life: 80, radius: h(f32(0.12)),
  effect: hit(4.5, "POKE", 40), returnEffect: hit(3.5999999046325684, "LINK", 65),
  returns: { age: 24, speed: h(f32(0.15)) }, reflectable: true, limit: 1,
  model: "Abilities\\Weapons\\Axe\\AxeMissile.mdx",
});
export const WILD_AXES = [axe(16, f32(0.35)), axe(20, f32(0.65))];
const wildAxes = (air: boolean): AuthoredSpecial => ({
  endFrame: 35, projectiles: WILD_AXES,
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});
export const BEAR: SpecialCompanion = {
  followSpeed: h(f32(0.035)), followBehind: h(f32(0.8)), returnSpeed: h(f32(0.06)),
  lungeStartup: 10, lungeActive: 4, lungeRecovery: 30, lungeTravel: h(f32(1.2)),
  bite: capsule(15.0, 30.0, f32(h(f32(0.45)) - 20.0), 40.0, 20.0),
  biteEffect: hit(10.799999237060547, "EDGE", 40, 1.0, HitElement.normal),
  stunFrames: 18, leash: h(6.0), leashFrames: 120,
};
export const BEAR_PLACEMENT: SpecialPlacement = {
  frame: 24, offsetX: h(f32(0.6)), radius: h(f32(0.3)), height: h(f32(0.8)),
  durability: 30.0, life: 600, fireAges: [], companion: BEAR,
};
const stampede = (spawnFrame: number): SpecialProjectile => ({
  spawnFrame, offsetX: h(f32(0.4)), offsetZ: h(f32(0.15)),
  velocityX: h(f32(0.14)), velocityZ: 0.0, life: 24, radius: h(f32(0.15)),
  effect: hit(3.5999999046325684, "POKE", 25, 1.0, HitElement.normal), reflectable: false, limit: 1,
  model: "Abilities\\Spells\\Other\\Stampede\\StampedeMissile.mdx",
});
export const STAMPEDE = [stampede(12), stampede(20)];
const SUMMON_BEAR: AuthoredSpecial = { endFrame: 44, groundOnly: true, placement: BEAR_PLACEMENT };
const BEAR_COMMAND: AuthoredSpecial = { name: "Stampede", endFrame: 32, command: { frame: 4, order: CompanionOrder.lunge }, projectiles: STAMPEDE };
export const QUILL: SpecialProjectile = {
  spawnFrame: 0, offsetX: h(f32(0.25)), offsetZ: h(f32(0.3)),
  velocityX: h(f32(0.14)), velocityZ: 0.0, life: 24, radius: h(f32(0.09)),
  effect: hit(2.6999998092651367, "LINK", 35, 1.0, HitElement.normal), reflectable: true, limit: 3,
  model: "Abilities\\Weapons\\QuillSprayMissile\\QuillSprayMissile.mdx",
};
const QUILBEAST: SpecialCompanion = {
  ...BEAR, behavior: "sentry", followSpeed: 0.0, lungeStartup: 10, lungeActive: 17, lungeRecovery: 21, lungeTravel: 0.0,
  volleyFrames: [11, 19, 27],
};
export const QUILBEAST_PLACEMENT: SpecialPlacement = {
  slot: 1, frame: 18, offsetX: h(f32(0.65)), radius: h(f32(0.2)), height: h(f32(0.5)),
  durability: 18.0, life: 600, fireAges: [18, 108, 198, 288, 378, 468, 558], shot: QUILL, companion: QUILBEAST,
  model: { path: "units\\creeps\\QuillBeast\\QuillBeast.mdl", height: 120.0, alpha: 255 },
};
const SUMMON_QUILBEAST: AuthoredSpecial = { endFrame: 32, groundOnly: true, placement: QUILBEAST_PLACEMENT };
const QUILL_VOLLEY: AuthoredSpecial = { name: "Quill Volley", endFrame: 24, facesStick: true, command: { frame: 3, order: CompanionOrder.lunge, slot: 1 } };
export const HAWK: SpecialCompanion = {
  ...BEAR, behavior: "flying", followSpeed: h(f32(0.07)), followBehind: -h(f32(0.6)), followHeight: h(f32(1.2)),
  lungeStartup: 8, lungeActive: 8, lungeRecovery: 28, lungeTravel: h(f32(1.5)), lungeDrop: h(f32(1.6)),
  bite: capsule(-12.0, 10.0, 18.0, 25.0, 20.0), biteEffect: hit(5.399999618530273, "LAUNCH", 80, 1.0, HitElement.normal),
};
export const HAWK_PLACEMENT: SpecialPlacement = {
  slot: 2, frame: 12, offsetX: h(f32(0.6)), offsetZ: h(f32(1.2)), radius: 18.0, height: 45.0,
  durability: 12.0, life: 600, fireAges: [], companion: HAWK, keepExisting: true,
  model: { path: "units\\creeps\\WarEagle\\WarEagle.mdl", height: 80.0, alpha: 255 },
};
const SUMMON_HAWK: AuthoredSpecial = { endFrame: 26, groundOnly: true, placement: HAWK_PLACEMENT };
const HAWK_DIVE: AuthoredSpecial = { name: "Hawk Dive", endFrame: 24, facesStick: true, command: { frame: 3, order: CompanionOrder.lunge, slot: 2 } };
const lift = (rise: number, drift: number, steer: number): SpecialMotion[] => {
  const segment = (first: number, last: number, share: number): SpecialMotion =>
    ({
      ...frames(first, last), velocityX: f32(f32(drift * share) / (last - first + 1)), velocityZ: f32(f32(rise * share) / (last - first + 1)),
      driftSpeed: f32(f32(steer * share) / (last - first + 1)),
    });
  return [segment(10, 15, 0.5), segment(16, 27, f32(0.46)), segment(28, 32, f32(0.04))];
};
const hawkLift = (rise: number, drift: number, steer: number): AuthoredSpecial => ({
  name: "Hawk Lift", endFrame: 32, motion: lift(rise, drift, steer), facesStick: true, oncePerAirtime: true, helpless: true,
  placement: { ...HAWK_PLACEMENT, frame: 10 },
});
export const BEASTMASTER_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Wild Axes", description: "Throw two axes; move to guide their return through the enemy.", ground: wildAxes(false), air: wildAxes(true) }, { damage: 1.25 }),
  side: withExKit({ name: "Summon Bear", description: "Call Bear, then press again for its lunge and a Stampede.", ground: SUMMON_BEAR, recall: BEAR_COMMAND }, { damage: 1.25, durability: 1.25 }),
  up: withExKit({ name: "Summon Hawk", description: "Call Hawk, then command a dive. In the air, Hawk carries him up.", ground: SUMMON_HAWK, recall: HAWK_DIVE, recallGroundOnly: true, air: hawkLift(h(f32(3.6)), h(f32(0.3)), h(f32(3.4))) }, { travel: 1.25, durability: 1.25, recallProtection: 4 }),
  down: withExKit({ name: "Summon Quilbeast", description: "Set a Quilbeast firing position; press again for a three-quill volley.", ground: SUMMON_QUILBEAST, recall: QUILL_VOLLEY }, { damage: 1.25, durability: 1.25, recallProtection: 4 }),
};
