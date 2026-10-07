// Lich's four specials (smashcraft:docs/design/kit-review-2.md, "Lich", #130),
// in the brief's frame numbering (entry tick is frame 1). Damage and launch
// use the kit's provisional knockback classes (lichMoves.ts); Chill is
// sim/chill.ts.
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../heroSpecials";
import { CHILL } from "../chill";
import { HitElement } from "../codes";
import { hit, lichCastBody } from "./lichMoves";

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);
/** Chest height, where the orb leaves the hand and the bursts centre. */
const CHEST = h(f32(0.45));
const AIR_LANDING_LAG = 20;

/** Frost Nova's orb: slow, reflectable, chills a body it reaches. */
const FROST_NOVA_ORB: SpecialProjectile = {
  model: "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx",
  spawnFrame: 18, offsetX: h(f32(0.40)), offsetZ: CHEST, velocityX: h(f32(0.09)), velocityZ: 0.0,
  life: 80, radius: h(f32(0.16)), effect: hit(9.0, "POKE", 35), reflectable: true, limit: 1, status: CHILL,
};

/** The orb burst in place: it cracks for 6 frames, then strikes for 3; a zone, so never reflected. */
const FROST_NOVA_BURST: SpecialProjectile = {
  model: "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx",
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: 9, activeFrom: 7, radius: h(f32(0.7)), effect: hit(10.0, "LAUNCH", 70), reflectable: false, limit: 1, status: CHILL,
};

const frostNova = (landingLag: number | undefined): AuthoredSpecial => ({
  cost: 10,
  endFrame: 39,
  landingLag,
  hurt: lichCastBody(14, 24, 28.0, CHEST),
  projectiles: [FROST_NOVA_ORB],
});

/** The second press while the orb flies: a 14-frame gesture that stops the orb on frame 4 and bursts it. */
const frostNovaBurst = (landingLag: number | undefined): AuthoredSpecial => ({
  cost: 0,
  endFrame: 14,
  landingLag,
  hurt: lichCastBody(2, 8, 28.0, f32(CHEST + 12.0)),
  burst: { frame: 4, from: FROST_NOVA_ORB, into: FROST_NOVA_BURST },
});

/**
 * Death and Decay: a field placed on frame 8, 1.5H ahead or 0.9H when pressed
 * backward (Lich keeps facing), only with a clear line from Lich. It strikes
 * the first body or shield in it from frame 30 (age 23, a projectile counts
 * its spawn frame as age one) and again from frame 70, and is gone after
 * frame 97. Interrupting Lich before the first strike removes both.
 */
const decayStrike = (activeFrom: number, life: number, damage: number, kind: "POKE" | "LAUNCH", angle: 70 | 80): SpecialProjectile => ({
  model: "Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx",
  spawnFrame: 8, offsetX: h(f32(1.5)), backOffsetX: h(f32(0.9)), offsetZ: CHEST, velocityX: 0.0, velocityZ: 0.0,
  life, activeFrom, radius: h(f32(0.75)), effect: hit(damage, kind, angle, false, HitElement.dark),
  reflectable: false, limit: 1, cancelOnInterrupt: true, needsLineOfSight: true,
});
const DEATH_AND_DECAY: AuthoredSpecial = {
  cost: 25,
  endFrame: 50,
  landingLag: AIR_LANDING_LAG,
  hurt: lichCastBody(5, 14, 28.0, f32(CHEST + 12.0)),
  projectiles: [decayStrike(23, 62, 5.0, "POKE", 80), decayStrike(63, 90, 9.0, "LAUNCH", 70)],
};

const ASCENT_FRAMES = 25;

/** Spectral Ascent, a guided rise (#189): over frames 10-34, steered up to `steer` sideways by the held stick, then falls helpless. */
function ascent(cost: number, height: number, steer: number): AuthoredSpecial {
  return {
    cost,
    endFrame: 34,
    motion: [{ ...frames(10, 34), velocityX: 0.0, velocityZ: f32(h(height) / ASCENT_FRAMES), driftSpeed: f32(h(steer) / ASCENT_FRAMES) }],
    oncePerAirtime: true,
    helpless: true,
  };
}

/** Frost Armor: the frame-22 cast arms a 240-frame shell that turns one hit of at most 8 damage into damage only and chills a melee striker. */
const FROST_ARMOR: AuthoredSpecial = {
  cost: 20,
  endFrame: 45,
  landingLag: AIR_LANDING_LAG,
  armor: { ...frames(22, 22 + 240 - 1), maxDamage: 8.0, shell: true, chillsStriker: true },
};

/** Dark Ritual: down special while the shell holds shatters it on frame 6 into a burst around Lich and restores 30 mana. */
const DARK_RITUAL: AuthoredSpecial = {
  name: "Dark Ritual",
  cost: 0,
  endFrame: 24,
  landingLag: AIR_LANDING_LAG,
  regions: [heroRegion(6, 8, { x1: -1.0, z1: CHEST, x2: 1.0, z2: CHEST, radius: h(f32(0.6)) }, hit(5.0, "POKE", 60))],
  ritual: { frame: 6, mana: 30 },
};

export const LICH_SPECIALS: FighterSpecials = {
  neutral: { name: "Frost Nova", description: "A slow orb that chills; press again to burst it where it is.", ground: frostNova(undefined), air: frostNova(AIR_LANDING_LAG), recall: frostNovaBurst(undefined), recallWhile: "projectile" },
  side: { name: "Death and Decay", description: "A rotting field ahead that strikes twice, small then strong; walk or jump out.", ground: DEATH_AND_DECAY },
  up: { name: "Spectral Ascent", description: "A steerable rise, then a helpless fall.", ground: ascent(15, f32(2.9), f32(1.0)), free: ascent(0, f32(2.1), f32(0.7)) },
  down: { name: "Frost Armor", description: "A shell that takes the knockback of one light hit and chills the attacker; press again for Dark Ritual: shatter it for mana.", ground: FROST_ARMOR, recall: DARK_RITUAL, recallWhile: "armor" },
};
