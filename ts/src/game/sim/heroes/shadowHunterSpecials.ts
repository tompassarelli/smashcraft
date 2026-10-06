// Shadow Hunter's four specials as authored data (smashcraft:docs/design/roster.md,
// "Shadow Hunter", B specials). Frames follow the brief: the entry tick is
// frame 1 and "end fN" is the last frame of the action. Distances are in the
// hero reference height H.
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialPlacement, type SpecialProjectile, frames } from "../heroSpecials";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import type { AppliedStatus } from "../heroStatus";
import { hit } from "./shadowHunterMoves";

const H = HERO_REFERENCE_HEIGHT;
const h = (multiple: number): number => f32(H * f32(multiple));

/** Non-mobility specials used in the air end on landing with this lag (roster "Action defaults"). */
const AIR_SPECIAL_LANDING_LAG = 20;
/** Chest height of the drawn throw release. */
const CAST_HEIGHT = h(f32(0.45));

/** Spirit Glaive (#133): out 22 frames, then back to Shadow Hunter (6% out, 5% back toward him). */
const SPIRIT_GLAIVE_SHOT: SpecialProjectile = {
  model: "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx",
  spawnFrame: 18, offsetX: h(f32(0.35)), offsetZ: CAST_HEIGHT,
  velocityX: h(f32(0.12)), velocityZ: 0.0, life: 70, radius: h(f32(0.15)),
  effect: hit(6.0, "POKE", 35), reflectable: true, limit: 1,
  returns: { age: 22, speed: h(f32(0.12)) }, returnEffect: hit(5.0, "POKE", 35),
};

const spiritGlaive = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 40, projectiles: [SPIRIT_GLAIVE_SHOT],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

/**
 * Loa Vault: f8-30 travel, then helpless. Velocities are per frame in H,
 * calibrated in shadowHunterSpecials.tests.ts: the window sets velocity
 * exactly, and with the ballistic rise after it the peak reaches the listed
 * 2.0H rise and 0.6H drift (free form 1.4H and 0.3H). A stick held sideways
 * on entry turns him that way first, so the drift goes where he steers.
 */
const loaVault = (cost: number, riseVelocity: number, driftVelocity: number): AuthoredSpecial => ({
  cost, endFrame: 30,
  motion: [{ ...frames(8, 30), velocityX: h(driftVelocity), velocityZ: h(riseVelocity) }],
  oncePerAirtime: true, helpless: true, facesStick: true,
});

/**
 * Hex (#133, docs/design/kit-review-2.md): for 50 frames the target cannot
 * attack, grab or start a neutral, side or down special; movement, jumps,
 * shield, dodges, DI and up special stay. It mashes out, never before frame
 * 20 (sim/heroStatus.ts). No hurtbox change. When it ends, 240 frames of
 * immunity shared with silence.
 */
const HEX: AppliedStatus = { kind: HeroStatusKind.hex, frames: 50, group: HeroStatusGroup.silence, immunityFrames: 240 };

const HEX_ORB: SpecialProjectile = {
  model: "Abilities\\Weapons\\WitchDoctorMissile\\WitchDoctorMissile.mdx",
  spawnFrame: 24, offsetX: h(f32(0.3)), offsetZ: CAST_HEIGHT,
  velocityX: h(f32(0.07)), velocityZ: 0.0, life: 26, radius: h(f32(0.18)),
  effect: hit(2.0, "POKE", 40, 1.0, HitElement.arcane), reflectable: true, limit: 1, status: HEX,
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
    model: "Abilities\\Weapons\\SerpentWardMissile\\SerpentWardMissile.mdx",
    spawnFrame: 0, offsetX: h(f32(0.15)), offsetZ: h(f32(0.4)),
    velocityX: h(f32(0.10)), velocityZ: 0.0, life: 24, radius: h(f32(0.12)),
    effect: hit(4.0, "POKE", 35, 1.0, HitElement.poison), reflectable: true, limit: 3,
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
  neutral: { ground: spiritGlaive(false), air: spiritGlaive(true) },
  side: { ground: SERPENT_WARD_CAST, recall: SERPENT_WARD_RECALL },
  up: { ground: loaVault(15, f32(0.0909), f32(0.0273)), free: loaVault(0, f32(0.0636), f32(0.0137)) },
  down: { ground: hex(false), air: hex(true) },
};
