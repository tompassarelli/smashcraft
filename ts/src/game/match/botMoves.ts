// The computer's attacks: the moves of its fighter that reach the opponent
// where both will be on the move's first active frame, and the specials that
// suit the distance, one chosen deterministically among them.
import { specialCooldownReady } from "../sim/heroSpecialRules";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { attackCapsule, emptyCapsule, hurtCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackStartupFrames } from "../sim/moves";
import type { FighterMoves } from "../sim/heroMoves";
import type { Controls } from "../sim/roster";
import { immolationRegion } from "../sim/specials";
import { safeAt, slideStaysOnDeck } from "./botFooting";

/** A prime whose square stays inside a 32-bit integer, so squaring is exact in Bun and Warcraft's Lua. */
const HASH_PRIME = 46337;

/** Squares and folds a value below HASH_PRIME into another: nonlinear, so choices drawn from related numbers don't follow each other. */
function scramble(value: number): number {
  const square = floorMod(value * value + 12345, HASH_PRIME);
  return floorMod(square ^ floorDiv(square, 32), HASH_PRIME);
}

/** A deterministic choice in [0, count) from two whole numbers, alike in every runtime. */
export function botChoice(first: number, second: number, count: number): number {
  const mixed = scramble(floorMod(scramble(floorMod(first, HASH_PRIME)) + floorMod(second, HASH_PRIME), HASH_PRIME));
  return floorMod(floorDiv(scramble(mixed), 3), count);
}

const GROUND_MOVES = [
  AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt,
  AttackStyle.downTilt, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.grab,
] as const;
const AERIALS = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir] as const;

/** Options past the attack styles: the four specials. */
const NEUTRAL_SPECIAL = 30;
const SIDE_SPECIAL = 31;
const UP_SPECIAL = 32;
const DOWN_SPECIAL = 33;

/** A level shot strikes a target whose feet are between these heights above the shooter's. */
const SHOT_LOW = -5.0;
const SHOT_HIGH = 60.0;
/** Archer's Disengage hops him about this far back. */
const DISENGAGE_ROOM = 420.0;

const STYLE_SLOTS = 20;
// Preallocated: strike bounds filled the first time a move is asked about, four per character and style.
const strikeBounds: number[] = [];
const strikeFilled: boolean[] = [];
const scratchRegion = emptyHitRegion();
const scratchCapsule = emptyCapsule();
// Preallocated: the options a decision weighs.
const options: number[] = [];

/** The first active frame's strike of a move, facing right: where its [minX, maxX, minZ, maxZ] start in strikeBounds. */
function strikeIndex(character: Character, style: AttackStyle, moves?: FighterMoves): number {
  const slot = character * STYLE_SLOTS + style;
  const index = slot * 4;
  if (moves === undefined && strikeFilled[slot] === true) return index;
  const startup = attackStartupFrames(style, moves);
  let found = false;
  let minX = 1.0;
  let maxX = 0.0;
  let minZ = 0.0;
  let maxZ = 0.0;
  for (let part = 0; part < authoredHitRegionCount(style, moves); part++) {
    const region = authoredHitRegion(scratchRegion, character, style, startup, 0, part, moves);
    if (region.window <= 0) continue;
    let low = region.minX;
    let high = region.maxX;
    let bottom = region.minZ;
    let top = region.maxZ;
    // A grab catches a target whose position lies in its region; strikes reach with their capsule.
    if (style !== AttackStyle.grab) {
      const strike = attackCapsule(scratchCapsule, style, region);
      low = f32(Math.min(strike.x1, strike.x2) - strike.radius);
      high = f32(Math.max(strike.x1, strike.x2) + strike.radius);
      bottom = f32(Math.min(strike.z1, strike.z2) - strike.radius);
      top = f32(Math.max(strike.z1, strike.z2) + strike.radius);
    }
    minX = found ? Math.min(minX, low) : low;
    maxX = found ? Math.max(maxX, high) : high;
    minZ = found ? Math.min(minZ, bottom) : bottom;
    maxZ = found ? Math.max(maxZ, top) : top;
    found = true;
  }
  strikeBounds[index] = minX;
  strikeBounds[index + 1] = maxX;
  strikeBounds[index + 2] = minZ;
  strikeBounds[index + 3] = maxZ;
  strikeFilled[slot] = moves === undefined;
  return index;
}

/** Whether `style` from the attacker strikes a target whose position is localX ahead and localZ above it. */
export function moveReaches(character: Character, style: AttackStyle, target: Readonly<Fighter>, localX: number, localZ: number, moves?: FighterMoves): boolean {
  const index = strikeIndex(character, style, moves);
  const minX = at(strikeBounds, index);
  const maxX = at(strikeBounds, index + 1);
  const minZ = at(strikeBounds, index + 2);
  const maxZ = at(strikeBounds, index + 3);
  if (style === AttackStyle.grab) return localX >= minX && localX <= maxX && localZ >= minZ && localZ <= maxZ;
  const hurt = hurtCapsule(target.character);
  return localX >= f32(minX - hurt.radius) && localX <= f32(maxX + hurt.radius)
    && localZ >= f32(f32(minZ - hurt.z2) - hurt.radius) && localZ <= f32(f32(maxZ - hurt.z1) + hurt.radius);
}

/** The target's offset from the attacker after `frames` more frames of both moving as they did last frame. */
const aheadX = (f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number) =>
  f32(f32(target.motion.x - f.motion.x) + f32(f32(target.motion.deltaX - f.motion.deltaX) * frames));
const aheadZ = (f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number) =>
  f32(f32(target.motion.z - f.motion.z) + f32(f32(target.motion.deltaZ - f.motion.deltaZ) * frames));

function specialReady(f: Readonly<Fighter>, option: number): boolean {
  const { special } = f;
  return specialCooldownReady(f, specialAction(f.character, option)) && special.lockFrames <= 0 && special.action === SpecialAction.none && canAttack(f);
}

function specialAction(character: Character, option: number): SpecialAction {
  switch (character) {
    default:
      return option === UP_SPECIAL ? SpecialAction.heroUp : option === DOWN_SPECIAL ? SpecialAction.heroDown
        : option === SIDE_SPECIAL ? SpecialAction.heroSide : SpecialAction.heroNeutral;
    case Character.archer:
      return option === UP_SPECIAL ? SpecialAction.archerRecovery : option === DOWN_SPECIAL ? SpecialAction.archerDisengage
        : option === SIDE_SPECIAL ? SpecialAction.archerMultishot : SpecialAction.archerArrow;
    case Character.rifleman:
      return option === DOWN_SPECIAL ? SpecialAction.riflemanTrap : option === UP_SPECIAL ? SpecialAction.riflemanRecovery
        : option === SIDE_SPECIAL ? SpecialAction.riflemanBear : SpecialAction.riflemanBlaster;
    case Character.demonHunter:
      return option === UP_SPECIAL ? SpecialAction.demonHunterWingAscent : option === DOWN_SPECIAL ? SpecialAction.demonHunterImmolate
        : option === SIDE_SPECIAL ? SpecialAction.demonHunterParryStep : SpecialAction.demonHunterManaBurn;
  }
}

/** Appends the specials that strike from range: shots, Archer's Multishot, the Rifleman's bear. */
function addShots(f: Readonly<Fighter>, target: Readonly<Fighter>, count: number): number {
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const dz = f32(target.motion.z - motion.z);
  const distance = Math.abs(dx);
  const facing = dx === 0 ? f.facing : dx > 0 ? 1 : -1;
  let added = count;
  if (motion.grounded && facing === f.facing && distance >= 160 && distance <= 700 && dz >= SHOT_LOW && dz <= SHOT_HIGH && specialReady(f, NEUTRAL_SPECIAL)) {
    options[added++] = NEUTRAL_SPECIAL;
  }
  if (f.character === Character.archer && distance >= 140 && distance <= 520 && Math.abs(dz) <= 120 && specialReady(f, SIDE_SPECIAL)) options[added++] = SIDE_SPECIAL;
  if (f.character === Character.rifleman && motion.grounded && target.motion.grounded && f.bear.life <= 0 && distance >= 80 && distance <= 450
    && Math.abs(dz) <= 60 && specialReady(f, SIDE_SPECIAL)) options[added++] = SIDE_SPECIAL;
  return added;
}

/** Appends the specials that suit a target close by: each fighter's own. */
function addCloseSpecials(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, count: number): number {
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const dz = f32(target.motion.z - motion.z);
  const distance = Math.abs(dx);
  const facing = dx === 0 ? f.facing : dx > 0 ? 1 : -1;
  let added = count;
  // Archer's mount and Illidan's ascent strike nothing: they chase a target high overhead from the middle of the deck.
  const overhead = motion.grounded && dz >= 150 && dz <= 500 && distance <= 150 && safeAt(stage, motion.x, 200.0);
  if (overhead && f.character !== Character.rifleman && specialReady(f, UP_SPECIAL)) {
    options[added++] = UP_SPECIAL;
    options[added++] = UP_SPECIAL;
  }
  switch (f.character) {
    case Character.archer:
      if (motion.grounded && facing === f.facing && distance <= 260 && Math.abs(dz) <= 90 && safeAt(stage, f32(motion.x - f32(f.facing * DISENGAGE_ROOM)), 0.0)
        && specialReady(f, DOWN_SPECIAL)) options[added++] = DOWN_SPECIAL;
      break;
    case Character.rifleman: {
      if (motion.grounded && target.motion.grounded && target.motion.surface === motion.surface && f.freezeTrap.life <= 0 && f.freezeTrap.cooldown <= 0
        && distance >= 50 && distance <= 260 && specialReady(f, DOWN_SPECIAL)) options[added++] = DOWN_SPECIAL;
      // The recoil shot drops from just ahead of him as his up special lifts him: in the air or on a raised deck, over a target below.
      const raised = motion.grounded && motion.surface !== undefined && motion.surface > 0;
      if ((!motion.grounded || raised) && safeAt(stage, motion.x, 60.0) && specialReady(f, UP_SPECIAL)) {
        const ahead = f32(aheadX(f, target, 4) * f.facing);
        const below = aheadZ(f, target, 4);
        // The recoil shot reaches only a target right below: when it does, it is most of the choice.
        if (ahead >= 5 && ahead <= 75 && below <= -10 && below >= -230) {
          options[added++] = UP_SPECIAL;
          options[added++] = UP_SPECIAL;
          options[added++] = UP_SPECIAL;
        }
      }
      break;
    }
    case Character.demonHunter: {
      const region = immolationRegion(motion.grounded);
      const localX = f32(aheadX(f, target, 4) * f.facing);
      const localZ = aheadZ(f, target, 4);
      if (localX >= region.minX && localX <= region.maxX && localZ >= region.minZ && localZ <= region.maxZ && specialReady(f, DOWN_SPECIAL)) options[added++] = DOWN_SPECIAL;
      break;
    }
  }
  return added;
}

/** Charging a smash for 0, 10, 25 or 45 frames, chosen by its attack serial. */
export function smashChargeGoal(f: Readonly<Fighter>): number {
  const choice = botChoice(f.attack.serial, f.character, 4);
  return choice === 0 ? 0 : choice === 1 ? 10 : choice === 2 ? 25 : 45;
}

function perform(f: Readonly<Fighter>, target: Readonly<Fighter>, option: number, frame: number, input: Controls, commands: AttackBuffer): void {
  const dx = f32(target.motion.x - f.motion.x);
  const facing = f.facing < 0 ? -1 : 1;
  const toward = dx === 0 ? facing : dx > 0 ? 1 : -1;
  if (option >= NEUTRAL_SPECIAL) {
    input.specialPressed = true;
    input.specialX = option === SIDE_SPECIAL ? toward : 0;
    input.specialZ = option === UP_SPECIAL ? 1 : option === DOWN_SPECIAL ? -1 : 0;
    input.verticalDirection = input.specialZ;
    return;
  }
  if (f.motion.grounded) {
    // The next attack serial is the one this smash starts with.
    const smash = option === AttackStyle.upSmash || option === AttackStyle.downSmash || option === AttackStyle.forwardSmash;
    const charge = smash && botChoice(f.attack.serial + 1, f.character, 4) > 0;
    queueAttack(commands, { style: option, facing: toward, frame, mayCharge: charge });
    input.attackHeld = charge;
    return;
  }
  // An aerial is the ground request the air turns it into: forward or back by the facing asked for.
  const request = option === AttackStyle.neutralAir ? AttackStyle.jab : option === AttackStyle.upAir ? AttackStyle.upTilt
    : option === AttackStyle.downAir ? AttackStyle.downTilt : AttackStyle.forwardTilt;
  queueAttack(commands, { style: request, facing: option === AttackStyle.backAir ? (facing < 0 ? 1 : -1) : facing, frame, mayCharge: false });
}

/**
 * Chooses an attack that reaches the target, or a special that suits the
 * distance, and enters it in input and commands. `ranged` lets a decision
 * with nothing in reach but a special take it. False when it chose nothing.
 */
export function chooseAttack(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, ranged: boolean, input: Controls, commands: AttackBuffer): boolean {
  if (!canAttack(f) && !(f.shield.raised && f.motion.grounded)) return false;
  // A ground attack stops the steering: its slide must end on the deck.
  if (f.motion.grounded && !slideStaysOnDeck(f, stage, matchFrame)) return false;
  let count = 0;
  if (canAttack(f) || f.shield.raised) {
    if (f.motion.grounded) {
      const dashing = f.ground.dashFrame > 0 && (f.character === Character.demonHunter || f.tuning.moves !== undefined);
      for (const move of GROUND_MOVES) {
        // A shield lets go only for a grab; a shielding target invites one.
        if (f.shield.raised && move !== AttackStyle.grab) continue;
        const style = dashing && move === AttackStyle.jab ? f.tuning.moves?.dashAttack ?? AttackStyle.demonHunterDashAttack : move;
        const frames = attackStartupFrames(style, f.tuning.moves);
        const x = aheadX(f, target, frames);
        if (!moveReaches(f.character, style, target, Math.abs(x), aheadZ(f, target, frames), f.tuning.moves)) continue;
        options[count++] = move;
        // A grab counts twice: one of ten moves in reach would rarely be it.
        if (move === AttackStyle.grab) options[count++] = move;
      }
    } else {
      for (const aerial of AERIALS) {
        const frames = attackStartupFrames(aerial, f.tuning.moves);
        if (moveReaches(f.character, aerial, target, f32(aheadX(f, target, frames) * f.facing), aheadZ(f, target, frames), f.tuning.moves)) options[count++] = aerial;
      }
    }
  }
  const strikes = count;
  if (canAttack(f)) count = addCloseSpecials(f, target, stage, count);
  const close = count;
  if (canAttack(f)) count = addShots(f, target, count);
  if (count === 0 || (close === 0 && !ranged)) return false;
  const grabbing = target.shield.raised && f.motion.grounded && strikes > 0 && at(options, strikes - 1) === AttackStyle.grab;
  const option = grabbing ? AttackStyle.grab : at(options, botChoice(frame, f.attack.serial * 7 + f.character, count));
  perform(f, target, option, frame, input, commands);
  return true;
}
