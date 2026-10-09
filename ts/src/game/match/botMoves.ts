// The computer's attacks: the moves of its fighter that reach the opponent
// where both will be on the move's first active frame, and the specials that
// suit the distance, one chosen deterministically among them.
import { specialCooldownReady } from "../sim/heroSpecialRules";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { botChance, botChoice } from "./botRandom";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { attackCapsule, capsulesIntersect, emptyCapsule, hurtCapsule, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character, LAST_ATTACK_STYLE, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackStartupFrames } from "../sim/moves";
import { BLASTER_PROJECTILE_RADIUS } from "../sim/projectiles";
import type { FighterMoves } from "../sim/heroMoves";
import type { Controls } from "../sim/roster";
import { immolationRegion } from "../sim/specials";
import { deckUnder, heightAhead, horizontalAhead, safeAt, slideStaysOnDeck } from "./botFooting";
import { HeroSpecialUse, heroSpecialUse } from "./botHeroKit";
import { SpecialSlot } from "../sim/heroSpecials";
import { SPACE_PLAN, avoids, gameplanOf, moveWeight, spacedAt, toGameplanMove } from "./botGameplan";
import type { FighterGameplan, GameplanMove } from "../sim/gameplan";
import { type CpuSkill, FULL_SKILL } from "./cpuSkill";
import { type AttackDecision, familiarOption, moveValueMultiplier } from "./botMoveValue";
import type { BotStrategy } from "./botStrategy";

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
/** the reference body's Disengage hops him about this far back. */
const DISENGAGE_ROOM = 420.0;
/** A spacing tool is thrown as a wall at most this far past its reach: a step the target takes into it. */
const SPACING_STEP = 30.0;

const STYLE_SLOTS = LAST_ATTACK_STYLE + 1;
// Preallocated: strike bounds filled the first time a move is asked about, four per character and style.
const strikeBounds: number[] = [];
const strikeFilled: boolean[] = [];
// The kit each slot's bounds were filled from: a kit's moves are shared and immutable, so the same object gives the same bounds.
const strikeMoves: (FighterMoves | undefined)[] = [];
const scratchRegion = emptyHitRegion();
const scratchCapsule = emptyCapsule();
const projectileFlight = emptyCapsule();
const projectileTarget = emptyCapsule();
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
    const strike = attackCapsule(scratchCapsule, style, region);
    const low = f32(Math.min(strike.x1, strike.x2) - strike.radius);
    const high = f32(Math.max(strike.x1, strike.x2) + strike.radius);
    const bottom = f32(Math.min(strike.z1, strike.z2) - strike.radius);
    const top = f32(Math.max(strike.z1, strike.z2) + strike.radius);
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
  // A grab box takes the body like a strike but rejects a target whose feet lie behind or beyond its reach (#337).
  if (style === AttackStyle.grab && (localX < 0 || localX > SHARED_GRAB_REGION.maxX)) return false;
  const hurt = hurtCapsule(target.character);
  return localX >= f32(minX - hurt.radius) && localX <= f32(maxX + hurt.radius)
    && localZ >= f32(f32(minZ - hurt.z2) - hurt.radius) && localZ <= f32(f32(maxZ - hurt.z1) + hurt.radius);
}


/** How far ahead `style` from the attacker strikes a target's position on its first active frame. */
export function moveReachAhead(character: Character, style: AttackStyle, target: Readonly<Fighter>, moves?: FighterMoves): number {
  const maxX = at(strikeBounds, strikeIndex(character, style, moves) + 1);
  const reach = f32(maxX + hurtCapsule(target.character).radius);
  return style === AttackStyle.grab ? Math.min(reach, SHARED_GRAB_REGION.maxX) : reach;
}

/** The delayed target keeps its observed velocity until it lands on a deck of `stage` (none for -1); the attacker starts sliding now. */
export function aheadX(f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number, style?: AttackStyle, observationAge = 0, stage = -1, matchFrame = 0): number {
  const startupTravel = style === undefined ? undefined : f.tuning.moves?.normals[style]?.startupTravelX;
  const observedNow = horizontalAhead(target, observationAge, stage, matchFrame);
  const toward = observedNow < f.motion.x ? -1 : 1;
  // Authored startup travel clears ground velocity when the attack begins.
  const travel = f.motion.grounded && startupTravel !== undefined ? f32(startupTravel * toward) : travelOver(f, frames, style);
  return f32(f32(horizontalAhead(target, observationAge + frames, stage, matchFrame) - f.motion.x) - travel);
}

/**
 * How far the attacker travels over `frames` more frames: its last frame's
 * travel, but on the ground no further than its slide once the attack stops
 * its steering, so a run doesn't carry a slow smash into reach (#160).
 */
function travelOver(f: Readonly<Fighter>, frames: number, style?: AttackStyle): number {
  if (!f.motion.grounded) {
    const fall = style === undefined ? undefined : f.tuning.moves?.normals[style]?.fall;
    if (fall === undefined) return f32(f.motion.deltaX * frames);
    let travel = 0.0;
    let speed = f.motion.deltaX;
    let elapsed = 0;
    for (const phase of fall) {
      if (phase.speedX === undefined || phase.firstFrame >= frames) continue;
      const before = Math.max(0, phase.firstFrame - elapsed);
      travel = f32(travel + f32(speed * before));
      speed = f32(phase.speedX * f.facing);
      const end = Math.min(frames, phase.lastFrame + 1);
      travel = f32(travel + f32(speed * (end - elapsed - before)));
      elapsed = end;
    }
    return f32(travel + f32(speed * (frames - elapsed)));
  }
  // A dash reversal changes velocity before the last frame's travel catches up.
  const straight = f32(f.motion.vx * frames);
  const speed = Math.abs(f.motion.vx);
  // Counted a little short, as if braking at 1.25 times its traction: a reach overestimated is a swing at nothing.
  const slide = f32(f32(f32(speed * speed) / f32(2.5 * f.tuning.physics.traction)) + speed);
  return Math.abs(straight) <= slide ? straight : straight < 0 ? f32(-slide) : slide;
}

/** The target's height over the attacker after `frames` more frames, each landing on a deck of `stage` it falls onto (none for stage -1). */
export const aheadZ = (f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number, stage = -1, matchFrame = 0, observationAge = 0) =>
  f32(heightAhead(target, observationAge + frames, stage, matchFrame) - heightAhead(f, frames, stage, matchFrame));

/**
 * Whether a spacing tool thrown now walls off the target localX ahead and
 * localZ above: level with it, ahead, and at most a step past its reach, so
 * the target walks into it. Never at a target on another deck (#160).
 */
function wallsOff(f: Readonly<Fighter>, style: AttackStyle, target: Readonly<Fighter>, localX: number, localZ: number): boolean {
  const reach = moveReachAhead(f.character, style, target, f.tuning.moves);
  return localX > 0.0 && localX <= f32(reach + SPACING_STEP) && moveReaches(f.character, style, target, Math.min(localX, reach), localZ, f.tuning.moves);
}

/** A shot already in flight launches the target before a normal can reach its observed position. */
function ownShotArrives(f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number, observationAge: number, stage: number, matchFrame: number): boolean {
  placeCapsule(projectileTarget, hurtCapsule(target.character), horizontalAhead(target, observationAge, stage, matchFrame), heightAhead(target, observationAge, stage, matchFrame), target.facing);
  for (const shot of f.projectiles) {
    if (shot.life <= 0) continue;
    const flight = Math.min(frames, shot.life);
    projectileFlight.x1 = shot.x;
    projectileFlight.z1 = shot.z;
    projectileFlight.x2 = f32(shot.x + f32(shot.velocityX * flight));
    projectileFlight.z2 = f32(shot.z + f32(shot.velocityZ * flight));
    projectileFlight.radius = shot.spec?.radius ?? BLASTER_PROJECTILE_RADIUS;
    if (capsulesIntersect(projectileFlight, projectileTarget)) return true;
  }
  return false;
}

/** Whether an airborne fighter lands on a deck within `frames` frames, cancelling an aerial started now before it strikes. */
function landsWithin(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): boolean {
  if (f.motion.grounded) return false;
  // A pass-through deck it rises through or drifts over catches it on the way down: the decks under its arc's top, where it is and where it drifts, count.
  const rising = f.motion.deltaZ > 0.0 ? Math.min(frames, Math.floor(f32(f.motion.deltaZ / f.tuning.physics.gravity))) : 0;
  const peak = heightAhead(f, rising, -1, matchFrame);
  const here = deckUnder(stage, matchFrame, f.motion.x, peak);
  const there = deckUnder(stage, matchFrame, f32(f.motion.x + f32(f.motion.deltaX * frames)), peak);
  const deck = here === undefined ? there : there === undefined ? here : Math.max(here, there);
  return deck !== undefined && heightAhead(f, frames, -1, matchFrame) <= deck;
}

function specialReady(f: Readonly<Fighter>, option: number): boolean {
  const { special } = f;
  const action = specialAction(f.character, option);
  return specialCooldownReady(f, action) && special.lockFrames <= 0 && special.action === SpecialAction.none && canAttack(f);
}

function specialAction(character: Character, option: number): SpecialAction {
  switch (character) {
    default:
      return option === UP_SPECIAL ? SpecialAction.heroUp : option === DOWN_SPECIAL ? SpecialAction.heroDown
        : option === SIDE_SPECIAL ? SpecialAction.heroSide : SpecialAction.heroNeutral;
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

/** Appends the hero specials that suit this frame as `use`, doubling all but Thrall's retreat check. */
function addHeroSpecials(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, use: HeroSpecialUse, count: number, observationAge: number): number {
  let added = count;
  const gameplan = gameplanOf(f.character);
  for (let index = 0; index < HERO_SLOTS.length; index++) {
    if (heroSpecialUse(f, target, stage, at(HERO_SLOTS, index), observationAge) !== use) continue;
    // Lightning checks a retreat beyond Doomhammer; an incoming target invites the hammer instead.
    if (f.character === Character.thrall && at(HERO_SLOTS, index) === SpecialSlot.neutral
      && (gameplan === undefined || !spacedAt(gameplan, NEUTRAL_SPECIAL, Math.abs(aheadX(f, target, 0, undefined, observationAge)))
        || Math.abs(aheadX(f, target, 0, undefined, observationAge)) <= moveReachAhead(f.character, AttackStyle.forwardTilt, target, f.tuning.moves)
        || f32(target.motion.deltaX * f.facing) <= 0.0)) continue;
    // Fury catches a retreat; an approaching target beyond hammer range must come to the hammer first.
    if (f.character === Character.forsakenPaladin && at(HERO_SLOTS, index) === SpecialSlot.side
      && Math.abs(aheadX(f, target, 0, undefined, observationAge)) > moveReachAhead(f.character, AttackStyle.forwardTilt, target, f.tuning.moves)
      && f32(target.motion.deltaX * f.facing) <= 0.0) continue;
    options[added++] = at(SLOT_OPTIONS, index);
    if (f.character !== Character.thrall || at(HERO_SLOTS, index) !== SpecialSlot.neutral) options[added++] = at(SLOT_OPTIONS, index);
  }
  return added;
}

/** Appends the specials that strike from range: shots, the reference body's homing arrow, the Rifleman's bear, a hero's projectiles. */
function addShots(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, count: number, observationAge: number): number {
  if (f.tuning.specials !== undefined) return addHeroSpecials(f, target, stage, HeroSpecialUse.ranged, count, observationAge);
  const { motion } = f;
  const dx = aheadX(f, target, 0, undefined, observationAge);
  const dz = f32(target.motion.z - motion.z);
  const distance = Math.abs(dx);
  const facing = dx === 0 ? f.facing : dx > 0 ? 1 : -1;
  let added = count;
  if (motion.grounded && facing === f.facing && distance >= 160 && distance <= 700 && dz >= SHOT_LOW && dz <= SHOT_HIGH && specialReady(f, NEUTRAL_SPECIAL)) {
    options[added++] = NEUTRAL_SPECIAL;
  }
  const plan = gameplanOf(f.character);
  if (f.character === Character.rifleman && motion.grounded && target.motion.grounded && f.bear.life <= 0 && distance >= 80 && distance <= 450
    && Math.abs(dz) <= 60 && specialReady(f, SIDE_SPECIAL)) options[added++] = SIDE_SPECIAL;
  return added;
}

/** Appends the specials that suit a target close by: each fighter's own, a hero's strikes and stances. */
function addCloseSpecials(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, count: number, observationAge: number): number {
  if (f.tuning.specials !== undefined) return addHeroSpecials(f, target, stage, HeroSpecialUse.close, count, observationAge);
  const { motion } = f;
  const dx = aheadX(f, target, 0, undefined, observationAge);
  const dz = f32(target.motion.z - motion.z);
  const distance = Math.abs(dx);
  const facing = dx === 0 ? f.facing : dx > 0 ? 1 : -1;
  let added = count;
  // the reference body's mount and Illidan's ascent strike nothing: they chase a target high overhead from the middle of the deck.
  const overhead = motion.grounded && dz >= 150 && dz <= 500 && distance <= 150 && safeAt(stage, motion.x, 200.0);
  if (overhead && f.character !== Character.rifleman && specialReady(f, UP_SPECIAL)) {
    options[added++] = UP_SPECIAL;
    options[added++] = UP_SPECIAL;
  }
  switch (f.character) {
    case Character.rifleman: {
      if (motion.grounded && target.motion.grounded && target.motion.surface === motion.surface && f.freezeTrap.life <= 0 && f.freezeTrap.cooldown <= 0
        && distance >= 50 && distance <= 260 && specialReady(f, DOWN_SPECIAL)) options[added++] = DOWN_SPECIAL;
      // The recoil shot drops from just ahead of him as his up special lifts him: in the air or on a raised deck, over a target below.
      const raised = motion.grounded && motion.surface !== undefined && motion.surface > 0;
      if ((!motion.grounded || raised) && safeAt(stage, motion.x, 60.0) && specialReady(f, UP_SPECIAL)) {
        const ahead = f32(aheadX(f, target, 4, undefined, observationAge) * f.facing);
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
      const localX = f32(aheadX(f, target, 4, undefined, observationAge) * f.facing);
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

function perform(f: Readonly<Fighter>, target: Readonly<Fighter>, option: number, frame: number, input: Controls, commands: AttackBuffer, observationAge: number, stage: number, matchFrame: number): void {
  const dx = aheadX(f, target, 0, undefined, observationAge, stage, matchFrame);
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


// Move variety (#279, #275, #280, #281): an option the chooser started
// among the last VARIETY_STARTS starts, within VARIETY_FRAMES, weighs less
// for each such start; when every option in reach is such a repeat, the
// chooser passes, so the computer moves instead of cycling its ranged
// answers.
/** Starts the move-variety rule remembers. */
export const VARIETY_STARTS = 6;
/** The span, in match frames, a start counts against its option. */
export const VARIETY_FRAMES = 600;
/** Weights are scaled by this before a repeat divides them, keeping them whole and above zero. */
const VARIETY_SCALE = 12;
/** When every option in reach was started this many times in the span, the chooser passes. */
export const VARIETY_PASS_STARTS = 2;

/** How many times `option` was started in the last VARIETY_FRAMES frames. */
export function recentStarts(strategy: Readonly<BotStrategy>, option: number, frame: number): number {
  if (option < NEUTRAL_SPECIAL) return 0;
  let starts = 0;
  for (let index = 0; index < 2 * VARIETY_STARTS; index += 2) {
    const started = at(strategy.recentOptions, index + 1);
    if (at(strategy.recentOptions, index) === option && started >= 0 && started <= frame && frame - started < VARIETY_FRAMES) starts++;
  }
  return starts;
}

// Set by the last chooseAttack call and read by its caller in the same frame: no state outlives the decision.
let passedForVariety = false;
/** Whether the last chooseAttack passed because nothing fresh was in reach; the computer then closes in instead of holding its spacing. */
export const lastChoicePassedForVariety = (): boolean => passedForVariety;

/** Each recent start divides an option's weight further: by 1, 2, 3... for none, one, two starts. */
const varietyDivisor = (starts: number): number => 1 + starts;

/** Records a start, dropping the oldest. */
function rememberStart(strategy: BotStrategy, option: number, frame: number): void {
  const recent = strategy.recentOptions;
  for (let index = 0; index < 2 * VARIETY_STARTS - 2; index++) recent[index] = at(recent, index + 2);
  recent[2 * VARIETY_STARTS - 2] = option;
  recent[2 * VARIETY_STARTS - 1] = frame;
}

/** Whether every one of the first `count` options was already started enough in the span to be passed over: nothing fresh is in reach. */
function nothingFresh(strategy: Readonly<BotStrategy>, count: number, frame: number): boolean {
  for (let index = 0; index < count; index++) if (recentStarts(strategy, at(options, index), frame) < VARIETY_PASS_STARTS) return false;
  return true;
}

/**
 * One of the first `count` options, each as likely as its gameplan weight.
 */
function weightedOption(gameplan: Readonly<FighterGameplan> | undefined, planIndex: number, f: Readonly<Fighter>, slot: number, target: Readonly<Fighter>, count: number, frame: number, decision?: AttackDecision): number {
  let total = 0;
  for (let index = 0; index < count; index++) {
    const move = gameplanMoveOf(f, at(options, index));
    const base = gameplan === undefined ? 1 : moveWeight(gameplan, planIndex, f, slot, target, move);
    const weight = decision === undefined ? base
      : Math.max(1, floorDiv(base * moveValueMultiplier(f, target, at(options, index), decision) * VARIETY_SCALE, varietyDivisor(recentStarts(decision.strategy, at(options, index), frame))));
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
export function chooseAttack(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, ranged: boolean, input: Controls, commands: AttackBuffer, slot = -1, planIndex: number = SPACE_PLAN, skill: CpuSkill = FULL_SKILL, observationAge = 0, decision?: AttackDecision): boolean {
  passedForVariety = false;
  const gameplan = gameplanOf(f.character, skill.basicMoves);
  const dx = aheadX(f, target, 0, undefined, observationAge, stage, matchFrame);
  const gap = Math.abs(dx);
  const toward = dx === 0 ? f.facing : dx > 0 ? 1 : -1;
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
        if (ownShotArrives(f, target, frames, observationAge, stage, matchFrame)) continue;
        // A slide may carry the attacker past its target; the queued facing stays fixed.
        const x = f32(aheadX(f, target, frames, style, observationAge, stage, matchFrame) * toward);
        const z = aheadZ(f, target, frames + 1, stage, matchFrame, observationAge);
        // Grabs need the target's centre inside their reach, as the punish chooser requires.
        if (move === AttackStyle.grab && Math.abs(x) > f32(moveReachAhead(f.character, style, target, f.tuning.moves) - hurtCapsule(target.character).radius)) continue;
        // Every attack waits for its reach (#160), or for a ground spacing tool, its spacing level with the target.
        const spaced = gameplan !== undefined && spacedAt(gameplan, dashing && move === AttackStyle.jab ? AttackStyle.dashAttack : move, gap) && wallsOff(f, style, target, x, z);
        if (!spaced && !moveReaches(f.character, style, target, x, z, f.tuning.moves)) continue;
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
        if (moveReaches(f.character, aerial, target, f32(aheadX(f, target, frames, aerial, observationAge, stage, matchFrame) * f.facing), aheadZ(f, target, frames + 1, stage, matchFrame, observationAge), f.tuning.moves)) options[count++] = aerial;
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
  if (skill.basicMoves === undefined && canAttack(f) && gap <= MISPLAY_GAP && botChance(frame, f.attack.serial * 11 + f.character + 5, skill.misplay, 100)) {
    const moves = f.motion.grounded ? GROUND_MOVES : AERIALS;
    perform(f, target, at(moves, botChoice(frame, f.attack.serial * 3 + f.character, moves.length)), frame, input, commands, observationAge, stage, matchFrame);
    return true;
  }
  if (canAttack(f)) count = addCloseSpecials(f, target, stage, count, observationAge);
  const close = count;
  if (canAttack(f)) count = addShots(f, target, stage, count, observationAge);
  if (skill.basicMoves !== undefined) {
    let kept = 0;
    for (let index = 0; index < count; index++) {
      const option = at(options, index);
      if (skill.basicMoves.includes(gameplanMoveOf(f, option))) options[kept++] = option;
    }
    count = kept;
  }
  if (count === 0 || (close === 0 && !ranged)) return false;
  if (decision !== undefined && nothingFresh(decision.strategy, count, frame)) {
    passedForVariety = true;
    return false;
  }
  const grabbing = skill.basicMoves === undefined && skill.grabsShields && target.shield.raised && f.motion.grounded && grabReaches;
  // Running in, the dash attack when it reaches.
  const kit = botChance(frame, f.attack.serial * 13 + f.character + 3, skill.kitTenths, 10);
  const dashIn = skill.basicMoves === undefined && kit && dashing && f.motion.grounded && !target.shield.raised && dashReaches && botChoice(frame, f.attack.serial * 5 + f.character, 2) === 0;
  const familiar = decision === undefined ? undefined : familiarOption(options, count, f, frame, decision);
  const option = grabbing ? AttackStyle.grab
    : dashIn ? AttackStyle.jab
    : familiar ?? weightedOption(skill.gameplanWeights ? gameplan : undefined, planIndex, f, slot, target, count, frame, decision);
  if (decision !== undefined) {
    decision.strategy.lastOption = option;
    rememberStart(decision.strategy, option, frame);
  }
  perform(f, target, option, frame, input, commands, observationAge, stage, matchFrame);
  return true;
}
