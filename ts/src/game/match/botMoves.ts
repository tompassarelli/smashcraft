


import { specialCooldownReady } from "../sim/heroSpecialRules";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { botChance, botChoice } from "./botRandom";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { attackCapsule, capsulesIntersect, emptyCapsule, hurtCapsule, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character, LAST_ATTACK_STYLE, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import { groundGatedStyle } from "../sim/attacks";
import type { Fighter } from "../sim/fighter";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import { surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "../sim/stage";
import { bodyTop } from "../sim/surfaces";
import { melee } from "../sim/tuning";
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


const NEUTRAL_SPECIAL = 30;
const SIDE_SPECIAL = 31;
const UP_SPECIAL = 32;
const DOWN_SPECIAL = 33;


const SHOT_LOW = -5.0;
const SHOT_HIGH = 60.0;

const MISPLAY_GAP = 350.0;

const DISENGAGE_ROOM = 420.0;

const SPACING_STEP = 30.0;

const STYLE_SLOTS = LAST_ATTACK_STYLE + 1;

const strikeBounds: number[] = [];
const strikeFilled: boolean[] = [];

const strikeMoves: (FighterMoves | undefined)[] = [];
const scratchRegion = emptyHitRegion();
const scratchCapsule = emptyCapsule();
const projectileFlight = emptyCapsule();
const projectileTarget = emptyCapsule();

const options: number[] = [];

const weights: number[] = [];


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


export function moveReaches(character: Character, style: AttackStyle, target: Readonly<Fighter>, localX: number, localZ: number, moves?: FighterMoves): boolean {
  const index = strikeIndex(character, style, moves);
  const minX = at(strikeBounds, index);
  const maxX = at(strikeBounds, index + 1);
  const minZ = at(strikeBounds, index + 2);
  const maxZ = at(strikeBounds, index + 3);

  if (style === AttackStyle.grab && (localX < 0 || localX > SHARED_GRAB_REGION.maxX)) return false;
  const hurt = hurtCapsule(target.character);
  return localX >= f32(minX - hurt.radius) && localX <= f32(maxX + hurt.radius)
    && localZ >= f32(f32(minZ - hurt.z2) - hurt.radius) && localZ <= f32(f32(maxZ - hurt.z1) + hurt.radius);
}



export function moveReachAhead(character: Character, style: AttackStyle, target: Readonly<Fighter>, moves?: FighterMoves): number {
  const maxX = at(strikeBounds, strikeIndex(character, style, moves) + 1);
  const reach = f32(maxX + hurtCapsule(target.character).radius);
  return style === AttackStyle.grab ? Math.min(reach, SHARED_GRAB_REGION.maxX) : reach;
}


export function aheadX(f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number, style?: AttackStyle, observationAge = 0, stage = -1, matchFrame = 0): number {
  const startupTravel = style === undefined ? undefined : f.tuning.moves?.normals[style]?.startupTravelX;
  const observedNow = horizontalAhead(target, observationAge, stage, matchFrame);
  const toward = observedNow < f.motion.x ? -1 : 1;

  const travel = f.motion.grounded && startupTravel !== undefined ? f32(startupTravel * toward) : travelOver(f, frames);
  return f32(f32(horizontalAhead(target, observationAge + frames, stage, matchFrame) - f.motion.x) - travel);
}






function travelOver(f: Readonly<Fighter>, frames: number): number {
  if (!f.motion.grounded) return f32(f.motion.deltaX * frames);

  const straight = f32(f.motion.vx * frames);
  const speed = Math.abs(f.motion.vx);

  const slide = f32(f32(f32(speed * speed) / f32(2.5 * f.tuning.physics.traction)) + speed);
  return Math.abs(straight) <= slide ? straight : straight < 0 ? f32(-slide) : slide;
}


export const aheadZ = (f: Readonly<Fighter>, target: Readonly<Fighter>, frames: number, stage = -1, matchFrame = 0, observationAge = 0) =>
  f32(heightAhead(target, observationAge + frames, stage, matchFrame) - heightAhead(f, frames, stage, matchFrame));






function wallsOff(f: Readonly<Fighter>, style: AttackStyle, target: Readonly<Fighter>, localX: number, localZ: number): boolean {
  const reach = moveReachAhead(f.character, style, target, f.tuning.moves);
  return localX > 0.0 && localX <= f32(reach + SPACING_STEP) && moveReaches(f.character, style, target, Math.min(localX, reach), localZ, f.tuning.moves);
}


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


function landsWithin(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): boolean {
  if (f.motion.grounded) return false;

  const rising = f.motion.deltaZ > 0.0 ? Math.min(frames, Math.floor(f32(f.motion.deltaZ / f.tuning.physics.gravity))) : 0;
  const peak = heightAhead(f, rising, -1, matchFrame);
  const here = deckUnder(stage, matchFrame, f.motion.x, peak);
  const there = deckUnder(stage, matchFrame, f32(f.motion.x + f32(f.motion.deltaX * frames)), peak);
  const deck = here === undefined ? there : there === undefined ? here : Math.max(here, there);
  return deck !== undefined && heightAhead(f, frames, -1, matchFrame) <= deck;
}

/** A platform climb ends any aerial, so one rising into a platform before its strike is over is wasted. */
function climbsWithin(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): boolean {
  if (f.motion.grounded || f.motion.deltaZ <= 0.0) return false;
  const { z } = f.motion;
  const rising = Math.max(1, Math.min(frames, Math.floor(f32(f.motion.deltaZ / f.tuning.physics.gravity))));
  const body = melee(bodyTop(f.character));
  for (let i = 0; i < surfaceCount(stage); i++) {
    if (!surfacePass(stage, i)) continue;
    const deckZ = surfaceZ(stage, i, matchFrame);
    if (deckZ <= z) continue;
    const left = surfaceLeft(stage, i, matchFrame);
    const right = surfaceRight(stage, i, matchFrame);
    for (let ahead = 1; ahead <= rising; ahead++) {
      const x = f32(f.motion.x + f32(f.motion.deltaX * ahead));
      if (x < left || x > right) continue;
      if (f32(heightAhead(f, ahead, -1, matchFrame) + body) >= deckZ) return true;
    }
  }
  return false;
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


function addHeroSpecials(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, use: HeroSpecialUse, count: number, observationAge: number): number {
  let added = count;
  const gameplan = gameplanOf(f.character);
  for (let index = 0; index < HERO_SLOTS.length; index++) {
    if (heroSpecialUse(f, target, stage, at(HERO_SLOTS, index), observationAge) !== use) continue;

    if (f.character === Character.thrall && at(HERO_SLOTS, index) === SpecialSlot.neutral
      && (gameplan === undefined || !spacedAt(gameplan, NEUTRAL_SPECIAL, Math.abs(aheadX(f, target, 0, undefined, observationAge)))
        || Math.abs(aheadX(f, target, 0, undefined, observationAge)) <= moveReachAhead(f.character, AttackStyle.forwardTilt, target, f.tuning.moves)
        || f32(target.motion.deltaX * f.facing) <= 0.0)) continue;

    if (f.character === Character.forsakenPaladin && at(HERO_SLOTS, index) === SpecialSlot.side
      && Math.abs(aheadX(f, target, 0, undefined, observationAge)) > moveReachAhead(f.character, AttackStyle.forwardTilt, target, f.tuning.moves)
      && f32(target.motion.deltaX * f.facing) <= 0.0) continue;
    options[added++] = at(SLOT_OPTIONS, index);
    if (f.character !== Character.thrall || at(HERO_SLOTS, index) !== SpecialSlot.neutral) options[added++] = at(SLOT_OPTIONS, index);
  }
  return added;
}


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


function addCloseSpecials(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, count: number, observationAge: number): number {
  if (f.tuning.specials !== undefined) return addHeroSpecials(f, target, stage, HeroSpecialUse.close, count, observationAge);
  const { motion } = f;
  const dx = aheadX(f, target, 0, undefined, observationAge);
  const dz = f32(target.motion.z - motion.z);
  const distance = Math.abs(dx);
  const facing = dx === 0 ? f.facing : dx > 0 ? 1 : -1;
  let added = count;

  const overhead = motion.grounded && dz >= 150 && dz <= 500 && distance <= 150 && safeAt(stage, motion.x, 200.0);
  if (overhead && f.character !== Character.rifleman && specialReady(f, UP_SPECIAL)) {
    options[added++] = UP_SPECIAL;
    options[added++] = UP_SPECIAL;
  }
  switch (f.character) {
    case Character.rifleman: {
      if (motion.grounded && target.motion.grounded && target.motion.surface === motion.surface && f.freezeTrap.life <= 0 && f.freezeTrap.cooldown <= 0
        && distance >= 50 && distance <= 260 && specialReady(f, DOWN_SPECIAL)) options[added++] = DOWN_SPECIAL;

      const raised = motion.grounded && motion.surface !== undefined && motion.surface > 0;
      if ((!motion.grounded || raised) && safeAt(stage, motion.x, 60.0) && specialReady(f, UP_SPECIAL)) {
        const ahead = f32(aheadX(f, target, 4, undefined, observationAge) * f.facing);
        const below = aheadZ(f, target, 4);

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

      if (localX >= region.minX && localX <= region.maxX && localZ >= region.minZ && localZ <= region.maxZ && (motion.grounded || safeAt(stage, motion.x, 0.0)) && specialReady(f, DOWN_SPECIAL)) options[added++] = DOWN_SPECIAL;
      break;
    }
  }
  return added;
}


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

    const smash = option === AttackStyle.upSmash || option === AttackStyle.downSmash || option === AttackStyle.forwardSmash;
    const charge = smash && botChoice(f.attack.serial + 1, f.character, 4) > 0;
    queueAttack(commands, { style: option, facing: toward, frame, mayCharge: charge });
    input.attackHeld = charge;
    return;
  }

  const request = option === AttackStyle.neutralAir ? AttackStyle.jab : option === AttackStyle.upAir ? AttackStyle.upTilt
    : option === AttackStyle.downAir ? AttackStyle.downTilt : AttackStyle.forwardTilt;
  queueAttack(commands, { style: request, facing: option === AttackStyle.backAir ? (facing < 0 ? 1 : -1) : facing, frame, mayCharge: false });
}


function gameplanMoveOf(f: Readonly<Fighter>, option: number): GameplanMove {
  if (option === AttackStyle.jab && f.motion.grounded && f.ground.dashFrame > 0 && (f.character === Character.demonHunter || f.tuning.moves !== undefined)) return AttackStyle.dashAttack;
  return toGameplanMove(option);
}








export const VARIETY_STARTS = 6;

export const VARIETY_FRAMES = 600;

const VARIETY_SCALE = 12;

export const VARIETY_PASS_STARTS = 2;


export function recentStarts(strategy: Readonly<BotStrategy>, option: number, frame: number): number {
  if (option < NEUTRAL_SPECIAL) return 0;
  let starts = 0;
  for (let index = 0; index < 2 * VARIETY_STARTS; index += 2) {
    const started = at(strategy.recentOptions, index + 1);
    if (at(strategy.recentOptions, index) === option && started >= 0 && started <= frame && frame - started < VARIETY_FRAMES) starts++;
  }
  return starts;
}


let passedForVariety = false;

export const lastChoicePassedForVariety = (): boolean => passedForVariety;


const varietyDivisor = (starts: number): number => 1 + starts;


function rememberStart(strategy: BotStrategy, option: number, frame: number): void {
  const recent = strategy.recentOptions;
  for (let index = 0; index < 2 * VARIETY_STARTS - 2; index++) recent[index] = at(recent, index + 2);
  recent[2 * VARIETY_STARTS - 2] = option;
  recent[2 * VARIETY_STARTS - 1] = frame;
}


function nothingFresh(strategy: Readonly<BotStrategy>, count: number, frame: number): boolean {
  for (let index = 0; index < count; index++) if (recentStarts(strategy, at(options, index), frame) < VARIETY_PASS_STARTS) return false;
  return true;
}




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






export function chooseAttack(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, ranged: boolean, input: Controls, commands: AttackBuffer, slot = -1, planIndex: number = SPACE_PLAN, skill: CpuSkill = FULL_SKILL, observationAge = 0, decision?: AttackDecision): boolean {
  passedForVariety = false;
  const gameplan = gameplanOf(f.character, skill.basicMoves);
  const dx = aheadX(f, target, 0, undefined, observationAge, stage, matchFrame);
  const gap = Math.abs(dx);
  const toward = dx === 0 ? f.facing : dx > 0 ? 1 : -1;
  if (!canAttack(f) && !(f.shield.raised && f.motion.grounded)) return false;

  if (f.motion.grounded && !slideStaysOnDeck(f, stage, matchFrame)) return false;
  let count = 0;
  const dashing = f.ground.dashFrame > 0 && (f.character === Character.demonHunter || f.tuning.moves !== undefined);
  let dashReaches = false;
  if (canAttack(f) || f.shield.raised) {
    if (f.motion.grounded) {
      for (const move of GROUND_MOVES) {

        if (f.shield.raised && move !== AttackStyle.grab) continue;
        const gated = groundGatedStyle(f, move);
        if (gated === undefined || (gated !== move && move !== AttackStyle.jab)) continue;
        const style = dashing && move === AttackStyle.jab ? f.tuning.moves?.dashAttack ?? AttackStyle.demonHunterDashAttack : move;
        const frames = attackStartupFrames(style, f.tuning.moves);
        if (ownShotArrives(f, target, frames, observationAge, stage, matchFrame)) continue;

        const x = f32(aheadX(f, target, frames, style, observationAge, stage, matchFrame) * toward);
        const z = aheadZ(f, target, frames + 1, stage, matchFrame, observationAge);

        if (move === AttackStyle.grab && Math.abs(x) > f32(moveReachAhead(f.character, style, target, f.tuning.moves) - hurtCapsule(target.character).radius)) continue;

        const spaced = gameplan !== undefined && spacedAt(gameplan, dashing && move === AttackStyle.jab ? AttackStyle.dashAttack : move, gap) && wallsOff(f, style, target, x, z);
        if (!spaced && !moveReaches(f.character, style, target, x, z, f.tuning.moves)) continue;
        if (dashing && move === AttackStyle.jab) dashReaches = true;
        options[count++] = move;

        if (move === AttackStyle.grab) options[count++] = move;
      }
    } else {
      for (const aerial of AERIALS) {
        const frames = attackStartupFrames(aerial, f.tuning.moves);

        if (landsWithin(f, frames + 1, stage, matchFrame)) continue;
        if (climbsWithin(f, frames + characterAttackActiveFrames(f.character, aerial, f.tuning.moves), stage, matchFrame)) continue;
        if (moveReaches(f.character, aerial, target, f32(aheadX(f, target, frames, aerial, observationAge, stage, matchFrame) * f.facing), aheadZ(f, target, frames + 1, stage, matchFrame, observationAge), f.tuning.moves)) options[count++] = aerial;
      }
    }
  }
  const strikes = count;
  const wantsGrab = skill.grabsShields && target.shield.raised && target.motion.grounded && f.motion.grounded
    && (gameplan === undefined || !avoids(gameplan, "close"));
  const grabReaches = strikes > 0 && at(options, strikes - 1) === AttackStyle.grab;

  if (wantsGrab && !grabReaches) return false;

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
