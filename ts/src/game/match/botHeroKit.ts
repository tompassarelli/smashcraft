






import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../physics/contactGeometry";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { chooseHeroSpecial, isHeroSpecialAction, runningHeroSpecial } from "../sim/heroSpecialRules";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, FOLLOW_UP_FORM, FollowUpInput, SpecialSlot, specialForm, specialKit } from "../sim/heroSpecials";
import { type Controls, neutralControls } from "../sim/roster";
import { floorFriction, floorTraction } from "../sim/stage";
import { deckUnder, heightAhead, safeAt } from "./botFooting";


export const HeroSpecialUse = { none: 0, close: 1, ranged: 2 } as const;
export type HeroSpecialUse = (typeof HeroSpecialUse)[keyof typeof HeroSpecialUse];



const press = neutralControls();
const refusal = { groundOnly: false };


export function startableForm(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, slot: SpecialSlot): AuthoredSpecial | undefined {
  press.specialPressed = true;
  press.specialX = slot === SpecialSlot.side ? f.facing : 0;
  press.specialZ = slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0;
  const choice = chooseHeroSpecial(f, specials, press, refusal);
  return choice === undefined ? undefined : specialForm(specialKit(specials, slot), choice.form);
}


function projectileMeets(spec: Readonly<SpecialProjectile>, target: Readonly<Fighter>, localX: number, localZ: number, facing: number): boolean {
  const body = hurtCapsule(target.character);
  const reach = f32(spec.radius + body.radius);
  const speed = Math.abs(spec.velocityX);
  let z = spec.offsetZ;
  if (speed > 0) {
    const frames = f32(f32(localX - spec.offsetX) / speed);
    if (frames < 0 || frames > spec.life) return false;
    z = f32(spec.offsetZ + f32(spec.velocityZ * frames));
  } else {
    let arrivalX = localX;
    if (spec.velocityZ < 0.0) {
      const top = f32(f32(localZ + body.z2) + reach);
      const fall = Math.max(0.0, f32(f32(spec.offsetZ - top) / -spec.velocityZ));
      arrivalX = f32(localX + f32(f32(target.motion.deltaX * facing) * f32(spec.spawnFrame + fall)));
    }
    if (Math.abs(f32(arrivalX - spec.offsetX)) > reach) return false;
    if (spec.velocityZ !== 0.0) {
      const end = f32(spec.offsetZ + f32(spec.velocityZ * spec.life));
      return Math.max(z, end) >= f32(f32(localZ + body.z1) - reach)
        && Math.min(z, end) <= f32(f32(localZ + body.z2) + reach);
    }
  }
  return z >= f32(f32(localZ + body.z1) - reach) && z <= f32(f32(localZ + body.z2) + reach);
}


function boxMeets(target: Readonly<Fighter>, localX: number, localZ: number, travelX: number, travelZ: number, boxMinX: number, boxMaxX: number, boxMinZ: number, boxMaxZ: number): boolean {
  const body = hurtCapsule(target.character);
  const minX = f32(f32(boxMinX + Math.min(0.0, travelX)) - body.radius);
  const maxX = f32(f32(boxMaxX + Math.max(0.0, travelX)) + body.radius);
  const minZ = f32(f32(f32(boxMinZ + Math.min(0.0, travelZ)) - body.z2) - body.radius);
  const maxZ = f32(f32(f32(boxMaxZ + Math.max(0.0, travelZ)) - body.z1) + body.radius);
  return localX >= minX && localX <= maxX && localZ >= minZ && localZ <= maxZ;
}






export function strikeMeets(move: Readonly<AuthoredSpecial>, target: Readonly<Fighter>, localX: number, localZ: number, carriedX = 0.0, carriedZ = 0.0): boolean {
  const regions = move.regions ?? [];
  const grab = move.commandGrab?.strike;
  let travelX = carriedX;
  let travelZ = carriedZ;
  for (const segment of move.motion ?? []) {
    const frames = segment.last - segment.first + 1;
    travelX = f32(travelX + f32(segment.velocityX * frames));
    travelZ = f32(travelZ + f32(segment.velocityZ * frames));
  }
  for (const branch of move.followUps ?? []) {
    if (branch.input !== FollowUpInput.shield && strikeMeets(branch.special, target, localX, localZ, travelX, travelZ)) return true;
  }
  let motionEnds = 0;
  for (const segment of move.motion ?? []) if (segment.velocityX !== 0.0 || segment.velocityZ !== 0.0) motionEnds = Math.max(motionEnds, segment.last);
  for (const region of regions) {
    const hit = region.hit;

    if (motionEnds > 0 && region.firstFrame + 1 > motionEnds) {
      if (boxMeets(target, f32(localX - travelX), f32(localZ - travelZ), 0.0, 0.0, hit.minX, hit.maxX, hit.minZ, hit.maxZ)) return true;
      continue;
    }
    if (boxMeets(target, localX, localZ, travelX, travelZ, hit.minX, hit.maxX, hit.minZ, hit.maxZ)) return true;
  }
  if (grab === undefined) return false;
  return boxMeets(target, localX, localZ, travelX, travelZ,
    f32(Math.min(grab.x1, grab.x2) - grab.radius), f32(Math.max(grab.x1, grab.x2) + grab.radius),
    f32(Math.min(grab.z1, grab.z2) - grab.radius), f32(Math.max(grab.z1, grab.z2) + grab.radius));
}


const isStance = (move: Readonly<AuthoredSpecial>): boolean =>
  (move.regions ?? []).length === 0 && (move.projectiles ?? []).length === 0
  && (move.guard !== undefined || move.armor !== undefined || move.intangible !== undefined);


const relocates = (move: Readonly<AuthoredSpecial>): boolean => {
  for (const segment of move.motion ?? []) if (segment.relocate !== undefined) return true;
  return false;
};

const STANCE_SLOTS = [SpecialSlot.down, SpecialSlot.side, SpecialSlot.neutral] as const;


function travelStaysOnDeck(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>, stage: number): boolean {
  let travelX = 0.0;
  let velocityX = 0.0;
  for (const segment of move.motion ?? []) {
    travelX = f32(travelX + f32(segment.velocityX * (segment.last - segment.first + 1)));
    velocityX = segment.velocityX;
  }

  if (f.motion.grounded && velocityX !== 0.0) {
    const traction = floorTraction(f.tuning.physics.traction, floorFriction(stage, f.motion));
    const speed = Math.abs(velocityX);
    const coast = f32(f32(f32(speed * speed) / f32(2.0 * traction)) + speed);
    travelX = f32(travelX + (velocityX < 0 ? -coast : coast));
  }
  if (travelX === 0.0 && move.helpless !== true) return true;
  return safeAt(stage, f32(f.motion.x + f32(f.facing * travelX)), move.helpless === true ? 200.0 : 0.0);
}





export function heroSpecialUse(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, slot: SpecialSlot, observationAge = 0): HeroSpecialUse {
  const specials = f.tuning.specials;
  if (specials === undefined || !canAttack(f)) return HeroSpecialUse.none;
  const move = startableForm(f, specials, slot);
  if (move === undefined) return HeroSpecialUse.none;
  const observedNowX = f32(target.motion.x + f32(target.motion.deltaX * observationAge));
  const dx = f32(observedNowX - f.motion.x);
  const localX = f32(dx * f.facing);
  const localZ = f32(target.motion.z - f.motion.z);
  if (isStance(move) || relocates(move)) return HeroSpecialUse.none;
  if (!travelStaysOnDeck(f, move, stage)) return HeroSpecialUse.none;
  let firstStrike: number | undefined;
  for (const region of move.regions ?? []) if (firstStrike === undefined || region.firstFrame < firstStrike) firstStrike = region.firstFrame;
  if (move.commandGrab !== undefined && (firstStrike === undefined || move.commandGrab.first < firstStrike)) firstStrike = move.commandGrab.first;


  if (firstStrike === undefined && !target.motion.grounded) for (const segment of move.motion ?? []) if (firstStrike === undefined || segment.last > firstStrike) firstStrike = segment.last;
  if (firstStrike !== undefined && !f.motion.grounded && move.landingLag !== undefined && (move.motion ?? []).length === 0) {
    const deck = deckUnder(stage, 0, f.motion.x, f.motion.z);

    if (deck !== undefined && heightAhead(f, firstStrike + 1, stage, 0) <= deck) return HeroSpecialUse.none;
  }

  const ownStrikeZ = firstStrike === undefined || f.motion.grounded || (move.motion ?? []).length > 0
    ? f.motion.z : heightAhead(f, firstStrike + 1, stage, 0);
  const strikeZ = firstStrike === undefined ? localZ : f32(heightAhead(target, observationAge + firstStrike + 1, stage, 0) - ownStrikeZ);
  if (strikeMeets(move, target, localX, strikeZ)) return HeroSpecialUse.close;
  for (const spec of move.projectiles ?? []) if (projectileMeets(spec, target, localX, localZ, f.facing)) return HeroSpecialUse.ranged;

  const placement = move.placement;
  if (placement?.shot !== undefined && target.motion.grounded && projectileMeets(placement.shot, target, f32(localX - placement.offsetX), localZ, f.facing)) return HeroSpecialUse.ranged;
  return HeroSpecialUse.none;
}






export function heroStanceSlot(f: Readonly<Fighter>, arrival: number): SpecialSlot | undefined {
  return canAttack(f) ? heroStanceFits(f, arrival) : undefined;
}


export function heroStanceFits(f: Readonly<Fighter>, arrival: number): SpecialSlot | undefined {
  const specials = f.tuning.specials;
  if (specials === undefined || arrival < 0) return undefined;
  const frame = arrival + 1;
  for (const slot of STANCE_SLOTS) {
    const move = startableForm(f, specials, slot);
    if (move === undefined || (move.defensiveUse !== true && !isStance(move))) continue;
    const window = move.guard ?? move.intangible ?? move.armor;
    if (window !== undefined && frame >= window.first && frame <= window.last) return slot;
  }
  return undefined;
}


export function pressHeroStance(f: Readonly<Fighter>, slot: SpecialSlot, input: Controls): void {
  input.specialPressed = true;
  input.specialX = slot === SpecialSlot.side ? f.facing : 0;
  input.specialZ = slot === SpecialSlot.down ? -1 : 0;
  input.verticalDirection = input.specialZ;
}


export function heroStanceLater(f: Readonly<Fighter>, arrival: number): boolean {
  const specials = f.tuning.specials;
  if (specials === undefined || arrival < 0 || !canAttack(f)) return false;
  for (const slot of STANCE_SLOTS) {
    const move = startableForm(f, specials, slot);
    if (move === undefined || (move.defensiveUse !== true && !isStance(move))) continue;
    const window = move.guard ?? move.intangible ?? move.armor;
    if (window !== undefined && arrival + 1 > window.last) return true;
  }
  return false;
}






export function upSpecialStartable(f: Readonly<Fighter>, cooldownReady: boolean): boolean {
  const specials = f.tuning.specials;
  return specials === undefined ? cooldownReady : startableForm(f, specials, SpecialSlot.up) !== undefined;
}








export function pressHeroFollowUp(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, input: Controls): boolean {
  if (!isHeroSpecialAction(f.special.action) || f.special.form >= FOLLOW_UP_FORM || f.launch.hitstun > 0) return false;
  const next = f.special.frame + 1;
  const dx = f32(target.motion.x - f.motion.x);
  const localZ = f32(target.motion.z - f.motion.z);
  for (const branch of runningHeroSpecial(f)?.followUps ?? []) {
    const kind = branch.input ?? FollowUpInput.special;
    if (kind === FollowUpInput.shield || next < branch.window.first || next > branch.window.last) continue;
    if (branch.special.helpless === true && !safeAt(stage, f.motion.x, 0.0)) continue;
    const facing = branch.facesStick === true && dx !== 0.0 ? (dx < 0 ? -1 : 1) : f.facing;
    if (!strikeMeets(branch.special, target, f32(dx * facing), localZ)) continue;
    if (kind === FollowUpInput.attack) input.attackPressed = true;
    else input.specialPressed = true;
    if (branch.facesStick === true) input.direction = facing;
    return true;
  }
  return false;
}
