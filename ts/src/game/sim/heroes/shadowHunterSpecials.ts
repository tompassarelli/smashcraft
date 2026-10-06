// Shadow Hunter's four specials as authored data (smashcraft:docs/design/roster.md,
// "Shadow Hunter", B specials). Frames follow the brief: the entry tick is
// frame 1 and "end fN" is the last frame of the action. Distances are in the
// hero reference height H; motion velocities are provisional until a vault
// test measures the listed 2.0H/0.6H (free 1.4H/0.3H) displacement.
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, ROSTER_MANA, frames } from "../heroSpecials";
import { HitElement } from "../hitRegions";
import { hit } from "./shadowHunterMoves";

const H = HERO_REFERENCE_HEIGHT;
const h = (multiple: number): number => f32(H * f32(multiple));

/** Non-mobility specials used in the air end on landing with this lag (roster "Action defaults"). */
const AIR_SPECIAL_LANDING_LAG = 20;
/** Chest height of the drawn throw release. */
const CAST_HEIGHT = h(0.45);

const SPIRIT_GLAIVE_SHOT: SpecialProjectile = {
  spawnFrame: 18, offsetX: h(0.35), offsetZ: CAST_HEIGHT,
  velocityX: h(0.12), velocityZ: 0.0, life: 28, radius: h(0.15),
  effect: hit(6.0, "POKE", 35), reflectable: true, limit: 1,
};

const spiritGlaive = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 40, projectiles: [SPIRIT_GLAIVE_SHOT],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

/**
 * Loa Vault: f8-30 travel, then helpless. 23 frames of set velocity reach the
 * listed rise and drift in empty space if gravity does not act inside the
 * window; the framework's motion rule decides, and a vault test calibrates.
 */
const VAULT_FRAMES = 23;
const loaVault = (cost: number, rise: number, drift: number): AuthoredSpecial => ({
  cost, endFrame: 30,
  motion: [{ ...frames(8, 30), velocityX: f32(h(drift) / VAULT_FRAMES), velocityZ: f32(h(rise) / VAULT_FRAMES) }],
  oncePerAirtime: true, helpless: true,
});

/** Hex's orb; its status is HEX below. */
const HEX_ORB: SpecialProjectile = {
  spawnFrame: 24, offsetX: h(0.3), offsetZ: CAST_HEIGHT,
  velocityX: h(0.07), velocityZ: 0.0, life: 18, radius: h(0.18),
  effect: hit(2.0, "POKE", 40, 1.0, HitElement.normal), reflectable: true, limit: 1,
};

const hex = (air: boolean): AuthoredSpecial => ({
  cost: 25, endFrame: 53, projectiles: [HEX_ORB],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

/**
 * Serpent Ward's cast: ground-only, 20 mana, ward appears f26, action ends f52.
 * Recasting while the ward stands is a recall with the same animation, free.
 * The ward itself is SERPENT_WARD below.
 */
const serpentWardCast = (cost: number): AuthoredSpecial => ({ cost, endFrame: 52, groundOnly: true });

export const SHADOW_HUNTER_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: spiritGlaive(false), air: spiritGlaive(true) },
  side: { ground: serpentWardCast(20) },
  up: { ground: loaVault(15, 2.0, 0.6), free: loaVault(0, 1.4, 0.3) },
  down: { ground: hex(false), air: hex(true) },
};

// Kit rules the special schema does not express yet; roster-infra owns the
// mechanisms, these are Shadow Hunter's values for them.

/** A placed, destructible owned object that fires on a fixed schedule. */
export interface WardSpec {
  /** Cast frame the ward appears on, offset facing-relative from the caster's feet. */
  readonly placeFrame: number;
  readonly offsetX: number;
  /** Hurt volume: any normal attack or projectile damages it; shields cannot cover it. */
  readonly radius: number;
  readonly height: number;
  readonly durability: number;
  readonly life: number;
  /** Ward ages that fire one shot straight along its placement facing; never aims. */
  readonly fireAges: readonly number[];
  readonly shot: SpecialProjectile;
  /** Owned at once. A recast with one standing recalls it at recallCost instead of placing. */
  readonly limit: number;
  readonly recallCost: number;
}

export const SERPENT_WARD: WardSpec = {
  placeFrame: 26, offsetX: h(0.65), radius: h(0.18), height: h(0.6),
  durability: 12, life: 240, fireAges: [45, 105, 165],
  shot: {
    spawnFrame: 0, offsetX: h(0.15), offsetZ: h(0.4),
    velocityX: h(0.10), velocityZ: 0.0, life: 24, radius: h(0.12),
    effect: hit(4.0, "POKE", 35, 1.0, HitElement.normal), reflectable: true, limit: 3,
  },
  limit: 1, recallCost: 0,
};

/** A status a projectile applies on a body hit (never on shield). */
export interface StatusSpec {
  readonly frames: number;
  /** Frames after expiry before the same group can apply again. */
  readonly immunityFrames: number;
  /** Specials the target cannot start; up special stays available as recovery. */
  readonly blocksSpecials: boolean;
}

/** Hex: 45 frames without neutral, side or down specials; 180 frames of hex/silence immunity after. */
export const HEX: StatusSpec = { frames: 45, immunityFrames: 180, blocksSpecials: true };
