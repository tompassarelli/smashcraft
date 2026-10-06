// Lich's four specials from smashcraft:docs/design/roster.md, in the brief's
// frame numbering (entry tick is frame 1). Damage and launch use the kit's
// provisional knockback classes (lichMoves.ts).
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, ROSTER_MANA, frames } from "../heroSpecials";
import { hit, lichCastBody } from "./lichMoves";

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);
/** Chest height, where the shard leaves the hand and the nova centres. */
const CHEST = h(f32(0.45));

/** Frost Shard: one slow reflectable bolt, no status. */
const FROST_SHARD: AuthoredSpecial = {
  cost: 0,
  endFrame: 45,
  landingLag: 20,
  hurt: lichCastBody(16, 26, 28.0, CHEST),
  projectiles: [{
    spawnFrame: 20, offsetX: h(f32(0.40)), offsetZ: CHEST, velocityX: h(f32(0.10)), velocityZ: 0.0,
    life: 45, radius: h(f32(0.16)), effect: hit(6.0, "POKE", 35), reflectable: true, limit: 1,
  }],
};

/**
 * Frost Nova: a fixed world-space marker placed on frame 8, 1.5H ahead or
 * 0.9H when pressed backward (Lich keeps facing), only with a clear line from
 * Lich. It bursts on frames 30-32 (a projectile counts its spawn frame as age
 * one) and is removed if Lich is interrupted first.
 */
const FROST_NOVA: AuthoredSpecial = {
  cost: 20,
  endFrame: 58,
  landingLag: 20,
  hurt: lichCastBody(5, 14, 28.0, f32(CHEST + 12.0)),
  projectiles: [{
    spawnFrame: 8, offsetX: h(f32(1.5)), backOffsetX: h(f32(0.9)), offsetZ: CHEST, velocityX: 0.0, velocityZ: 0.0,
    life: 25, activeFrom: 23, radius: h(f32(0.65)), effect: hit(11.0, "LAUNCH", 70),
    reflectable: false, limit: 1, cancelOnInterrupt: true, needsLineOfSight: true,
  }],
};

const ASCENT_FRAMES = 25;

/** Spectral Ascent rises over frames 10-34, steered up to 0.4H sideways, then falls helpless. */
function ascent(cost: number, height: number): AuthoredSpecial {
  return {
    cost,
    endFrame: 34,
    motion: [{ ...frames(10, 34), velocityX: 0.0, velocityZ: f32(h(height) / ASCENT_FRAMES), driftSpeed: f32(h(f32(0.4)) / ASCENT_FRAMES), offsetsGravity: true }],
    oncePerAirtime: true,
    helpless: true,
  };
}

/** Frost Armor: the frame-22 cast arms a 180-frame shell that turns one hit of at most 6 damage into damage only. */
const FROST_ARMOR: AuthoredSpecial = {
  cost: 25,
  endFrame: 45,
  landingLag: 20,
  armor: { ...frames(22, 22 + 180 - 1), maxDamage: 6.0, shell: true },
};

export const LICH_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: FROST_SHARD },
  side: { ground: FROST_NOVA },
  up: { ground: ascent(15, f32(2.1)), free: ascent(0, f32(1.4)) },
  down: { ground: FROST_ARMOR },
};
