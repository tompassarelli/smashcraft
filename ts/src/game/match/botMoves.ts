// The computer's attacks: the moves of its fighter that reach the opponent
// where both will be on the move's first active frame, and the specials that
// suit the distance, one chosen deterministically among them.
import { specialCooldownReady } from "../sim/heroSpecialRules";
import { originalSpecialAffordable } from "../sim/mana";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { attackCapsule, emptyCapsule, hurtCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character, PassiveKind, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackStartupFrames } from "../sim/moves";
import type { FighterMoves } from "../sim/heroMoves";
import type { Controls } from "../sim/roster";
import { immolationRegion } from "../sim/specials";
import { surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { safeAt, slideStaysOnDeck } from "./botFooting";
import { HeroSpecialUse, heroSpecialUse } from "./botHeroKit";
import { SpecialSlot } from "../sim/heroSpecials";
import { SPACE_PLAN, avoids, gameplanOf, moveWeight, passiveLandingMove, spacedAt, toGameplanMove } from "./botGameplan";
import { passivePips, passiveSpec } from "../sim/passives";
import type { FighterGameplan, GameplanMove } from "../sim/gameplan";
import { type CpuSkill, FULL_SKILL } from "./cpuLevel";

/** A prime whose square stays inside a 32-bit integer, so squaring is exact in Bun and Warcraft's Lua. */
const HASH_PRIME = 46337;
/** Seeds step their salt by this prime: far apart against the small numbers choices already add. */
const SEED_STEP = 7919;

/** Squares and folds a value below HASH_PRIME into another: nonlinear, so choices drawn from related numbers don't follow each other. */
function scramble(value: number): number {
  const square = floorMod(value * value + 12345, HASH_PRIME);
  return floorMod(square ^ floorDiv(square, 32), HASH_PRIME);
}

// The match seed's salt, set for the length of one computer's decision
// (botPlay.ts produceComputerInput): botChoice reaches the gameplan's
// choices as a callback, so the salt can't travel as an argument. 0 outside
// a decision.
let seedSalt = 0;

/** Draws every following botChoice under the match seed; seed 0 draws as before seeds existed. */
export function useMatchSeed(seed: number): void {
  seedSalt = floorMod(floorMod(seed, HASH_PRIME) * SEED_STEP, HASH_PRIME);
}

/** A deterministic choice in [0, count) from two whole numbers and the match seed, alike in every runtime. */
export function botChoice(first: number, second: number, count: number): number {
  const mixed = scramble(floorMod(scramble(floorMod(first, HASH_PRIME)) + floorMod(second + seedSalt, HASH_PRIME), HASH_PRIME));
  return floorMod(floorDiv(scramble(mixed), 3), count);
}

/** Whether a draw of `numerator` in `denominator` comes up, by botChoice; always at or past the whole, never at 0. */
export const botChance = (first: number, second: number, numerator: number, denominator: number): boolean =>
  numerator >= denominator || (numerator > 0 && botChoice(first, second, denominator) < numerator);

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
/** A misplayed move is thrown only at a target this close. */
const MISPLAY_GAP = 350.0;
/** Archer's Disengage hops him about this far back. */
const DISENGAGE_ROOM = 420.0;
/** A spacing tool is thrown as a wall at most this far past its reach: a step the target takes into it. */
const SPACING_STEP = 30.0;

const STYLE_SLOTS = 20;
// Preallocated: strike bounds filled the first time a move is asked about, four per character and style.
const strikeBounds: number[] = [];
const strikeFilled: boolean[] = [];
// The kit each slot's bounds were filled from: a kit's moves are shared and immutable, so the same object gives the same bounds.
const strikeMoves: (FighterMoves | undefined)[] = [];
const scratchRegion = emptyHitRegion();
const scratchCapsule = emptyCapsule();
// Preallocated: the options a decision weighs.
const options: number[] = [];
// Preallocated: each option's weight under a gameplan.
const weights: number[] = [];

/** The first active frame's strike of a move, facing right: where its [minX, maxX, minZ, maxZ] start in strikeBounds. */
function strikeIndex(character: Character, style: AttackStyle, moves?: FighterMoves): number {
  const slot = character * STYLE_SLOTS + style;
  const index = slot * 4;
  if (strikeFilled[slot] === true && strikeMoves[slot] === moves) return index;
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
    // An original grab catches a target whose position lies in its region; strikes and kit grabs reach with their capsule.
    if (style !== AttackStyle.grab || moves?.normals[AttackStyle.grab] !== undefined) {
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
  strikeFilled[slot] = true;
  strikeMoves[slot] = moves;
  return index;
}

/** Whether `style` from the attacker strikes a target whose position is localX ahead and localZ above it. */
export function moveReaches(character: Character, style: AttackStyle, target: Readonly<Fighter>, localX: number, localZ: number, moves?: FighterMoves): boolean {
  const index = strikeIndex(character, style, moves);
  const minX = at(strikeBounds, index);
  const maxX = at(strikeBounds, index + 1);
  const minZ = at(strikeBounds, index + 2);
  const maxZ = at(strikeBounds, index + 3);
  // An original fighter's grab catches a target whose position lies in its region; a kit's grab path takes the body like a strike.
  if (style === AttackStyle.grab && moves?.normals[AttackStyle.grab] === undefined) return localX >= minX && localX <= maxX && localZ >= minZ && localZ <= maxZ;
  const hurt = hurtCapsule(target.character);
  return localX >= f32(minX - hurt.radius) && localX <= f32(maxX + hurt.radius)
    && localZ >= f32(f32(minZ - hurt.z2) - hurt.radius) && localZ <= f32(f32(maxZ - hurt.z1) + hurt.radius);
}


/** How far ahead `style` from the attacker strikes a target's position on its first active frame. */
export function moveReachAhead(character: Character, style: AttackStyle, target: Readonly<Fighter>, moves?: FighterMoves): number {
  const maxX = at(strikeBounds, strikeIndex(character, style, moves) + 1);
  return style === AttackStyle.grab && moves?.normals[AttackStyle.grab] === undefined ? maxX : f32(maxX + hurtCapsule(target.character).radius);
}

/** The target's offset from the attacker after `frames` more frames: the target moving as it did last frame, the attacker sliding (travelOver). */
export function aheadX(f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number, style?: AttackStyle): number {
  const startupTravel = style === undefined ? undefined : f.tuning.moves?.normals[style]?.startupTravelX;
  const toward = target.motion.x < f.motion.x ? -1 : 1;
  // Authored startup travel clears ground velocity when the attack begins.
  const travel = f.motion.grounded && startupTravel !== undefined ? f32(startupTravel * toward) : travelOver(f, frames);
  return f32(f32(f32(target.motion.x + f32(target.motion.deltaX * frames)) - f.motion.x) - travel);
}

/**
 * How far the attacker travels over `frames` more frames: its last frame's
 * travel, but on the ground no further than its slide once the attack stops
 * its steering, so a run doesn't carry a slow smash into reach (#160).
 */
function travelOver(f: Readonly<Fighter>, frames: number): number {
  const straight = f32(f.motion.deltaX * frames);
  if (!f.motion.grounded) return straight;
  const speed = Math.abs(f.motion.vx);
  // Counted a little short, as if braking at 1.25 times its traction: a reach overestimated is a swing at nothing.
  const slide = f32(f32(f32(speed * speed) / f32(2.5 * f.tuning.physics.traction)) + speed);
  return Math.abs(straight) <= slide ? straight : straight < 0 ? f32(-slide) : slide;
}

/** The target's height over the attacker after `frames` more frames, each landing on a deck of `stage` it falls onto (none for stage -1). */
export const aheadZ = (f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number, stage = -1, matchFrame = 0) =>
  f32(heightAhead(target, frames, stage, matchFrame) - heightAhead(f, frames, stage, matchFrame));

/**
 * A fighter's height after `frames` more frames: its last frame's rise,
 * slowed each frame by gravity while airborne down to its fall speed, so a
 * rising jump isn't taken to keep rising into a target overhead, and held
 * by the deck under it when it falls that far (#160).
 */
function heightAhead(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): number {
  const { z, deltaZ } = f.motion;
  if (f.motion.grounded) return f32(z + f32(deltaZ * frames));
  const { gravity, terminalSpeed } = f.tuning.physics;
  const floor = Math.min(deltaZ, -terminalSpeed);
  // Frames whose fall gravity still speeds up before the floor holds it.
  const slowing = Math.min(frames, Math.max(0, Math.floor(f32(f32(deltaZ - floor) / gravity))));
  const curve = f32(f32(deltaZ * slowing) - f32(gravity * ((slowing * (slowing + 1)) / 2)));
  const ahead = f32(z + f32(curve + f32(floor * (frames - slowing))));
  const deck = deckUnder(stage, matchFrame, f.motion.x, z);
  return deck !== undefined && ahead < deck ? deck : ahead;
}

/** The highest deck of `stage` under (x, z) on match frame `matchFrame`, or undefined over the void. */
function deckUnder(stage: number, matchFrame: number, x: number, z: number): number | undefined {
  let top: number | undefined;
  for (let index = 0; index < surfaceCount(stage); index++) {
    const deck = surfaceZ(stage, index, matchFrame);
    if (deck > z || x < surfaceLeft(stage, index, matchFrame) || x > surfaceRight(stage, index, matchFrame)) continue;
    if (top === undefined || deck > top) top = deck;
  }
  return top;
}

/**
 * Whether a spacing tool thrown now walls off the target localX ahead and
 * localZ above: level with it, ahead, and at most a step past its reach, so
 * the target walks into it. Never at a target on another deck (#160).
 */
function wallsOff(f: Readonly<Fighter>, style: AttackStyle, target: Readonly<Fighter>, localX: number, localZ: number): boolean {
  const reach = moveReachAhead(f.character, style, target, f.tuning.moves);
  return localX > 0.0 && localX <= f32(reach + SPACING_STEP) && moveReaches(f.character, style, target, Math.min(localX, reach), localZ, f.tuning.moves);
}

/** Whether an airborne fighter lands on a deck within `frames` frames, cancelling an aerial started now before it strikes. */
function landsWithin(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): boolean {
  if (f.motion.grounded) return false;
  const deck = deckUnder(stage, matchFrame, f.motion.x, f.motion.z);
  return deck !== undefined && heightAhead(f, frames, -1, matchFrame) <= deck;
}

function specialReady(f: Readonly<Fighter>, option: number): boolean {
  const { special } = f;
  const action = specialAction(f.character, option);
  return specialCooldownReady(f, action) && originalSpecialAffordable(f, action) && special.lockFrames <= 0 && special.action === SpecialAction.none && canAttack(f);
}

function specialAction(character: Character, option: number): SpecialAction {
  switch (character) {
    default:
      return option === UP_SPECIAL ? SpecialAction.heroUp : option === DOWN_SPECIAL ? SpecialAction.heroDown
        : option === SIDE_SPECIAL ? SpecialAction.heroSide : SpecialAction.heroNeutral;
    case Character.archer:
      return option === UP_SPECIAL ? SpecialAction.archerRecovery : option === DOWN_SPECIAL ? SpecialAction.archerDisengage
        : option === SIDE_SPECIAL ? SpecialAction.archerHomingArrow : SpecialAction.archerArrow;
    case Character.rifleman:
      return option === DOWN_SPECIAL ? SpecialAction.riflemanTrap : option === UP_SPECIAL ? SpecialAction.riflemanRecovery
        : option === SIDE_SPECIAL ? SpecialAction.riflemanBear : SpecialAction.riflemanBlaster;
    case Character.demonHunter:
      return option === UP_SPECIAL ? SpecialAction.demonHunterWingAscent : option === DOWN_SPECIAL ? SpecialAction.demonHunterImmolate
        : option === SIDE_SPECIAL ? SpecialAction.demonHunterFelRush : SpecialAction.demonHunterManaBurn;
  }
}

const HERO_SLOTS = [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down] as const;
const SLOT_OPTIONS = [NEUTRAL_SPECIAL, SIDE_SPECIAL, UP_SPECIAL, DOWN_SPECIAL] as const;

/** Appends, twice each so a kit's specials compete with its many normals, the hero specials that suit this frame as `use`. */
function addHeroSpecials(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, use: HeroSpecialUse, count: number): number {
  let added = count;
  for (let index = 0; index < HERO_SLOTS.length; index++) {
    if (heroSpecialUse(f, target, stage, at(HERO_SLOTS, index)) !== use) continue;
    options[added++] = at(SLOT_OPTIONS, index);
    options[added++] = at(SLOT_OPTIONS, index);
  }
  return added;
}

/** Appends the specials that strike from range: shots, Archer's homing arrow, the Rifleman's bear, a hero's projectiles. */
function addShots(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, count: number): number {
  if (f.tuning.specials !== undefined) return addHeroSpecials(f, target, stage, HeroSpecialUse.ranged, count);
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

/** Appends the specials that suit a target close by: each fighter's own, a hero's strikes and stances. */
function addCloseSpecials(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, count: number): number {
  if (f.tuning.specials !== undefined) return addHeroSpecials(f, target, stage, HeroSpecialUse.close, count);
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
      // In the air down special is Flame Crash, a plunge: only over the deck.
      if (localX >= region.minX && localX <= region.maxX && localZ >= region.minZ && localZ <= region.maxZ && (motion.grounded || safeAt(stage, motion.x, 0.0)) && specialReady(f, DOWN_SPECIAL)) options[added++] = DOWN_SPECIAL;
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

/** The move a gameplan names for an option: a dashing jab is the kit's dash attack. */
function gameplanMoveOf(f: Readonly<Fighter>, option: number): GameplanMove {
  if (option === AttackStyle.jab && f.motion.grounded && f.ground.dashFrame > 0 && (f.character === Character.demonHunter || f.tuning.moves !== undefined)) return AttackStyle.dashAttack;
  return toGameplanMove(option);
}

/** A ready passive's landing move weighs this many times its gameplan weight. */
const PASSIVE_WEIGHT = 8;

/**
 * One of the first `count` options, each as likely as its gameplan weight;
 * with `cashing` set, the move that cashes the ready passive weighs more.
 */
function weightedOption(gameplan: Readonly<FighterGameplan>, planIndex: number, f: Readonly<Fighter>, slot: number, target: Readonly<Fighter>, count: number, frame: number, cashing: PassiveKind): number {
  let total = 0;
  for (let index = 0; index < count; index++) {
    const move = gameplanMoveOf(f, at(options, index));
    const weight = moveWeight(gameplan, planIndex, f, slot, target, move) * (passiveLandingMove(gameplan, cashing, move) ? PASSIVE_WEIGHT : 1);
    weights[index] = weight;
    total += weight;
  }
  let pick = botChoice(frame, f.attack.serial * 7 + f.character, total);
  for (let index = 0; index < count; index++) {
    pick -= at(weights, index);
    if (pick < 0) return at(options, index);
  }
  return at(options, count - 1);
}

/**
 * Chooses an attack that reaches the target, or a special that suits the
 * distance, and enters it in input and commands. `ranged` lets a decision
 * with nothing in reach but a special take it. False when it chose nothing.
 */
export function chooseAttack(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, ranged: boolean, input: Controls, commands: AttackBuffer, slot = -1, planIndex: number = SPACE_PLAN, skill: CpuSkill = FULL_SKILL): boolean {
  const gameplan = gameplanOf(f.character);
  const gap = Math.abs(f32(target.motion.x - f.motion.x));
  if (!canAttack(f) && !(f.shield.raised && f.motion.grounded)) return false;
  // A ground attack stops the steering: its slide must end on the deck.
  if (f.motion.grounded && !slideStaysOnDeck(f, stage, matchFrame)) return false;
  let count = 0;
  const dashing = f.ground.dashFrame > 0 && (f.character === Character.demonHunter || f.tuning.moves !== undefined);
  let dashReaches = false;
  if (canAttack(f) || f.shield.raised) {
    if (f.motion.grounded) {
      for (const move of GROUND_MOVES) {
        // A shield lets go only for a grab; a shielding target invites one.
        if (f.shield.raised && move !== AttackStyle.grab) continue;
        const style = dashing && move === AttackStyle.jab ? f.tuning.moves?.dashAttack ?? AttackStyle.demonHunterDashAttack : move;
        const frames = attackStartupFrames(style, f.tuning.moves);
        const x = aheadX(f, target, frames, style);
        const z = aheadZ(f, target, frames, stage, matchFrame);
        // Grabs need the target's centre inside their reach, as the punish chooser requires.
        if (move === AttackStyle.grab && Math.abs(x) > f32(moveReachAhead(f.character, style, target, f.tuning.moves) - hurtCapsule(target.character).radius)) continue;
        // Every attack waits for its reach (#160), or for a ground spacing tool, its spacing level with the target.
        const spaced = gameplan !== undefined && spacedAt(gameplan, dashing && move === AttackStyle.jab ? AttackStyle.dashAttack : move, gap) && wallsOff(f, style, target, Math.abs(x), z);
        if (!spaced && !moveReaches(f.character, style, target, Math.abs(x), z, f.tuning.moves)) continue;
        if (dashing && move === AttackStyle.jab) dashReaches = true;
        options[count++] = move;
        // A grab counts twice: one of ten moves in reach would rarely be it.
        if (move === AttackStyle.grab) options[count++] = move;
      }
    } else {
      for (const aerial of AERIALS) {
        const frames = attackStartupFrames(aerial, f.tuning.moves);
        // The input frame also falls: landing by the first strike cancels the aerial.
        if (landsWithin(f, frames + 1, stage, matchFrame)) continue;
        if (moveReaches(f.character, aerial, target, f32(aheadX(f, target, frames) * f.facing), aheadZ(f, target, frames, stage, matchFrame), f.tuning.moves)) options[count++] = aerial;
      }
    }
  }
  const strikes = count;
  const wantsGrab = skill.grabsShields && target.shield.raised && target.motion.grounded && f.motion.grounded
    && (gameplan === undefined || !avoids(gameplan, "close"));
  const grabReaches = strikes > 0 && at(options, strikes - 1) === AttackStyle.grab;
  // Let the shield walk-in reach grab range instead of stopping it with repeated long normals.
  if (wantsGrab && !grabReaches) return false;
  // A misplay throws any normal near the target, in reach or not.
  if (canAttack(f) && gap <= MISPLAY_GAP && botChance(frame, f.attack.serial * 11 + f.character + 5, skill.misplay, 100)) {
    const moves = f.motion.grounded ? GROUND_MOVES : AERIALS;
    perform(f, target, at(moves, botChoice(frame, f.attack.serial * 3 + f.character, moves.length)), frame, input, commands);
    return true;
  }
  if (canAttack(f)) count = addCloseSpecials(f, target, stage, count);
  const close = count;
  if (canAttack(f)) count = addShots(f, target, stage, count);
  if (count === 0 || (close === 0 && !ranged)) return false;
  const grabbing = skill.grabsShields && target.shield.raised && f.motion.grounded && grabReaches;
  // Running in, the dash attack when it reaches; a ready passive's landing move, never into a shield, which spends it.
  const kit = botChance(frame, f.attack.serial * 13 + f.character + 3, skill.kitTenths, 10);
  const cashing = kit && !target.shield.raised && passivePips(f).ready ? passiveSpec(f.character).kind : PassiveKind.none;
  const dashIn = kit && dashing && f.motion.grounded && !target.shield.raised && dashReaches && cashing === PassiveKind.none && botChoice(frame, f.attack.serial * 5 + f.character, 2) === 0;
  const option = grabbing ? AttackStyle.grab
    : dashIn ? AttackStyle.jab
    : gameplan === undefined || !skill.gameplanWeights ? at(options, botChoice(frame, f.attack.serial * 7 + f.character, count))
    : weightedOption(gameplan, planIndex, f, slot, target, count, frame, cashing);
  perform(f, target, option, frame, input, commands);
  return true;
}
