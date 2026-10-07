// Mana, every fighter's one resource for specials (smashcraft:docs/design/mana.md):
// earned by fighting (landing normals and throws, a capped share of hits
// taken) and a steady trickle, spent once when a special starts. Integer
// points and an integer trickle remainder keep the host and Lua32 equal.
import { max, min, toInt } from "../../runtime/numbers";
import { idiv } from "wisp/src/sim/intMath";
import { ContactKind, HeroStatusKind, SpecialAction } from "./codes";
import { inGrabContext } from "./conditions";
import type { Fighter } from "./fighter";
import { at } from "wisp/src/runtime/lookup";

export interface ManaProfile {
  readonly max: number;
  /** Trickle progress that makes one point. */
  readonly progressPerPoint: number;
  /** Trickle progress per eligible frame on the ground: 8 of 120 is a point every 15 frames, 4 a second. */
  readonly groundProgress: number;
  /** In the air: 3 of 120 is a point every 40 frames, 1.5 a second. */
  readonly airProgress: number;
  /** Points per whole percent a fighter's normal or throw deals to a body. */
  readonly dealtPerPercent: number;
  /** Most points one such hit earns. */
  readonly dealtCap: number;
  /** A hit taken earns one point per this many whole percent... */
  readonly takenPercentPerPoint: number;
  /** ...and at most this many from one hit, so a long combo never fills the bar. */
  readonly takenCap: number;
}

/** The roster resource: 100, full on every stock. */
export const ROSTER_MANA: ManaProfile = {
  max: 100, progressPerPoint: 120, groundProgress: 8, airProgress: 3,
  dealtPerPercent: 1, dealtCap: 12, takenPercentPerPoint: 2, takenCap: 6,
};

/**
 * What the original fighters' specials cost, indexed by SpecialAction code
 * (their cooldowns still apply). Their up specials are free: the recovery
 * is never lost to an empty bar.
 */
const ORIGINAL_SPECIAL_COSTS: readonly number[] = [
  0, // none
  3, // Archer: arrow
  12, // Archer: homing arrow
  15, // Archer: hippogryph call, or its dive from the perch
  0, // Archer: hippogryph ride
  25, // Rifleman: bear
  0, // Rifleman: recoil recovery
  3, // Rifleman: blaster
  15, // Rifleman: freeze trap
  10, // Illidan: Mana Burn
  12, // Illidan: side special
  0, // Illidan: Wing Ascent
  15, // Illidan: Immolation
];
if (ORIGINAL_SPECIAL_COSTS.length !== SpecialAction.heroNeutral) throw new Error("one mana cost per original special action");

/** An original fighter's special's cost; hero kits author theirs. */
export function originalSpecialCost(action: number): number {
  return action > SpecialAction.none && action < SpecialAction.heroNeutral ? at(ORIGINAL_SPECIAL_COSTS, action) : 0;
}

/** Spends `cost`, which the caller checked is affordable. */
export function spendMana(f: Fighter, cost: number): void {
  if (cost > 0) f.mana.points = max(0, f.mana.points - cost);
}

export function gainMana(f: Fighter, points: number): void {
  if (points > 0 && !f.status.out) f.mana.points = min(ROSTER_MANA.max, f.mana.points + points);
}

/** Takes up to `points` away; Mana Burn's drain. */
export function drainMana(f: Fighter, points: number): void {
  f.mana.points = max(0, f.mana.points - points);
}

/** A new stock starts full. */
export function fillMana(f: Fighter): void {
  f.mana.points = ROSTER_MANA.max;
  f.mana.progress = 0;
}

/** The trickle runs unless the fighter is out, shielding, held or holding, in hitstun, frozen, stopped by a status or casting. */
function trickles(f: Readonly<Fighter>): boolean {
  return !f.status.out && !f.shield.raised && f.shield.stun <= 0 && f.launch.hitstun <= 0 && f.status.frozenFrames <= 0
    && f.status.condition !== HeroStatusKind.stun && f.status.condition !== HeroStatusKind.sleep && f.special.action === SpecialAction.none && !inGrabContext(f);
}

/** One frame of trickle: ground or air progress toward the next point. */
export function regenerateMana(f: Fighter): void {
  const { mana } = f;
  if (mana.points >= ROSTER_MANA.max) {
    mana.progress = 0;
    return;
  }
  if (!trickles(f)) return;
  mana.progress += f.motion.grounded ? ROSTER_MANA.groundProgress : ROSTER_MANA.airProgress;
  if (mana.progress >= ROSTER_MANA.progressPerPoint) {
    mana.progress -= ROSTER_MANA.progressPerPoint;
    mana.points = min(ROSTER_MANA.max, mana.points + 1);
  }
}

/** Points a body hit of `damage` percent earns the fighter whose normal or throw landed it. */
export function dealtManaGain(damage: number): number {
  return min(ROSTER_MANA.dealtCap, toInt(max(0.0, damage)) * ROSTER_MANA.dealtPerPercent);
}

/** Points a body hit of `damage` percent earns the fighter it hits: the comeback share. */
export function takenManaGain(damage: number): number {
  return min(ROSTER_MANA.takenCap, idiv(toInt(max(0.0, damage)), ROSTER_MANA.takenPercentPerPoint));
}

/** Whether a contact earns its source mana: a normal or throw, never a special, its projectiles or a pummel. */
export function contactEarnsMana(source: Readonly<Fighter>, kind: ContactKind, direct: boolean): boolean {
  if (kind === ContactKind.pummel || source.special.action !== SpecialAction.none) return false;
  return kind === ContactKind.throw || (direct && source.attack.style !== undefined);
}

/** Whether an original fighter can pay for the special action now; hero actions check their kit's form instead. */
export function originalSpecialAffordable(f: Readonly<Fighter>, action: number): boolean {
  return originalSpecialCost(action) <= f.mana.points;
}
