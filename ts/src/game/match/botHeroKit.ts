// The computer's use of an expansion hero's specials, read from the kit's own
// data (sim/heroSpecials.ts): a projectile when its flight meets the target,
// a strike when its paths and travel reach the target, and a guard, armor or
// intangible stance timed against a strike or projectile about to land. Mana, entity
// limits, ground-only forms and airtime uses come from chooseHeroSpecial, so
// the computer never presses a special the rules would refuse. Every choice
// reads only the match state.
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../physics/contactGeometry";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { chooseHeroSpecial } from "../sim/heroSpecialRules";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, SpecialSlot, specialForm, specialKit } from "../sim/heroSpecials";
import { type Controls, neutralControls } from "../sim/roster";
import { safeAt } from "./botFooting";

/** How the computer may use a special this frame. */
export const HeroSpecialUse = { none: 0, close: 1, ranged: 2 } as const;
export type HeroSpecialUse = (typeof HeroSpecialUse)[keyof typeof HeroSpecialUse];


// Preallocated: the computer weighs every special each frame, rollback replays included.
const press = neutralControls();
const refusal = { manaShort: false };

/** The form a press of `slot` would start now, or undefined when the rules refuse it. */
function startableForm(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, slot: SpecialSlot): AuthoredSpecial | undefined {
  press.specialPressed = true;
  press.specialX = slot === SpecialSlot.side ? f.facing : 0;
  press.specialZ = slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0;
  const choice = chooseHeroSpecial(f, specials, press, refusal);
  return choice === undefined ? undefined : specialForm(specialKit(specials, slot), choice.form);
}

/** Whether a projectile's straight flight from the fighter meets the target's body. */
function projectileMeets(spec: Readonly<SpecialProjectile>, target: Readonly<Fighter>, localX: number, localZ: number): boolean {
  const body = hurtCapsule(target.character);
  const reach = f32(spec.radius + body.radius);
  const speed = Math.abs(spec.velocityX);
  let z = spec.offsetZ;
  if (speed > 0) {
    const frames = f32(f32(localX - spec.offsetX) / speed);
    if (frames < 0 || frames > spec.life) return false;
    z = f32(spec.offsetZ + f32(spec.velocityZ * frames));
  } else if (Math.abs(f32(localX - spec.offsetX)) > reach) {
    return false;
  }
  return z >= f32(f32(localZ + body.z1) - reach) && z <= f32(f32(localZ + body.z2) + reach);
}

/** Whether a strike box [minX, maxX] x [minZ, maxZ], carried by travelX/Z, reaches a target localX ahead and localZ above. */
function boxMeets(target: Readonly<Fighter>, localX: number, localZ: number, travelX: number, travelZ: number, boxMinX: number, boxMaxX: number, boxMinZ: number, boxMaxZ: number): boolean {
  const body = hurtCapsule(target.character);
  const minX = f32(f32(boxMinX + Math.min(0.0, travelX)) - body.radius);
  const maxX = f32(f32(boxMaxX + Math.max(0.0, travelX)) + body.radius);
  const minZ = f32(f32(f32(boxMinZ + Math.min(0.0, travelZ)) - body.z2) - body.radius);
  const maxZ = f32(f32(f32(boxMaxZ + Math.max(0.0, travelZ)) - body.z1) + body.radius);
  return localX >= minX && localX <= maxX && localZ >= minZ && localZ <= maxZ;
}

/** Whether the special's strike paths or command grab, carried by its own travel, reach a target localX ahead and localZ above. */
function strikeMeets(move: Readonly<AuthoredSpecial>, target: Readonly<Fighter>, localX: number, localZ: number): boolean {
  const regions = move.regions ?? [];
  const grab = move.commandGrab?.strike;
  if (regions.length === 0 && grab === undefined) return false;
  let travelX = 0.0;
  let travelZ = 0.0;
  for (const segment of move.motion ?? []) {
    const frames = segment.last - segment.first + 1;
    travelX = f32(travelX + f32(segment.velocityX * frames));
    travelZ = f32(travelZ + f32(segment.velocityZ * frames));
  }
  for (const region of regions) {
    const hit = region.hit;
    if (boxMeets(target, localX, localZ, travelX, travelZ, hit.minX, hit.maxX, hit.minZ, hit.maxZ)) return true;
  }
  if (grab === undefined) return false;
  return boxMeets(target, localX, localZ, travelX, travelZ,
    f32(Math.min(grab.x1, grab.x2) - grab.radius), f32(Math.max(grab.x1, grab.x2) + grab.radius),
    f32(Math.min(grab.z1, grab.z2) - grab.radius), f32(Math.max(grab.z1, grab.z2) + grab.radius));
}

/** A special that only protects: no strike or projectile, but a guard, armor or intangible window. */
const isStance = (move: Readonly<AuthoredSpecial>): boolean =>
  (move.regions ?? []).length === 0 && (move.projectiles ?? []).length === 0
  && (move.guard !== undefined || move.armor !== undefined || move.intangible !== undefined);

/** Whether the special's travel ends over the deck; a helpless form needs room to land back on it. */
function travelStaysOnDeck(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>, stage: number): boolean {
  let travelX = 0.0;
  for (const segment of move.motion ?? []) travelX = f32(travelX + f32(segment.velocityX * (segment.last - segment.first + 1)));
  if (travelX === 0.0 && move.helpless !== true) return true;
  return safeAt(stage, f32(f.motion.x + f32(f.facing * travelX)), move.helpless === true ? 200.0 : 0.0);
}

/**
 * How a hero may use the special in `slot` against the target this frame:
 * close for a strike or stance, ranged for a projectile, or none.
 */
export function heroSpecialUse(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, slot: SpecialSlot): HeroSpecialUse {
  const specials = f.tuning.specials;
  if (specials === undefined || !canAttack(f)) return HeroSpecialUse.none;
  const move = startableForm(f, specials, slot);
  // The free up special is kept for recovery (botRecovery.ts).
  if (move === undefined || (slot === SpecialSlot.up && move.cost === 0 && specials.up.ground.cost > 0)) return HeroSpecialUse.none;
  const dx = f32(target.motion.x - f.motion.x);
  const localX = f32(dx * f.facing);
  const localZ = f32(target.motion.z - f.motion.z);
  // Stances answer a threat (heroStanceSlot, from botDefense.ts).
  if (isStance(move)) return HeroSpecialUse.none;
  if (!travelStaysOnDeck(f, move, stage)) return HeroSpecialUse.none;
  if (strikeMeets(move, target, localX, localZ)) return HeroSpecialUse.close;
  for (const spec of move.projectiles ?? []) if (projectileMeets(spec, target, localX, localZ)) return HeroSpecialUse.ranged;
  // A placed object fires from where it stands: set one when its shot would reach the target there.
  const placement = move.placement;
  if (placement !== undefined && target.motion.grounded && projectileMeets(placement.shot, target, f32(localX - placement.offsetX), localZ)) return HeroSpecialUse.ranged;
  return HeroSpecialUse.none;
}

const STANCE_SLOTS = [SpecialSlot.down, SpecialSlot.side, SpecialSlot.neutral] as const;

/**
 * A grounded hero's special whose protective window (guard, armor or
 * intangibility) covers a threat arriving in `arrival` frames, or undefined.
 * A press now starts the special on the next frame, its frame 1.
 */
export function heroStanceSlot(f: Readonly<Fighter>, arrival: number): SpecialSlot | undefined {
  const specials = f.tuning.specials;
  if (specials === undefined || arrival < 0 || !canAttack(f)) return undefined;
  const frame = arrival + 1;
  for (const slot of STANCE_SLOTS) {
    const move = startableForm(f, specials, slot);
    if (move === undefined || !isStance(move)) continue;
    const window = move.guard ?? move.intangible ?? move.armor;
    if (window !== undefined && frame >= window.first && frame <= window.last) return slot;
  }
  return undefined;
}

/**
 * Whether the fighter's up special would start now: an original fighter's
 * cooldown, or for a hero the kit's rules (one use an airtime, its free form
 * below the full cost).
 */
export function upSpecialStartable(f: Readonly<Fighter>, cooldownReady: boolean): boolean {
  const specials = f.tuning.specials;
  return specials === undefined ? cooldownReady : startableForm(f, specials, SpecialSlot.up) !== undefined;
}
