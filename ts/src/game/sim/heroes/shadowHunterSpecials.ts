// Shadow Hunter's four specials as authored data (smashcraft:docs/design/roster.md,
// "Shadow Hunter", B specials). Frames follow the brief: the entry tick is
// frame 1 and "end fN" is the last frame of the action. Distances are in the
// hero reference height H.
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialPlacement, type SpecialProjectile, ROSTER_MANA, frames } from "../heroSpecials";
import { HitElement } from "../codes";
import { hit } from "./shadowHunterMoves";

const H = HERO_REFERENCE_HEIGHT;
const h = (multiple: number): number => f32(H * f32(multiple));

/** Non-mobility specials used in the air end on landing with this lag (roster "Action defaults"). */
const AIR_SPECIAL_LANDING_LAG = 20;
/** Chest height of the drawn throw release. */
const CAST_HEIGHT = h(f32(0.45));

const SPIRIT_GLAIVE_SHOT: SpecialProjectile = {
  spawnFrame: 18, offsetX: h(f32(0.35)), offsetZ: CAST_HEIGHT,
  velocityX: h(f32(0.12)), velocityZ: 0.0, life: 28, radius: h(f32(0.15)),
  effect: hit(6.0, "POKE", 35), reflectable: true, limit: 1,
};

const spiritGlaive = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 40, projectiles: [SPIRIT_GLAIVE_SHOT],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

/**
 * Loa Vault: f8-30 travel, then helpless. Velocities are per frame in H,
 * calibrated in shadowHunterSpecials.tests.ts so that, with gravity acting
 * between the set frames and the ballistic rise after the window, the peak
 * reaches the listed 2.0H rise and 0.6H drift (free form 1.4H and 0.3H).
 */
const loaVault = (cost: number, riseVelocity: number, driftVelocity: number): AuthoredSpecial => ({
  cost, endFrame: 30,
  motion: [{ ...frames(8, 30), velocityX: h(driftVelocity), velocityZ: h(riseVelocity) }],
  oncePerAirtime: true, helpless: true,
});

/** Hex's orb; its status is HEX below. */
const HEX_ORB: SpecialProjectile = {
  spawnFrame: 24, offsetX: h(f32(0.3)), offsetZ: CAST_HEIGHT,
  velocityX: h(f32(0.07)), velocityZ: 0.0, life: 18, radius: h(f32(0.18)),
  effect: hit(2.0, "POKE", 40, 1.0, HitElement.normal), reflectable: true, limit: 1,
};

const hex = (air: boolean): AuthoredSpecial => ({
  cost: 25, endFrame: 53, projectiles: [HEX_ORB],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

/**
 * Serpent Ward: 12 durability, 240 frames, a straight never-aimed shot at ages
 * 45, 105 and 165 along the placement facing. Its upright body is the totem's
 * drawn size, struck by any opponent's normal, hero special or projectile.
 */
const SERPENT_WARD: SpecialPlacement = {
  frame: 26, offsetX: h(f32(0.65)), radius: h(f32(0.18)), height: h(f32(0.6)),
  durability: 12.0, life: 240, fireAges: [45, 105, 165],
  shot: {
    spawnFrame: 0, offsetX: h(f32(0.15)), offsetZ: h(f32(0.4)),
    velocityX: h(f32(0.10)), velocityZ: 0.0, life: 24, radius: h(f32(0.12)),
    effect: hit(4.0, "POKE", 35, 1.0, HitElement.normal), reflectable: true, limit: 3,
  },
};

/**
 * The ward's cast: ground-only, 20 mana, the ward appears f26, the action ends
 * f52. Recasting while it stands plays the same vulnerable cast for free and
 * removes the ward when it completes; nothing is refunded.
 */
const SERPENT_WARD_CAST: AuthoredSpecial = { cost: 20, endFrame: 52, groundOnly: true, placement: SERPENT_WARD };
const SERPENT_WARD_RECALL: AuthoredSpecial = { cost: 0, endFrame: 52, groundOnly: true, recall: true };

export const SHADOW_HUNTER_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: spiritGlaive(false), air: spiritGlaive(true) },
  side: { ground: SERPENT_WARD_CAST, recall: SERPENT_WARD_RECALL },
  up: { ground: loaVault(15, f32(0.1014), f32(0.0283)), free: loaVault(0, f32(0.0741), f32(0.0146)) },
  down: { ground: hex(false), air: hex(true) },
};
