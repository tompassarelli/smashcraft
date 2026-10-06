// Beastmaster's four specials as authored data (smashcraft:docs/design/roster.md,
// "Beastmaster", B specials). The entry tick is frame 1 and "end fN" is the
// last frame of the action. Distances are in the hero reference height H.
// His bear is the placement's partner (sim/companions.ts): side special
// summons it and then orders its lunge, and down special calls it back.
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type AuthoredSpecial, CompanionOrder, type FighterSpecials, type SpecialCompanion, type SpecialMotion, type SpecialPlacement, type SpecialProjectile, frames } from "../heroSpecials";
import { capsule, hit } from "./beastmasterMoves";

const H = HERO_REFERENCE_HEIGHT;
const h = (multiple: number): number => f32(H * f32(multiple));

/** Non-mobility specials used in the air end on landing with this lag (roster "Action defaults"). */
const AIR_SPECIAL_LANDING_LAG = 20;
const CAST_HEIGHT = h(f32(0.5));

/** Throwing Axe: straight, 0.11H a frame for 28 frames, one at a time, no return. */
export const THROWING_AXE: SpecialProjectile = {
  spawnFrame: 20, offsetX: h(f32(0.35)), offsetZ: CAST_HEIGHT,
  velocityX: h(f32(0.11)), velocityZ: 0.0, life: 28, radius: h(f32(0.17)),
  effect: hit(9.0, "POKE", 40), reflectable: true, limit: 1,
  model: "Abilities\\Weapons\\Axe\\AxeMissile.mdx",
};
const throwingAxe = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 39, projectiles: [THROWING_AXE],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});

/**
 * The bear: follows 0.8H behind him at 0.035H a frame on its own deck, lunges
 * 1.2H only on his order (10 frames of warning, a 4-frame bite, 30 of
 * recovery), is stunned 18 frames by a hit mid-lunge, and leaves after 120
 * frames more than 6H from him.
 */
export const BEAR: SpecialCompanion = {
  followSpeed: h(f32(0.035)), followBehind: h(f32(0.8)), returnSpeed: h(f32(0.06)),
  lungeStartup: 10, lungeActive: 4, lungeRecovery: 30, lungeTravel: h(f32(1.2)),
  bite: capsule(15.0, 30.0, f32(h(f32(0.45)) - 20.0), 40.0, 20.0),
  biteEffect: hit(16.0, "EDGE", 40, 1.0, HitElement.normal),
  stunFrames: 18, leash: h(6.0), leashFrames: 120,
};

/** The bear's body: 22 durability, 600 frames, an upright capsule its drawn size. */
const BEAR_PLACEMENT: SpecialPlacement = {
  frame: 30, offsetX: h(f32(0.6)), radius: h(f32(0.3)), height: h(f32(0.8)),
  durability: 30.0, life: 600, fireAges: [], companion: BEAR,
};

/** Without a bear: a ground-only summon, the bear appearing f30, the action ending f56. */
const SUMMON_BEAR: AuthoredSpecial = { cost: 25, endFrame: 56, groundOnly: true, placement: BEAR_PLACEMENT };
/** With a bear: the command, f24 for him; it refuses while the bear is lunging or stunned. */
const BEAR_COMMAND: AuthoredSpecial = { name: "Bear Command", cost: 8, endFrame: 24, command: { frame: 4, order: CompanionOrder.lunge } };

/**
 * Hawk Lift: a cosmetic hawk carries him over f10-32, half the rise by f15,
 * then easing so the peak stays at the listed height. Full form 2.0H up and
 * 0.5H across; the free form 1.4H and 0.35H.
 */
const lift = (rise: number, drift: number): SpecialMotion[] => {
  const segment = (first: number, last: number, share: number): SpecialMotion =>
    ({ ...frames(first, last), velocityX: f32(f32(drift * share) / (last - first + 1)), velocityZ: f32(f32(rise * share) / (last - first + 1)) });
  return [segment(10, 15, 0.5), segment(16, 27, f32(0.46)), segment(28, 32, f32(0.04))];
};
const hawkLift = (cost: number, rise: number, drift: number): AuthoredSpecial => ({
  cost, endFrame: 32, motion: lift(rise, drift), facesStick: true, oncePerAirtime: true, helpless: true,
});

/** Quillbeast Dart: without a bear, one short quill, 0.14H a frame for 20 frames. */
export const QUILL_DART: SpecialProjectile = {
  spawnFrame: 18, offsetX: h(f32(0.3)), offsetZ: CAST_HEIGHT,
  velocityX: h(f32(0.14)), velocityZ: 0.0, life: 20, radius: h(f32(0.10)),
  effect: hit(4.0, "POKE", 35, 1.0, HitElement.normal), reflectable: true, limit: 1,
  model: "Abilities\\Weapons\\QuillSprayMissile\\QuillSprayMissile.mdx",
};
const quillDart = (air: boolean): AuthoredSpecial => ({
  cost: 3, endFrame: 40, projectiles: [QUILL_DART],
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});
/** With a bear: the bear walks back toward him at 0.06H a frame; no teleport, attack or repair. */
const BEAR_RECALL: AuthoredSpecial = { name: "Bear Recall", cost: 0, endFrame: 20, command: { frame: 2, order: CompanionOrder.return } };

export const BEASTMASTER_SPECIALS: FighterSpecials = {
  neutral: { name: "Throwing Axe", description: "A straight thrown axe that costs nothing.", ground: throwingAxe(false), air: throwingAxe(true) },
  side: { name: "Summon Bear", description: "Call a bear to his side; press again to send it lunging ahead.", ground: SUMMON_BEAR, recall: BEAR_COMMAND },
  up: { name: "Hawk Lift", description: "A hawk lifts him high, then a helpless fall.", ground: hawkLift(15, h(2.0), h(f32(0.5))), free: hawkLift(0, h(f32(1.4)), h(f32(0.35))) },
  down: { name: "Quillbeast Dart", description: "A short quill; with a bear out, call the bear back to him instead.", ground: quillDart(false), air: quillDart(true), recall: BEAR_RECALL },
};
